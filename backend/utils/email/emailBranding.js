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
  // Prefer broker-specific origins. FRONTEND_URL is often the marketing or admin
  // app, which would break password-reset / welcome links if used as fallback.
  const brokerDashboardUrl = ensureAbsoluteUrl(
    firstConfigured(
      process.env.VITE_BROKER_DASHBOARD_URL,
      process.env.BROKER_DASHBOARD_URL,
      process.env.VITE_BROKER_URI,
      // Production broker app (must match the site users sign in on).
      process.env.NODE_ENV === "production"
        ? "https://broker.loanautomation.ai"
        : "",
      frontendUrl,
    ),
  );
  const lenderDashboardUrl = firstConfigured(
    process.env.VITE_LENDER_DASHBOARD_URL,
    process.env.LENDER_DASHBOARD_URL,
    // Production lender app (must match the site users sign up on).
    "https://lender.loanautomation.ai",
  );

  return {
    brandName: "Loan Automation",
    supportEmail: process.env.SUPPORT_EMAIL || "support@lendingcart.in",
    currentYear: new Date().getFullYear(),
    apiBase,
    frontendUrl,
    brokerDashboardUrl,
    lenderDashboardUrl,
    logoUrl: `${apiBase}/public/images/LoanAutomation_new.jpeg`,
  };
};

const buildBrokerSignInUrl = () => {
  const { brokerDashboardUrl } = getEmailBranding();
  const base = stripTrailingSlash(ensureAbsoluteUrl(brokerDashboardUrl));
  if (!base) return "";
  return /\/signin$/i.test(base) ? base : `${base}/signin`;
};

/** Platform admin dashboard sign-in (FRONTEND_URL / ADMIN_DASHBOARD_URL). */
const buildAdminSignInUrl = () => {
  const adminDashboardUrl = ensureAbsoluteUrl(
    firstConfigured(
      process.env.ADMIN_DASHBOARD_URL,
      process.env.VITE_ADMIN_DASHBOARD_URL,
      process.env.FRONTEND_URL,
      "http://localhost:5173",
    ),
  );
  if (!adminDashboardUrl) return "";
  return adminDashboardUrl.includes("/signin")
    ? adminDashboardUrl
    : `${stripTrailingSlash(adminDashboardUrl)}/signin`;
};

const buildLoanAiPricingUrl = () => {
  const base = ensureAbsoluteUrl(
    firstConfigured(
      process.env.LOAN_AI_URL,
      process.env.VITE_LOAN_AI_URL,
      "https://loanautomation.ai",
    ),
  );
  if (!base) return "/#pricing";
  return `${stripTrailingSlash(base)}/#pricing`;
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

const buildClientPortalUrl = ({ token, path = "", baseUrl } = {}) => {
  const { frontendUrl } = getEmailBranding();
  const resolvedBase = stripTrailingSlash(baseUrl || frontendUrl);
  if (!resolvedBase) return "";

  const normalizedPath = path ? `/${String(path).replace(/^\/+/, "")}` : "";
  const base = resolvedBase;

  if (token) {
    return ensureAbsoluteUrl(
      `${base}/client-upload/${encodeURIComponent(token)}`,
    );
  }

  return ensureAbsoluteUrl(
    `${base}${normalizedPath || "/client-portal"}`,
  );
};

/**
 * Client portal URL preferring a verified broker custom domain when available.
 */
async function buildClientPortalUrlForBroker(
  prisma,
  brokerOrgId,
  { token, path = "" } = {},
) {
  const { frontendUrl } = getEmailBranding();
  const {
    resolveBrokerPublicBaseUrl,
  } = require("../../services/broker/customDomain.service");
  const baseUrl = await resolveBrokerPublicBaseUrl(prisma, brokerOrgId, {
    fallback: frontendUrl,
  });
  return buildClientPortalUrl({ token, path, baseUrl });
}

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
  if (!brokerOrgId || !prisma) {
    return {
      ...platform,
      brokerBrandName: platform.brandName,
      brokerLogoUrl: platform.logoUrl,
    };
  }

  const settings = await prisma.brokerWhiteLabelSetting.findFirst({
    where: { brokerOrgId },
    select: {
      logoUrl: true,
      brandName: true,
      supportEmail: true,
      footerText: true,
      primaryColor: true,
    },
  });

  const brokerBrandName =
    asDisplayText(settings?.brandName, "") || platform.brandName;

  const brokerLogoUrl = settings?.logoUrl
    ? resolveEmailAssetUrl(settings.logoUrl, platform.apiBase)
    : platform.logoUrl;

  const supportEmail =
    asDisplayText(settings?.supportEmail, "") || platform.supportEmail;

  return {
    ...platform,
    brandName: brokerBrandName,
    logoUrl: brokerLogoUrl,
    brokerBrandName,
    brokerLogoUrl,
    supportEmail,
    footerText: asDisplayText(settings?.footerText, ""),
    primaryColor: asDisplayText(settings?.primaryColor, "") || "#004aad",
  };
}

module.exports = {
  stripTrailingSlash,
  stripLegacyCustomerPath,
  getEmailBranding,
  buildBrokerSignInUrl,
  buildAdminSignInUrl,
  buildLoanAiPricingUrl,
  buildLenderSignInUrl,
  buildLenderInviteUrl,
  buildLenderPartnerUrl,
  buildLenderVerifyEmailUrl,
  buildClientPortalUrl,
  buildClientPortalUrlForBroker,
  buildLoanPreviewUrl,
  buildLenderLoanPreviewUrl,
  asDisplayText,
  ensureAbsoluteUrl,
  resolveEmailAssetUrl,
  resolveBrokerEmailBranding,
};
