async function deleteBrokerNotification(fastify) {

  fastify.delete("/:id", async (req, reply) => {

    const prisma = fastify.prisma;

    try {

      const { id } = req.params;

      await prisma.notification.update({
        where: { id },
        data: {
          deletedAt: new Date()
        }
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

module.exports = deleteBrokerNotification;