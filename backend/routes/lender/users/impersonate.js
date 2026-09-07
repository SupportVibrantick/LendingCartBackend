const jwt = require("jsonwebtoken");
const jwtSecret = require("../../../utils/auth/jwtSecret");
const {
  isLenderAdmin,
  isLenderPortalRole,
  formatLenderRoleLabel,
} = require("../../../utils/lender/lenderTeamRoles");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function impersonateLenderTeamMemberRoute(fastify) {
  fastify.post(
    "/:id/impersonate",
    {
      schema: {
        tags: ["Lender -> Team Members"],
        summary: "Access a team member portal session (lender admin only)",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
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

        if (!isLenderAdmin(req.user)) {
          return reply.code(403).send({
            success: false,
            message: "Only lender admins can access team member dashboards",
          });
        }

        if (req.user.impersonatedBy) {
          return reply.code(400).send({
            success: false,
            message: "Exit the current view mode first",
          });
        }

        const adminUserId = req.user.userId || req.user.id;
        const lenderOrgId = req.user.organizationId;
        const { id: targetUserId } = req.params;

        if (targetUserId === adminUserId) {
          return reply.code(400).send({
            success: false,
            message: "You are already signed in as this user",
          });
        }

        const targetUser = await prisma.userAccount.findFirst({
          where: {
            id: targetUserId,
            organizationId: lenderOrgId,
            isDeleted: false,
            status: "ACTIVE",
          },
          include: {
            organization: {
              select: { id: true, name: true, type: true, status: true },
            },
            roles: {
              include: { role: { select: { name: true } } },
            },
          },
        });

        if (!targetUser) {
          return reply.code(404).send({
            success: false,
            message: "Active team member not found",
          });
        }

        if (
          !targetUser.organization ||
          targetUser.organization.type !== "LENDER" ||
          targetUser.organization.status !== "ACTIVE"
        ) {
          return reply.code(403).send({
            success: false,
            message: "Invalid lender organization",
          });
        }

        const roles = targetUser.roles
          .map((r) => r.role?.name)
          .filter((name) => name && isLenderPortalRole(name));

        if (!roles.length) {
          return reply.code(400).send({
            success: false,
            message: "Team member has no lender portal role assigned",
          });
        }

        const token = jwt.sign(
          {
            id: targetUser.id,
            organizationId: targetUser.organizationId,
            orgType: "LENDER",
            roles,
            email: targetUser.email,
            impersonatedBy: adminUserId,
          },
          jwtSecret,
          {
            expiresIn: "2h",
            issuer: "lendingcart",
            audience: "lender-app",
          },
        );

        fastify.log.info(
          {
            adminUserId,
            lenderOrgId,
            targetUserId: targetUser.id,
            targetRoles: roles,
          },
          "Lender admin accessed team member dashboard",
        );

        return reply.send({
          success: true,
          token,
          roles,
          user: {
            id: targetUser.id,
            email: targetUser.email,
            firstName: targetUser.firstName,
            lastName: targetUser.lastName,
            name: `${targetUser.firstName || ""} ${targetUser.lastName || ""}`.trim(),
            organizationId: targetUser.organizationId,
            organizationName: targetUser.organization?.name || null,
            roles,
            roleLabel: formatLenderRoleLabel(roles[0]),
          },
          redirectTo: "/",
        });
      } catch (error) {
        fastify.log.error(
          { error: error.message, route: "impersonate-lender-team-member" },
          "Lender team member access failed",
        );

        return reply.code(500).send({
          success: false,
          message: "Failed to access team member dashboard",
        });
      }
    },
  );
};
