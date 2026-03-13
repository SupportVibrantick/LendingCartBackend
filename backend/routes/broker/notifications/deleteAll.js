/**
 * @param {import("fastify").FastifyInstance} fastify
 */

async function deleteAllBrokerNotifications(fastify) {

  fastify.delete(
    "/delete-all",
    {
      schema: {
        tags: ["Broker -> Notifications"],
        summary: "Delete all broker notifications"
      }
    },
    async (req, reply) => {

      const prisma = fastify.prisma;

      try {

        /* =========================
           AUTHORIZATION
        ========================= */

        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only"
          });
        }

        const orgId = req.user.organizationId;
        const userId = req.user.id;

        if (!orgId && !userId) {
          return reply.code(400).send({
            success: false,
            message: "Invalid user context"
          });
        }

        /* =========================
           DELETE (SOFT DELETE)
        ========================= */

        const result = await prisma.notification.updateMany({
          where: {
            deletedAt: null,
            OR: [
              { recipientOrgId: orgId },
              { recipientUserId: userId }
            ]
          },
          data: {
            deletedAt: new Date()
          }
        });

        /* =========================
           RESPONSE
        ========================= */

        return reply.send({
          success: true,
          message: "All notifications deleted",
          deletedCount: result.count
        });

      } catch (error) {

        fastify.log.error({
          error: error.message,
          stack: error.stack
        });

        return reply.code(500).send({
          success: false,
          message: "Failed to delete notifications"
        });

      }

    }
  );
}

module.exports = deleteAllBrokerNotifications;