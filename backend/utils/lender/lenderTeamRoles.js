const LENDER_PORTAL_ROLES = [
  "LENDER_ADMIN",
  "LENDER_UNDERWRITER",
  "LENDER_ANALYST",
  "LENDER_VIEWER",
];

const LENDER_TEAM_ASSIGNABLE_ROLES = [
  "LENDER_ADMIN",
  "LENDER_UNDERWRITER",
  "LENDER_ANALYST",
  "LENDER_VIEWER",
];

const ROLE_LABELS = {
  LENDER_ADMIN: "Admin",
  LENDER_UNDERWRITER: "Underwriter",
  LENDER_ANALYST: "Analyst",
  LENDER_VIEWER: "Viewer",
};

function getUserRoles(user) {
  const roles = user?.roles ?? user?.role ?? [];
  if (Array.isArray(roles)) {
    return roles;
  }
  return roles ? [roles] : [];
}

function isLenderPortalRole(roleName) {
  return LENDER_PORTAL_ROLES.includes(roleName);
}

function isLenderAdmin(user) {
  return getUserRoles(user).includes("LENDER_ADMIN");
}

function isLenderViewer(user) {
  const roles = getUserRoles(user);
  return roles.includes("LENDER_VIEWER") && !roles.includes("LENDER_ADMIN");
}

function formatLenderRoleLabel(roleName) {
  return ROLE_LABELS[roleName] || String(roleName || "").replaceAll("_", " ");
}

function generateTemporaryPassword(length = 12) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let password = "";

  for (let i = 0; i < length; i += 1) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return password;
}

module.exports = {
  LENDER_PORTAL_ROLES,
  LENDER_TEAM_ASSIGNABLE_ROLES,
  ROLE_LABELS,
  isLenderPortalRole,
  isLenderAdmin,
  isLenderViewer,
  getUserRoles,
  formatLenderRoleLabel,
  generateTemporaryPassword,
};
