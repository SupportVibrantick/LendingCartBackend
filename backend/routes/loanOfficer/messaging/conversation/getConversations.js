/**
 * Get all conversations for a loan
 * (Client + all Lender chats)
 */

const {
  findBrokerAdmin,
  buildOfficerSideEntry,
  filterLoanOfficerClientThreads,
  formatBrokerOfficerInboxEntry,
  resolvePrincipalBrokerDisplay,
} = require("../../../../services/messaging/brokerOfficerConversation");
const { resolveClientDisplayName } = require("../../../../services/messaging/resolveClientDisplayName");
const {
  getConversationListFilters,
  shouldShowBrokerOfficerPlaceholder,
} = require("../../../../services/messaging/messagingAccess");
const {
  resolveViewerRole,
  enrichConversationList,
} = require("../../../../services/messaging/conversationPresentation");
const { extraOfficerPermission, LOAN_OFFICER_MESSAGING_PERMISSIONS } = require("../../../../services/broker/loanOfficerAccess");

module.exports = async function getConversations(fastify) {
  fastify.get(
    "/loan/:loanId/conversations",
    {
      preHandler: extraOfficerPermission(fastify, LOAN_OFFICER_MESSAGING_PERMISSIONS),
      schema: {
        tags: ["Messaging"],
        summary: "Get all conversations for a loan",
        params: {
          type: "object",
          required: ["loanId"],
          properties: {
            loanId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { loanId } = req.params;

      try {
        /* =====================================================
           1️⃣ AUTH CHECK
        ===================================================== */

        if (!req.user) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        /* =====================================================
           2️⃣ FETCH LOAN (ACCESS VALIDATION)
        ===================================================== */

        const loan = await prisma.loanApplication.findUnique({
          where: { id: loanId },
          select: {
            id: true,
            brokerOrgId: true,
            brokerUserId: true,
            clientId: true,
          },
        });

        if (!loan) {
          return reply.code(404).send({
            success: false,
            message: "Loan not found",
          });
        }

        // Broker + Sub Broker access
        // Broker + Sub Broker access

        if (
          (req.user.orgType === "BROKER" || req.user.role === "SUB_BROKER") &&
          loan.brokerOrgId !== req.user.organizationId
        ) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        if (
          req.user.roles?.includes("BROKER_OFFICER") &&
          loan.brokerUserId !== (req.user.id || req.user.userId)
        ) {
          return reply.code(403).send({
            success: false,
            message: "Access denied - not assigned to you",
          });
        }

        // Client access (optional depending on your auth)
        if (
          (req.user.orgType === "CLIENT" || req.user.role === "CLIENT") &&
          loan.clientId !== req.user.clientId
        ) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        let lenderAccess = null;

        if (req.user.orgType === "LENDER") {
          lenderAccess = await prisma.applicationLender.findFirst({
            where: {
              loanApplicationId: loanId,
              lenderOrgId: req.user.organizationId,
            },
            select: {
              id: true,
            },
          });

          if (!lenderAccess) {
            return reply.code(403).send({
              success: false,
              message: "Access denied",
            });
          }
        }

        /* =====================================================
           3️⃣ FETCH CONVERSATIONS
        ===================================================== */

        const userId = req.user?.id || req.user?.userId || req.user?.clientId;
        const userEmail = req.user?.email || req.user?.clientEmail;

        let conversations = await prisma.conversation.findMany({
          where: {
            loanApplicationId: loanId,
            ...getConversationListFilters(req, {
              userId,
              userEmail,
              lenderAccessId: lenderAccess?.id,
            }),
          },
          include: {
            participants: true,
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1, // last message preview
            },
          },
          orderBy: {
            lastMessageAt: "desc",
          },
        });

        if (req.user.roles?.includes("BROKER_OFFICER")) {
          conversations = filterLoanOfficerClientThreads(conversations);
        }

        /* =====================================================
           4️⃣ ENRICH DATA (CLIENT / LENDER NAME)
        ===================================================== */

        const subBrokerParticipantIds = conversations.flatMap((conv) =>
          conv.participants
            .filter((p) => p.participantType === "SUB_BROKER")
            .map((p) => p.participantId),
        );

        const subBrokerUsers = await prisma.userAccount.findMany({
          where: {
            id: {
              in: subBrokerParticipantIds,
            },
          },

          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        });

        const subBrokerMap = new Map(subBrokerUsers.map((u) => [u.id, u]));

        const principalBroker = await resolvePrincipalBrokerDisplay(
          prisma,
          loan.brokerOrgId,
        );

        const formatted = await Promise.all(
          conversations.map(async (conv) => {
            let title = "Conversation";
            let participant = null;

            // CLIENT CHAT
            if (conv.type === "CLIENT_BROKER") {
              const clientName = await resolveClientDisplayName(prisma, {
                clientId: loan.clientId,
                loanApplicationId: loanId,
              });

              title = `Client - ${clientName}`;

              return {
                id: conv.id,
                type: conv.type,
                chatCategory: conv.chatCategory || null,
                title,
                clientName,
                lastMessage: conv.messages[0]?.text || null,
                lastMessageAt: conv.lastMessageAt,
                unread: false,
              };
            }

            // LENDER CHAT
            if (conv.type === "BROKER_LENDER" && conv.applicationLenderId) {
              const appLender = await prisma.applicationLender.findUnique({
                where: { id: conv.applicationLenderId },
                include: {
                  lender: {
                    select: { name: true },
                  },
                },
              });

              title = `Lender - ${appLender?.lender?.name || "Unknown"}`;
            }

            // SUB BROKER CHAT

            if (conv.type === "SUBBROKER_BROKER") {
              const subBrokerParticipant = conv.participants.find(
                (p) => p.participantType === "SUB_BROKER",
              );

              const subBroker = subBrokerMap.get(
                subBrokerParticipant?.participantId,
              );

              const subBrokerName =
                `${subBroker?.firstName || ""} ${
                  subBroker?.lastName || ""
                }`.trim() || "Sub Broker";
              title =
                conv.chatCategory === "LOAN_OFFICER"
                  ? `Sub Broker • ${subBrokerName} (Loan Officer Chat)`
                  : `Sub Broker • ${subBrokerName}`;
            }

            if (conv.type === "BROKER_OFFICER") {
              const brokerOfficerMeta = formatBrokerOfficerInboxEntry({
                loan,
                isLoanOfficerViewer: true,
                principalBroker,
              });
              title = brokerOfficerMeta.title;
              participant = brokerOfficerMeta.participant;
            }

            if (conv.type === "CLIENT_OFFICER") {
              const clientName = await resolveClientDisplayName(prisma, {
                clientId: loan.clientId,
                loanApplicationId: loanId,
              });

              title = `Client • ${clientName}`;

              return {
                id: conv.id,
                type: conv.type,
                chatCategory: conv.chatCategory || null,
                title,
                clientName,
                lastMessage: conv.messages[0]?.text || null,
                lastMessageAt: conv.lastMessageAt,
                unread: false,
              };
            }

            return {
              id: conv.id,

              type: conv.type,

              chatCategory: conv.chatCategory || null,
              title,
              participant,
              lastMessage: conv.messages[0]?.text || null,
              lastMessageAt: conv.lastMessageAt,
              unread: false, // (we’ll handle later)
            };
          }),
        );

        const brokerAdmin = await findBrokerAdmin(prisma, loan.brokerOrgId);
        const officerConversation = conversations.find(
          (conv) => conv.type === "BROKER_OFFICER",
        );

        if (
          brokerAdmin &&
          !officerConversation &&
          shouldShowBrokerOfficerPlaceholder(req)
        ) {
          formatted.unshift(buildOfficerSideEntry(null, brokerAdmin));
        }

        /* =====================================================
           5️⃣ RESPONSE
        ===================================================== */

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
            userId: req.user?.id,
          },
          "Failed to fetch conversations",
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    },
  );
};
