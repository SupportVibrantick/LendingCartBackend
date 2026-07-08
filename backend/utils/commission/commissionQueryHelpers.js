const { commissionLineInclude } = require("../../services/applications/calculateDealCommissions");

const commissionInclude = commissionLineInclude;

function buildCommissionListWhere({ brokerOrgId, status, role, recipientUserId = null }) {
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

  return where;
}

module.exports = {
  commissionInclude,
  buildCommissionListWhere,
};
