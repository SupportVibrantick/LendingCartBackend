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
  notifyBroker,
  BROKER_NOTIFICATION_EVENTS,
} = require("../notifications/brokerNotifications");
const {
  assertCanAccessConversation,
  assertCanSendMessage,
  resolveAuditDashboard,
  resolveMessageSenderType,
  getUserId,
  emitRealtimeMessage,
} = require("./messagingAccess");
const { resolveClientDisplayName } = require("./resolveClientDisplayName");

const CLIENT_THREAD_TYPES = ["CLIENT_BROKER", "CLIENT_OFFICER"];
const BROKER_SIDE_SENDER_TYPES = ["BROKER", "SUB_BROKER"];

function messagePreview(message) {
  if (message.type === "TEXT") {
    return message.text?.slice(0, 120) || "New message";
  }
  return message.fileName || "New file shared";
}

function formatAppLabel(applicationNumber) {
  if (!applicationNumber) return null;
  return String(applicationNumber).startsWith("#")
    ? String(applicationNumber)
    : `#${applicationNumber}`;
}

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

  const personName =
    `${account?.firstName || ""} ${account?.lastName || ""}`.trim();

  return personName || account?.organization?.name || senderType;
}

async function resolveLoanContext(prisma, conversation) {
  if (conversation.loanApplicationId) {
    const loan = await prisma.loanApplication.findUnique({
      where: { id: conversation.loanApplicationId },
      select: {
        id: true,
        clientId: true,
        brokerOrgId: true,
        applicationNumber: true,
      },
    });

    if (loan) {
      return {
        applicationId: loan.id,
        applicationNumber: loan.applicationNumber,
        clientId: loan.clientId,
        brokerOrgId: loan.brokerOrgId,
      };
    }
  }

  if (conversation.applicationLenderId) {
    const appLender = await prisma.applicationLender.findUnique({
      where: { id: conversation.applicationLenderId },
      select: {
        id: true,
        lenderOrgId: true,
        loanApplication: {
          select: {
            id: true,
            clientId: true,
            brokerOrgId: true,
            applicationNumber: true,
          },
        },
      },
    });

    if (appLender?.loanApplication) {
      return {
        applicationId: appLender.loanApplication.id,
        applicationNumber: appLender.loanApplication.applicationNumber,
        clientId: appLender.loanApplication.clientId,
        brokerOrgId: appLender.loanApplication.brokerOrgId,
        applicationLenderId: appLender.id,
        lenderOrgId: appLender.lenderOrgId,
      };
    }

    return {
      applicationLenderId: appLender?.id || null,
      lenderOrgId: appLender?.lenderOrgId || null,
    };
  }

  return {};
}

function buildMessageMetadata({
  conversation,
  message,
  senderType,
  senderName,
  loanContext,
}) {
  return {
    applicationId: loanContext.applicationId || conversation.loanApplicationId || null,
    applicationNumber: loanContext.applicationNumber || null,
    applicationLenderId:
      loanContext.applicationLenderId || conversation.applicationLenderId || null,
    conversationId: conversation.id,
    messageId: message.id,
    senderName,
    senderType,
  };
}

async function notifyMessageRecipients(prisma, io, {
  conversation,
  message,
  senderType,
  senderName,
}) {
  const preview = messagePreview(message);
  const loanContext = await resolveLoanContext(prisma, conversation);
  const appLabel = formatAppLabel(loanContext.applicationNumber);
  const who = senderName || senderType || "Someone";
  const subject = appLabel
    ? `New message from ${who} · ${appLabel}`
    : `New message from ${who}`;
  const body = appLabel ? `${who} on ${appLabel}: ${preview}` : `${who}: ${preview}`;
  const metadata = buildMessageMetadata({
    conversation,
    message,
    senderType,
    senderName,
    loanContext,
  });

  // Client: staff → borrower threads
  if (
    senderType !== "CLIENT" &&
    CLIENT_THREAD_TYPES.includes(conversation.type) &&
    loanContext.clientId
  ) {
    await notifyClient(prisma, io, {
      clientId: loanContext.clientId,
      eventType: CLIENT_NOTIFICATION_EVENTS.NEW_MESSAGE,
      category: "MESSAGE",
      subject,
      body: preview,
      metadata,
    });
  }

  // Lender: broker-side → lender threads
  if (
    BROKER_SIDE_SENDER_TYPES.includes(senderType) &&
    conversation.type === "BROKER_LENDER"
  ) {
    let lenderOrgId = loanContext.lenderOrgId || null;
    let applicationLenderId =
      loanContext.applicationLenderId || conversation.applicationLenderId || null;

    if (!lenderOrgId && conversation.applicationLenderId) {
      const appLender = await prisma.applicationLender.findUnique({
        where: { id: conversation.applicationLenderId },
        select: {
          id: true,
          lenderOrgId: true,
          loanApplication: {
            select: { id: true, applicationNumber: true },
          },
        },
      });
      lenderOrgId = appLender?.lenderOrgId || null;
      applicationLenderId = appLender?.id || applicationLenderId;
      if (!metadata.applicationId && appLender?.loanApplication) {
        metadata.applicationId = appLender.loanApplication.id;
        metadata.applicationNumber = appLender.loanApplication.applicationNumber;
      }
    }

    if (lenderOrgId) {
      await notifyLender(prisma, io, {
        lenderOrgId,
        eventType: LENDER_NOTIFICATION_EVENTS.NEW_MESSAGE,
        category: "MESSAGE",
        subject,
        body,
        metadata: {
          ...metadata,
          applicationLenderId,
        },
      });
    }
  }

  // Broker org (admin + LO + co-broker via shared notification list):
  // inbound from client / lender, or staff threads from the other party.
  const shouldNotifyBroker =
    (senderType === "CLIENT" &&
      CLIENT_THREAD_TYPES.includes(conversation.type)) ||
    (senderType === "LENDER" && conversation.type === "BROKER_LENDER") ||
    (["SUBBROKER_BROKER", "BROKER_OFFICER"].includes(conversation.type) &&
      senderType !== "BROKER");

  if (shouldNotifyBroker) {
    let brokerOrgId = loanContext.brokerOrgId || null;

    if (!brokerOrgId && conversation.loanApplicationId) {
      const loan = await prisma.loanApplication.findUnique({
        where: { id: conversation.loanApplicationId },
        select: { brokerOrgId: true },
      });
      brokerOrgId = loan?.brokerOrgId || null;
    }

    if (!brokerOrgId && conversation.brokerLenderAccessId) {
      const access = await prisma.brokerLenderAccess.findUnique({
        where: { id: conversation.brokerLenderAccessId },
        select: { brokerOrgId: true },
      });
      brokerOrgId = access?.brokerOrgId || null;
    }

    if (brokerOrgId) {
      await notifyBroker(prisma, io, {
        brokerOrgId,
        eventType: BROKER_NOTIFICATION_EVENTS.NEW_MESSAGE,
        category: "MESSAGE",
        subject,
        body,
        metadata,
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
