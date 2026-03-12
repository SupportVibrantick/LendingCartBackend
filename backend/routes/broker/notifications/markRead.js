async function markBrokerNotificationRead(fastify) {

  fastify.patch("/:id/read", async (req, reply) => {

    const prisma = fastify.prisma;

    try {

      const { id } = req.params;

      await prisma.notification.update({
        where: { id },
        data: {
          isRead: true,
          readAt: new Date()
        }
      });

      return reply.send({
        success: true,
        message: "Notification marked as read"
      });

    } catch (error) {

      fastify.log.error(error);

      return reply.code(500).send({
        success: false,
        message: "Failed to update notification"
      });

    }

  });

}

module.exports = markBrokerNotificationRead;