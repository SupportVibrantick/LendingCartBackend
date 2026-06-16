/**
 * Send message in a conversation
 */

const { logAudit } = require("../../../../services/logger/auditLogger");
const {
  notifyClient,
  CLIENT_NOTIFICATION_EVENTS,
} = require("../../../../services/clientNotifications");
const {
  notifyLender,
  LENDER_NOTIFICATION_EVENTS,
} = require("../../../../services/lenderNotifications");
const {
  assertCanSendMessage,
  findLenderApplicationAccess,
  ensureLenderParticipant,
  getOrganizationId,
  isLenderUser,
  resolveAuditDashboard,
  emitRealtimeMessage,
} = require("../../../../services/messagingAccess");
const { resolveClientDisplayName } = require("../../../../services/resolveClientDisplayName");

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
            type: true,
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

        const typeAccessError = assertCanSendMessage(req, conversation.type);
        if (typeAccessError) {
          return reply.code(typeAccessError.code).send({
            success: false,
            message: typeAccessError.message,
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

        if (!participant && isLenderUser(req)) {
          const lenderAccess = await findLenderApplicationAccess(
            prisma,
            conversation,
            getOrganizationId(req.user),
          );

          hasFallbackAccess = Boolean(lenderAccess);

          if (hasFallbackAccess) {
            await ensureLenderParticipant(prisma, conversationId, userId);
          }
        }

        const brokerOrgId = getOrganizationId(req.user);

        if (
          !participant &&
          !hasFallbackAccess &&
          req.user?.orgType === "BROKER" &&
          brokerOrgId &&
          conversation.loanApplicationId
        ) {
          const brokerAccess = await prisma.loanApplication.findFirst({
            where: {
              id: conversation.loanApplicationId,
              brokerOrgId,
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
    select: { clientId: true },
  });

  senderName = await resolveClientDisplayName(prisma, {
    clientId: clientUser?.clientId,
    loanApplicationId: conversation.loanApplicationId,
  });
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

        await emitRealtimeMessage(fastify.io, prisma, message, conversationId);

        if (
          senderType !== "CLIENT" &&
          ["CLIENT_BROKER", "CLIENT_OFFICER"].includes(conversation.type) &&
          conversation.loanApplicationId
        ) {
          const loan = await prisma.loanApplication.findUnique({
            where: { id: conversation.loanApplicationId },
            select: {
              id: true,
              clientId: true,
              applicationNumber: true,
            },
          });

          if (loan?.clientId) {
            const preview =
              message.type === "TEXT"
                ? message.text?.slice(0, 120) || "New message"
                : message.fileName || "New file shared";

            await notifyClient(prisma, fastify.io, {
              clientId: loan.clientId,
              eventType: CLIENT_NOTIFICATION_EVENTS.NEW_MESSAGE,
              category: "MESSAGE",
              subject: `New message from ${senderName || senderType}`,
              body: preview,
              metadata: {
                applicationId: loan.id,
                applicationNumber: loan.applicationNumber,
                conversationId,
                senderName,
                senderType,
              },
            });
          }
        }

        if (
          senderType === "BROKER" &&
          conversation.type === "BROKER_LENDER" &&
          conversation.applicationLenderId
        ) {
          const appLender = await prisma.applicationLender.findUnique({
            where: { id: conversation.applicationLenderId },
            select: {
              id: true,
              lenderOrgId: true,
              loanApplication: {
                select: {
                  id: true,
                  applicationNumber: true,
                },
              },
            },
          });

          if (appLender?.lenderOrgId) {
            const preview =
              message.type === "TEXT"
                ? message.text?.slice(0, 120) || "New message"
                : message.fileName || "New file shared";

            await notifyLender(prisma, fastify.io, {
              lenderOrgId: appLender.lenderOrgId,
              eventType: LENDER_NOTIFICATION_EVENTS.NEW_MESSAGE,
              category: "MESSAGE",
              subject: `New message from ${senderName || "Broker"}`,
              body: `${senderName || "Broker"}: ${preview}`,
              metadata: {
                applicationId: appLender.loanApplication?.id,
                applicationNumber: appLender.loanApplication?.applicationNumber,
                applicationLenderId: appLender.id,
                conversationId,
                senderName,
                senderType,
              },
            });
          }
        }

        await logAudit({
          prisma,
          req,
          dashboard: resolveAuditDashboard(req),
          category: "SYSTEM",
          entityType: "Message",
          entityId: message.id,
          action: "MESSAGE_SENT",
          newValue: {
            conversationId,
            conversationType: conversation.type,
            loanApplicationId: conversation.loanApplicationId,
            senderType: message.senderType,
            messageType: message.type,
            preview:
              message.type === "TEXT"
                ? message.text?.slice(0, 120) || null
                : message.fileName || "File",
          },
        });

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
