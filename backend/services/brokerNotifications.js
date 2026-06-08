const { emitBrokerNotification } = require("./notificationRealtime");

const BROKER_NOTIFICATION_EVENTS = {
  APPLICATION_CREATED: "APPLICATION_CREATED",
  APPLICATION_SUBMITTED: "APPLICATION_SUBMITTED",
  LOAN_OFFICER_ASSIGNED: "LOAN_OFFICER_ASSIGNED",
  SUBBROKER_ASSIGNED: "SUBBROKER_ASSIGNED",
  APPLICATION_SENT_TO_LENDERS: "APPLICATION_SENT_TO_LENDERS",
  LENDER_DECISION_APPROVED: "LENDER_DECISION_APPROVED",
  LENDER_DECISION_DECLINED: "LENDER_DECISION_DECLINED",
  LENDER_DECISION_CONDITIONAL: "LENDER_DECISION_CONDITIONAL",
  SUBBROKER_DOCUMENT_SENT: "SUBBROKER_DOCUMENT_SENT",
  CLIENT_UPLOADED_DOCUMENT: "CLIENT_UPLOADED_DOCUMENT",
  LOI_GENERATED: "LOI_GENERATED",
  NEW_MESSAGE: "NEW_MESSAGE",
};

/**
 * Persist an in-app notification for a broker org and push it over sockets.
 */
async function notifyBroker(
  prisma,
  io,
  {
    brokerOrgId,
    eventType,
    category,
    subject,
    body,
    metadata = {},
    recipientUserId = null,
  },
) {
  if (!brokerOrgId || !prisma) return null;

  try {
    const notification = await prisma.notification.create({
      data: {
        eventType,
        category,
        channel: "IN_APP",
        status: "SENT",
        recipientType: "BROKER",
        recipientOrgId: brokerOrgId,
        recipientUserId,
        subject,
        body,
        metadata,
        sentAt: new Date(),
      },
    });

    emitBrokerNotification(io, brokerOrgId, notification);
    return notification;
  } catch (err) {
    console.error("Broker notification failed:", err.message);
    return null;
  }
}

module.exports = {
  notifyBroker,
  BROKER_NOTIFICATION_EVENTS,
};
