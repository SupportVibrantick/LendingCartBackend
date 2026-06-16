const { getClientFromRequest } = require("../../../utils/clientPortalAuth");

async function markAllClientNotificationsRead(fastify) {
  fastify.patch("/read-all", async (req, reply) => {
    const prisma = fastify.prisma;

    try {
      const auth = getClientFromRequest(req);
      if (auth.error) {
        return reply.code(auth.error.code).send({
          success: false,
          message: auth.error.message,
        });
      }

      await prisma.notification.updateMany({
        where: {
          recipientClientId: auth.clientId,
          isRead: false,
          deletedAt: null,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      return reply.send({
        success: true,
        message: "All notifications marked as read",
      });
    } catch (error) {
      fastify.log.error(error);

      return reply.code(500).send({
        success: false,
        message: "Failed to update notifications",
      });
    }
  });
}

module.exports = markAllClientNotificationsRead;
