const stripTrailingSlash = (value) =>
  value == null ? "" : String(value).replace(/\/$/, "");

const firstConfigured = (...values) => {
  for (const value of values) {
    const normalized = stripTrailingSlash(value);
    if (normalized) return normalized;
  }
  return "";
};

const getEmailBranding = () => {
  const apiBase = firstConfigured(
    process.env.VITE_API_BASE,
    process.env.APP_URL,
    "http://localhost:4000",
  );
  const frontendUrl = firstConfigured(
    process.env.FRONTEND_URL,
    process.env.VITE_BROKER_URI,
    "http://localhost:5173",
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
    brandName: "LendingCart",
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

const buildClientPortalUrl = ({ token, path = "" } = {}) => {
  const { frontendUrl } = getEmailBranding();
  if (!frontendUrl) return "";

  const normalizedPath = path ? `/${String(path).replace(/^\/+/, "")}` : "";

  if (token) {
    return `${frontendUrl}/client-upload/${encodeURIComponent(token)}`;
  }

  return `${frontendUrl}${normalizedPath || "/client-portal"}`;
};

const buildLoanPreviewUrl = (applicationId) => {
  const { frontendUrl } = getEmailBranding();
  if (!frontendUrl || !applicationId) return "";
  return `${frontendUrl}/loan-preview?applicationId=${encodeURIComponent(applicationId)}`;
};

const asDisplayText = (value, fallback = "") => {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

module.exports = {
  stripTrailingSlash,
  getEmailBranding,
  buildBrokerSignInUrl,
  buildLenderSignInUrl,
  buildClientPortalUrl,
  buildLoanPreviewUrl,
  asDisplayText,
};
