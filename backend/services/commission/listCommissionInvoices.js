const {
  formatInvoiceListRecord,
  buildInvoiceSummary,
  buildInvoiceListWhere,
  invoiceListInclude,
} = require("../../utils/commissionHelpers");

async function fetchCommissionInvoiceList(
  prisma,
  {
    brokerOrgId,
    recipientUserId = null,
    recipientRole = null,
    status = "ALL",
    search = "",
    startDate = null,
    endDate = null,
    page = 1,
    limit = 10,
  },
) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));
  const skip = (safePage - 1) * safeLimit;

  const where = buildInvoiceListWhere({
    brokerOrgId,
    recipientUserId,
    recipientRole,
    search,
    startDate,
    endDate,
    paymentStatus: status,
  });

  const summaryWhere = {
    brokerOrgId,
    status: { not: "VOID" },
    ...(recipientUserId || recipientRole
      ? {
          dealCommission: {
            ...(recipientUserId ? { recipientUserId } : {}),
            ...(recipientRole ? { recipientRole } : {}),
          },
        }
      : {}),
  };

  const [rows, total, allForSummary] = await Promise.all([
    prisma.commissionInvoice.findMany({
      where,
      include: invoiceListInclude,
      orderBy: [{ generatedAt: "desc" }, { createdAt: "desc" }],
      skip,
      take: safeLimit,
    }),
    prisma.commissionInvoice.count({ where }),
    prisma.commissionInvoice.findMany({
      where: summaryWhere,
      include: invoiceListInclude,
    }),
  ]);

  return {
    data: rows.map((row) => formatInvoiceListRecord(row)),
    summary: buildInvoiceSummary(allForSummary),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  };
}

module.exports = {
  fetchCommissionInvoiceList,
};
