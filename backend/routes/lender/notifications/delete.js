async function deleteLenderNotification(fastify) {
  fastify.delete("/:id", async (req, reply) => {
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
        data: { deletedAt: new Date() }
      });

      return reply.send({
        success: true,
        message: "Notification deleted"
      });

    } catch (error) {
      fastify.log.error(error);

      return reply.code(500).send({
        success: false,
        message: "Failed to delete notification"
      });
    }
  });
}

module.exports = deleteLenderNotification;