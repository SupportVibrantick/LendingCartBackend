const ADMIN_PERMISSION_GROUPS = [
  {
    label: "Dashboard & Reports",
    keys: ["VIEW_DASHBOARD", "VIEW_REPORTS"],
  },
  {
    label: "User Management",
    keys: [
      "VIEW_USERS",
      "CREATE_USER",
      "UPDATE_USER",
      "DELETE_USER",
      "MANAGE_ROLES",
      "MANAGE_PERMISSIONS",
    ],
  },
  {
    label: "Organizations",
    keys: [
      "VIEW_ORGANIZATIONS",
      "CREATE_ORGANIZATION",
      "UPDATE_ORGANIZATION",
      "DELETE_ORGANIZATION",
    ],
  },
  {
    label: "Applications",
    keys: [
      "VIEW_APPLICATIONS",
      "CREATE_APPLICATION",
      "UPDATE_APPLICATION",
      "DELETE_APPLICATION",
      "SUBMIT_APPLICATION",
    ],
  },
  {
    label: "Lenders",
    keys: ["VIEW_LENDERS", "CREATE_LENDER", "UPDATE_LENDER", "DELETE_LENDER"],
  },
  {
    label: "Loan Products",
    keys: [
      "VIEW_LOAN_PRODUCTS",
      "CREATE_LOAN_PRODUCT",
      "UPDATE_LOAN_PRODUCT",
      "DELETE_LOAN_PRODUCT",
    ],
  },
  {
    label: "Documents",
    keys: ["VIEW_DOCUMENTS", "UPLOAD_DOCUMENTS", "DELETE_DOCUMENTS"],
  },
  {
    label: "Communications",
    keys: [
      "VIEW_CAMPAIGNS",
      "CREATE_CAMPAIGN",
      "UPDATE_CAMPAIGN",
      "DELETE_CAMPAIGN",
      "SEND_CAMPAIGN",
    ],
  },
  {
    label: "Contacts",
    keys: [
      "VIEW_CONTACTS",
      "CREATE_CONTACT",
      "UPDATE_CONTACT",
      "DELETE_CONTACT",
    ],
  },
  {
    label: "Settings",
    keys: ["MANAGE_SETTINGS"],
  },
];

const ALL_ADMIN_PERMISSION_KEYS = [
  ...new Set(ADMIN_PERMISSION_GROUPS.flatMap((g) => g.keys)),
];

async function syncUserPermissions(tx, userId, permissionKeys) {
  await tx.userPermission.deleteMany({ where: { userId } });

  if (!permissionKeys?.length) return;

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
}

async function resolveUserPermissions(prisma, userId, roleNames = []) {
  const userPerms = await prisma.userPermission.findMany({
    where: { userId, isAllowed: true },
    include: { permission: true },
  });

  if (userPerms.length > 0) {
    return userPerms.map((p) => p.permission.key);
  }

  if (roleNames.includes("PLATFORM_ADMIN")) {
    const all = await prisma.permission.findMany({ select: { key: true } });
    return all.map((p) => p.key);
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
  return key.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

module.exports = {
  ADMIN_PERMISSION_GROUPS,
  ALL_ADMIN_PERMISSION_KEYS,
  syncUserPermissions,
  resolveUserPermissions,
  formatPermissionLabel,
};
