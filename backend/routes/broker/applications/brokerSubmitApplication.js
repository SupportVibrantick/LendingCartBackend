const fp = require("fastify-plugin");
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
  createClientPortalToken,
  sendClientPortalAccessEmail,
} = require("../../../services/emails/clientPortalAccessEmail");
const {
  resolveBorrowerNameParts,
  resolveClientDisplayName,
  resolveBorrowerEmail,
} = require("../../../utils/applications/resolveBorrowerIdentity");
const {
  resolveSubmitLoanProduct,
} = require("../../../utils/applications/resolveSubmitLoanProduct");
const {
  sanitizeRequestedDocumentTypes,
} = require("../../../utils/applications/sanitizeRequestedDocumentTypes");
const {
  findOrCreateBorrowerClient,
} = require("../../../services/clientPortal/findOrCreateBorrowerClient");

async function brokerSubmitApplication(fastify) {
  fastify.post(
    "/submit",
    {
      schema: {
        tags: ["Broker -> Applications"],
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

        // requestedDocumentTypes (optional): { labels: string[], typeIds: string[] }.
        // Anything malformed is silently dropped — selection is best-effort and
        // legacy clients still work.
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
          const email = resolveBorrowerEmail(fields);

          if (!email) {
            throw new Error("Email is required");
          }

          const { firstName, lastName, displayName } =
            resolveBorrowerNameParts(fields);

          /* ---------- CLIENT ---------- */

          const {
            client,
            email: normalizedEmail,
            warnings: clientWarnings,
          } = await findOrCreateBorrowerClient(tx, {
            brokerOrgId,
            email,
            firstName,
            lastName,
            displayName,
            logger: fastify.log,
          });

          /* ---------- LOAN APPLICATION ---------- */

          const loanApplication = await tx.loanApplication.create({
            data: {
              id: randomUUID(),
              applicationNumber: `APP-${Date.now()}`,
              brokerOrgId,

              // officer → self-assigned; admin → assign later via pipeline
              brokerUserId: isOfficer ? loggedInUserId : null,

              clientId: client.id,
              loanProductCode: resolvedLoanProductCode,
              status: "CLIENT_PENDING",
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

          const portalToken = await createClientPortalToken(tx, {
            loanApplicationId: loanApplication.id,
            clientId: client.id,
          });

          return {
            submission,
            loanApplication,
            client,
            borrowerEmail: normalizedEmail,
            portalToken,
            warnings: clientWarnings,
            clientDisplayName: resolveClientDisplayName({
              client,
              contacts: client.contacts,
              fields,
            }),
          };
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
            clientName: result.clientDisplayName,
            createdByUserId: loggedInUserId,
          },
        });

        try {
          const brokerOrg = await prisma.organization.findUnique({
            where: { id: brokerOrgId },
            select: { name: true },
          });

          await sendClientPortalAccessEmail({
            prisma,
            to: result.borrowerEmail,
            clientName: result.clientDisplayName,
            applicationNumber: result.loanApplication.applicationNumber,
            brokerName: brokerOrg?.name,
            brokerOrgId,
            portalToken: result.portalToken,
            idempotencyKey: `broker-submit-portal:${result.loanApplication.id}`,
            message:
              "Your loan application has been created. Use the secure link below to access your client portal, complete your application, and upload documents.",
          });

          fastify.log.info(
            {
              borrowerEmail: result.borrowerEmail,
              applicationId: result.loanApplication.id,
            },
            "Client portal access email enqueued after broker application submit",
          );
        } catch (mailErr) {
          fastify.log.error(
            {
              error: mailErr.message,
              applicationId: result.loanApplication.id,
              borrowerEmail: result.borrowerEmail,
            },
            "Failed to send client portal email after broker application submit",
          );
        }

        /* ================= RESPONSE ================= */

        return reply.code(201).send({
          success: true,
          message: "Application created successfully (awaiting client action)",
          data: {
            submissionId: result.submission.id,
            applicationId: result.loanApplication.id,
            ...(result.warnings?.length ? { warnings: result.warnings } : {}),
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
          message: error.message || "Internal server error while creating application",
        });
      }
    },
  );
}

module.exports = fp(brokerSubmitApplication);
