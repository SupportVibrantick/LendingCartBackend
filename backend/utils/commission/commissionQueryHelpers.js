const { commissionLineInclude } = require("../../services/applications/calculateDealCommissions");

const commissionInclude = commissionLineInclude;

function buildCommissionListWhere({
  brokerOrgId,
  status,
  role,
  recipientUserId = null,
  search = null,
}) {
  const where = {
    brokerOrgId,
    status: "CALCULATED",
    ...(role ? { recipientRole: role } : {}),
    ...(recipientUserId ? { recipientUserId } : {}),
  };

  const normalizedStatus = String(status || "ALL").toUpperCase();
  if (normalizedStatus === "PAID") {
    where.payouts = { some: { status: "COMPLETED" } };
  } else if (normalizedStatus === "PENDING" || normalizedStatus === "UNPAID") {
    where.payouts = { none: { status: "COMPLETED" } };
  }

  const term = String(search || "").trim();
  if (term) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      {
        OR: [
          {
            loanApplication: {
              applicationNumber: { contains: term, mode: "insensitive" },
            },
          },
          {
            loanApplication: {
              client: {
                legalName: { contains: term, mode: "insensitive" },
              },
            },
          },
          {
            recipientUser: {
              firstName: { contains: term, mode: "insensitive" },
            },
          },
          {
            recipientUser: {
              lastName: { contains: term, mode: "insensitive" },
            },
          },
          {
            recipientUser: {
              email: { contains: term, mode: "insensitive" },
            },
          },
          {
            invoices: {
              some: {
                invoiceNumber: { contains: term, mode: "insensitive" },
                status: { not: "VOID" },
              },
            },
          },
        ],
      },
    ];
  }

  return where;
}

module.exports = {
  commissionInclude,
  buildCommissionListWhere,
};
