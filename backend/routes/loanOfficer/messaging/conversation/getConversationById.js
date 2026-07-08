/**
 * Get single conversation details (FINAL - SAFE + ENHANCED)
 */

const { assertConversationTypeAccess } = require("../../../../services/messaging/messagingAccess");

module.exports = async function getConversationById(fastify) {
  fastify.get(
    "/conversation/:conversationId",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Messaging"],
        summary: "Get conversation details",
        params: {
          type: "object",
          required: ["conversationId"],
          properties: {
            conversationId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { conversationId } = req.params;
      const normalize = (str) => str?.trim().toLowerCase();

      try {
        /* ================= AUTH CHECK ================= */

        if (!req.user) {
          console.error("No user found in request");
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        const userId = req.user?.id || req.user?.userId || req.user?.clientId;
        const userEmail = req.user?.email || req.user?.clientEmail;

        console.log("REQ USER FULL:", req.user);
        console.log("USER EMAIL:", userEmail);

        if (!userId && !userEmail) {
          console.error("Invalid user token");
          return reply.code(401).send({
            success: false,
            message: "Invalid user token",
          });
        }

        /* ================= FETCH CONVERSATION ================= */

        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
          include: {
            participants: true,
          },
        });

        console.log(
          "Conversation Participants:",
          conversation?.participants?.map((p) => ({
            participantId: p.participantId,
            participantEmail: p.participantEmail,
            participantType: p.participantType,
          })),
        );

        if (!conversation) {
          console.error("Conversation not found:", conversationId);
          return reply.code(404).send({
            success: false,
            message: "Conversation not found",
          });
        }

        const typeAccessError = assertConversationTypeAccess(
          req,
          conversation.type,
        );
        if (typeAccessError) {
          return reply.code(typeAccessError.code).send({
            success: false,
            message: typeAccessError.message,
          });
        }

        console.log("Conversation fetched:", {
          conversationId,
          participantsCount: conversation.participants.length,
        });

        /* ================= PARTICIPANT VALIDATION ================= */

        const isParticipant = conversation.participants.some((p) => {
          const matchById =
            p.participantId &&
            userId &&
            p.participantId === userId;

          const matchByEmail =
            p.participantEmail &&
            userEmail &&
            normalize(p.participantEmail) === normalize(userEmail);

          console.log("CHECKING PARTICIPANT:", {
            dbParticipantId: p.participantId,
            dbParticipantEmail: p.participantEmail,
            requestUserId: userId,
            requestUserEmail: userEmail,
            matchById,
            matchByEmail,
          });

          return matchById || matchByEmail;
        });

        let hasFallbackAccess = false;

        if (
          !isParticipant &&
          req.user?.orgType === "LENDER" &&
          req.user?.organizationId &&
          conversation.applicationLenderId
        ) {
          const lenderAccess = await prisma.applicationLender.findFirst({
            where: {
              id: conversation.applicationLenderId,
              lenderOrgId: req.user.organizationId,
            },
            select: { id: true },
          });

          hasFallbackAccess = Boolean(lenderAccess);
        }

        if (
          !isParticipant &&
          !hasFallbackAccess &&
          req.user?.orgType === "BROKER" &&
          req.user?.organizationId &&
          conversation.loanApplicationId
        ) {
          const brokerAccess = await prisma.loanApplication.findFirst({
            where: {
              id: conversation.loanApplicationId,
              brokerOrgId: req.user.organizationId,
            },
            select: { id: true },
          });

          hasFallbackAccess = Boolean(brokerAccess);
        }

        if (!isParticipant && !hasFallbackAccess) {
          console.error("Access denied:", {
            userId,
            userEmail,
            conversationId,
            participants: conversation.participants,
          });

          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        console.log("Conversation access mode:", {
          conversationId,
          isParticipant,
          hasFallbackAccess,
          orgType: req.user?.orgType,
        });

        /* ================= BUILD TITLE ================= */

        let title = "Conversation";

        try {
          if (conversation.type === "CLIENT_BROKER") {
            const loan = await prisma.loanApplication.findUnique({
              where: { id: conversation.loanApplicationId },
              select: {
                client: {
                  select: { legalName: true },
                },
              },
            });

            title = `Client - ${loan?.client?.legalName || "Unknown"}`;
          }

          if (
            conversation.type === "BROKER_LENDER" &&
            conversation.applicationLenderId
          ) {
            const appLender = await prisma.applicationLender.findUnique({
              where: { id: conversation.applicationLenderId },
              select: {
                lender: {
                  select: { name: true },
                },
              },
            });

            title = `Lender - ${appLender?.lender?.name || "Unknown"}`;
          }
        } catch (err) {
          console.error("Title generation failed:", err.message);
        }

        /* ================= ENRICH PARTICIPANTS ================= */

        let enrichedParticipants = [];

        try {
          const userIds = conversation.participants
            .filter(
              (p) =>
                p.participantId &&
                (p.participantType === "BROKER" ||
                  p.participantType === "LENDER" ||
                  p.participantType === "SUB_BROKER"),
            )
            .map((p) => p.participantId);

          const clientIds = conversation.participants
            .filter((p) => p.participantId && p.participantType === "CLIENT")
            .map((p) => p.participantId);

          const users = await prisma.userAccount.findMany({
            where: { id: { in: userIds } },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              organization: { select: { name: true } },
            },
          });

          const clients = await prisma.clientPortalUser.findMany({
            where: { id: { in: clientIds } },
            select: {
              id: true,
              client: { select: { legalName: true } },
            },
          });

          const userMap = new Map(users.map((u) => [u.id, u]));
          const clientMap = new Map(clients.map((c) => [c.id, c]));

          if (conversation.type === "SUBBROKER_BROKER") {
            const subBrokerParticipant = conversation.participants.find(
              (p) => p.participantType === "SUB_BROKER",
            );

            const subBroker = userMap.get(subBrokerParticipant?.participantId);

            const subBrokerName =
              `${subBroker?.firstName || ""} ${
                subBroker?.lastName || ""
              }`.trim() || "Sub Broker";

            title =
              conversation.chatCategory === "LOAN_OFFICER"
                ? `Sub Broker • ${subBrokerName} (Loan Officer Chat)`
                : `Sub Broker • ${subBrokerName}`;
          }

          if (conversation.type === "BROKER_OFFICER") {
            const brokerParticipant = conversation.participants.find(
              (p) => p.participantType === "BROKER",
            );

            const otherBrokerParticipant = conversation.participants.filter(
              (p) => p.participantType === "BROKER",
            );

            const adminParticipant =
              otherBrokerParticipant.length > 1
                ? otherBrokerParticipant.find(
                    (p) => p.participantId !== req.user?.id && p.participantId !== req.user?.userId,
                  ) || otherBrokerParticipant[0]
                : brokerParticipant;

            const adminUser = userMap.get(adminParticipant?.participantId);

            const adminName =
              `${adminUser?.firstName || ""} ${
                adminUser?.lastName || ""
              }`.trim() || "Broker";
            title = `Principal Broker • ${adminName}`;
          }

          enrichedParticipants = conversation.participants.map((p) => {
            let name = "Unknown";

            if (
              p.participantType === "BROKER" ||
              p.participantType === "LENDER" ||
              p.participantType === "SUB_BROKER"
            ) {
              const user = userMap.get(p.participantId);
              name =
                user?.organization?.name ||
                `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
                "User";
            }

            if (p.participantType === "CLIENT") {
              const client = clientMap.get(p.participantId);
              name = client?.client?.legalName || p.participantEmail || "Client";
            }

            return {
              ...p,
              name,
            };
          });
        } catch (err) {
          console.error("Name enrichment failed:", err.message);
          enrichedParticipants = conversation.participants;
        }

        /* ================= RESPONSE ================= */

        console.log("Conversation access granted:", conversationId);

        return reply.send({
          success: true,
          data: {
            id: conversation.id,
            type: conversation.type,
            loanApplicationId: conversation.loanApplicationId,
            applicationLenderId: conversation.applicationLenderId,
            title,
            participants: enrichedParticipants,
            lastMessageAt: conversation.lastMessageAt,
            createdAt: conversation.createdAt,
          },
        });
      } catch (error) {
        console.error("SERVER ERROR:", {
          message: error.message,
          stack: error.stack,
          conversationId,
        });

        fastify.log.error(
          {
            error: error.message,
            stack: error.stack,
            conversationId,
            userId: req.user?.id || req.user?.userId || req.user?.clientId,
          },
          "Failed to fetch conversation",
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    },
  );
};
