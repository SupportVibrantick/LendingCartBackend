/**
 * Get conversations for sub broker loan
 */

const {
  resolveViewerRole,
  enrichConversationList,
} = require("../../../../services/messaging/conversationPresentation");
const {
  syncClientBrokerTeamParticipants,
  isPrincipalClientBrokerChannel,
  findBrokerAdmin,
  formatUserName,
  listAssignedStaffForLoanChat,
  buildSubBrokerLoanOfficerConversationEntries,
} = require("../../../../services/messaging/brokerOfficerConversation");
const {
  resolveClientDisplayName,
} = require("../../../../services/messaging/resolveClientDisplayName");
const {
  enrichLoanConversationItems,
} = require("../../../../services/messaging/conversationUnread");

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
      const userId = req.user?.userId || req.user?.id;

      try {
        const assignment = await prisma.subBrokerApplication.findFirst({
          where: {
            loanApplicationId: loanId,
            subBrokerId: userId,
          },
          select: { id: true },
        });

        if (!assignment) {
          return reply.code(403).send({
            success: false,
            message: "Application not assigned",
          });
        }

        const loan = await prisma.loanApplication.findUnique({
          where: { id: loanId },
          select: {
            id: true,
            brokerOrgId: true,
            brokerUserId: true,
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

        if (!loan) {
          return reply.code(404).send({
            success: false,
            message: "Application not found",
          });
        }

        await syncClientBrokerTeamParticipants(prisma, {
          loanApplicationId: loanId,
          brokerOrgId: loan.brokerOrgId,
        });

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
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
          orderBy: {
            lastMessageAt: "desc",
          },
        });

        const formatted = [];

        let teamConversation = existingConversations.find(
          (c) =>
            c.type === "CLIENT_BROKER" &&
            isPrincipalClientBrokerChannel(c.chatCategory),
        );

        if (!teamConversation) {
          teamConversation = await prisma.conversation.findFirst({
            where: {
              loanApplicationId: loanId,
              type: "CLIENT_BROKER",
              OR: [
                { chatCategory: null },
                { chatCategory: "PRINCIPAL" },
                { chatCategory: "PRINCIPAL_BROKER" },
              ],
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
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
          });
        }

        if (teamConversation) {
          const clientName = await resolveClientDisplayName(prisma, {
            loanApplicationId: loanId,
          });

          formatted.push({
            id: teamConversation.id,
            type: "CLIENT_BROKER",
            chatCategory: teamConversation.chatCategory || "PRINCIPAL_BROKER",
            title: `Client • ${clientName}`,
            clientName,
            lastMessage: teamConversation.messages?.[0]?.text || null,
            lastMessageAt: teamConversation.lastMessageAt || null,
            unreadCount: 0,
          });
        }

        const principalBroker = await findBrokerAdmin(prisma, loan.brokerOrgId);

        if (principalBroker) {
          const brokerConversation = existingConversations.find(
            (c) =>
              c.type === "SUBBROKER_BROKER" &&
              (c.chatCategory === "PRINCIPAL_BROKER" || !c.chatCategory) &&
              c.participants?.some(
                (participant) =>
                  participant.participantType === "BROKER" &&
                  participant.participantId === principalBroker.id,
              ),
          );

          const adminName = formatUserName(principalBroker, "Broker");

          formatted.push({
            id: brokerConversation?.id || `broker-${principalBroker.id}`,
            type: "SUBBROKER_BROKER",
            chatCategory: "PRINCIPAL_BROKER",
            title: `Principal Broker • ${adminName}`,
            lastMessage: brokerConversation?.messages?.[0]?.text || null,
            lastMessageAt: brokerConversation?.lastMessageAt || null,
            unreadCount: 0,
            isPlaceholder: !brokerConversation?.id,
            participant: {
              id: principalBroker.id,
              role: "BROKER",
              name: adminName,
              profileImage: principalBroker.profileImage || null,
            },
          });
        }

        const { officers: assignedOfficers } =
          await listAssignedStaffForLoanChat(
            prisma,
            loanId,
            loan.brokerUser || null,
          );

        const officerEntries = buildSubBrokerLoanOfficerConversationEntries({
          officers: assignedOfficers,
          conversations: existingConversations,
          subBrokerId: userId,
        });

        formatted.push(...officerEntries);

        const formattedWithUnread = await enrichLoanConversationItems(prisma, {
          items: formatted,
          conversations: [
            ...existingConversations,
            teamConversation,
          ].filter(Boolean),
          userId,
          userEmail: req.user?.email,
        });

        return reply.send({
          success: true,
          data: {
            loanId,
            total: formattedWithUnread.length,
            conversations: enrichConversationList(
              formattedWithUnread,
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
