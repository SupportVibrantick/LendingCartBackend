const { logAudit } = require("../../../services/logger/auditLogger");

module.exports = async function subBrokerUpdateContactRoute(fastify) {
  fastify.patch(
    "/:id/update",
    {
      schema: {
        tags: ["Sub Broker -> Contacts"],
        summary: "Update contact",
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

        const existingContact = await prisma.contact.findFirst({
          where: {
            id: contactId,
            brokerOrgId,
            createdById: userId,
            isDeleted: false,
          },
        });

        if (!existingContact) {
          return reply.code(404).send({
            success: false,
            message: "Contact not found",
          });
        }

        const {
          contactType,
          firstName,
          lastName,
          email,
          companyName,
          website,
          phone,
          tollFree,
          cellNumber,
          faxNumber,
          address,
          city,
          state,
          zipCode,
          stateOfFormation,
          entityType,
          description,
        } = req.body;

        const updatedContact = await prisma.contact.update({
          where: { id: contactId },
          data: {
            contactType,
            firstName,
            lastName,
            email,
            companyName,
            website,
            phone,
            tollFree,
            cellNumber,
            faxNumber,
            address,
            city,
            state,
            zipCode,
            stateOfFormation,
            entityType,
            description,
          },
        });

        await logAudit({
          prisma,
          req,
          dashboard: "BROKER",
          category: "USER_MANAGEMENT",
          entityType: "Contact",
          entityId: updatedContact.id,
          action: "UPDATE_CONTACT",
          oldValue: existingContact,
          newValue: updatedContact,
        });

        return reply.send({
          success: true,
          message: "Contact updated successfully",
          data: updatedContact,
        });
      } catch (error) {
        fastify.log.error({
          error: error.message,
          stack: error.stack,
        });

        return reply.code(500).send({
          success: false,
          message: "Internal server error while updating contact",
        });
      }
    },
  );
};
