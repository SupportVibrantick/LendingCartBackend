const { buildMonthlySummary } = require("../../../utils/commissionHelpers");
const { derivePayoutStatus } = require("../../../services/commission/recordCommissionPayout");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function getCommissionSummary(fastify) {
  fastify.get(
    "/summary",
    {
      schema: {
        tags: ["Broker -> Commissions"],
        summary: "Commission summary for broker dashboard",
        querystring: {
          type: "object",
          properties: {
            months: { type: "integer", minimum: 1, maximum: 12 },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        if (!req.user?.organizationId) {
          return reply.code(403).send({ success: false, message: "Broker access only" });
        }

        const roles = req.user.roles || [];
        if (!roles.includes("BROKER_ADMIN")) {
          return reply.code(403).send({
            success: false,
            message: "Only broker admins can view commission summary",
          });
        }

        const prisma = fastify.prisma;
        const months = Math.min(12, Math.max(1, Number(req.query?.months) || 6));

        const rows = await prisma.dealCommission.findMany({
          where: { brokerOrgId: req.user.organizationId, status: "CALCULATED" },
          include: {
            payouts: {
              where: { status: "COMPLETED" },
              select: { amount: true, paidAt: true, status: true },
            },
          },
        });

        const summaryRows = rows.map((row) => {
          const payoutStatus = derivePayoutStatus(row.commissionAmount, row.payouts);
          return {
            commissionAmount: row.commissionAmount,
            calculatedAt: row.calculatedAt,
            paidAt: row.payouts?.[0]?.paidAt || null,
            payoutStatus,
            status: payoutStatus,
          };
        });

        const summary = buildMonthlySummary(summaryRows, months);
        const pendingCount = summaryRows.filter((row) => row.payoutStatus !== "PAID").length;
        const paidCount = summaryRows.filter((row) => row.payoutStatus === "PAID").length;

        return reply.send({
          success: true,
          data: {
            ...summary,
            counts: {
              pending: pendingCount,
              paid: paidCount,
              total: rows.length,
            },
          },
        });
      } catch (error) {
        fastify.log.error({ error: error.message }, "Commission summary failed");
        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to load commission summary",
        });
      }
    },
  );
};
