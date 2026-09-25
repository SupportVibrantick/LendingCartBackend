/**
 * Fulfill CLM GHL order-form purchases:
 * - Client pays CLM (~$9997) on GHL (card saved) + $0 software with 90-day trial → $699/mo
 * - LendingCart provisions broker + 90-day FULL ACCESS soft trial
 * - After trialEndsAt → ACTIVE (no lock); GHL auto-bills the card
 * - Broker may Discontinue → CANCELLED on LC + GHL billing stop request
 */

const bcrypt = require("bcrypt");
const { generateTempPassword } = require("../../utils/auth/generateTempPassword");
const { provisionBrokerFromLoanAi } = require("../broker/provisionBrokerFromLoanAi");
const {
  CLM_GHL_SOFT_TRIAL_NOTE,
  getClmSoftTrialDays,
  getClmSoftTrialPackageCode,
  isClmGhlSoftTrial,
} = require("../subscription/freeTrial");
const {
  defaultFeaturesForPackage,
} = require("../subscription/brokerOrgFeatures");
const {
  buildEnabledFeaturesPayload,
} = require("../subscription/subscriptionBilling");
const { commonLogs } = require("../logger/contextLogger");

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function pickFirst(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const str = String(value).trim();
    if (str) return str;
  }
  return null;
}

function firstLineItem(...candidates) {
  for (const value of candidates) {
    if (Array.isArray(value) && value.length > 0) {
      return asObject(value[0]);
    }
  }
  return {};
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function splitName(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return { firstName: "Broker", lastName: "Admin" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "Admin" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function isClmSoftTrialEnabled() {
  const raw = String(process.env.CLM_GHL_SOFT_TRIAL_ENABLED || "true")
    .trim()
    .toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off" && raw !== "no";
}

function mergeCustomData(body = {}) {
  // GHL workflow "Custom Data" may arrive nested OR as top-level keys.
  // Do NOT spread body.data wholesale — that can be an invoice/event blob.
  return {
    ...asObject(body.data?.customData),
    ...asObject(body.customData),
  };
}

function collectLineItems(...candidates) {
  const items = [];
  for (const value of candidates) {
    if (!Array.isArray(value)) continue;
    for (const entry of value) {
      if (entry && typeof entry === "object") items.push(entry);
    }
  }
  return items;
}

function normalizeMoneyAmount(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    if (!cleaned) return null;
    value = cleaned;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  // GHL sometimes sends cents (999700) for $9997.00
  if (Math.abs(n) >= 100000) return n / 100;
  return n;
}

function asOrderObject(value) {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return asObject(parsed);
    } catch {
      return {};
    }
  }
  return asObject(value);
}

function extractProductHints(body = {}) {
  const customData = mergeCustomData(body);
  const invoice = asObject(body.invoice || body.data?.invoice);
  const order = asOrderObject(body.order || body.data?.order || body.triggerData?.order);
  const lineItems = collectLineItems(
    body.items,
    body.invoiceItems,
    body.data?.items,
    body.data?.invoiceItems,
    invoice.items,
    invoice.invoiceItems,
    order.items,
    order.products,
    order.line_items,
    order.lineItems,
    body.products,
  );
  const lineItem = lineItems[0] ? asObject(lineItems[0]) : firstLineItem(lineItems);

  const productId = pickFirst(
    customData.productId,
    customData.product_id,
    body.productId,
    body.product_id,
    body.data?.productId,
    invoice.productId,
    order.productId,
    lineItem.productId,
    lineItem.product_id,
    lineItem.product,
    lineItem._id,
    lineItem.id,
  );

  const productNames = [
    customData.productName,
    customData.product_name,
    customData.product,
    body.productName,
    body.product_name,
    lineItem.name,
    lineItem.productName,
    lineItem.product_name,
    lineItem.title,
    invoice.name,
    order.name,
    order.productName,
    body.name,
    ...lineItems.map((item) => item?.name || item?.productName || item?.title),
  ]
    .map((v) => (v == null ? "" : String(v).trim()))
    .filter(Boolean);

  const productName = productNames[0] || null;
  const productNameBlob = productNames.join(" | ").toLowerCase();

  const orderAmount = normalizeMoneyAmount(
    pickFirst(
      order.amount,
      order.total,
      order.totalAmount,
      order.amountPaid,
      order.price,
      invoice.amount,
      invoice.total,
      invoice.amountPaid,
      customData.amount,
      body.amount,
      lineItem.price,
      lineItem.amount,
    ),
  );

  return {
    productId,
    productName,
    productNameBlob,
    orderAmount,
    order,
    customData,
    hasOrder: Object.keys(order).length > 0,
  };
}

/**
 * Whether this GHL webhook should provision a CLM soft trial.
 * Works for official payment events AND workflow custom webhooks / order forms.
 */
function isClmSoftTrialOrder(body = {}, ids = {}) {
  if (!isClmSoftTrialEnabled()) return false;

  const {
    productId,
    productName,
    productNameBlob,
    orderAmount,
    customData,
    hasOrder,
  } = extractProductHints(body);

  const action = String(
    pickFirst(
      customData.lendingCartAction,
      customData.action,
      body.lendingCartAction,
      body.action,
      body.data?.lendingCartAction,
    ) || "",
  )
    .trim()
    .toUpperCase();
  if (
    action === "CLM_SOFT_TRIAL" ||
    customData.clmSoftTrial === true ||
    body.clmSoftTrial === true ||
    String(customData.clmSoftTrial || body.clmSoftTrial || "").toLowerCase() ===
      "true"
  ) {
    return true;
  }

  const configuredProductId = String(process.env.CLM_GHL_PRODUCT_ID || "")
    .trim()
    .toLowerCase();
  if (
    configuredProductId &&
    productId &&
    configuredProductId === String(productId).trim().toLowerCase()
  ) {
    return true;
  }

  const nameMatch = String(
    process.env.CLM_GHL_PRODUCT_NAME_MATCH || "Commercial Lending Mastery",
  )
    .trim()
    .toLowerCase();
  if (
    nameMatch &&
    ((productName && productName.toLowerCase().includes(nameMatch)) ||
      (productNameBlob && productNameBlob.includes(nameMatch)))
  ) {
    return true;
  }

  // GHL order-form workflow: amount ~ $9997 even when product id/name fields are odd.
  const expectedAmount = Number(process.env.CLM_GHL_ORDER_AMOUNT || 9997);
  if (
    Number.isFinite(expectedAmount) &&
    expectedAmount > 0 &&
    orderAmount != null &&
    Math.abs(orderAmount - expectedAmount) < 0.5
  ) {
    return true;
  }

  // Workflow webhooks may only send contact + a tag/source flag.
  const source = String(
    pickFirst(
      customData.source,
      customData.offer,
      body.source,
      body.offer,
      body.contact_source,
    ) || "",
  )
    .trim()
    .toLowerCase();
  if (source.includes("clm") && source.includes("soft")) return true;

  const tags = Array.isArray(body.tags)
    ? body.tags.map((t) => String(t).toLowerCase())
    : [];
  if (tags.some((t) => t.includes("clm") && (t.includes("soft") || t.includes("trial")))) {
    return true;
  }

  // GHL "Send Webhook" after Order Form: payload has contact_* + order + workflow,
  // often without product id / lendingCartAction. This endpoint's CLM funnel workflow
  // uses that shape — treat it as soft-trial when enabled.
  if (
    hasOrder &&
    (body.workflow || body.workflow_id || body.workflowId) &&
    (ids.email || body.email || body.contact_id)
  ) {
    return true;
  }

  return false;
}

function extractContactProfile(body = {}, ids = {}) {
  const customData = mergeCustomData(body);
  const contact = asObject(
    body.contact ||
      body.contactDetails ||
      body.data?.contact ||
      body.data?.contactDetails,
  );

  const email = String(
    pickFirst(
      ids.email,
      contact.email,
      customData.email,
      customData.Email,
      body.email,
      body.Email,
      body.contact_email,
      body["Contact Email"],
    ) || "",
  )
    .trim()
    .toLowerCase();

  const phone = pickFirst(
    ids.phone,
    contact.phone,
    contact.phoneNo,
    customData.phone,
    customData.Phone,
    customData.organizationPhone,
    body.phone,
    body.Phone,
    body.phone_number,
  );

  const companyName = pickFirst(
    customData.organizationName,
    customData.companyName,
    customData.company,
    customData.Company,
    contact.companyName,
    contact.company,
    body.company_name,
    body.companyName,
    body.company_name,
    body.company,
    body.Company,
  );

  let firstName = pickFirst(
    customData.firstName,
    customData.first_name,
    contact.firstName,
    contact.first_name,
    body.firstName,
    body.first_name,
  );
  let lastName = pickFirst(
    customData.lastName,
    customData.last_name,
    contact.lastName,
    contact.last_name,
    body.lastName,
    body.last_name,
  );

  if (!firstName || !lastName) {
    const fromFull = splitName(
      pickFirst(
        customData.fullName,
        customData.full_name,
        contact.name,
        contact.fullName,
        body.fullName,
        body.full_name,
        body.full_name,
        body.name,
        body.Name,
      ),
    );
    firstName = firstName || fromFull.firstName;
    lastName = lastName || fromFull.lastName;
  }

  const organizationName =
    companyName || `${firstName} ${lastName}`.trim() || "CLM Brokerage";
  const organizationEmail = email;
  const phoneDigits = digitsOnly(phone);
  const organizationPhone =
    phoneDigits.length >= 10
      ? phoneDigits.slice(0, 15)
      : `1555${String(Date.now()).slice(-7)}`;

  return {
    email,
    firstName: firstName || "Broker",
    lastName: lastName || "Admin",
    organizationName,
    organizationEmail,
    organizationPhone,
  };
}

async function ensureLoanAiUserForClm(prisma, profile) {
  const email = profile.email;
  let user = await prisma.loanAiUser.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });

  if (user) {
    if (
      (!user.firstName && profile.firstName) ||
      (!user.lastName && profile.lastName)
    ) {
      user = await prisma.loanAiUser.update({
        where: { id: user.id },
        data: {
          firstName: user.firstName || profile.firstName,
          lastName: user.lastName || profile.lastName,
        },
      });
    }
    return user;
  }

  const temporaryPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);

  return prisma.loanAiUser.create({
    data: {
      email,
      passwordHash,
      firstName: profile.firstName,
      lastName: profile.lastName,
    },
  });
}

async function applyFullAccessFeatures(prisma, subscriptionId, packageCode) {
  const keys = defaultFeaturesForPackage(packageCode, []);
  await prisma.organizationSubscription.update({
    where: { id: subscriptionId },
    data: {
      enabledFeatures: buildEnabledFeaturesPayload(keys, null),
    },
  });
}

/**
 * @returns {Promise<null | object>} null if not a CLM order / cannot fulfill
 */
async function tryFulfillClmGhlOrder(prisma, io, body = {}, ids = {}) {
  if (!isClmSoftTrialOrder(body, ids)) {
    return null;
  }

  const profile = extractContactProfile(body, ids);
  if (!profile.email || !profile.email.includes("@")) {
    commonLogs.warn("CLM soft trial skipped — missing contact email", {
      event: "ghl.clm_soft_trial.skipped",
      reason: "missing_email",
      ghlContactId: ids.ghlContactId || null,
    });
    return {
      action: "clm_soft_trial_skipped",
      reason: "missing_email",
    };
  }

  const trialDays = getClmSoftTrialDays();
  const packageCode = getClmSoftTrialPackageCode();

  const pkg = await prisma.subscriptionPackage.findFirst({
    where: { code: packageCode, isActive: true },
  });
  if (!pkg) {
    throw Object.assign(
      new Error(
        `CLM soft trial package "${packageCode}" not found or inactive`,
      ),
      { statusCode: 500, code: "CLM_PACKAGE_MISSING" },
    );
  }

  const loanAiUser = await ensureLoanAiUserForClm(prisma, profile);

  // Idempotent: already on an active CLM soft trial / any active sub for this org.
  if (loanAiUser.brokerOrganizationId) {
    const active = await prisma.organizationSubscription.findFirst({
      where: {
        organizationId: loanAiUser.brokerOrganizationId,
        status: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] },
      },
      select: { id: true, status: true, notes: true, trialEndsAt: true },
    });
    if (active) {
      // Keep GHL payment refs fresh (subscription.charged after trial, etc.).
      const ghlPatch = {
        ...(ids.ghlContactId ? { ghlContactId: ids.ghlContactId } : {}),
        ...(ids.ghlInvoiceId ? { ghlInvoiceId: ids.ghlInvoiceId } : {}),
        ...(ids.ghlProductId ? { ghlProductId: ids.ghlProductId } : {}),
        ...(ids.ghlPriceId ? { ghlPriceId: ids.ghlPriceId } : {}),
        ...(ids.ghlSubscriptionId
          ? { ghlSubscriptionId: ids.ghlSubscriptionId }
          : {}),
        ...(ids.stripeSubscriptionId
          ? { stripeSubscriptionId: ids.stripeSubscriptionId }
          : {}),
        ...(ids.stripeCustomerId
          ? { stripeCustomerId: ids.stripeCustomerId }
          : {}),
      };
      if (Object.keys(ghlPatch).length) {
        await prisma.organizationSubscription.update({
          where: { id: active.id },
          data: ghlPatch,
        });
      }

      commonLogs.info("CLM soft trial already active — skipping provision", {
        event: "ghl.clm_soft_trial.already_active",
        organizationId: loanAiUser.brokerOrganizationId,
        subscriptionId: active.id,
        isClm: isClmGhlSoftTrial(active),
      });
      return {
        action: "clm_soft_trial_already_active",
        organizationId: loanAiUser.brokerOrganizationId,
        organizationSubscriptionId: active.id,
        loanAiUserId: loanAiUser.id,
        trialEndsAt: active.trialEndsAt,
      };
    }
  }

  // One soft trial per email (same as Loan AI free trial semantics).
  const priorClm = await prisma.organizationSubscription.findFirst({
    where: {
      OR: [
        { loanAiUserId: loanAiUser.id },
        loanAiUser.brokerOrganizationId
          ? { organizationId: loanAiUser.brokerOrganizationId }
          : undefined,
      ].filter(Boolean),
      notes: { contains: CLM_GHL_SOFT_TRIAL_NOTE },
    },
    select: { id: true, status: true },
  });
  if (priorClm) {
    commonLogs.info("CLM soft trial already used for this user", {
      event: "ghl.clm_soft_trial.already_used",
      subscriptionId: priorClm.id,
      status: priorClm.status,
      loanAiUserId: loanAiUser.id,
    });
    return {
      action: "clm_soft_trial_already_used",
      organizationSubscriptionId: priorClm.id,
      loanAiUserId: loanAiUser.id,
    };
  }

  const result = await provisionBrokerFromLoanAi(prisma, io, loanAiUser, {
    packageId: pkg.id,
    billingCycle: "MONTHLY",
    organizationName: profile.organizationName,
    organizationEmail: profile.organizationEmail,
    organizationPhone: profile.organizationPhone,
    firstName: profile.firstName,
    lastName: profile.lastName,
    addOnCodes: [],
    trialDays,
    generateInvoice: false,
    notes: `${CLM_GHL_SOFT_TRIAL_NOTE}; ghlContactId=${ids.ghlContactId || ""}; ghlInvoiceId=${ids.ghlInvoiceId || ""}; ghlOrderTxn=${ids.ghlTransactionId || ""}`,
    notificationSource: "CLM_GHL_SOFT_TRIAL",
  });

  if (result?.subscriptionId) {
    await applyFullAccessFeatures(prisma, result.subscriptionId, packageCode);

    // Persist GHL + Stripe payment refs when present (GHL bills via Stripe after trial).
    await prisma.organizationSubscription.update({
      where: { id: result.subscriptionId },
      data: {
        ...(ids.ghlContactId ? { ghlContactId: ids.ghlContactId } : {}),
        ...(ids.ghlInvoiceId ? { ghlInvoiceId: ids.ghlInvoiceId } : {}),
        ...(ids.ghlProductId ? { ghlProductId: ids.ghlProductId } : {}),
        ...(ids.ghlPriceId ? { ghlPriceId: ids.ghlPriceId } : {}),
        ...(ids.ghlSubscriptionId
          ? { ghlSubscriptionId: ids.ghlSubscriptionId }
          : {}),
        ...(ids.stripeSubscriptionId
          ? { stripeSubscriptionId: ids.stripeSubscriptionId }
          : {}),
        ...(ids.stripeCustomerId
          ? { stripeCustomerId: ids.stripeCustomerId }
          : {}),
      },
    });

    // Best-effort: resolve Stripe sub by email when webhook did not include it.
    try {
      const {
        isStripeConfigured,
        resolveStripeSubscriptionForClm,
      } = require("../stripe/stripeBilling");
      if (isStripeConfigured() && profile.email && !ids.stripeSubscriptionId) {
        const resolved = await resolveStripeSubscriptionForClm(
          {
            stripeSubscriptionId: null,
            ghlSubscriptionId: ids.ghlSubscriptionId,
          },
          { email: profile.email },
        );
        if (resolved.stripeSubscriptionId) {
          await prisma.organizationSubscription.update({
            where: { id: result.subscriptionId },
            data: {
              stripeSubscriptionId: resolved.stripeSubscriptionId,
              ...(resolved.stripeCustomerId
                ? { stripeCustomerId: resolved.stripeCustomerId }
                : {}),
            },
          });
        }
      }
    } catch (stripeResolveErr) {
      commonLogs.warn("CLM provision — Stripe sub resolve skipped", {
        error: stripeResolveErr?.message,
        email: profile.email,
      });
    }
  }

  commonLogs.info("CLM soft trial provisioned from GHL order", {
    event: "ghl.clm_soft_trial.provisioned",
    organizationId: result.organizationId,
    organizationSubscriptionId: result.subscriptionId || null,
    loanAiUserId: loanAiUser.id,
    trialDays,
    packageCode,
    email: profile.email,
  });

  return {
    action: "clm_soft_trial_provisioned",
    organizationId: result.organizationId,
    organizationSubscriptionId: result.subscriptionId || null,
    loanAiUserId: loanAiUser.id,
    trialDays,
    packageCode,
    trialEndsAt: result.trialEndsAt || null,
    credentialsSentTo: result.credentialsSentTo || null,
    isExistingUser: Boolean(result.isExistingUser),
  };
}

module.exports = {
  isClmSoftTrialOrder,
  tryFulfillClmGhlOrder,
  extractContactProfile,
  extractProductHints,
};
