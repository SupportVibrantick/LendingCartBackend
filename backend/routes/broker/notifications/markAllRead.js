async function markAllBrokerNotificationsRead(fastify) {

  fastify.patch("/read-all", async (req, reply) => {

    const prisma = fastify.prisma;

    try {

      const orgId = req.user.organizationId;

      await prisma.notification.updateMany({
        where: {
          recipientOrgId: orgId,
          isRead: false
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      });

      return reply.send({
        success: true,
        message: "All notifications marked as read"
      });

    } catch (error) {

      fastify.log.error(error);

      return reply.code(500).send({
        success: false,
        message: "Failed to update notifications"
      });

    }

  });

}

module.exports = markAllBrokerNotificationsRead;