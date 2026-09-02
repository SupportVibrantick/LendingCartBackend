const { logAudit } = require("../logger/auditLogger");
const {
  notifyClient,
  CLIENT_NOTIFICATION_EVENTS,
} = require("../notifications/clientNotifications");
const {
  notifyLender,
  LENDER_NOTIFICATION_EVENTS,
} = require("../notifications/lenderNotifications");
const {
  assertCanAccessConversation,
  assertCanSendMessage,
  resolveAuditDashboard,
  resolveMessageSenderType,
  getUserId,
  emitRealtimeMessage,
} = require("./messagingAccess");
const { resolveClientDisplayName } = require("./resolveClientDisplayName");

async function resolveSenderName(prisma, user, senderType, conversation) {
  const userId = getUserId(user);
  const { senderUserId, senderClientUserId } = resolveMessageSenderType(user);

  if (senderType === "CLIENT") {
    const clientUser = await prisma.clientPortalUser.findUnique({
      where: { id: senderClientUserId },
      select: { clientId: true },
    });

    return resolveClientDisplayName(prisma, {
      clientId: clientUser?.clientId,
      loanApplicationId: conversation.loanApplicationId,
    });
  }

  const account = await prisma.userAccount.findUnique({
    where: { id: senderUserId || userId },
    include: { organization: true },
  });

  return (
    account?.organization?.name ||
    `${account?.firstName || ""} ${account?.lastName || ""}`.trim() ||
    senderType
  );
}

async function notifyMessageRecipients(prisma, io, {
  conversation,
  message,
  senderType,
  senderName,
}) {
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

      await notifyClient(prisma, io, {
        clientId: loan.clientId,
        eventType: CLIENT_NOTIFICATION_EVENTS.NEW_MESSAGE,
        category: "MESSAGE",
        subject: `New message from ${senderName || senderType}`,
        body: preview,
        metadata: {
          applicationId: loan.id,
          applicationNumber: loan.applicationNumber,
          conversationId: conversation.id,
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

      await notifyLender(prisma, io, {
        lenderOrgId: appLender.lenderOrgId,
        eventType: LENDER_NOTIFICATION_EVENTS.NEW_MESSAGE,
        category: "MESSAGE",
        subject: `New message from ${senderName || "Broker"}`,
        body: `${senderName || "Broker"}: ${preview}`,
        metadata: {
          applicationId: appLender.loanApplication?.id,
          applicationNumber: appLender.loanApplication?.applicationNumber,
          applicationLenderId: appLender.id,
          conversationId: conversation.id,
          senderName,
          senderType,
        },
      });
    }
  }
}

/**
 * Shared REST + socket-parity send path with assertCanAccessConversation.
 */
async function sendConversationMessage(prisma, io, req, payload) {
  const user = req.user;
  const userId = getUserId(user);

  if (!user || !userId) {
    return {
      statusCode: 401,
      body: { success: false, message: "Unauthorized" },
    };
  }

  const {
    conversationId,
    type,
    text,
    fileUrl,
    fileName,
    fileSize,
    mimeType,
    metadata,
  } = payload;

  if (type === "TEXT" && !text?.trim()) {
    return {
      statusCode: 400,
      body: { success: false, message: "Text message cannot be empty" },
    };
  }

  if (type === "FILE" && !fileUrl) {
    return {
      statusCode: 400,
      body: { success: false, message: "File URL is required" },
    };
  }

  const access = await assertCanAccessConversation(
    prisma,
    user,
    conversationId,
  );

  if (!access.allowed) {
    return {
      statusCode: access.error?.code || 403,
      body: {
        success: false,
        message: access.error?.message || "Access denied",
      },
    };
  }

  const conversation = access.conversation;

  const typeAccessError = assertCanSendMessage(req, conversation.type);
  if (typeAccessError) {
    return {
      statusCode: typeAccessError.code,
      body: { success: false, message: typeAccessError.message },
    };
  }

  const { senderType, senderUserId, senderClientUserId } =
    resolveMessageSenderType(user);

  const senderName = await resolveSenderName(
    prisma,
    user,
    senderType,
    conversation,
  );

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderType,
      senderUserId,
      senderClientUserId,
      senderName,
      type,
      text: type === "TEXT" ? text.trim() : null,
      fileUrl: type === "FILE" ? fileUrl : null,
      fileName: type === "FILE" ? fileName : null,
      fileSize: type === "FILE" ? Math.round(fileSize || 0) : null,
      mimeType: type === "FILE" ? mimeType : null,
      metadata: metadata || null,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: message.createdAt },
  });

  await emitRealtimeMessage(io, prisma, message, conversationId);

  await notifyMessageRecipients(prisma, io, {
    conversation,
    message,
    senderType,
    senderName,
  });

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

  return {
    statusCode: 200,
    body: {
      success: true,
      data: {
        id: message.id,
        conversationId,
        type: message.type,
        text: message.text,
        fileUrl: message.fileUrl,
        fileName: message.fileName,
        fileSize: message.fileSize,
        mimeType: message.mimeType,
        metadata: message.metadata,
        senderType: message.senderType,
        senderUserId: message.senderUserId,
        senderClientUserId: message.senderClientUserId,
        senderName: message.senderName,
        createdAt: message.createdAt,
      },
    },
  };
}

module.exports = {
  sendConversationMessage,
};
