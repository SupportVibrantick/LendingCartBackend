/**
 * Get all conversations for a loan
 * (Client + all Lender chats)
 */

const {
  syncClientBrokerTeamParticipants,
  isCoBrokerClientChannel,
  resolvePrincipalBrokerDisplay,
  formatBrokerOfficerInboxEntry,
  filterLoanOfficerClientThreads,
  filterBrokerAdminClientThreads,
  listAssignedStaffForLoanChat,
  buildAssignedStaffConversationEntries,
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
const {
  filterLoanConversationsBySearch,
} = require("../../../../services/messaging/filterLoanConversationsBySearch");
const {
  enrichLoanConversationItems,
} = require("../../../../services/messaging/conversationUnread");
const {
  resolvePortalClientIds,
} = require("../../../../utils/auth/clientPortalAuth");

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
        querystring: {
          type: "object",
          properties: {
            search: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { loanId } = req.params;
      const search = (req.query.search || "").trim();

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

        // Client access — portal login may map to multiple broker Client records
        if (req.user.orgType === "CLIENT" || req.user.role === "CLIENT") {
          const clientIds = await resolvePortalClientIds(prisma, {
            portalUserId: req.user.id || req.user.userId,
            clientId: req.user.clientId,
            email: req.user.email || req.user.clientEmail,
          });
          const allowedClientIds =
            clientIds.length > 0
              ? clientIds
              : [req.user.clientId].filter(Boolean);

          if (
            !loan.clientId ||
            !allowedClientIds.includes(loan.clientId)
          ) {
            return reply.code(403).send({
              success: false,
              message: "Access denied",
            });
          }
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

        if (isClientUser(req)) {
          const principalBroker = await resolvePrincipalBrokerDisplay(
            prisma,
            loan.brokerOrgId,
          );

          await syncClientBrokerTeamParticipants(prisma, {
            loanApplicationId: loanId,
            brokerOrgId: loan.brokerOrgId,
          });

          const [brokerConversation, officerConversation] = await Promise.all([
            prisma.conversation.findFirst({
              where: {
                loanApplicationId: loanId,
                type: "CLIENT_BROKER",
                OR: [
                  { chatCategory: null },
                  { chatCategory: "PRINCIPAL" },
                  { chatCategory: "PRINCIPAL_BROKER" },
                ],
              },
              include: {
                messages: {
                  orderBy: { createdAt: "desc" },
                  take: 1,
                },
              },
            }),
            prisma.conversation.findFirst({
              where: {
                loanApplicationId: loanId,
                type: "CLIENT_OFFICER",
              },
              include: {
                messages: {
                  orderBy: { createdAt: "desc" },
                  take: 1,
                },
              },
            }),
          ]);

          const teamDisplayName =
            principalBroker.orgName ||
            principalBroker.adminName ||
            principalBroker.name ||
            "Your Broker Team";

          const clientConversations = [];

          if (brokerConversation || officerConversation) {
            const brokerLastAt = brokerConversation?.lastMessageAt
              ? new Date(brokerConversation.lastMessageAt).getTime()
              : 0;
            const officerLastAt = officerConversation?.lastMessageAt
              ? new Date(officerConversation.lastMessageAt).getTime()
              : 0;

            clientConversations.push({
              id: brokerConversation?.id || `broker-${loanId}`,
              type: "CLIENT_BROKER",
              chatCategory: null,
              title: `Your Broker Team • ${teamDisplayName}`,
              brokerName: teamDisplayName,
              lastMessage:
                officerLastAt > brokerLastAt
                  ? officerConversation?.messages?.[0]?.text ||
                    brokerConversation?.messages?.[0]?.text ||
                    null
                  : brokerConversation?.messages?.[0]?.text ||
                    officerConversation?.messages?.[0]?.text ||
                    null,
              lastMessageAt:
                officerLastAt > brokerLastAt
                  ? officerConversation?.lastMessageAt ||
                    brokerConversation?.lastMessageAt ||
                    null
                  : brokerConversation?.lastMessageAt ||
                    officerConversation?.lastMessageAt ||
                    null,
              unread: false,
              participant: {
                id: principalBroker.id,
                role: "BROKER_ADMIN",
                name: principalBroker.adminName || teamDisplayName,
                profileImage: principalBroker.profileImage,
              },
              isPlaceholder: !brokerConversation?.id,
            });
          }

          const filteredClientConversations = await filterLoanConversationsBySearch(
            prisma,
            loanId,
            await enrichLoanConversationItems(prisma, {
              items: clientConversations,
              conversations: [brokerConversation, officerConversation].filter(Boolean),
              userId,
              userEmail,
            }),
            search,
          );

          return reply.send({
            success: true,
            data: {
              loanId,
              total: filteredClientConversations.length,
              conversations: enrichConversationList(
                filteredClientConversations,
                resolveViewerRole(req),
              ),
            },
          });
        }

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

        const injectStaffContacts =
          shouldShowBrokerOfficerPlaceholder(req) &&
          !hasRole(req.user, "BROKER_OFFICER") &&
          !hasRole(req.user, "SUB_BROKER");

        const { officers: assignedOfficers, coBrokers: assignedCoBrokers } =
          injectStaffContacts
            ? await listAssignedStaffForLoanChat(
                prisma,
                loanId,
                loan.brokerUser,
              )
            : { officers: [], coBrokers: [] };

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
            profileImage: true,
          },
        });

        const subBrokerMap = new Map(subBrokerUsers.map((u) => [u.id, u]));

        const formatted = await Promise.all(
          conversations.map(async (conv) => {
            let title = "Conversation";
            let participant = null;

            // CLIENT CHAT
            if (conv.type === "CLIENT_BROKER") {
              if (
                injectStaffContacts &&
                isCoBrokerClientChannel(conv.chatCategory)
              ) {
                return null;
              }

              const clientName = await resolveClientDisplayName(prisma, {
                clientId: loan.clientId,
                loanApplicationId: loanId,
              });

              if (isCoBrokerClientChannel(conv.chatCategory)) {
                const subBrokerParticipant = conv.participants.find(
                  (p) => p.participantType === "SUB_BROKER",
                );
                const subBroker = subBrokerMap.get(
                  subBrokerParticipant?.participantId,
                );
                const coBrokerName =
                  `${subBroker?.firstName || ""} ${
                    subBroker?.lastName || ""
                  }`.trim() || "Co-Broker";

                title = `Co-Broker • ${coBrokerName}`;

                return {
                  id: conv.id,
                  type: conv.type,
                  chatCategory: conv.chatCategory,
                  title,
                  subBrokerName: coBrokerName,
                  participant: {
                    id: subBroker?.id,
                    role: "SUB_BROKER",
                    name: coBrokerName,
                    profileImage: subBroker?.profileImage || null,
                  },
                  lastMessage: conv.messages[0]?.text || null,
                  lastMessageAt: conv.lastMessageAt,
                  unread: false,
                };
              }

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
              if (
                injectStaffContacts &&
                conv.chatCategory !== "LOAN_OFFICER"
              ) {
                return null;
              }
              const subBrokerParticipant = conv.participants.find(
                (p) => p.participantType === "SUB_BROKER",
              );

              const subBroker = subBrokerMap.get(
                subBrokerParticipant?.participantId,
              );

              const subBrokerName =
                `${subBroker?.firstName || ""} ${
                  subBroker?.lastName || ""
                }`.trim() || "Co-Broker";

              const loanOfficerName = loan.brokerUser
                ? `${loan.brokerUser.firstName || ""} ${
                    loan.brokerUser.lastName || ""
                  }`.trim() || null
                : null;

              const isLoanOfficerChannel =
                conv.chatCategory === "LOAN_OFFICER";

              participant = {
                id: subBroker?.id,
                role: "SUB_BROKER",
                name: subBrokerName,
                profileImage: subBroker?.profileImage || null,
              };

              title = isLoanOfficerChannel
                ? `Sub Broker • ${subBrokerName} → ${loanOfficerName || "Loan Officer"}`
                : `Sub Broker • ${subBrokerName}`;

              return {
                id: conv.id,
                type: conv.type,
                chatCategory: conv.chatCategory || null,
                title,
                participant,
                subBrokerName,
                loanOfficerName: isLoanOfficerChannel ? loanOfficerName : null,
                lastMessage: conv.messages[0]?.text || null,
                lastMessageAt: conv.lastMessageAt,
                unread: false,
              };
            }

            if (conv.type === "BROKER_OFFICER") {
              if (injectStaffContacts) {
                return null;
              }
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

        const staffEntries = injectStaffContacts
          ? (() => {
              const { officerEntries, coBrokerEntries } =
                buildAssignedStaffConversationEntries({
                  officers: assignedOfficers,
                  coBrokers: assignedCoBrokers,
                  conversations,
                  primaryOfficerId: loan.brokerUserId,
                });
              return [...officerEntries, ...coBrokerEntries];
            })()
          : [];

        const formattedItems = formatted.filter(Boolean);
        const clientItems = formattedItems.filter(
          (item) =>
            item.type === "CLIENT_BROKER" || item.type === "CLIENT_OFFICER",
        );
        const otherItems = formattedItems.filter(
          (item) =>
            item.type !== "CLIENT_BROKER" && item.type !== "CLIENT_OFFICER",
        );
        const mergedFormatted = [
          ...clientItems,
          ...staffEntries,
          ...otherItems,
        ];

        if (isLenderUser(req) && lenderAccess) {
          const { inbox: lenderInbox, conversations: lenderConversations } =
            await buildLenderLoanInbox(prisma, {
            loanId,
            lenderAccessId: lenderAccess.id,
            lenderOrgId: req.user.organizationId || req.user.orgId,
            brokerOrgId: loan.brokerOrgId,
          });

          const filteredInbox = await filterLoanConversationsBySearch(
            prisma,
            loanId,
            await enrichLoanConversationItems(prisma, {
              items: lenderInbox,
              conversations: lenderConversations,
              userId,
              userEmail,
            }),
            search,
          );

          return reply.send({
            success: true,
            data: {
              loanId,
              total: filteredInbox.length,
              conversations: enrichConversationList(
                filteredInbox,
                resolveViewerRole(req),
              ),
            },
          });
        }

        const viewerRole = resolveViewerRole(req);

        const dedupedFormatted = mergedFormatted.filter((item) => {
          if (
            viewerRole === "BROKER" &&
            item.type === "SUBBROKER_BROKER" &&
            item.chatCategory === "LOAN_OFFICER" &&
            item.participant?.id &&
            loan.brokerUserId &&
            item.participant.id === loan.brokerUserId
          ) {
            return false;
          }
          return true;
        });

        const dedupedWithUnread = await enrichLoanConversationItems(prisma, {
          items: dedupedFormatted,
          conversations,
          userId,
          userEmail,
        });

        /* =====================================================
           5️⃣ RESPONSE
        ===================================================== */

        const filteredFormatted = await filterLoanConversationsBySearch(
          prisma,
          loanId,
          dedupedWithUnread,
          search,
        );

        return reply.send({
          success: true,
          data: {
            loanId,
            total: filteredFormatted.length,
            conversations: enrichConversationList(filteredFormatted, viewerRole),
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
