/**
 * Org-level broker ↔ lender chat for Marketplace / Broker Connections.
 * One NETWORK conversation per active BrokerLenderAccess row.
 */

const { findBrokerAdmin } = require("./brokerOfficerConversation");

const NETWORK_CHAT_CATEGORY = "NETWORK";

async function getLenderUsersForOrg(prisma, lenderOrgId) {
  return prisma.userAccount.findMany({
    where: { organizationId: lenderOrgId, status: "ACTIVE" },
    select: { id: true },
  });
}

async function getBrokerUsersForOrg(prisma, brokerOrgId) {
  return prisma.userAccount.findMany({
    where: { organizationId: brokerOrgId, status: "ACTIVE" },
    select: { id: true },
  });
}

async function syncNetworkParticipants(
  prisma,
  conversationId,
  { brokerOrgId, lenderOrgId },
) {
  const [brokerUsers, lenderUsers] = await Promise.all([
    getBrokerUsersForOrg(prisma, brokerOrgId),
    getLenderUsersForOrg(prisma, lenderOrgId),
  ]);

  const participants = [
    ...brokerUsers.map((user) => ({
      conversationId,
      participantType: "BROKER",
      participantId: user.id,
    })),
    ...lenderUsers.map((user) => ({
      conversationId,
      participantType: "LENDER",
      participantId: user.id,
    })),
  ].filter((row) => row.participantId);

  if (participants.length === 0) return;

  await prisma.conversationParticipant.createMany({
    data: participants,
    skipDuplicates: true,
  });
}

/**
 * Resolve active connection between broker + lender orgs, then find/create
 * the NETWORK conversation for that access row.
 */
async function ensureNetworkBrokerLenderConversation(
  prisma,
  {
    brokerOrgId,
    lenderOrgId,
    createdByUserId = null,
  },
) {
  if (!brokerOrgId || !lenderOrgId) {
    const err = new Error("brokerOrgId and lenderOrgId are required");
    err.statusCode = 400;
    throw err;
  }

  const access = await prisma.brokerLenderAccess.findFirst({
    where: {
      brokerOrgId,
      lenderOrgId,
      isActive: true,
    },
    select: {
      id: true,
      brokerOrgId: true,
      lenderOrgId: true,
    },
  });

  if (!access) {
    const err = new Error(
      "No active connection between this broker and lender",
    );
    err.statusCode = 403;
    throw err;
  }

  let conversation = await prisma.conversation.findFirst({
    where: {
      brokerLenderAccessId: access.id,
      type: "BROKER_LENDER",
      chatCategory: NETWORK_CHAT_CATEGORY,
    },
  });

  if (!conversation) {
    try {
      conversation = await prisma.conversation.create({
        data: {
          type: "BROKER_LENDER",
          chatCategory: NETWORK_CHAT_CATEGORY,
          brokerLenderAccessId: access.id,
          loanApplicationId: null,
          applicationLenderId: null,
          createdByUserId: createdByUserId || null,
        },
      });
    } catch (error) {
      // Race: another request created it first
      if (error?.code === "P2002") {
        conversation = await prisma.conversation.findFirst({
          where: {
            brokerLenderAccessId: access.id,
            type: "BROKER_LENDER",
            chatCategory: NETWORK_CHAT_CATEGORY,
          },
        });
      } else {
        throw error;
      }
    }
  }

  if (!conversation) {
    const err = new Error("Failed to create network conversation");
    err.statusCode = 500;
    throw err;
  }

  await syncNetworkParticipants(prisma, conversation.id, {
    brokerOrgId: access.brokerOrgId,
    lenderOrgId: access.lenderOrgId,
  });

  // Ensure at least one broker participant if org user list was empty
  if (createdByUserId) {
    await prisma.conversationParticipant.createMany({
      data: [
        {
          conversationId: conversation.id,
          participantType: "BROKER",
          participantId: createdByUserId,
        },
      ],
      skipDuplicates: true,
    });
  } else {
    const admin = await findBrokerAdmin(prisma, access.brokerOrgId);
    if (admin?.id) {
      await prisma.conversationParticipant.createMany({
        data: [
          {
            conversationId: conversation.id,
            participantType: "BROKER",
            participantId: admin.id,
          },
        ],
        skipDuplicates: true,
      });
    }
  }

  const [brokerOrg, lenderOrg] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: access.brokerOrgId },
      select: { id: true, name: true },
    }),
    prisma.organization.findUnique({
      where: { id: access.lenderOrgId },
      select: { id: true, name: true },
    }),
  ]);

  return {
    conversation,
    access,
    brokerOrg,
    lenderOrg,
  };
}

module.exports = {
  NETWORK_CHAT_CATEGORY,
  ensureNetworkBrokerLenderConversation,
  syncNetworkParticipants,
};
