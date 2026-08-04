const { logAudit } = require("../../../services/logger/auditLogger");

module.exports = async function subBrokerDeleteContactRoute(fastify) {
  fastify.delete(
    "/:id",
    {
      schema: {
        tags: ["Sub Broker -> Contacts"],
        summary: "Delete contact (soft delete)",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const brokerOrgId = req.user.organizationId;
        const userId = req.user.id || req.user.userId;
        const contactId = req.params.id;

        if (!brokerOrgId || !userId) {
          return reply.code(403).send({
            success: false,
            message: "Unauthorized access",
          });
        }

        const contact = await prisma.contact.findFirst({
          where: {
            id: contactId,
            brokerOrgId,
            createdById: userId,
            isDeleted: false,
          },
        });

        if (!contact) {
          return reply.code(404).send({
            success: false,
            message: "Contact not found",
          });
        }

        const deletedContact = await prisma.contact.update({
          where: { id: contactId },
          data: {
            isDeleted: true,
            deletedAt: new Date(),
          },
        });

        await logAudit({
          prisma,
          req,
          dashboard: "BROKER",
          category: "USER_MANAGEMENT",
          entityType: "Contact",
          entityId: deletedContact.id,
          action: "DELETE_CONTACT",
          oldValue: contact,
        });

        return reply.send({
          success: true,
          message: "Contact deleted successfully",
        });
      } catch (error) {
        fastify.log.error({
          error: error.message,
          stack: error.stack,
        });

        return reply.code(500).send({
          success: false,
          message: "Internal server error while deleting contact",
        });
      }
    },
  );
};
