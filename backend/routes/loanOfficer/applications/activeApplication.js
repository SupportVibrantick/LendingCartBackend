const { officerPreHandler } = require("../../../services/loanOfficerAccess");
const {
  fetchActiveBrokerApplication,
  formatActiveApplicationResponse,
} = require("../../../utils/activeBrokerApplication");

module.exports = async function loanOfficerActiveApplication(fastify) {
  fastify.get(
    "/active",
    {
      preHandler: officerPreHandler(fastify),
      schema: {
        tags: ["Loan Officer -> Applications"],
        summary: "Get active broker application form for loan officer",
      },
    },
    async (req, reply) => {
      const brokerOrgId = req.user.organizationId;

      if (!brokerOrgId) {
        return reply.code(403).send({
          success: false,
          message: "Broker context not resolved",
        });
      }

      const application = await fetchActiveBrokerApplication(
        fastify.prisma,
        brokerOrgId,
      );

      if (!application) {
        return reply.code(404).send({
          success: false,
          message: "No active application found",
        });
      }

      return reply.send({
        success: true,
        data: formatActiveApplicationResponse(application),
      });
    },
  );
};
