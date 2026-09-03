const prisma = require("../../../config/prisma");

const { z } = require("zod");
const {
  notifyBroker,
  BROKER_NOTIFICATION_EVENTS,
} = require("../../../services/notifications/brokerNotifications");
const {
  canBrokerReassignApplication,
} = require("../../../utils/applications/resolveApplicationStatus");
const {
  autoAssignSubBrokerLoanOfficers,
} = require("../../../services/broker/autoAssignSubBrokerLoanOfficers");
const {
  syncClientBrokerTeamParticipants,
} = require("../../../services/messaging/brokerOfficerConversation");
const {
  requireLoOfficerPermission,
  isLoanOfficerActor,
  getUserId,
  officerAssignedApplicationWhere,
} = require("../../../services/broker/loanOfficerAccess");
const {
  replaceSubBrokerAssignments,
} = require("../../../services/broker/subBrokerAssignments");
const { uniqueIds } = require("../../../services/broker/loanOfficerAssignments");

const SUBBROKER_CHAT_DB_TYPE = "CLIENT_BROKER";

async function getLinkedSubBrokerIds(prisma, loanOfficerId) {
  if (!loanOfficerId) return [];
  const links = await prisma.subBrokerLoanOfficer.findMany({
    where: { loanOfficerId },
    select: { subBrokerId: true },
  });
  return links.map((link) => link.subBrokerId);
}

async function resolveOfficerScopedSubBrokerIds(
  prisma,
  {
    loanApplicationId,
    requestedIds,
    loanOfficerId,
  },
) {
  const linkedIds = await getLinkedSubBrokerIds(prisma, loanOfficerId);
  const linkedSet = new Set(linkedIds);
  const requested = uniqueIds(requestedIds);

  if (requested.some((id) => !linkedSet.has(id))) {
    const error = new Error(
      "You can only assign co-brokers linked to your account",
    );
    error.statusCode = 403;
    throw error;
  }

  const existing = await prisma.subBrokerApplication.findMany({
    where: { loanApplicationId },
    select: { subBrokerId: true },
  });

  const preserved = existing
    .map((row) => row.subBrokerId)
    .filter((id) => !linkedSet.has(id));

  return {
    linkedIds,
    finalIds: uniqueIds([...preserved, ...requested]),
  };
}

const assignSchema = z.object({
  loanApplicationId: z.string().uuid(),
  subBrokerId: z.string().uuid().optional(),
  subBrokerIds: z.array(z.string().uuid()).optional(),
}).refine((data) => data.subBrokerId || Array.isArray(data.subBrokerIds), {
  message: "subBrokerId or subBrokerIds is required",
});

async function assignApplicationRoute(fastify, options) {
  fastify.post(
    "/assign-application",

    {
      preHandler: [
        fastify.authenticate,

        fastify.requireRole([
          "BROKER_ADMIN",
          "BROKER_OFFICER",
        ]),

        async (req, reply) => {
          await requireLoOfficerPermission(req, reply, fastify, "EDIT_CO_BROKERS");
        },
      ],
    },

    async (request, reply) => {
      try {
        const brokerUserId =
          request.user.userId || request.user.id;

        const brokerOrgId =
          request.user.organizationId;
        const isOfficer = isLoanOfficerActor(request);
        const officerId = getUserId(request);

        /* ===============================
           VALIDATE BODY
        =============================== */
        const validated =
          assignSchema.parse(
            request.body,
          );

        const {
          loanApplicationId,
          subBrokerId,
          subBrokerIds: requestedSubBrokerIds,
        } = validated;

        const replaceSet = Array.isArray(requestedSubBrokerIds);

        /* ===============================
           CHECK APPLICATION
        =============================== */
        const application =
          await prisma.loanApplication.findFirst(
            {
              where: {
                id: loanApplicationId,

                brokerOrgId,
                ...(isOfficer
                  ? officerAssignedApplicationWhere(officerId)
                  : {}),
              },

              select: {
                id: true,

                applicationNumber: true,

                amountRequested: true,

                purpose: true,

                status: true,

                createdAt: true,

                submittedAt: true,

                loanProductCode: true,

                termMonthsRequested: true,

                client: {
                  select: {
                    id: true,

                    legalName: true,

                    entityType: true,

                    industry: true,
                  },
                },

                brokerUser: {
                  select: {
                    id: true,

                    firstName: true,

                    lastName: true,

                    email: true,

                    profileImage: true,
                  },
                },

                applicationLenders: {
                  select: {
                    id: true,

                    status: true,

                    sentAt: true,

                    lenderOrgId: true,

                    lender: {
                      select: {
                        id: true,

                        name: true,
                      },
                    },
                  },
                },

                submissions: {
                  orderBy: {
                    createdAt: "desc",
                  },

                  take: 1,

                  select: {
                    id: true,

                    status: true,

                    createdAt: true,

                    fields: {
                      select: {
                        fieldKey: true,

                        value: true,
                      },
                    },
                  },
                },
              },
            },
          );

        if (!application) {
          return reply.code(404).send({
            success: false,

            message:
              "Application not found",
          });
        }

        const reassignmentCheck = canBrokerReassignApplication(application);
        if (!reassignmentCheck.allowed) {
          return reply.code(403).send({
            success: false,
            message: reassignmentCheck.reason,
          });
        }

        if (replaceSet) {
          let subBrokerIds = uniqueIds(requestedSubBrokerIds);

          if (isOfficer) {
            try {
              const scoped = await resolveOfficerScopedSubBrokerIds(prisma, {
                loanApplicationId,
                requestedIds: subBrokerIds,
                loanOfficerId: officerId,
              });
              subBrokerIds = scoped.finalIds;
            } catch (scopeError) {
              return reply.code(scopeError.statusCode || 403).send({
                success: false,
                message: scopeError.message,
              });
            }
          }

          const subBrokers =
            subBrokerIds.length === 0
              ? []
              : await prisma.userAccount.findMany({
                  where: {
                    id: { in: subBrokerIds },
                    organizationId: brokerOrgId,
                    isDeleted: false,
                    roles: {
                      some: { role: { name: "SUB_BROKER" } },
                    },
                  },
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    status: true,
                  },
                });

          if (subBrokers.length !== subBrokerIds.length) {
            return reply.code(404).send({
              success: false,
              message: "One or more sub brokers were not found",
            });
          }

          const inactive = subBrokers.find((broker) => broker.status !== "ACTIVE");
          if (inactive) {
            return reply.code(400).send({
              success: false,
              message: "Sub broker account is inactive",
            });
          }

          const { addedIds, allIds } = await replaceSubBrokerAssignments(prisma, {
            loanApplicationId,
            subBrokerIds,
            assignedById: brokerUserId,
          });

          const existingConversation = await prisma.conversation.findFirst({
            where: {
              loanApplicationId,
              type: SUBBROKER_CHAT_DB_TYPE,
            },
            select: { id: true },
          });

          const conversation = existingConversation
            ? existingConversation
            : await prisma.conversation.create({
                data: {
                  loanApplicationId,
                  applicationLenderId: null,
                  type: SUBBROKER_CHAT_DB_TYPE,
                },
                select: { id: true },
              });

          const participantRows = [
            {
              conversationId: conversation.id,
              participantType: "BROKER",
              participantId: brokerUserId,
            },
            ...allIds.map((id) => ({
              conversationId: conversation.id,
              participantType: "SUB_BROKER",
              participantId: id,
            })),
          ];

          if (application.brokerUser?.id) {
            participantRows.push({
              conversationId: conversation.id,
              participantType: "BROKER",
              participantId: application.brokerUser.id,
            });
          }

          await prisma.conversationParticipant.createMany({
            data: participantRows,
            skipDuplicates: true,
          });

          await syncClientBrokerTeamParticipants(prisma, {
            loanApplicationId,
            brokerOrgId,
          });

          const subBrokerById = new Map(
            subBrokers.map((broker) => [broker.id, broker]),
          );

          for (const id of addedIds) {
            const subBroker = subBrokerById.get(id);
            const subBrokerName =
              `${subBroker?.firstName || ""} ${subBroker?.lastName || ""}`.trim() ||
              "Sub-Broker";

            await notifyBroker(prisma, fastify.io, {
              brokerOrgId,
              eventType: BROKER_NOTIFICATION_EVENTS.SUBBROKER_ASSIGNED,
              category: "ASSIGNMENT",
              subject: "Sub-Broker Assigned",
              body: `${subBrokerName} assigned to application ${application.applicationNumber}`,
              metadata: {
                applicationId: loanApplicationId,
                applicationNumber: application.applicationNumber,
                subBrokerId: id,
                subBrokerName,
              },
              recipientUserId: id,
            });

            await autoAssignSubBrokerLoanOfficers(prisma, fastify, {
              loanApplicationId,
              subBrokerId: id,
              brokerOrgId,
              assignedByUserId: brokerUserId,
            });
          }

          return reply.code(201).send({
            success: true,
            message:
              allIds.length === 0
                ? "Co-brokers unassigned successfully"
                : "Application assigned successfully",
            data: {
              applicationId: loanApplicationId,
              subBrokerIds: allIds,
              addedSubBrokerIds: addedIds,
            },
          });
        }

        /* ===============================
           SUBMISSION FIELDS MAP
        =============================== */
        const latestSubmission =
          application.submissions?.[0];

        const fieldsMap = {};

        latestSubmission?.fields?.forEach(
          (field) => {
            fieldsMap[
              field.fieldKey
            ] = field.value;
          },
        );

        /* ===============================
           CHECK SUB BROKER
        =============================== */
        const subBroker =
          await prisma.userAccount.findFirst(
            {
              where: {
                id: subBrokerId,

                organizationId:
                  brokerOrgId,

                isDeleted: false,

                roles: {
                  some: {
                    role: {
                      name: "SUB_BROKER",
                    },
                  },
                },
              },

              select: {
                id: true,

                firstName: true,

                lastName: true,

                email: true,

                phone: true,

                profileImage: true,

                status: true,
              },
            },
          );

        if (!subBroker) {
          return reply.code(404).send({
            success: false,

            message:
              "Sub broker not found",
          });
        }

        if (isOfficer) {
          const linkedIds = await getLinkedSubBrokerIds(prisma, officerId);
          if (!linkedIds.includes(subBrokerId)) {
            return reply.code(403).send({
              success: false,
              message:
                "You can only assign co-brokers linked to your account",
            });
          }
        }

        /* ===============================
           STATUS CHECK
        =============================== */
        if (
          subBroker.status !==
          "ACTIVE"
        ) {
          return reply.code(400).send({
            success: false,

            message:
              "Sub broker account is inactive",
          });
        }

        /* ===============================
           ALREADY ASSIGNED?
        =============================== */
        const existingAssignment =
          await prisma.subBrokerApplication.findFirst(
            {
              where: {
                loanApplicationId,

                subBrokerId,
              },
            },
          );

        if (existingAssignment) {
          return reply.code(400).send({
            success: false,

            message:
              "Application already assigned to this sub broker",
          });
        }

        /* ===============================
           CREATE ASSIGNMENT
        =============================== */
        const assignment =
          await prisma.subBrokerApplication.create(
            {
              data: {
                loanApplicationId,

                subBrokerId,

                assignedById:
                  brokerUserId,
              },

              include: {
                subBroker: {
                  select: {
                    id: true,

                    firstName: true,

                    lastName: true,

                    email: true,

                    profileImage: true,
                  },
                },

                assignedBy: {
                  select: {
                    id: true,

                    firstName: true,

                    lastName: true,

                    email: true,
                  },
                },
              },
            },
          );

        /* ===============================
           ENSURE SUB-BROKER CHAT
        =============================== */
        const existingConversation =
          await prisma.conversation.findFirst({
            where: {
              loanApplicationId,
              type: SUBBROKER_CHAT_DB_TYPE,
            },
            select: {
              id: true,
            },
          });

        const conversation = existingConversation
          ? existingConversation
          : await prisma.conversation.create({
              data: {
                loanApplicationId,
                applicationLenderId: null,
                type: SUBBROKER_CHAT_DB_TYPE,
              },
              select: {
                id: true,
              },
            });

        const participantRows = [
          {
            conversationId: conversation.id,
            participantType: "SUB_BROKER",
            participantId: subBrokerId,
          },
          {
            conversationId: conversation.id,
            participantType: "BROKER",
            participantId: brokerUserId,
          },
        ];

        if (application.brokerUser?.id) {
          participantRows.push({
            conversationId: conversation.id,
            participantType: "BROKER",
            participantId: application.brokerUser.id,
          });
        }

        await prisma.conversationParticipant.createMany({
          data: participantRows,
          skipDuplicates: true,
        });

        await syncClientBrokerTeamParticipants(prisma, {
          loanApplicationId,
          brokerOrgId,
        });

        /* ===============================
           FORMAT RESPONSE
        =============================== */
        const responseData = {
          assignmentId:
            assignment.id,

          assignedAt:
            assignment.assignedAt,

          application: {
            id: application.id,

            applicationNumber:
              application.applicationNumber,

            borrower:
              application.client
                ?.legalName ||
              "Applicant",

            loanInfo:
              fieldsMap.loanProductCode ||
              application.loanProductCode ||
              fieldsMap.purpose ||
              application.purpose ||
              "N/A",

            location:
              [
                fieldsMap.propertyCity,

                fieldsMap.propertyState,

                fieldsMap.propertyCountry,
              ]
                .filter(Boolean)
                .join(", ") ||
              "N/A",

            amount: Number(
              fieldsMap.amountRequested ||
                application.amountRequested ||
                0,
            ),

            purpose:
              fieldsMap.purpose ||
              application.purpose ||
              null,

            propertyCity:
              fieldsMap.propertyCity ||
              null,

            propertyState:
              fieldsMap.propertyState ||
              null,

            propertyCountry:
              fieldsMap.propertyCountry ||
              null,

            loanProductCode:
              fieldsMap.loanProductCode ||
              application.loanProductCode ||
              null,

            termMonthsRequested:
              fieldsMap.termMonthsRequested ||
              application.termMonthsRequested ||
              null,

            status:
              application.status,

            submittedOn:
              application.submittedAt ||
              application.createdAt,

            submissionStatus:
              latestSubmission?.status ||
              null,

            dynamicFields:
              fieldsMap,

            assignedLoanOfficer:
              application.brokerUser
                ? {
                    id:
                      application
                        .brokerUser.id,

                    firstName:
                      application
                        .brokerUser
                        .firstName,

                    lastName:
                      application
                        .brokerUser
                        .lastName,

                    email:
                      application
                        .brokerUser
                        .email,

                    profileImage:
                      application
                        .brokerUser
                        .profileImage,
                  }
                : null,

            submittedToLenders:
              application.applicationLenders.map(
                (item) => ({
                  lenderOrgId:
                    item.lenderOrgId,

                  lenderName:
                    item.lender
                      ?.name ||
                    null,

                  status:
                    item.status,

                  sentAt:
                    item.sentAt,
                }),
              ),
          },

          subBroker: {
            id: subBroker.id,

            firstName:
              subBroker.firstName,

            lastName:
              subBroker.lastName,

            email:
              subBroker.email,

            phone:
              subBroker.phone,

            profileImage:
              subBroker.profileImage,
          },

          assignedBy: {
            id: assignment.assignedBy.id,

            firstName:
              assignment.assignedBy
                .firstName,

            lastName:
              assignment.assignedBy
                .lastName,

            email:
              assignment.assignedBy
                .email,
          },
        };

        const subBrokerName =
          `${subBroker.firstName || ""} ${subBroker.lastName || ""}`.trim() ||
          "Sub-Broker";

        await notifyBroker(prisma, fastify.io, {
          brokerOrgId,
          eventType: BROKER_NOTIFICATION_EVENTS.SUBBROKER_ASSIGNED,
          category: "ASSIGNMENT",
          subject: "Sub-Broker Assigned",
          body: `${subBrokerName} assigned to application ${application.applicationNumber}`,
          metadata: {
            applicationId: loanApplicationId,
            applicationNumber: application.applicationNumber,
            subBrokerId,
            subBrokerName,
            assignmentId: assignment.id,
          },
          recipientUserId: subBrokerId,
        });

        const autoAssignedOfficerIds =
          await autoAssignSubBrokerLoanOfficers(prisma, fastify, {
            loanApplicationId,
            subBrokerId,
            brokerOrgId,
            assignedByUserId: brokerUserId,
          });

        if (autoAssignedOfficerIds.length > 0) {
          const refreshedApplication = await prisma.loanApplication.findFirst({
            where: { id: loanApplicationId, brokerOrgId },
            select: {
              brokerUser: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  profileImage: true,
                },
              },
            },
          });

          if (refreshedApplication?.brokerUser) {
            responseData.application.assignedLoanOfficer = {
              id: refreshedApplication.brokerUser.id,
              firstName: refreshedApplication.brokerUser.firstName,
              lastName: refreshedApplication.brokerUser.lastName,
              email: refreshedApplication.brokerUser.email,
              profileImage: refreshedApplication.brokerUser.profileImage,
            };
          }

          responseData.autoAssignedLoanOfficerIds = autoAssignedOfficerIds;
        }

        /* ===============================
           SUCCESS RESPONSE
        =============================== */
        return reply.code(201).send({
          success: true,

          message:
            "Application assigned successfully",

          data: responseData,
        });
      } catch (err) {
        console.error(err);

        /* ===============================
           ZOD ERROR
        =============================== */
        if (
          err?.name === "ZodError"
        ) {
          return reply.code(400).send({
            success: false,

            message:
              "Validation failed",

            errors: err.errors,
          });
        }

        return reply.code(500).send({
          success: false,

          message:
            err.message ||
            "Something went wrong",
        });
      }
    },
  );
}

module.exports =
  assignApplicationRoute;
