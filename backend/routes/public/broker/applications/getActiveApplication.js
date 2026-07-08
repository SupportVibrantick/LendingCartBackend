const {
  resolvePublicBrokerOrgId,
} = require("../../../../utils/broker/resolvePublicBrokerOrgId");
const {
  fetchActiveBrokerApplication,
  formatActiveApplicationResponse,
} = require("../../../../utils/broker/activeBrokerApplication");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function getPublicActiveApplication(fastify) {
  fastify.get("/active", async (req, reply) => {
    const brokerOrgId = await resolvePublicBrokerOrgId(
      fastify.prisma,
      req.query,
    );

    if (!brokerOrgId) {
      return reply.code(400).send({
        success: false,
        message:
          "Valid broker is required. Use ?broker=<organizationId> or ?brokerEmail=<email>.",
      });
    }

    const application = await fetchActiveBrokerApplication(
      fastify.prisma,
      brokerOrgId,
    );

    if (!application) {
      return reply.code(404).send({
        success: false,
        message: "No active loan application found for this broker",
      });
    }

    return reply.send({
      success: true,
      data: formatActiveApplicationResponse(application),
    });
  });
};
