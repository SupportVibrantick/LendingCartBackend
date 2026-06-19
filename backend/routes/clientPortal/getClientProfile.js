const { getClientFromRequest } = require("../../utils/clientPortalAuth");
const { resolveClientDisplayName } = require("../../utils/resolveClientDisplayName");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function getClientProfileRoute(fastify) {
  fastify.get("/profile", async (req, reply) => {
    const prisma = fastify.prisma;

    try {
      const auth = getClientFromRequest(req);
      if (auth.error) {
        return reply.code(auth.error.code).send({
          success: false,
          message: auth.error.message,
        });
      }

      const user = await prisma.clientPortalUser.findFirst({
        where: {
          clientId: auth.clientId,
          isDeleted: false,
        },
        include: {
          client: {
            include: {
              contacts: true,
            },
          },
        },
      });

      if (!user) {
        return reply.code(404).send({
          success: false,
          message: "Client account not found",
        });
      }

      const clientName = await resolveClientDisplayName(prisma, {
        clientId: user.clientId,
        client: user.client,
        contacts: user.client?.contacts || [],
      });

      return reply.send({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          clientId: user.clientId,
          clientName,
        },
      });
    } catch (error) {
      fastify.log.error({ error: error.message }, "Failed to fetch client profile");

      return reply.code(500).send({
        success: false,
        message: "Unexpected server error",
      });
    }
  });
}

module.exports = getClientProfileRoute;
