const { Prisma } = require("@prisma/client");

function parseFindersFeePercent(profileData) {
  if (!profileData || typeof profileData !== "object" || Array.isArray(profileData)) {
    return null;
  }

  const raw = profileData.findersFee;
  if (raw == null || raw === "") return null;

  const numeric = Number(String(raw).replace(/%/g, "").trim());
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.round(numeric * 100) / 100;
}

function decimalToNumber(value) {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (value instanceof Prisma.Decimal) return value.toNumber();
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function extractFieldValue(rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === "") return null;
  if (typeof rawValue === "object" && !Array.isArray(rawValue)) {
    return rawValue?.value ?? rawValue?.text ?? rawValue?.label ?? null;
  }
  return rawValue;
}

function getSubmissionFieldValue(fields = [], ...keys) {
  for (const key of keys) {
    const field = fields.find(
      (item) =>
        item.fieldKey === key || item.builderField?.fieldKey === key,
    );
    const value = extractFieldValue(field?.value);
    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }
  return null;
}

function resolveCommissionLoanAmount(loan) {
  const submissions = (loan?.submissions || [])
    .filter((submission) => submission.status !== "SUPERSEDED")
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));

  for (const submission of submissions) {
    const fields = submission.fields || [];
    const fromSubmission = getSubmissionFieldValue(
      fields,
      "amountRequested",
      "loan_amount",
      "amount",
    );

    const numeric = decimalToNumber(fromSubmission);
    if (numeric && numeric > 0) {
      return numeric;
    }
  }

  const fromApplication = decimalToNumber(loan?.amountRequested);
  if (fromApplication && fromApplication > 0) {
    return fromApplication;
  }

  const fundedReview = loan?.fundedApplicationLender?.lenderReviews?.[0];
  const fromApprovedAmount = decimalToNumber(fundedReview?.approvedAmount);
  if (fromApprovedAmount && fromApprovedAmount > 0) {
    return fromApprovedAmount;
  }

  return null;
}

function derivePayoutStatus(commissionAmount, payouts = []) {
  const total = decimalToNumber(commissionAmount) || 0;
  const paid = payouts
    .filter(
      (payout) =>
        payout.status == null || payout.status === "COMPLETED",
    )
    .reduce((sum, payout) => sum + (decimalToNumber(payout.amount) || 0), 0);

  if (paid <= 0) return "UNPAID";
  if (roundMoney(paid) >= roundMoney(total) && total > 0) return "PAID";
  return "PARTIAL";
}

function formatInvoiceRecord(invoice) {
  if (!invoice) return null;
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    pdfUrl: invoice.pdfUrl,
    generatedAt: invoice.generatedAt,
    sentAt: invoice.sentAt,
    viewedAt: invoice.viewedAt,
    downloadedAt: invoice.downloadedAt,
  };
}

function formatPayoutRecord(payout) {
  if (!payout) return null;
  const paidBy = payout.paidByUser;
  return {
    id: payout.id,
    amount: decimalToNumber(payout.amount),
    paymentMethod: payout.paymentMethod,
    paymentReference: payout.paymentReference,
    notes: payout.notes,
    status: payout.status,
    paidAt: payout.paidAt,
    paidByUserId: payout.paidByUserId,
    paidByName: paidBy
      ? `${paidBy.firstName || ""} ${paidBy.lastName || ""}`.trim() || paidBy.email
      : null,
    invoiceNumber: payout.commissionInvoice?.invoiceNumber || null,
    invoiceId: payout.commissionInvoiceId || null,
    createdAt: payout.createdAt,
  };
}

function formatCommissionRecord(record, recipient = null) {
  const recipientUser = recipient || record.recipientUser;
  const firstName = recipientUser?.firstName || "";
  const lastName = recipientUser?.lastName || "";
  const name = `${firstName} ${lastName}`.trim() || recipientUser?.email || null;

  const payouts = (record.payouts || []).map(formatPayoutRecord).filter(Boolean);
  const invoices = (record.invoices || []).map(formatInvoiceRecord).filter(Boolean);
  const latestInvoice = invoices[0] || null;
  const payoutStatus = derivePayoutStatus(record.commissionAmount, record.payouts || []);
  const latestPayout = payouts[0] || null;

  return {
    id: record.id,
    loanApplicationId: record.loanApplicationId,
    applicationNumber: record.loanApplication?.applicationNumber || null,
    brokerOrgId: record.brokerOrgId,
    recipientUserId: record.recipientUserId,
    recipientRole: record.recipientRole,
    recipientName: name,
    recipientEmail: recipientUser?.email || null,
    loanAmount: decimalToNumber(record.loanAmount),
    brokerPoints: decimalToNumber(record.brokerPoints),
    upfrontFee: decimalToNumber(record.upfrontFee),
    commissionPool: decimalToNumber(record.commissionPool),
    findersFeePercent: decimalToNumber(record.findersFeePercent),
    commissionAmount: decimalToNumber(record.commissionAmount),
    lineStatus: record.status,
    payoutStatus,
    status: payoutStatus,
    invoiceNumber: latestInvoice?.invoiceNumber || null,
    latestInvoice,
    invoices,
    payouts,
    paymentMethod: latestPayout?.paymentMethod || null,
    paymentNotes: latestPayout?.notes || null,
    paymentReference: latestPayout?.paymentReference || null,
    paidAt: latestPayout?.paidAt || null,
    paidByUserId: latestPayout?.paidByUserId || null,
    calculatedAt: record.calculatedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    fundedAt: record.loanApplication?.fundedAt || null,
    clientName: record.loanApplication?.client?.legalName || null,
  };
}

function buildMonthlySummary(commissions, months = 6) {
  const now = new Date();
  const buckets = [];

  for (let i = months - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleString("en-US", { month: "short", year: "numeric" });
    buckets.push({ key, label, pending: 0, paid: 0, total: 0 });
  }

  const bucketByKey = Object.fromEntries(buckets.map((bucket) => [bucket.key, bucket]));

  for (const record of commissions) {
    const sourceDate = record.paidAt || record.calculatedAt;
    if (!sourceDate) continue;

    const date = new Date(sourceDate);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const bucket = bucketByKey[key];
    if (!bucket) continue;

    const amount = decimalToNumber(record.commissionAmount) || 0;
    bucket.total += amount;

    const payoutStatus = record.payoutStatus || record.status;
    if (payoutStatus === "PAID") {
      bucket.paid += amount;
    } else {
      bucket.pending += amount;
    }
  }

  return {
    months: buckets.map((bucket) => bucket.label),
    pending: buckets.map((bucket) => roundMoney(bucket.pending)),
    paid: buckets.map((bucket) => roundMoney(bucket.paid)),
    total: buckets.map((bucket) => roundMoney(bucket.total)),
    totals: {
      pending: roundMoney(buckets.reduce((sum, bucket) => sum + bucket.pending, 0)),
      paid: roundMoney(buckets.reduce((sum, bucket) => sum + bucket.paid, 0)),
      all: roundMoney(buckets.reduce((sum, bucket) => sum + bucket.total, 0)),
    },
  };
}

function formatAuditEvent(event) {
  const actor = event.actorUser;
  return {
    id: event.id,
    eventType: event.eventType,
    actorType: event.actorType,
    actorUserId: event.actorUserId,
    actorName: actor
      ? `${actor.firstName || ""} ${actor.lastName || ""}`.trim() || actor.email
      : event.actorType === "SYSTEM"
        ? "System"
        : null,
    metadata: event.metadata || null,
    createdAt: event.createdAt,
    dealCommissionId: event.dealCommissionId,
    commissionInvoiceId: event.commissionInvoiceId,
    commissionPayoutId: event.commissionPayoutId,
    loanApplicationId: event.loanApplicationId,
  };
}

function formatInvoiceListRecord(invoice) {
  if (!invoice) return null;

  const commission = invoice.dealCommission;
  const recipientUser = commission?.recipientUser;
  const firstName = recipientUser?.firstName || "";
  const lastName = recipientUser?.lastName || "";
  const recipientName =
    `${firstName} ${lastName}`.trim() || recipientUser?.email || null;
  const amount = decimalToNumber(commission?.commissionAmount);
  const payoutStatus = derivePayoutStatus(
    commission?.commissionAmount,
    commission?.payouts || [],
  );

  const generatedAt = invoice.generatedAt ? new Date(invoice.generatedAt) : null;
  const overdueCutoff = new Date();
  overdueCutoff.setDate(overdueCutoff.getDate() - 30);

  let paymentStatus = "DUE";
  if (invoice.status === "DRAFT") {
    paymentStatus = "DRAFT";
  } else if (invoice.status === "VOID") {
    paymentStatus = "VOID";
  } else if (payoutStatus === "PAID") {
    paymentStatus = "RECEIVED";
  } else if (generatedAt && generatedAt < overdueCutoff) {
    paymentStatus = "OVERDUE";
  }

  const applicationNumber = invoice.loanApplication?.applicationNumber || null;
  const clientName = invoice.loanApplication?.client?.legalName || null;
  const submissionId = invoice.loanApplication?.submissions?.[0]?.id || null;

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceStatus: invoice.status,
    paymentStatus,
    payoutStatus,
    amount,
    generatedAt: invoice.generatedAt,
    issueDate: invoice.generatedAt,
    recipientUserId: commission?.recipientUserId || null,
    recipientName,
    recipientEmail: recipientUser?.email || null,
    recipientRole: commission?.recipientRole || null,
    dealCommissionId: invoice.dealCommissionId,
    loanApplicationId: invoice.loanApplicationId,
    submissionId,
    applicationNumber,
    clientName,
    dealName: applicationNumber
      ? `${applicationNumber}${clientName ? ` — ${clientName}` : ""}`
      : clientName,
    pdfUrl: invoice.pdfUrl,
    hasPdf: Boolean(invoice.pdfUrl),
    downloadedAt: invoice.downloadedAt,
    viewedAt: invoice.viewedAt,
  };
}

function buildInvoiceSummary(invoices = []) {
  const buckets = {
    draft: { count: 0, amount: 0 },
    due: { count: 0, amount: 0 },
    received: { count: 0, amount: 0 },
    overdue: { count: 0, amount: 0 },
  };

  for (const invoice of invoices) {
    const formatted = formatInvoiceListRecord(invoice);
    if (!formatted) continue;

    const amount = formatted.amount || 0;
    if (formatted.paymentStatus === "DRAFT") {
      buckets.draft.count += 1;
      buckets.draft.amount = roundMoney(buckets.draft.amount + amount);
    } else if (formatted.paymentStatus === "RECEIVED") {
      buckets.received.count += 1;
      buckets.received.amount = roundMoney(buckets.received.amount + amount);
    } else if (formatted.paymentStatus === "OVERDUE") {
      buckets.overdue.count += 1;
      buckets.overdue.amount = roundMoney(buckets.overdue.amount + amount);
    } else if (formatted.paymentStatus === "DUE" || formatted.paymentStatus === "VOID") {
      if (formatted.paymentStatus === "DUE") {
        buckets.due.count += 1;
        buckets.due.amount = roundMoney(buckets.due.amount + amount);
      }
    }
  }

  return buckets;
}

function buildInvoiceListWhere({
  brokerOrgId,
  recipientUserId = null,
  recipientRole = null,
  search = "",
  startDate = null,
  endDate = null,
  invoiceStatus = null,
  paymentStatus = null,
}) {
  const where = { brokerOrgId };

  if (invoiceStatus && invoiceStatus !== "ALL") {
    where.status = String(invoiceStatus).toUpperCase();
  }

  if (startDate || endDate) {
    where.generatedAt = {};
    if (startDate) where.generatedAt.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.generatedAt.lte = end;
    }
  }

  const term = String(search || "").trim();
  if (term) {
    where.OR = [
      { invoiceNumber: { contains: term, mode: "insensitive" } },
      {
        loanApplication: {
          applicationNumber: { contains: term, mode: "insensitive" },
        },
      },
      {
        dealCommission: {
          recipientUser: {
            OR: [
              { firstName: { contains: term, mode: "insensitive" } },
              { lastName: { contains: term, mode: "insensitive" } },
              { email: { contains: term, mode: "insensitive" } },
            ],
          },
        },
      },
      {
        loanApplication: {
          client: { legalName: { contains: term, mode: "insensitive" } },
        },
      },
    ];
  }

  const normalizedPaymentStatus = String(paymentStatus || "ALL").toUpperCase();
  if (normalizedPaymentStatus === "RECEIVED" || normalizedPaymentStatus === "PAID") {
    where.dealCommission = {
      payouts: { some: { status: "COMPLETED" } },
    };
  } else if (
    normalizedPaymentStatus === "DUE" ||
    normalizedPaymentStatus === "UNPAID" ||
    normalizedPaymentStatus === "PENDING"
  ) {
    where.status = { not: "VOID" };
    where.dealCommission = {
      payouts: { none: { status: "COMPLETED" } },
    };
  } else if (normalizedPaymentStatus === "DRAFT") {
    where.status = "DRAFT";
  } else if (normalizedPaymentStatus === "OVERDUE") {
    const overdueCutoff = new Date();
    overdueCutoff.setDate(overdueCutoff.getDate() - 30);
    where.status = { notIn: ["DRAFT", "VOID"] };
    where.generatedAt = {
      ...(where.generatedAt || {}),
      lt: overdueCutoff,
    };
    where.dealCommission = {
      payouts: { none: { status: "COMPLETED" } },
    };
  }

  const recipientScope = {};
  if (recipientUserId) recipientScope.recipientUserId = recipientUserId;
  if (recipientRole) recipientScope.recipientRole = recipientRole;

  if (Object.keys(recipientScope).length > 0) {
    if (where.dealCommission) {
      where.dealCommission = { AND: [where.dealCommission, recipientScope] };
    } else {
      where.dealCommission = recipientScope;
    }
  }

  return where;
}

const invoiceListInclude = {
  dealCommission: {
    include: {
      recipientUser: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      payouts: {
        where: { status: "COMPLETED" },
        select: { amount: true, status: true, paidAt: true },
      },
    },
  },
  loanApplication: {
    select: {
      applicationNumber: true,
      client: { select: { legalName: true } },
      submissions: {
        where: { status: { not: "SUPERSEDED" } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  },
};

module.exports = {
  parseFindersFeePercent,
  decimalToNumber,
  roundMoney,
  derivePayoutStatus,
  formatCommissionRecord,
  formatInvoiceRecord,
  formatInvoiceListRecord,
  formatPayoutRecord,
  formatAuditEvent,
  buildMonthlySummary,
  buildInvoiceSummary,
  buildInvoiceListWhere,
  invoiceListInclude,
  resolveCommissionLoanAmount,
};
