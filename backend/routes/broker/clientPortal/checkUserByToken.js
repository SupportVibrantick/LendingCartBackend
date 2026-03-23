/**
 * @param {import("fastify").FastifyInstance} fastify
 */

async function checkUserByTokenRoute(fastify) {
  fastify.get(
    "/:token",
    {
      schema: {
        tags: ["Client Portal"],
        summary: "Check if client portal user exists using token",
        params: {
          type: "object",
          required: ["token"],
          properties: {
            token: { type: "string" },
          },
        },
      },
    },

    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const { token } = req.params;

        /* ===============================
           VALIDATE TOKEN
        =============================== */

        const tokenRecord = await prisma.clientUploadToken.findUnique({
          where: { token },
          include: {
            client: true,
          },
        });

        if (!tokenRecord) {
          return reply.code(404).send({
            success: false,
            message: "Invalid access link",
          });
        }

        if (tokenRecord.expiresAt < new Date()) {
          return reply.code(400).send({
            success: false,
            message: "Link expired",
          });
        }

        /* ===============================
           CHECK CLIENT USER
        =============================== */

        const clientUser = await prisma.clientPortalUser.findFirst({
          where: {
            clientId: tokenRecord.clientId,
            isDeleted: false,
          },
          select: { id: true },
        });

        const userExists = !!clientUser;

        /* ===============================
           GET CLIENT EMAIL (FIXED)
        =============================== */

        let email = null;

        if (tokenRecord.clientId) {
          const contact = await prisma.clientContact.findFirst({
            where: {
              clientId: tokenRecord.clientId,
            },
            orderBy: {
              isPrimary: "desc", // ✅ always prefer primary contact
            },
            select: {
              email: true,
            },
          });

          email = contact?.email || null;
        }

        /* ===============================
           RESPONSE
        =============================== */

        return reply.send({
          success: true,
          data: {
            userExists,        // decides login vs signup
            email,             // prefill email
            clientId: tokenRecord.clientId,
            tokenValid: true,
          },
        });

      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            token: req.params.token,
          },
          "Failed to check client user by token"
        );

        return reply.code(500).send({
          success: false,
          message: "Unexpected server error",
        });
      }
    }
  );
}

module.exports = checkUserByTokenRoute;