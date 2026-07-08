const {
  formatCommissionRecord,
  buildMonthlySummary,
} = require("../../../utils/commission/commissionHelpers");
const { commissionInclude } = require("../../../utils/commission/commissionQueryHelpers");
const { derivePayoutStatus } = require("../../../services/commission/recordCommissionPayout");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function listCommissions(fastify) {
  fastify.get(
    "/",
    {
      preHandler: [fastify.authenticate, fastify.requireRole(["SUB_BROKER"])],
      schema: {
        tags: ["Sub Broker -> Commissions"],
        summary: "List commissions earned by the logged-in co-broker",
      },
    },
    async (req, reply) => {
      try {
        const prisma = fastify.prisma;
        const userId = req.user.userId || req.user.id;

        const rows = await prisma.dealCommission.findMany({
          where: {
            recipientUserId: userId,
            recipientRole: "CO_BROKER",
            brokerOrgId: req.user.organizationId,
            status: "CALCULATED",
          },
          include: commissionInclude,
          orderBy: [{ calculatedAt: "desc" }],
        });

        return reply.send({
          success: true,
          data: rows.map((row) => formatCommissionRecord(row, req.user)),
        });
      } catch (error) {
        fastify.log.error({ error: error.message }, "Co-broker list commissions failed");
        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to list commissions",
        });
      }
    },
  );
};
