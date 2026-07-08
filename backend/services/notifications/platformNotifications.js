const { emitPlatformNotification } = require("./notificationRealtime");

const PLATFORM_NOTIFICATION_EVENTS = {
  BROKER_REGISTERED: "BROKER_REGISTERED",
  LENDER_REGISTERED: "LENDER_REGISTERED",
  LANDING_PAGE_LEAD: "LANDING_PAGE_LEAD",
  ADMIN_USER_CREATED: "ADMIN_USER_CREATED",
  APPLICATION_SUBMITTED: "APPLICATION_SUBMITTED",
  SYSTEM_ALERT: "SYSTEM_ALERT",
};

async function getPlatformOrgId(prisma) {
  const org = await prisma.organization.findFirst({
    where: { type: "PLATFORM", status: "ACTIVE" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return org?.id ?? null;
}

/**
 * Persist an in-app notification for platform admins and push over sockets.
 */
async function notifyPlatform(
  prisma,
  io,
  {
    platformOrgId,
    eventType,
    category,
    subject,
    body,
    metadata = {},
    recipientUserId = null,
  },
) {
  if (!prisma) return null;

  let orgId = platformOrgId;
  if (!orgId) {
    orgId = await getPlatformOrgId(prisma);
  }
  if (!orgId) return null;

  try {
    const notification = await prisma.notification.create({
      data: {
        eventType,
        category,
        channel: "IN_APP",
        status: "SENT",
        recipientType: "PLATFORM",
        recipientOrgId: orgId,
        recipientUserId,
        subject,
        body,
        metadata,
        sentAt: new Date(),
      },
    });

    emitPlatformNotification(io, orgId, notification);
    return notification;
  } catch (err) {
    console.error("Platform notification failed:", err.message);
    return null;
  }
}

function buildPlatformNotificationFilter(user) {
  const orgId = user?.organizationId || user?.orgId || null;
  const userId = user?.id || user?.userId || null;

  const recipientOr = [];
  if (orgId) recipientOr.push({ recipientOrgId: orgId });
  if (userId) recipientOr.push({ recipientUserId: userId });

  return {
    deletedAt: null,
    recipientType: "PLATFORM",
    ...(recipientOr.length ? { OR: recipientOr } : {}),
  };
}

module.exports = {
  notifyPlatform,
  getPlatformOrgId,
  buildPlatformNotificationFilter,
  PLATFORM_NOTIFICATION_EVENTS,
};
