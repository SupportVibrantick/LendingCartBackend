/**
 * Get all conversations for a loan
 * (Client + all Lender chats)
 */

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

        /* =====================================================
           3️⃣ FETCH CONVERSATIONS
        ===================================================== */

        const conversations = await prisma.conversation.findMany({
          where: {
            loanApplicationId: loanId,

            ...(req.user.role === "SUB_BROKER"
              ? {
                  participants: {
                    some: {
                      participantId: req.user.userId,
                    },
                  },
                }
              : {}),
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

            // CLIENT CHAT
            if (conv.type === "CLIENT_BROKER") {
              const client = await prisma.client.findUnique({
                where: { id: loan.clientId },
                select: { legalName: true },
              });

              title = `Client - ${client?.legalName || "Unknown"}`;
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

            return {
              id: conv.id,

              type: conv.type,

              chatCategory: conv.chatCategory || null,
              title,
              lastMessage: conv.messages[0]?.text || null,
              lastMessageAt: conv.lastMessageAt,
              unread: false, // (we’ll handle later)
            };
          }),
        );

        /* =====================================================
           5️⃣ RESPONSE
        ===================================================== */

        return reply.send({
          success: true,
          data: {
            loanId,
            total: formatted.length,
            conversations: formatted,
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
