async function markAllLenderNotificationsRead(fastify) {
  fastify.patch("/read-all", async (req, reply) => {
    const prisma = fastify.prisma;

    try {
      if (!req.user || req.user.orgType !== "LENDER") {
        return reply.code(403).send({
          success: false,
          message: "Lender access only"
        });
      }

      await prisma.notification.updateMany({
        where: {
          deletedAt: null,
          recipientType: "LENDER",
          OR: [
            { recipientOrgId: req.user.organizationId },
            { recipientUserId: req.user.id }
          ],
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

module.exports = markAllLenderNotificationsRead;