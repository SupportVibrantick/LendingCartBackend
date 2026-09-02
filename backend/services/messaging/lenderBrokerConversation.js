const {
  formatUserName,
  resolvePrincipalBrokerDisplay,
} = require("../messaging/brokerOfficerConversation");
const { ensureLenderChatChannels } = require("../../prisma/ensureLenderChatChannels");

const LENDER_CHAT_CATEGORIES = {
  PRINCIPAL_BROKER: "PRINCIPAL_BROKER",
  LOAN_OFFICER: "LOAN_OFFICER",
};

async function getLenderUsersForOrg(prisma, lenderOrgId) {
  return prisma.userAccount.findMany({
    where: { organizationId: lenderOrgId },
    select: { id: true },
  });
}

function findLenderChannelConversation(conversations, chatCategory) {
  if (chatCategory === LENDER_CHAT_CATEGORIES.PRINCIPAL_BROKER) {
    return conversations.find(
      (conv) =>
        conv.type === "BROKER_LENDER" &&
        (!conv.chatCategory ||
          conv.chatCategory === LENDER_CHAT_CATEGORIES.PRINCIPAL_BROKER),
    );
  }

  return conversations.find(
    (conv) =>
      conv.type === "BROKER_LENDER" &&
      conv.chatCategory === chatCategory,
  );
}

async function syncConversationParticipants(
  prisma,
  conversationId,
  { brokerParticipantId, lenderOrgId },
) {
  if (brokerParticipantId) {
    const existingBroker = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        participantType: "BROKER",
      },
      select: { id: true, participantId: true },
    });

    if (
      existingBroker &&
      existingBroker.participantId !== brokerParticipantId
    ) {
      await prisma.conversationParticipant.update({
        where: { id: existingBroker.id },
        data: { participantId: brokerParticipantId },
      });
    }
  }

  const lenderUsers = await getLenderUsersForOrg(prisma, lenderOrgId);
  const participants = [
    brokerParticipantId
      ? {
          conversationId,
          participantType: "BROKER",
          participantId: brokerParticipantId,
        }
      : null,
    ...lenderUsers.map((user) => ({
      conversationId,
      participantType: "LENDER",
      participantId: user.id,
    })),
  ].filter((row) => row?.participantId);

  if (participants.length === 0) return;

  await prisma.conversationParticipant.createMany({
    data: participants,
    skipDuplicates: true,
  });
}

async function createLenderBrokerChannelConversation(
  prisma,
  {
    loanApplicationId,
    applicationLenderId,
    chatCategory,
    brokerParticipantId,
    lenderOrgId,
  },
) {
  await ensureLenderChatChannels();

  const conversations = await prisma.conversation.findMany({
    where: {
      loanApplicationId,
      applicationLenderId,
      type: "BROKER_LENDER",
    },
  });

  if (chatCategory === LENDER_CHAT_CATEGORIES.LOAN_OFFICER) {
    const legacyPrincipal = conversations.find(
      (conv) => !conv.chatCategory || conv.chatCategory === "",
    );

    if (legacyPrincipal) {
      await prisma.conversation.update({
        where: { id: legacyPrincipal.id },
        data: { chatCategory: LENDER_CHAT_CATEGORIES.PRINCIPAL_BROKER },
      });
      legacyPrincipal.chatCategory = LENDER_CHAT_CATEGORIES.PRINCIPAL_BROKER;
    }
  }

  const existing = findLenderChannelConversation(conversations, chatCategory);

  if (existing) {
    if (
      chatCategory === LENDER_CHAT_CATEGORIES.PRINCIPAL_BROKER &&
      !existing.chatCategory
    ) {
      await prisma.conversation.update({
        where: { id: existing.id },
        data: { chatCategory: LENDER_CHAT_CATEGORIES.PRINCIPAL_BROKER },
      });
    }

    await syncConversationParticipants(prisma, existing.id, {
      brokerParticipantId,
      lenderOrgId,
    });

    return existing;
  }

  let conversation;

  try {
    conversation = await prisma.conversation.create({
      data: {
        loanApplicationId,
        applicationLenderId,
        type: "BROKER_LENDER",
        chatCategory,
      },
    });
  } catch (error) {
    const isLegacyUniqueConflict =
      error?.code === "P2002" &&
      (error?.meta?.target?.includes?.("applicationLenderId") ||
        String(error?.message || "").includes("applicationLenderId"));

    if (isLegacyUniqueConflict) {
      await ensureLenderChatChannels();

      const retryExisting = findLenderChannelConversation(
        await prisma.conversation.findMany({
          where: {
            loanApplicationId,
            applicationLenderId,
            type: "BROKER_LENDER",
          },
        }),
        chatCategory,
      );

      if (retryExisting) {
        await syncConversationParticipants(prisma, retryExisting.id, {
          brokerParticipantId,
          lenderOrgId,
        });
        return retryExisting;
      }

      try {
        conversation = await prisma.conversation.create({
          data: {
            loanApplicationId,
            applicationLenderId,
            type: "BROKER_LENDER",
            chatCategory,
          },
        });
      } catch (retryError) {
        if (retryError?.code === "P2002") {
          const fallback = await prisma.conversation.findFirst({
            where: {
              applicationLenderId,
              type: "BROKER_LENDER",
              chatCategory,
            },
          });

          if (fallback) {
            await syncConversationParticipants(prisma, fallback.id, {
              brokerParticipantId,
              lenderOrgId,
            });
            return fallback;
          }
        }

        throw retryError;
      }
    } else if (error?.code === "P2002") {
      const fallback = await prisma.conversation.findFirst({
        where: {
          applicationLenderId,
          type: "BROKER_LENDER",
          chatCategory,
        },
      });

      if (fallback) {
        await syncConversationParticipants(prisma, fallback.id, {
          brokerParticipantId,
          lenderOrgId,
        });
        return fallback;
      }

      throw error;
    } else {
      throw error;
    }
  }

  await syncConversationParticipants(prisma, conversation.id, {
    brokerParticipantId,
    lenderOrgId,
  });

  return conversation;
}

async function buildLenderLoanInbox(
  prisma,
  { loanId, lenderAccessId, lenderOrgId, brokerOrgId },
) {
  const [loan, conversations, principalBroker] = await Promise.all([
    prisma.loanApplication.findUnique({
      where: { id: loanId },
      select: {
        id: true,
        brokerUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
          },
        },
      },
    }),
    prisma.conversation.findMany({
      where: {
        loanApplicationId: loanId,
        applicationLenderId: lenderAccessId,
        type: "BROKER_LENDER",
      },
      include: {
        participants: true,
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { lastMessageAt: "desc" },
    }),
    resolvePrincipalBrokerDisplay(prisma, brokerOrgId),
  ]);

  const inbox = [];

  const principalConversation = findLenderChannelConversation(
    conversations,
    LENDER_CHAT_CATEGORIES.PRINCIPAL_BROKER,
  );

  inbox.push({
    id: principalConversation?.id || `broker-${principalBroker.id || loanId}`,
    type: "BROKER_LENDER",
    chatCategory: LENDER_CHAT_CATEGORIES.PRINCIPAL_BROKER,
    title: `Principal Broker • ${principalBroker.name}`,
    brokerName: principalBroker.name,
    displayName: principalBroker.name,
    participant: {
      id: principalBroker.id,
      role: "BROKER_ADMIN",
      name: principalBroker.name,
      profileImage: principalBroker.profileImage,
    },
    lastMessage: principalConversation?.messages?.[0]?.text || null,
    lastMessageAt:
      principalConversation?.lastMessageAt ||
      principalConversation?.messages?.[0]?.createdAt ||
      null,
    unread: false,
    unreadCount: 0,
    isPlaceholder: !principalConversation,
  });

  const loanOfficer = loan?.brokerUser;
  if (loanOfficer) {
    const officerName = formatUserName(loanOfficer, "Loan Officer");
    const officerConversation = findLenderChannelConversation(
      conversations,
      LENDER_CHAT_CATEGORIES.LOAN_OFFICER,
    );

    inbox.push({
      id: officerConversation?.id || `officer-${loanOfficer.id}`,
      type: "BROKER_LENDER",
      chatCategory: LENDER_CHAT_CATEGORIES.LOAN_OFFICER,
      title: `Loan Officer • ${officerName}`,
      officerName,
      displayName: officerName,
      participant: {
        id: loanOfficer.id,
        role: "BROKER_OFFICER",
        name: officerName,
        profileImage: loanOfficer.profileImage || null,
      },
      lastMessage: officerConversation?.messages?.[0]?.text || null,
      lastMessageAt:
        officerConversation?.lastMessageAt ||
        officerConversation?.messages?.[0]?.createdAt ||
        null,
      unread: false,
      unreadCount: 0,
      isPlaceholder: !officerConversation,
    });
  }

  return { inbox, conversations };
}

module.exports = {
  LENDER_CHAT_CATEGORIES,
  buildLenderLoanInbox,
  createLenderBrokerChannelConversation,
  findLenderChannelConversation,
};
