const stripTrailingSlash = (value) =>
  value == null ? "" : String(value).replace(/\/$/, "");

/** Legacy broker apps used /customer; client portal now lives at /client-portal. */
const stripLegacyCustomerPath = (value) =>
  stripTrailingSlash(value).replace(/\/customer$/i, "");

const firstConfigured = (...values) => {
  for (const value of values) {
    const normalized = stripTrailingSlash(value);
    if (normalized) return normalized;
  }
  return "";
};

function ensureAbsoluteUrl(url) {
  if (!url) return "";
  const trimmed = String(url).trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (
    trimmed.startsWith("localhost") ||
    trimmed.startsWith("127.0.0.1") ||
    trimmed.startsWith("0.0.0.0")
  ) {
    return `http://${trimmed}`;
  }
  return `https://${trimmed}`;
}

const getEmailBranding = () => {
  const apiBase = ensureAbsoluteUrl(
    firstConfigured(
      process.env.VITE_API_BASE,
      process.env.APP_URL,
      "http://localhost:4000",
    ),
  );
  const frontendUrl = ensureAbsoluteUrl(
    stripLegacyCustomerPath(
      firstConfigured(
        process.env.FRONTEND_URL,
        process.env.VITE_BROKER_URI,
        "http://localhost:5173",
      ),
    ),
  );
  const brokerDashboardUrl = firstConfigured(
    process.env.VITE_BROKER_DASHBOARD_URL,
    process.env.BROKER_DASHBOARD_URL,
    frontendUrl,
  );
  const lenderDashboardUrl = firstConfigured(
    process.env.VITE_LENDER_DASHBOARD_URL,
    process.env.LENDER_DASHBOARD_URL,
    "https://lender-lendingcart.vibrantick.org",
  );

  return {
    brandName: "Loan Automation",
    supportEmail: process.env.SUPPORT_EMAIL || "support@lendingcart.in",
    currentYear: new Date().getFullYear(),
    apiBase,
    frontendUrl,
    brokerDashboardUrl,
    lenderDashboardUrl,
    logoUrl: `${apiBase}/public/images/ACOM_LOGO.png`,
  };
};

const buildBrokerSignInUrl = () => {
  const { brokerDashboardUrl } = getEmailBranding();
  if (!brokerDashboardUrl) return "";
  return brokerDashboardUrl.includes("/signin")
    ? brokerDashboardUrl
    : `${brokerDashboardUrl}/signin`;
};

const buildLenderSignInUrl = () => {
  const { lenderDashboardUrl } = getEmailBranding();
  return lenderDashboardUrl ? `${lenderDashboardUrl}/signin` : "";
};

const buildLenderInviteUrl = (token) => {
  const { lenderDashboardUrl } = getEmailBranding();
  if (!lenderDashboardUrl || !token) return "";
  return ensureAbsoluteUrl(
    `${stripTrailingSlash(lenderDashboardUrl)}/invite/${encodeURIComponent(token)}`,
  );
};

const buildLenderPartnerUrl = () => {
  const { lenderDashboardUrl } = getEmailBranding();
  if (!lenderDashboardUrl) return "";
  return ensureAbsoluteUrl(`${stripTrailingSlash(lenderDashboardUrl)}/partner`);
};

const buildLenderVerifyEmailUrl = (token) => {
  const { lenderDashboardUrl } = getEmailBranding();
  if (!lenderDashboardUrl || !token) return "";
  return ensureAbsoluteUrl(
    `${stripTrailingSlash(lenderDashboardUrl)}/verify-email?token=${encodeURIComponent(token)}`,
  );
};

const buildClientPortalUrl = ({ token, path = "" } = {}) => {
  const { frontendUrl } = getEmailBranding();
  if (!frontendUrl) return "";

  const normalizedPath = path ? `/${String(path).replace(/^\/+/, "")}` : "";
  const base = stripTrailingSlash(frontendUrl);

  if (token) {
    return ensureAbsoluteUrl(
      `${base}/client-upload/${encodeURIComponent(token)}`,
    );
  }

  return ensureAbsoluteUrl(
    `${base}${normalizedPath || "/client-portal"}`,
  );
};

const buildLoanPreviewUrl = (applicationId) => {
  const { frontendUrl } = getEmailBranding();
  if (!frontendUrl || !applicationId) return "";
  return `${frontendUrl}/loan-preview?applicationId=${encodeURIComponent(applicationId)}`;
};

const buildLenderLoanPreviewUrl = (applicationLenderId) => {
  const { lenderDashboardUrl } = getEmailBranding();
  if (!lenderDashboardUrl || !applicationLenderId) return "";
  return ensureAbsoluteUrl(
    `${stripTrailingSlash(lenderDashboardUrl)}/loan-preview?applicationLenderId=${encodeURIComponent(applicationLenderId)}&tab=documents`,
  );
};

const asDisplayText = (value, fallback = "") => {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

function resolveEmailAssetUrl(url, apiBase) {
  if (!url) return "";
  const trimmed = String(url).trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("data:")) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;

  const base = stripTrailingSlash(apiBase || "http://localhost:4000");
  if (trimmed.startsWith("/")) return `${base}${trimmed}`;
  return `${base}/public/${trimmed.replace(/^\/+/, "")}`;
}

async function resolveBrokerEmailBranding(prisma, brokerOrgId) {
  const platform = getEmailBranding();
  const { getBrokerWhiteLabelBranding } = require("../../services/broker/brokerBranding");
  const whiteLabel = await getBrokerWhiteLabelBranding(prisma, brokerOrgId);

  const brokerBrandName =
    asDisplayText(whiteLabel.brokerBrandName, "") ||
    platform.brandName;

  const brokerLogoUrl = whiteLabel.brokerLogoUrl
    ? resolveEmailAssetUrl(whiteLabel.brokerLogoUrl, platform.apiBase)
    : platform.logoUrl;

  return {
    ...platform,
    brandName: brokerBrandName,
    logoUrl: brokerLogoUrl,
    brokerBrandName,
    brokerLogoUrl,
  };
}

module.exports = {
  stripTrailingSlash,
  stripLegacyCustomerPath,
  getEmailBranding,
  buildBrokerSignInUrl,
  buildLenderSignInUrl,
  buildLenderInviteUrl,
  buildLenderPartnerUrl,
  buildLenderVerifyEmailUrl,
  buildClientPortalUrl,
  buildLoanPreviewUrl,
  buildLenderLoanPreviewUrl,
  asDisplayText,
  ensureAbsoluteUrl,
  resolveEmailAssetUrl,
  resolveBrokerEmailBranding,
};
