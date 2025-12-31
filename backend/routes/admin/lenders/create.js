// routes/admin/lenders/create.js
const { adminLogs } = require("../../../services/logger/contextLogger.js");
const { createLenderSchema } = require("../../../schemas/admin/lenders/create.schema.js");
const bcrypt = require("bcrypt");

// Mail + Kafka (same pattern as brokers)
const { loadTemplate } = require("../../../utils/loadTemplate");
const sendMail = require("../../../services/mail");
const { sendEmailUsingKafka } = require("../../../services/kafka/email/producer.js");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function createLenderRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Admin -> Lenders"], // <-- Swagger grouping
        summary: "Create a lender organization with admin user",
        description:
          "Creates a LENDER organization, an associated admin user, and optionally links it to a broker via BrokerLenderAccess.",
        body: {
          type: "object",
          required: [
            "organizationName",
            "organizationEmail",
            "organizationPhone",
            "adminFirstName",
            "adminLastName",
            "adminEmail",
            "adminPassword",
          ],
          properties: {
            organizationName: { type: "string" },
            organizationEmail: { type: "string", format: "email" },
            organizationPhone: { type: "string" },
            adminFirstName: { type: "string" },
            adminLastName: { type: "string" },
            adminEmail: { type: "string", format: "email" },
            adminPassword: { type: "string" },

            // Optional: link this lender to a broker immediately
            // - can be "any broker" chosen by a platform admin
            // - or the caller's own brokerOrgId (i.e. "assign to himself")
            brokerOrgId: { type: "string", format: "uuid", nullable: true },
          },
        },
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;
      try {
        // Validate with Zod
        const validation = createLenderSchema.safeParse(request.body);

        if (!validation.success) {
          adminLogs.error("Invalid lender creation payload", validation.error);

          return reply.status(400).send({
            success: false,
            message: "Invalid input data for creating lender.",
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
          brokerOrgId,
        } = validation.data;

        // ---- DUPLICATE CHECKS ----

        // Check duplicate organization (name/email/phone)
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

        // Check duplicate admin user email
        const existingUser = await prisma.userAccount.findFirst({
          where: { email: adminEmail },
        });

        if (existingUser) {
          return reply.status(409).send({
            success: false,
            message: "Admin email already in use.",
          });
        }

        // If brokerOrgId is supplied, ensure that broker organization exists and is of type BROKER
        let brokerOrg = null;
        if (brokerOrgId) {
          brokerOrg = await prisma.organization.findFirst({
            where: {
              id: brokerOrgId,
              type: "BROKER",
              isDeleted: { not: true },
            },
          });

          if (!brokerOrg) {
            return reply.status(400).send({
              success: false,
              message:
                "Invalid brokerOrgId. Broker organization not found or not active.",
            });
          }
        }

        // ---- HASH PASSWORD ----
        const passwordHash = await bcrypt.hash(adminPassword, 10);

        let newLenderOrg;
        let newAdmin;
        let brokerAccessCreated = false;

        // ---- TRANSACTION ----
        await prisma.$transaction(async (tx) => {
          // 1) Create LENDER Organization
          newLenderOrg = await tx.organization.create({
            data: {
              name: organizationName,
              type: "LENDER",
              status: "ACTIVE",
              email: organizationEmail,
              phone: organizationPhone,
            },
          });

          // 2) Create Admin User for this LENDER
          newAdmin = await tx.userAccount.create({
            data: {
              organizationId: newLenderOrg.id,
              email: adminEmail,
              passwordHash,
              firstName: adminFirstName,
              lastName: adminLastName,
              status: "ACTIVE",
            },
          });

          // 3) Assign LENDER_ADMIN role
          const role = await tx.role.findFirst({
            where: { name: "LENDER_ADMIN" },
          });
          if (!role) throw new Error("LENDER_ADMIN role missing");

          await tx.userRole.create({
            data: {
              userId: newAdmin.id,
              roleId: role.id,
            },
          });

          // 4) Optionally create BrokerLenderAccess if brokerOrgId is provided
          if (brokerOrg) {
            // Check if access already exists (defensive)
            const existingAccess = await tx.brokerLenderAccess.findFirst({
              where: {
                brokerOrgId: brokerOrg.id,
                lenderOrgId: newLenderOrg.id,
              },
            });

            if (!existingAccess) {
              await tx.brokerLenderAccess.create({
                data: {
                  brokerOrgId: brokerOrg.id,
                  lenderOrgId: newLenderOrg.id,
                  // Since this is an admin route, we treat it as PLATFORM_DEFAULT.
                  // If you later add a broker-side route, use BROKER_ADDED there.
                  source: "PLATFORM_DEFAULT",
                  isActive: true,
                },
              });
            }

            brokerAccessCreated = true;
          }
        });

        adminLogs.info("Lender organization created", {
          organizationId: newLenderOrg.id,
          adminUserId: newAdmin.id,
          brokerOrgId: brokerOrgId || null,
          brokerAccessCreated,
        });

        // -----------------------------
        // 📧 SEND EMAIL (AFTER SUCCESS)
        // -----------------------------
        try {
          const apiBase = process.env.VITE_API_BASE || process.env.APP_URL;

          const html = loadTemplate("admin/lender/create", {
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
            loginUrl: `${apiBase}/lender/login`,
          });

          const subject = "Your Lender Account Has Been Created";
          const text = `Hello ${adminFirstName}, your lender account is ready.`;

          // Try via Kafka first
          try {
            await sendEmailUsingKafka(adminEmail, subject, text, html);

            adminLogs.info("Lender creation email queued via Kafka", {
              to: adminEmail,
            });
          } catch (kafkaErr) {
            adminLogs.error(
              "Kafka email queue failed for lender email, falling back to direct SMTP",
              kafkaErr
            );

            await sendMail({
              to: adminEmail,
              subject,
              text,
              html,
            });

            adminLogs.info("Fallback SMTP lender email sent directly", {
              to: adminEmail,
            });
          }
        } catch (mailErr) {
          adminLogs.error("Lender created but all email attempts failed", mailErr);
        }

        return reply.status(201).send({
          success: true,
          message: "Lender created successfully.",
          data: {
            organizationId: newLenderOrg.id,
            adminUserId: newAdmin.id,
            brokerAccessCreated,
          },
        });
      } catch (error) {
        adminLogs.error("Lender creation failed", error);

        return reply.status(500).send({
          success: false,
          message: "Server error occurred while creating lender.",
          details:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    }
  );
}

module.exports = createLenderRoutes;
