/**
 * Get messages of a conversation
 */

const {
  assertCanAccessConversation,
  isClientUser,
} = require("../../../../services/messaging/messagingAccess");
const { resolveClientDisplayName } = require("../../../../services/messaging/resolveClientDisplayName");

module.exports = async function getMessages(fastify) {
  fastify.get(
    "/conversation/:conversationId/messages",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Messaging"],
        summary: "Get messages of a conversation",
        params: {
          type: "object",
          required: ["conversationId"],
          properties: {
            conversationId: { type: "string", format: "uuid" },
          },
        },
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { conversationId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      try {
        /* ================= AUTH CHECK ================= */

        if (!req.user) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        // ✅ SAFE USER ID (ALL CASES COVERED)
        const userId = req.user?.id || req.user?.userId || req.user?.clientId;

        if (!userId && !req.user?.email) {
          return reply.code(401).send({
            success: false,
            message: "Invalid user token",
          });
        }

        /* ================= VERIFY CONVERSATION ================= */

        const access = await assertCanAccessConversation(
          prisma,
          req.user,
          conversationId,
        );

        if (!access.allowed) {
          return reply.code(access.error?.code || 403).send({
            success: false,
            message: access.error?.message || "Access denied",
          });
        }

        const conversation = access.conversation;

        /* ================= PAGINATION ================= */

        const skip = (page - 1) * limit;

        /* ================= FETCH MESSAGES ================= */

        const messages = await prisma.message.findMany({
          where: { conversationId },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        });

        const brokerUserIds = [
          ...new Set(
            messages
              .filter(
                (m) =>
                  (m.senderType === "BROKER" || m.senderType === "SUB_BROKER") &&
                  m.senderUserId,
              )
              .map((m) => m.senderUserId),
          ),
        ];

        const clientUserIds = [
          ...new Set(
            messages
              .filter((m) => m.senderType === "CLIENT" && m.senderClientUserId)
              .map((m) => m.senderClientUserId),
          ),
        ];

        const clientUsers = await prisma.clientPortalUser.findMany({
          where: {
            id: {
              in: clientUserIds,
            },
          },
          include: {
            client: {
              include: {
                contacts: {
                  where: {
                    isPrimary: true,
                  },
                  take: 1,
                },
              },
            },
          },
        });

        const clientMap = new Map(clientUsers.map((c) => [c.id, c]));

        const brokerUsers = await prisma.userAccount.findMany({
          where: {
            id: {
              in: brokerUserIds,
            },
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            organization: {
              select: {
                name: true,
              },
            },
          },
        });

        const brokerMap = new Map(brokerUsers.map((u) => [u.id, u]));

        const total = await prisma.message.count({
          where: { conversationId },
        });

        let resolvedClientDisplayName = null;

        if (conversation.loanApplicationId) {
          const loan = await prisma.loanApplication.findUnique({
            where: { id: conversation.loanApplicationId },
            select: { clientId: true },
          });

          if (loan?.clientId) {
            resolvedClientDisplayName = await resolveClientDisplayName(prisma, {
              clientId: loan.clientId,
              loanApplicationId: conversation.loanApplicationId,
            });
          }
        }

        /* ================= FORMAT RESPONSE ================= */

        const formatted = messages.map((msg) => ({
          id: msg.id,

          conversationId: msg.conversationId,

          type: msg.type,

          text: msg.text,

          fileUrl: msg.fileUrl,

          fileName: msg.fileName,

          fileSize: msg.fileSize,

          mimeType: msg.mimeType,

          senderType: msg.senderType,

          senderUserId: msg.senderUserId,

          senderClientUserId: msg.senderClientUserId,

          senderRoleLabel: (() => {
            if (!isClientUser(req)) return null;
            if (msg.senderType === "SUB_BROKER") return "Co-Broker";
            if (msg.senderType === "BROKER") return "Loan Officer";
            return null;
          })(),

          senderName: (() => {
            if (msg.senderType === "SUB_BROKER" && msg.senderUserId) {
              const broker = brokerMap.get(msg.senderUserId);
              const name =
                `${broker?.firstName || ""} ${broker?.lastName || ""}`.trim();
              return name || msg.senderName || "Co-Broker";
            }

            if (msg.senderType === "BROKER") {
              if (msg.senderUserId) {
                const broker = brokerMap.get(msg.senderUserId);
                const name =
                  `${broker?.firstName || ""} ${broker?.lastName || ""}`.trim();

                return name || msg.senderName || "Broker";
              }
            }

            // Client
            if (msg.senderType === "CLIENT") {
              if (resolvedClientDisplayName) {
                return resolvedClientDisplayName;
              }

              if (msg.senderClientUserId) {
                const client = clientMap.get(msg.senderClientUserId);

                const primaryContact = client?.client?.contacts?.[0];

                return (
                  `${primaryContact?.firstName || ""} ${
                    primaryContact?.lastName || ""
                  }`.trim() ||
                  client?.client?.legalName ||
                  "Client"
                );
              }
            }

            return msg.senderName || null;
          })(),

          createdAt: msg.createdAt,
        }));

        /* ================= RESPONSE ================= */

        return reply.send({
          success: true,
          data: {
            conversationId,
            page,
            limit,
            total,
            messages: formatted.reverse(), // oldest → newest
          },
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            conversationId,
            userId: req.user?.id || req.user?.userId || req.user?.clientId,
          },
          "Failed to fetch messages",
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    },
  );
};
