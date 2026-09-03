const bcrypt = require("bcrypt");
const {
  brokerChangePasswordSchema,
} = require("../../../schemas/broker/auth/changePassword.schema");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function changePasswordRoutes(fastify) {
  fastify.put(
    "/",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireRole(["SUB_BROKER"]),
      ],
      config: {
        rateLimit: {
          max: 3,
          timeWindow: "15 minutes",
          errorResponseBuilder: () => ({
            statusCode: 429,
            error: "Too Many Requests",
            success: false,
            message:
              "Too many password change attempts. Please try again later.",
          }),
        },
      },
      schema: {
        tags: ["Sub Broker -> Auth"],
        summary: "Change co-broker portal password (logged in)",
        body: {
          type: "object",
          required: ["currentPassword", "newPassword"],
          properties: {
            currentPassword: { type: "string", minLength: 1 },
            newPassword: { type: "string", minLength: 8 },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const userId = req.user?.userId || req.user?.id;
        if (!userId) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        const parsed = brokerChangePasswordSchema.safeParse(req.body);
        if (!parsed.success) {
          return reply.code(400).send({
            success: false,
            message:
              parsed.error.issues[0]?.message || "Invalid password payload",
          });
        }

        const { currentPassword, newPassword } = parsed.data;

        if (currentPassword === newPassword) {
          return reply.code(400).send({
            success: false,
            message: "New password must be different from current password",
          });
        }

        const user = await prisma.userAccount.findUnique({
          where: { id: userId },
        });

        if (!user || user.status !== "ACTIVE" || user.isDeleted) {
          return reply.code(404).send({
            success: false,
            message: "User not found",
          });
        }

        const isValid = await bcrypt.compare(
          currentPassword,
          user.passwordHash,
        );
        if (!isValid) {
          return reply.code(400).send({
            success: false,
            message: "Current password is incorrect",
          });
        }

        const passwordHash = await bcrypt.hash(newPassword, 12);

        await prisma.userAccount.update({
          where: { id: user.id },
          data: { passwordHash },
        });

        await prisma.passwordResetToken.updateMany({
          where: {
            userId: user.id,
            usedAt: null,
          },
          data: {
            usedAt: new Date(),
          },
        });

        return reply.send({
          success: true,
          message: "Password changed successfully",
        });
      } catch (error) {
        fastify.log.error(
          { error: error.message },
          "Co-broker change password error",
        );

        return reply.code(500).send({
          success: false,
          message: "Unable to change password",
        });
      }
    },
  );
}

module.exports = changePasswordRoutes;
