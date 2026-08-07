/**
 * Broker inbox — all conversations across loans for the logged-in org/user.
 */

const { resolveClientDisplayName } = require("../../../../services/messaging/resolveClientDisplayName");
const {
  resolvePrincipalBrokerDisplay,
  buildLoanOfficerInboxPlaceholders,
  filterLoanOfficerClientThreads,
  filterBrokerAdminClientThreads,
  formatBrokerOfficerInboxEntry,
} = require("../../../../services/messaging/brokerOfficerConversation");
const {
  getConversationListFilters,
  hasRole,
  getUserId,
} = require("../../../../services/messaging/messagingAccess");
const {
  resolveViewerRole,
  enrichConversationList,
} = require("../../../../services/messaging/conversationPresentation");

module.exports = async function getInbox(fastify) {
  fastify.get(
    "/inbox",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Messaging"],
        summary: "Get broker inbox (all conversations)",
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
            search: { type: "string" },
            type: {
              type: "string",
              enum: [
                "ALL",
                "CLIENT_BROKER",
                "CLIENT_OFFICER",
                "BROKER_LENDER",
                "BROKER_OFFICER",
                "SUBBROKER_BROKER",
              ],
            },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (!req.user) {
          return reply.code(401).send({ success: false, message: "Unauthorized" });
        }

        if (req.user.orgType !== "BROKER" && !hasRole(req.user, "SUB_BROKER")) {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const userId = getUserId(req.user);
        const userEmail = req.user?.email;
        const brokerOrgId = req.user.organizationId;

        if (!brokerOrgId) {
          return reply.code(403).send({
            success: false,
            message: "Broker organization not found",
          });
        }

        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 20);
        const search = (req.query.search || "").trim();
        const typeFilter = req.query.type || "ALL";
        const skip = (page - 1) * limit;

        const loanFilter = {
          brokerOrgId,
          ...(hasRole(req.user, "BROKER_OFFICER") && userId
            ? { brokerUserId: userId }
            : {}),
          ...(search
            ? {
                OR: [
                  {
                    applicationNumber: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                  {
                    client: {
                      legalName: { contains: search, mode: "insensitive" },
                    },
                  },
                ],
              }
            : {}),
        };

        const matchingLoans = await prisma.loanApplication.findMany({
          where: loanFilter,
          select: {
            id: true,
            applicationNumber: true,
            clientId: true,
            brokerUserId: true,
            client: {
              select: {
                legalName: true,
                contacts: {
                  where: { isPrimary: true },
                  take: 1,
                },
              },
            },
            brokerUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        });

        const loanMap = new Map(matchingLoans.map((loan) => [loan.id, loan]));
        const loanIds = matchingLoans.map((loan) => loan.id);

        if (loanIds.length === 0) {
          return reply.send({
            success: true,
            data: {
              page,
              limit,
              total: 0,
              totalPages: 0,
              conversations: [],
            },
          });
        }

        const where = {
          loanApplicationId: { in: loanIds },
          ...(typeFilter !== "ALL" ? { type: typeFilter } : {}),
          ...getConversationListFilters(req, { userId, userEmail }),
        };

        let [conversations, total] = await prisma.$transaction([
          prisma.conversation.findMany({
            where,
            include: {
              participants: true,
              messages: {
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
            orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
            skip,
            take: limit,
          }),
          prisma.conversation.count({ where }),
        ]);

        if (hasRole(req.user, "BROKER_OFFICER")) {
          conversations = filterLoanOfficerClientThreads(conversations);
          total = conversations.length;
        } else if (
          req.user.orgType === "BROKER" &&
          !hasRole(req.user, "SUB_BROKER")
        ) {
          conversations = filterBrokerAdminClientThreads(conversations);
          total = conversations.length;
        }

        const lenderIds = [
          ...new Set(
            conversations
              .filter((c) => c.applicationLenderId)
              .map((c) => c.applicationLenderId),
          ),
        ];

        const appLenders = lenderIds.length
          ? await prisma.applicationLender.findMany({
              where: { id: { in: lenderIds } },
              include: { lender: { select: { name: true } } },
            })
          : [];

        const lenderMap = new Map(appLenders.map((al) => [al.id, al]));

        const conversationLoanIds = [
          ...new Set(
            conversations
              .map((c) => c.loanApplicationId)
              .filter((id) => typeof id === "string" && id.length > 0),
          ),
        ];

        const submissions = conversationLoanIds.length
          ? await prisma.applicationSubmission.findMany({
              where: { applicationId: { in: conversationLoanIds } },
              orderBy: { createdAt: "desc" },
              select: { id: true, applicationId: true },
            })
          : [];

        const submissionMap = new Map();
        for (const sub of submissions) {
          if (!submissionMap.has(sub.applicationId)) {
            submissionMap.set(sub.applicationId, sub.id);
          }
        }

        const subBrokerIds = [
          ...new Set(
            conversations.flatMap((conv) =>
              conv.participants
                .filter((p) => p.participantType === "SUB_BROKER")
                .map((p) => p.participantId)
                .filter(Boolean),
            ),
          ),
        ];

        const subBrokers = subBrokerIds.length
          ? await prisma.userAccount.findMany({
              where: { id: { in: subBrokerIds } },
              select: { id: true, firstName: true, lastName: true },
            })
          : [];

        const subBrokerMap = new Map(subBrokers.map((u) => [u.id, u]));

        const principalBroker = await resolvePrincipalBrokerDisplay(
          prisma,
          brokerOrgId,
        );

        const formatted = await Promise.all(
          conversations.map(async (conv) => {
            const loan = loanMap.get(conv.loanApplicationId);

            if (!loan) {
              return null;
            }

            const lastMsg = conv.messages[0];
            const participation = conv.participants.find(
              (p) => p.participantId === userId,
            );

            let unreadCount = 0;

            if (userId) {
              unreadCount = await prisma.message.count({
                where: {
                  conversationId: conv.id,
                  ...(participation?.lastReadAt && {
                    createdAt: { gt: participation.lastReadAt },
                  }),
                  NOT: {
                    OR: [
                      { senderUserId: userId },
                      { senderClientUserId: userId },
                    ],
                  },
                },
              });
            }

            let title = "Conversation";
            let clientName = null;
            let lenderName = null;
            let participant = null;
            let brokerDisplayName = principalBroker.name;

            if (conv.type === "CLIENT_BROKER" || conv.type === "CLIENT_OFFICER") {
              clientName = await resolveClientDisplayName(prisma, {
                clientId: loan.clientId,
                loanApplicationId: loan.id,
              });
              title =
                conv.type === "CLIENT_OFFICER"
                  ? `Client • ${clientName}`
                  : `Client - ${clientName}`;
            }

            if (conv.type === "BROKER_LENDER" && conv.applicationLenderId) {
              const appLender = lenderMap.get(conv.applicationLenderId);
              lenderName = appLender?.lender?.name || "Lender";
              title = `Lender - ${lenderName}`;
            }

            if (conv.type === "SUBBROKER_BROKER") {
              const subParticipant = conv.participants.find(
                (p) => p.participantType === "SUB_BROKER",
              );
              const subBroker = subBrokerMap.get(subParticipant?.participantId);
              const subName =
                `${subBroker?.firstName || ""} ${subBroker?.lastName || ""}`.trim() ||
                "Sub Broker";
              title = `Sub Broker • ${subName}`;
            }

            if (conv.type === "BROKER_OFFICER") {
              const brokerOfficerMeta = formatBrokerOfficerInboxEntry({
                loan,
                isLoanOfficerViewer: hasRole(req.user, "BROKER_OFFICER"),
                principalBroker,
              });
              title = brokerOfficerMeta.title;
              participant = brokerOfficerMeta.participant;
              if (hasRole(req.user, "BROKER_OFFICER")) {
                brokerDisplayName = brokerOfficerMeta.brokerName;
              }
            }

            return {
              id: conv.id,
              type: conv.type,
              chatCategory: conv.chatCategory || null,
              title,
              clientName,
              lenderName,
              brokerName: brokerDisplayName,
              participant,
              loanApplicationId: loan.id,
              submissionId: submissionMap.get(loan.id) || null,
              applicationNumber: loan.applicationNumber,
              clientLegalName: loan.client?.legalName || null,
              lastMessage: lastMsg?.text || lastMsg?.fileName || null,
              lastMessageAt:
                conv.lastMessageAt || lastMsg?.createdAt || conv.updatedAt,
              unread: unreadCount > 0,
              unreadCount,
            };
          }),
        );

        let formattedList = formatted.filter(Boolean);

        if (page === 1 && hasRole(req.user, "BROKER_OFFICER") && !search) {
          const clientNameByLoan = new Map();

          for (const loan of matchingLoans) {
            clientNameByLoan.set(
              loan.id,
              loan.client?.legalName ||
                (await resolveClientDisplayName(prisma, {
                  clientId: loan.clientId,
                  loanApplicationId: loan.id,
                })),
            );
          }

          const placeholders = buildLoanOfficerInboxPlaceholders({
            loans: matchingLoans,
            existingConversations: conversations,
            principalBroker,
            submissionMap,
            typeFilter,
            clientNameResolver: (loan) => clientNameByLoan.get(loan.id) || "Client",
          });

          formattedList = [...formattedList, ...placeholders];
        }

        formattedList.sort((a, b) => {
          const aTime = a.lastMessageAt
            ? new Date(a.lastMessageAt).getTime()
            : 0;
          const bTime = b.lastMessageAt
            ? new Date(b.lastMessageAt).getTime()
            : 0;
          return bTime - aTime;
        });

        const adjustedTotal =
          page === 1 && hasRole(req.user, "BROKER_OFFICER") && !search
            ? formattedList.length
            : total;

        const viewerRole = resolveViewerRole(req);
        const conversationsList = enrichConversationList(
          formattedList,
          viewerRole,
        );

        return reply.send({
          success: true,
          data: {
            page,
            limit,
            total: adjustedTotal,
            totalPages: Math.ceil(adjustedTotal / limit) || 1,
            conversations: conversationsList,
          },
        });
      } catch (error) {
        fastify.log.error(
          { error: error.message, stack: error.stack },
          "Failed to fetch inbox",
        );
        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    },
  );
};
