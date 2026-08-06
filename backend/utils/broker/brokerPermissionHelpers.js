const ADMIN_BYPASS_ROLES = new Set(["BROKER_ADMIN", "PLATFORM_ADMIN"]);

async function loadUserPermissionKeys(prisma, userId) {
  if (!userId) return [];

  const rows = await prisma.userPermission.findMany({
    where: { userId },
    include: {
      permission: {
        select: { key: true },
      },
    },
  });

  return rows
    .map((row) => row.permission?.key)
    .filter((key) => typeof key === "string" && key.length > 0);
}

function rolesIncludeAdmin(roles = []) {
  const normalized = Array.isArray(roles) ? roles : [roles];
  return normalized.some((role) => ADMIN_BYPASS_ROLES.has(role));
}

function userHasPermissionKeys(userPermissionKeys = [], requiredKeys = []) {
  const required = Array.isArray(requiredKeys) ? requiredKeys : [requiredKeys];
  if (!required.length) return true;

  const granted = new Set(userPermissionKeys);
  return required.some((key) => granted.has(key));
}

module.exports = {
  ADMIN_BYPASS_ROLES,
  loadUserPermissionKeys,
  rolesIncludeAdmin,
  userHasPermissionKeys,
};
