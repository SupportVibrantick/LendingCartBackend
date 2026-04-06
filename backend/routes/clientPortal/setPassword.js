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
           VALIDATE TOKEN (SECURE)
        =============================== */

        const tokenRecord = await prisma.clientUploadToken.findFirst({
          where: {
            token,
            isUsed: false,
            expiresAt: {
              gt: new Date(),
            },
          },
        });

        if (!tokenRecord) {
          return reply.code(400).send({
            success: false,
            message: "Invalid or expired link",
          });
        }

        /* ===============================
           TRANSACTION (CRITICAL)
        =============================== */

        const result = await prisma.$transaction(async (tx) => {
          /* ===============================
             CHECK USER AGAIN (LOCK SAFE)
          =============================== */

          const existingUser = await tx.clientPortalUser.findFirst({
            where: {
              clientId: tokenRecord.clientId,
              isDeleted: false,
            },
          });

          if (existingUser) {
            throw new Error("USER_ALREADY_EXISTS");
          }

          /* ===============================
             GET EMAIL
          =============================== */

          const contact = await tx.clientContact.findFirst({
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
            throw new Error("EMAIL_NOT_FOUND");
          }

          /* ===============================
             HASH PASSWORD
          =============================== */

          const hashedPassword = await bcrypt.hash(password, 10);

          /* ===============================
             CREATE USER
          =============================== */

          const user = await tx.clientPortalUser.create({
            data: {
              clientId: tokenRecord.clientId,
              email: contact.email,
              passwordHash: hashedPassword,
            },
          });

          /* ===============================
             MARK TOKEN USED (IMPORTANT)
          =============================== */

          await tx.clientUploadToken.update({
            where: { id: tokenRecord.id },
            data: { isUsed: true },
          });

          return user;
        });

        /* ===============================
           RESPONSE
        =============================== */

        return reply.send({
          success: true,
          message: "Account created successfully",
          data: {
            userId: result.id,
            email: result.email,
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

        if (error.message === "USER_ALREADY_EXISTS") {
          return reply.code(400).send({
            success: false,
            message: "User already exists. Please login.",
          });
        }

        if (error.message === "EMAIL_NOT_FOUND") {
          return reply.code(400).send({
            success: false,
            message: "Client email not found",
          });
        }

        return reply.code(500).send({
          success: false,
          message: "Unexpected server error",
        });
      }
    }
  );
}

module.exports = setPasswordRoute;