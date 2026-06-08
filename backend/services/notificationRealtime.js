/**
 * Push in-app notifications to broker org socket rooms.
 */
function emitBrokerNotification(io, brokerOrgId, notification) {
  if (!io || !brokerOrgId || !notification) return;

  const payload = {
    id: notification.id,
    eventType: notification.eventType,
    category: notification.category,
    subject: notification.subject,
    body: notification.body,
    metadata: notification.metadata || {},
    createdAt: notification.createdAt,
    isRead: false,
  };

  io.to(`broker_${brokerOrgId}`).emit("NOTIFICATION", payload);

  if (notification.eventType === "LOI_GENERATED") {
    io.to(`broker_${brokerOrgId}`).emit("LOI_GENERATED", {
      id: notification.id,
      body: notification.body,
      applicationId: notification.metadata?.applicationId,
      applicationNumber: notification.metadata?.applicationNumber,
      applicationLenderId: notification.metadata?.applicationLenderId,
      lenderName: notification.metadata?.lenderName,
      loiPath: notification.metadata?.loiPath,
      createdAt: notification.createdAt,
    });
  }
}

module.exports = { emitBrokerNotification };
