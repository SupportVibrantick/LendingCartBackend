const fp = require("fastify-plugin");
const { randomUUID } = require("crypto");
const { logAudit } = require("../../../services/logger/auditLogger");

async function brokerSubmitApplication(fastify) {
  fastify.post(
    "/submit",
    {
      schema: {
        tags: ["Broker -> Applications"],
        summary: "Create Loan Application (Client Pending)"
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

        // 🔥 FIX: normalize userId (CRITICAL)
        const brokerUserId = req.user?.id || req.user?.userId;

        console.log("🔥 Broker User Object:", req.user);
        console.log("🔥 Broker User ID:", brokerUserId);

        if (!brokerUserId) {
          throw new Error("BROKER_ID_MISSING");
        }

        const brokerOrgId = req.user.organizationId;

        /* ================= BODY VALIDATION ================= */

        const { applicationProductId, fields } = req.body;

        if (!applicationProductId || !Array.isArray(fields)) {
          return reply.code(400).send({
            success: false,
            message: "Invalid payload"
          });
        }

        /* ================= VALIDATE PRODUCT ================= */

        const brokerProduct =
          await prisma.brokerApplicationProduct.findFirst({
            where: {
              id: applicationProductId,
              isActive: true,
              brokerApplication: {
                isActive: true,
                brokerOrgId: brokerOrgId
              }
            },
            select: {
              id: true,
              loanProductCode: true
            }
          });

        if (!brokerProduct) {
          return reply.code(404).send({
            success: false,
            message: "Invalid or unauthorized application product"
          });
        }

        /* ================= TRANSACTION ================= */

        const result = await prisma.$transaction(async (tx) => {
          const emailField = fields.find(f => f.fieldKey === "email");
          const firstNameField = fields.find(f => f.fieldKey === "first_name");
          const lastNameField = fields.find(f => f.fieldKey === "last_name");

          if (!emailField?.value) {
            throw new Error("Email is required");
          }

          const email = emailField.value;

          let client = await tx.client.findFirst({
            where: {
              primaryBrokerOrgId: brokerOrgId,
              contacts: {
                some: { email }
              }
            },
            include: { contacts: true }
          });

          if (!client) {
            client = await tx.client.create({
              data: {
                id: randomUUID(),
                legalName:
                  `${firstNameField?.value || ""} ${lastNameField?.value || ""}`.trim() ||
                  "Individual Applicant",
                entityType: "INDIVIDUAL",
                primaryBrokerOrgId: brokerOrgId,
                contacts: {
                  create: {
                    firstName: firstNameField?.value || "Applicant",
                    lastName: lastNameField?.value || "",
                    email,
                    isPrimary: true
                  }
                }
              },
              include: { contacts: true }
            });
          }

          const loanApplication = await tx.loanApplication.create({
            data: {
              id: randomUUID(),
              applicationNumber: `APP-${Date.now()}`,
              brokerOrgId,
              clientId: client.id,
              loanProductCode: brokerProduct.loanProductCode,
              status: "DRAFT"
            }
          });

          const submission = await tx.applicationSubmission.create({
            data: {
              applicationId: loanApplication.id,
              applicationProductId,
              status: "CLIENT_PENDING"
            }
          });

          const submissionFields = fields.map(f => ({
            submissionId: submission.id,
            fieldId: f.fieldId || null,
            fieldKey: f.fieldKey || null,
            value: f.value ?? null,
            source: f.fieldId ? "DYNAMIC" : "STATIC"
          }));

          if (submissionFields.length > 0) {
            await tx.applicationSubmissionField.createMany({
              data: submissionFields
            });
          }

          return { submission, loanApplication, client };
        });

        /* ================= AUDIT LOG ================= */

        await logAudit({
          prisma,
          req,
          dashboard: "BROKER",
          category: "APPLICATION",
          entityType: "LoanApplication",
          entityId: result.loanApplication.id,
          action: "CREATE_APPLICATION",
          newValue: {
            submissionId: result.submission.id
          }
        });

        /* ================= ✅ CREATE CONVERSATION ================= */

        try {
          const existing = await prisma.conversation.findFirst({
            where: {
              loanApplicationId: result.loanApplication.id,
              type: "CLIENT_BROKER",
            },
          });

          if (!existing) {
            const conversation = await prisma.conversation.create({
              data: {
                loanApplicationId: result.loanApplication.id,
                type: "CLIENT_BROKER",
              },
            });

            const participants = [];

            // ✅ FIXED BROKER
            participants.push({
              conversationId: conversation.id,
              participantType: "BROKER",
              participantId: brokerUserId, // 🔥 FIXED
            });

            // ✅ CLIENT (EMAIL)
            const clientEmail = result.client.contacts?.[0]?.email;

            if (clientEmail) {
              participants.push({
                conversationId: conversation.id,
                participantType: "CLIENT",
                participantEmail: clientEmail,
              });
            }

            console.log("👥 Participants to insert:", participants);

            await prisma.conversationParticipant.createMany({
              data: participants,
              skipDuplicates: true,
            });
          }
        } catch (err) {
          console.error("💥 Conversation creation error:", err.message);

          fastify.log.error(
            { error: err.message },
            "Conversation creation failed (non-blocking)"
          );
        }

        /* ================= SUCCESS ================= */

        return reply.code(201).send({
          success: true,
          message: "Application created successfully (awaiting client action)",
          data: {
            submissionId: result.submission.id,
            applicationId: result.loanApplication.id
          }
        });

      } catch (error) {
        console.error("💥 SUBMIT ERROR:", error.message);

        fastify.log.error({
          message: error.message,
          stack: error.stack
        });

        if (error.message === "Email is required") {
          return reply.code(400).send({
            success: false,
            message: error.message
          });
        }

        if (error.message === "BROKER_ID_MISSING") {
          return reply.code(401).send({
            success: false,
            message: "Invalid broker token (missing userId)"
          });
        }

        return reply.code(500).send({
          success: false,
          message: "Internal server error while creating application"
        });
      }
    }
  );
}

module.exports = fp(brokerSubmitApplication);