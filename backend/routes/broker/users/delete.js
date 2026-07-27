const { logAudit } = require("../../../services/logger/auditLogger");

module.exports = async function deleteBrokerUser(fastify) {
  fastify.delete(
    "/:id",
    {
      schema: {
        tags: ["Broker -> Users"],
        summary: "Permanently delete loan officer",
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
        // AUTHORIZATION

        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        if (!req.user.roles?.includes("BROKER_ADMIN")) {
          return reply.code(403).send({
            success: false,
            message: "Only Broker Admin can delete users",
          });
        }

        const brokerOrgId = req.user.organizationId;

        // FETCH USER

        const user = await prisma.userAccount.findUnique({
          where: { id },
          include: {
            roles: {
              include: { role: true },
            },
          },
        });

        if (!user) {
          return reply.code(404).send({
            success: false,
            message: "User not found",
          });
        }

        if (user.organizationId !== brokerOrgId) {
          return reply.code(403).send({
            success: false,
            message: "You cannot delete users from another organization",
          });
        }

        if (user.id === req.user.id) {
          return reply.code(400).send({
            success: false,
            message: "You cannot delete yourself",
          });
        }

        // PERMANENT DELETE (TRANSACTION)

        await prisma.$transaction([
          // Delete user permissions
          prisma.userPermission.deleteMany({
            where: { userId: id },
          }),

          // Delete user roles
          prisma.userRole.deleteMany({
            where: { userId: id },
          }),

          // Delete broker profile
          prisma.brokerUserProfile.deleteMany({
            where: { userId: id },
          }),

          // Delete user account
          prisma.userAccount.delete({
            where: { id },
          }),
        ]);

        // AUDIT LOG (Central Logger)

        await logAudit({
          prisma,
          req,
          dashboard: "BROKER",
          category: "USER_MANAGEMENT",
          entityType: "UserAccount",
          entityId: id,
          action: "PERMANENT_DELETE_USER",
          oldValue: {
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            roles: user.roles.map((r) => r.role.name),
          },
        });

        return reply.send({
          success: true,
          message: "User permanently deleted",
        });
      } catch (error) {
        fastify.log.error(
          {
            error,
            userId: id,
          },
          "Delete broker user failed",
        );

        return reply.code(500).send({
          success: false,
          message: error.message,
        });
      }
    },
  );
};
