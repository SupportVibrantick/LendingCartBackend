const { randomUUID } = require("crypto");

/**
 * @param {import("@prisma/client").PrismaClient | import("@prisma/client").Prisma.TransactionClient} db
 */
async function logCommissionAuditEvent(
  db,
  {
    brokerOrgId,
    loanApplicationId = null,
    dealCommissionId = null,
    commissionInvoiceId = null,
    commissionPayoutId = null,
    eventType,
    actorUserId = null,
    actorType = actorUserId ? "USER" : "SYSTEM",
    metadata = null,
  },
) {
  return db.commissionAuditEvent.create({
    data: {
      id: randomUUID(),
      brokerOrgId,
      loanApplicationId,
      dealCommissionId,
      commissionInvoiceId,
      commissionPayoutId,
      eventType,
      actorUserId,
      actorType,
      metadata: metadata || undefined,
    },
  });
}

module.exports = {
  logCommissionAuditEvent,
};
