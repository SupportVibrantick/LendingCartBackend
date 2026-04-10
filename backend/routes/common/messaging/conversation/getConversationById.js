/**
 * Get single conversation details (FINAL - SAFE + ENHANCED)
 */

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

      try {
        /* ================= AUTH CHECK ================= */

        if (!req.user) {
          console.error("❌ No user found in request");
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        // ✅ FIX: universal userId (no breaking)
        const userId =
          req.user?.id ||
          req.user?.userId ||
          req.user?.clientId;

        const userEmail = req.user?.email;

        console.log("🔍 Auth User:", { userId, userEmail });

        if (!userId && !userEmail) {
          console.error("❌ Invalid user token");
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

        if (!conversation) {
          console.error("❌ Conversation not found:", conversationId);
          return reply.code(404).send({
            success: false,
            message: "Conversation not found",
          });
        }

        console.log("📦 Conversation fetched:", {
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
            p.participantEmail.toLowerCase() === userEmail.toLowerCase();

          if (matchById || matchByEmail) {
            console.log("✅ Participant matched:", {
              participantId: p.participantId,
              participantEmail: p.participantEmail,
            });
          }

          return matchById || matchByEmail;
        });

        if (!isParticipant) {
          console.error("❌ Access denied:", {
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
          console.error("⚠️ Title generation failed:", err.message);
        }

        /* ================= 🔥 ENRICH PARTICIPANTS (NAMES - OPTIMIZED) ================= */

        let enrichedParticipants = [];

        try {
          const userIds = conversation.participants
            .filter(
              (p) =>
                p.participantId &&
                (p.participantType === "BROKER" ||
                  p.participantType === "LENDER")
            )
            .map((p) => p.participantId);

          const clientIds = conversation.participants
            .filter(
              (p) =>
                p.participantId && p.participantType === "CLIENT"
            )
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

          enrichedParticipants = conversation.participants.map((p) => {
            let name = "Unknown";

            if (
              p.participantType === "BROKER" ||
              p.participantType === "LENDER"
            ) {
              const user = userMap.get(p.participantId);
              name =
                user?.organization?.name ||
                `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
                "User";
            }

            if (p.participantType === "CLIENT") {
              const client = clientMap.get(p.participantId);
              name =
                client?.client?.legalName ||
                p.participantEmail ||
                "Client";
            }

            return {
              ...p,
              name, // ✅ added
            };
          });
        } catch (err) {
          console.error("❌ Name enrichment failed:", err.message);
          enrichedParticipants = conversation.participants;
        }

        /* ================= RESPONSE ================= */

        console.log("✅ Conversation access granted:", conversationId);

        return reply.send({
          success: true,
          data: {
            id: conversation.id,
            type: conversation.type,
            loanApplicationId: conversation.loanApplicationId,
            applicationLenderId: conversation.applicationLenderId,
            title,
            participants: enrichedParticipants, // ✅ enhanced
            lastMessageAt: conversation.lastMessageAt,
            createdAt: conversation.createdAt,
          },
        });

      } catch (error) {
        console.error("💥 SERVER ERROR:", {
          message: error.message,
          stack: error.stack,
          conversationId,
        });

        fastify.log.error(
          {
            error: error.message,
            stack: error.stack,
            conversationId,
            userId:
              req.user?.id ||
              req.user?.userId ||
              req.user?.clientId,
          },
          "Failed to fetch conversation"
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    }
  );
};