// routes/admin/lenders/create.js
const { adminLogs } = require("../../../services/logger/contextLogger.js");
const { createLenderSchema } = require("../../../schemas/admin/lenders/create.schema.js");
const bcrypt = require("bcrypt");

// Mail + Kafka (same pattern as brokers)
const { loadTemplate } = require("../../../utils/email/loadTemplate");
const { buildLenderSignInUrl } = require("../../../utils/email/emailBranding");
const { buildLenderWelcomeEmailData } = require("../../../utils/email/emailTemplateData");
const sendMail = require("../../../services/emails/mail");
const {
  notifyPlatform,
  PLATFORM_NOTIFICATION_EVENTS,
} = require("../../../services/notifications/platformNotifications.js");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function createLenderRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Admin -> Lenders"],
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
            brokerOrgId: { type: "string", format: "uuid", nullable: true },
          },
        },
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;

      try {
        // ---------------------------
        // VALIDATION
        // ---------------------------
        const validation = createLenderSchema.safeParse(request.body);

        if (!validation.success) {
          adminLogs.error("Invalid lender creation payload", validation.error);

          return reply.status(400).send({
            success: false,
            message: "Invalid input data.",
            errors: validation.error.issues.map((err) => ({
              field: err.path[0],
              message: err.message,
            })),
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

        // ---------------------------
        // DUPLICATE CHECKS
        // ---------------------------

        const existingOrgName = await prisma.organization.findFirst({
          where: { name: organizationName },
        });

        if (existingOrgName) {
          return reply.status(409).send({
            success: false,
            message: "Organization name already exists.",
            field: "organizationName",
          });
        }

        const existingOrgEmail = await prisma.organization.findFirst({
          where: { email: organizationEmail },
        });

        if (existingOrgEmail) {
          return reply.status(409).send({
            success: false,
            message: "Organization email already exists.",
            field: "organizationEmail",
          });
        }

        const existingOrgPhone = await prisma.organization.findFirst({
          where: { phone: organizationPhone },
        });

        if (existingOrgPhone) {
          return reply.status(409).send({
            success: false,
            message: "Organization phone number already exists.",
            field: "organizationPhone",
          });
        }

        const existingUser = await prisma.userAccount.findFirst({
          where: { email: adminEmail },
        });

        if (existingUser) {
          return reply.status(409).send({
            success: false,
            message: "Admin email already in use.",
            field: "adminEmail",
          });
        }

        // ---------------------------
        // BROKER VALIDATION
        // ---------------------------
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
                "Invalid brokerOrgId. Broker organization not found or inactive.",
              field: "brokerOrgId",
            });
          }
        }

        // ---------------------------
        // PASSWORD HASH
        // ---------------------------
        const passwordHash = await bcrypt.hash(adminPassword, 10);

        let newLenderOrg;
        let newAdmin;
        let brokerAccessCreated = false;

        // ---------------------------
        // TRANSACTION
        // ---------------------------
        await prisma.$transaction(async (tx) => {
          newLenderOrg = await tx.organization.create({
            data: {
              name: organizationName,
              type: "LENDER",
              status: "ACTIVE",
              email: organizationEmail,
              phone: organizationPhone,
            },
          });

          newAdmin = await tx.userAccount.create({
            data: {
              organizationId: newLenderOrg.id,
              email: adminEmail,
              passwordHash,
              firstName: adminFirstName,
              lastName: adminLastName,
              status: "ACTIVE",
              emailVerifiedAt: new Date(),
            },
          });

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

          if (brokerOrg) {
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

        // ---------------------------
        // EMAIL (UNCHANGED)
        // ---------------------------
        try {
          const html = loadTemplate(
            "admin/lender/create",
            buildLenderWelcomeEmailData({
              name: adminFirstName,
              organizationName,
              organizationEmail: organizationEmail,
              organizationPhone,
              brokerName: brokerOrg?.name || "Your broker",
              adminEmail,
              temporaryPassword: adminPassword,
              loginUrl: buildLenderSignInUrl(),
            }),
          );

          const loginUrl = buildLenderSignInUrl();
          const subject = "Your Lender Account Has Been Created";
          const text = [
            `Hello ${adminFirstName}, your lender account is ready.`,
            "",
            `Login email: ${adminEmail}`,
            `Temporary password: ${adminPassword}`,
            "",
            `Sign in: ${loginUrl}`,
            "",
            "Please change your password after your first login.",
          ].join("\n");

          await sendMail({
            prisma,
            to: adminEmail,
            subject,
            text,
            html,
            idempotencyKey: `admin-lender-create:${newLenderOrg.id}`,
          });

          adminLogs.info("Lender creation email enqueued", {
            to: adminEmail,
          });
        } catch (mailErr) {
          adminLogs.error("Email sending failed after lender creation", mailErr);
        }

        try {
          await notifyPlatform(prisma, fastify.io, {
            platformOrgId: request.user?.organizationId || request.user?.orgId,
            eventType: PLATFORM_NOTIFICATION_EVENTS.LENDER_REGISTERED,
            category: "ORGANIZATION",
            subject: "New lender registered",
            body: `Lender organization "${organizationName}" was created.`,
            metadata: {
              organizationId: newLenderOrg.id,
              organizationName,
              adminEmail,
            },
          });
        } catch (notifyErr) {
          adminLogs.error("Lender creation notification failed", notifyErr);
        }

        // ---------------------------
        //  SUCCESS RESPONSE
        // ---------------------------
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
            process.env.NODE_ENV === "development"
              ? error.message
              : undefined,
        });
      }
    }
  );
}

module.exports = createLenderRoutes;