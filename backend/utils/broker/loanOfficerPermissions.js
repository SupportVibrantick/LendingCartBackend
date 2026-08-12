const LEGACY_LO_PERMISSION_MAP = {
  VIEW_PIPELINE: ["VIEW_APPLICATIONS"],
  VIEW_CLIENTS: ["VIEW_BORROWERS"],
  MANAGE_CLIENTS: ["VIEW_BORROWERS", "CREATE_BORROWERS", "EDIT_BORROWERS"],
  VIEW_LENDERS: ["VIEW_MARKETPLACE"],
  VIEW_SETTINGS: ["VIEW_COMPANY_SETTINGS"],
  MANAGE_SETTINGS: ["MANAGE_BRANDING"],
  VIEW_STATS: ["VIEW_REPORTS"],
  VIEW_NOTIFICATIONS: ["SEND_NOTIFICATIONS"],
  VIEW_LOGS: ["VIEW_REPORTS"],
  CREATE_CO_BROKER: [
    "VIEW_CO_BROKERS",
    "ACCESS_CO_BROKER_PORTAL",
    "EDIT_CO_BROKERS",
    "DISABLE_CO_BROKERS",
    "DELETE_CO_BROKERS",
  ],
  MANAGE_OWN_CO_BROKERS: [
    "VIEW_CO_BROKERS",
    "EDIT_CO_BROKERS",
    "DISABLE_CO_BROKERS",
    "DELETE_CO_BROKERS",
  ],
  ASSIGN_CO_BROKER: ["EDIT_CO_BROKERS"],
};

const ALL_LO_PERMISSION_KEYS = [
  "VIEW_APPLICATIONS",
  "VIEW_DASHBOARD_STATS",
  "VIEW_DASHBOARD_RECENT",
  "CREATE_APPLICATION",
  "EDIT_APPLICATION",
  "DELETE_APPLICATION",
  "ASSIGN_APPLICATION",
  "SUBMIT_TO_LENDERS",
  "VIEW_BORROWERS",
  "CREATE_BORROWERS",
  "EDIT_BORROWERS",
  "UPLOAD_DOCUMENTS",
  "REQUEST_DOCUMENTS",
  "DOCUMENTS_TO_SIGN",
  "VIEW_LOI_TERM_SHEET",
  "VIEW_FEE_AGREEMENT",
  "VIEW_LENDER_HUB",
  "AUTO_FORWARD_TO_LENDER",
  "AUTO_FORWARD_TO_CLIENT",
  "DELETE_DOCUMENTS",
  "GENERATE_LOI",
  "REGENERATE_LOI",
  "SEND_LOI_TO_CLIENT",
  "SEND_LOI_TO_LENDER",
  "VIEW_MARKETPLACE",
  "CONNECT_LENDERS",
  "SEND_APPLICATIONS",
  "ADD_OWN_LENDER",
  "VIEW_CO_BROKERS",
  "ACCESS_CO_BROKER_PORTAL",
  "EDIT_CO_BROKERS",
  "DISABLE_CO_BROKERS",
  "DELETE_CO_BROKERS",
  "ACCESS_BORROWER_PORTAL",
  "VIEW_CONTACTS",
  "CREATE_CONTACTS",
  "EDIT_CONTACTS",
  "DELETE_CONTACTS",
  "CHAT",
  "SEND_EMAILS",
  "SEND_NOTIFICATIONS",
  "VIEW_REPORTS",
  "EXPORT_REPORTS",
  "VIEW_COMMISSIONS",
  "VIEW_INVOICES",
  "MANAGE_BRANDING",
  "VIEW_COMPANY_SETTINGS",
  "MANAGE_CUSTOM_DOCUMENTS",
  "VIEW_CUSTOM_DOCUMENTS",
];

function normalizeLoanOfficerPermissions(keys = []) {
  const normalized = new Set();

  for (const key of keys) {
    if (!key) continue;

    if (ALL_LO_PERMISSION_KEYS.includes(key)) {
      normalized.add(key);
      continue;
    }

    const mapped = LEGACY_LO_PERMISSION_MAP[key];
    if (mapped?.length) {
      mapped.forEach((item) => normalized.add(item));
    }
  }

  if (normalized.has("MANAGE_BRANDING") && normalized.has("VIEW_COMPANY_SETTINGS")) {
    normalized.delete("VIEW_COMPANY_SETTINGS");
  }

  if (
    normalized.has("MANAGE_CUSTOM_DOCUMENTS") &&
    normalized.has("VIEW_CUSTOM_DOCUMENTS")
  ) {
    normalized.delete("VIEW_CUSTOM_DOCUMENTS");
  }

  if (
    normalized.has("GENERATE_LOI") ||
    normalized.has("REGENERATE_LOI") ||
    normalized.has("SEND_LOI_TO_CLIENT") ||
    normalized.has("SEND_LOI_TO_LENDER")
  ) {
    normalized.add("VIEW_LOI_TERM_SHEET");
  }

  return [...normalized];
}

function userHasLoPermission(userPermissions = [], required = []) {
  const granted = new Set(normalizeLoanOfficerPermissions(userPermissions));
  const requiredKeys = Array.isArray(required) ? required : [required];
  return requiredKeys.some((key) => granted.has(key));
}

module.exports = {
  LEGACY_LO_PERMISSION_MAP,
  ALL_LO_PERMISSION_KEYS,
  normalizeLoanOfficerPermissions,
  userHasLoPermission,
};
