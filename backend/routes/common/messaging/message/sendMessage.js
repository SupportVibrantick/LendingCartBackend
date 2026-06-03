/**
 * Send message in a conversation
 */

module.exports = async function sendMessage(fastify) {
  fastify.post(
    "/conversation/:conversationId/message",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Messaging"],
        summary: "Send message",
        params: {
          type: "object",
          required: ["conversationId"],
          properties: {
            conversationId: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          required: ["type"],
          properties: {
            type: {
              type: "string",
              enum: ["TEXT", "FILE", "SYSTEM"],
            },
            text: { type: "string" },
            fileUrl: { type: "string" },
            fileName: { type: "string" },
            fileSize: { type: "number" },
            mimeType: { type: "string" },
            metadata: { type: "object" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { conversationId } = req.params;
      const normalize = (str) => str?.trim().toLowerCase();

      const { type, text, fileUrl, fileName, fileSize, mimeType, metadata } =
        req.body;

      try {
        /* ================= AUTH ================= */

        if (!req.user) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        const userId = req.user?.id || req.user?.userId || req.user?.clientId;

        if (!userId) {
          return reply.code(401).send({
            success: false,
            message: "Invalid user token",
          });
        }

        console.log("👤 Sender:", req.user);

        /* ================= VALIDATION ================= */

        if (type === "TEXT" && !text) {
          return reply.code(400).send({
            success: false,
            message: "Text message cannot be empty",
          });
        }

        if (type === "FILE" && !fileUrl) {
          return reply.code(400).send({
            success: false,
            message: "File URL is required",
          });
        }

        /* ================= VERIFY CONVERSATION ================= */

        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: {
            id: true,
            loanApplicationId: true,
            applicationLenderId: true,
          },
        });

        if (!conversation) {
          return reply.code(404).send({
            success: false,
            message: "Conversation not found",
          });
        }

        /* ================= CHECK PARTICIPANT ================= */

        const participant =
          await prisma.conversationParticipant.findFirst({
            where: {
              conversationId,

              OR: [
                {
                  participantId: userId,
                },

                req.user?.email
                  ? {
                      participantEmail: normalize(req.user.email),
                    }
                  : undefined,
              ].filter(Boolean),
            },
          });

        let hasFallbackAccess = false;

        if (
          !participant &&
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
          !participant &&
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

        if (!participant && !hasFallbackAccess) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        /* ================= DETERMINE SENDER ================= */

        let senderType = "CLIENT";

        let senderUserId = null;

        let senderClientUserId = null;

        if (req.user.role === "SUB_BROKER") {
          senderType = "SUB_BROKER";

          senderUserId = userId;
        } else if (req.user.orgType === "BROKER") {
          senderType = "BROKER";

          senderUserId = userId;
        } else if (req.user.orgType === "LENDER") {
          senderType = "LENDER";

          senderUserId = userId;
        } else {
          senderType = "CLIENT";

          senderClientUserId = userId;
        }

        let senderName = null;

if (senderType === "CLIENT") {
  const clientUser = await prisma.clientPortalUser.findUnique({
    where: { id: senderClientUserId },
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

  const primaryContact =
    clientUser?.client?.contacts?.[0];

  senderName =
    `${primaryContact?.firstName || ""} ${
      primaryContact?.lastName || ""
    }`.trim() ||
    clientUser?.client?.legalName ||
    "Client";
}

if (
  senderType === "BROKER" ||
  senderType === "LENDER" ||
  senderType === "SUB_BROKER"
) {
  const user = await prisma.userAccount.findUnique({
    where: { id: senderUserId },
    include: {
      organization: true,
    },
  });

  senderName =
    user?.organization?.name ||
    `${user?.firstName || ""} ${
      user?.lastName || ""
    }`.trim() ||
    senderType;
}

        /* ================= CREATE MESSAGE ================= */

        const message = await prisma.message.create({
          data: {
            conversationId,
            senderType,
            senderUserId,
            senderClientUserId,
            senderName,
            type,
            text: type === "TEXT" ? text : null,
            fileUrl: type === "FILE" ? fileUrl : null,
            fileName: type === "FILE" ? fileName : null,
            fileSize: type === "FILE" ? fileSize : null,
            mimeType: type === "FILE" ? mimeType : null,
            metadata: metadata || null,
          },
        });

        /* ================= UPDATE CONVERSATION ================= */

        await prisma.conversation.update({
          where: { id: conversationId },
          data: {
            lastMessageAt: message.createdAt,
          },
        });

        /* ================= REALTIME EMIT ================= */

        if (fastify.io) {
          const realtimePayload = {
            id: message.id,
            conversationId: message.conversationId,
            senderType: message.senderType,
            senderUserId: message.senderUserId,
            senderClientUserId: message.senderClientUserId,
            senderName: message.senderName,
            type: message.type,
            text: message.text,
            fileUrl: message.fileUrl,
            fileName: message.fileName,
            fileSize: message.fileSize,
            mimeType: message.mimeType,
            createdAt: message.createdAt,
          };

          fastify.io
            .to(`conversation_${conversationId}`)
            .emit("newMessage", realtimePayload);

          console.log("📡 Realtime emitted:", `conversation_${conversationId}`);
        }

        /* ================= RESPONSE ================= */

        return reply.send({
          success: true,
          data: {
            id: message.id,
            type: message.type,
            text: message.text,
            senderType: message.senderType,
            senderUserId: message.senderUserId,
            senderClientUserId: message.senderClientUserId,
            senderName: message.senderName,
            createdAt: message.createdAt,
          },
        });
      } catch (error) {
        console.error("💥 SEND MESSAGE ERROR:", error.message);

        fastify.log.error(
          {
            error: error.message,
            conversationId,
            userId: req.user?.id || req.user?.userId || req.user?.clientId,
          },
          "Failed to send message",
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    },
  );
};
