const prisma = require("../../../config/prisma");

async function meRoute(fastify, options) {
  fastify.get(
    "/me",

    {
      preHandler: [fastify.authenticate, fastify.requireRole(["SUB_BROKER"])],
    },

    async (request, reply) => {
      try {
        const user = await prisma.userAccount.findUnique({
          where: {
            id: request.user.userId,
          },

          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        });

        return reply.code(200).send({
          success: true,
          user,
        });
      } catch (err) {
        console.error(err);

        return reply.code(500).send({
          success: false,
          message: err.message || "Something went wrong",
        });
      }
    },
  );
}

module.exports = meRoute;
