const {
  resolveClientDisplayNameFromData,
  resolveClientEmailFromData,
} = require("../messaging/resolveClientDisplayName");
const {
  createClientPortalToken,
  sendClientPortalAccessEmail,
} = require("./clientPortalAccessEmail");

/** Match statuses where brokers can still edit via LoanPreview. */
const CLIENT_PORTAL_NOTIFY_STATUSES = new Set([
  "CLIENT_PENDING",
  "DRAFT",
  "INCOMPLETE",
  "SUBMITTED",
  "IN_REVIEW",
]);

const UPDATE_PORTAL_MESSAGE =
  "Your loan application has been updated by your broker. Use the secure link below to access your client portal, review the latest details, upload documents, and continue your application.";

function normalizeEmail(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

/**
 * After a broker / LO / co-broker edits an application, email the client a
 * fresh client-portal access link.
 */
async function notifyClientPortalAfterApplicationEdit({
  prisma,
  applicationId,
  brokerOrgId,
  submissionId,
  fallbackEmail,
  /** When set (after portal login email change), ALWAYS send here — never old contact/portal email. */
  forceToEmail,
  log,
}) {
  if (!applicationId || !brokerOrgId) {
    return { sent: false, reason: "missing_ids" };
  }

  const application = await prisma.loanApplication.findUnique({
    where: { id: applicationId },
    include: {
      client: {
        include: {
          contacts: {
            orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
          },
          portalUsers: {
            where: { isDeleted: { not: true }, isActive: true },
            orderBy: [{ lastLoginAt: "desc" }, { createdAt: "desc" }],
            take: 1,
            select: { email: true },
          },
        },
      },
      brokerOrg: {
        select: { id: true, name: true },
      },
      submissions: {
        where: { status: { not: "SUPERSEDED" } },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { fields: true },
      },
    },
  });

  if (!application) {
    return { sent: false, reason: "not_found" };
  }

  if (!CLIENT_PORTAL_NOTIFY_STATUSES.has(application.status)) {
    log?.warn?.(
      { applicationId, status: application.status },
      "Skipped client portal email after edit (status not eligible)",
    );
    return { sent: false, reason: "status", status: application.status };
  }

  if (!application.clientId || !application.client) {
    log?.warn?.(
      { applicationId },
      "Skipped client portal email after edit (no client)",
    );
    return { sent: false, reason: "no_client" };
  }

  const forcedEmail = normalizeEmail(forceToEmail);
  const portalLoginEmail = normalizeEmail(
    application.client.portalUsers?.[0]?.email,
  );
  const resolvedEmail = resolveClientEmailFromData(
    application.client,
    application.submissions,
  );
  // After a portal email update, forceToEmail wins. Otherwise prefer the
  // active portal login, then contact/submission, then optional fallback.
  const clientEmail =
    forcedEmail ||
    portalLoginEmail ||
    normalizeEmail(resolvedEmail) ||
    normalizeEmail(fallbackEmail);
  if (!clientEmail) {
    log?.warn?.(
      { applicationId, submissionId },
      "Skipped client portal email after edit (no email)",
    );
    return { sent: false, reason: "no_email" };
  }

  const clientName = resolveClientDisplayNameFromData(
    application.client,
    application.submissions,
  );

  const portalToken = await prisma.$transaction(async (tx) =>
    createClientPortalToken(tx, {
      loanApplicationId: application.id,
      clientId: application.clientId,
    }),
  );

  // Keep primary contact aligned with the address we are about to email so
  // later resolves do not fall back to a stale inbox.
  const primaryContact = application.client.contacts?.[0];
  if (
    primaryContact?.id &&
    normalizeEmail(primaryContact.email) !== clientEmail
  ) {
    try {
      await prisma.clientContact.update({
        where: { id: primaryContact.id },
        data: { email: clientEmail },
      });
    } catch (contactErr) {
      log?.warn?.(
        {
          applicationId,
          contactId: primaryContact.id,
          error: contactErr.message,
        },
        "Could not sync primary contact email before portal notify",
      );
    }
  }

  // Unique per edit attempt so a prior SENT outbox row cannot suppress a new
  // delivery (Gmail also treats identical subjects as one thread).
  const outbox = await sendClientPortalAccessEmail({
    prisma,
    to: clientEmail,
    clientName,
    applicationNumber: application.applicationNumber,
    brokerName: application.brokerOrg?.name,
    brokerOrgId: brokerOrgId || application.brokerOrgId,
    portalToken,
    idempotencyKey: `broker-edit-portal:${application.id}:${submissionId || "edit"}:${clientEmail}:${Date.now()}`,
    message: UPDATE_PORTAL_MESSAGE,
    subject: "Your loan application was updated — portal access",
    textIntro:
      "Your loan application has been updated by your broker.",
  });

  const delivered = outbox?.status === "SENT";
  log?.info?.(
    {
      applicationId: application.id,
      submissionId,
      clientEmail,
      forcedToUpdatedEmail: Boolean(forcedEmail),
      status: application.status,
      outboxId: outbox?.id || null,
      outboxStatus: outbox?.status || null,
      delivered,
    },
    delivered
      ? "Client portal access email sent after application edit"
      : "Client portal access email queued/failed after application edit",
  );

  return {
    sent: delivered,
    clientEmail,
    reason: delivered ? "sent" : "outbox_not_sent",
    outboxStatus: outbox?.status || null,
  };
}

module.exports = {
  notifyClientPortalAfterApplicationEdit,
  CLIENT_PORTAL_NOTIFY_STATUSES,
  UPDATE_PORTAL_MESSAGE,
};
