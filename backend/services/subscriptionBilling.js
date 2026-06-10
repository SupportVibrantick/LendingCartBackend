const ACTIVE_SUB_STATUSES = ["TRIAL", "ACTIVE", "PAST_DUE"];

/** Broker portal access allowed only in these states */
const BROKER_ACCESS_STATUSES = ["TRIAL", "ACTIVE"];

const USAGE_METRICS = [
  "LOAN_APPLICATIONS",
  "ACTIVE_USERS",
  "LOAN_OFFICERS",
  "LENDER_CONNECTIONS",
];

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

async function ensureSinglePopularPackage(prisma, packageId) {
  await prisma.subscriptionPackage.updateMany({
    where: { NOT: { id: packageId }, isPopular: true },
    data: { isPopular: false },
  });
}

async function generateInvoiceNumber(prisma) {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const last = await prisma.subscriptionInvoice.findFirst({
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

async function countMetricUsage(prisma, organizationId, metric) {
  switch (metric) {
    case "LOAN_APPLICATIONS":
      return prisma.loanApplication.count({ where: { brokerOrgId: organizationId } });
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
    case "LENDER_CONNECTIONS":
      return prisma.brokerLenderAccess.count({
        where: { brokerOrgId: organizationId },
      });
    default:
      return 0;
  }
}

async function refreshUsageForSubscription(prisma, organizationSubscriptionId) {
  const sub = await prisma.organizationSubscription.findUnique({
    where: { id: organizationSubscriptionId },
    include: { package: true },
  });

  if (!sub) {
    throw new Error("Subscription not found");
  }

  const limits =
    sub.package.usageLimits && typeof sub.package.usageLimits === "object"
      ? sub.package.usageLimits
      : {};

  const records = [];

  for (const metric of USAGE_METRICS) {
    const usedValue = await countMetricUsage(prisma, sub.organizationId, metric);
    const limitValue =
      limits[metric] != null && limits[metric] !== ""
        ? Number(limits[metric])
        : null;

    const record = await prisma.subscriptionUsage.upsert({
      where: {
        organizationSubscriptionId_metric_periodStart: {
          organizationSubscriptionId,
          metric,
          periodStart: sub.currentPeriodStart,
        },
      },
      create: {
        organizationSubscriptionId,
        metric,
        limitValue: Number.isFinite(limitValue) ? limitValue : null,
        usedValue,
        periodStart: sub.currentPeriodStart,
        periodEnd: sub.currentPeriodEnd,
      },
      update: {
        limitValue: Number.isFinite(limitValue) ? limitValue : null,
        usedValue,
        periodEnd: sub.currentPeriodEnd,
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

  const amount = getPackagePrice(sub.package, sub.billingCycle);
  const invoiceNumber = await generateInvoiceNumber(prisma);
  const dueDate = options.dueDate || new Date();

  return prisma.subscriptionInvoice.create({
    data: {
      organizationSubscriptionId: sub.id,
      organizationId: sub.organizationId,
      invoiceNumber,
      amount,
      billingCycle: sub.billingCycle,
      status: options.status || "PENDING",
      periodStart: sub.currentPeriodStart,
      periodEnd: sub.currentPeriodEnd,
      dueDate,
      notes: options.notes || null,
    },
  });
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

  const now = new Date();
  const periodEnd = addPeriod(now, billingCycle);
  const status = trialDays > 0 ? "TRIAL" : "ACTIVE";
  const trialEndsAt =
    trialDays > 0 ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000) : null;

  const subscription = await prisma.organizationSubscription.create({
    data: {
      organizationId,
      packageId,
      billingCycle,
      status,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialEndsAt,
      notes: notes || null,
      assignedByAdminId: assignedByAdminId || null,
    },
    include: { package: true, organization: true },
  });

  await refreshUsageForSubscription(prisma, subscription.id);

  let invoice = null;
  if (shouldInvoice && status !== "TRIAL") {
    invoice = await generateInvoice(prisma, subscription.id);
  }

  return { subscription, invoice };
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

  const updated = await prisma.organizationSubscription.update({
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

  await refreshUsageForSubscription(prisma, updated.id);

  let invoice = null;
  if (shouldInvoice) {
    invoice = await generateInvoice(prisma, updated.id, { notes: "Plan change invoice" });
  }

  return { subscription: updated, invoice };
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
    return prisma.organizationSubscription.update({
      where: { id: sub.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelAtPeriodEnd: false,
      },
      include: { package: true, organization: true },
    });
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
  const invoice = await prisma.subscriptionInvoice.findUnique({
    where: { id: invoiceId },
  });

  if (!invoice) {
    throw Object.assign(new Error("Invoice not found"), { statusCode: 404 });
  }

  const updatedInvoice = await prisma.subscriptionInvoice.update({
    where: { id: invoiceId },
    data: {
      status: "PAID",
      paidAt: new Date(),
    },
  });

  const sub = await prisma.organizationSubscription.findUnique({
    where: { id: invoice.organizationSubscriptionId },
  });

  if (sub?.status === "PAST_DUE") {
    await prisma.organizationSubscription.update({
      where: { id: sub.id },
      data: { status: "ACTIVE" },
    });
  }

  return updatedInvoice;
}

/**
 * Convert TRIAL subscriptions whose trialEndsAt has passed to ACTIVE and bill.
 */
async function expireEndedTrials(prisma) {
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
    const periodStart = now;
    const periodEnd = addPeriod(now, sub.billingCycle);

    const subscription = await prisma.organizationSubscription.update({
      where: { id: sub.id },
      data: {
        status: "ACTIVE",
        trialEndsAt: null,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      },
      include: { package: true, organization: true },
    });

    const invoice = await generateInvoice(prisma, sub.id, {
      notes: "Trial ended — first billing invoice",
    });

    await refreshUsageForSubscription(prisma, sub.id);

    results.push({ subscription, invoice });
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

async function runSubscriptionBillingCycle(prisma) {
  const expiredTrials = await expireEndedTrials(prisma);
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
    const messages = {
      PAST_DUE: "Your subscription payment is overdue. Please contact platform support.",
      CANCELLED: "Your subscription has been cancelled.",
      EXPIRED: "Your subscription has expired.",
    };
    return {
      allowed: false,
      subscription: sub,
      code: "SUBSCRIPTION_INACTIVE",
      message: messages[sub.status] || "Your subscription is not active.",
    };
  }

  return { allowed: true, subscription: sub };
}

module.exports = {
  ACTIVE_SUB_STATUSES,
  BROKER_ACCESS_STATUSES,
  USAGE_METRICS,
  addPeriod,
  getPackagePrice,
  ensureSinglePopularPackage,
  refreshUsageForSubscription,
  generateInvoice,
  assignPlanToOrganization,
  changePlan,
  cancelSubscription,
  markInvoicePaid,
  expireEndedTrials,
  markPastDueSubscriptions,
  runSubscriptionBillingCycle,
  assertBrokerSubscriptionAccess,
};
