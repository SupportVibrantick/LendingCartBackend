// backend/routes/broker/users/status.js
const { DashboardType, LogCategory } = require("@prisma/client");

module.exports = async function updateBrokerUserStatus(fastify) {
  fastify.patch(
    "/:id/status",
    {
      schema: {
        tags: ["Broker -> Users"],
        summary: "Update loan officer status",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          required: ["status"],
          properties: {
            status: {
              type: "string",
              enum: ["ACTIVE", "DISABLED"],
            },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { id } = req.params;
      const { status } = req.body;

      try {
        /* ================================
           1️⃣ AUTHORIZATION
        ================================= */

        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        if (!req.user.roles?.includes("BROKER_ADMIN")) {
          return reply.code(403).send({
            success: false,
            message: "Only Broker Admin can update status",
          });
        }

        const brokerOrgId = req.user.organizationId;

        /* ================================
           2️⃣ FETCH USER
        ================================= */

        const user = await prisma.userAccount.findUnique({
          where: { id },
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
            message: "You cannot update users from another organization",
          });
        }

        if (user.id === req.user.id) {
          return reply.code(400).send({
            success: false,
            message: "You cannot disable yourself",
          });
        }

        /* ================================
           3️⃣ UPDATE STATUS
        ================================= */

        await prisma.userAccount.update({
          where: { id },
          data: { status },
        });

        /* ================================
           4️⃣ AUDIT LOG
        ================================= */

        await prisma.auditLog.create({
          data: {
            actorUserId: req.user.id,
            actorOrgId: brokerOrgId,

            dashboard: DashboardType.BROKER,
            category: LogCategory.USER_MANAGEMENT,

            entityType: "UserAccount",
            entityId: id,
            action: `UPDATE_STATUS_${status}`,
          },
        });

        return reply.send({
          success: true,
          message: `User status updated to ${status}`,
        });
      } catch (error) {
        fastify.log.error(
          { error: error.message, userId: id },
          "Update user status failed",
        );

        return reply.code(500).send({
          success: false,
          message: error.message || "Internal server error",
        });
      }
    },
  );
};
