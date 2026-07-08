const { getClientFromRequest } = require("../../../utils/auth/clientPortalAuth");

async function markClientNotificationRead(fastify) {
  fastify.patch("/:id/read", async (req, reply) => {
    const prisma = fastify.prisma;

    try {
      const auth = getClientFromRequest(req);
      if (auth.error) {
        return reply.code(auth.error.code).send({
          success: false,
          message: auth.error.message,
        });
      }

      const { id } = req.params;

      const existing = await prisma.notification.findFirst({
        where: {
          id,
          recipientClientId: auth.clientId,
          deletedAt: null,
        },
      });

      if (!existing) {
        return reply.code(404).send({
          success: false,
          message: "Notification not found",
        });
      }

      await prisma.notification.update({
        where: { id },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      return reply.send({
        success: true,
        message: "Notification marked as read",
      });
    } catch (error) {
      fastify.log.error(error);

      return reply.code(500).send({
        success: false,
        message: "Failed to update notification",
      });
    }
  });
}

module.exports = markClientNotificationRead;
