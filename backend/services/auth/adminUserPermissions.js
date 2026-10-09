/**
 * Authoritative registry of permissions assignable to PLATFORM_ADMIN users.
 * Keys must exist in the Permission table (permission.seed.js).
 * Frontend consumes this via GET /admin/admin-user/permissions — do not duplicate lists in the UI.
 */

/** Mirrors admin-dashboard sidebar modules (AppSidebar.tsx). */
const ADMIN_PERMISSION_GROUPS = [
  {
    id: "dashboard",
    label: "Dashboard",
    order: 10,
    keys: ["VIEW_DASHBOARD"],
  },
  {
    id: "reports",
    label: "Reports & Analytics",
    order: 15,
    keys: ["VIEW_REPORTS", "EXPORT_REPORTS"],
  },
  {
    id: "loan_pipeline",
    label: "Loan Pipeline",
    order: 20,
    keys: ["VIEW_APPLICATIONS"],
  },
  {
    id: "brokers",
    label: "Broker Database",
    order: 30,
    keys: [
      "VIEW_ORGANIZATIONS",
      "CREATE_ORGANIZATION",
      "UPDATE_ORGANIZATION",
      "DELETE_ORGANIZATION",
    ],
  },
  {
    id: "lenders",
    label: "Lender Database",
    order: 40,
    keys: ["VIEW_LENDERS", "CREATE_LENDER", "UPDATE_LENDER", "DELETE_LENDER"],
  },
  {
    id: "loan_products",
    label: "Loan Products",
    order: 50,
    keys: [
      "VIEW_LOAN_PRODUCTS",
      "CREATE_LOAN_PRODUCT",
      "UPDATE_LOAN_PRODUCT",
      "DELETE_LOAN_PRODUCT",
    ],
  },
  {
    id: "documents",
    label: "Document Types",
    order: 60,
    keys: ["VIEW_DOCUMENTS", "UPLOAD_DOCUMENTS", "DELETE_DOCUMENTS"],
  },
  {
    id: "admin_users",
    label: "Admin Users",
    order: 70,
    keys: [
      "VIEW_USERS",
      "CREATE_USER",
      "UPDATE_USER",
      "DELETE_USER",
      "VIEW_ROLES",
      "MANAGE_ROLES",
      "MANAGE_PERMISSIONS",
    ],
  },
  {
    id: "contacts",
    label: "Contacts",
    order: 80,
    keys: [
      "VIEW_CONTACTS",
      "CREATE_CONTACT",
      "UPDATE_CONTACT",
      "DELETE_CONTACT",
    ],
  },
  {
    id: "subscriptions",
    label: "Subscriptions & Billing",
    order: 90,
    keys: [
      "VIEW_SUBSCRIPTIONS",
      "CREATE_SUBSCRIPTION",
      "UPDATE_SUBSCRIPTION",
      "DELETE_SUBSCRIPTION",
      "VIEW_SUBSCRIBERS",
      "MANAGE_SUBSCRIBERS",
      "VIEW_SUBSCRIPTION_INVOICES",
      "MANAGE_SUBSCRIPTION_INVOICES",
    ],
  },
  {
    id: "settings",
    label: "Settings",
    order: 110,
    keys: ["MANAGE_SETTINGS"],
  },
  {
    id: "dashboard_logs",
    label: "Dashboard Logs",
    order: 120,
    keys: ["VIEW_DASHBOARD_LOGS"],
  },
];

const ALL_ADMIN_PERMISSION_KEYS = [
  ...new Set(ADMIN_PERMISSION_GROUPS.flatMap((g) => g.keys)),
];

const ADMIN_PERMISSION_KEY_SET = new Set(ALL_ADMIN_PERMISSION_KEYS);

function isValidAdminPermissionKey(key) {
  return typeof key === "string" && ADMIN_PERMISSION_KEY_SET.has(key);
}

function filterValidAdminPermissionKeys(keys = []) {
  return [...new Set((keys || []).filter(isValidAdminPermissionKey))];
}

/**
 * Custom-access actors may only delegate permissions they themselves hold.
 * Full-access actors may delegate any registry key.
 */
function filterDelegatablePermissionKeys(requestedKeys, actorPermissionKeys, actorHasFullAccess) {
  const requested = filterValidAdminPermissionKeys(requestedKeys);
  if (actorHasFullAccess) return requested;
  const allowed = new Set(actorPermissionKeys || []);
  return requested.filter((key) => allowed.has(key));
}

async function getPlatformAdminAccessContext(prisma, userId, roleNames = []) {
  const isPlatformAdmin = roleNames.includes("PLATFORM_ADMIN");
  if (!isPlatformAdmin || !userId) {
    return {
      isPlatformAdmin: false,
      hasFullAccess: false,
      permissionKeys: [],
    };
  }

  const userPerms = await prisma.userPermission.findMany({
    where: { userId, isAllowed: true },
    include: { permission: { select: { key: true } } },
  });

  if (userPerms.length === 0) {
    return {
      isPlatformAdmin: true,
      hasFullAccess: true,
      permissionKeys: ALL_ADMIN_PERMISSION_KEYS.slice(),
    };
  }

  return {
    isPlatformAdmin: true,
    hasFullAccess: false,
    permissionKeys: userPerms
      .map((row) => row.permission?.key)
      .filter((key) => typeof key === "string"),
  };
}

async function syncUserPermissions(tx, userId, permissionKeys) {
  const {
    invalidateUserPermissionCache,
  } = require("../../utils/broker/brokerPermissionHelpers");

  await tx.userPermission.deleteMany({ where: { userId } });

  if (!permissionKeys?.length) {
    invalidateUserPermissionCache(userId);
    return;
  }

  const permissionRecords = await tx.permission.findMany({
    where: { key: { in: permissionKeys } },
  });

  if (permissionRecords.length > 0) {
    await tx.userPermission.createMany({
      data: permissionRecords.map((perm) => ({
        userId,
        permissionId: perm.id,
        isAllowed: true,
      })),
    });
  }

  invalidateUserPermissionCache(userId);
}

async function resolveUserPermissions(prisma, userId, roleNames = []) {
  const userPerms = await prisma.userPermission.findMany({
    where: { userId, isAllowed: true },
    include: { permission: true },
  });

  if (userPerms.length > 0) {
    return filterValidAdminPermissionKeys(
      userPerms.map((p) => p.permission.key),
    );
  }

  if (roleNames.includes("PLATFORM_ADMIN")) {
    return ALL_ADMIN_PERMISSION_KEYS.slice();
  }

  if (roleNames.includes("PLATFORM_SUPPORT")) {
    const role = await prisma.role.findFirst({
      where: { name: "PLATFORM_SUPPORT" },
      include: { rolePermissions: { include: { permission: true } } },
    });
    return role?.rolePermissions?.map((rp) => rp.permission.key) ?? [];
  }

  return [];
}

function formatPermissionLabel(key) {
  return String(key || "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Human-friendly short descriptions for common admin permission actions. */
const PERMISSION_ACTION_HINTS = {
  VIEW: "Can view this module",
  CREATE: "Can create new records",
  UPDATE: "Can edit existing records",
  DELETE: "Can delete records",
  MANAGE: "Full management access",
  EXPORT: "Can export data",
  SUBMIT: "Can submit applications",
  UPLOAD: "Can upload documents",
  SEND: "Can send communications",
};

function permissionActionHint(key) {
  const action = String(key || "").split("_")[0];
  return PERMISSION_ACTION_HINTS[action] || null;
}

function buildPermissionCatalog(dbPermissions = []) {
  const permMap = Object.fromEntries(dbPermissions.map((p) => [p.key, p]));

  return ADMIN_PERMISSION_GROUPS.filter((group) =>
    group.keys.some((key) => permMap[key]),
  )
    .sort((a, b) => a.order - b.order)
    .map((group) => ({
      id: group.id,
      label: group.label,
      order: group.order,
      permissions: group.keys
        .filter((key) => permMap[key])
        .map((key) => {
          const label = formatPermissionLabel(key);
          const rawDescription = (permMap[key].description || "").trim();
          const normalizedRaw = rawDescription
            .replaceAll("_", " ")
            .toLowerCase();
          const isRedundant =
            !rawDescription ||
            normalizedRaw === label.toLowerCase() ||
            normalizedRaw === key.replaceAll("_", " ").toLowerCase();

          return {
            key,
            label,
            description: isRedundant
              ? permissionActionHint(key)
              : rawDescription,
            module: group.id,
            action: key.split("_")[0] || "MANAGE",
          };
        }),
    }));
}

module.exports = {
  ADMIN_PERMISSION_GROUPS,
  ALL_ADMIN_PERMISSION_KEYS,
  ADMIN_PERMISSION_KEY_SET,
  isValidAdminPermissionKey,
  filterValidAdminPermissionKeys,
  filterDelegatablePermissionKeys,
  getPlatformAdminAccessContext,
  syncUserPermissions,
  resolveUserPermissions,
  formatPermissionLabel,
  buildPermissionCatalog,
};
