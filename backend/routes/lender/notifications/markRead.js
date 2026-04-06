async function markLenderNotificationRead(fastify) {
  fastify.patch("/:id/read", async (req, reply) => {
    const prisma = fastify.prisma;

    try {
      if (!req.user || req.user.orgType !== "LENDER") {
        return reply.code(403).send({
          success: false,
          message: "Lender access only"
        });
      }

      const { id } = req.params;

      const notification = await prisma.notification.findFirst({
        where: {
          id,
          deletedAt: null,
          recipientType: "LENDER",
          OR: [
            { recipientOrgId: req.user.organizationId },
            { recipientUserId: req.user.id }
          ]
        }
      });

      if (!notification) {
        return reply.code(404).send({
          success: false,
          message: "Notification not found"
        });
      }

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

module.exports = markLenderNotificationRead;