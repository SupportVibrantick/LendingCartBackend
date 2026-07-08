/**
 * Get all conversations for a loan
 * (Client + all Lender chats)
 */

const {
  buildBrokerSideEntry,
  buildClientSideOfficerEntry,
  resolvePrincipalBrokerDisplay,
  formatBrokerOfficerInboxEntry,
  filterLoanOfficerClientThreads,
  filterBrokerAdminClientThreads,
} = require("../../../../services/messaging/brokerOfficerConversation");
const { resolveClientDisplayName } = require("../../../../services/messaging/resolveClientDisplayName");
const {
  getConversationListFilters,
  shouldShowBrokerOfficerPlaceholder,
  isClientUser,
  isLenderUser,
  hasRole,
} = require("../../../../services/messaging/messagingAccess");
const {
  resolveViewerRole,
  enrichConversationList,
} = require("../../../../services/messaging/conversationPresentation");
const { buildLenderLoanInbox } = require("../../../../services/messaging/lenderBrokerConversation");

module.exports = async function getConversations(fastify) {
  fastify.get(
    "/loan/:loanId/conversations",
    {
      preHandler: [fastify.authenticate],
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

        if (isLenderUser(req)) {
          lenderAccess = await prisma.applicationLender.findFirst({
            where: {
              loanApplicationId: loanId,
              lenderOrgId: req.user.organizationId || req.user.orgId,
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

        if (hasRole(req.user, "BROKER_OFFICER")) {
          conversations = filterLoanOfficerClientThreads(conversations);
        } else if (
          req.user.orgType === "BROKER" &&
          !hasRole(req.user, "SUB_BROKER")
        ) {
          conversations = filterBrokerAdminClientThreads(conversations);
        }

        const principalBroker = await resolvePrincipalBrokerDisplay(
          prisma,
          loan.brokerOrgId,
        );

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

              const lenderName = appLender?.lender?.name || "Unknown";
              title = `Lender - ${lenderName}`;

              if (isLenderUser(req)) {
                const principalBroker = await resolvePrincipalBrokerDisplay(
                  prisma,
                  loan.brokerOrgId,
                );

                return {
                  id: conv.id,
                  type: conv.type,
                  chatCategory: conv.chatCategory || null,
                  title,
                  lenderName,
                  brokerName: principalBroker.name,
                  participant: {
                    id: principalBroker.id,
                    role: "BROKER_ADMIN",
                    name: principalBroker.name,
                    profileImage: principalBroker.profileImage,
                  },
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
                lenderName,
                lastMessage: conv.messages[0]?.text || null,
                lastMessageAt: conv.lastMessageAt,
                unread: false,
              };
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
                isLoanOfficerViewer: hasRole(req.user, "BROKER_OFFICER"),
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

        if (loan.brokerUser && shouldShowBrokerOfficerPlaceholder(req)) {
          const officerConversation = conversations.find(
            (conv) => conv.type === "BROKER_OFFICER",
          );

          if (!officerConversation) {
            formatted.unshift(
              buildBrokerSideEntry(null, loan.brokerUser),
            );
          }
        }

        if (isLenderUser(req) && lenderAccess) {
          const lenderInbox = await buildLenderLoanInbox(prisma, {
            loanId,
            lenderAccessId: lenderAccess.id,
            lenderOrgId: req.user.organizationId || req.user.orgId,
            brokerOrgId: loan.brokerOrgId,
          });

          return reply.send({
            success: true,
            data: {
              loanId,
              total: lenderInbox.length,
              conversations: enrichConversationList(
                lenderInbox,
                resolveViewerRole(req),
              ),
            },
          });
        }

        if (isClientUser(req)) {
          const principalBroker = await resolvePrincipalBrokerDisplay(
            prisma,
            loan.brokerOrgId,
          );

          const clientConversations = [];

          const brokerConversation = formatted.find(
            (item) => item.type === "CLIENT_BROKER",
          );

          if (brokerConversation) {
            clientConversations.push({
              ...brokerConversation,
              brokerName: principalBroker.name,
              participant: {
                id: principalBroker.id,
                role: "BROKER_ADMIN",
                name: principalBroker.name,
                profileImage: principalBroker.profileImage,
              },
            });
          }

          if (loan.brokerUser) {
            const officerConversation = formatted.find(
              (item) => item.type === "CLIENT_OFFICER",
            );

            clientConversations.push(
              buildClientSideOfficerEntry(
                officerConversation || null,
                loan.brokerUser,
              ),
            );
          }

          return reply.send({
            success: true,
            data: {
              loanId,
              total: clientConversations.length,
              conversations: enrichConversationList(
                clientConversations,
                resolveViewerRole(req),
              ),
            },
          });
        }

        const viewerRole = resolveViewerRole(req);

        /* =====================================================
           5️⃣ RESPONSE
        ===================================================== */

        return reply.send({
          success: true,
          data: {
            loanId,
            total: formatted.length,
            conversations: enrichConversationList(formatted, viewerRole),
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
