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
           TRANSACTION
        =============================== */

        const result = await prisma.$transaction(async (tx) => {
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

          const clientEmail = contact.email.trim().toLowerCase();

          /* ===============================
             CHECK EXISTING USER
             Unique is on email (not clientId)
          =============================== */

          const existingUser = await tx.clientPortalUser.findFirst({
            where: {
              OR: [
                { clientId: tokenRecord.clientId },
                { email: clientEmail },
                { email: { equals: clientEmail, mode: "insensitive" } },
              ],
            },
          });

          /* ===============================
             HASH PASSWORD
          =============================== */

          const hashedPassword = await bcrypt.hash(password, 10);

          let user;
          const isSoftDeleted = Boolean(existingUser?.isDeleted);

          if (existingUser && !isSoftDeleted) {
            throw new Error("USER_ALREADY_EXISTS");
          }

          if (existingUser && isSoftDeleted) {
            // Restore soft-deleted portal account for this invite
            user = await tx.clientPortalUser.update({
              where: { id: existingUser.id },
              data: {
                clientId: tokenRecord.clientId,
                email: clientEmail,
                passwordHash: hashedPassword,
                isActive: true,
                isDeleted: false,
                deletedAt: null,
              },
            });
          } else {
            try {
              user = await tx.clientPortalUser.create({
                data: {
                  clientId: tokenRecord.clientId,
                  email: clientEmail,
                  passwordHash: hashedPassword,
                },
              });
            } catch (createError) {
              // Race / casing mismatch: email already taken
              if (createError?.code === "P2002") {
                throw new Error("USER_ALREADY_EXISTS");
              }
              throw createError;
            }
          }

          /* ===============================
             LINK CLIENT TO EXISTING CONVERSATION
          =============================== */

          try {
            await tx.conversationParticipant.updateMany({
              where: {
                participantType: "CLIENT",
                participantEmail: clientEmail,
                participantId: null,
              },
              data: {
                participantId: user.id,
              },
            });
          } catch (err) {
            fastify.log.error(
              {
                error: err.message,
                clientId: tokenRecord.clientId,
              },
              "Failed to link client to conversations",
            );
          }

          /* ===============================
             MARK TOKEN USED
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
            stack: error.stack,
            body: req.body,
          },
          "Failed to set client password",
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
          message: error.message || "Unexpected server error",
        });
      }
    },
  );
}

module.exports = setPasswordRoute;
