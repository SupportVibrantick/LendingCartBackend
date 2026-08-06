const { logAudit } = require("../../../services/logger/auditLogger");

module.exports = async function subBrokerCreateContactRoute(fastify) {
  fastify.post(
    "/create",
    {
      schema: {
        tags: ["Sub Broker -> Contacts"],
        summary: "Create contact",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const brokerOrgId = req.user.organizationId;
        const createdById = req.user.id || req.user.userId;

        if (!brokerOrgId || !createdById) {
          return reply.code(403).send({
            success: false,
            message: "Unauthorized access",
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

        if (!contactType) {
          return reply.code(400).send({
            success: false,
            message: "Contact type is required",
          });
        }

        const contact = await prisma.contact.create({
          data: {
            brokerOrgId,
            createdById,
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
          entityId: contact.id,
          action: "CREATE_CONTACT",
          newValue: {
            contactType,
            firstName,
            lastName,
            email,
            createdByRole: "SUB_BROKER",
          },
        });

        return reply.code(201).send({
          success: true,
          message: "Contact created successfully",
          data: contact,
        });
      } catch (error) {
        fastify.log.error({
          error: error.message,
          stack: error.stack,
        });

        return reply.code(500).send({
          success: false,
          message: "Internal server error while creating contact",
        });
      }
    },
  );
};
