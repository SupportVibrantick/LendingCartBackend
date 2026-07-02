const {
  getLoanCommissionBreakdown,
} = require("../../../services/commission/getLoanCommissionBreakdown");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function getLoanCommissions(fastify) {
  fastify.get(
    "/loan/:loanId",
    {
      schema: {
        tags: ["Broker -> Commissions"],
        summary: "Get commission breakdown for a funded loan",
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
        if (!req.user?.organizationId) {
          return reply.code(403).send({ success: false, message: "Broker access only" });
        }

        const prisma = fastify.prisma;
        const loanId = String(req.params.loanId || "").trim();
        const brokerOrgId = req.user.organizationId;
        const roles = req.user.roles || [];
        const isAdmin = roles.includes("BROKER_ADMIN");
        const userId = req.user.id || req.user.userId;

        const loan = await prisma.loanApplication.findFirst({
          where: { id: loanId, brokerOrgId },
          select: { id: true, brokerUserId: true },
        });

        if (!loan) {
          return reply.code(404).send({
            success: false,
            message: "Loan application not found",
          });
        }

        if (!isAdmin) {
          try {
            const {
              assertLoanCommissionAccess,
            } = require("../../../services/commission/getLoanCommissionBreakdown");
            await assertLoanCommissionAccess(prisma, loan, userId);
          } catch (accessError) {
            return reply.code(accessError.statusCode || 403).send({
              success: false,
              message: accessError.message,
            });
          }
        }

        const data = await getLoanCommissionBreakdown(prisma, loanId, brokerOrgId, {
          autoCalcIfMissing: isAdmin,
        });

        return reply.send({ success: true, data });
      } catch (error) {
        fastify.log.error({ error: error.message }, "Get loan commissions failed");
        return reply.code(error.statusCode || 500).send({
          success: false,
          message: error.message || "Failed to load loan commissions",
        });
      }
    },
  );
};
