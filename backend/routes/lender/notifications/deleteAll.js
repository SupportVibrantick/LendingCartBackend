async function deleteAllLenderNotifications(fastify) {
  fastify.delete("/delete-all", async (req, reply) => {
    const prisma = fastify.prisma;

    try {
      if (!req.user || req.user.orgType !== "LENDER") {
        return reply.code(403).send({
          success: false,
          message: "Lender access only"
        });
      }

      const result = await prisma.notification.updateMany({
        where: {
          deletedAt: null,
          recipientType: "LENDER",
          OR: [
            { recipientOrgId: req.user.organizationId },
            { recipientUserId: req.user.id }
          ]
        },
        data: {
          deletedAt: new Date()
        }
      });

      return reply.send({
        success: true,
        message: "All notifications deleted",
        deletedCount: result.count
      });

    } catch (error) {
      fastify.log.error(error);

      return reply.code(500).send({
        success: false,
        message: "Failed to delete notifications"
      });
    }
  });
}

module.exports = deleteAllLenderNotifications;