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

/**
 * Residential Bridge/Construction are stored as canonical CRE codes
 * (BRIDGE_LOAN / CONSTRUCTION_LOAN) after submit canonicalization, but Starter
 * entitlements grant the *_1_TO_4_UNITS variants. Map both directions.
 */
const RESIDENTIAL_PRODUCT_CANONICAL = {
  BRIDGE_LOAN_1_TO_4_UNITS: "BRIDGE_LOAN",
  CONSTRUCTION_LOAN_1_TO_4_UNITS: "CONSTRUCTION_LOAN",
};

const CANONICAL_TO_RESIDENTIAL_PRODUCT = {
  BRIDGE_LOAN: "BRIDGE_LOAN_1_TO_4_UNITS",
  CONSTRUCTION_LOAN: "CONSTRUCTION_LOAN_1_TO_4_UNITS",
};

function loanTypeEntitlementCandidates(loanCategory, loanType) {
  const type = String(loanType || "").trim().toUpperCase();
  if (!type) return [];

  const cat = String(loanCategory || "")
    .trim()
    .toUpperCase()
    .replace(/^LOAN_CAT_/, "");

  const candidates = new Set([type]);

  if (cat === "RESIDENTIAL_1_4" && CANONICAL_TO_RESIDENTIAL_PRODUCT[type]) {
    candidates.add(CANONICAL_TO_RESIDENTIAL_PRODUCT[type]);
  }
  if (RESIDENTIAL_PRODUCT_CANONICAL[type]) {
    candidates.add(RESIDENTIAL_PRODUCT_CANONICAL[type]);
  }

  return [...candidates];
}

function normalizeLoanCategoryCode(loanCategory) {
  const cat = String(loanCategory || "")
    .trim()
    .toUpperCase()
    .replace(/^LOAN_CAT_/, "");
  return LOAN_TYPES_BY_CATEGORY[cat] ? cat : null;
}

/**
 * Prefer explicit category from the client. Only infer from product code when
 * the code uniquely belongs to one category (never invent CRE from a
 * canonicalized residential Bridge/Construction code).
 */
function resolveLoanCategoryForAccess({ loanCategory, loanType } = {}) {
  const explicit = normalizeLoanCategoryCode(loanCategory);
  if (explicit) return explicit;

  const type = String(loanType || "").trim().toUpperCase();
  if (!type) return null;

  // Canonical Bridge/Construction are shared with CRE after submit
  // canonicalization — never infer CRE without an explicit category.
  if (CANONICAL_TO_RESIDENTIAL_PRODUCT[type]) {
    return null;
  }

  const exactMatches = [];
  for (const [cat, codes] of Object.entries(LOAN_TYPES_BY_CATEGORY)) {
    if (codes.includes(type)) exactMatches.push(cat);
  }
  if (exactMatches.length === 1) return exactMatches[0];

  return null;
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

/** Core LO/admin capabilities every paid plan gets (Starter floor). */
const CORE_PACKAGE_PERMISSIONS = [
  "VIEW_DASHBOARD_STATS",
  "VIEW_DASHBOARD_RECENT",
  "VIEW_APPLICATIONS",
  "CREATE_APPLICATION",
  "EDIT_APPLICATION",
  "DELETE_APPLICATION",
  "ASSIGN_APPLICATION",
  "SUBMIT_TO_LENDERS",
  "SHARE_APPLICATION_LINK",
  "VIEW_BORROWERS",
  "CREATE_BORROWERS",
  "EDIT_BORROWERS",
  "ACCESS_BORROWER_PORTAL",
  "UPLOAD_DOCUMENTS",
  "REQUEST_DOCUMENTS",
  "DOCUMENTS_TO_SIGN",
  "VIEW_LENDER_HUB",
  "DELETE_DOCUMENTS",
  "MANAGE_CUSTOM_DOCUMENTS",
  "VIEW_CUSTOM_DOCUMENTS",
  "VIEW_CONTACTS",
  "CREATE_CONTACTS",
  "EDIT_CONTACTS",
  "DELETE_CONTACTS",
  "VIEW_REPORTS",
  "EXPORT_REPORTS",
  "VIEW_COMPANY_SETTINGS",
  // Seat-based team: any plan that can buy EXTRA_USER may create LOs
  "VIEW_LOAN_OFFICERS",
  "CREATE_LOAN_OFFICERS",
  "EDIT_LOAN_OFFICERS",
  "DISABLE_LOAN_OFFICERS",
];

/** Pro+ (or matching add-ons): LO/co-broker portals, fee/term sheet, GHL starter. */
const PRO_PACKAGE_PERMISSIONS = [
  "VIEW_CO_BROKERS",
  "ACCESS_CO_BROKER_PORTAL",
  "EDIT_CO_BROKERS",
  "DISABLE_CO_BROKERS",
  "DELETE_CO_BROKERS",
  "VIEW_FEE_AGREEMENT",
  "VIEW_LOI_TERM_SHEET",
  "GENERATE_LOI",
  "REGENERATE_LOI",
  "SEND_LOI_TO_CLIENT",
  "SEND_LOI_TO_LENDER",
  "VIEW_COMMISSIONS",
  "VIEW_INVOICES",
  "ACCESS_GOHIGHLEVEL",
  // Internal chat + email reminders (Starter excluded)
  "CHAT",
  "SEND_EMAILS",
  "SEND_NOTIFICATIONS",
];

/** Elite+: marketplace, white-label, logs, auto-forward docs. */
const ELITE_PACKAGE_PERMISSIONS = [
  "VIEW_MARKETPLACE",
  "CONNECT_LENDERS",
  "SEND_APPLICATIONS",
  "ADD_OWN_LENDER",
  "MANAGE_BRANDING",
  "VIEW_DASHBOARD_LOGS",
  "AUTO_FORWARD_TO_LENDER",
  "AUTO_FORWARD_TO_CLIENT",
];

const FEE_AGREEMENT_PERMISSIONS = [
  "VIEW_FEE_AGREEMENT",
  "VIEW_LOI_TERM_SHEET",
  "GENERATE_LOI",
  "REGENERATE_LOI",
  "SEND_LOI_TO_CLIENT",
  "SEND_LOI_TO_LENDER",
];

const MARKETPLACE_PERMISSIONS = [
  "VIEW_MARKETPLACE",
  "CONNECT_LENDERS",
  "SEND_APPLICATIONS",
  "ADD_OWN_LENDER",
];

function addPermissionGroup(target, keys) {
  for (const key of keys) {
    if (ALL_LO_PERMISSION_KEYS.includes(key)) target.add(key);
  }
}

function defaultFeaturesForPackage(packageCode, purchasedAddOns = []) {
  const code = String(packageCode || "BASIC").toUpperCase();
  const addOnCodes = new Set(
    (Array.isArray(purchasedAddOns) ? purchasedAddOns : [])
      .map((a) => String(a?.code || a || "").toUpperCase())
      .filter(Boolean),
  );

  const features = new Set();
  addPermissionGroup(features, CORE_PACKAGE_PERMISSIONS);

  const isProOrHigher = code === "PRO" || code === "ELITE";
  const isElite = code === "ELITE";

  if (isProOrHigher) {
    addPermissionGroup(features, PRO_PACKAGE_PERMISSIONS);
  }
  if (isElite) {
    addPermissionGroup(features, ELITE_PACKAGE_PERMISSIONS);
  }

  // Add-on unlocks (lower tiers)
  if (addOnCodes.has("FEE_AGREEMENT_PACK")) {
    addPermissionGroup(features, FEE_AGREEMENT_PERMISSIONS);
  }
  if (
    addOnCodes.has("LENDER_MARKETPLACE_PACK") ||
    addOnCodes.has("LENDER_MARKETPLACE")
  ) {
    addPermissionGroup(features, MARKETPLACE_PERMISSIONS);
  }
  if (addOnCodes.has("WHITE_LABEL")) {
    features.add("MANAGE_BRANDING");
  }
  if (
    addOnCodes.has("GHL_STARTER") ||
    addOnCodes.has("GHL_BASIC_SYNC") ||
    addOnCodes.has("GHL_GROWTH")
  ) {
    features.add("ACCESS_GOHIGHLEVEL");
  }

  // Loan categories / types
  features.add("LOAN_CAT_RESIDENTIAL_1_4");
  for (const typeCode of loanTypeCodesForCategory("RESIDENTIAL_1_4")) {
    features.add(loanTypeFeatureKey(typeCode));
  }

  const includeCre =
    isProOrHigher || addOnCodes.has("CRE_PACK");
  const includeSba =
    isElite ||
    addOnCodes.has("SBA_PACK") ||
    addOnCodes.has("BUSINESS_LENDING_PACK");
  const includeAbl =
    isElite ||
    addOnCodes.has("ABL_PACK") ||
    addOnCodes.has("BUSINESS_LENDING_PACK");

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

/**
 * Map a UI/legacy permission key to org entitlement permission keys.
 */
function expandPermissionAliases(permissionKey) {
  const key = String(permissionKey || "").trim();
  if (!key) return [];
  const aliases = {
    VIEW_PIPELINE: ["VIEW_APPLICATIONS"],
    VIEW_LENDERS: ["VIEW_MARKETPLACE"],
    VIEW_TEMPLATES: ["MANAGE_CUSTOM_DOCUMENTS", "VIEW_CUSTOM_DOCUMENTS"],
    MANAGE_SETTINGS: ["MANAGE_BRANDING"],
    VIEW_SETTINGS: ["VIEW_COMPANY_SETTINGS", "MANAGE_BRANDING"],
  };
  if (aliases[key]) return aliases[key];
  return [key];
}

function orgAllowsPermission(orgPermissionKeys, permissionKey) {
  const allowed = new Set(orgPermissionKeys || []);
  return expandPermissionAliases(permissionKey).some((k) => allowed.has(k));
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
  const packageDefaults = defaultFeaturesForPackage(
    subscription?.package?.code || "BASIC",
    subscription?.purchasedAddOns || [],
  );

  if (!subscription) {
    return normalizeFeatureKeys(packageDefaults);
  }

  const raw = subscription.enabledFeatures;
  let customKeys = null;
  if (Array.isArray(raw) && raw.length > 0) {
    customKeys = raw;
  } else if (
    raw &&
    typeof raw === "object" &&
    Array.isArray(raw.keys) &&
    raw.keys.length > 0
  ) {
    customKeys = raw.keys;
  }

  // No custom snapshot → full package matrix (Starter / Pro / Elite + add-ons).
  if (!customKeys) {
    return normalizeFeatureKeys(packageDefaults);
  }

  const custom = normalizeFeatureKeys(customKeys);
  // Loan category/type matrix always tracks the current package (+ add-ons),
  // so Elite upgrades are not stuck on a Starter-only snapshot. Permission
  // keys may still be customized by admin.
  const packageLoan = packageDefaults.filter(
    (k) =>
      String(k).startsWith("LOAN_CAT_") || String(k).startsWith("LOAN_TYPE_"),
  );
  const customPermissions = custom.filter(
    (k) =>
      !String(k).startsWith("LOAN_CAT_") && !String(k).startsWith("LOAN_TYPE_"),
  );

  return normalizeFeatureKeys([...customPermissions, ...packageLoan]);
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

/**
 * Validate loan category / product type against org entitlements.
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
function assertLoanAccessAllowed(orgFeatures, { loanCategory, loanType } = {}) {
  const { loanCategories, loanTypes } = splitFeatures(orgFeatures || []);
  const catSet = new Set(loanCategories);
  const typeSet = new Set(loanTypes);

  const resolvedCategory = resolveLoanCategoryForAccess({
    loanCategory,
    loanType,
  });

  if (resolvedCategory) {
    if (!catSet.has(resolvedCategory) && !catSet.has(`LOAN_CAT_${resolvedCategory}`)) {
      return {
        ok: false,
        message: `Your plan does not include the "${resolvedCategory}" loan category`,
      };
    }
  }

  if (loanType) {
    const candidates = loanTypeEntitlementCandidates(
      resolvedCategory || loanCategory,
      loanType,
    );
    if (
      typeSet.size > 0 &&
      !candidates.some((candidate) => typeSet.has(candidate))
    ) {
      return {
        ok: false,
        message: `Your plan does not include the "${String(loanType).toUpperCase()}" loan type`,
      };
    }
  }

  return { ok: true };
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

async function orgHasChatFeature(prisma, organizationId) {
  if (!organizationId) return false;
  const { features } = await getOrgEnabledFeatures(prisma, organizationId);
  return (features || []).includes("CHAT");
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
  resolveLoanCategoryForAccess,
  loanTypeEntitlementCandidates,
  defaultFeaturesForPackage,
  normalizeFeatureKeys,
  resolveEnabledFeatures,
  isCustomEnabledFeatures,
  splitFeatures,
  filterPermissionsToOrg,
  getOrgEnabledFeatures,
  orgHasChatFeature,
  expandPermissionAliases,
  orgAllowsPermission,
  assertLoanAccessAllowed,
};
