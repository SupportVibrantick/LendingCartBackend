/**
 * Shared helpers for Broker Admin ↔ Loan Officer messaging.
 */

async function findBrokerAdmin(prisma, brokerOrgId) {
  if (!brokerOrgId) return null;

  const brokerAdmin = await prisma.userAccount.findFirst({
    where: {
      organizationId: brokerOrgId,
      status: "ACTIVE",
      roles: {
        some: {
          role: {
            name: "BROKER_ADMIN",
          },
        },
      },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      profileImage: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (brokerAdmin) return brokerAdmin;

  return prisma.userAccount.findFirst({
    where: {
      organizationId: brokerOrgId,
      status: "ACTIVE",
      roles: {
        some: {
          role: {
            name: {
              in: ["BROKER_ADMIN", "BROKER_OFFICER"],
            },
          },
        },
      },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      profileImage: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

async function findOrCreateBrokerOfficerConversation(
  prisma,
  { loanApplicationId, brokerAdminId, loanOfficerId },
) {
  const existingConversation = await prisma.conversation.findFirst({
    where: {
      loanApplicationId,
      type: "BROKER_OFFICER",
    },
  });

  if (existingConversation) {
    return existingConversation;
  }

  const conversation = await prisma.conversation.create({
    data: {
      loanApplicationId,
      type: "BROKER_OFFICER",
    },
  });

  await prisma.conversationParticipant.createMany({
    data: [
      {
        conversationId: conversation.id,
        participantType: "BROKER",
        participantId: brokerAdminId,
      },
      {
        conversationId: conversation.id,
        participantType: "BROKER",
        participantId: loanOfficerId,
      },
    ],
    skipDuplicates: true,
  });

  return conversation;
}

async function syncLoanOfficerForApplication(
  prisma,
  { loanApplicationId, previousOfficerId, newOfficerId },
) {
  const conversations = await prisma.conversation.findMany({
    where: {
      loanApplicationId,
      type: { in: ["CLIENT_OFFICER", "BROKER_OFFICER", "CLIENT_BROKER"] },
    },
    select: { id: true, type: true },
  });

  if (conversations.length === 0) {
    return;
  }

  const conversationIds = conversations.map((conv) => conv.id);

  if (previousOfficerId && previousOfficerId !== newOfficerId) {
    await prisma.conversationParticipant.deleteMany({
      where: {
        conversationId: { in: conversationIds },
        participantType: "BROKER",
        participantId: previousOfficerId,
      },
    });
  }

  if (!newOfficerId) {
    await syncClientBrokerTeamParticipants(prisma, { loanApplicationId });
    return;
  }

  for (const conv of conversations) {
    if (conv.type === "CLIENT_OFFICER") {
      const brokerParticipants = await prisma.conversationParticipant.findMany({
        where: {
          conversationId: conv.id,
          participantType: "BROKER",
        },
        select: { id: true, participantId: true },
      });

      for (const participant of brokerParticipants) {
        if (participant.participantId !== newOfficerId) {
          await prisma.conversationParticipant.delete({
            where: { id: participant.id },
          });
        }
      }
    }

    await prisma.conversationParticipant.createMany({
      data: [
        {
          conversationId: conv.id,
          participantType: "BROKER",
          participantId: newOfficerId,
        },
      ],
      skipDuplicates: true,
    });
  }

  await syncClientBrokerTeamParticipants(prisma, { loanApplicationId });
}

/**
 * Keep CLIENT_BROKER participants in sync with the broker team assigned to a loan.
 * Clients see one team thread; admin, LO, and co-brokers participate here.
 */
async function syncClientBrokerTeamParticipants(
  prisma,
  { loanApplicationId, brokerOrgId: brokerOrgIdOverride } = {},
) {
  if (!loanApplicationId) return;

  const conversation = await prisma.conversation.findFirst({
    where: {
      loanApplicationId,
      type: "CLIENT_BROKER",
      OR: [
        { chatCategory: null },
        { chatCategory: "PRINCIPAL" },
        { chatCategory: "PRINCIPAL_BROKER" },
      ],
    },
    select: { id: true },
  });

  if (!conversation) return;

  const loan = await prisma.loanApplication.findUnique({
    where: { id: loanApplicationId },
    select: {
      brokerOrgId: true,
      brokerUserId: true,
    },
  });

  const brokerOrgId = brokerOrgIdOverride || loan?.brokerOrgId;
  if (!brokerOrgId) return;

  const brokerAdmin = await findBrokerAdmin(prisma, brokerOrgId);

  const subBrokerAssignments = await prisma.subBrokerApplication.findMany({
    where: { loanApplicationId },
    select: { subBrokerId: true },
  });

  const participantRows = [];

  if (brokerAdmin?.id) {
    participantRows.push({
      conversationId: conversation.id,
      participantType: "BROKER",
      participantId: brokerAdmin.id,
    });
  }

  if (loan?.brokerUserId) {
    participantRows.push({
      conversationId: conversation.id,
      participantType: "BROKER",
      participantId: loan.brokerUserId,
    });
  }

  for (const assignment of subBrokerAssignments) {
    participantRows.push({
      conversationId: conversation.id,
      participantType: "SUB_BROKER",
      participantId: assignment.subBrokerId,
    });
  }

  const allowedBrokerIds = new Set(
    participantRows
      .filter((row) => row.participantType === "BROKER")
      .map((row) => row.participantId),
  );
  const allowedSubBrokerIds = new Set(
    participantRows
      .filter((row) => row.participantType === "SUB_BROKER")
      .map((row) => row.participantId),
  );

  const existingParticipants = await prisma.conversationParticipant.findMany({
    where: {
      conversationId: conversation.id,
      participantType: { in: ["BROKER", "SUB_BROKER"] },
    },
    select: { id: true, participantType: true, participantId: true },
  });

  for (const participant of existingParticipants) {
    const isAllowed =
      (participant.participantType === "BROKER" &&
        allowedBrokerIds.has(participant.participantId)) ||
      (participant.participantType === "SUB_BROKER" &&
        allowedSubBrokerIds.has(participant.participantId));

    if (!isAllowed) {
      await prisma.conversationParticipant.delete({
        where: { id: participant.id },
      });
    }
  }

  if (participantRows.length > 0) {
    await prisma.conversationParticipant.createMany({
      data: participantRows,
      skipDuplicates: true,
    });
  }
}

async function findOrCreateClientCoBrokerConversation(
  prisma,
  { loanApplicationId, clientId, subBrokerId },
) {
  if (!loanApplicationId || !clientId || !subBrokerId) {
    return null;
  }

  const chatCategory = buildClientCoBrokerCategory(subBrokerId);

  const existingConversation = await prisma.conversation.findFirst({
    where: {
      loanApplicationId,
      type: "CLIENT_BROKER",
      chatCategory,
    },
  });

  if (existingConversation) {
    return existingConversation;
  }

  const conversation = await prisma.conversation.create({
    data: {
      loanApplicationId,
      type: "CLIENT_BROKER",
      chatCategory,
    },
  });

  await prisma.conversationParticipant.createMany({
    data: [
      {
        conversationId: conversation.id,
        participantType: "SUB_BROKER",
        participantId: subBrokerId,
      },
    ],
    skipDuplicates: true,
  });

  await appendClientPortalParticipants(prisma, {
    conversationId: conversation.id,
    clientId,
  });

  return conversation;
}

async function findOrCreateClientOfficerConversation(
  prisma,
  { loanApplicationId, loanOfficerId, clientId },
) {
  const existingConversation = await prisma.conversation.findFirst({
    where: {
      loanApplicationId,
      type: "CLIENT_OFFICER",
    },
  });

  if (existingConversation) {
    if (loanOfficerId) {
      await syncLoanOfficerForApplication(prisma, {
        loanApplicationId,
        previousOfficerId: null,
        newOfficerId: loanOfficerId,
      });
    }
    return existingConversation;
  }

  const conversation = await prisma.conversation.create({
    data: {
      loanApplicationId,
      type: "CLIENT_OFFICER",
    },
  });

  await prisma.conversationParticipant.createMany({
    data: [
      {
        conversationId: conversation.id,
        participantType: "BROKER",
        participantId: loanOfficerId,
      },
    ],
    skipDuplicates: true,
  });

  await appendClientPortalParticipants(prisma, {
    conversationId: conversation.id,
    clientId,
  });

  return conversation;
}

function formatUserName(user, fallback = "User") {
  return (
    `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || fallback
  );
}

const CO_BROKER_CLIENT_CATEGORY_PREFIX = "CO_BROKER:";

function buildClientCoBrokerCategory(subBrokerId) {
  return `${CO_BROKER_CLIENT_CATEGORY_PREFIX}${subBrokerId}`;
}

function isCoBrokerClientChannel(chatCategory) {
  return (
    typeof chatCategory === "string" &&
    chatCategory.startsWith(CO_BROKER_CLIENT_CATEGORY_PREFIX)
  );
}

function isPrincipalClientBrokerChannel(chatCategory) {
  return (
    !chatCategory ||
    chatCategory === "PRINCIPAL" ||
    chatCategory === "PRINCIPAL_BROKER"
  );
}

async function appendClientPortalParticipants(prisma, { conversationId, clientId }) {
  const participants = [];

  const clientUsers = await prisma.clientPortalUser.findMany({
    where: {
      clientId,
      isDeleted: false,
    },
    select: { id: true },
  });

  clientUsers.forEach((user) => {
    participants.push({
      conversationId,
      participantType: "CLIENT",
      participantId: user.id,
    });
  });

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      contacts: {
        where: { isPrimary: true },
        take: 1,
      },
    },
  });

  const clientEmail = client?.contacts?.[0]?.email;
  if (clientEmail) {
    participants.push({
      conversationId,
      participantType: "CLIENT",
      participantEmail: clientEmail.trim().toLowerCase(),
    });
  }

  if (participants.length > 0) {
    await prisma.conversationParticipant.createMany({
      data: participants,
      skipDuplicates: true,
    });
  }
}

async function resolvePrincipalBrokerDisplay(prisma, brokerOrgId) {
  const brokerAdmin = await findBrokerAdmin(prisma, brokerOrgId);

  const org = brokerOrgId
    ? await prisma.organization.findUnique({
        where: { id: brokerOrgId },
        select: { name: true },
      })
    : null;

  const adminName = formatUserName(brokerAdmin, "Broker");
  const orgName = org?.name || null;

  return {
    id: brokerAdmin?.id || null,
    name: orgName || adminName,
    adminName,
    orgName,
    profileImage: brokerAdmin?.profileImage || null,
  };
}

function maskBrokerParticipantsForClient(participants, principalDisplay) {
  const clientParticipants = participants.filter(
    (p) => p.participantType === "CLIENT",
  );

  if (!principalDisplay?.name) {
    return clientParticipants;
  }

  return [
    ...clientParticipants,
    {
      id: principalDisplay.id,
      participantType: "BROKER",
      participantId: principalDisplay.id,
      name: principalDisplay.name,
      role: "BROKER_ADMIN",
    },
  ];
}

function buildClientSideOfficerEntry(formattedConversation, loanOfficer) {
  const officerName = formatUserName(loanOfficer, "Loan Officer");

  return {
    id: formattedConversation?.id || `officer-${loanOfficer.id}`,
    type: "CLIENT_OFFICER",
    chatCategory: null,
    title: `Loan Officer • ${officerName}`,
    brokerName: officerName,
    lastMessage: formattedConversation?.lastMessage || null,
    lastMessageAt: formattedConversation?.lastMessageAt || null,
    unread: false,
    isPlaceholder: !formattedConversation?.id,
    participant: {
      id: loanOfficer.id,
      role: "BROKER_OFFICER",
      name: officerName,
      profileImage: loanOfficer.profileImage || null,
    },
  };
}

function buildClientSideCoBrokerEntry(formattedConversation, subBroker) {
  const coBrokerName = formatUserName(subBroker, "Co-Broker");
  const chatCategory = buildClientCoBrokerCategory(subBroker.id);

  return {
    id: formattedConversation?.id || `co-broker-${subBroker.id}`,
    type: "CLIENT_BROKER",
    chatCategory,
    title: `Co-Broker • ${coBrokerName}`,
    brokerName: coBrokerName,
    lastMessage: formattedConversation?.lastMessage || null,
    lastMessageAt: formattedConversation?.lastMessageAt || null,
    unread: false,
    isPlaceholder: !formattedConversation?.id,
    participant: {
      id: subBroker.id,
      role: "SUB_BROKER",
      name: coBrokerName,
      profileImage: subBroker.profileImage || null,
    },
  };
}

function buildClientSidePrincipalBrokerEntry(
  formattedConversation,
  principalBroker,
) {
  const contactName =
    principalBroker.adminName || principalBroker.name || "Principal Broker";

  return {
    id: formattedConversation?.id || `broker-${principalBroker.id || "org"}`,
    type: "CLIENT_BROKER",
    chatCategory: null,
    title: `Principal Broker • ${contactName}`,
    brokerName: contactName,
    lastMessage: formattedConversation?.lastMessage || null,
    lastMessageAt: formattedConversation?.lastMessageAt || null,
    unread: false,
    isPlaceholder: !formattedConversation?.id,
    participant: {
      id: principalBroker.id,
      role: "BROKER_ADMIN",
      name: contactName,
      profileImage: principalBroker.profileImage || null,
    },
  };
}

function buildBrokerSideEntry(existingConversation, loanOfficer) {
  const officerName = formatUserName(loanOfficer, "Loan Officer");

  return {
    id: existingConversation?.id || `officer-${loanOfficer.id}`,
    type: "BROKER_OFFICER",
    chatCategory: null,
    title: `Loan Officer • ${officerName}`,
    lastMessage: existingConversation?.messages?.[0]?.text || null,
    lastMessageAt: existingConversation?.lastMessageAt || null,
    unread: false,
    participant: {
      id: loanOfficer.id,
      role: "BROKER_OFFICER",
      name: officerName,
      profileImage: loanOfficer.profileImage || null,
    },
  };
}

function buildOfficerSideEntry(existingConversation, brokerAdmin) {
  const adminName = formatUserName(brokerAdmin, "Broker");

  return {
    id: existingConversation?.id || `broker-${brokerAdmin.id}`,
    type: "BROKER_OFFICER",
    chatCategory: null,
    title: `Principal Broker • ${adminName}`,
    lastMessage: existingConversation?.messages?.[0]?.text || null,
    lastMessageAt: existingConversation?.lastMessageAt || null,
    unread: false,
    participant: {
      id: brokerAdmin.id,
      role: "BROKER_ADMIN",
      name: adminName,
      profileImage: brokerAdmin.profileImage || null,
    },
  };
}

const LO_INBOX_PLACEHOLDER_TYPES = [
  "BROKER_OFFICER",
  "CLIENT_OFFICER",
];

/**
 * Prefer the principal CLIENT_BROKER team thread over legacy CLIENT_OFFICER
 * one-on-one lanes when both exist on the same loan.
 */
function filterLoanOfficerClientThreads(conversations) {
  const loansWithTeamThread = new Set(
    conversations
      .filter(
        (conv) =>
          conv.type === "CLIENT_BROKER" &&
          isPrincipalClientBrokerChannel(conv.chatCategory),
      )
      .map((conv) => conv.loanApplicationId),
  );

  return conversations.filter((conv) => {
    if (conv.type !== "CLIENT_OFFICER") return true;
    return !loansWithTeamThread.has(conv.loanApplicationId);
  });
}

/**
 * Broker admins use CLIENT_BROKER as the primary client channel. Hide the
 * dedicated LO-client thread when the main client thread exists on the same loan.
 */
function filterBrokerAdminClientThreads(conversations) {
  const loansWithBrokerClientThread = new Set(
    conversations
      .filter((conv) => conv.type === "CLIENT_BROKER")
      .map((conv) => conv.loanApplicationId),
  );

  return conversations.filter((conv) => {
    if (conv.type !== "CLIENT_OFFICER") return true;
    return !loansWithBrokerClientThread.has(conv.loanApplicationId);
  });
}

function formatBrokerOfficerInboxEntry({
  loan,
  isLoanOfficerViewer,
  principalBroker,
}) {
  if (isLoanOfficerViewer) {
    const adminName =
      principalBroker?.adminName || principalBroker?.name || "Principal Broker";

    return {
      title: `Principal Broker • ${adminName}`,
      brokerName: adminName,
      participant: {
        id: principalBroker?.id || null,
        role: "BROKER_ADMIN",
        name: adminName,
        profileImage: principalBroker?.profileImage || null,
      },
    };
  }

  const officerName = loan?.brokerUser
    ? formatUserName(loan.brokerUser, "Loan Officer")
    : "Loan Officer";

  return {
    title: `Loan Officer • ${officerName}`,
    participant: loan?.brokerUser
      ? {
          id: loan.brokerUser.id,
          role: "BROKER_OFFICER",
          name: officerName,
          profileImage: loan.brokerUser.profileImage || null,
        }
      : null,
  };
}

function buildInboxPlaceholderForLoan({
  loan,
  type,
  principalBroker,
  clientName,
  submissionId,
}) {
  const base = {
    loanApplicationId: loan.id,
    submissionId: submissionId || null,
    applicationNumber: loan.applicationNumber,
    clientLegalName: loan.client?.legalName || clientName || null,
    lastMessage: null,
    lastMessageAt: null,
    unread: false,
    unreadCount: 0,
    isPlaceholder: true,
    chatCategory: null,
  };

  if (type === "BROKER_OFFICER" && principalBroker) {
    const adminName = principalBroker.adminName || "Broker";
    return {
      ...base,
      id: `broker-${loan.id}`,
      type: "BROKER_OFFICER",
      title: `Principal Broker • ${adminName}`,
      brokerName: principalBroker.name || adminName,
      participant: {
        id: principalBroker.id,
        role: "BROKER_ADMIN",
        name: adminName,
        profileImage: principalBroker.profileImage || null,
      },
    };
  }

  if (type === "CLIENT_BROKER" && clientName) {
    return {
      ...base,
      id: `client-${loan.id}`,
      type: "CLIENT_BROKER",
      title: `Client - ${clientName}`,
      clientName,
    };
  }

  if (type === "CLIENT_OFFICER" && clientName) {
    return {
      ...base,
      id: `client-officer-${loan.id}`,
      type: "CLIENT_OFFICER",
      title: `Client • ${clientName}`,
      clientName,
    };
  }

  return null;
}

function buildLoanOfficerInboxPlaceholders({
  loans,
  existingConversations,
  principalBroker,
  submissionMap,
  clientNameResolver,
  typeFilter = "ALL",
}) {
  const existingByLoanType = new Set(
    existingConversations.map((conv) => `${conv.loanApplicationId}:${conv.type}`),
  );

  const placeholders = [];

  for (const loan of loans) {
    const clientName = clientNameResolver(loan);

    for (const type of LO_INBOX_PLACEHOLDER_TYPES) {
      if (typeFilter !== "ALL" && typeFilter !== type) continue;
      if (existingByLoanType.has(`${loan.id}:${type}`)) continue;

      const entry = buildInboxPlaceholderForLoan({
        loan,
        type,
        principalBroker,
        clientName,
        submissionId: submissionMap.get(loan.id) || null,
      });

      if (entry) placeholders.push(entry);
    }
  }

  return placeholders;
}

module.exports = {
  findBrokerAdmin,
  findOrCreateBrokerOfficerConversation,
  findOrCreateClientOfficerConversation,
  findOrCreateClientCoBrokerConversation,
  syncLoanOfficerForApplication,
  syncClientBrokerTeamParticipants,
  buildClientCoBrokerCategory,
  isCoBrokerClientChannel,
  isPrincipalClientBrokerChannel,
  buildBrokerSideEntry,
  buildOfficerSideEntry,
  buildClientSideOfficerEntry,
  buildClientSideCoBrokerEntry,
  buildClientSidePrincipalBrokerEntry,
  buildInboxPlaceholderForLoan,
  buildLoanOfficerInboxPlaceholders,
  filterLoanOfficerClientThreads,
  filterBrokerAdminClientThreads,
  formatBrokerOfficerInboxEntry,
  formatUserName,
  resolvePrincipalBrokerDisplay,
  maskBrokerParticipantsForClient,
};
