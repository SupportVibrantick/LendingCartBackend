const { logAudit } = require("../../../services/logger/auditLogger");
const { officerPreHandler } = require("../../../services/broker/loanOfficerAccess");

module.exports = async function createContactRoutes(fastify) {
  fastify.post(
    "/create",
    {
      preHandler: officerPreHandler(fastify, "CREATE_CONTACTS"),
      schema: {
        tags: ["Broker -> Contacts"],
        summary: "Create Contact"
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
              message: "Only Broker Admin or Loan Officer can create contacts",
            });
          }
        }

        const brokerOrgId = req.user.organizationId;
        const createdById = req.user.id;

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

        /* ================= VALIDATION ================= */

        if (!contactType) {
          return reply.code(400).send({
            success: false,
            message: "Contact type is required"
          });
        }

        /* ================= CREATE CONTACT ================= */

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
          entityId: contact.id,
          action: "CREATE_CONTACT",
          newValue: {
            contactType,
            firstName,
            lastName,
            email
          }
        });

        /* ================= SUCCESS ================= */

        return reply.code(201).send({
          success: true,
          message: "Contact created successfully",
          data: contact
        });

      } catch (error) {
        fastify.log.error({
          error: error.message,
          stack: error.stack
        });

        return reply.code(500).send({
          success: false,
          message: "Internal server error while creating contact"
        });
      }
    }
  );
};