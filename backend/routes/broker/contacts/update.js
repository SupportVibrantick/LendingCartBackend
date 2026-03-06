const { logAudit } = require("../../../services/logger/auditLogger");

module.exports = async function updateContactRoutes(fastify) {
  fastify.patch(
    "/:id/update",
    {
      schema: {
        tags: ["Broker -> Contacts"],
        summary: "Update contact"
      }
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /* ================= AUTHORIZATION ================= */

        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only"
          });
        }

        if (!req.user.roles?.includes("BROKER_ADMIN")) {
          return reply.code(403).send({
            success: false,
            message: "Only Broker Admin can update contacts"
          });
        }

        const brokerOrgId = req.user.organizationId;
        const contactId = req.params.id;

        /* ================= FIND CONTACT ================= */

        const existingContact = await prisma.contact.findFirst({
          where: {
            id: contactId,
            brokerOrgId,
            isDeleted: false
          }
        });

        if (!existingContact) {
          return reply.code(404).send({
            success: false,
            message: "Contact not found"
          });
        }

        /* ================= BODY ================= */

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
          description
        } = req.body;

        /* ================= UPDATE ================= */

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
            description
          }
        });

        /* ================= AUDIT LOG ================= */

        await logAudit({
          prisma,
          req,
          dashboard: "BROKER",
          category: "USER_MANAGEMENT",
          entityType: "Contact",
          entityId: updatedContact.id,
          action: "UPDATE_CONTACT",
          oldValue: existingContact,
          newValue: updatedContact
        });

        /* ================= RESPONSE ================= */

        return reply.send({
          success: true,
          message: "Contact updated successfully",
          data: updatedContact
        });

      } catch (error) {
        fastify.log.error({
          error: error.message,
          stack: error.stack
        });

        return reply.code(500).send({
          success: false,
          message: "Internal server error while updating contact"
        });
      }
    }
  );
};