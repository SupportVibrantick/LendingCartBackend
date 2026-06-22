const {
  asDisplayText,
  buildBrokerSignInUrl,
  buildClientPortalUrl,
  buildLenderSignInUrl,
  buildLoanPreviewUrl,
  getEmailBranding,
} = require("./emailBranding");

const CLIENT_LINK_PRESETS = {
  portalAccess: {
    emailTitle: "Loan Application Portal",
    headline: "Access your loan application portal",
    intro:
      "Your loan application is ready in the secure client portal.",
    ctaLabel: "Access Your Portal",
    bulletItems: [
      "Upload required documents",
      "Track application status",
      "Respond to broker messages",
    ],
  },
  documentsRequested: {
    emailTitle: "Documents Requested",
    headline: "Documents needed for your application",
    intro:
      "Additional documents are required for your loan application.",
    ctaLabel: "Upload Documents",
    bulletItems: [
      "Review the requested document list",
      "Upload files securely through the portal",
      "Contact your broker if you need help",
    ],
  },
  signatureRequired: {
    emailTitle: "Signature Required",
    headline: "Please sign your loan documents",
    intro:
      "A document is waiting for your signature in the client portal.",
    ctaLabel: "Sign Documents",
    bulletItems: [
      "Open the client portal",
      "Review the document carefully",
      "Complete your electronic signature",
    ],
  },
  lenderConditional: {
    emailTitle: "Documents Required",
    headline: "Additional documents requested",
    intro:
      "Your application needs more documents to continue lender review.",
    ctaLabel: "Upload Documents",
    bulletItems: [
      "Upload the requested documents",
      "Use the secure client portal link below",
      "Contact your broker with any questions",
    ],
  },
};

const buildClientLinkEmailData = ({
  clientName,
  applicationNumber,
  brokerName,
  uploadLink,
  message,
  preset = "portalAccess",
  ctaLabel,
  emailTitle,
  headline,
} = {}) => {
  const presetValues = CLIENT_LINK_PRESETS[preset] || CLIENT_LINK_PRESETS.portalAccess;
  const portalLink =
    uploadLink || buildClientPortalUrl() || buildClientPortalUrl({ path: "/client-portal" });

  return {
    clientName: asDisplayText(clientName, "Customer"),
    applicationNumber: asDisplayText(applicationNumber, "—"),
    brokerName: asDisplayText(brokerName, "Your Broker"),
    uploadLink: portalLink,
    message: asDisplayText(
      message,
      "Please use the secure link below to continue with your loan application.",
    ),
    emailTitle: emailTitle || presetValues.emailTitle,
    headline: headline || presetValues.headline,
    ctaLabel: ctaLabel || presetValues.ctaLabel,
    bulletItems: presetValues.bulletItems,
  };
};

const buildDocumentUploadEmailData = ({
  clientName,
  applicationNumber,
  fileName,
  uploadedAt,
  applicationId,
  dashboardLink,
} = {}) => ({
  clientName: asDisplayText(clientName, "Client"),
  applicationNumber: asDisplayText(applicationNumber, "—"),
  fileName: asDisplayText(fileName, "Document"),
  uploadedAt: asDisplayText(
    uploadedAt,
    new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
  ),
  dashboardLink:
    dashboardLink ||
    buildLoanPreviewUrl(applicationId) ||
    `${getEmailBranding().frontendUrl}/loan-preview`,
});

const buildLenderInviteEmailData = ({ name, email, phone, signupUrl } = {}) => ({
  name: asDisplayText(name, "there"),
  email: asDisplayText(email),
  phone: asDisplayText(phone, "—"),
  signupUrl: signupUrl || buildLenderSignInUrl() || getEmailBranding().lenderDashboardUrl,
});

const buildLenderWelcomeEmailData = ({
  name,
  organizationName,
  organizationEmail,
  organizationPhone,
  brokerName,
  loginUrl,
} = {}) => ({
  name: asDisplayText(name, "there"),
  lenderName: asDisplayText(organizationName, "—"),
  lenderEmail: asDisplayText(organizationEmail, "—"),
  lenderPhone: asDisplayText(organizationPhone, "—"),
  brokerName: asDisplayText(brokerName, "Your broker"),
  loginUrl: loginUrl || buildLenderSignInUrl(),
});

const buildBrokerWelcomeEmailData = ({
  name,
  organizationName,
  organizationEmail,
  organizationPhone,
  adminEmail,
  loginUrl,
} = {}) => ({
  name: asDisplayText(name, "there"),
  organizationName: asDisplayText(organizationName, "—"),
  organizationEmail: asDisplayText(organizationEmail, "—"),
  organizationPhone: asDisplayText(organizationPhone, "—"),
  adminEmail: asDisplayText(adminEmail, "—"),
  loginUrl: loginUrl || buildBrokerSignInUrl(),
});

module.exports = {
  CLIENT_LINK_PRESETS,
  buildClientLinkEmailData,
  buildDocumentUploadEmailData,
  buildLenderInviteEmailData,
  buildLenderWelcomeEmailData,
  buildBrokerWelcomeEmailData,
};
