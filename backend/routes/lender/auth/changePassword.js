const bcrypt = require("bcrypt");
const { LENDER_PORTAL_ROLES } = require("../../../utils/lender/lenderTeamRoles");
const {
  lenderChangePasswordSchema,
} = require("../../../schemas/lender/auth/changePassword.schema");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function lenderChangePasswordRoutes(fastify) {
  fastify.put(
    "/",
    {
      preHandler: fastify.authenticate,
      config: {
        rateLimit: {
          max: 3,
          timeWindow: "15 minutes",
          errorResponseBuilder: () => ({
            statusCode: 429,
            error: "Too Many Requests",
            success: false,
            message: "Too many password change attempts. Please try again later.",
          }),
        },
      },
      schema: {
        tags: ["Lender -> Auth"],
        summary: "Change lender portal password (logged in)",
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
        if (!req.user || req.user.orgType !== "LENDER") {
          return reply.code(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const parsed = lenderChangePasswordSchema.safeParse(req.body);
        if (!parsed.success) {
          return reply.code(400).send({
            success: false,
            message: parsed.error.issues[0]?.message || "Invalid password payload",
          });
        }

        const { currentPassword, newPassword } = parsed.data;

        if (currentPassword === newPassword) {
          return reply.code(400).send({
            success: false,
            message: "New password must be different from current password",
          });
        }

        const userId = req.user.userId || req.user.id;

        const user = await prisma.userAccount.findUnique({
          where: { id: userId },
          include: {
            organization: true,
            roles: {
              include: { role: true },
            },
          },
        });

        if (!user || user.status !== "ACTIVE" || user.isDeleted) {
          return reply.code(404).send({
            success: false,
            message: "User not found",
          });
        }

        if (
          !user.organization ||
          user.organization.type !== "LENDER" ||
          user.organization.status !== "ACTIVE"
        ) {
          return reply.code(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const roles = user.roles.map((entry) => entry.role.name);
        const hasLenderAccess = roles.some((role) =>
          LENDER_PORTAL_ROLES.includes(role),
        );

        if (!hasLenderAccess) {
          return reply.code(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isValid) {
          return reply.code(400).send({
            success: false,
            message: "Current password is incorrect",
          });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);

        await prisma.$transaction(async (tx) => {
          await tx.userAccount.update({
            where: { id: user.id },
            data: { passwordHash },
          });

          await tx.passwordResetToken.updateMany({
            where: {
              userId: user.id,
              usedAt: null,
            },
            data: {
              usedAt: new Date(),
            },
          });
        });

        return reply.send({
          success: true,
          message: "Password changed successfully",
        });
      } catch (error) {
        fastify.log.error({ error: error.message }, "Lender change password error");

        return reply.code(500).send({
          success: false,
          message: "Unable to change password",
        });
      }
    },
  );
}

module.exports = lenderChangePasswordRoutes;
