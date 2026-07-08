const prisma = require("../client");
const { ensureConversationTypes } = require("./ensureConversationTypes");
const {
  findBrokerAdmin,
  findOrCreateBrokerOfficerConversation,
  findOrCreateClientOfficerConversation,
} = require("../../services/messaging/brokerOfficerConversation");

async function ensureClientBrokerConversation(prismaClient, loan) {
  let conversation = await prismaClient.conversation.findFirst({
    where: {
      loanApplicationId: loan.id,
      type: "CLIENT_BROKER",
    },
  });

  if (conversation) return conversation;

  conversation = await prismaClient.conversation.create({
    data: {
      loanApplicationId: loan.id,
      type: "CLIENT_BROKER",
    },
  });

  const participants = [];

  if (loan.brokerUserId) {
    participants.push({
      conversationId: conversation.id,
      participantType: "BROKER",
      participantId: loan.brokerUserId,
    });
  }

  const client = await prismaClient.client.findUnique({
    where: { id: loan.clientId },
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

  const clientUsers = await prismaClient.clientPortalUser.findMany({
    where: { clientId: loan.clientId, isDeleted: false },
    select: { id: true },
  });

  clientUsers.forEach((user) => {
    participants.push({
      conversationId: conversation.id,
      participantType: "CLIENT",
      participantId: user.id,
    });
  });

  if (participants.length > 0) {
    await prismaClient.conversationParticipant.createMany({
      data: participants,
      skipDuplicates: true,
    });
  }

  return conversation;
}

async function seedWelcomeMessage(prismaClient, conversationId, senderUserId, text) {
  const existing = await prismaClient.message.findFirst({
    where: { conversationId },
  });

  if (existing) return;

  const message = await prismaClient.message.create({
    data: {
      conversationId,
      senderType: "BROKER",
      senderUserId,
      type: "TEXT",
      text,
    },
  });

  await prismaClient.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: message.createdAt },
  });
}

async function seedLoanMessaging(loanApplicationId) {
  const loan = await prisma.loanApplication.findUnique({
    where: { id: loanApplicationId },
    select: {
      id: true,
      brokerOrgId: true,
      brokerUserId: true,
      clientId: true,
      applicationNumber: true,
    },
  });

  if (!loan?.brokerUserId) {
    console.log("ℹ️ Skipping messaging seed — no loan officer assigned");
    return;
  }

  console.log("🚀 Seeding loan messaging...");

  await ensureConversationTypes();

  const brokerAdmin = await findBrokerAdmin(prisma, loan.brokerOrgId);

  const clientBrokerConv = await ensureClientBrokerConversation(prisma, loan);
  await seedWelcomeMessage(
    prisma,
    clientBrokerConv.id,
    loan.brokerUserId,
    "Welcome! Please upload the requested documents when you have a moment.",
  );

  const officerConv = await findOrCreateClientOfficerConversation(prisma, {
    loanApplicationId: loan.id,
    loanOfficerId: loan.brokerUserId,
    clientId: loan.clientId,
  });
  await seedWelcomeMessage(
    prisma,
    officerConv.id,
    loan.brokerUserId,
    "Hi — I'm your assigned loan officer. Message me here anytime with questions.",
  );

  if (brokerAdmin) {
    const brokerOfficerConv = await findOrCreateBrokerOfficerConversation(
      prisma,
      {
        loanApplicationId: loan.id,
        brokerAdminId: brokerAdmin.id,
        loanOfficerId: loan.brokerUserId,
      },
    );
    await seedWelcomeMessage(
      prisma,
      brokerOfficerConv.id,
      brokerAdmin.id,
      "This file has been assigned to you. Reach out here for internal coordination.",
    );
  }

  console.log("✅ Loan messaging seeded for", loan.applicationNumber);
}

module.exports = { seedLoanMessaging };
