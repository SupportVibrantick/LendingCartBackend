const { logAudit } = require("../../../services/logger/auditLogger");
const { isLenderAdmin } = require("../../../utils/lenderTeamRoles");

module.exports = async function deleteLenderUser(fastify) {
  fastify.delete(
    "/:id",
    {
      schema: {
        tags: ["Lender -> Team Members"],
        summary: "Remove lender team member",
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
      const { id } = req.params;

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
            message: "Only lender admins can remove team members",
          });
        }

        const lenderOrgId = req.user.organizationId;
        const currentUserId = req.user.userId || req.user.id;

        if (id === currentUserId) {
          return reply.code(400).send({
            success: false,
            message: "You cannot remove yourself",
          });
        }

        const user = await prisma.userAccount.findUnique({
          where: { id },
          include: {
            roles: {
              include: { role: true },
            },
          },
        });

        if (!user || user.isDeleted) {
          return reply.code(404).send({
            success: false,
            message: "Team member not found",
          });
        }

        if (user.organizationId !== lenderOrgId) {
          return reply.code(403).send({
            success: false,
            message: "Cannot remove a user from another organization",
          });
        }

        await prisma.$transaction([
          prisma.userRole.deleteMany({ where: { userId: id } }),
          prisma.userPermission.deleteMany({ where: { userId: id } }),
          prisma.userAccount.update({
            where: { id },
            data: {
              isDeleted: true,
              deletedAt: new Date(),
              status: "DISABLED",
            },
          }),
        ]);

        await logAudit({
          prisma,
          req,
          dashboard: "LENDER",
          category: "USER_MANAGEMENT",
          entityType: "UserAccount",
          entityId: id,
          action: "DELETE_LENDER_TEAM_MEMBER",
          oldValue: {
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            roles: user.roles.map((entry) => entry.role.name),
          },
        });

        return reply.send({
          success: true,
          message: "Team member removed successfully",
        });
      } catch (error) {
        fastify.log.error(error, "Failed to delete lender team member");

        return reply.code(500).send({
          success: false,
          message: "Failed to remove team member",
        });
      }
    },
  );
};
