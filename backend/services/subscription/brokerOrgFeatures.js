/**
 * Broker org feature catalog — admin enables these per subscriber.
 * Loan officers / co-brokers may only receive a subset of what the org has.
 */

const { ALL_LO_PERMISSION_KEYS } = require("../../utils/broker/loanOfficerPermissions");

const LOAN_CATEGORY_FEATURES = [
  {
    key: "LOAN_CAT_RESIDENTIAL_1_4",
    label: "1-4 Units Residential",
    description: "Bridge, Fix & Flip, DSCR, Construction, Rental Portfolio",
    category: "RESIDENTIAL_1_4",
  },
  {
    key: "LOAN_CAT_CRE_MULTIFAMILY",
    label: "CRE & Multifamily",
    description: "Value-add, Bridge, Construction, Agency, CMBS, Mezz",
    category: "CRE_MULTIFAMILY",
  },
  {
    key: "LOAN_CAT_SBA_USDA",
    label: "SBA & USDA",
    description: "SBA 7(a), SBA 504, USDA B&I",
    category: "SBA_USDA",
  },
  {
    key: "LOAN_CAT_ABL",
    label: "Asset Based Lending",
    description: "Equipment, PO, AR/AP, ABL lines",
    category: "ABL",
  },
];

/** Product codes under each category (mirrors broker-dashboard CATEGORY_LOAN_TYPES). */
const LOAN_TYPES_BY_CATEGORY = {
  RESIDENTIAL_1_4: [
    "BRIDGE_LOAN_1_TO_4_UNITS",
    "FIX_AND_FLIP_LOAN_1_TO_4_UNITS",
    "DSCR_LOAN_1_TO_4_UNITS",
    "CONSTRUCTION_LOAN_1_TO_4_UNITS",
    "RENTAL_PORTFOLIO",
  ],
  CRE_MULTIFAMILY: [
    "BRIDGE_LOAN",
    "CONSTRUCTION_LOAN",
    "CRE_PERMANENT_LOAN",
    "AGENCY_LOAN_MULTIFAMILY",
    "CMBS",
    "MEZZANINE_FINANCE",
  ],
  SBA_USDA: [
    "SBA_7A_BUSINESS_ACQUISITION",
    "SBA_7A_WORKING_CAPITAL",
    "SBA_7A_EQUIPMENT_PURCHASE",
    "SBA_7A_REAL_ESTATE",
    "SBA_504_REAL_ESTATE_AND_EQUIPMENT",
    "USDA_BI",
  ],
  ABL: [
    "EQUIPMENT_FINANCE",
    "PURCHASE_ORDER_FINANCE",
    "ACCOUNTS_RECEIVABLE",
    "ACCOUNTS_RECEIVABLE_FINANCE",
    "ACCOUNTS_PAYABLE_FINANCE",
    "ASSET_BASED_LENDING",
  ],
};

function loanTypeFeatureKey(code) {
  return `LOAN_TYPE_${code}`;
}

function parseLoanTypeCode(featureKey) {
  if (!String(featureKey || "").startsWith("LOAN_TYPE_")) return null;
  return String(featureKey).slice("LOAN_TYPE_".length);
}

function parseLoanCategoryCode(featureKey) {
  const match = String(featureKey || "").match(/^LOAN_CAT_(.+)$/);
  return match ? match[1] : null;
}

function humanizeLoanProductCode(code) {
  if (!code) return "";
  return String(code)
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function loanTypeCodesForCategory(category) {
  return LOAN_TYPES_BY_CATEGORY[category] || [];
}

const LO_FEATURE_LABELS = {
  VIEW_DASHBOARD_STATS: "View Pipeline Stats",
  VIEW_DASHBOARD_RECENT: "View Recent Applications",
  VIEW_APPLICATIONS: "View Applications",
  CREATE_APPLICATION: "Create Applications",
  EDIT_APPLICATION: "Edit Applications",
  DELETE_APPLICATION: "Delete Applications",
  ASSIGN_APPLICATION: "Assign Applications",
  SUBMIT_TO_LENDERS: "Submit to Lenders",
  SHARE_APPLICATION_LINK: "Share Your Loan Application Link",
  UPLOAD_DOCUMENTS: "Upload Documents",
  REQUEST_DOCUMENTS: "Request Documents",
  DOCUMENTS_TO_SIGN: "Fill & Sign Forms",
  VIEW_LOI_TERM_SHEET: "LOI / Term Sheet tab",
  VIEW_FEE_AGREEMENT: "Fee Agreement",
  VIEW_LENDER_HUB: "Lender Matching Tool",
  AUTO_FORWARD_TO_LENDER: "Auto Forward to Lender",
  AUTO_FORWARD_TO_CLIENT: "Auto Forward to Client",
  DELETE_DOCUMENTS: "Delete Documents",
  MANAGE_CUSTOM_DOCUMENTS: "Manage Custom Documents",
  VIEW_CUSTOM_DOCUMENTS: "View Custom Documents",
  GENERATE_LOI: "Create Term Sheet",
  REGENERATE_LOI: "Edit / Regenerate Term Sheet",
  SEND_LOI_TO_CLIENT: "Send Term Sheet to Client",
  SEND_LOI_TO_LENDER: "Forward Term Sheet to Lender",
  VIEW_MARKETPLACE: "View Marketplace",
  CONNECT_LENDERS: "Connect Lenders",
  SEND_APPLICATIONS: "Send Applications",
  ADD_OWN_LENDER: "Add Your Own Lender",
  VIEW_CO_BROKERS: "View Co-Brokers",
  ACCESS_CO_BROKER_PORTAL: "Access Co-Broker Portal",
  EDIT_CO_BROKERS: "Edit Co-Brokers",
  DISABLE_CO_BROKERS: "Disable Co-Brokers",
  DELETE_CO_BROKERS: "Delete Co-Brokers",
  VIEW_LOAN_OFFICERS: "View Loan Officers",
  CREATE_LOAN_OFFICERS: "Create Loan Officers",
  EDIT_LOAN_OFFICERS: "Edit Loan Officers",
  DISABLE_LOAN_OFFICERS: "Disable Loan Officers",
  VIEW_BORROWERS: "View Borrowers",
  ACCESS_BORROWER_PORTAL: "Access Borrower Portal",
  CREATE_BORROWERS: "Create Borrowers",
  EDIT_BORROWERS: "Edit Borrowers",
  VIEW_CONTACTS: "View Contacts",
  CREATE_CONTACTS: "Create Contacts",
  EDIT_CONTACTS: "Edit Contacts",
  DELETE_CONTACTS: "Delete Contacts",
  CHAT: "Chat",
  SEND_EMAILS: "Email Reminders",
  SEND_NOTIFICATIONS: "Send Notifications",
  VIEW_COMMISSIONS: "View Commissions",
  VIEW_INVOICES: "View Invoices",
  MANAGE_BRANDING: "Manage Branding",
  VIEW_COMPANY_SETTINGS: "View Company Settings",
  ACCESS_GOHIGHLEVEL: "GoHighLevel",
  VIEW_DASHBOARD_LOGS: "Dashboard Logs",
  VIEW_REPORTS: "View Reports",
  EXPORT_REPORTS: "Export Reports",
};

const LO_FEATURE_GROUPS = [
  {
    id: "dashboard",
    title: "Dashboard",
    keys: ["VIEW_DASHBOARD_STATS", "VIEW_DASHBOARD_RECENT"],
  },
  {
    id: "applications",
    title: "Loan Applications",
    keys: [
      "VIEW_APPLICATIONS",
      "CREATE_APPLICATION",
      "EDIT_APPLICATION",
      "ASSIGN_APPLICATION",
      "SUBMIT_TO_LENDERS",
      "SHARE_APPLICATION_LINK",
    ],
  },
  {
    id: "documents",
    title: "Loan Documents",
    keys: [
      "UPLOAD_DOCUMENTS",
      "REQUEST_DOCUMENTS",
      "DOCUMENTS_TO_SIGN",
      "VIEW_LOI_TERM_SHEET",
      "VIEW_FEE_AGREEMENT",
      "VIEW_LENDER_HUB",
      "AUTO_FORWARD_TO_LENDER",
      "AUTO_FORWARD_TO_CLIENT",
    ],
  },
  {
    id: "custom_docs",
    title: "Custom Documents",
    keys: ["MANAGE_CUSTOM_DOCUMENTS", "VIEW_CUSTOM_DOCUMENTS"],
  },
  {
    id: "loi",
    title: "LOI / Term Sheet",
    keys: ["GENERATE_LOI", "REGENERATE_LOI", "SEND_LOI_TO_CLIENT", "SEND_LOI_TO_LENDER"],
  },
  {
    id: "marketplace",
    title: "Lender Marketplace",
    keys: ["VIEW_MARKETPLACE", "CONNECT_LENDERS", "SEND_APPLICATIONS", "ADD_OWN_LENDER"],
  },
  {
    id: "loan_officers",
    title: "Loan Officers",
    description: "User Management · Loan Officers",
    keys: [
      "VIEW_LOAN_OFFICERS",
      "CREATE_LOAN_OFFICERS",
      "EDIT_LOAN_OFFICERS",
      "DISABLE_LOAN_OFFICERS",
    ],
  },
  {
    id: "co_brokers",
    title: "Co Brokers",
    description: "User Management · Co Brokers",
    keys: [
      "VIEW_CO_BROKERS",
      "ACCESS_CO_BROKER_PORTAL",
      "EDIT_CO_BROKERS",
      "DISABLE_CO_BROKERS",
      "DELETE_CO_BROKERS",
    ],
  },
  {
    id: "borrowers",
    title: "Borrowers",
    description: "User Management · Borrowers",
    keys: [
      "VIEW_BORROWERS",
      "ACCESS_BORROWER_PORTAL",
      "EDIT_BORROWERS",
    ],
  },
  {
    id: "contacts",
    title: "Contacts",
    description: "User Management · Contacts",
    keys: [
      "VIEW_CONTACTS",
      "CREATE_CONTACTS",
      "EDIT_CONTACTS",
      "DELETE_CONTACTS",
    ],
  },
  {
    id: "communication",
    title: "Communication",
    keys: ["CHAT", "SEND_EMAILS", "SEND_NOTIFICATIONS"],
  },
  {
    id: "payments",
    title: "Payments",
    keys: ["VIEW_COMMISSIONS", "VIEW_INVOICES"],
  },
  {
    id: "integrations",
    title: "GoHighLevel",
    description: "CRM / GoHighLevel integration access",
    keys: ["ACCESS_GOHIGHLEVEL"],
  },
  {
    id: "dashboard_logs",
    title: "Dashboard Logs",
    description: "Admin activity and dashboard logs",
    keys: ["VIEW_DASHBOARD_LOGS"],
  },
  {
    id: "settings",
    title: "Settings & Branding",
    keys: ["MANAGE_BRANDING", "VIEW_COMPANY_SETTINGS"],
  },
];

function buildCatalog(nameByCode = {}) {
  const seenLoanTypeKeys = new Set();
  const groups = [
    {
      id: "loan_categories",
      title: "Loan Categories",
      description: "Which New Loan Application categories this broker can use",
      items: LOAN_CATEGORY_FEATURES.map(({ key, label, description }) => ({
        key,
        label,
        description,
      })),
    },
  ];

  for (const cat of LOAN_CATEGORY_FEATURES) {
    const codes = loanTypeCodesForCategory(cat.category);
    const hasDbNames = Object.keys(nameByCode).length > 0;
    const visibleCodes = hasDbNames
      ? codes.filter((code) => Boolean(nameByCode[code]))
      : codes;
    // Same product code can appear in multiple categories; feature key must stay unique.
    const uniqueCodes = visibleCodes.filter((code) => {
      const key = loanTypeFeatureKey(code);
      if (seenLoanTypeKeys.has(key)) return false;
      seenLoanTypeKeys.add(key);
      return true;
    });
    groups.push({
      id: `loan_types_${cat.category}`,
      title: `Loan Types · ${cat.label}`,
      description: `Product types under ${cat.label}`,
      items: uniqueCodes.map((code) => ({
        key: loanTypeFeatureKey(code),
        label: nameByCode[code] || humanizeLoanProductCode(code) || code,
      })),
    });
  }

  for (const group of LO_FEATURE_GROUPS) {
    groups.push({
      id: group.id,
      title: group.title,
      description: group.description || undefined,
      items: group.keys
        .filter((key) => ALL_LO_PERMISSION_KEYS.includes(key))
        .map((key) => ({
          key,
          label: LO_FEATURE_LABELS[key] || key.replaceAll("_", " "),
        })),
    });
  }

  return groups;
}

/** Sync fallback catalog (no DB names). Prefer getFeatureCatalog(prisma) for UI. */
const FEATURE_CATALOG = buildCatalog();
const ALL_FEATURE_KEYS = FEATURE_CATALOG.flatMap((g) => g.items.map((i) => i.key));
const ALL_FEATURE_KEY_SET = new Set(ALL_FEATURE_KEYS);

async function loadLoanProductNameMap(prisma) {
  if (!prisma?.loanProduct?.findMany) return {};
  try {
    const rows = await prisma.loanProduct.findMany({
      select: { code: true, name: true },
    });
    return Object.fromEntries(
      (rows || [])
        .filter((r) => r?.code)
        .map((r) => [String(r.code), String(r.name || "").trim() || humanizeLoanProductCode(r.code)]),
    );
  } catch {
    return {};
  }
}

/** Feature catalog with loan type labels from loan_products.name (admin API). */
async function getFeatureCatalog(prisma) {
  const nameByCode = await loadLoanProductNameMap(prisma);
  if (!Object.keys(nameByCode).length) return FEATURE_CATALOG;
  return buildCatalog(nameByCode);
}

function defaultFeaturesForPackage(packageCode, purchasedAddOns = []) {
  const code = String(packageCode || "BASIC").toUpperCase();
  const addOnCodes = new Set(
    (Array.isArray(purchasedAddOns) ? purchasedAddOns : [])
      .map((a) => String(a?.code || a || "").toUpperCase())
      .filter(Boolean),
  );

  const features = new Set(ALL_LO_PERMISSION_KEYS);

  features.add("LOAN_CAT_RESIDENTIAL_1_4");
  for (const code of loanTypeCodesForCategory("RESIDENTIAL_1_4")) {
    features.add(loanTypeFeatureKey(code));
  }

  const includeCre = code === "PRO" || code === "ELITE" || addOnCodes.has("CRE_PACK");
  const includeSba = code === "ELITE" || addOnCodes.has("SBA_PACK");
  const includeAbl = code === "ELITE" || addOnCodes.has("ABL_PACK");

  if (includeCre) {
    features.add("LOAN_CAT_CRE_MULTIFAMILY");
    for (const typeCode of loanTypeCodesForCategory("CRE_MULTIFAMILY")) {
      features.add(loanTypeFeatureKey(typeCode));
    }
  }
  if (includeSba) {
    features.add("LOAN_CAT_SBA_USDA");
    for (const typeCode of loanTypeCodesForCategory("SBA_USDA")) {
      features.add(loanTypeFeatureKey(typeCode));
    }
  }
  if (includeAbl) {
    features.add("LOAN_CAT_ABL");
    for (const typeCode of loanTypeCodesForCategory("ABL")) {
      features.add(loanTypeFeatureKey(typeCode));
    }
  }

  return [...features].filter((k) => ALL_FEATURE_KEY_SET.has(k));
}

function normalizeFeatureKeys(keys = []) {
  const unique = new Set();
  for (const key of keys || []) {
    const k = String(key || "").trim();
    if (ALL_FEATURE_KEY_SET.has(k)) unique.add(k);
  }
  return [...unique];
}

function resolveEnabledFeatures(subscription) {
  if (!subscription) {
    return normalizeFeatureKeys(defaultFeaturesForPackage("BASIC", []));
  }

  const raw = subscription.enabledFeatures;
  if (Array.isArray(raw)) {
    return normalizeFeatureKeys(raw);
  }
  if (raw && typeof raw === "object" && Array.isArray(raw.keys)) {
    return normalizeFeatureKeys(raw.keys);
  }

  return normalizeFeatureKeys(
    defaultFeaturesForPackage(subscription.package?.code, subscription.purchasedAddOns),
  );
}

function isCustomEnabledFeatures(raw) {
  if (Array.isArray(raw)) return true;
  if (raw && typeof raw === "object" && Array.isArray(raw.keys)) return true;
  return false;
}

function splitFeatures(featureKeys = []) {
  const keys = normalizeFeatureKeys(featureKeys);
  const permissions = [];
  const loanCategories = [];
  const loanTypes = [];

  for (const key of keys) {
    const cat = parseLoanCategoryCode(key);
    if (cat) {
      loanCategories.push(cat);
      continue;
    }
    const typeCode = parseLoanTypeCode(key);
    if (typeCode) {
      loanTypes.push(typeCode);
      continue;
    }
    if (ALL_LO_PERMISSION_KEYS.includes(key)) {
      permissions.push(key);
    }
  }

  return { permissions, loanCategories, loanTypes, all: keys };
}

function filterPermissionsToOrg(permissionKeys, orgFeatureKeys) {
  const allowed = new Set(splitFeatures(orgFeatureKeys).permissions);
  return (permissionKeys || []).filter((k) => allowed.has(k));
}

async function getOrgEnabledFeatures(prisma, organizationId) {
  const { ACTIVE_SUB_STATUSES } = require("./subscriptionBilling");
  const subscription = await prisma.organizationSubscription.findFirst({
    where: {
      organizationId,
      status: { in: ACTIVE_SUB_STATUSES },
    },
    orderBy: { createdAt: "desc" },
    include: {
      package: { select: { id: true, code: true, name: true } },
    },
  });

  const features = resolveEnabledFeatures(subscription);
  return {
    subscription,
    features,
    ...splitFeatures(features),
  };
}

module.exports = {
  FEATURE_CATALOG,
  getFeatureCatalog,
  ALL_FEATURE_KEYS,
  LOAN_CATEGORY_FEATURES,
  LOAN_TYPES_BY_CATEGORY,
  loanTypeFeatureKey,
  parseLoanTypeCode,
  parseLoanCategoryCode,
  defaultFeaturesForPackage,
  normalizeFeatureKeys,
  resolveEnabledFeatures,
  isCustomEnabledFeatures,
  splitFeatures,
  filterPermissionsToOrg,
  getOrgEnabledFeatures,
};
