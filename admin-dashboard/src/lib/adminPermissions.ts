export type PermissionKey = string;

export type NavItemLike = {
  name: string;
  path?: string;
  subItems?: NavItemLike[];
};

/** Route → required permission(s). null = any authenticated admin. */
export const ROUTE_PERMISSIONS: Record<string, PermissionKey | PermissionKey[] | null> = {
  "/": "VIEW_DASHBOARD",
  "/platform-reports": "VIEW_REPORTS",
  "/all-brokers-database": "VIEW_ORGANIZATIONS",
  "/all-brokers-lenders": "VIEW_ORGANIZATIONS",
  "/all-loan-products": "VIEW_LOAN_PRODUCTS",
  "/lender-assigned-products": "UPDATE_LOAN_PRODUCT",
  "/lender-all-assigned-products": "VIEW_LOAN_PRODUCTS",
  "/assigned-products": "VIEW_LOAN_PRODUCTS",
  "/view-assigned-products": "VIEW_LOAN_PRODUCTS",
  "/all-lenders-Organization": "VIEW_LENDERS",
  "/add-lender": "CREATE_LENDER",
  "/all-loan-officers": "VIEW_USERS",
  "/all-sub-brokers": "VIEW_USERS",
  "/all-clients": "VIEW_CONTACTS",
  "/loan-pipeline": "VIEW_APPLICATIONS",
  "/all-communications": "VIEW_CAMPAIGNS",
  "/all-documents": "VIEW_DOCUMENTS",
  "/all-subscriptions": "VIEW_SUBSCRIPTIONS",
  "/subscription-subscribers": "VIEW_SUBSCRIBERS",
  "/subscription-subscribers/detail": "VIEW_SUBSCRIBERS",
  "/subscription-invoices": "VIEW_SUBSCRIPTION_INVOICES",
  "/all-super-admins": "MANAGE_PERMISSIONS",
  "/all-landing-pages-leads": "VIEW_CONTACTS",
  "/email-marketing": "VIEW_CAMPAIGNS",
  "/admin-logs": "VIEW_DASHBOARD",
  "/system-settings": "MANAGE_SETTINGS",
  "/create-application": "CREATE_APPLICATION",
  "/loan-application-config": "UPDATE_APPLICATION",
  "/add-app-sections": "UPDATE_APPLICATION",
  "/application-builder": "UPDATE_APPLICATION",
  "/active-application": "VIEW_APPLICATIONS",
  "/create-template": "CREATE_APPLICATION",
  "/all-templates": "VIEW_APPLICATIONS",
  "/add-loan-product": "CREATE_LOAN_PRODUCT",
  "/add-sections": "UPDATE_APPLICATION",
  "/add-fields": "UPDATE_APPLICATION",
  "/add-user": "CREATE_USER",
  "/all-user": "VIEW_USERS",
  "/broker-portal": null,
  "/lender-portal": null,
  "/profile": null,
};

const DYNAMIC_ROUTE_RULES: { pattern: RegExp; permission: PermissionKey | PermissionKey[] | null }[] = [
  { pattern: /^\/update-lender\/.+/, permission: "UPDATE_LENDER" },
];

export function getRequiredPermission(pathname: string): PermissionKey | PermissionKey[] | null {
  if (ROUTE_PERMISSIONS[pathname] !== undefined) {
    return ROUTE_PERMISSIONS[pathname];
  }

  for (const rule of DYNAMIC_ROUTE_RULES) {
    if (rule.pattern.test(pathname)) return rule.permission;
  }

  return null;
}

export function hasPermission(
  permissions: PermissionKey[],
  required: PermissionKey | PermissionKey[] | null,
  hasFullAccess: boolean
): boolean {
  if (hasFullAccess) return true;
  if (required === null) return true;

  const requiredList = Array.isArray(required) ? required : [required];
  return requiredList.some((p) => permissions.includes(p));
}

export function canAccessPath(
  pathname: string,
  permissions: PermissionKey[],
  hasFullAccess: boolean
): boolean {
  return hasPermission(permissions, getRequiredPermission(pathname), hasFullAccess);
}

export function filterNavItems<T extends NavItemLike>(
  items: T[],
  permissions: PermissionKey[],
  hasFullAccess: boolean
): T[] {
  return items
    .map((item) => {
      if (item.subItems?.length) {
        const subItems = filterNavItems(item.subItems, permissions, hasFullAccess);
        if (subItems.length === 0) return null;
        return { ...item, subItems };
      }

      if (!item.path) return item;
      return canAccessPath(item.path, permissions, hasFullAccess) ? item : null;
    })
    .filter(Boolean) as T[];
}

export function loadAdminPermissionSession(): {
  permissions: PermissionKey[];
  hasFullAccess: boolean;
} {
  try {
    const userRaw = sessionStorage.getItem("admin_user");
    if (userRaw) {
      const user = JSON.parse(userRaw);
      return {
        permissions: Array.isArray(user.permissions) ? user.permissions : [],
        hasFullAccess: Boolean(user.hasFullAccess),
      };
    }
  } catch {
    /* ignore */
  }

  try {
    const permissions = JSON.parse(sessionStorage.getItem("admin_permissions") || "[]");
    return {
      permissions: Array.isArray(permissions) ? permissions : [],
      hasFullAccess: sessionStorage.getItem("admin_full_access") === "true",
    };
  } catch {
    return { permissions: [], hasFullAccess: true };
  }
}

export function saveAdminPermissionSession(permissions: PermissionKey[], hasFullAccess: boolean) {
  sessionStorage.setItem("admin_permissions", JSON.stringify(permissions));
  sessionStorage.setItem("admin_full_access", String(hasFullAccess));
}

export function clearAdminPermissionSession() {
  sessionStorage.removeItem("admin_permissions");
  sessionStorage.removeItem("admin_full_access");
}
