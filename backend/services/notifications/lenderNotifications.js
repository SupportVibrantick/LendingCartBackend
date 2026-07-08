const { emitLenderNotification } = require("./notificationRealtime");

const LENDER_NOTIFICATION_EVENTS = {
  APPLICATION_RECEIVED: "APPLICATION_RECEIVED",
  DOCUMENT_UPLOADED: "DOCUMENT_UPLOADED",
  NEW_MESSAGE: "NEW_MESSAGE",
};

/**
 * Persist an in-app notification for a lender org and push it over sockets.
 */
async function notifyLender(
  prisma,
  io,
  {
    lenderOrgId,
    eventType,
    category,
    subject,
    body,
    metadata = {},
    recipientUserId = null,
  },
) {
  if (!lenderOrgId || !prisma) return null;

  try {
    const notification = await prisma.notification.create({
      data: {
        eventType,
        category,
        channel: "IN_APP",
        status: "SENT",
        recipientType: "LENDER",
        recipientOrgId: lenderOrgId,
        recipientUserId,
        subject,
        body,
        metadata,
        sentAt: new Date(),
      },
    });

    emitLenderNotification(io, lenderOrgId, notification);
    return notification;
  } catch (err) {
    console.error("Lender notification failed:", err.message);
    return null;
  }
}

async function notifyLendersForForwardedDocument(
  prisma,
  io,
  {
    applicationLenderIds = [],
    loanApplicationId,
    applicationNumber,
    documentTypeName,
    source = "Broker",
  },
) {
  if (!applicationLenderIds.length || !prisma) {
    return [];
  }

  const targets = await prisma.applicationLender.findMany({
    where: { id: { in: applicationLenderIds } },
    select: { id: true, lenderOrgId: true },
  });

  const results = [];

  for (const target of targets) {
    const notification = await notifyLender(prisma, io, {
      lenderOrgId: target.lenderOrgId,
      eventType: LENDER_NOTIFICATION_EVENTS.DOCUMENT_UPLOADED,
      category: "DOCUMENT",
      subject: "New Document Received",
      body: `${source} uploaded ${documentTypeName || "a document"} for application ${applicationNumber || ""}`.trim(),
      metadata: {
        applicationId: loanApplicationId,
        applicationNumber,
        applicationLenderId: target.id,
        documentType: documentTypeName,
        source,
      },
    });

    if (notification) results.push(notification);
  }

  return results;
}

module.exports = {
  notifyLender,
  notifyLendersForForwardedDocument,
  LENDER_NOTIFICATION_EVENTS,
};
