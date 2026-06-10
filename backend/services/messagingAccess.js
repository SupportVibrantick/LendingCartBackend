/**
 * Enforces hub-and-spoke messaging: clients and lenders never communicate directly.
 * All threads route through the broker (CLIENT_BROKER, BROKER_LENDER, etc.).
 */

const CLIENT_CONVERSATION_TYPES = ["CLIENT_BROKER", "CLIENT_OFFICER"];

function normalizeEmail(email) {
  return email?.trim().toLowerCase();
}

function hasRole(user, roleName) {
  const roles = user?.roles ?? user?.role ?? [];
  if (Array.isArray(roles)) return roles.includes(roleName);
  return roles === roleName;
}

function getUserId(user) {
  return user?.id || user?.userId || user?.clientId || null;
}

function getOrganizationId(user) {
  return user?.organizationId || user?.orgId || null;
}

async function findLenderApplicationAccess(prisma, conversation, lenderOrgId) {
  if (!lenderOrgId) return null;

  if (conversation.applicationLenderId) {
    const byApplicationLender = await prisma.applicationLender.findFirst({
      where: {
        id: conversation.applicationLenderId,
        lenderOrgId,
      },
      select: { id: true },
    });

    if (byApplicationLender) return byApplicationLender;
  }

  if (conversation.loanApplicationId) {
    return prisma.applicationLender.findFirst({
      where: {
        loanApplicationId: conversation.loanApplicationId,
        lenderOrgId,
      },
      select: { id: true },
    });
  }

  return null;
}

async function ensureLenderParticipant(prisma, conversationId, userId) {
  if (!conversationId || !userId) return;

  await prisma.conversationParticipant.createMany({
    data: [
      {
        conversationId,
        participantType: "LENDER",
        participantId: userId,
      },
    ],
    skipDuplicates: true,
  });
}

function normalizeAuthUser(decoded) {
  const userId =
    decoded?.userId ?? decoded?.id ?? decoded?.user?.id ?? null;

  const organizationId =
    decoded?.organizationId ?? decoded?.orgId ?? decoded?.organization?.id ?? null;

  const rolesRaw = decoded?.roles ?? decoded?.role ?? [];
  const roles = Array.isArray(rolesRaw)
    ? rolesRaw
    : rolesRaw
      ? [rolesRaw]
      : [];

  const role = decoded?.role ?? roles[0] ?? null;

  let orgType = decoded?.orgType ?? decoded?.organization?.type ?? null;
  if (!orgType && role === "CLIENT") orgType = "CLIENT";
  if (!orgType && hasRole({ roles }, "SUB_BROKER")) orgType = "BROKER";
  if (!orgType && hasRole({ roles }, "BROKER_OFFICER")) orgType = "BROKER";
  if (
    !orgType &&
    (hasRole({ roles }, "LENDER_ADMIN") ||
      hasRole({ roles }, "LENDER_UNDERWRITER"))
  ) {
    orgType = "LENDER";
  }

  return {
    userId,
    id: userId,
    clientId: decoded?.clientId ?? decoded?.client?.id ?? null,
    organizationId,
    orgId: organizationId,
    orgType,
    roles,
    role,
    email: decoded?.email ?? decoded?.user?.email ?? decoded?.clientEmail ?? null,
    clientEmail: decoded?.clientEmail ?? decoded?.email ?? null,
    raw: decoded,
  };
}

function resolveMessageSenderType(user) {
  if (hasRole(user, "SUB_BROKER")) {
    return { senderType: "SUB_BROKER", senderUserId: getUserId(user) };
  }

  if (user?.orgType === "BROKER") {
    return { senderType: "BROKER", senderUserId: getUserId(user) };
  }

  if (user?.orgType === "LENDER") {
    return { senderType: "LENDER", senderUserId: getUserId(user) };
  }

  return {
    senderType: "CLIENT",
    senderClientUserId: getUserId(user),
  };
}

async function assertCanAccessConversation(prisma, user, conversationId) {
  const req = { user };
  const userId = getUserId(user);
  const userEmail = user?.email || user?.clientEmail;

  if (!userId && !userEmail) {
    return {
      allowed: false,
      error: { code: 401, message: "Invalid user token" },
    };
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      type: true,
      chatCategory: true,
      loanApplicationId: true,
      applicationLenderId: true,
    },
  });

  if (!conversation) {
    return {
      allowed: false,
      error: { code: 404, message: "Conversation not found" },
    };
  }

  const loanOfficerScopeError = assertLoanOfficerConversationScope(
    req,
    conversation,
  );
  if (loanOfficerScopeError) {
    return { allowed: false, error: loanOfficerScopeError };
  }

  const typeAccessError = assertConversationTypeAccess(req, conversation.type);
  if (typeAccessError) {
    return { allowed: false, error: typeAccessError };
  }

  const participant = await prisma.conversationParticipant.findFirst({
    where: {
      conversationId,
      OR: [
        userId ? { participantId: userId } : undefined,
        userEmail
          ? { participantEmail: normalizeEmail(userEmail) }
          : undefined,
      ].filter(Boolean),
    },
  });

  if (participant) {
    return { allowed: true, conversation, participant };
  }

  if (isLenderUser(req)) {
    const lenderOrgId = getOrganizationId(user);
    const lenderAccess = await findLenderApplicationAccess(
      prisma,
      conversation,
      lenderOrgId,
    );

    if (lenderAccess) {
      await ensureLenderParticipant(prisma, conversationId, userId);
      return { allowed: true, conversation };
    }
  }

  const brokerOrgId = getOrganizationId(user);

  if (isBrokerSideUser(req) && brokerOrgId && conversation.loanApplicationId) {
    const brokerAccess = await prisma.loanApplication.findFirst({
      where: {
        id: conversation.loanApplicationId,
        brokerOrgId,
      },
      select: { id: true },
    });

    if (brokerAccess) {
      return { allowed: true, conversation };
    }
  }

  return {
    allowed: false,
    error: { code: 403, message: "Access denied" },
  };
}

async function emitRealtimeMessage(io, prisma, message, conversationId) {
  if (!io) return;

  const payload = {
    id: message.id,
    conversationId: message.conversationId || conversationId,
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

  io.to(`conversation_${conversationId}`).emit("newMessage", payload);

  if (!prisma) return;

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        loanApplicationId: true,
        applicationLenderId: true,
      },
    });

    if (conversation?.loanApplicationId) {
      const loan = await prisma.loanApplication.findUnique({
        where: { id: conversation.loanApplicationId },
        select: { brokerOrgId: true },
      });

      if (loan?.brokerOrgId) {
        io.to(`broker_${loan.brokerOrgId}`).emit("newMessage", payload);
      }
    }

    if (conversation?.applicationLenderId) {
      const appLender = await prisma.applicationLender.findUnique({
        where: { id: conversation.applicationLenderId },
        select: { lenderOrgId: true },
      });

      if (appLender?.lenderOrgId) {
        io.to(`lender_${appLender.lenderOrgId}`).emit("newMessage", payload);
      }
    }
  } catch (err) {
    console.error("Realtime fan-out failed:", err.message);
  }
}

function isClientUser(req) {
  return (
    req.user?.orgType === "CLIENT" ||
    req.user?.role === "CLIENT" ||
    Boolean(req.user?.clientId)
  );
}

function isLenderUser(req) {
  return (
    req.user?.orgType === "LENDER" ||
    hasRole(req.user, "LENDER_ADMIN") ||
    hasRole(req.user, "LENDER_UNDERWRITER")
  );
}

function isBrokerSideUser(req) {
  return (
    req.user?.orgType === "BROKER" ||
    hasRole(req.user, "SUB_BROKER") ||
    hasRole(req.user, "BROKER_OFFICER") ||
    hasRole(req.user, "BROKER_ADMIN")
  );
}

function isLoanOfficerUser(req) {
  return hasRole(req.user, "BROKER_OFFICER");
}

/**
 * Loan officers only see their own channels — never principal-broker lanes
 * (duplicate lender rows) or broker-admin ↔ sub-broker threads.
 */
function getLoanOfficerConversationListFilters() {
  return {
    OR: [
      { type: { in: ["CLIENT_OFFICER", "BROKER_OFFICER"] } },
      {
        type: { in: ["BROKER_LENDER", "SUBBROKER_BROKER"] },
        chatCategory: "LOAN_OFFICER",
      },
    ],
  };
}

function assertLoanOfficerConversationScope(req, conversation) {
  if (!isLoanOfficerUser(req)) return null;

  if (conversation.chatCategory === "PRINCIPAL_BROKER") {
    return {
      code: 403,
      message: "Loan officers cannot access principal broker channels",
    };
  }

  if (conversation.type === "CLIENT_BROKER") {
    return {
      code: 403,
      message: "Loan officers use the dedicated client officer channel",
    };
  }

  const categorizedTypes = ["BROKER_LENDER", "SUBBROKER_BROKER"];
  if (
    categorizedTypes.includes(conversation.type) &&
    conversation.chatCategory &&
    conversation.chatCategory !== "LOAN_OFFICER"
  ) {
    return {
      code: 403,
      message: "Access denied to this conversation channel",
    };
  }

  return null;
}

function getConversationListFilters(req, { userId, userEmail, lenderAccessId }) {
  if (isLenderUser(req)) {
    return {
      applicationLenderId: lenderAccessId,
      type: "BROKER_LENDER",
    };
  }

  if (isClientUser(req)) {
    const participantMatch = {
      OR: [
        userId ? { participantId: userId } : undefined,
        userEmail
          ? { participantEmail: normalizeEmail(userEmail) }
          : undefined,
      ].filter(Boolean),
    };

    // Query only CLIENT_BROKER here; CLIENT_OFFICER is merged in getConversations
    // after fetch so this works even before the enum migration is applied.
    return {
      type: "CLIENT_BROKER",
      participants: {
        some: participantMatch,
      },
    };
  }

  if (hasRole(req.user, "SUB_BROKER")) {
    return {
      participants: {
        some: {
          participantId: req.user.userId || userId,
        },
      },
    };
  }

  if (isLoanOfficerUser(req)) {
    return getLoanOfficerConversationListFilters();
  }

  return {};
}

function assertConversationTypeAccess(req, conversationType) {
  if (isClientUser(req) && !CLIENT_CONVERSATION_TYPES.includes(conversationType)) {
    return {
      code: 403,
      message:
        "Clients cannot access lender conversations. All communication routes through the broker.",
    };
  }

  if (isLenderUser(req) && conversationType !== "BROKER_LENDER") {
    return {
      code: 403,
      message:
        "Lenders cannot access client conversations. All communication routes through the broker.",
    };
  }

  return null;
}

function assertCanSendMessage(req, conversationType) {
  if (isClientUser(req) && !CLIENT_CONVERSATION_TYPES.includes(conversationType)) {
    return {
      code: 403,
      message:
        "Clients cannot message lenders directly. All communication routes through the broker.",
    };
  }

  if (isLenderUser(req) && conversationType !== "BROKER_LENDER") {
    return {
      code: 403,
      message:
        "Lenders cannot message clients directly. All communication routes through the broker.",
    };
  }

  return null;
}

function shouldShowBrokerOfficerPlaceholder(req) {
  return isBrokerSideUser(req) && !isClientUser(req) && !isLenderUser(req);
}

function resolveAuditDashboard(req) {
  if (isLenderUser(req)) return "LENDER";
  return "BROKER";
}

module.exports = {
  normalizeEmail,
  hasRole,
  getUserId,
  getOrganizationId,
  findLenderApplicationAccess,
  ensureLenderParticipant,
  normalizeAuthUser,
  resolveMessageSenderType,
  assertCanAccessConversation,
  emitRealtimeMessage,
  isClientUser,
  isLenderUser,
  isBrokerSideUser,
  isLoanOfficerUser,
  getLoanOfficerConversationListFilters,
  assertLoanOfficerConversationScope,
  getConversationListFilters,
  assertConversationTypeAccess,
  assertCanSendMessage,
  shouldShowBrokerOfficerPlaceholder,
  resolveAuditDashboard,
};
