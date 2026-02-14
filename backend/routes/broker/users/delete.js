// backend/routes/broker/users/delete.js

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
            message: "Only Broker Admin can delete users",
          });
        }

        const brokerOrgId = req.user.organizationId;

        /* ================================
           2️⃣ FETCH USER
        ================================= */

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

        /* ================================
           3️⃣ PERMANENT DELETE (TRANSACTION)
        ================================= */

        await prisma.$transaction([
          prisma.userRole.deleteMany({
            where: { userId: id },
          }),
          prisma.userAccount.delete({
            where: { id },
          }),
        ]);

        /* ================================
           4️⃣ AUDIT LOG
        ================================= */

        await prisma.auditLog.create({
          data: {
            actorUserId: req.user.id,
            actorOrgId: brokerOrgId,
            entityType: "UserAccount",
            entityId: id,
            action: "PERMANENT_DELETE_USER",
          },
        });

        return reply.send({
          success: true,
          message: "User permanently deleted",
        });
      } catch (error) {
        fastify.log.error(
          { error: error.message, userId: id },
          "Delete broker user failed"
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    }
  );
};