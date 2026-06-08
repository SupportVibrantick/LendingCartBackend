const { logAudit } = require("../../../services/logger/auditLogger");

module.exports = async function deleteContactRoutes(fastify) {
  fastify.delete(
    "/:id",
    {
      schema: {
        tags: ["Broker -> Contacts"],
        summary: "Delete contact (soft delete)"
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
          if (!req.user.roles?.includes("BROKER_OFFICER")) {
            return reply.code(403).send({
              success: false,
              message: "Only Broker Admin or Loan Officer can delete contacts",
            });
          }
        }

        const brokerOrgId = req.user.organizationId;
        const userId = req.user.id || req.user.userId;
        const contactId = req.params.id;

        /* ================= FIND CONTACT ================= */

        const contact = await prisma.contact.findFirst({
          where: {
            id: contactId,
            brokerOrgId,
            ...(req.user.roles?.includes("BROKER_OFFICER") && {
              createdById: userId,
            }),
            isDeleted: false,
          },
        });

        if (!contact) {
          return reply.code(404).send({
            success: false,
            message: "Contact not found"
          });
        }

        /* ================= SOFT DELETE ================= */

        const deletedContact = await prisma.contact.update({
          where: { id: contactId },
          data: {
            isDeleted: true,
            deletedAt: new Date()
          }
        });

        /* ================= AUDIT LOG ================= */

        await logAudit({
          prisma,
          req,
          dashboard: "BROKER",
          category: "USER_MANAGEMENT",
          entityType: "Contact",
          entityId: deletedContact.id,
          action: "DELETE_CONTACT",
          oldValue: contact
        });

        /* ================= RESPONSE ================= */

        return reply.send({
          success: true,
          message: "Contact deleted successfully"
        });

      } catch (error) {
        fastify.log.error({
          error: error.message,
          stack: error.stack
        });

        return reply.code(500).send({
          success: false,
          message: "Internal server error while deleting contact"
        });
      }
    }
  );
};