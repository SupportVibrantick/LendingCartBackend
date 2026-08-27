const sendMail = require("../../emails/mail");
const { loadTemplate } = require("../../../utils/email/loadTemplate");
const {
  buildClientLinkEmailData,
  buildDocumentUploadEmailData,
} = require("../../../utils/email/emailTemplateData");
const { buildClientPortalUrl, buildLoanPreviewUrl } = require("../../../utils/email/emailBranding");
const {
  notifyClient,
  CLIENT_NOTIFICATION_EVENTS,
} = require("../../notifications/clientNotifications");
const {
  notifyBroker,
  BROKER_NOTIFICATION_EVENTS,
} = require("../../notifications/brokerNotifications");
const {
  notifyLendersForForwardedDocument,
} = require("../../notifications/lenderNotifications");
const { getSignDocumentWorkflow } = require("../../../utils/documents/signDocumentWorkflow");

function documentTitle(requirement) {
  return (
    requirement.signDocumentTitle ||
    requirement.documentType?.name ||
    "Document"
  );
}

async function resolveBrokerEmail(prisma, brokerOrgId) {
  if (!brokerOrgId || !prisma) return null;

  const org = await prisma.organization.findUnique({
    where: { id: brokerOrgId },
    select: {
      email: true,
      users: {
        where: { isDeleted: false, status: "ACTIVE" },
        select: { email: true },
        take: 5,
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return org?.email || org?.users?.find((user) => user.email)?.email || null;
}

async function notifyClientSignDocumentRequested({
  prisma,
  io,
  requirement,
  client,
  application,
  brokerFirstName,
  logger,
}) {
  const workflow = getSignDocumentWorkflow(requirement, requirement.formProgress);
  const title = documentTitle(requirement);
  const isForm = workflow.isForm;

  if (client?.id) {
    await notifyClient(prisma, io, {
      clientId: client.id,
      eventType: CLIENT_NOTIFICATION_EVENTS.DOCUMENTS_REQUESTED,
      category: "DOCUMENTS",
      subject: isForm ? "Form to complete" : "Document signature required",
      body: isForm
        ? `Please complete your fields on: ${title}`
        : `Please review and sign: ${title}`,
      metadata: {
        loanApplicationId: application.id,
        requirementId: requirement.id,
        signDocument: true,
        dynamicForm: isForm,
      },
    });
  }

  const contact =
    client?.contacts?.find((item) => item.isPrimary && item.email) ||
    client?.contacts?.find((item) => item.email);
  const clientEmail = contact?.email;
  if (!clientEmail) return;

  const portalLink = buildClientPortalUrl({ path: "/client-portal" });
  const html = loadTemplate(
    "broker/clientLink",
    buildClientLinkEmailData({
      clientName: client?.legalName,
      uploadLink: portalLink,
      applicationNumber: application.applicationNumber,
      brokerName: brokerFirstName,
      message: isForm
        ? `Please complete the fillable form: ${title}`
        : `Please sign the requested document: ${title}`,
      preset: workflow.emailPreset,
    }),
  );

  try {
    await sendMail({
      to: clientEmail,
      subject: isForm
        ? "Form to complete for your loan application"
        : "Signature required for your loan documents",
      html,
    });
  } catch (mailErr) {
    logger?.warn?.(
      { error: mailErr.message },
      "Sign document client email failed",
    );
  }
}

async function notifyBrokerFormProgress({
  prisma,
  io,
  requirement,
  brokerOrgId,
  application,
  finalized,
  awaitingBrokerFields,
  logger,
}) {
  const title = documentTitle(requirement);
  const subject = finalized
    ? "Fillable form completed"
    : "Client completed their form fields";
  const body = finalized
    ? `${title} is complete and ready to forward to the lender`
    : `${title} — client portion done. Broker fields still pending.`;

  await notifyBroker(prisma, io, {
    brokerOrgId,
    eventType: BROKER_NOTIFICATION_EVENTS.CLIENT_UPLOADED_DOCUMENT,
    category: "DOCUMENTS",
    subject,
    body,
    metadata: {
      loanApplicationId: application.id || application.loanApplicationId,
      requirementId: requirement.id,
      dynamicForm: true,
      finalized: Boolean(finalized),
      awaitingBrokerFields: Boolean(awaitingBrokerFields),
    },
  });

  const brokerEmail = await resolveBrokerEmail(prisma, brokerOrgId);
  if (!brokerEmail) return;

  const html = loadTemplate(
    "clientPortal/documentUpload",
    buildDocumentUploadEmailData({
      clientName: application.client?.legalName || "Client",
      applicationNumber: application.applicationNumber,
      fileName: title,
      applicationId: application.id || application.loanApplicationId,
      dashboardLink: buildLoanPreviewUrl(
        application.id || application.loanApplicationId,
      ),
    }),
  );

  try {
    await sendMail({
      to: brokerEmail,
      subject: finalized
        ? `Form complete — ready to forward (${title})`
        : `Client finished their form fields (${title})`,
      html,
    });
  } catch (mailErr) {
    logger?.warn?.(
      { error: mailErr.message },
      "Sign document broker email failed",
    );
  }
}

async function notifyLenderSignedDocumentForwarded({
  prisma,
  io,
  applicationLenderId,
  loanApplicationId,
  applicationNumber,
  documentTypeName,
  isForm,
}) {
  await notifyLendersForForwardedDocument(prisma, io, {
    applicationLenderIds: [applicationLenderId],
    loanApplicationId,
    applicationNumber,
    documentTypeName,
    source: isForm ? "Broker (completed form)" : "Broker (signed document)",
  });
}

module.exports = {
  notifyClientSignDocumentRequested,
  notifyBrokerFormProgress,
  notifyLenderSignedDocumentForwarded,
  documentTitle,
};
