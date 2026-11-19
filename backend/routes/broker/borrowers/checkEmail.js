const { checkBorrowerEmail } = require("../../../services/clientPortal/checkBorrowerEmail");

/**
 * Shared by broker / loan-officer / co-broker portals.
 * @param {import("fastify").FastifyInstance} fastify
 */
async function checkBorrowerEmailRoute(fastify) {
  fastify.get(
    "/check-email",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireRole(["BROKER_ADMIN", "BROKER_OFFICER", "SUB_BROKER"]),
      ],
      schema: {
        tags: ["Borrowers"],
        summary: "Check if borrower email already has a client portal",
        querystring: {
          type: "object",
          required: ["email"],
          properties: {
            email: { type: "string", minLength: 3 },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const brokerOrgId =
        req.user?.organizationId || req.user?.orgId || req.user?.brokerOrgId;
      const email = req.query?.email;

      if (!brokerOrgId) {
        return reply.code(401).send({
          success: false,
          message: "Unauthorized",
        });
      }

      try {
        const data = await checkBorrowerEmail(prisma, { brokerOrgId, email });
        return reply.send({
          success: true,
          data,
        });
      } catch (error) {
        const status = error.statusCode || 500;
        if (status >= 500) {
          fastify.log.error(
            { error: error.message },
            "Failed to check borrower email",
          );
        }
        return reply.code(status).send({
          success: false,
          message: status >= 500 ? "Unexpected server error" : error.message,
        });
      }
    },
  );
}

module.exports = checkBorrowerEmailRoute;
