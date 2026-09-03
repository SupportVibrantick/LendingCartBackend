const {
  syncClientBrokerTeamParticipants,
} = require("../messaging/brokerOfficerConversation");
const {
  notifyBroker,
  BROKER_NOTIFICATION_EVENTS,
} = require("../notifications/brokerNotifications");

const SUBBROKER_CHAT_DB_TYPE = "CLIENT_BROKER";

/**
 * When a loan officer creates or receives an application, assign every
 * co-broker linked to that officer (User Management → Loan Officer).
 */
async function autoAssignLoanOfficerCoBrokers(
  prisma,
  fastify,
  { loanApplicationId, loanOfficerId, brokerOrgId, assignedByUserId },
) {
  if (!loanOfficerId || !loanApplicationId || !brokerOrgId) return [];

  const links = await prisma.subBrokerLoanOfficer.findMany({
    where: {
      loanOfficerId,
      subBroker: {
        organizationId: brokerOrgId,
        isDeleted: false,
        status: "ACTIVE",
        roles: {
          some: { role: { name: "SUB_BROKER" } },
        },
      },
    },
    include: {
      subBroker: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (links.length === 0) return [];

  const application = await prisma.loanApplication.findFirst({
    where: {
      id: loanApplicationId,
      brokerOrgId,
    },
    select: {
      id: true,
      applicationNumber: true,
    },
  });

  if (!application) return [];

  const subBrokerIds = [...new Set(links.map((link) => link.subBrokerId))];

  await prisma.subBrokerApplication.createMany({
    data: subBrokerIds.map((subBrokerId) => ({
      loanApplicationId,
      subBrokerId,
      assignedById: assignedByUserId || loanOfficerId,
    })),
    skipDuplicates: true,
  });

  const existingConversation = await prisma.conversation.findFirst({
    where: {
      loanApplicationId,
      type: SUBBROKER_CHAT_DB_TYPE,
    },
    select: { id: true },
  });

  if (!existingConversation) {
    await prisma.conversation.create({
      data: {
        loanApplicationId,
        type: SUBBROKER_CHAT_DB_TYPE,
      },
    });
  }

  await syncClientBrokerTeamParticipants(prisma, {
    loanApplicationId,
    brokerOrgId,
  });

  for (const link of links) {
    const subBrokerName =
      `${link.subBroker.firstName || ""} ${link.subBroker.lastName || ""}`.trim() ||
      "Co-Broker";

    await notifyBroker(prisma, fastify?.io, {
      brokerOrgId,
      eventType: BROKER_NOTIFICATION_EVENTS.SUBBROKER_ASSIGNED,
      category: "ASSIGNMENT",
      subject: "New Application Assigned",
      body: `${subBrokerName} assigned to application ${application.applicationNumber} via loan officer`,
      metadata: {
        applicationId: loanApplicationId,
        applicationNumber: application.applicationNumber,
        subBrokerId: link.subBrokerId,
        subBrokerName,
        loanOfficerId,
        assignedByUserId: assignedByUserId || loanOfficerId,
        autoAssigned: true,
      },
      recipientUserId: link.subBrokerId,
    });
  }

  return subBrokerIds;
}

module.exports = {
  autoAssignLoanOfficerCoBrokers,
};
