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
  isGenericClientName,
} = require("../../../utils/applications/resolveBorrowerIdentity");
const {
  resolveSubmitLoanProduct,
} = require("../../../utils/applications/resolveSubmitLoanProduct");
const {
  autoAssignSubBrokerLoanOfficers,
} = require("../../../services/broker/autoAssignSubBrokerLoanOfficers");

const SUBBROKER_CHAT_DB_TYPE = "CLIENT_BROKER";

async function subBrokerSubmitApplication(fastify) {
  fastify.post(
    "/submit",
    {
      schema: {
        tags: ["Sub Broker -> Applications"],
        summary: "Create loan application (client pending)",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const loggedInUserId = req.user.id || req.user.userId;

        if (!loggedInUserId) {
          return reply.code(401).send({
            success: false,
            message: "Invalid session (missing userId)",
          });
        }

        const brokerOrgId = req.user.organizationId;

        if (!brokerOrgId) {
          return reply.code(403).send({
            success: false,
            message: "Broker organization not found",
          });
        }

        const subBroker = await prisma.userAccount.findFirst({
          where: {
            id: loggedInUserId,
            organizationId: brokerOrgId,
            isDeleted: false,
            roles: { some: { role: { name: "SUB_BROKER" } } },
          },
          select: {
            id: true,
            status: true,
            firstName: true,
            lastName: true,
          },
        });

        if (!subBroker) {
          return reply.code(403).send({
            success: false,
            message: "Co-broker access only",
          });
        }

        if (subBroker.status !== "ACTIVE") {
          return reply.code(400).send({
            success: false,
            message: "Co-broker account is inactive",
          });
        }

        const { applicationProductId, loanProductCode, fields } = req.body;

        if (!Array.isArray(fields)) {
          return reply.code(400).send({
            success: false,
            message: "Invalid payload",
          });
        }

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

        const result = await prisma.$transaction(async (tx) => {
          const email = resolveBorrowerEmail(fields);

          if (!email) {
            throw new Error("Email is required");
          }

          const { firstName, lastName, displayName } =
            resolveBorrowerNameParts(fields);
          const legalName = displayName || "Individual Applicant";

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
                legalName,
                entityType: "INDIVIDUAL",
                primaryBrokerOrgId: brokerOrgId,
                contacts: {
                  create: {
                    firstName: firstName || "Applicant",
                    lastName: lastName || "",
                    email,
                    isPrimary: true,
                  },
                },
              },
              include: { contacts: true },
            });
          } else {
            if (displayName && isGenericClientName(client.legalName)) {
              client = await tx.client.update({
                where: { id: client.id },
                data: { legalName: displayName },
                include: { contacts: true },
              });
            }

            const primaryContact =
              client.contacts.find((contact) => contact.email === email) ||
              client.contacts.find((contact) => contact.isPrimary) ||
              client.contacts[0];

            if (primaryContact && (firstName || lastName)) {
              await tx.clientContact.update({
                where: { id: primaryContact.id },
                data: {
                  ...(firstName ? { firstName } : {}),
                  ...(lastName ? { lastName } : {}),
                },
              });

              client = await tx.client.findUnique({
                where: { id: client.id },
                include: { contacts: true },
              });
            }
          }

          const loanApplication = await tx.loanApplication.create({
            data: {
              id: randomUUID(),
              applicationNumber: `APP-${Date.now()}`,
              brokerOrgId,
              brokerUserId: null,
              clientId: client.id,
              loanProductCode: resolvedLoanProductCode,
              status: "CLIENT_PENDING",
            },
          });

          const submission = await tx.applicationSubmission.create({
            data: {
              applicationId: loanApplication.id,
              ...(resolvedApplicationProductId
                ? { applicationProductId: resolvedApplicationProductId }
                : {}),
              status: "CLIENT_PENDING",
            },
          });

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

          await tx.subBrokerApplication.create({
            data: {
              loanApplicationId: loanApplication.id,
              subBrokerId: loggedInUserId,
              assignedById: loggedInUserId,
            },
          });

          const portalToken = await createClientPortalToken(tx, {
            loanApplicationId: loanApplication.id,
            clientId: client.id,
          });

          return {
            submission,
            loanApplication,
            client,
            borrowerEmail: email,
            portalToken,
            clientDisplayName: resolveClientDisplayName({
              client,
              contacts: client.contacts,
              fields,
            }),
          };
        });

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
            createdByRole: "SUB_BROKER",
          },
        });

        try {
          const conversation = await prisma.conversation.create({
            data: {
              loanApplicationId: result.loanApplication.id,
              type: SUBBROKER_CHAT_DB_TYPE,
            },
          });

          const participants = [
            {
              conversationId: conversation.id,
              participantType: "SUB_BROKER",
              participantId: loggedInUserId,
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
        } catch (err) {
          fastify.log.error(
            { error: err.message },
            "Co-broker conversation creation failed",
          );
        }

        await autoAssignSubBrokerLoanOfficers(prisma, fastify, {
          loanApplicationId: result.loanApplication.id,
          subBrokerId: loggedInUserId,
          brokerOrgId,
          assignedByUserId: loggedInUserId,
        });

        const subBrokerName =
          `${subBroker.firstName || ""} ${subBroker.lastName || ""}`.trim() ||
          "Co-Broker";

        await notifyBroker(prisma, fastify.io, {
          brokerOrgId,
          eventType: BROKER_NOTIFICATION_EVENTS.APPLICATION_CREATED,
          category: "APPLICATION",
          subject: "New Application Created",
          body: `${subBrokerName} created application ${result.loanApplication.applicationNumber} (awaiting client action)`,
          metadata: {
            applicationId: result.loanApplication.id,
            applicationNumber: result.loanApplication.applicationNumber,
            clientName: result.clientDisplayName,
            createdByUserId: loggedInUserId,
            createdByRole: "SUB_BROKER",
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
            portalToken: result.portalToken,
            idempotencyKey: `subbroker-submit-portal:${result.loanApplication.id}`,
            message:
              "Your loan application has been created. Use the secure link below to access your client portal, complete your application, and upload documents.",
          });
        } catch (mailErr) {
          fastify.log.error(
            {
              error: mailErr.message,
              applicationId: result.loanApplication.id,
              borrowerEmail: result.borrowerEmail,
            },
            "Failed to send client portal email after co-broker application submit",
          );
        }

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
          message:
            error.message || "Internal server error while creating application",
        });
      }
    },
  );
}

module.exports = fp(subBrokerSubmitApplication);
