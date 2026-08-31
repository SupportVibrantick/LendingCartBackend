const bcrypt = require("bcrypt");
const {
  LENDER_PORTAL_ROLES,
} = require("../../../utils/lender/lenderTeamRoles");
const {
  lenderResetPasswordSchema,
} = require("../../../schemas/lender/auth/resetPassword.schema");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function lenderResetPasswordRoutes(fastify) {
  fastify.post(
    "/",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "15 minute",
          errorResponseBuilder: (request, context) => {
            return {
              statusCode: 429,
              error: "Too Many Requests",
              success: false,
              message: "Too many login attempts. Please try again after 15 minutes.",
            };
          },
        },
      },
      schema: {
        tags: ["Lender -> Auth"],
        summary: "Reset lender portal password using token",
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
        const parsed = lenderResetPasswordSchema.safeParse(req.body);
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
                roles: {
                  include: { role: true },
                },
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
        const roles = user.roles.map((entry) => entry.role.name);
        const hasLenderAccess = roles.some((role) =>
          LENDER_PORTAL_ROLES.includes(role),
        );

        if (
          user.status !== "ACTIVE" ||
          user.isDeleted ||
          !user.organization ||
          user.organization.type !== "LENDER" ||
          user.organization.status !== "ACTIVE" ||
          !hasLenderAccess
        ) {
          return reply.code(400).send({
            success: false,
            message: "Invalid or expired reset link",
          });
        }

        const passwordHash = await bcrypt.hash(password, 12);

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
          "Lender reset password error",
        );

        return reply.code(500).send({
          success: false,
          message: "Unable to reset password",
        });
      }
    },
  );
}

module.exports = lenderResetPasswordRoutes;
