import {
  normalizeLoanOfficerPermissions,
} from "../pages/UserManagement/loanOfficerShared";

export type PermissionKey =
  | "VIEW_APPLICATIONS"
  | "VIEW_DASHBOARD_STATS"
  | "VIEW_DASHBOARD_RECENT"
  | "CREATE_APPLICATION"
  | "EDIT_APPLICATION"
  | "DELETE_APPLICATION"
  | "ASSIGN_APPLICATION"
  | "SUBMIT_TO_LENDERS"
  | "SHARE_APPLICATION_LINK"
  | "VIEW_BORROWERS"
  | "CREATE_BORROWERS"
  | "EDIT_BORROWERS"
  | "UPLOAD_DOCUMENTS"
  | "REQUEST_DOCUMENTS"
  | "DOCUMENTS_TO_SIGN"
  | "VIEW_LOI_TERM_SHEET"
  | "VIEW_FEE_AGREEMENT"
  | "VIEW_LENDER_HUB"
  | "AUTO_FORWARD_TO_LENDER"
  | "AUTO_FORWARD_TO_CLIENT"
  | "DELETE_DOCUMENTS"
  | "GENERATE_LOI"
  | "REGENERATE_LOI"
  | "SEND_LOI_TO_CLIENT"
  | "SEND_LOI_TO_LENDER"
  | "VIEW_MARKETPLACE"
  | "CONNECT_LENDERS"
  | "SEND_APPLICATIONS"
  | "ADD_OWN_LENDER"
  | "VIEW_CO_BROKERS"
  | "ACCESS_CO_BROKER_PORTAL"
  | "EDIT_CO_BROKERS"
  | "DISABLE_CO_BROKERS"
  | "DELETE_CO_BROKERS"
  | "ACCESS_BORROWER_PORTAL"
  | "VIEW_CONTACTS"
  | "CREATE_CONTACTS"
  | "EDIT_CONTACTS"
  | "DELETE_CONTACTS"
  | "CREATE_CO_BROKER"
  | "MANAGE_OWN_CO_BROKERS"
  | "ASSIGN_CO_BROKER"
  | "CHAT"
  | "SEND_EMAILS"
  | "SEND_NOTIFICATIONS"
  | "VIEW_REPORTS"
  | "EXPORT_REPORTS"
  | "VIEW_COMMISSIONS"
  | "VIEW_INVOICES"
  | "MANAGE_BRANDING"
  | "VIEW_COMPANY_SETTINGS"
  | "MANAGE_CUSTOM_DOCUMENTS"
  | "VIEW_CUSTOM_DOCUMENTS"
  | "ACCESS_GOHIGHLEVEL"
  | "VIEW_DASHBOARD_LOGS"
  | "VIEW_LOAN_OFFICERS"
  | "CREATE_LOAN_OFFICERS"
  | "EDIT_LOAN_OFFICERS"
  | "DISABLE_LOAN_OFFICERS"
  | "VIEW_PIPELINE"
  | "VIEW_LENDERS"
  | "VIEW_TEMPLATES"
  | "MANAGE_SETTINGS"
  | "VIEW_SETTINGS";

export type PermissionPortal = "broker" | "loanOfficer" | "coBroker";

const ADMIN_ROLES = new Set(["BROKER_ADMIN", "PLATFORM_ADMIN"]);
const PLATFORM_ADMIN_ROLES = new Set(["PLATFORM_ADMIN"]);

/** Legacy sidebar keys → org entitlement keys */
const PERMISSION_ALIASES: Record<string, string[]> = {
  VIEW_PIPELINE: ["VIEW_APPLICATIONS"],
  VIEW_LENDERS: ["VIEW_MARKETPLACE"],
  VIEW_TEMPLATES: ["MANAGE_CUSTOM_DOCUMENTS", "VIEW_CUSTOM_DOCUMENTS"],
  MANAGE_SETTINGS: ["MANAGE_BRANDING"],
  VIEW_SETTINGS: ["VIEW_COMPANY_SETTINGS", "MANAGE_BRANDING"],
  CREATE_CO_BROKER: [
    "VIEW_CO_BROKERS",
    "ACCESS_CO_BROKER_PORTAL",
    "EDIT_CO_BROKERS",
  ],
  MANAGE_OWN_CO_BROKERS: ["VIEW_CO_BROKERS", "EDIT_CO_BROKERS"],
  ASSIGN_CO_BROKER: ["EDIT_CO_BROKERS"],
};

function expandPermissionKey(permission: string): string[] {
  return PERMISSION_ALIASES[permission] || [permission];
}

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function getSessionRoles(_portal: PermissionPortal = "broker"): string[] {
  if (typeof window === "undefined") return [];
  return parseJsonArray(sessionStorage.getItem("roles"));
}

export function getSessionPermissions(
  portal: PermissionPortal = "loanOfficer",
): string[] {
  if (typeof window === "undefined") return [];
  const raw = parseJsonArray(sessionStorage.getItem("permissions"));

  if (portal === "loanOfficer") {
    return normalizeLoanOfficerPermissions(raw);
  }

  return raw;
}

export const LO_PERMISSIONS_UPDATED_EVENT = "lo-permissions-updated";
export const ORG_ENTITLEMENTS_UPDATED_EVENT = "org-entitlements-updated";

export function setSessionPermissions(permissions: string[]) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    "permissions",
    JSON.stringify(normalizeLoanOfficerPermissions(permissions)),
  );
  window.dispatchEvent(new Event(LO_PERMISSIONS_UPDATED_EVENT));
}

/** Cached org permissions (same set assignable to LOs / co-brokers). */
let orgEntitlementPermissions: string[] | null = null;

export function setOrgEntitlementPermissions(permissions: string[] | null) {
  orgEntitlementPermissions = Array.isArray(permissions) ? permissions : null;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ORG_ENTITLEMENTS_UPDATED_EVENT));
  }
}

export function getOrgEntitlementPermissions(): string[] | null {
  return orgEntitlementPermissions;
}

export function applyBrokerEntitlements(data: {
  permissions?: string[] | null;
} | null) {
  setOrgEntitlementPermissions(data?.permissions ?? null);
}

export function isBrokerAdmin(portal: PermissionPortal = "broker"): boolean {
  const roles = getSessionRoles(portal);
  return roles.some((role) => ADMIN_ROLES.has(role));
}

export function isPlatformAdmin(portal: PermissionPortal = "broker"): boolean {
  const roles = getSessionRoles(portal);
  return roles.some((role) => PLATFORM_ADMIN_ROLES.has(role));
}

function permissionGrantedInSet(
  permission: PermissionKey | string,
  granted: Set<string>,
): boolean {
  return expandPermissionKey(String(permission)).some((key) => granted.has(key));
}

/**
 * Broker admin is limited to the org package entitlement set (same pool LOs get).
 * Platform admin bypasses. LO must have the permission assigned AND the org plan
 * must include it (so Starter LOs / admin impersonation cannot unlock Pro features).
 * Co-brokers have no per-user permission matrix — they are gated by org plan only.
 */
export function hasPermission(
  permission: PermissionKey | string,
  portal: PermissionPortal = "loanOfficer",
): boolean {
  if (isPlatformAdmin(portal)) return true;

  if (portal === "broker" && isBrokerAdmin(portal)) {
    const orgPerms = getOrgEntitlementPermissions();
    // Until entitlements load, allow core nav so the shell does not flash empty.
    if (orgPerms == null) return true;
    return permissionGrantedInSet(permission, new Set(orgPerms));
  }

  if (portal === "coBroker") {
    const orgPerms = getOrgEntitlementPermissions();
    if (orgPerms == null) return true;
    return permissionGrantedInSet(permission, new Set(orgPerms));
  }

  const sessionOk = permissionGrantedInSet(
    permission,
    new Set(getSessionPermissions(portal)),
  );
  if (!sessionOk) return false;

  if (portal === "loanOfficer") {
    const orgPerms = getOrgEntitlementPermissions();
    // Until org entitlements hydrate, keep assigned LO permissions.
    if (orgPerms == null) return true;
    return permissionGrantedInSet(permission, new Set(orgPerms));
  }

  return true;
}

export function hasAnyPermission(
  permissions: Array<PermissionKey | string>,
  portal: PermissionPortal = "loanOfficer",
): boolean {
  return permissions.some((permission) => hasPermission(permission, portal));
}

export function hasAllPermissions(
  permissions: Array<PermissionKey | string>,
  portal: PermissionPortal = "loanOfficer",
): boolean {
  return permissions.every((permission) => hasPermission(permission, portal));
}

export const LO_BRANDING_ACCESS_PERMISSIONS: PermissionKey[] = [
  "MANAGE_BRANDING",
];

export const LO_CUSTOM_DOCUMENTS_ACCESS_PERMISSIONS: PermissionKey[] = [
  "MANAGE_CUSTOM_DOCUMENTS",
  "VIEW_CUSTOM_DOCUMENTS",
];

export type LoanOfficerNavItem = {
  name: string;
  path?: string;
  subItems?: LoanOfficerNavItem[];
  permission?: PermissionKey | PermissionKey[];
  always?: boolean;
};

export const LOAN_OFFICER_NAV_ITEMS: LoanOfficerNavItem[] = [
  { name: "Dashboard", path: "/loan-officer/dashboard", always: true },
  {
    name: "Loan Pipeline",
    path: "/loan-officer/loan-pipeline",
    permission: "VIEW_APPLICATIONS",
  },
  {
    name: "New Loan Application",
    path: "/loan-officer/loan-application",
    permission: "CREATE_APPLICATION",
  },
  {
    name: "GoHighLevel",
    path: "/loan-officer/settings/integrations/ghl",
    permission: "ACCESS_GOHIGHLEVEL",
  },
  {
    name: "User Management",
    subItems: [
      {
        name: "Co-Brokers",
        path: "/loan-officer/co-brokers",
        permission: "VIEW_CO_BROKERS",
      },
      {
        name: "Borrowers",
        path: "/loan-officer/borrowers",
        permission: "VIEW_BORROWERS",
      },
      {
        name: "Contacts",
        path: "/loan-officer/contacts",
        permission: "VIEW_CONTACTS",
      },
    ],
  },
  {
    name: "Lender Marketplace",
    path: "/loan-officer/lender-marketplace",
    permission: "VIEW_MARKETPLACE",
  },
  {
    name: "Documents",
    subItems: [
      {
        name: "Custom Documents",
        path: "/loan-officer/documents/custom",
        permission: LO_CUSTOM_DOCUMENTS_ACCESS_PERMISSIONS,
      },
    ],
  },
  {
    name: "Messages",
    path: "/loan-officer/messages",
    permission: "CHAT",
  },
  {
    name: "Email Marketing",
    path: "/loan-officer/email-marketing",
    permission: "SEND_EMAILS",
  },
  {
    name: "Payments",
    subItems: [
      {
        name: "Commissions",
        path: "/loan-officer/commissions",
        permission: "VIEW_COMMISSIONS",
      },
      {
        name: "Invoices",
        path: "/loan-officer/invoices",
        permission: "VIEW_INVOICES",
      },
    ],
  },
  {
    name: "Settings",
    subItems: [
      {
        name: "Branding",
        path: "/loan-officer/settings/branding",
        permission: LO_BRANDING_ACCESS_PERMISSIONS,
      },
    ],
  },
  {
    name: "Dashboard Logs",
    path: "/loan-officer/admin-logs",
    permission: "VIEW_DASHBOARD_LOGS",
  },
  { name: "Profile", path: "/loan-officer/profile", always: true },
];

export function filterLoanOfficerNavItems(
  items: LoanOfficerNavItem[],
  portal: PermissionPortal = "loanOfficer",
): LoanOfficerNavItem[] {
  return items
    .map((item) => {
      if (item.subItems?.length) {
        const subItems = filterLoanOfficerNavItems(item.subItems, portal);
        if (!subItems.length) return null;
        return { ...item, subItems };
      }

      if (item.always) return item;

      if (item.permission) {
        const required = Array.isArray(item.permission)
          ? item.permission
          : [item.permission];
        if (!hasAnyPermission(required, portal)) return null;
      }

      return item;
    })
    .filter((item): item is LoanOfficerNavItem => item !== null);
}

/** @deprecated use LOAN_OFFICER_NAV_ITEMS */
export const LOAN_OFFICER_WORKSPACE_NAV = LOAN_OFFICER_NAV_ITEMS;

export function getFirstAllowedLoanOfficerPath(
  portal: PermissionPortal = "loanOfficer",
): string {
  const visible = filterLoanOfficerNavItems(LOAN_OFFICER_NAV_ITEMS, portal);
  const firstPath =
    visible.find((item) => item.path)?.path ||
    visible.find((item) => item.subItems?.[0]?.path)?.subItems?.[0]?.path;
  return firstPath || "/loan-officer/profile";
}

/** Co-broker sidebar / route permission map (org package only). */
export const CO_BROKER_NAV_ITEMS: LoanOfficerNavItem[] = [
  { name: "Dashboard", path: "/sub-broker/dashboard", always: true },
  {
    name: "Loan Pipeline",
    path: "/sub-broker/loan-pipeline",
    permission: "VIEW_APPLICATIONS",
  },
  {
    name: "New Loan Application",
    path: "/sub-broker/loan-application",
    permission: "CREATE_APPLICATION",
  },
  {
    name: "Payments",
    subItems: [
      {
        name: "Commissions",
        path: "/sub-broker/commissions",
        permission: "VIEW_COMMISSIONS",
      },
      {
        name: "Invoices",
        path: "/sub-broker/invoices",
        permission: "VIEW_INVOICES",
      },
    ],
  },
  {
    name: "User Management",
    subItems: [
      {
        name: "Borrowers",
        path: "/sub-broker/borrowers",
        permission: "VIEW_BORROWERS",
      },
      {
        name: "Contacts",
        path: "/sub-broker/contacts",
        permission: "VIEW_CONTACTS",
      },
    ],
  },
  { name: "Profile", path: "/sub-broker/profile", always: true },
];

export function getFirstAllowedCoBrokerPath(
  portal: PermissionPortal = "coBroker",
): string {
  const visible = filterLoanOfficerNavItems(CO_BROKER_NAV_ITEMS, portal);
  const firstPath =
    visible.find((item) => item.path)?.path ||
    visible.find((item) => item.subItems?.[0]?.path)?.subItems?.[0]?.path;
  return firstPath || "/sub-broker/profile";
}

export const LO_ROUTE_PERMISSIONS: Record<
  string,
  PermissionKey | PermissionKey[] | "always"
> = {
  dashboard: "always",
  "loan-pipeline": "VIEW_APPLICATIONS",
  "loan-pipeline-preview": "VIEW_APPLICATIONS",
  "loan-application": "CREATE_APPLICATION",
  contacts: "VIEW_CONTACTS",
  "co-brokers": "VIEW_CO_BROKERS",
  borrowers: "VIEW_BORROWERS",
  "lender-marketplace": "VIEW_MARKETPLACE",
  "documents/custom": LO_CUSTOM_DOCUMENTS_ACCESS_PERMISSIONS,
  "email-marketing": "SEND_EMAILS",
  messages: "CHAT",
  "settings/branding": LO_BRANDING_ACCESS_PERMISSIONS,
  "settings/integrations/ghl": "ACCESS_GOHIGHLEVEL",
  "admin-logs": "VIEW_DASHBOARD_LOGS",
  commissions: "VIEW_COMMISSIONS",
  invoices: "VIEW_INVOICES",
  profile: "always",
};
