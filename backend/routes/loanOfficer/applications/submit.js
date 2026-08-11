const fp = require("fastify-plugin");
const { officerPreHandler } = require("../../../services/broker/loanOfficerAccess");
const {
  buildSubmissionFieldsPayload,
  loadProductFieldIdMap,
} = require("../../../services/applications/staticSubmissionFields");
const { randomUUID } = require("crypto");
const { logAudit } = require("../../../services/logger/auditLogger");
const {
  notifyBroker,
  BROKER_NOTIFICATION_EVENTS,
} = require("../../../services/notifications/brokerNotifications");
const {
  resolveSubmitLoanProduct,
} = require("../../../utils/applications/resolveSubmitLoanProduct");
const {
  sanitizeRequestedDocumentTypes,
} = require("../../../utils/applications/sanitizeRequestedDocumentTypes");

async function loanOfficerSubmitApplication(fastify) {
  fastify.post(
    "/submit",
    {
      preHandler: officerPreHandler(fastify, "CREATE_APPLICATION"),
      schema: {
        tags: ["Loan Officer -> Applications"],
        summary: "Create Loan Application (Client Pending)",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /* ================= AUTH ================= */

        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        // ✅ UNIVERSAL USER ID FIX (ROOT FIX)
        const loggedInUserId = req.user.id || req.user.userId;

        if (!loggedInUserId) {
          return reply.code(401).send({
            success: false,
            message: "Invalid broker token (missing userId)",
          });
        }

        const roles = req.user.roles || [];
        const brokerOrgId = req.user.organizationId;

        // ✅ ONLY officer is loan officer
        const isOfficer = roles.includes("BROKER_OFFICER");

        /* ================= BODY ================= */

        const { applicationProductId, loanProductCode, fields, requestedDocumentTypes } = req.body;

        if (!Array.isArray(fields)) {
          return reply.code(400).send({
            success: false,
            message: "Invalid payload",
          });
        }

        const sanitizedRequestedDocumentTypes = sanitizeRequestedDocumentTypes(requestedDocumentTypes);

        /* ================= VALIDATE PRODUCT ================= */

        const resolvedProduct = await resolveSubmitLoanProduct(prisma, {
          loanProductCode,
          applicationProductId,
          brokerOrgId,
        });

        if (resolvedProduct.error) {
          return reply.code(resolvedProduct.error.status).send({
            success: false,
            message: resolvedProduct.error.message,
          });
        }

        const resolvedLoanProductCode = resolvedProduct.loanProductCode;
        const resolvedApplicationProductId =
          resolvedProduct.applicationProductId;

        /* ================= TRANSACTION ================= */

        const result = await prisma.$transaction(async (tx) => {
          const emailField = fields.find((f) => f.fieldKey === "email");
          const firstNameField = fields.find(
            (f) => f.fieldKey === "first_name",
          );
          const lastNameField = fields.find((f) => f.fieldKey === "last_name");

          if (!emailField?.value) {
            throw new Error("Email is required");
          }

          const email = emailField.value;

          /* ---------- CLIENT ---------- */

          let client = await tx.client.findFirst({
            where: {
              primaryBrokerOrgId: brokerOrgId,
              contacts: {
                some: { email },
              },
            },
            include: { contacts: true },
          });

          if (!client) {
            client = await tx.client.create({
              data: {
                id: randomUUID(),
                legalName:
                  `${firstNameField?.value || ""} ${
                    lastNameField?.value || ""
                  }`.trim() || "Individual Applicant",
                entityType: "INDIVIDUAL",
                primaryBrokerOrgId: brokerOrgId,
                contacts: {
                  create: {
                    firstName: firstNameField?.value || "Applicant",
                    lastName: lastNameField?.value || "",
                    email,
                    isPrimary: true,
                  },
                },
              },
              include: { contacts: true },
            });
          }

          /* ---------- LOAN APPLICATION ---------- */

          const loanApplication = await tx.loanApplication.create({
            data: {
              id: randomUUID(),
              applicationNumber: `APP-${Date.now()}`,
              brokerOrgId,

              brokerUserId: loggedInUserId,

              clientId: client.id,
              loanProductCode: resolvedLoanProductCode,
              status: "DRAFT",
              ...(sanitizedRequestedDocumentTypes
                ? { requestedDocumentTypes: sanitizedRequestedDocumentTypes }
                : {}),
            },
          });

          /* ---------- SUBMISSION ---------- */

          const submission = await tx.applicationSubmission.create({
            data: {
              applicationId: loanApplication.id,
              ...(resolvedApplicationProductId
                ? { applicationProductId: resolvedApplicationProductId }
                : {}),
              status: "CLIENT_PENDING",
            },
          });

          /* ---------- FIELDS ---------- */

          const fieldIdByKey = await loadProductFieldIdMap(
            tx,
            resolvedApplicationProductId,
          );

          const normalizedFields = buildSubmissionFieldsPayload(
            fields,
            fieldIdByKey,
          );

          const submissionFields = normalizedFields.map((f) => ({
            submissionId: submission.id,
            ...f,
          }));

          if (submissionFields.length > 0) {
            await tx.applicationSubmissionField.createMany({
              data: submissionFields,
            });
          }

          return { submission, loanApplication, client };
        });

        /* ================= AUDIT ================= */

        await logAudit({
          prisma,
          req,
          dashboard: "BROKER",
          category: "APPLICATION",
          entityType: "LoanApplication",
          entityId: result.loanApplication.id,
          action: "CREATE_APPLICATION",
          newValue: {
            submissionId: result.submission.id,
          },
        });

        /* ================= CONVERSATION ================= */

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

            const participants = [
              {
                conversationId: conversation.id,
                participantType: "BROKER",
                participantId: loggedInUserId, // ✅ ALWAYS creator
              },
            ];

            const clientEmail = result.client.contacts?.[0]?.email;

            if (clientEmail) {
              participants.push({
                conversationId: conversation.id,
                participantType: "CLIENT",
                participantEmail: clientEmail,
              });
            }

            await prisma.conversationParticipant.createMany({
              data: participants,
              skipDuplicates: true,
            });
          }
        } catch (err) {
          fastify.log.error(
            { error: err.message },
            "Conversation creation failed",
          );
        }

        await notifyBroker(prisma, fastify.io, {
          brokerOrgId,
          eventType: BROKER_NOTIFICATION_EVENTS.APPLICATION_CREATED,
          category: "APPLICATION",
          subject: "New Application Created",
          body: `New application ${result.loanApplication.applicationNumber} created and awaiting client action`,
          metadata: {
            applicationId: result.loanApplication.id,
            applicationNumber: result.loanApplication.applicationNumber,
            clientName: result.client.legalName,
            createdByUserId: loggedInUserId,
            createdByRole: "LOAN_OFFICER",
          },
        });

        /* ================= RESPONSE ================= */

        return reply.code(201).send({
          success: true,
          message: "Application created successfully (awaiting client action)",
          data: {
            submissionId: result.submission.id,
            applicationId: result.loanApplication.id,
          },
        });
      } catch (error) {
        fastify.log.error({
          message: error.message,
          stack: error.stack,
        });

        if (error.message === "Email is required") {
          return reply.code(400).send({
            success: false,
            message: error.message,
          });
        }

        return reply.code(500).send({
          success: false,
          message: "Internal server error while creating application",
        });
      }
    },
  );
}

module.exports = fp(loanOfficerSubmitApplication);
