const {
  getLoanCommissionBreakdown,
} = require("../../../services/commission/getLoanCommissionBreakdown");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function getSubBrokerLoanCommissions(fastify) {
  fastify.get(
    "/loan/:loanId",
    {
      preHandler: [fastify.authenticate, fastify.requireRole(["SUB_BROKER"])],
      schema: {
        tags: ["Sub Broker -> Commissions"],
        summary: "Get commission breakdown for an assigned funded loan",
        params: {
          type: "object",
          required: ["loanId"],
          properties: {
            loanId: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const prisma = fastify.prisma;
        const loanId = String(req.params.loanId || "").trim();
        const userId = req.user.userId || req.user.id;

        const data = await getLoanCommissionBreakdown(
          prisma,
          loanId,
          req.user.organizationId,
          {
            viewerUserId: userId,
            recipientRole: "CO_BROKER",
            requireAccess: true,
          },
        );

        return reply.send({ success: true, data });
      } catch (error) {
        fastify.log.error({ error: error.message }, "Co-broker get loan commissions failed");
        return reply.code(error.statusCode || 500).send({
          success: false,
          message: error.message || "Failed to load loan commissions",
        });
      }
    },
  );
};
