const {
  getAddOnsTotalForCycle,
  mergeUsageLimitsWithAddOns,
  resolvePurchasedAddOns,
} = require("../../utils/subscription/addOnCatalog");
const {
  isSoftTrialWithoutBilling,
  isClmGhlSoftTrial,
  isLoanAiCardTrial,
  CLM_GHL_BILLING_PHASE_NOTE,
  LOAN_AI_CARD_BILLING_PHASE_NOTE,
  appendSubscriptionNote,
} = require("./freeTrial");

const ACTIVE_SUB_STATUSES = ["TRIAL", "ACTIVE", "PAST_DUE"];

/** Broker portal access allowed only in these states */
const BROKER_ACCESS_STATUSES = ["TRIAL", "ACTIVE"];

const USAGE_METRICS = [
  "LOAN_APPLICATIONS",
  "ACTIVE_USERS",
  "LOAN_OFFICERS",
  "LENDER_CONNECTIONS",
];

/** Metrics admins can override on a subscriber (permissions / plan limits UI). */
const ADMIN_EDITABLE_USAGE_METRICS = [
  "LOAN_OFFICERS",
  "CO_BROKERS",
  "LENDER_CONNECTIONS",
  "LOAN_APPLICATIONS",
];

const USAGE_METRIC_LABELS = {
  LOAN_APPLICATIONS: "Loan Applications (monthly)",
  ACTIVE_USERS: "Active Users",
  LOAN_OFFICERS: "Loan Officers",
  LENDER_CONNECTIONS: "Lenders Network",
  CO_BROKERS: "Co-Brokers",
};

/** Each purchased team seat unlocks this many new loan applications per calendar month. */
const APPLICATIONS_PER_SEAT_PER_MONTH = 20;

/** Metrics persisted on subscription_usage rows (DB enum). */
const PERSISTED_USAGE_METRICS = USAGE_METRICS;

function getCalendarMonthBounds(now = new Date()) {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );
  return { start, end };
}

/**
 * Team seats = package includedUsers + EXTRA_USER quantity (min 1).
 * Matches pricing "Add users" slider totals.
 */
function resolveTeamSeatCount(subscription) {
  const code = String(subscription?.package?.code || "BASIC").toUpperCase();
  const defaultsByCode = { BASIC: 1, PRO: 5, ELITE: 10 };
  let included = defaultsByCode[code] || 1;

  const rawFeatures = subscription?.package?.features;
  if (rawFeatures) {
    try {
      const parsed =
        typeof rawFeatures === "string" ? JSON.parse(rawFeatures) : rawFeatures;
      if (
        parsed &&
        typeof parsed === "object" &&
        parsed.includedUsers != null &&
        Number.isFinite(Number(parsed.includedUsers))
      ) {
        included = Math.max(1, Math.floor(Number(parsed.includedUsers)));
      }
    } catch {
      // keep code default
    }
  }

  let extra = 0;
  const addOns = Array.isArray(subscription?.purchasedAddOns)
    ? subscription.purchasedAddOns
    : [];
  for (const item of addOns) {
    if (String(item?.code || "").toUpperCase() !== "EXTRA_USER") continue;
    extra += Math.max(0, Math.floor(Number(item.quantity) || 1));
  }

  return Math.max(1, included + extra);
}

function resolveMonthlyApplicationLimit(subscription, { overrides = {} } = {}) {
  if (
    overrides.LOAN_APPLICATIONS != null &&
    overrides.LOAN_APPLICATIONS !== "" &&
    Number.isFinite(Number(overrides.LOAN_APPLICATIONS))
  ) {
    return Math.max(0, Math.floor(Number(overrides.LOAN_APPLICATIONS)));
  }
  const seats = resolveTeamSeatCount(subscription);
  return seats * APPLICATIONS_PER_SEAT_PER_MONTH;
}

/**
 * Best-effort Agency GHL location sync after admin assign/change plan.
 * Lazy-require avoids circular deps. Never throws — plan change must succeed.
 */
async function syncAgencyLocationAfterPlanChange(
  prisma,
  { organizationId, organizationSubscriptionId, packageCode },
) {
  try {
    const {
      syncAgencyLocationForSubscription,
    } = require("../ghl/organizationGhlAgencyLocation.service");
    return await syncAgencyLocationForSubscription(prisma, {
      organizationId,
      organizationSubscriptionId,
      packageCode,
    });
  } catch (err) {
    // syncAgencyLocationForSubscription already swallows errors; this is for require/load failures.
    const message = String(err?.message || "Agency location sync failed")
      .slice(0, 500)
      .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
      .replace(/GHL_AGENCY_PRIVATE_TOKEN\s*=\s*\S+/gi, "GHL_AGENCY_PRIVATE_TOKEN=[REDACTED]")
      .replace(/\bpit-[A-Za-z0-9]+\b/gi, "[REDACTED]");
    try {
      const { commonLogs } = require("../logger/contextLogger");
      commonLogs.error("ghl.agency_location.sync_failed", {
        organizationId: organizationId || null,
        organizationSubscriptionId: organizationSubscriptionId || null,
        packageCode: packageCode || null,
        code: "AGENCY_LOCATION_SYNC_FAILED",
        message,
      });
    } catch {
      // ignore logger failures
    }
    return {
      ok: false,
      action: "error",
      mapping: null,
      packageCode: packageCode || null,
      message,
    };
  }
}
function addPeriod(date, billingCycle) {
  const d = new Date(date);
  if (billingCycle === "YEARLY") {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}

function getPackagePrice(pkg, billingCycle) {
  if (billingCycle === "YEARLY" && pkg.priceYearly != null) {
    return Number(pkg.priceYearly);
  }
  return Number(pkg.priceMonthly);
}

function getSubscriptionTotal(sub) {
  const base = getPackagePrice(sub.package, sub.billingCycle);
  const addOns = getAddOnsTotalForCycle(sub.purchasedAddOns, sub.billingCycle);
  return base + addOns;
}

async function ensureSinglePopularPackage(prisma, packageId) {
  await prisma.subscriptionPackage.updateMany({
    where: { NOT: { id: packageId }, isPopular: true },
    data: { isPopular: false },
  });
}

function advisoryLockKey(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

async function generateInvoiceNumber(tx) {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  await tx.$executeRawUnsafe(
    `SELECT pg_advisory_xact_lock(${advisoryLockKey(prefix)})`,
  );

  const last = await tx.subscriptionInvoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });

  let seq = 1;
  if (last?.invoiceNumber) {
    const parts = last.invoiceNumber.split("-");
    const n = parseInt(parts[parts.length - 1], 10);
    if (!Number.isNaN(n)) seq = n + 1;
  }

  return `${prefix}${String(seq).padStart(5, "0")}`;
}

async function createSubscriptionInvoice(tx, sub, options = {}) {
  const amount = options.amount ?? getSubscriptionTotal(sub);
  const periodStart = options.periodStart || sub.currentPeriodStart;
  const periodEnd = options.periodEnd || sub.currentPeriodEnd;
  const dueDate = options.dueDate || new Date();
  const idempotencyKey =
    options.idempotencyKey ||
    `subscription-invoice:${sub.id}:${new Date(periodStart).toISOString()}`;

  if (idempotencyKey) {
    const existing = await tx.subscriptionInvoice.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return existing;
    }
  }

  const invoiceNumber = await generateInvoiceNumber(tx);

  try {
    return await tx.subscriptionInvoice.create({
      data: {
        organizationSubscriptionId: sub.id,
        organizationId: sub.organizationId,
        invoiceNumber,
        amount,
        billingCycle: sub.billingCycle,
        status: options.status || "PENDING",
        periodStart,
        periodEnd,
        dueDate,
        notes: options.notes || null,
        idempotencyKey,
        ghlInvoiceId: options.ghlInvoiceId || sub.ghlInvoiceId || null,
        ghlSubscriptionId:
          options.ghlSubscriptionId || sub.ghlSubscriptionId || null,
        ghlTransactionId: options.ghlTransactionId || null,
        externalPaymentRef: options.externalPaymentRef || null,
      },
    });
  } catch (error) {
    if (idempotencyKey && error.code === "P2002") {
      return tx.subscriptionInvoice.findUnique({
        where: { idempotencyKey },
      });
    }
    throw error;
  }
}

async function countMetricUsage(prisma, organizationId, metric, options = {}) {
  switch (metric) {
    case "LOAN_APPLICATIONS": {
      // Monthly quota — count apps created in the current calendar month (UTC).
      const { start, end } =
        options.periodStart && options.periodEnd
          ? { start: options.periodStart, end: options.periodEnd }
          : getCalendarMonthBounds();
      return prisma.loanApplication.count({
        where: {
          brokerOrgId: organizationId,
          createdAt: { gte: start, lt: end },
        },
      });
    }
    case "ACTIVE_USERS":
      return prisma.userAccount.count({
        where: { organizationId, status: "ACTIVE" },
      });
    case "LOAN_OFFICERS": {
      const role = await prisma.role.findFirst({
        where: { name: "BROKER_OFFICER" },
        select: { id: true },
      });
      if (!role) return 0;
      return prisma.userRole.count({
        where: {
          roleId: role.id,
          user: { organizationId, status: "ACTIVE" },
        },
      });
    }
    case "CO_BROKERS": {
      const role = await prisma.role.findFirst({
        where: { name: "SUB_BROKER" },
        select: { id: true },
      });
      if (!role) return 0;
      return prisma.userRole.count({
        where: {
          roleId: role.id,
          user: { organizationId, status: "ACTIVE" },
        },
      });
    }
    case "LENDER_CONNECTIONS":
      return prisma.brokerLenderAccess.count({
        where: { brokerOrgId: organizationId },
      });
    default:
      return 0;
  }
}

function sanitizeUsageLimitOverrides(value) {
  if (value == null) return null;
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const out = {};
  for (const metric of ADMIN_EDITABLE_USAGE_METRICS) {
    if (!(metric in value)) continue;
    const raw = value[metric];
    if (raw === "" || raw === null || raw === undefined) continue;
    const n = Number(raw);
    if (Number.isFinite(n) && Number.isInteger(n) && n >= 0) {
      out[metric] = n;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Parse enabledFeatures JSON: array of keys, or `{ keys, usageLimits }`. */
function parseEnabledFeaturesPayload(raw) {
  if (raw == null) {
    return { keys: null, usageLimits: null };
  }
  if (Array.isArray(raw)) {
    return { keys: raw, usageLimits: null };
  }
  if (typeof raw === "object") {
    const keys = Array.isArray(raw.keys)
      ? raw.keys
      : Array.isArray(raw.features)
        ? raw.features
        : null;
    return {
      keys,
      usageLimits: sanitizeUsageLimitOverrides(raw.usageLimits),
    };
  }
  return { keys: null, usageLimits: null };
}

function buildEnabledFeaturesPayload(keys, usageLimits) {
  const limits = sanitizeUsageLimitOverrides(usageLimits);
  if (limits) {
    return { keys: Array.isArray(keys) ? keys : [], usageLimits: limits };
  }
  return Array.isArray(keys) ? keys : [];
}

function resolveEffectiveUsageLimits(subscription) {
  const packageLimits =
    subscription?.package?.usageLimits &&
    typeof subscription.package.usageLimits === "object"
      ? { ...subscription.package.usageLimits }
      : {};
  // Legacy packages stored seat limit as ACTIVE_USERS; admin UI tracks CO_BROKERS.
  if (
    packageLimits.CO_BROKERS == null &&
    packageLimits.ACTIVE_USERS != null
  ) {
    packageLimits.CO_BROKERS = packageLimits.ACTIVE_USERS;
  }
  const withAddOns = mergeUsageLimitsWithAddOns(
    packageLimits,
    subscription?.purchasedAddOns,
  );
  if (
    withAddOns.CO_BROKERS == null &&
    withAddOns.ACTIVE_USERS != null
  ) {
    withAddOns.CO_BROKERS = withAddOns.ACTIVE_USERS;
  }
  const { usageLimits: overrides } = parseEnabledFeaturesPayload(
    subscription?.enabledFeatures,
  );
  const safeOverrides = overrides || {};

  const seats = resolveTeamSeatCount(subscription);
  const monthlyApps = resolveMonthlyApplicationLimit(subscription, {
    overrides: safeOverrides,
  });

  const effective = {
    ...withAddOns,
    ...safeOverrides,
    // Always derive from seats × 20 unless admin overrode LOAN_APPLICATIONS
    LOAN_APPLICATIONS: monthlyApps,
  };

  return {
    packageDefaults: withAddOns,
    overrides: safeOverrides,
    effective,
    teamSeats: seats,
    applicationsPerSeat: APPLICATIONS_PER_SEAT_PER_MONTH,
  };
}

async function assertSeatAvailable(prisma, organizationId, metric) {
  const metricKey = String(metric || "").toUpperCase();
  if (!["LOAN_OFFICERS", "CO_BROKERS", "ACTIVE_USERS"].includes(metricKey)) {
    return { ok: true };
  }

  const sub = await prisma.organizationSubscription.findFirst({
    where: {
      organizationId,
      status: { in: ACTIVE_SUB_STATUSES },
    },
    orderBy: { createdAt: "desc" },
    include: { package: true },
  });

  // Legacy orgs without a subscription: do not block.
  if (!sub) return { ok: true, unlimited: true };

  const { effective } = resolveEffectiveUsageLimits(sub);
  const rawLimit = effective[metricKey];
  if (rawLimit == null || rawLimit === "") {
    return { ok: true, unlimited: true };
  }

  const limit = Number(rawLimit);
  if (!Number.isFinite(limit)) {
    return { ok: true, unlimited: true };
  }

  const used = await countMetricUsage(prisma, organizationId, metricKey);
  if (used >= limit) {
    const label =
      metricKey === "LOAN_OFFICERS"
        ? "loan officers"
        : metricKey === "CO_BROKERS"
          ? "co-brokers"
          : "users";
    return {
      ok: false,
      statusCode: 403,
      code: "SEAT_LIMIT_REACHED",
      message: `Your plan allows up to ${limit} ${label}. Buy Additional Users or upgrade to add more.`,
      used,
      limit,
      metric: metricKey,
    };
  }

  return { ok: true, used, limit, metric: metricKey };
}

/**
 * Enforce monthly loan-application quota: teamSeats × 20 / calendar month.
 */
async function assertApplicationQuotaAvailable(prisma, organizationId) {
  const sub = await prisma.organizationSubscription.findFirst({
    where: {
      organizationId,
      status: { in: ACTIVE_SUB_STATUSES },
    },
    orderBy: { createdAt: "desc" },
    include: { package: true },
  });

  if (!sub) return { ok: true, unlimited: true };

  const {
    effective,
    teamSeats,
    applicationsPerSeat,
  } = resolveEffectiveUsageLimits(sub);
  const limit = Number(effective.LOAN_APPLICATIONS);
  if (!Number.isFinite(limit)) {
    return { ok: true, unlimited: true };
  }

  const { start, end } = getCalendarMonthBounds();
  const used = await countMetricUsage(prisma, organizationId, "LOAN_APPLICATIONS", {
    periodStart: start,
    periodEnd: end,
  });

  if (used >= limit) {
    return {
      ok: false,
      statusCode: 403,
      code: "APPLICATION_LIMIT_REACHED",
      message: `Monthly loan application limit reached (${used}/${limit}). Your plan allows ${applicationsPerSeat} applications per user per month (${teamSeats} users × ${applicationsPerSeat}). Add users or wait until next month.`,
      used,
      limit,
      teamSeats,
      applicationsPerSeat,
      periodStart: start,
      periodEnd: end,
    };
  }

  return {
    ok: true,
    used,
    limit,
    teamSeats,
    applicationsPerSeat,
    periodStart: start,
    periodEnd: end,
  };
}

async function refreshUsageForSubscription(prisma, organizationSubscriptionId) {
  const sub = await prisma.organizationSubscription.findUnique({
    where: { id: organizationSubscriptionId },
    include: { package: true },
  });

  if (!sub) {
    throw new Error("Subscription not found");
  }

  const { effective: limits } = resolveEffectiveUsageLimits(sub);

  const records = [];

  for (const metric of PERSISTED_USAGE_METRICS) {
    const monthBounds =
      metric === "LOAN_APPLICATIONS" ? getCalendarMonthBounds() : null;
    const usedValue = await countMetricUsage(prisma, sub.organizationId, metric, {
      periodStart: monthBounds?.start,
      periodEnd: monthBounds?.end,
    });
    const limitValue =
      limits[metric] != null && limits[metric] !== ""
        ? Number(limits[metric])
        : null;

    const periodStart = monthBounds?.start || sub.currentPeriodStart;
    const periodEnd = monthBounds?.end || sub.currentPeriodEnd;

    const record = await prisma.subscriptionUsage.upsert({
      where: {
        organizationSubscriptionId_metric_periodStart: {
          organizationSubscriptionId,
          metric,
          periodStart,
        },
      },
      create: {
        organizationSubscriptionId,
        metric,
        limitValue: Number.isFinite(limitValue) ? limitValue : null,
        usedValue,
        periodStart,
        periodEnd,
      },
      update: {
        limitValue: Number.isFinite(limitValue) ? limitValue : null,
        usedValue,
        periodEnd,
      },
    });

    records.push(record);
  }

  return records;
}

async function generateInvoice(prisma, organizationSubscriptionId, options = {}) {
  const sub = await prisma.organizationSubscription.findUnique({
    where: { id: organizationSubscriptionId },
    include: { package: true },
  });

  if (!sub) {
    throw new Error("Subscription not found");
  }

  return prisma.$transaction((tx) => createSubscriptionInvoice(tx, sub, options));
}

async function assignPlanToOrganization(prisma, payload) {
  const {
    organizationId,
    packageId,
    billingCycle = "MONTHLY",
    trialDays = 0,
    notes,
    assignedByAdminId,
    generateInvoice: shouldInvoice = true,
    addOnCodes = [],
    status: statusOverride,
    ghlContactId,
    ghlPriceId,
    ghlProductId,
    ghlSubscriptionId,
    ghlInvoiceId,
    stripeCustomerId,
    stripeSubscriptionId,
    loanAiUserId,
    currentPeriodStart,
    currentPeriodEnd,
  } = payload;

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  if (!org || org.type !== "BROKER") {
    throw Object.assign(new Error("Organization must be a broker"), { statusCode: 400 });
  }

  const pkg = await prisma.subscriptionPackage.findFirst({
    where: { id: packageId, isActive: true },
  });

  if (!pkg) {
    throw Object.assign(new Error("Subscription package not found or inactive"), {
      statusCode: 404,
    });
  }

  let purchasedAddOns = [];
  try {
    purchasedAddOns = resolvePurchasedAddOns(addOnCodes, pkg.code, billingCycle);
  } catch (error) {
    if (error.statusCode) throw error;
    throw error;
  }

  const existing = await prisma.organizationSubscription.findFirst({
    where: {
      organizationId,
      status: { in: ACTIVE_SUB_STATUSES },
    },
  });

  if (existing) {
    throw Object.assign(
      new Error("Organization already has an active subscription. Use change plan instead."),
      { statusCode: 409 },
    );
  }

  const now = currentPeriodStart ? new Date(currentPeriodStart) : new Date();
  const periodEnd = currentPeriodEnd
    ? new Date(currentPeriodEnd)
    : addPeriod(now, billingCycle);
  const status =
    statusOverride || (trialDays > 0 ? "TRIAL" : "ACTIVE");
  const trialEndsAt =
    trialDays > 0 ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000) : null;

  const subscription = await prisma.$transaction(async (tx) => {
    const created = await tx.organizationSubscription.create({
      data: {
        organizationId,
        packageId,
        billingCycle,
        status,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        trialEndsAt,
        notes: notes || null,
        purchasedAddOns: purchasedAddOns.length > 0 ? purchasedAddOns : null,
        assignedByAdminId: assignedByAdminId || null,
        ghlContactId: ghlContactId || null,
        ghlPriceId: ghlPriceId || null,
        ghlProductId: ghlProductId || null,
        ghlSubscriptionId: ghlSubscriptionId || null,
        ghlInvoiceId: ghlInvoiceId || null,
        stripeCustomerId: stripeCustomerId || null,
        stripeSubscriptionId: stripeSubscriptionId || null,
        loanAiUserId: loanAiUserId || null,
      },
      include: { package: true, organization: true },
    });

    await refreshUsageForSubscription(tx, created.id);

    let invoice = null;
    if (shouldInvoice && status !== "TRIAL") {
      invoice = await createSubscriptionInvoice(tx, created, {
        idempotencyKey: `subscription-invoice:${created.id}:${now.toISOString()}`,
        notes: "Initial subscription invoice",
      });
    }

    return { subscription: created, invoice };
  });

  const agencyLocation = await syncAgencyLocationAfterPlanChange(prisma, {
    organizationId,
    organizationSubscriptionId: subscription.subscription.id,
    packageCode: subscription.subscription.package?.code || pkg.code,
  });

  return {
    subscription: subscription.subscription,
    invoice: subscription.invoice,
    agencyLocation,
  };
}

async function changePlan(prisma, payload) {
  const {
    organizationId,
    packageId,
    billingCycle,
    notes,
    assignedByAdminId,
    generateInvoice: shouldInvoice = false,
  } = payload;

  const sub = await prisma.organizationSubscription.findFirst({
    where: {
      organizationId,
      status: { in: ACTIVE_SUB_STATUSES },
    },
    include: { package: true },
  });

  if (!sub) {
    throw Object.assign(new Error("No active subscription found for this organization"), {
      statusCode: 404,
    });
  }

  const pkg = await prisma.subscriptionPackage.findFirst({
    where: { id: packageId, isActive: true },
  });

  if (!pkg) {
    throw Object.assign(new Error("Subscription package not found or inactive"), {
      statusCode: 404,
    });
  }

  const now = new Date();
  const nextCycle = billingCycle || sub.billingCycle;
  const periodEnd = addPeriod(now, nextCycle);

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.organizationSubscription.update({
      where: { id: sub.id },
      data: {
        packageId,
        billingCycle: nextCycle,
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        trialEndsAt: null,
        cancelledAt: null,
        cancelAtPeriodEnd: false,
        notes: notes ?? sub.notes,
        assignedByAdminId: assignedByAdminId || sub.assignedByAdminId,
      },
      include: { package: true, organization: true },
    });

    await refreshUsageForSubscription(tx, updated.id);

    let invoice = null;
    if (shouldInvoice) {
      invoice = await createSubscriptionInvoice(tx, updated, {
        periodStart: now,
        periodEnd,
        notes: "Plan change invoice",
        idempotencyKey: `plan-change:${updated.id}:${now.toISOString()}`,
      });
    }

    return { subscription: updated, invoice };
  });

  const agencyLocation = await syncAgencyLocationAfterPlanChange(prisma, {
    organizationId,
    organizationSubscriptionId: result.subscription.id,
    packageCode: result.subscription.package?.code || pkg.code,
  });

  return {
    subscription: result.subscription,
    invoice: result.invoice,
    agencyLocation,
  };
}

/**
 * Merge new add-ons / extra seats onto an active subscription and refresh usage.
 */
async function applyAddOnUpgrade(prisma, payload) {
  const {
    organizationSubscriptionId,
    organizationId,
    deltaCodes = [],
    mergedPurchased,
    notes,
    ghlContactId,
    ghlInvoiceId,
    ghlSubscriptionId,
    ghlTransactionId,
    markPaid = true,
  } = payload;

  const sub = await prisma.organizationSubscription.findFirst({
    where: organizationSubscriptionId
      ? { id: organizationSubscriptionId }
      : {
          organizationId,
          status: { in: ACTIVE_SUB_STATUSES },
        },
    include: { package: true },
  });

  if (!sub) {
    throw Object.assign(new Error("No active subscription found"), {
      statusCode: 404,
    });
  }

  const {
    mergePurchasedAddOns,
    resolvePurchasedAddOns,
    flattenPurchasedAddOnCodes,
    getAddOnsTotalForCycle: addOnsCycleTotal,
  } = require("../../utils/subscription/addOnCatalog");

  const purchased =
    Array.isArray(mergedPurchased) && mergedPurchased.length > 0
      ? mergedPurchased
      : mergePurchasedAddOns(
          sub.purchasedAddOns,
          deltaCodes,
          sub.package?.code,
          sub.billingCycle,
        );

  const flatCodes = flattenPurchasedAddOnCodes(purchased);
  const normalized = resolvePurchasedAddOns(
    flatCodes,
    sub.package?.code,
    sub.billingCycle,
  );

  const deltaResolved = resolvePurchasedAddOns(
    deltaCodes,
    sub.package?.code,
    sub.billingCycle,
  );
  const amount = addOnsCycleTotal(deltaResolved, sub.billingCycle);

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.organizationSubscription.update({
      where: { id: sub.id },
      data: {
        purchasedAddOns: normalized.length > 0 ? normalized : null,
        notes: notes
          ? appendSubscriptionNote(sub.notes, notes)
          : sub.notes,
        ghlContactId: ghlContactId || undefined,
        ghlInvoiceId: ghlInvoiceId || undefined,
        ghlSubscriptionId: ghlSubscriptionId || undefined,
      },
      include: { package: true, organization: true },
    });

    await refreshUsageForSubscription(tx, updated.id);

    let invoice = null;
    if (deltaCodes.length > 0 && Number.isFinite(amount) && amount > 0) {
      invoice = await createSubscriptionInvoice(tx, updated, {
        amount,
        notes: "Add-on / extra user upgrade",
        idempotencyKey: `addon-upgrade:${updated.id}:${ghlInvoiceId || now.toISOString()}`,
      });
      if (markPaid && invoice) {
        invoice = await tx.subscriptionInvoice.update({
          where: { id: invoice.id },
          data: {
            status: "PAID",
            paidAt: now,
            ghlInvoiceId: ghlInvoiceId || null,
            ghlSubscriptionId: ghlSubscriptionId || null,
            ghlTransactionId: ghlTransactionId || null,
            externalPaymentRef: ghlInvoiceId || null,
          },
        });
      }
    }

    return { subscription: updated, invoice };
  });

  // GHL Starter/Growth add-ons (or Pro/Elite) → provision dedicated Agency sub-account.
  const agencyLocation = await syncAgencyLocationAfterPlanChange(prisma, {
    organizationId: result.subscription.organizationId,
    organizationSubscriptionId: result.subscription.id,
    packageCode: result.subscription.package?.code || sub.package?.code,
  });

  return { ...result, agencyLocation };
}

async function cancelSubscription(prisma, payload) {
  const { organizationId, immediate = false } = payload;

  const sub = await prisma.organizationSubscription.findFirst({
    where: {
      organizationId,
      status: { in: ACTIVE_SUB_STATUSES },
    },
  });

  if (!sub) {
    throw Object.assign(new Error("No active subscription found"), { statusCode: 404 });
  }

  if (immediate) {
    const updated = await prisma.organizationSubscription.update({
      where: { id: sub.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelAtPeriodEnd: false,
      },
      include: { package: true, organization: true },
    });

    await syncAgencyLocationAfterPlanChange(prisma, {
      organizationId,
      organizationSubscriptionId: updated.id,
      packageCode: "BASIC",
    });

    return updated;
  }

  return prisma.organizationSubscription.update({
    where: { id: sub.id },
    data: {
      cancelAtPeriodEnd: true,
    },
    include: { package: true, organization: true },
  });
}

async function markInvoicePaid(prisma, invoiceId) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.subscriptionInvoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw Object.assign(new Error("Invoice not found"), { statusCode: 404 });
    }

    const updatedInvoice = await tx.subscriptionInvoice.update({
      where: { id: invoiceId },
      data: {
        status: "PAID",
        paidAt: new Date(),
      },
    });

    const sub = await tx.organizationSubscription.findUnique({
      where: { id: invoice.organizationSubscriptionId },
    });

    if (sub?.status === "PAST_DUE") {
      await tx.organizationSubscription.update({
        where: { id: sub.id },
        data: { status: "ACTIVE" },
      });
    }

    return updatedInvoice;
  });
}

async function expireSingleTrial(prisma, sub, now) {
  const periodStart = now;
  const periodEnd = addPeriod(now, sub.billingCycle);
  const idempotencyKey = `subscription-invoice:${sub.id}:${periodStart.toISOString()}`;

  return prisma.$transaction(async (tx) => {
    const current = await tx.organizationSubscription.findUnique({
      where: { id: sub.id },
      include: { package: true, organization: true },
    });

    if (
      !current ||
      current.status !== "TRIAL" ||
      !current.trialEndsAt ||
      current.trialEndsAt > now
    ) {
      return null;
    }

    // CLM GHL funnel: GHL bills $699/mo from the card on the order form.
    // Keep access ACTIVE (no lock). Keep trialEndsAt so UI can show Discontinue.
    if (isClmGhlSoftTrial(current)) {
      const subscription = await tx.organizationSubscription.update({
        where: { id: sub.id },
        data: {
          status: "ACTIVE",
          // Keep trialEndsAt — marks when free period ended for Discontinue banner.
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          notes: appendSubscriptionNote(
            current.notes,
            CLM_GHL_BILLING_PHASE_NOTE,
          ),
        },
        include: { package: true, organization: true },
      });

      await refreshUsageForSubscription(tx, sub.id);

      return {
        subscription,
        invoice: null,
        clmConvertedToActive: true,
      };
    }

    // Loan AI card trial: Stripe already has the card and starts charging after
    // trial_period_days. Keep ACTIVE; no LendingCart invoice.
    if (isLoanAiCardTrial(current)) {
      const subscription = await tx.organizationSubscription.update({
        where: { id: sub.id },
        data: {
          status: "ACTIVE",
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          notes: appendSubscriptionNote(
            current.notes,
            LOAN_AI_CARD_BILLING_PHASE_NOTE,
          ),
        },
        include: { package: true, organization: true },
      });

      await refreshUsageForSubscription(tx, sub.id);

      return {
        subscription,
        invoice: null,
        loanAiCardConvertedToActive: true,
      };
    }

    // Loan AI legacy no-card soft trials — expire access until they pay on LendingCart.
    if (isSoftTrialWithoutBilling(current)) {
      const subscription = await tx.organizationSubscription.update({
        where: { id: sub.id },
        data: {
          status: "EXPIRED",
          trialEndsAt: null,
          cancelledAt: now,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        },
        include: { package: true, organization: true },
      });

      await refreshUsageForSubscription(tx, sub.id);

      return { subscription, invoice: null, expiredWithoutBilling: true };
    }

    const subscription = await tx.organizationSubscription.update({
      where: { id: sub.id },
      data: {
        status: "ACTIVE",
        trialEndsAt: null,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      },
      include: { package: true, organization: true },
    });

    const invoice = await createSubscriptionInvoice(tx, subscription, {
      periodStart,
      periodEnd,
      notes: "Trial ended — first billing invoice",
      idempotencyKey,
    });

    await refreshUsageForSubscription(tx, sub.id);

    return { subscription, invoice };
  });
}

/**
 * End TRIAL subscriptions whose trialEndsAt has passed.
 * Admin trials → ACTIVE + invoice.
 * Loan AI legacy no-card soft trials → EXPIRED (no invoice).
 * Loan AI card trials → ACTIVE (Stripe bills; no LendingCart invoice).
 * CLM GHL soft trials → ACTIVE (GHL bills; no LendingCart invoice; no lock).
 */
async function expireEndedTrials(prisma, io = null) {
  const now = new Date();

  const expiredTrials = await prisma.organizationSubscription.findMany({
    where: {
      status: "TRIAL",
      trialEndsAt: { lte: now },
    },
    include: { package: true, organization: true },
  });

  const results = [];

  for (const sub of expiredTrials) {
    const result = await expireSingleTrial(prisma, sub, now);
    if (result) {
      results.push(result);

      if (result.clmConvertedToActive) {
        try {
          const {
            sendClmTrialCompletedAlert,
          } = require("./subscriptionTrialReminder");
          await sendClmTrialCompletedAlert(
            prisma,
            io,
            result.subscription,
          );
        } catch (alertErr) {
          // Non-fatal — access conversion already succeeded.
          const { commonLogs } = require("../logger/contextLogger");
          commonLogs.warn("CLM trial-completed alert failed", {
            subscriptionId: result.subscription?.id,
            error: alertErr?.message,
          });
        }
      }
    }
  }

  return results;
}

/**
 * Mark ACTIVE subscriptions as PAST_DUE when they have unpaid invoices past due date.
 */
async function markPastDueSubscriptions(prisma) {
  const now = new Date();

  const overdueInvoices = await prisma.subscriptionInvoice.findMany({
    where: {
      status: "PENDING",
      dueDate: { lt: now },
      organizationSubscription: { status: "ACTIVE" },
    },
    select: { organizationSubscriptionId: true },
    distinct: ["organizationSubscriptionId"],
  });

  const updated = [];

  for (const row of overdueInvoices) {
    const subscription = await prisma.organizationSubscription.update({
      where: { id: row.organizationSubscriptionId },
      data: { status: "PAST_DUE" },
      include: { organization: true, package: true },
    });
    updated.push(subscription);
  }

  return updated;
}

async function runSubscriptionBillingCycle(prisma, io = null) {
  const expiredTrials = await expireEndedTrials(prisma, io);
  const pastDue = await markPastDueSubscriptions(prisma);
  return {
    expiredTrials: expiredTrials.length,
    pastDue: pastDue.length,
    details: { expiredTrials, pastDue },
  };
}

async function assertBrokerSubscriptionAccess(prisma, organizationId) {
  const sub = await prisma.organizationSubscription.findFirst({
    where: {
      organizationId,
      status: { in: [...BROKER_ACCESS_STATUSES, "PAST_DUE", "CANCELLED", "EXPIRED"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, trialEndsAt: true },
  });

  if (!sub) {
    return { allowed: true, subscription: null };
  }

  if (!BROKER_ACCESS_STATUSES.includes(sub.status)) {
    const byStatus = {
      PAST_DUE: {
        code: "SUBSCRIPTION_PAST_DUE",
        message:
          "Your subscription payment is overdue. Please contact platform support.",
      },
      CANCELLED: {
        code: "SUBSCRIPTION_CANCELLED",
        message:
          "Your subscription was cancelled. Choose a plan to subscribe again.",
      },
      EXPIRED: {
        code: "SUBSCRIPTION_EXPIRED",
        message:
          "Your free access period has ended. Choose a plan on LendingCart to continue.",
      },
    };
    const mapped = byStatus[sub.status] || {
      code: "SUBSCRIPTION_INACTIVE",
      message: "Your subscription is not active.",
    };
    return {
      allowed: false,
      subscription: sub,
      code: mapped.code,
      message: mapped.message,
    };
  }

  return { allowed: true, subscription: sub };
}

module.exports = {
  ACTIVE_SUB_STATUSES,
  BROKER_ACCESS_STATUSES,
  USAGE_METRICS,
  ADMIN_EDITABLE_USAGE_METRICS,
  USAGE_METRIC_LABELS,
  addPeriod,
  getPackagePrice,
  getSubscriptionTotal,
  ensureSinglePopularPackage,
  countMetricUsage,
  sanitizeUsageLimitOverrides,
  parseEnabledFeaturesPayload,
  buildEnabledFeaturesPayload,
  resolveEffectiveUsageLimits,
  resolveTeamSeatCount,
  resolveMonthlyApplicationLimit,
  APPLICATIONS_PER_SEAT_PER_MONTH,
  assertSeatAvailable,
  assertApplicationQuotaAvailable,
  refreshUsageForSubscription,
  generateInvoice,
  assignPlanToOrganization,
  changePlan,
  applyAddOnUpgrade,
  cancelSubscription,
  markInvoicePaid,
  expireEndedTrials,
  markPastDueSubscriptions,
  runSubscriptionBillingCycle,
  assertBrokerSubscriptionAccess,
  syncAgencyLocationAfterPlanChange,
};
