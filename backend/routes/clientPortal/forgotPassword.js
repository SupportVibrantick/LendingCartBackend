const crypto = require("crypto");
const {
  clientPortalForgotPasswordSchema,
} = require("../../schemas/clientPortal/resetPassword.schema");
const {
  sendClientPortalPasswordResetEmail,
} = require("../../services/emails/clientPortalPasswordResetEmail");
const {
  resolveClientDisplayName,
} = require("../../utils/applications/resolveClientDisplayName");

const RESET_TOKEN_EXPIRY_MS =
  Number(process.env.PASSWORD_RESET_EXPIRY_HOURS || 1) * 60 * 60 * 1000;

const GENERIC_SUCCESS_MESSAGE =
  "If an account exists with that email, a password reset link has been sent.";

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function clientForgotPasswordRoute(fastify) {
  fastify.post(
    "/forgot-password",
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: "1 hour",
          errorResponseBuilder: () => ({
            statusCode: 429,
            error: "Too Many Requests",
            success: false,
            message:
              "Too many reset attempts. Please try again after an hour.",
          }),
        },
      },
      schema: {
        tags: ["Client Portal"],
        summary: "Request client portal password reset email",
        body: {
          type: "object",
          required: ["email"],
          properties: {
            email: { type: "string", format: "email" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const parsed = clientPortalForgotPasswordSchema.safeParse(req.body);
        if (!parsed.success) {
          return reply.code(400).send({
            success: false,
            message: parsed.error.issues[0]?.message || "Invalid email address",
          });
        }

        const { email } = parsed.data;

        const user = await prisma.clientPortalUser.findFirst({
          where: {
            email,
            isDeleted: false,
            isActive: true,
          },
          include: {
            client: {
              include: {
                contacts: {
                  where: { isPrimary: true },
                  take: 1,
                },
              },
            },
          },
        });

        if (user) {
          const token = crypto.randomBytes(32).toString("hex");
          const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

          await prisma.$transaction(async (tx) => {
            await tx.clientPortalPasswordResetToken.updateMany({
              where: {
                userId: user.id,
                usedAt: null,
              },
              data: {
                usedAt: new Date(),
              },
            });

            await tx.clientPortalPasswordResetToken.create({
              data: {
                userId: user.id,
                token,
                expiresAt,
              },
            });
          });

          const displayName = await resolveClientDisplayName(prisma, {
            clientId: user.clientId,
            client: user.client,
            contacts: user.client?.contacts || [],
          });
          const firstName =
            String(displayName || "")
              .trim()
              .split(/\s+/)[0] || null;

          await sendClientPortalPasswordResetEmail({
            firstName,
            email: user.email,
            resetToken: token,
            prisma,
          });
        }

        return reply.send({
          success: true,
          message: GENERIC_SUCCESS_MESSAGE,
        });
      } catch (error) {
        fastify.log.error(
          { error: error.message },
          "Client portal forgot password error",
        );

        return reply.code(500).send({
          success: false,
          message: "Unable to process password reset request",
        });
      }
    },
  );
}

module.exports = clientForgotPasswordRoute;
