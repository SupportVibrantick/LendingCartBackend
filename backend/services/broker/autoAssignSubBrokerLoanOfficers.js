const {
  findOrCreateClientOfficerConversation,
  syncLoanOfficerForApplication,
  syncClientBrokerTeamParticipants,
} = require("../messaging/brokerOfficerConversation");
const {
  notifyBroker,
  BROKER_NOTIFICATION_EVENTS,
} = require("../notifications/brokerNotifications");

const SUBBROKER_CHAT_DB_TYPE = "CLIENT_BROKER";

/**
 * When a co-broker creates or receives an application, assign every loan
 * officer linked to that co-broker (User Management → Co-Broker).
 */
async function autoAssignSubBrokerLoanOfficers(
  prisma,
  fastify,
  { loanApplicationId, subBrokerId, brokerOrgId, assignedByUserId },
) {
  if (!loanApplicationId || !subBrokerId || !brokerOrgId) return [];

  const links = await prisma.subBrokerLoanOfficer.findMany({
    where: {
      subBrokerId,
      loanOfficer: {
        organizationId: brokerOrgId,
        isDeleted: false,
        status: "ACTIVE",
        roles: {
          some: { role: { name: "BROKER_OFFICER" } },
        },
      },
    },
    include: {
      loanOfficer: {
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
      clientId: true,
      brokerUserId: true,
      brokerUser: {
        select: {
          id: true,
          roles: {
            select: {
              role: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!application) return [];

  const officerIds = [...new Set(links.map((link) => link.loanOfficerId))];
  const currentOfficerId = application.brokerUser?.roles?.some(
    (role) => role.role?.name === "BROKER_OFFICER",
  )
    ? application.brokerUserId
    : null;

  const primaryOfficerId =
    currentOfficerId && officerIds.includes(currentOfficerId)
      ? currentOfficerId
      : officerIds[0];

  if (!currentOfficerId && primaryOfficerId) {
    await prisma.loanApplication.update({
      where: { id: loanApplicationId },
      data: { brokerUserId: primaryOfficerId },
    });

    await syncLoanOfficerForApplication(prisma, {
      loanApplicationId,
      previousOfficerId: null,
      newOfficerId: primaryOfficerId,
    });

    if (application.clientId) {
      await findOrCreateClientOfficerConversation(prisma, {
        loanApplicationId,
        loanOfficerId: primaryOfficerId,
        clientId: application.clientId,
      });
    }
  }

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

  const conversation = await prisma.conversation.findFirst({
    where: {
      loanApplicationId,
      type: SUBBROKER_CHAT_DB_TYPE,
    },
    select: { id: true },
  });

  if (conversation && officerIds.length > 0) {
    await prisma.conversationParticipant.createMany({
      data: officerIds.map((loanOfficerId) => ({
        conversationId: conversation.id,
        participantType: "BROKER",
        participantId: loanOfficerId,
      })),
      skipDuplicates: true,
    });
  }

  for (const link of links) {
    const officerName =
      `${link.loanOfficer.firstName || ""} ${link.loanOfficer.lastName || ""}`.trim() ||
      "Loan Officer";

    await notifyBroker(prisma, fastify?.io, {
      brokerOrgId,
      eventType: BROKER_NOTIFICATION_EVENTS.LOAN_OFFICER_ASSIGNED,
      category: "ASSIGNMENT",
      subject: "New Application Assigned",
      body: `${officerName} assigned to application ${application.applicationNumber} via co-broker`,
      metadata: {
        applicationId: loanApplicationId,
        applicationNumber: application.applicationNumber,
        loanOfficerId: link.loanOfficerId,
        officerName,
        subBrokerId,
        assignedByUserId,
        autoAssigned: true,
      },
      recipientUserId: link.loanOfficerId,
    });
  }

  return officerIds;
}

module.exports = {
  autoAssignSubBrokerLoanOfficers,
};
