const {
  formatCommissionRecord,
  formatAuditEvent,
  formatPayoutRecord,
  formatInvoiceRecord,
} = require("../../../utils/commissionHelpers");
const { commissionInclude } = require("../../../utils/commissionQueryHelpers");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function getCommissionHistoryRoute(fastify) {
  fastify.get(
    "/:commissionId/history",
    {
      schema: {
        tags: ["Broker -> Commissions"],
        summary: "Get commission audit trail and payment history",
        params: {
          type: "object",
          required: ["commissionId"],
          properties: {
            commissionId: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        if (!req.user?.organizationId) {
          return reply.code(403).send({ success: false, message: "Broker access only" });
        }

        const prisma = fastify.prisma;
        const commissionId = String(req.params.commissionId || "").trim();
        const userId = req.user.id || req.user.userId;
        const roles = req.user.roles || [];
        const isAdmin = roles.includes("BROKER_ADMIN");

        const commission = await prisma.dealCommission.findFirst({
          where: {
            id: commissionId,
            brokerOrgId: req.user.organizationId,
          },
          include: commissionInclude,
        });

        if (!commission) {
          return reply.code(404).send({
            success: false,
            message: "Commission record not found",
          });
        }

        if (!isAdmin && commission.recipientUserId !== userId) {
          return reply.code(403).send({
            success: false,
            message: "You do not have access to this commission history",
          });
        }

        const [auditEvents, payouts, invoices] = await Promise.all([
          prisma.commissionAuditEvent.findMany({
            where: { dealCommissionId: commissionId },
            include: {
              actorUser: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
            },
            orderBy: { createdAt: "asc" },
          }),
          prisma.commissionPayout.findMany({
            where: { dealCommissionId: commissionId },
            include: {
              paidByUser: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
              commissionInvoice: {
                select: { id: true, invoiceNumber: true },
              },
            },
            orderBy: { paidAt: "asc" },
          }),
          prisma.commissionInvoice.findMany({
            where: { dealCommissionId: commissionId },
            orderBy: { generatedAt: "asc" },
          }),
        ]);

        return reply.send({
          success: true,
          data: {
            commission: formatCommissionRecord(commission),
            auditLog: auditEvents.map(formatAuditEvent),
            paymentHistory: payouts.map(formatPayoutRecord),
            invoices: invoices.map(formatInvoiceRecord),
          },
        });
      } catch (error) {
        fastify.log.error({ error: error.message }, "Get commission history failed");
        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to load commission history",
        });
      }
    },
  );
};
