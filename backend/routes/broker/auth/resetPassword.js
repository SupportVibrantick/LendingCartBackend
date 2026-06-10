const bcrypt = require("bcrypt");
const {
  brokerResetPasswordSchema,
} = require("../../../schemas/broker/auth/resetPassword.schema");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function resetPasswordRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Broker -> Auth"],
        summary: "Reset broker dashboard password using token",
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
        const parsed = brokerResetPasswordSchema.safeParse(req.body);
        if (!parsed.success) {
          return reply.code(400).send({
            success: false,
            message: parsed.error.issues[0]?.message || "Invalid reset payload",
          });
        }

        const { token, password } = parsed.data;

        const tokenRecord = await prisma.passwordResetToken.findFirst({
          where: {
            token,
            usedAt: null,
            expiresAt: {
              gt: new Date(),
            },
          },
          include: {
            user: {
              include: {
                organization: true,
              },
            },
          },
        });

        if (!tokenRecord) {
          return reply.code(400).send({
            success: false,
            message: "Invalid or expired reset link",
          });
        }

        const user = tokenRecord.user;

        if (
          user.status !== "ACTIVE" ||
          user.isDeleted ||
          !user.organization ||
          user.organization.type !== "BROKER" ||
          user.organization.status !== "ACTIVE"
        ) {
          return reply.code(400).send({
            success: false,
            message: "Invalid or expired reset link",
          });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        await prisma.$transaction(async (tx) => {
          await tx.userAccount.update({
            where: { id: user.id },
            data: { passwordHash },
          });

          await tx.passwordResetToken.update({
            where: { id: tokenRecord.id },
            data: { usedAt: new Date() },
          });

          await tx.passwordResetToken.updateMany({
            where: {
              userId: user.id,
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
          "Broker reset password error"
        );

        return reply.code(500).send({
          success: false,
          message: "Unable to reset password",
        });
      }
    }
  );
}

module.exports = resetPasswordRoutes;
