const bcrypt = require("bcrypt");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */

async function setPasswordRoute(fastify) {
  fastify.post(
    "/set-password",
    {
      schema: {
        tags: ["Client Portal"],
        summary: "Create client portal user (first time)",
        body: {
          type: "object",
          required: ["token", "password"],
          properties: {
            token: { type: "string" },
            password: { type: "string", minLength: 6 },
          },
        },
      },
    },

    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const { token, password } = req.body;

        /* ===============================
           VALIDATE TOKEN
        =============================== */

        const tokenRecord = await prisma.clientUploadToken.findUnique({
          where: { token },
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
           CHECK IF USER ALREADY EXISTS
        =============================== */

        const existingUser = await prisma.clientPortalUser.findFirst({
          where: {
            clientId: tokenRecord.clientId,
            isDeleted: false,
          },
        });

        if (existingUser) {
          return reply.code(400).send({
            success: false,
            message: "User already exists. Please login.",
          });
        }

        /* ===============================
           GET CLIENT EMAIL
        =============================== */

        const contact = await prisma.clientContact.findFirst({
          where: {
            clientId: tokenRecord.clientId,
          },
          orderBy: {
            isPrimary: "desc",
          },
          select: {
            email: true,
          },
        });

        if (!contact?.email) {
          return reply.code(400).send({
            success: false,
            message: "Client email not found",
          });
        }

        /* ===============================
           HASH PASSWORD
        =============================== */

        const hashedPassword = await bcrypt.hash(password, 10);

        /* ===============================
           CREATE CLIENT USER
        =============================== */

        const user = await prisma.clientPortalUser.create({
          data: {
            clientId: tokenRecord.clientId,
            email: contact.email,
            passwordHash: hashedPassword,
          },
        });

        /* ===============================
           OPTIONAL: MARK TOKEN USED
        =============================== */

        await prisma.clientUploadToken.update({
          where: { token },
          data: { isUsed: true },
        });

        /* ===============================
           RESPONSE
        =============================== */

        return reply.send({
          success: true,
          message: "Account created successfully",
          data: {
            userId: user.id,
            email: user.email,
          },
        });

      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            body: req.body,
          },
          "Failed to set client password"
        );

        return reply.code(500).send({
          success: false,
          message: "Unexpected server error",
        });
      }
    }
  );
}

module.exports = setPasswordRoute;