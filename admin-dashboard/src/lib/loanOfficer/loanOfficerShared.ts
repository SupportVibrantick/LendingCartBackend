export type LoanOfficerPermissionItem = {
  label: string;
  key: string;
  description?: string;
  /** Visual subgroup within a category (e.g. Co-Brokers under User Management). */
  group?: string;
};

export type LoanOfficerPermissionCategory = {
  title: string;
  items: LoanOfficerPermissionItem[];
};

/** Granular LO permissions — broker assigns per checkbox, not presets. */
export const LO_PERMISSION_CATEGORIES: LoanOfficerPermissionCategory[] = [
  {
    title: "Dashboard",
    items: [
      {
        label: "View Pipeline Stats",
        key: "VIEW_DASHBOARD_STATS",
        description: "KPI stat cards on the officer dashboard",
      },
      {
        label: "View Recent Applications",
        key: "VIEW_DASHBOARD_RECENT",
        description: "Recent applications table on the dashboard",
      },
    ],
  },
  {
    title: "Loan Applications",
    items: [
      { label: "View Applications", key: "VIEW_APPLICATIONS" },
      { label: "Create Applications", key: "CREATE_APPLICATION" },
      { label: "Edit Applications", key: "EDIT_APPLICATION" },
      { label: "Delete Applications", key: "DELETE_APPLICATION" },
      { label: "Assign Applications", key: "ASSIGN_APPLICATION" },
      { label: "Submit to Lenders", key: "SUBMIT_TO_LENDERS" },
    ],
  },
  {
    title: "Loan Documents",
    items: [
      { label: "Upload Documents", key: "UPLOAD_DOCUMENTS" },
      { label: "Request Documents", key: "REQUEST_DOCUMENTS" },
      { label: "Fill & Sign Forms", key: "DOCUMENTS_TO_SIGN" },
      { label: "LOI / Term Sheet tab", key: "VIEW_LOI_TERM_SHEET" },
      { label: "Fee Agreement", key: "VIEW_FEE_AGREEMENT" },
      { label: "Lender Hub", key: "VIEW_LENDER_HUB" },
      {
        label: "Auto Forward to Lender",
        key: "AUTO_FORWARD_TO_LENDER",
        description: "Can enable auto-forward of uploads to lenders",
      },
      {
        label: "Auto Forward to Client",
        key: "AUTO_FORWARD_TO_CLIENT",
        description: "Can enable auto-forward of lender requests to the client",
      },
      { label: "Delete Documents", key: "DELETE_DOCUMENTS" },
    ],
  },
  {
    title: "Custom Documents",
    items: [
      {
        label: "Manage Custom Documents",
        key: "MANAGE_CUSTOM_DOCUMENTS",
        description: "Can create, edit, and remove custom document types",
      },
      {
        label: "View Custom Documents",
        key: "VIEW_CUSTOM_DOCUMENTS",
        description: "Can view the document library only — no changes",
      },
    ],
  },
  {
    title: "LOI / Term Sheet",
    items: [
      {
        label: "Create Term Sheet",
        key: "GENERATE_LOI",
        description:
          "Can create and generate a broker term sheet / LOI PDF for an application",
      },
      {
        label: "Edit / Regenerate Term Sheet",
        key: "REGENERATE_LOI",
        description:
          "Can edit, regenerate, or create a revised term sheet after it exists",
      },
      {
        label: "Send Term Sheet to Client",
        key: "SEND_LOI_TO_CLIENT",
        description: "Can send the broker term sheet to the client for signature",
      },
      {
        label: "Forward Term Sheet to Lender",
        key: "SEND_LOI_TO_LENDER",
        description: "Can forward the client-signed term sheet to a funding lender",
      },
    ],
  },
  {
    title: "Marketplace",
    items: [
      { label: "View Marketplace", key: "VIEW_MARKETPLACE" },
      { label: "Connect Lenders", key: "CONNECT_LENDERS" },
      { label: "Send Applications", key: "SEND_APPLICATIONS" },
      {
        label: "Add Your Own Lender",
        key: "ADD_OWN_LENDER",
        description: "Can submit and manage custom lender invitations",
      },
    ],
  },
  {
    title: "User Management",
    items: [
      { label: "View Co-Brokers", key: "VIEW_CO_BROKERS", group: "Co-Brokers" },
      {
        label: "Access Co-Broker Portal",
        key: "ACCESS_CO_BROKER_PORTAL",
        group: "Co-Brokers",
      },
      { label: "Edit Co-Brokers", key: "EDIT_CO_BROKERS", group: "Co-Brokers" },
      {
        label: "Disable Co-Brokers",
        key: "DISABLE_CO_BROKERS",
        group: "Co-Brokers",
      },
      {
        label: "Delete Co-Brokers",
        key: "DELETE_CO_BROKERS",
        group: "Co-Brokers",
      },
      {
        label: "View Borrowers",
        key: "VIEW_BORROWERS",
        group: "Borrowers",
      },
      {
        label: "Access Borrower Portal",
        key: "ACCESS_BORROWER_PORTAL",
        group: "Borrowers",
      },
      {
        label: "Create Borrowers",
        key: "CREATE_BORROWERS",
        group: "Borrowers",
      },
      {
        label: "Edit Borrowers",
        key: "EDIT_BORROWERS",
        group: "Borrowers",
      },
      { label: "View Contacts", key: "VIEW_CONTACTS", group: "Contacts" },
      { label: "Create Contacts", key: "CREATE_CONTACTS", group: "Contacts" },
      { label: "Edit Contacts", key: "EDIT_CONTACTS", group: "Contacts" },
      { label: "Delete Contacts", key: "DELETE_CONTACTS", group: "Contacts" },
    ],
  },
  {
    title: "Communication",
    items: [
      { label: "Chat", key: "CHAT" },
      { label: "Email Reminders", key: "SEND_EMAILS" },
      { label: "Send Notifications", key: "SEND_NOTIFICATIONS" },
    ],
  },
  {
    title: "Payments",
    items: [
      { label: "View Commissions", key: "VIEW_COMMISSIONS" },
      { label: "View Invoices", key: "VIEW_INVOICES" },
    ],
  },
  {
    title: "Settings",
    items: [
      {
        label: "Manage Branding",
        key: "MANAGE_BRANDING",
        description: "Can view and update company branding",
      },
      {
        label: "View Company Settings",
        key: "VIEW_COMPANY_SETTINGS",
        description: "Can view branding only — no updates",
      },
    ],
  },
];

/** @deprecated Use LO_PERMISSION_CATEGORIES */
export const PERMISSIONS = LO_PERMISSION_CATEGORIES;

/** Not shown in broker assignment UI; kept for legacy/normalization only. */
export const LO_HIDDEN_PERMISSION_KEYS = ["VIEW_REPORTS", "EXPORT_REPORTS"];

export const ALL_LO_PERMISSION_KEYS = [
  ...LO_PERMISSION_CATEGORIES.flatMap((group) => group.items.map((item) => item.key)),
  ...LO_HIDDEN_PERMISSION_KEYS,
];

/** Settings branding — only one may be active at a time. */
export const LO_SETTINGS_BRANDING_KEYS = [
  "MANAGE_BRANDING",
  "VIEW_COMPANY_SETTINGS",
] as const;

export const LO_CUSTOM_DOCUMENTS_KEYS = [
  "MANAGE_CUSTOM_DOCUMENTS",
  "VIEW_CUSTOM_DOCUMENTS",
] as const;

/** Categories rendered as mutually exclusive radio groups in the permissions UI. */
export const LO_RADIO_PERMISSION_CATEGORIES: Record<string, readonly string[]> = {
  Settings: LO_SETTINGS_BRANDING_KEYS,
  "Custom Documents": LO_CUSTOM_DOCUMENTS_KEYS,
};

export const LO_EXCLUSIVE_PERMISSION_GROUPS: string[][] = [
  [...LO_SETTINGS_BRANDING_KEYS],
  [...LO_CUSTOM_DOCUMENTS_KEYS],
];

/** Keys used when broker clicks "Select all" (settings defaults to manage). */
export const LO_PERMISSION_SELECT_ALL_KEYS = LO_PERMISSION_CATEGORIES.flatMap(
  (group) => {
    if (group.title === "Settings") return ["MANAGE_BRANDING"];
    if (group.title === "Custom Documents") return ["MANAGE_CUSTOM_DOCUMENTS"];
    return group.items.map((item) => item.key);
  },
);

export function getLoPermissionUiSlotTotal() {
  return LO_PERMISSION_CATEGORIES.reduce((total, category) => {
    if (LO_RADIO_PERMISSION_CATEGORIES[category.title]) {
      return total + 1;
    }
    return total + category.items.length;
  }, 0);
}

export function countGrantedLoPermissionUiSlots(keys: string[] = []) {
  const granted = new Set(normalizeLoanOfficerPermissions(keys));
  let count = 0;

  for (const category of LO_PERMISSION_CATEGORIES) {
    const radioKeys = LO_RADIO_PERMISSION_CATEGORIES[category.title];
    if (radioKeys) {
      if (radioKeys.some((key) => granted.has(key))) count += 1;
      continue;
    }

    count += category.items.filter((item) => granted.has(item.key)).length;
  }

  return count;
}

function applyExclusivePermissionGroups(keys: Set<string>) {
  for (const group of LO_EXCLUSIVE_PERMISSION_GROUPS) {
    const selected = group.filter((key) => keys.has(key));
    if (selected.length <= 1) continue;

    const manageKey = group.find((key) => key.startsWith("MANAGE_"));
    if (manageKey && selected.includes(manageKey)) {
      group.filter((key) => key !== manageKey).forEach((key) => keys.delete(key));
      continue;
    }

    selected.slice(1).forEach((key) => keys.delete(key));
  }
}

export function groupPermissionItemsBySubgroup(
  items: LoanOfficerPermissionItem[],
) {
  const groups: { label: string; items: LoanOfficerPermissionItem[] }[] = [];
  for (const item of items) {
    const label = item.group || "";
    const existing = groups.find((entry) => entry.label === label);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }
  }
  return groups;
}

export function getSettingsBrandingPermission(
  keys: string[] = [],
): (typeof LO_SETTINGS_BRANDING_KEYS)[number] | null {
  const normalized = normalizeLoanOfficerPermissions(keys);
  if (normalized.includes("MANAGE_BRANDING")) return "MANAGE_BRANDING";
  if (normalized.includes("VIEW_COMPANY_SETTINGS")) return "VIEW_COMPANY_SETTINGS";
  return null;
}

/** Map legacy preset keys to granular keys when loading older officers. */
export const LEGACY_LO_PERMISSION_MAP: Record<string, string[]> = {
  VIEW_PIPELINE: ["VIEW_APPLICATIONS"],
  VIEW_CLIENTS: ["VIEW_BORROWERS"],
  MANAGE_CLIENTS: ["VIEW_BORROWERS", "CREATE_BORROWERS", "EDIT_BORROWERS"],
  VIEW_LENDERS: ["VIEW_MARKETPLACE"],
  VIEW_SETTINGS: ["VIEW_COMPANY_SETTINGS"],
  MANAGE_SETTINGS: ["MANAGE_BRANDING"],
  VIEW_STATS: ["VIEW_REPORTS"],
  VIEW_NOTIFICATIONS: ["SEND_NOTIFICATIONS"],
  VIEW_LOGS: ["VIEW_REPORTS"],
  VIEW_TEMPLATES: ["VIEW_CUSTOM_DOCUMENTS"],
  MANAGE_TEMPLATES: ["MANAGE_CUSTOM_DOCUMENTS"],
  VIEW_WEBSITE_BUILDER: [],
  MANAGE_LOAN_OFFICERS: [],
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

export function normalizeLoanOfficerPermissions(keys: string[] = []): string[] {
  const normalized = new Set<string>();

  for (const key of keys) {
    if (ALL_LO_PERMISSION_KEYS.includes(key)) {
      normalized.add(key);
      continue;
    }

    const mapped = LEGACY_LO_PERMISSION_MAP[key];
    if (mapped?.length) {
      mapped.forEach((item) => normalized.add(item));
    }
  }

  applyExclusivePermissionGroups(normalized);

  // Term sheet actions require being able to open the LOI / Term Sheet tab.
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

export function getPermissionLabel(key: string) {
  for (const group of LO_PERMISSION_CATEGORIES) {
    const found = group.items.find((item) => item.key === key);
    if (found) return found.label;
  }

  return key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function groupPermissionsByCategory(keys: string[] = []) {
  const normalized = normalizeLoanOfficerPermissions(keys);
  const granted = new Set(normalized);

  return LO_PERMISSION_CATEGORIES.map((category) => ({
    ...category,
    items: category.items.filter((item) => granted.has(item.key)),
  })).filter((category) => category.items.length > 0);
}

export const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

export function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);

  if (digits.length < 4) return digits;
  if (digits.length < 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;

  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}
