const { logAudit } = require("../logger/auditLogger");
const { resolveClientDisplayName } = require("../messaging/resolveClientDisplayName");
const {
  assertCanAccessConversation,
  assertCanSendMessage,
  resolveAuditDashboard,
  resolveMessageSenderType,
  getUserId,
} = require("../messaging/messagingAccess");
const {
  publishConversationJoined,
  publishMessage,
  publishMessageRead,
  publishUnread,
} = require("./chat.events");

async function resolveSenderName(prisma, senderId, senderType, conversationId) {
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
  } catch {
    return "Unknown";
  }
}

async function joinConversation(prisma, user, conversationId) {
  const access = await assertCanAccessConversation(prisma, user, conversationId);

  if (!access.allowed) {
    return {
      success: false,
      code: access.error?.code === 404 ? "NOT_FOUND" : "FORBIDDEN",
      message: access.error?.message || "Access denied to this conversation",
    };
  }

  return {
    success: true,
    data: {
      conversationId,
      room: `conversation_${conversationId}`,
    },
  };
}

async function sendMessage(prisma, io, user, payload, socketContext = {}) {
  const { conversationId, type, text, fileUrl, fileName } = payload;
  const userId = getUserId(user);

  if (!userId) {
    return { success: false, code: "UNAUTHORIZED", message: "Invalid user" };
  }

  const access = await assertCanAccessConversation(prisma, user, conversationId);

  if (!access.allowed) {
    return {
      success: false,
      code: "FORBIDDEN",
      message: access.error?.message || "Access denied",
    };
  }

  const typeAccessError = assertCanSendMessage(
    { user },
    access.conversation.type,
  );

  if (typeAccessError) {
    return {
      success: false,
      code: "FORBIDDEN",
      message: typeAccessError.message,
    };
  }

  const { senderType, senderUserId, senderClientUserId } =
    resolveMessageSenderType(user);

  const senderName = await resolveSenderName(
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
      user,
      ip: socketContext.ip,
      headers: socketContext.headers || {},
    },
    dashboard: resolveAuditDashboard({ user }),
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
        type === "TEXT" ? text?.slice(0, 120) || null : fileName || "File",
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

  await publishMessage(io, prisma, message, conversationId);

  if (socketContext.socket) {
    publishUnread(io, conversationId, socketContext.socket);
  }

  return { success: true, data: response };
}

async function markAsRead(prisma, io, user, conversationId) {
  const userId = getUserId(user);

  if (!userId || !conversationId) {
    return {
      success: false,
      code: "VALIDATION_ERROR",
      message: "User and conversation are required",
    };
  }

  const access = await assertCanAccessConversation(prisma, user, conversationId);

  if (!access.allowed) {
    return {
      success: false,
      code: "FORBIDDEN",
      message: access.error?.message || "Access denied",
    };
  }

  await prisma.conversationParticipant.updateMany({
    where: {
      conversationId,
      participantId: userId,
    },
    data: {
      lastReadAt: new Date(),
    },
  });

  publishMessageRead(io, conversationId, userId);

  return {
    success: true,
    data: { conversationId, userId },
  };
}

module.exports = {
  joinConversation,
  sendMessage,
  markAsRead,
  publishConversationJoined,
};
