const { officerPreHandler, getUserId } = require("../../../services/broker/loanOfficerAccess");
const { formatCommissionRecord } = require("../../../utils/commission/commissionHelpers");
const { commissionInclude } = require("../../../utils/commission/commissionQueryHelpers");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function listCommissions(fastify) {
  fastify.get(
    "/",
    {
      preHandler: officerPreHandler(fastify, "VIEW_COMMISSIONS"),
      schema: {
        tags: ["Loan Officer -> Commissions"],
        summary: "List commissions earned by the logged-in loan officer",
      },
    },
    async (req, reply) => {
      try {
        const prisma = fastify.prisma;
        const userId = getUserId(req);

        const rows = await prisma.dealCommission.findMany({
          where: {
            recipientUserId: userId,
            recipientRole: "LOAN_OFFICER",
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
        fastify.log.error({ error: error.message }, "LO list commissions failed");
        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to list commissions",
        });
      }
    },
  );
};
