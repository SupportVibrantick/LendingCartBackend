/**
 * Shared helpers for Broker Admin ↔ Loan Officer messaging.
 */

async function findBrokerAdmin(prisma, brokerOrgId) {
  return prisma.userAccount.findFirst({
    where: {
      organizationId: brokerOrgId,
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

  const participants = [
    {
      conversationId: conversation.id,
      participantType: "BROKER",
      participantId: loanOfficerId,
    },
  ];

  const clientUsers = await prisma.clientPortalUser.findMany({
    where: {
      clientId,
      isDeleted: false,
    },
    select: { id: true },
  });

  clientUsers.forEach((user) => {
    participants.push({
      conversationId: conversation.id,
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
      conversationId: conversation.id,
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

  return conversation;
}

function formatUserName(user, fallback = "User") {
  return (
    `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || fallback
  );
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
    participant: {
      id: loanOfficer.id,
      role: "BROKER_OFFICER",
      name: officerName,
      profileImage: loanOfficer.profileImage || null,
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
 * Loan officers use CLIENT_OFFICER for direct client chat. Hide CLIENT_BROKER
 * when a dedicated LO thread exists on the same loan to avoid duplicate rows.
 */
function filterLoanOfficerClientThreads(conversations) {
  const loansWithOfficerThread = new Set(
    conversations
      .filter((conv) => conv.type === "CLIENT_OFFICER")
      .map((conv) => conv.loanApplicationId),
  );

  return conversations.filter((conv) => {
    if (conv.type !== "CLIENT_BROKER") return true;
    return !loansWithOfficerThread.has(conv.loanApplicationId);
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
  syncLoanOfficerForApplication,
  buildBrokerSideEntry,
  buildOfficerSideEntry,
  buildClientSideOfficerEntry,
  buildInboxPlaceholderForLoan,
  buildLoanOfficerInboxPlaceholders,
  filterLoanOfficerClientThreads,
  filterBrokerAdminClientThreads,
  formatBrokerOfficerInboxEntry,
  formatUserName,
  resolvePrincipalBrokerDisplay,
  maskBrokerParticipantsForClient,
};
