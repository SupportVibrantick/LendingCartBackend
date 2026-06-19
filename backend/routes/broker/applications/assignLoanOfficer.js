// broker/applications/assignLoanOfficer.js

const fp = require("fastify-plugin");
const { logAudit } = require("../../../services/logger/auditLogger");
const {
  findOrCreateClientOfficerConversation,
  syncLoanOfficerForApplication,
} = require("../../../services/brokerOfficerConversation");
const {
  notifyBroker,
  BROKER_NOTIFICATION_EVENTS,
} = require("../../../services/brokerNotifications");
const {
  canBrokerReassignApplication,
} = require("../../../utils/resolveApplicationStatus");

const SUBBROKER_CHAT_DB_TYPE = "CLIENT_BROKER";

async function assignLoanOfficer(fastify) {
  fastify.patch(
    "/:id/assign",
    {
      schema: {
        tags: ["Broker -> Applications"],
        summary: "Assign Loan Officer to Application"
      }
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /* ================= AUTH ================= */

        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only"
          });
        }

        if (!req.user.roles?.includes("BROKER_ADMIN")) {
          return reply.code(403).send({
            success: false,
            message: "Only Broker Admin can assign loan officer"
          });
        }

        const brokerOrgId = req.user.organizationId;
        const applicationId = req.params.id;
        const { loanOfficerId } = req.body;

        if (!loanOfficerId) {
          return reply.code(400).send({
            success: false,
            message: "loanOfficerId is required"
          });
        }

        /* ================= VALIDATE APPLICATION ================= */

        const application = await prisma.loanApplication.findFirst({
          where: {
            id: applicationId,
            brokerOrgId: brokerOrgId
          },
          select: {
            id: true,
            status: true,
            clientId: true,
            applicationNumber: true,
            brokerUserId: true,
            applicationLenders: {
              select: {
                status: true,
              },
            },
            brokerUser: {
              select: {
                id: true,
                roles: {
                  select: {
                    role: {
                      select: { name: true },
                    },
                  },
                },
              },
            },
          },
        });

        if (!application) {
          return reply.code(404).send({
            success: false,
            message: "Application not found"
          });
        }

        const reassignmentCheck = canBrokerReassignApplication(application);
        if (!reassignmentCheck.allowed) {
          return reply.code(403).send({
            success: false,
            message: reassignmentCheck.reason,
          });
        }

        /* ================= VALIDATE LOAN OFFICER ================= */

        const officer = await prisma.userAccount.findFirst({
          where: {
            id: loanOfficerId,
            organizationId: brokerOrgId,
            roles: {
              some: {
                role: {
                  name: "BROKER_OFFICER"
                }
              }
            }
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        });

        if (!officer) {
          return reply.code(400).send({
            success: false,
            message: "Invalid loan officer"
          });
        }

        const currentOfficerId =
          application.brokerUser?.roles?.some(
            (role) => role.role?.name === "BROKER_OFFICER",
          )
            ? application.brokerUserId
            : null;

        if (currentOfficerId === loanOfficerId) {
          return reply.code(200).send({
            success: true,
            message: "Loan officer already assigned to this application",
            data: {
              applicationId,
              loanOfficerId: currentOfficerId,
            },
          });
        }

        /* ================= UPDATE ================= */

        const updatedApplication = await prisma.loanApplication.update({
          where: { id: applicationId },
          data: {
            brokerUserId: loanOfficerId
          }
        });

        await syncLoanOfficerForApplication(prisma, {
          loanApplicationId: applicationId,
          previousOfficerId: currentOfficerId,
          newOfficerId: loanOfficerId,
        });

        /* ================= SYNC CLIENT ↔ LOAN OFFICER CHAT ================= */

        if (application.clientId) {
          await findOrCreateClientOfficerConversation(prisma, {
            loanApplicationId: applicationId,
            loanOfficerId,
            clientId: application.clientId,
          });
        }

        /* ================= SYNC SUB-BROKER CHAT ================= */

        const assignments = await prisma.subBrokerApplication.findMany({
          where: {
            loanApplicationId: applicationId
          },
          select: {
            subBrokerId: true
          }
        });

        if (assignments.length > 0) {
          const existingConversation = await prisma.conversation.findFirst({
            where: {
              loanApplicationId: applicationId,
              type: SUBBROKER_CHAT_DB_TYPE
            },
            select: {
              id: true
            }
          });

          const conversation = existingConversation
            ? existingConversation
            : await prisma.conversation.create({
                data: {
                  loanApplicationId: applicationId,
                  applicationLenderId: null,
                  type: SUBBROKER_CHAT_DB_TYPE
                },
                select: {
                  id: true
                }
              });

          const participantRows = [
            {
              conversationId: conversation.id,
              participantType: "BROKER",
              participantId: req.user.userId
            },
            ...assignments.map((assignment) => ({
              conversationId: conversation.id,
              participantType: "SUB_BROKER",
              participantId: assignment.subBrokerId
            }))
          ];

          await prisma.conversationParticipant.createMany({
            data: participantRows,
            skipDuplicates: true
          });
        }

        /* ================= AUDIT LOG ================= */

        await logAudit({
          prisma,
          req,
          dashboard: "BROKER",
          category: "APPLICATION",
          entityType: "LoanApplication",
          entityId: applicationId,
          action: "ASSIGN_LOAN_OFFICER",
          newValue: {
            loanOfficerId
          }
        });

        const officerName =
          `${officer.firstName || ""} ${officer.lastName || ""}`.trim() ||
          "Loan Officer";

        await notifyBroker(prisma, fastify.io, {
          brokerOrgId,
          eventType: BROKER_NOTIFICATION_EVENTS.LOAN_OFFICER_ASSIGNED,
          category: "ASSIGNMENT",
          subject: "Loan Officer Assigned",
          body: `${officerName} assigned to application ${application.applicationNumber}`,
          metadata: {
            applicationId,
            applicationNumber: application.applicationNumber,
            loanOfficerId,
            officerName,
          },
          recipientUserId: loanOfficerId,
        });

        /* ================= SUCCESS ================= */

        return reply.code(200).send({
          success: true,
          message: "Loan officer assigned successfully",
          data: {
            applicationId: updatedApplication.id,
            loanOfficerId: updatedApplication.brokerUserId
          }
        });

      } catch (error) {
        fastify.log.error({
          error: error.message,
          stack: error.stack
        });

        return reply.code(500).send({
          success: false,
          message: "Internal server error"
        });
      }
    }
  );
}

module.exports = fp(assignLoanOfficer);
