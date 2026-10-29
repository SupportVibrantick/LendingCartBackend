/**
 * ACH debit from the principal broker / firm bank account to fund
 * a commission payout before the recipient Connect transfer.
 */

const {
  getOrganizationBanking,
} = require("../broker/organizationBanking.service");

function fundingError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function assertOrgBankProfile(profile) {
  if (!profile) {
    throw fundingError(
      "Add your firm bank account under Payments → Banking before sending ACH commissions",
    );
  }
  if (!profile.achDebitAuthorizedAt) {
    throw fundingError(
      "Authorize ACH debit on your firm bank account under Payments → Banking",
    );
  }
  const routing = String(profile.abaRoutingNumber || "").replace(/\D/g, "");
  const accountNumber = String(profile.accountNumber || "").replace(/\D/g, "");
  if (!/^\d{9}$/.test(routing)) {
    throw fundingError("Firm ABA routing number must be a 9-digit US routing number");
  }
  if (!/^\d{4,17}$/.test(accountNumber)) {
    throw fundingError("Firm account number is not valid for ACH debit");
  }
}

function orgBankPaymentMethodParams(profile) {
  return {
    type: "us_bank_account",
    us_bank_account: {
      account_holder_type: profile.accountType === "BUSINESS" ? "company" : "individual",
      routing_number: String(profile.abaRoutingNumber || "").replace(/\D/g, ""),
      account_number: String(profile.accountNumber || "").replace(/\D/g, ""),
      account_type: "checking",
    },
    billing_details: {
      name: profile.accountName || profile.partyName,
      email: profile.partyEmail || undefined,
      phone: profile.partyTel || undefined,
      address: profile.partyAddress
        ? { line1: profile.partyAddress, country: "US" }
        : undefined,
    },
    metadata: {
      organizationId: profile.organizationId,
      purpose: "commission_ach_funding",
    },
  };
}

async function ensureOrgFundingPaymentMethod(stripe, db, organizationId) {
  const profile = await getOrganizationBanking(db, organizationId);
  assertOrgBankProfile(profile);

  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, email: true },
  });

  let customerId = profile.stripeCustomerId || null;
  if (!customerId) {
    const customer = await stripe.customers.create(
      {
        name: profile.partyName || org?.name || "Broker organization",
        email: profile.partyEmail || org?.email || undefined,
        phone: profile.partyTel || undefined,
        metadata: {
          organizationId,
          purpose: "commission_ach_funding",
        },
      },
      { idempotencyKey: `commission-org-customer-${organizationId}` },
    );
    customerId = customer.id;
    await db.organizationBankingProfile.update({
      where: { id: profile.id },
      data: { stripeCustomerId: customerId },
    });
    profile.stripeCustomerId = customerId;
  }

  let paymentMethodId = profile.stripePaymentMethodId || null;
  if (!paymentMethodId) {
    const paymentMethod = await stripe.paymentMethods.create(
      orgBankPaymentMethodParams(profile),
      { idempotencyKey: `commission-org-pm-${organizationId}-${profile.updatedAt?.getTime?.() || "v1"}` },
    );
    await stripe.paymentMethods.attach(paymentMethod.id, { customer: customerId });
    paymentMethodId = paymentMethod.id;
    await db.organizationBankingProfile.update({
      where: { id: profile.id },
      data: { stripePaymentMethodId: paymentMethodId },
    });
    profile.stripePaymentMethodId = paymentMethodId;
  }

  return { profile, customerId, paymentMethodId };
}

function buildFundingPaymentIntentParams({
  payout,
  customerId,
  paymentMethodId,
  requestIp,
}) {
  const acceptanceIp = String(requestIp || "").trim() || "127.0.0.1";
  return {
    params: {
      amount: Math.round(Number(payout.amount) * 100),
      currency: "usd",
      customer: customerId,
      payment_method: paymentMethodId,
      payment_method_types: ["us_bank_account"],
      confirm: true,
      description: "Commission bank transfer funding",
      statement_descriptor: "COMMISSION",
      mandate_data: {
        customer_acceptance: {
          type: "online",
          online: {
            ip_address: acceptanceIp,
            user_agent: "LendingCart-Commission-ACH/1.0",
          },
        },
      },
      metadata: {
        commissionPayoutId: payout.id,
        purpose: "commission_ach_funding",
      },
    },
    options: {
      idempotencyKey: `commission-ach-funding-${payout.id}`,
    },
  };
}

async function createOrgAchDebit(stripe, db, {
  organizationId,
  payout,
  requestIp = null,
}) {
  const { profile, customerId, paymentMethodId } = await ensureOrgFundingPaymentMethod(
    stripe,
    db,
    organizationId,
  );

  const built = buildFundingPaymentIntentParams({
    payout,
    customerId,
    paymentMethodId,
    requestIp,
  });

  const paymentIntent = await stripe.paymentIntents.create(built.params, built.options);

  await db.commissionPayout.update({
    where: { id: payout.id },
    data: {
      stripePaymentIntentId: paymentIntent.id,
      paymentReference: paymentIntent.id,
    },
  });

  return { paymentIntent, fundingProfile: profile };
}

module.exports = {
  assertOrgBankProfile,
  ensureOrgFundingPaymentMethod,
  buildFundingPaymentIntentParams,
  createOrgAchDebit,
  getOrganizationBanking,
};
