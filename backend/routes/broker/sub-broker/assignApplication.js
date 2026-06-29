const prisma = require("../../../config/prisma");

const { z } = require("zod");
const {
  notifyBroker,
  BROKER_NOTIFICATION_EVENTS,
} = require("../../../services/brokerNotifications");
const {
  canBrokerReassignApplication,
} = require("../../../utils/resolveApplicationStatus");
const {
  autoAssignSubBrokerLoanOfficers,
} = require("../../../services/autoAssignSubBrokerLoanOfficers");

const SUBBROKER_CHAT_DB_TYPE = "CLIENT_BROKER";

const assignSchema = z.object({
  loanApplicationId: z.string().uuid(),

  subBrokerId: z.string().uuid(),
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
      ],
    },

    async (request, reply) => {
      try {
        const brokerUserId =
          request.user.userId;

        const brokerOrgId =
          request.user.organizationId;

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
        } = validated;

        /* ===============================
           CHECK APPLICATION
        =============================== */
        const application =
          await prisma.loanApplication.findFirst(
            {
              where: {
                id: loanApplicationId,

                brokerOrgId,
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
