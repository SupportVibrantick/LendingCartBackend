module.exports = function chatSocket(socket, io, prisma) {
  const { logAudit } = require("../services/logger/auditLogger");
  const {
    assertCanSendMessage,
    assertCanAccessConversation,
    resolveAuditDashboard,
    resolveMessageSenderType,
    emitRealtimeMessage,
    getUserId,
  } = require("../services/messagingAccess");

  console.log("👤 CHAT SOCKET USER:", socket.user);

  socket.on("joinConversation", async ({ conversationId }) => {
    try {
      if (!conversationId) {
        return socket.emit("error", { message: "Conversation id is required" });
      }

      const access = await assertCanAccessConversation(
        prisma,
        socket.user,
        conversationId,
      );

      if (!access.allowed) {
        console.log("❌ JOIN DENIED:", access.error?.message, conversationId);
        return socket.emit("error", {
          message: access.error?.message || "Access denied to this conversation",
        });
      }

      const room = `conversation_${conversationId}`;
      socket.join(room);
      console.log(`✅ JOINED ROOM: ${room}`);

      socket.emit("joined", { conversationId });
    } catch (err) {
      console.error("❌ Join error:", err.message);
      socket.emit("error", { message: "Join failed" });
    }
  });

  socket.on("sendMessage", async (payload) => {
    try {
      const { conversationId, type, text, fileUrl, fileName } = payload;

      const userId = getUserId(socket.user);

      if (!userId) {
        return socket.emit("error", { message: "Invalid user" });
      }

      if (type === "TEXT" && !text) {
        return socket.emit("error", {
          message: "Text message cannot be empty",
        });
      }

      const access = await assertCanAccessConversation(
        prisma,
        socket.user,
        conversationId,
      );

      if (!access.allowed) {
        return socket.emit("error", {
          message: access.error?.message || "Access denied",
        });
      }

      const typeAccessError = assertCanSendMessage(
        { user: socket.user },
        access.conversation.type,
      );
      if (typeAccessError) {
        return socket.emit("error", { message: typeAccessError.message });
      }

      const { senderType, senderUserId, senderClientUserId } =
        resolveMessageSenderType(socket.user);

      const senderName = await getSenderName(
        prisma,
        senderUserId || senderClientUserId,
        senderType,
        conversationId,
      );

      const message = await prisma.message.create({
        data: {
          conversationId,
          senderType,
          senderUserId: senderUserId || null,
          senderClientUserId: senderClientUserId || null,
          senderName,
          type,
          text: type === "TEXT" ? text : null,
          fileUrl: type === "FILE" ? fileUrl : null,
          fileName: type === "FILE" ? fileName : null,
        },
      });

      await logAudit({
        prisma,
        req: {
          user: socket.user,
          ip: socket.handshake?.address,
          headers: { "user-agent": socket.handshake?.headers?.["user-agent"] },
        },
        dashboard: resolveAuditDashboard({ user: socket.user }),
        category: "SYSTEM",
        entityType: "Message",
        entityId: message.id,
        action: "MESSAGE_SENT",
        newValue: {
          conversationId,
          conversationType: access.conversation.type,
          senderType,
          messageType: type,
          preview:
            type === "TEXT"
              ? text?.slice(0, 120) || null
              : fileName || "File",
          transport: "socket",
        },
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: message.createdAt },
      });

      const response = {
        id: message.id,
        conversationId,
        senderType,
        senderUserId,
        senderClientUserId,
        senderName,
        type,
        text,
        fileUrl,
        fileName,
        createdAt: message.createdAt,
      };

      await emitRealtimeMessage(io, prisma, message, conversationId);
      socket.to(`conversation_${conversationId}`).emit("newUnread", {
        conversationId,
      });
    } catch (err) {
      console.error("❌ Send message error:", err.message);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  socket.on("markAsRead", async ({ conversationId }) => {
    try {
      const userId = getUserId(socket.user);

      if (!userId || !conversationId) return;

      const access = await assertCanAccessConversation(
        prisma,
        socket.user,
        conversationId,
      );

      if (!access.allowed) return;

      await prisma.conversationParticipant.updateMany({
        where: {
          conversationId,
          participantId: userId,
        },
        data: {
          lastReadAt: new Date(),
        },
      });

      socket.to(`conversation_${conversationId}`).emit("messageRead", {
        userId,
        conversationId,
      });
    } catch (err) {
      console.error("❌ Read error:", err.message);
    }
  });
};

async function getSenderName(prisma, senderId, senderType, conversationId) {
  try {
    if (
      senderType === "BROKER" ||
      senderType === "LENDER" ||
      senderType === "SUB_BROKER"
    ) {
      const user = await prisma.userAccount.findUnique({
        where: { id: senderId },
        select: {
          firstName: true,
          lastName: true,
          organization: { select: { name: true } },
        },
      });

      return (
        user?.organization?.name ||
        `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
        senderType
      );
    }

    if (senderType === "CLIENT") {
      const { resolveClientDisplayName } = require("../services/resolveClientDisplayName");

      const clientUser = await prisma.clientPortalUser.findUnique({
        where: { id: senderId },
        select: { clientId: true },
      });

      const conversation = conversationId
        ? await prisma.conversation.findUnique({
            where: { id: conversationId },
            select: { loanApplicationId: true },
          })
        : null;

      return resolveClientDisplayName(prisma, {
        clientId: clientUser?.clientId,
        loanApplicationId: conversation?.loanApplicationId,
      });
    }

    return "Unknown";
  } catch (err) {
    console.error("❌ Sender name error:", err.message);
    return "Unknown";
  }
}
