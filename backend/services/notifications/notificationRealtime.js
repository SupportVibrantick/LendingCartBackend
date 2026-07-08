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

function emitPlatformNotification(io, platformOrgId, notification) {
  if (!io || !platformOrgId || !notification) return;

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

  io.to(`platform_${platformOrgId}`).emit("NOTIFICATION", payload);
}

function emitClientNotification(io, clientId, notification) {
  if (!io || !clientId || !notification) return;

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

  io.to(`client_${clientId}`).emit("CLIENT_NOTIFICATION", payload);
}

function emitLenderNotification(io, lenderOrgId, notification) {
  if (!io || !lenderOrgId || !notification) return;

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

  io.to(`lender_${lenderOrgId}`).emit("NOTIFICATION", payload);
}

module.exports = {
  emitBrokerNotification,
  emitPlatformNotification,
  emitClientNotification,
  emitLenderNotification,
};
