const ADMIN_BYPASS_ROLES = new Set(["BROKER_ADMIN", "PLATFORM_ADMIN"]);

const PERMISSION_CACHE_TTL_MS = 30_000;
const PERMISSION_CACHE_MAX = 5_000;
const permissionCache = new Map();

function getCachedPermissionKeys(userId) {
  const hit = permissionCache.get(userId);
  if (!hit) return undefined;
  if (hit.expiresAt <= Date.now()) {
    permissionCache.delete(userId);
    return undefined;
  }
  return hit.keys;
}

function setCachedPermissionKeys(userId, keys) {
  if (permissionCache.size >= PERMISSION_CACHE_MAX) {
    const oldest = permissionCache.keys().next().value;
    if (oldest !== undefined) permissionCache.delete(oldest);
  }
  permissionCache.set(userId, {
    keys,
    expiresAt: Date.now() + PERMISSION_CACHE_TTL_MS,
  });
}

function invalidateUserPermissionCache(userId) {
  if (userId) permissionCache.delete(userId);
}

async function loadUserPermissionKeys(prisma, userId) {
  if (!userId) return [];

  const cached = getCachedPermissionKeys(userId);
  if (cached) return cached.slice();

  const rows = await prisma.userPermission.findMany({
    where: { userId },
    include: {
      permission: {
        select: { key: true },
      },
    },
  });

  const keys = rows
    .map((row) => row.permission?.key)
    .filter((key) => typeof key === "string" && key.length > 0);

  setCachedPermissionKeys(userId, keys);
  return keys.slice();
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
  invalidateUserPermissionCache,
  rolesIncludeAdmin,
  userHasPermissionKeys,
};
