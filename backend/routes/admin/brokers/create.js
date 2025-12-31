const { adminLogs } = require("../../../services/logger/contextLogger.js");
const {
  createBrokerSchema,
} = require("../../../schemas/admin/brokers/create.schema.js");
const bcrypt = require("bcrypt");

// Mail + Kafka
const { loadTemplate } = require("../../../utils/loadTemplate");   
const sendMail = require("../../../services/mail");                
const { sendEmailUsingKafka } = require("../../../services/kafka/email/producer.js");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function createBrokerRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Admin -> Brokers"],
        summary: "Create a broker organization with admin user",
        description:
          "Creates a BROKER organization and an associated admin user.",
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;
      try {
        const validation = createBrokerSchema.safeParse(request.body);

        if (!validation.success) {
          adminLogs.error("Invalid broker creation payload", validation.error);

          return reply.status(400).send({
            success: false,
            message: "Invalid input data for creating broker.",
            details:
              process.env.NODE_ENV === "development"
                ? validation.error.issues
                : undefined,
          });
        }

        const {
          organizationName,
          organizationEmail,
          organizationPhone,
          adminFirstName,
          adminLastName,
          adminEmail,
          adminPassword,
        } = validation.data;

        // Duplicate org check
        const existingOrg = await prisma.organization.findFirst({
          where: {
            OR: [
              { name: organizationName },
              { email: organizationEmail },
              { phone: organizationPhone },
            ],
          },
        });

        if (existingOrg) {
          return reply.status(409).send({
            success: false,
            message: "Organization with provided details already exists.",
          });
        }

        // Duplicate admin email
        const existingUser = await prisma.userAccount.findFirst({
          where: { email: adminEmail },
        });

        if (existingUser) {
          return reply.status(409).send({
            success: false,
            message: "Admin email already in use.",
          });
        }

        // Create inside a transaction
        const passwordHash = await bcrypt.hash(adminPassword, 10);
        let newOrganization;
        let newAdmin;

        await prisma.$transaction(async (tx) => {
          // Create Organization
          newOrganization = await tx.organization.create({
            data: {
              name: organizationName,
              type: "BROKER",
              status: "ACTIVE",
              email: organizationEmail,
              phone: organizationPhone,
            },
          });

          // Create Admin User
          newAdmin = await tx.userAccount.create({
            data: {
              organizationId: newOrganization.id,
              email: adminEmail,
              passwordHash,
              firstName: adminFirstName,
              lastName: adminLastName,
              status: "ACTIVE",
            },
          });

          // Assign role
          const role = await tx.role.findFirst({
            where: { name: "BROKER_ADMIN" },
          });

          if (!role) {
            throw new Error("BROKER_ADMIN role missing");
          }

          await tx.userRole.create({
            data: {
              userId: newAdmin.id,
              roleId: role.id,
            },
          });
        });

        adminLogs.info("Broker organization created", {
          organizationId: newOrganization.id,
          adminUserId: newAdmin.id,
        });

        // -----------------------------
        // 📧 SEND EMAIL (AFTER SUCCESS)
        // -----------------------------
        try {
          const apiBase = process.env.VITE_API_BASE || process.env.APP_URL;

const html = loadTemplate("admin/broker/create", {
  name: adminFirstName,
  currentYear: new Date().getFullYear(),

  // Org details
  organizationName,
  organizationEmail,
  organizationPhone,

  // Admin
  adminFirstName,
  adminLastName,
  adminEmail,

  // Logo + links
  apiBase,
  loginUrl: `${apiBase}/broker/login`,
});


          const subject = "Your Broker Account Has Been Created";
          const text = `Hello ${adminFirstName}, your broker account is ready.`;

          //  Try via Kafka first
          try {
            await sendEmailUsingKafka(adminEmail, subject, text, html);

            adminLogs.info("Broker creation email queued via Kafka", {
              to: adminEmail,
            });

            
            
          } catch (kafkaErr) {
            adminLogs.error(
              "Kafka email queue failed, falling back to direct SMTP",
              kafkaErr
            );

           await sendMail({
              to: adminEmail,
              subject,
              text,
              html,
            });

            adminLogs.info("Fallback SMTP email sent directly", {
              to: adminEmail,
            });
          }
        } catch (mailErr) {
          adminLogs.error("Broker created but all email attempts failed", mailErr);
        }

        return reply.status(201).send({
          success: true,
          message: "Broker created successfully.",
          data: {
            organizationId: newOrganization.id,
            adminUserId: newAdmin.id,
          },
        });
      } catch (error) {
        adminLogs.error("Broker creation failed", error);

        return reply.status(500).send({
          success: false,
          message: "Server error occurred while creating broker.",
          details:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    }
  );
}

module.exports = createBrokerRoutes;
