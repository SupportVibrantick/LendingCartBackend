const {
  updateBorrowerClientIdentity,
} = require("../../../services/clientPortal/updateBorrowerClientIdentity");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function updateBorrowerIdentityRoute(fastify) {
  fastify.patch("/:clientId/identity", async (req, reply) => {
    const prisma = fastify.prisma;
    const brokerOrgId =
      req.user?.organizationId || req.user?.orgId || req.user?.brokerOrgId;
    const { clientId } = req.params;
    const { firstName, lastName, phone } = req.body || {};

    if (!brokerOrgId) {
      return reply.code(401).send({
        success: false,
        message: "Unauthorized",
      });
    }

    try {
      const data = await updateBorrowerClientIdentity(prisma, {
        brokerOrgId,
        clientId,
        firstName,
        lastName,
        phone,
      });

      return reply.send({
        success: true,
        message: "Client portal name updated",
        data,
      });
    } catch (error) {
      const status = error.statusCode || 500;
      if (status >= 500) {
        fastify.log.error(
          { error: error.message, clientId },
          "Failed to update borrower identity",
        );
      }
      return reply.code(status).send({
        success: false,
        message:
          status >= 500 ? "Unexpected server error" : error.message,
      });
    }
  });
}

module.exports = updateBorrowerIdentityRoute;
