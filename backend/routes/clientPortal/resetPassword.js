const bcrypt = require("bcrypt");
const {
  clientPortalResetPasswordSchema,
} = require("../../schemas/clientPortal/resetPassword.schema");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function clientResetPasswordRoute(fastify) {
  fastify.post(
    "/reset-password",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "15 minutes",
          errorResponseBuilder: () => ({
            statusCode: 429,
            error: "Too Many Requests",
            success: false,
            message:
              "Too many attempts. Please try again after 15 minutes.",
          }),
        },
      },
      schema: {
        tags: ["Client Portal"],
        summary: "Reset client portal password using token",
        body: {
          type: "object",
          required: ["token", "password"],
          properties: {
            token: { type: "string" },
            password: { type: "string", minLength: 8 },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const parsed = clientPortalResetPasswordSchema.safeParse(req.body);
        if (!parsed.success) {
          return reply.code(400).send({
            success: false,
            message:
              parsed.error.issues[0]?.message || "Invalid reset payload",
          });
        }

        const { token, password } = parsed.data;

        const tokenRecord =
          await prisma.clientPortalPasswordResetToken.findFirst({
            where: {
              token,
              usedAt: null,
              expiresAt: {
                gt: new Date(),
              },
            },
            include: {
              user: true,
            },
          });

        if (
          !tokenRecord ||
          !tokenRecord.user.isActive ||
          tokenRecord.user.isDeleted
        ) {
          return reply.code(400).send({
            success: false,
            message: "Invalid or expired reset link",
          });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        await prisma.$transaction(async (tx) => {
          await tx.clientPortalUser.update({
            where: { id: tokenRecord.userId },
            data: { passwordHash },
          });

          await tx.clientPortalPasswordResetToken.update({
            where: { id: tokenRecord.id },
            data: { usedAt: new Date() },
          });

          await tx.clientPortalPasswordResetToken.updateMany({
            where: {
              userId: tokenRecord.userId,
              usedAt: null,
              id: { not: tokenRecord.id },
            },
            data: {
              usedAt: new Date(),
            },
          });
        });

        return reply.send({
          success: true,
          message: "Password reset successfully. You can now sign in.",
        });
      } catch (error) {
        fastify.log.error(
          { error: error.message },
          "Client portal reset password error",
        );

        return reply.code(500).send({
          success: false,
          message: "Unable to reset password",
        });
      }
    },
  );
}

module.exports = clientResetPasswordRoute;
