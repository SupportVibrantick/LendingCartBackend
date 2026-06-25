const { getUserRoles, isLenderAdmin } = require("./lenderTeamRoles");

const LENDER_PERMISSION = {
  MARK_NOTIFICATIONS_READ: "MARK_NOTIFICATIONS_READ",
  DECIDE_APPLICATION: "DECIDE_APPLICATION",
  REQUEST_DOCUMENTS: "REQUEST_DOCUMENTS",
  GENERATE_LOI: "GENERATE_LOI",
  UPLOAD_SIGN_DOCUMENTS: "UPLOAD_SIGN_DOCUMENTS",
  MARK_SIGN_SEEN: "MARK_SIGN_SEEN",
  SEND_CHAT: "SEND_CHAT",
  MANAGE_LOAN_PRODUCTS: "MANAGE_LOAN_PRODUCTS",
  MANAGE_LENDER_PROFILE: "MANAGE_LENDER_PROFILE",
  MANAGE_TEAM: "MANAGE_TEAM",
  MANAGE_BROKERS: "MANAGE_BROKERS",
  MANAGE_DOCUMENT_CONFIG: "MANAGE_DOCUMENT_CONFIG",
  MANAGE_ELIGIBILITY: "MANAGE_ELIGIBILITY",
  MANAGE_PORTAL: "MANAGE_PORTAL",
};

const ROLE_PERMISSIONS = {
  LENDER_ADMIN: ["*"],
  LENDER_UNDERWRITER: [
    LENDER_PERMISSION.MARK_NOTIFICATIONS_READ,
    LENDER_PERMISSION.DECIDE_APPLICATION,
    LENDER_PERMISSION.REQUEST_DOCUMENTS,
    LENDER_PERMISSION.GENERATE_LOI,
    LENDER_PERMISSION.UPLOAD_SIGN_DOCUMENTS,
    LENDER_PERMISSION.MARK_SIGN_SEEN,
    LENDER_PERMISSION.SEND_CHAT,
  ],
  LENDER_ANALYST: [
    LENDER_PERMISSION.MARK_NOTIFICATIONS_READ,
    LENDER_PERMISSION.REQUEST_DOCUMENTS,
    LENDER_PERMISSION.SEND_CHAT,
  ],
  LENDER_VIEWER: [LENDER_PERMISSION.MARK_NOTIFICATIONS_READ],
};

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function roleHasPermission(roleName, permission) {
  const permissions = ROLE_PERMISSIONS[roleName];
  if (!permissions) {
    return false;
  }

  return permissions.includes("*") || permissions.includes(permission);
}

function hasLenderPermission(user, permission) {
  if (!user || user.orgType !== "LENDER") {
    return false;
  }

  if (isLenderAdmin(user)) {
    return true;
  }

  const roles = getUserRoles(user);
  return roles.some((role) => roleHasPermission(role, permission));
}

function getRequestPath(req) {
  return String(req.url || req.routerPath || "").split("?")[0];
}

function resolveLenderMutationPermission(req) {
  const path = getRequestPath(req);
  const method = req.method;

  if (method === "PATCH" && path.includes("/notifications/")) {
    return LENDER_PERMISSION.MARK_NOTIFICATIONS_READ;
  }

  if (method === "PATCH" && path.includes("/loan-pipeline/") && path.endsWith("/decision")) {
    const decision = String(req.body?.decision || "").toUpperCase();
    if (decision === "CONDITIONAL") {
      return LENDER_PERMISSION.REQUEST_DOCUMENTS;
    }
    return LENDER_PERMISSION.DECIDE_APPLICATION;
  }

  if (
    method === "POST" &&
    path.includes("/loan-pipeline/") &&
    (path.includes("/generate-loi") || path.includes("/upload-loi-template"))
  ) {
    return LENDER_PERMISSION.GENERATE_LOI;
  }

  if (method === "POST" && path.includes("/loan-pipeline/") && path.includes("/sign-documents")) {
    if (path.includes("/mark-seen")) {
      return LENDER_PERMISSION.MARK_SIGN_SEEN;
    }
    return LENDER_PERMISSION.UPLOAD_SIGN_DOCUMENTS;
  }

  if (path.includes("/loan-products")) {
    return LENDER_PERMISSION.MANAGE_LOAN_PRODUCTS;
  }

  if (path.includes("/users")) {
    return LENDER_PERMISSION.MANAGE_TEAM;
  }

  if (path.includes("/brokers")) {
    return LENDER_PERMISSION.MANAGE_BROKERS;
  }

  if (path.includes("/document-config")) {
    return LENDER_PERMISSION.MANAGE_DOCUMENT_CONFIG;
  }

  if (path.includes("/eligibility-engine")) {
    return LENDER_PERMISSION.MANAGE_ELIGIBILITY;
  }

  if (method === "DELETE" && path.includes("/notifications")) {
    return LENDER_PERMISSION.MANAGE_PORTAL;
  }

  return LENDER_PERMISSION.MANAGE_PORTAL;
}

function canLenderMutate(req) {
  if (!MUTATION_METHODS.has(req.method)) {
    return true;
  }

  const permission = resolveLenderMutationPermission(req);
  return hasLenderPermission(req.user, permission);
}

function denyLenderMutation(reply) {
  return reply.code(403).send({
    success: false,
    ok: false,
    message:
      "You do not have permission to perform this action. Contact your lender admin if you need access.",
  });
}

module.exports = {
  LENDER_PERMISSION,
  ROLE_PERMISSIONS,
  hasLenderPermission,
  resolveLenderMutationPermission,
  canLenderMutate,
  denyLenderMutation,
};
