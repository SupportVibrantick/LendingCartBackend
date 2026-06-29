const {
  findOrCreateClientOfficerConversation,
  syncLoanOfficerForApplication,
} = require("./brokerOfficerConversation");
const {
  notifyBroker,
  BROKER_NOTIFICATION_EVENTS,
} = require("./brokerNotifications");

const SUBBROKER_CHAT_DB_TYPE = "CLIENT_BROKER";

/**
 * When a co-broker is assigned to an application, auto-assign their
 * configured loan officer(s) to the same application.
 */
async function autoAssignSubBrokerLoanOfficers(
  prisma,
  fastify,
  { loanApplicationId, subBrokerId, brokerOrgId, assignedByUserId },
) {
  const links = await prisma.subBrokerLoanOfficer.findMany({
    where: { subBrokerId },
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

  const officerIds = links.map((link) => link.loanOfficerId);
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

  const conversation = await prisma.conversation.findFirst({
    where: {
      loanApplicationId,
      type: SUBBROKER_CHAT_DB_TYPE,
    },
    select: { id: true },
  });

  if (conversation) {
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
      subject: "Loan Officer Assigned",
      body: `${officerName} auto-assigned to application ${application.applicationNumber} via co-broker assignment`,
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
