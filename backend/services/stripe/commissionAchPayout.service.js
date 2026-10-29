/**
 * Bank-to-bank commission ACH for the USA:
 * 1) Debit the principal broker / firm bank (OrganizationBankingProfile)
 * 2) After the debit clears, transfer + payout to the LO / co-broker bank
 *    collected at invite join (UserBankingProfile via Stripe Connect).
 *
 * Settlement webhooks: payment_intent.succeeded|payment_failed,
 * payout.paid|failed|canceled.
 */

const { randomUUID } = require("crypto");
const { getStripeClient, getStripeSecretKey, isStripeConfigured } = require("./stripeBilling");
const { logCommissionAuditEvent } = require("../commission/auditCommissionEvent");
const { createOrgAchDebit } = require("./commissionOrgFunding.service");
const {
  sendCommissionPayoutSubmittedEmail,
  sendCommissionPayoutSettledEmail,
  sendCommissionPayoutFailedEmail,
} = require("../emails/commissionEmails");
const {
  decimalToNumber,
  roundMoney,
  isReservedPayout,
  sumPayoutAmounts,
  maskAccountLast4,
  formatCommissionRecord,
} = require("../../utils/commission/commissionHelpers");
const { commissionInclude } = require("../../utils/commission/commissionQueryHelpers");

const ACH_RECIPIENT_ROLES = new Set(["LOAN_OFFICER", "CO_BROKER"]);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function payoutError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isCommissionAchEnabled() {
  const flag = String(process.env.STRIPE_COMMISSION_PAYOUTS_ENABLED || "")
    .trim()
    .toLowerCase();
  return flag === "true" && isStripeConfigured();
}

function isStripeTestKey() {
  return getStripeSecretKey().startsWith("sk_test_");
}

function toCents(amount) {
  return Math.round(roundMoney(amount) * 100);
}

function redactFinancialText(text, secrets = []) {
  let out = String(text || "");
  for (const secret of secrets) {
    const value = String(secret || "").replace(/\s+/g, "");
    if (value.length >= 4) out = out.split(value).join("****");
  }
  out = out.replace(/\d{5,}/g, "****");
  return out.replace(/\s+/g, " ").trim().slice(0, 400);
}

function splitPersonName(partyName) {
  const parts = String(partyName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return { firstName: "Account", lastName: "Holder" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "Holder" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function normalizeUsPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

function publicAcceptanceIp(ip) {
  const value = String(ip || "").trim();
  if (
    !value ||
    value === "::1" ||
    value.startsWith("127.") ||
    value.startsWith("10.") ||
    value.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(value)
  ) {
    return null;
  }
  return value;
}

function bankAccountParams(profile) {
  return {
    object: "bank_account",
    country: "US",
    currency: "usd",
    account_holder_name: profile.accountName,
    account_holder_type: profile.accountType === "BUSINESS" ? "company" : "individual",
    routing_number: String(profile.abaRoutingNumber || "").replace(/\D/g, ""),
    account_number: String(profile.accountNumber || "").replace(/\D/g, ""),
  };
}

function buildConnectAccountParams(profile, user, { requestIp, testMode }) {
  const phone = normalizeUsPhone(profile.partyTel || user?.phone);
  const acceptanceIp = publicAcceptanceIp(requestIp) || (testMode ? "8.8.8.8" : null);
  if (!acceptanceIp) {
    throw payoutError(
      "A public IP is required before Stripe can accept this payout account",
    );
  }

  const externalAccount = bankAccountParams(profile);
  const businessUrl = String(
    process.env.FRONTEND_URL || process.env.BROKER_DASHBOARD_URL || "",
  )
    .trim() || (testMode ? "https://example.com" : "");

  const params = {
    country: "US",
    email: profile.partyEmail || user?.email || undefined,
    business_type: profile.accountType === "BUSINESS" ? "company" : "individual",
    capabilities: {
      transfers: { requested: true },
    },
    controller: {
      stripe_dashboard: { type: "none" },
      fees: { payer: "application" },
      losses: { payments: "application" },
      requirement_collection: "application",
    },
    tos_acceptance: {
      date: Math.floor(Date.now() / 1000),
      ip: acceptanceIp,
    },
    business_profile: {
      mcc: "8999",
      product_description: "Loan brokerage commission recipient",
      ...(businessUrl ? { url: businessUrl } : {}),
    },
    settings: {
      payouts: {
        schedule: { interval: "manual" },
      },
    },
    external_account: externalAccount,
    metadata: {
      userId: profile.userId,
      purpose: "commission_payout",
    },
  };

  if (profile.accountType === "BUSINESS") {
    params.company = {
      name: profile.partyName,
      ...(phone ? { phone } : {}),
    };
  } else {
    const name = splitPersonName(profile.partyName || user?.firstName);
    params.individual = {
      first_name: user?.firstName || name.firstName,
      last_name: user?.lastName || name.lastName,
      email: profile.partyEmail || user?.email || undefined,
      ...(phone ? { phone } : {}),
    };
  }

  if (testMode) {
    const testIdentity = {
      id_number: "000000000",
      ssn_last_4: "0000",
      dob: { day: 1, month: 1, year: 1901 },
      address: {
        line1: "address_full_match",
        city: "South San Francisco",
        state: "CA",
        postal_code: "94080",
        country: "US",
      },
    };
    if (params.individual) Object.assign(params.individual, testIdentity);
    if (params.company) {
      params.company.tax_id = "000000000";
      params.company.address = testIdentity.address;
    }
  }

  return params;
}

function buildTransferParams(payout, connectedAccountId) {
  return {
    params: {
      amount: toCents(payout.amount),
      currency: "usd",
      destination: connectedAccountId,
      description: "Commission payout",
      metadata: { commissionPayoutId: payout.id },
    },
    options: { idempotencyKey: `commission-ach-transfer-${payout.id}` },
  };
}

function buildBankPayoutParams(payout) {
  return {
    params: {
      amount: toCents(payout.amount),
      currency: "usd",
      method: "standard",
      statement_descriptor: "COMMISSION",
      metadata: { commissionPayoutId: payout.id },
    },
    options: { idempotencyKey: `commission-ach-payout-${payout.id}` },
  };
}

function assertBankProfile(profile) {
  if (!profile) {
    throw payoutError(
      "No bank account is on file. This person needs to join with the invite link and submit banking details",
    );
  }
  const routing = String(profile.abaRoutingNumber || "").replace(/\D/g, "");
  const accountNumber = String(profile.accountNumber || "").replace(/\D/g, "");
  if (!/^\d{9}$/.test(routing)) {
    throw payoutError("The saved ABA routing number is not a 9-digit US routing number");
  }
  if (!/^\d{4,17}$/.test(accountNumber)) {
    throw payoutError("The saved account number cannot be used for an ACH payout");
  }
}

function capabilityError(account) {
  const due = (account?.requirements?.currently_due || []).slice(0, 8);
  if (due.length) {
    return `Stripe cannot send to this bank yet. Still required: ${due.join(", ")}`;
  }
  return "Stripe has not enabled transfers to this bank account yet";
}

async function ensureRecipientConnectAccount(stripe, db, profile, user, requestIp) {
  assertBankProfile(profile);
  const testMode = isStripeTestKey();
  let accountId = profile.stripeConnectedAccountId || null;

  if (!accountId) {
    const created = await stripe.accounts.create(
      buildConnectAccountParams(profile, user, { requestIp, testMode }),
      { idempotencyKey: `commission-recipient-${profile.userId}` },
    );
    accountId = created.id;
    const externalId = created.external_accounts?.data?.[0]?.id || null;
    await db.userBankingProfile.update({
      where: { id: profile.id },
      data: {
        stripeConnectedAccountId: accountId,
        ...(externalId ? { stripeExternalAccountId: externalId } : {}),
      },
    });
    profile.stripeConnectedAccountId = accountId;
    if (externalId) profile.stripeExternalAccountId = externalId;
  }

  if (!profile.stripeExternalAccountId) {
    const existing = await stripe.accounts.listExternalAccounts(accountId, {
      object: "bank_account",
      limit: 1,
    });
    const external = existing?.data?.[0] || await stripe.accounts.createExternalAccount(accountId, {
      external_account: bankAccountParams(profile),
    });
    await db.userBankingProfile.update({
      where: { id: profile.id },
      data: { stripeExternalAccountId: external.id },
    });
    profile.stripeExternalAccountId = external.id;
  }

  let account = await stripe.accounts.retrieve(accountId);
  if (testMode && account.capabilities?.transfers !== "active") {
    const testIdentity = {
      id_number: "000000000",
      ssn_last_4: "0000",
      dob: { day: 1, month: 1, year: 1901 },
      address: {
        line1: "address_full_match",
        city: "South San Francisco",
        state: "CA",
        postal_code: "94080",
        country: "US",
      },
    };
    const update = profile.accountType === "BUSINESS"
      ? { company: { tax_id: "000000000", address: testIdentity.address } }
      : { individual: testIdentity };
    account = await stripe.accounts.update(accountId, update);
  }

  if (account.capabilities?.transfers !== "active") {
    throw payoutError(capabilityError(account));
  }

  return accountId;
}

async function dispatchAch(stripe, { payout, connectedAccountId }) {
  const transferRequest = buildTransferParams(payout, connectedAccountId);
  const transfer = await stripe.transfers.create(
    transferRequest.params,
    transferRequest.options,
  );
  const payoutRequest = buildBankPayoutParams(payout);
  const bankPayout = await stripe.payouts.create(payoutRequest.params, {
    ...payoutRequest.options,
    stripeAccount: connectedAccountId,
  });
  return { transfer, bankPayout };
}

async function loadCommissionForPayout(db, dealCommissionId, brokerOrgId) {
  return db.dealCommission.findFirst({
    where: { id: dealCommissionId, brokerOrgId, status: "CALCULATED" },
    include: {
      payouts: {
        where: { status: { in: ["COMPLETED", "PROCESSING"] } },
        select: { id: true, amount: true, status: true, stripePayoutId: true },
      },
      recipientUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          bankingProfile: true,
        },
      },
    },
  });
}

async function reserveAchPayout(db, {
  dealCommissionId,
  brokerOrgId,
  paidByUserId,
  amount,
  notes,
}) {
  if (!UUID_RE.test(dealCommissionId)) {
    throw payoutError("Commission record not found");
  }

  return db.$transaction(async (tx) => {
    await tx.$queryRawUnsafe(
      `SELECT id FROM deal_commissions WHERE id = $1::uuid FOR UPDATE`,
      dealCommissionId,
    );

    const commission = await loadCommissionForPayout(tx, dealCommissionId, brokerOrgId);
    if (!commission) throw payoutError("Commission record not found");
    if (!ACH_RECIPIENT_ROLES.has(commission.recipientRole)) {
      throw payoutError(
        "Broker retained commission stays with the company. Bank payout is for loan officers and co-brokers",
      );
    }
    assertBankProfile(commission.recipientUser?.bankingProfile);

    const inFlight = (commission.payouts || []).find((row) => row.status === "PROCESSING");
    if (inFlight) return { commission, payout: inFlight, resumed: true };

    const commissionAmount = decimalToNumber(commission.commissionAmount) || 0;
    const reserved = sumPayoutAmounts(commission.payouts, isReservedPayout);
    if (reserved >= commissionAmount && commissionAmount > 0) {
      throw payoutError("Commission is already fully paid");
    }

    const payoutAmount = roundMoney(
      amount != null ? Number(amount) : commissionAmount - reserved,
    );
    if (payoutAmount <= 0) throw payoutError("Payout amount must be greater than zero");
    if (roundMoney(reserved + payoutAmount) > commissionAmount) {
      throw payoutError("Payout amount exceeds remaining commission balance");
    }

    const latestInvoice = await tx.commissionInvoice.findFirst({
      where: { dealCommissionId, status: { not: "VOID" } },
      orderBy: { generatedAt: "desc" },
      select: { id: true },
    });

    const payout = await tx.commissionPayout.create({
      data: {
        id: randomUUID(),
        dealCommissionId,
        commissionInvoiceId: latestInvoice?.id || null,
        brokerOrgId,
        loanApplicationId: commission.loanApplicationId,
        amount: payoutAmount,
        paymentMethod: "ACH",
        notes: notes ? String(notes).slice(0, 500) : null,
        status: "PROCESSING",
        paidByUserId,
      },
    });

    await logCommissionAuditEvent(tx, {
      brokerOrgId,
      loanApplicationId: commission.loanApplicationId,
      dealCommissionId,
      commissionInvoiceId: latestInvoice?.id || null,
      commissionPayoutId: payout.id,
      eventType: "PAYOUT_SUBMITTED",
      actorUserId: paidByUserId,
      metadata: {
        amount: payoutAmount,
        paymentMethod: "ACH",
        funding: "organization_bank_debit",
        accountLast4: maskAccountLast4(commission.recipientUser?.bankingProfile?.accountNumber),
      },
    });

    return { commission, payout, resumed: false };
  });
}

async function markAchFailed(db, payout, { reason, reversalId = null }) {
  await db.commissionPayout.update({
    where: { id: payout.id },
    data: {
      status: "FAILED",
      failureReason: reason || "Bank payout failed",
      ...(reversalId ? { stripeReversalId: reversalId } : {}),
    },
  });
  await logCommissionAuditEvent(db, {
    brokerOrgId: payout.brokerOrgId,
    loanApplicationId: payout.loanApplicationId,
    dealCommissionId: payout.dealCommissionId,
    commissionInvoiceId: payout.commissionInvoiceId,
    commissionPayoutId: payout.id,
    eventType: "PAYOUT_FAILED",
    actorType: "SYSTEM",
    metadata: { reason: reason || "Bank payout failed" },
  });
}

async function loadPayoutNotifyContext(db, payout) {
  const commission = await db.dealCommission.findUnique({
    where: { id: payout.dealCommissionId },
    include: {
      recipientUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          bankingProfile: { select: { accountNumber: true } },
        },
      },
      loanApplication: { select: { applicationNumber: true } },
      brokerOrg: { select: { id: true, name: true, email: true } },
    },
  });
  const orgBanking = await db.organizationBankingProfile.findUnique({
    where: { organizationId: payout.brokerOrgId },
    select: { accountNumber: true },
  });
  return { commission, orgBanking };
}

async function notifyPayoutSubmitted(db, payout) {
  const { commission, orgBanking } = await loadPayoutNotifyContext(db, payout);
  if (!commission) return;
  await sendCommissionPayoutSubmittedEmail({
    prisma: db,
    recipientUser: commission.recipientUser,
    organizationName: commission.brokerOrg?.name,
    applicationNumber: commission.loanApplication?.applicationNumber,
    amount: decimalToNumber(payout.amount),
    bankLast4: maskAccountLast4(commission.recipientUser?.bankingProfile?.accountNumber),
    fundingBankLast4: maskAccountLast4(orgBanking?.accountNumber),
  });
}

async function notifyPayoutSettled(db, payout) {
  const { commission } = await loadPayoutNotifyContext(db, payout);
  if (!commission) return;
  await sendCommissionPayoutSettledEmail({
    prisma: db,
    recipientUser: commission.recipientUser,
    organizationName: commission.brokerOrg?.name,
    applicationNumber: commission.loanApplication?.applicationNumber,
    amount: decimalToNumber(payout.amount),
    paymentReference: payout.paymentReference || payout.stripePayoutId,
  });
}

async function notifyPayoutFailed(db, payout, reason) {
  const { commission } = await loadPayoutNotifyContext(db, payout);
  if (!commission) return;
  await sendCommissionPayoutFailedEmail({
    prisma: db,
    recipientUser: commission.recipientUser,
    brokerAdminEmail: commission.brokerOrg?.email || null,
    organizationName: commission.brokerOrg?.name,
    applicationNumber: commission.loanApplication?.applicationNumber,
    amount: decimalToNumber(payout.amount),
    reason,
  });
}

async function dispatchRecipientBankPayout(stripeClient, db, {
  payout,
  commission,
  requestIp = null,
}) {
  const profile = commission.recipientUser?.bankingProfile;
  const secrets = [profile?.accountNumber, profile?.abaRoutingNumber];
  let transfer = null;

  try {
    const connectedAccountId = await ensureRecipientConnectAccount(
      stripeClient,
      db,
      profile,
      commission.recipientUser,
      requestIp,
    );
    const sent = await dispatchAch(stripeClient, { payout, connectedAccountId });
    transfer = sent.transfer;
    const bankPayout = sent.bankPayout;

    await db.commissionPayout.update({
      where: { id: payout.id },
      data: {
        stripeTransferId: transfer.id,
        stripePayoutId: bankPayout.id,
        paymentReference: bankPayout.id,
      },
    });
    return { transfer, bankPayout };
  } catch (error) {
    const reason = error?.code === "balance_insufficient"
      ? "Commission funding cleared but Stripe could not pay the recipient bank yet. Retry shortly"
      : redactFinancialText(error.message, secrets);

    const retryable = error?.type === "StripeConnectionError"
      || error?.type === "StripeAPIError"
      || error?.type === "StripeRateLimitError";

    if (retryable) {
      if (transfer?.id) {
        await db.commissionPayout.update({
          where: { id: payout.id },
          data: { stripeTransferId: transfer.id },
        });
      }
      throw payoutError(
        "Stripe did not confirm the recipient bank payout. Retry in a moment. It will not be sent twice",
      );
    }

    let reversalId = null;
    if (transfer?.id) {
      try {
        const reversal = await stripeClient.transfers.createReversal(
          transfer.id,
          { metadata: { commissionPayoutId: payout.id } },
          { idempotencyKey: `commission-ach-reversal-${payout.id}` },
        );
        reversalId = reversal.id;
      } catch (reversalError) {
        await markAchFailed(db, payout, {
          reason: `${reason}. Transfer reversal failed: ${redactFinancialText(reversalError.message, secrets)}`,
        });
        await notifyPayoutFailed(db, payout, reason);
        throw payoutError(reason || "Bank payout failed");
      }
    }

    await markAchFailed(db, payout, { reason, reversalId });
    await notifyPayoutFailed(db, payout, reason);
    throw payoutError(reason || "Bank payout failed");
  }
}

async function submitCommissionAchPayout(db, {
  dealCommissionId,
  brokerOrgId,
  paidByUserId,
  amount = null,
  notes = null,
  requestIp = null,
  stripe = null,
}) {
  if (!isCommissionAchEnabled()) {
    throw payoutError(
      "Automatic bank transfers are turned off. Set STRIPE_COMMISSION_PAYOUTS_ENABLED=true after Stripe Connect + ACH debit are enabled",
      503,
    );
  }

  const stripeClient = stripe || getStripeClient();
  let reserved;
  try {
    reserved = await reserveAchPayout(db, {
      dealCommissionId,
      brokerOrgId,
      paidByUserId,
      amount,
      notes,
    });
  } catch (error) {
    if (error?.code === "P2002") {
      throw payoutError("A bank payout is already in progress for this commission");
    }
    throw error;
  }

  let payout = await db.commissionPayout.findUnique({ where: { id: reserved.payout.id } });
  if (!payout) throw payoutError("Commission payout could not be reserved");
  if (payout.stripePayoutId) {
    throw payoutError("A bank payout is already in progress for this commission");
  }

  const commission = reserved.commission;

  // Resume after funding already cleared (webhook or retry).
  if (payout.stripePaymentIntentId && !payout.stripePayoutId) {
    const existingIntent = await stripeClient.paymentIntents.retrieve(payout.stripePaymentIntentId);
    if (existingIntent.status === "succeeded") {
      await dispatchRecipientBankPayout(stripeClient, db, {
        payout,
        commission,
        requestIp,
      });
    } else if (
      existingIntent.status === "processing"
      || existingIntent.status === "requires_action"
      || existingIntent.status === "requires_confirmation"
    ) {
      // Still waiting on ACH debit clearance.
    } else {
      const reason = redactFinancialText(
        existingIntent.last_payment_error?.message || `ACH debit status: ${existingIntent.status}`,
      );
      await markAchFailed(db, payout, { reason });
      await notifyPayoutFailed(db, payout, reason);
      throw payoutError(reason || "Firm bank ACH debit failed");
    }
  } else {
    try {
      const { paymentIntent } = await createOrgAchDebit(stripeClient, db, {
        organizationId: brokerOrgId,
        payout,
        requestIp,
      });

      payout = await db.commissionPayout.findUnique({ where: { id: payout.id } });

      if (paymentIntent.status === "succeeded") {
        await dispatchRecipientBankPayout(stripeClient, db, {
          payout,
          commission,
          requestIp,
        });
      } else if (
        paymentIntent.status !== "processing"
        && paymentIntent.status !== "requires_action"
        && paymentIntent.status !== "requires_confirmation"
      ) {
        const reason = redactFinancialText(
          paymentIntent.last_payment_error?.message || `ACH debit status: ${paymentIntent.status}`,
        );
        await markAchFailed(db, payout, { reason });
        await notifyPayoutFailed(db, payout, reason);
        throw payoutError(reason || "Firm bank ACH debit failed");
      }
    } catch (error) {
      if (error.statusCode) throw error;
      const reason = redactFinancialText(error.message, [
        commission.recipientUser?.bankingProfile?.accountNumber,
        commission.recipientUser?.bankingProfile?.abaRoutingNumber,
      ]);
      if (!payout.stripePayoutId) {
        await markAchFailed(db, payout, { reason });
        await notifyPayoutFailed(db, payout, reason);
      }
      throw payoutError(reason || "Bank transfer failed");
    }
  }

  try {
    await notifyPayoutSubmitted(db, payout);
  } catch (_) {
    // Email failures must not block the money movement.
  }

  const row = await db.dealCommission.findUnique({
    where: { id: dealCommissionId },
    include: commissionInclude,
  });

  const saved = await db.commissionPayout.findUnique({ where: { id: payout.id } });
  return {
    payout: saved,
    commission: formatCommissionRecord(row),
  };
}

async function applyFundingPaymentIntentWebhook(db, event, stripe = null) {
  const type = event?.type || "";
  const object = event?.data?.object || {};
  const metadataId = object.metadata?.commissionPayoutId || null;
  const paymentIntentId = object.id || null;

  if (!metadataId && !paymentIntentId) {
    return { action: "commission_ach_funding_ignored", type };
  }

  const payout = await db.commissionPayout.findFirst({
    where: metadataId
      ? { id: metadataId }
      : { stripePaymentIntentId: paymentIntentId },
  });

  if (!payout) {
    return { action: "commission_ach_funding_unmatched", type, paymentIntentId };
  }
  if (payout.status === "COMPLETED" || payout.status === "FAILED" || payout.status === "REVERSED") {
    return {
      action: "commission_ach_already_final",
      status: payout.status,
      payoutId: payout.id,
    };
  }
  if (payout.stripePayoutId) {
    return { action: "commission_ach_recipient_already_dispatched", payoutId: payout.id };
  }

  if (
    type === "payment_intent.payment_failed"
    || object.status === "canceled"
    || object.status === "requires_payment_method"
  ) {
    const reason = redactFinancialText(
      object.last_payment_error?.message
        || object.last_payment_error?.code
        || "Firm bank ACH debit failed",
    );
    await markAchFailed(db, payout, { reason });
    try {
      await notifyPayoutFailed(db, payout, reason);
    } catch (_) {
      // Non-blocking.
    }
    return { action: "commission_ach_funding_failed", payoutId: payout.id };
  }

  if (type !== "payment_intent.succeeded" && object.status !== "succeeded") {
    return {
      action: "commission_ach_funding_pending",
      payoutId: payout.id,
      status: object.status,
    };
  }

  const commission = await loadCommissionForPayout(
    db,
    payout.dealCommissionId,
    payout.brokerOrgId,
  );
  if (!commission) {
    await markAchFailed(db, payout, { reason: "Commission record missing after ACH debit" });
    return { action: "commission_ach_funding_missing_commission", payoutId: payout.id };
  }

  const stripeClient = stripe || getStripeClient();
  try {
    await dispatchRecipientBankPayout(stripeClient, db, {
      payout,
      commission,
    });
  } catch (error) {
    return {
      action: "commission_ach_recipient_dispatch_failed",
      payoutId: payout.id,
      message: error.message,
    };
  }

  return { action: "commission_ach_recipient_dispatched", payoutId: payout.id };
}

async function applyCommissionAchWebhook(db, event, stripe = null) {
  const type = event?.type || "";

  if (
    type === "payment_intent.succeeded"
    || type === "payment_intent.payment_failed"
    || type === "payment_intent.canceled"
  ) {
    const object = event?.data?.object || {};
    if (object.metadata?.purpose !== "commission_ach_funding") {
      return null;
    }
    return applyFundingPaymentIntentWebhook(db, event, stripe);
  }

  if (type !== "payout.paid" && type !== "payout.failed" && type !== "payout.canceled") {
    return null;
  }

  const object = event?.data?.object || {};
  const metadataId = object.metadata?.commissionPayoutId || null;
  const stripePayoutId = object.id || null;
  if (!metadataId && !stripePayoutId) {
    return { action: "commission_ach_ignored", type };
  }

  const payout = await db.commissionPayout.findFirst({
    where: metadataId
      ? { id: metadataId }
      : { stripePayoutId },
  });

  if (!payout) return { action: "commission_ach_unmatched", type, stripePayoutId };
  if (payout.status === "COMPLETED" || payout.status === "FAILED" || payout.status === "REVERSED") {
    return { action: "commission_ach_already_final", status: payout.status, payoutId: payout.id };
  }

  if (type === "payout.paid") {
    const updated = await db.commissionPayout.update({
      where: { id: payout.id },
      data: {
        status: "COMPLETED",
        paidAt: new Date(),
        paymentReference: stripePayoutId || payout.paymentReference,
        failureReason: null,
      },
    });
    await logCommissionAuditEvent(db, {
      brokerOrgId: payout.brokerOrgId,
      loanApplicationId: payout.loanApplicationId,
      dealCommissionId: payout.dealCommissionId,
      commissionInvoiceId: payout.commissionInvoiceId,
      commissionPayoutId: payout.id,
      eventType: "PAYOUT_SETTLED",
      actorType: "SYSTEM",
      metadata: { stripePayoutId },
    });
    try {
      await notifyPayoutSettled(db, updated);
    } catch (_) {
      // Non-blocking notification.
    }
    return { action: "commission_ach_settled", payoutId: payout.id };
  }

  const reason = redactFinancialText(
    object.failure_message || object.failure_code || "Bank payout failed",
  );
  let reversalId = payout.stripeReversalId || null;
  if (payout.stripeTransferId && !reversalId) {
    try {
      const stripeClient = stripe || getStripeClient();
      const reversal = await stripeClient.transfers.createReversal(
        payout.stripeTransferId,
        { metadata: { commissionPayoutId: payout.id } },
        { idempotencyKey: `commission-ach-reversal-${payout.id}` },
      );
      reversalId = reversal.id;
    } catch (reversalError) {
      await markAchFailed(db, payout, {
        reason: `${reason}. Transfer reversal failed: ${redactFinancialText(reversalError.message)}`,
      });
      try {
        await notifyPayoutFailed(db, payout, reason);
      } catch (_) {
        // Non-blocking.
      }
      return { action: "commission_ach_failed", payoutId: payout.id, reversed: false };
    }
  }

  await markAchFailed(db, payout, { reason, reversalId });
  try {
    await notifyPayoutFailed(db, payout, reason);
  } catch (_) {
    // Non-blocking.
  }
  return { action: "commission_ach_failed", payoutId: payout.id, reversed: Boolean(reversalId) };
}

module.exports = {
  isCommissionAchEnabled,
  toCents,
  redactFinancialText,
  buildConnectAccountParams,
  buildTransferParams,
  buildBankPayoutParams,
  submitCommissionAchPayout,
  applyCommissionAchWebhook,
  applyFundingPaymentIntentWebhook,
  dispatchRecipientBankPayout,
};
