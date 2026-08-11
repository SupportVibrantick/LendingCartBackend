const crypto = require("crypto");
const { loadTemplateAsync } = require("../../utils/email/loadTemplate");
const { buildClientPortalUrl } = require("../../utils/email/emailBranding");
const { buildClientLinkEmailData } = require("../../utils/email/emailTemplateData");
const sendMail = require("./mail");

const DEFAULT_PORTAL_MESSAGE =
  "Your loan application has been submitted successfully. Use the secure link below to access your client portal, upload documents, and track your application status.";

async function createClientPortalToken(
  tx,
  { loanApplicationId, clientId, expiresInDays = 7 },
) {
  const portalToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
  );

  const record = await tx.clientUploadToken.upsert({
    where: { loanApplicationId },
    update: {
      token: portalToken,
      expiresAt,
      isUsed: false,
    },
    create: {
      loanApplicationId,
      clientId,
      token: portalToken,
      expiresAt,
    },
  });

  return record.token;
}

async function sendClientPortalAccessEmail({
  prisma,
  to,
  clientName,
  applicationNumber,
  brokerName,
  brokerOrgId,
  portalToken,
  idempotencyKey,
  message = DEFAULT_PORTAL_MESSAGE,
}) {
  const uploadLink = buildClientPortalUrl({ token: portalToken });
  const { html, logoAttachment } = await loadTemplateAsync(
    "broker/clientLink",
    {
      ...buildClientLinkEmailData({
        clientName,
        uploadLink,
        applicationNumber,
        brokerName: brokerName || "Your Broker",
        preset: "portalAccess",
        message,
      }),
      prisma,
      brokerOrgId,
    },
  );

  const subject = "Access Your Loan Application Portal";
  const text = [
    "Your loan application has been submitted successfully.",
    "",
    "Access your client portal using this secure link:",
    uploadLink,
  ].join("\n");

  return sendMail({
    prisma,
    to,
    subject,
    text,
    html,
    logoAttachment,
    idempotencyKey,
  });
}

module.exports = {
  createClientPortalToken,
  sendClientPortalAccessEmail,
  DEFAULT_PORTAL_MESSAGE,
};
