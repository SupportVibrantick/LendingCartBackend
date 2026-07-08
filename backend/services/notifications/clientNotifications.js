const { emitClientNotification } = require("./notificationRealtime");

const CLIENT_NOTIFICATION_EVENTS = {
  DOCUMENTS_REQUESTED: "DOCUMENTS_REQUESTED",
  LENDER_APPROVED: "LENDER_APPROVED",
  LENDER_DECLINED: "LENDER_DECLINED",
  LENDER_CONDITIONAL: "LENDER_CONDITIONAL",
  NEW_MESSAGE: "NEW_MESSAGE",
  APPLICATION_SUBMITTED: "APPLICATION_SUBMITTED",
  FEE_AGREEMENT_READY: "FEE_AGREEMENT_READY",
};

/**
 * Persist an in-app notification for a client and push it over sockets.
 */
async function notifyClient(
  prisma,
  io,
  {
    clientId,
    eventType,
    category,
    subject,
    body,
    metadata = {},
  },
) {
  if (!clientId || !prisma) return null;

  try {
    const notification = await prisma.notification.create({
      data: {
        eventType,
        category,
        channel: "IN_APP",
        status: "SENT",
        recipientType: "CLIENT",
        recipientClientId: clientId,
        subject,
        body,
        metadata,
        sentAt: new Date(),
      },
    });

    emitClientNotification(io, clientId, notification);
    return notification;
  } catch (err) {
    console.error("Client notification failed:", err.message);
    return null;
  }
}

module.exports = {
  notifyClient,
  CLIENT_NOTIFICATION_EVENTS,
};
