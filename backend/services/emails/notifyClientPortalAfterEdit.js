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

  const resolvedEmail = resolveClientEmailFromData(
    application.client,
    application.submissions,
  );
  const clientEmail =
    normalizeEmail(resolvedEmail) || normalizeEmail(fallbackEmail);
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

  await sendClientPortalAccessEmail({
    prisma,
    to: clientEmail,
    clientName,
    applicationNumber: application.applicationNumber,
    brokerName: application.brokerOrg?.name,
    brokerOrgId: brokerOrgId || application.brokerOrgId,
    portalToken,
    idempotencyKey: `broker-edit-portal:${application.id}:${submissionId || "edit"}`,
    message: UPDATE_PORTAL_MESSAGE,
  });

  log?.info?.(
    {
      applicationId: application.id,
      submissionId,
      clientEmail,
      status: application.status,
    },
    "Client portal access email sent after application edit",
  );

  return { sent: true, clientEmail };
}

module.exports = {
  notifyClientPortalAfterApplicationEdit,
  CLIENT_PORTAL_NOTIFY_STATUSES,
  UPDATE_PORTAL_MESSAGE,
};
