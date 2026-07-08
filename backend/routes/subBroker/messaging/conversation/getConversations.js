/**
 * Get conversations for sub broker loan
 * FIXED VERSION
 */

const {
  resolveViewerRole,
  enrichConversationList,
} = require("../../../../services/messaging/conversationPresentation");

module.exports = async function getConversations(fastify) {
  fastify.get(
    "/loan/:loanId/conversations",
    {
      preHandler: [fastify.authenticate, fastify.requireRole(["SUB_BROKER"])],

      schema: {
        tags: ["Sub Broker -> Messaging"],

        summary: "Get conversations for sub broker",

        params: {
          type: "object",

          required: ["loanId"],

          properties: {
            loanId: {
              type: "string",
              format: "uuid",
            },
          },
        },
      },
    },

    async (req, reply) => {
      const prisma = fastify.prisma;

      const { loanId } = req.params;

      const userId = req.user?.userId;

      try {
        /* ======================================
           VERIFY ASSIGNMENT
        ====================================== */

        const assignment = await prisma.subBrokerApplication.findFirst({
          where: {
            loanApplicationId: loanId,

            subBrokerId: userId,
          },

          include: {
            assignedBy: {
              select: {
                id: true,

                firstName: true,

                lastName: true,

                profileImage: true,
              },
            },
          },
        });

        if (!assignment) {
          return reply.code(403).send({
            success: false,

            message: "Application not assigned",
          });
        }

        /* ======================================
           EXISTING CONVERSATIONS
        ====================================== */

        const existingConversations = await prisma.conversation.findMany({
          where: {
            loanApplicationId: loanId,

            participants: {
              some: {
                participantId: userId,

                participantType: "SUB_BROKER",
              },
            },
          },

          include: {
            participants: true,

            messages: {
              orderBy: {
                createdAt: "desc",
              },

              take: 1,
            },
          },

          orderBy: {
            lastMessageAt: "desc",
          },
        });

        const formatted = [];

        /* ======================================
           PRINCIPAL BROKER CHAT
        ====================================== */

        const principalBroker = assignment.assignedBy;

        if (principalBroker) {
          const brokerConversation = existingConversations.find(
            (c) =>
              c.type === "SUBBROKER_BROKER" &&
              c.chatCategory === "PRINCIPAL_BROKER",
          );

          formatted.push({
            id: brokerConversation?.id || `broker-${principalBroker.id}`,

            type: "SUBBROKER_BROKER",
            chatCategory: "PRINCIPAL_BROKER",

            title: `Principal Broker • ${
              `${principalBroker.firstName || ""} ${
                principalBroker.lastName || ""
              }`.trim() || "Broker"
            }`,

            lastMessage: brokerConversation?.messages?.[0]?.text || null,

            lastMessageAt: brokerConversation?.lastMessageAt || null,

            unreadCount: 0,

            participant: {
              id: principalBroker.id,

              role: "BROKER",

              name: `${principalBroker.firstName || ""} ${
                principalBroker.lastName || ""
              }`.trim(),

              profileImage: principalBroker.profileImage || null,
            },
          });
        }

        /* ======================================
           ASSIGNED LOAN OFFICER CHAT
        ====================================== */

        /* ======================================
   FETCH LOAN APPLICATION
====================================== */

        const loanApplication = await prisma.loanApplication.findUnique({
          where: {
            id: loanId,
          },

          select: {
            brokerUser: {
              select: {
                id: true,

                firstName: true,

                lastName: true,

                profileImage: true,
              },
            },
          },
        });

        const loanOfficer = loanApplication?.brokerUser;

        if (loanOfficer) {
          let officerConversation = existingConversations.find(
            (c) =>
              c.type === "SUBBROKER_BROKER" &&
              c.chatCategory === "LOAN_OFFICER",
          );

          formatted.push({
            id: officerConversation?.id || `officer-${loanOfficer.id}`,

            type: "SUBBROKER_BROKER",

            chatCategory: "LOAN_OFFICER",

            title: `Loan Officer • ${
              `${loanOfficer.firstName || ""} ${
                loanOfficer.lastName || ""
              }`.trim() || "Loan Officer"
            }`,

            lastMessage: officerConversation?.messages?.[0]?.text || null,

            lastMessageAt: officerConversation?.lastMessageAt || null,

            unreadCount: 0,

            participant: {
              id: loanOfficer.id,

              role: "BROKER",

              name: `${loanOfficer.firstName || ""} ${
                loanOfficer.lastName || ""
              }`.trim(),

              profileImage: loanOfficer.profileImage || null,
            },
          });
        }

        /* ======================================
           SUCCESS RESPONSE
        ====================================== */

        return reply.send({
          success: true,

          data: {
            loanId,

            total: formatted.length,

            conversations: enrichConversationList(
              formatted,
              resolveViewerRole(req),
            ),
          },
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,

            loanId,

            userId,
          },

          "Failed to fetch conversations",
        );

        return reply.code(500).send({
          success: false,

          message: error.message,
        });
      }
    },
  );
};
