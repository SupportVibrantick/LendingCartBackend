const { logAudit } = require("../../../services/logger/auditLogger");
const {
  isLenderAdmin,
  LENDER_TEAM_ASSIGNABLE_ROLES,
} = require("../../../utils/lenderTeamRoles");
const {
  ensureLenderTeamRole,
} = require("../../../services/ensureLenderTeamRole");

module.exports = async function updateLenderUser(fastify) {
  fastify.put(
    "/:id",
    {
      schema: {
        tags: ["Lender -> Team Members"],
        summary: "Update lender team member",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          properties: {
            firstName: { type: "string", minLength: 1 },
            lastName: { type: "string", minLength: 1 },
            role: {
              type: "string",
              enum: LENDER_TEAM_ASSIGNABLE_ROLES,
            },
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
            message: "Only lender admins can update team members",
          });
        }

        const lenderOrgId = req.user.organizationId;
        const { firstName, lastName, role } = req.body;

        const existingUser = await prisma.userAccount.findUnique({
          where: { id },
          include: {
            roles: {
              include: { role: true },
            },
          },
        });

        if (!existingUser || existingUser.isDeleted) {
          return reply.code(404).send({
            success: false,
            message: "Team member not found",
          });
        }

        if (existingUser.organizationId !== lenderOrgId) {
          return reply.code(403).send({
            success: false,
            message: "Cannot update a user from another organization",
          });
        }

        const currentRole = existingUser.roles[0]?.role?.name || null;
        const currentUserId = req.user.userId || req.user.id;

        if (
          existingUser.id === currentUserId &&
          role &&
          role !== "LENDER_ADMIN" &&
          currentRole === "LENDER_ADMIN"
        ) {
          return reply.code(400).send({
            success: false,
            message: "You cannot remove your own admin access",
          });
        }

        let roleRecord = null;
        if (role) {
          roleRecord = await ensureLenderTeamRole(prisma, role);
        }

        await prisma.$transaction(async (tx) => {
          await tx.userAccount.update({
            where: { id },
            data: {
              ...(firstName !== undefined
                ? { firstName: String(firstName).trim() }
                : {}),
              ...(lastName !== undefined
                ? { lastName: String(lastName).trim() }
                : {}),
            },
          });

          if (role && roleRecord?.id) {
            await tx.userRole.deleteMany({ where: { userId: id } });
            await tx.userRole.create({
              data: {
                userId: id,
                roleId: roleRecord.id,
              },
            });
          }
        });

        await logAudit({
          prisma,
          req,
          dashboard: "LENDER",
          category: "USER_MANAGEMENT",
          entityType: "UserAccount",
          entityId: id,
          action: "UPDATE_LENDER_TEAM_MEMBER",
          newValue: { firstName, lastName, role },
        });

        return reply.send({
          success: true,
          message: "Team member updated successfully",
        });
      } catch (error) {
        if (error.message === "ROLE_NOT_FOUND") {
          return reply.code(400).send({
            success: false,
            message: "Selected role is not configured",
          });
        }

        fastify.log.error(error, "Failed to update lender team member");

        return reply.code(500).send({
          success: false,
          message: "Failed to update team member",
        });
      }
    },
  );
};
