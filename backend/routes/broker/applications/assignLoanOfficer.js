// broker/applications/assignLoanOfficer.js

const fp = require("fastify-plugin");
const { logAudit } = require("../../../services/logger/auditLogger");
const {
  findOrCreateClientOfficerConversation,
  syncLoanOfficerForApplication,
} = require("../../../services/messaging/brokerOfficerConversation");
const {
  notifyBroker,
  BROKER_NOTIFICATION_EVENTS,
} = require("../../../services/notifications/brokerNotifications");
const {
  canBrokerReassignApplication,
} = require("../../../utils/applications/resolveApplicationStatus");
const {
  autoAssignLoanOfficerCoBrokers,
} = require("../../../services/broker/autoAssignLoanOfficerCoBrokers");
const {
  uniqueIds,
  replaceLoanOfficerAssignments,
} = require("../../../services/broker/loanOfficerAssignments");

const SUBBROKER_CHAT_DB_TYPE = "CLIENT_BROKER";

async function assignLoanOfficer(fastify) {
  fastify.patch(
    "/:id/assign",
    {
      schema: {
        tags: ["Broker -> Applications"],
        summary: "Assign Loan Officer(s) to Application",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        if (!req.user.roles?.includes("BROKER_ADMIN")) {
          return reply.code(403).send({
            success: false,
            message: "Only Broker Admin can assign loan officer",
          });
        }

        const brokerOrgId = req.user.organizationId;
        const applicationId = req.params.id;
        const body = req.body || {};
        const hasIdsArray = Array.isArray(body.loanOfficerIds);
        const loanOfficerIds = uniqueIds(
          hasIdsArray
            ? body.loanOfficerIds
            : body.loanOfficerId
              ? [body.loanOfficerId]
              : [],
        );

        if (!hasIdsArray && !body.loanOfficerId) {
          return reply.code(400).send({
            success: false,
            message: "loanOfficerId or loanOfficerIds is required",
          });
        }

        const application = await prisma.loanApplication.findFirst({
          where: {
            id: applicationId,
            brokerOrgId,
          },
          select: {
            id: true,
            status: true,
            clientId: true,
            applicationNumber: true,
            brokerUserId: true,
            applicationLenders: {
              select: { status: true },
            },
            brokerUser: {
              select: {
                id: true,
                roles: {
                  select: {
                    role: { select: { name: true } },
                  },
                },
              },
            },
            loanOfficerAssignments: {
              select: { loanOfficerId: true },
            },
          },
        });

        if (!application) {
          return reply.code(404).send({
            success: false,
            message: "Application not found",
          });
        }

        const reassignmentCheck = canBrokerReassignApplication(application);
        if (!reassignmentCheck.allowed) {
          return reply.code(403).send({
            success: false,
            message: reassignmentCheck.reason,
          });
        }

        const officers =
          loanOfficerIds.length === 0
            ? []
            : await prisma.userAccount.findMany({
                where: {
                  id: { in: loanOfficerIds },
                  organizationId: brokerOrgId,
                  isDeleted: false,
                  roles: {
                    some: {
                      role: { name: "BROKER_OFFICER" },
                    },
                  },
                },
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              });

        if (officers.length !== loanOfficerIds.length) {
          return reply.code(400).send({
            success: false,
            message: "One or more loan officers are invalid",
          });
        }

        const currentOfficerId = application.brokerUser?.roles?.some(
          (role) => role.role?.name === "BROKER_OFFICER",
        )
          ? application.brokerUserId
          : null;

        const existingIds = application.loanOfficerAssignments.map(
          (row) => row.loanOfficerId,
        );
        const effectiveCurrentIds = existingIds.length
          ? existingIds
          : currentOfficerId
            ? [currentOfficerId]
            : [];
        const sameSet =
          loanOfficerIds.length === effectiveCurrentIds.length &&
          loanOfficerIds.every((id) => effectiveCurrentIds.includes(id));

        const assignedByUserId = req.user.userId || req.user.id;
        const { addedIds, allIds } = await replaceLoanOfficerAssignments(
          prisma,
          {
            loanApplicationId: applicationId,
            loanOfficerIds,
            assignedById: assignedByUserId,
          },
        );

        const newlyAssignedIds = loanOfficerIds.filter(
          (id) => !effectiveCurrentIds.includes(id),
        );

        if (sameSet) {
          return reply.code(200).send({
            success: true,
            message: "Loan officer already assigned to this application",
            data: {
              applicationId,
              loanOfficerIds: allIds,
              loanOfficerId: allIds[0] || null,
            },
          });
        }

        await syncLoanOfficerForApplication(prisma, {
          loanApplicationId: applicationId,
          previousOfficerId: currentOfficerId,
          officerIds: allIds,
        });

        if (application.clientId) {
          for (const loanOfficerId of allIds) {
            await findOrCreateClientOfficerConversation(prisma, {
              loanApplicationId: applicationId,
              loanOfficerId,
              clientId: application.clientId,
            });
          }
        }

        const assignments = await prisma.subBrokerApplication.findMany({
          where: { loanApplicationId: applicationId },
          select: { subBrokerId: true },
        });

        if (assignments.length > 0) {
          const existingConversation = await prisma.conversation.findFirst({
            where: {
              loanApplicationId: applicationId,
              type: SUBBROKER_CHAT_DB_TYPE,
            },
            select: { id: true },
          });

          const conversation = existingConversation
            ? existingConversation
            : await prisma.conversation.create({
                data: {
                  loanApplicationId: applicationId,
                  applicationLenderId: null,
                  type: SUBBROKER_CHAT_DB_TYPE,
                },
                select: { id: true },
              });

          const participantRows = [
            {
              conversationId: conversation.id,
              participantType: "BROKER",
              participantId: assignedByUserId,
            },
            ...assignments.map((assignment) => ({
              conversationId: conversation.id,
              participantType: "SUB_BROKER",
              participantId: assignment.subBrokerId,
            })),
            ...allIds.map((loanOfficerId) => ({
              conversationId: conversation.id,
              participantType: "BROKER",
              participantId: loanOfficerId,
            })),
          ];

          await prisma.conversationParticipant.createMany({
            data: participantRows,
            skipDuplicates: true,
          });
        }

        await logAudit({
          prisma,
          req,
          dashboard: "BROKER",
          category: "APPLICATION",
          entityType: "LoanApplication",
          entityId: applicationId,
          action: "ASSIGN_LOAN_OFFICER",
          newValue: {
            loanOfficerIds: allIds,
            loanOfficerId: allIds[0] || null,
          },
        });

        const officerById = new Map(officers.map((officer) => [officer.id, officer]));

        for (const loanOfficerId of newlyAssignedIds) {
          const officer = officerById.get(loanOfficerId);
          const officerName =
            `${officer?.firstName || ""} ${officer?.lastName || ""}`.trim() ||
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

          await autoAssignLoanOfficerCoBrokers(prisma, fastify, {
            loanApplicationId: applicationId,
            loanOfficerId,
            brokerOrgId,
            assignedByUserId,
          });
        }

        const updatedApplication = await prisma.loanApplication.findUnique({
          where: { id: applicationId },
          select: { id: true, brokerUserId: true },
        });

        return reply.code(200).send({
          success: true,
          message:
            allIds.length > 1
              ? "Loan officers assigned successfully"
              : allIds.length === 1
                ? "Loan officer assigned successfully"
                : "Loan officers unassigned successfully",
          data: {
            applicationId: updatedApplication?.id,
            loanOfficerId: updatedApplication?.brokerUserId || null,
            loanOfficerIds: allIds,
            addedLoanOfficerIds: addedIds,
          },
        });
      } catch (error) {
        fastify.log.error({
          error: error.message,
          stack: error.stack,
        });

        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    },
  );
}

module.exports = fp(assignLoanOfficer);
