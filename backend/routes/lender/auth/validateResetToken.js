const { LENDER_PORTAL_ROLES } = require("../../../utils/lenderTeamRoles");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function lenderValidateResetTokenRoutes(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Lender -> Auth"],
        summary: "Validate lender password reset token",
        querystring: {
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
        const { token } = req.query;

        if (!token?.trim()) {
          return reply.code(400).send({
            success: false,
            message: "Reset token is required",
          });
        }

        const tokenRecord = await prisma.passwordResetToken.findFirst({
          where: {
            token: token.trim(),
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

        const user = tokenRecord?.user;
        const roles = user?.roles?.map((entry) => entry.role.name) || [];
        const hasLenderAccess = roles.some((role) =>
          LENDER_PORTAL_ROLES.includes(role),
        );

        if (
          !tokenRecord ||
          !user ||
          user.status !== "ACTIVE" ||
          user.isDeleted ||
          !user.organization ||
          user.organization.type !== "LENDER" ||
          user.organization.status !== "ACTIVE" ||
          !hasLenderAccess
        ) {
          return reply.send({
            success: true,
            data: {
              valid: false,
            },
          });
        }

        return reply.send({
          success: true,
          data: {
            valid: true,
            email: user.email,
          },
        });
      } catch (error) {
        fastify.log.error(
          { error: error.message },
          "Lender validate reset token error",
        );

        return reply.code(500).send({
          success: false,
          message: "Unable to validate reset link",
        });
      }
    },
  );
}

module.exports = lenderValidateResetTokenRoutes;
