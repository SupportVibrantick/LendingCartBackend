const { officerPreHandler, getUserId } = require("../../../services/broker/loanOfficerAccess");
const { buildMonthlySummary } = require("../../../utils/commission/commissionHelpers");
const { derivePayoutStatus } = require("../../../services/commission/recordCommissionPayout");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function getCommissionSummary(fastify) {
  fastify.get(
    "/summary",
    {
      preHandler: officerPreHandler(fastify),
      schema: {
        tags: ["Loan Officer -> Commissions"],
        summary: "Monthly commission summary for loan officer dashboard",
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
        const prisma = fastify.prisma;
        const userId = getUserId(req);
        const months = Math.min(12, Math.max(1, Number(req.query?.months) || 6));

        const rows = await prisma.dealCommission.findMany({
          where: {
            recipientUserId: userId,
            recipientRole: "LOAN_OFFICER",
            brokerOrgId: req.user.organizationId,
            status: "CALCULATED",
          },
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

        return reply.send({
          success: true,
          data: buildMonthlySummary(summaryRows, months),
        });
      } catch (error) {
        fastify.log.error({ error: error.message }, "LO commission summary failed");
        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to load commission summary",
        });
      }
    },
  );
}; 
