import { getLenderRoles, isLenderAdminUser } from "./lenderTeamMembers";

export const LENDER_PERMISSION = {
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
} as const;

type LenderPermission =
  (typeof LENDER_PERMISSION)[keyof typeof LENDER_PERMISSION];

type RolePermissions = LenderPermission[] | "*";

const ROLE_PERMISSIONS: Record<string, RolePermissions> = {
  LENDER_ADMIN: "*",
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

function roleHasPermission(roleName: string, permission: LenderPermission) {
  const permissions = ROLE_PERMISSIONS[roleName];
  if (!permissions) return false;
  if (permissions === "*") return true;
  return permissions.includes(permission);
}

export function hasLenderPermission(permission: LenderPermission): boolean {
  if (isLenderAdminUser()) return true;

  const roles = getLenderRoles();
  return roles.some((role) => roleHasPermission(role, permission));
}

export function canDecideApplications(): boolean {
  return hasLenderPermission(LENDER_PERMISSION.DECIDE_APPLICATION);
}

export function canRequestDocuments(): boolean {
  return hasLenderPermission(LENDER_PERMISSION.REQUEST_DOCUMENTS);
}

export function canGenerateLoi(): boolean {
  return hasLenderPermission(LENDER_PERMISSION.GENERATE_LOI);
}

export function canUploadSignDocuments(): boolean {
  return hasLenderPermission(LENDER_PERMISSION.UPLOAD_SIGN_DOCUMENTS);
}

export function canMarkSignSeen(): boolean {
  return hasLenderPermission(LENDER_PERMISSION.MARK_SIGN_SEEN);
}

export function canSendChat(): boolean {
  return hasLenderPermission(LENDER_PERMISSION.SEND_CHAT);
}

export function canManageLoanProducts(): boolean {
  return hasLenderPermission(LENDER_PERMISSION.MANAGE_LOAN_PRODUCTS);
}

export function canManageLenderProfile(): boolean {
  return hasLenderPermission(LENDER_PERMISSION.MANAGE_LENDER_PROFILE);
}

export function canManageTeam(): boolean {
  return hasLenderPermission(LENDER_PERMISSION.MANAGE_TEAM);
}

/** @deprecated Use specific permission helpers instead */
export function canLenderManagePortal(): boolean {
  return isLenderAdminUser();
}

export function isLenderReadOnlyUser(): boolean {
  return getLenderRoles().includes("LENDER_VIEWER") && !isLenderAdminUser();
}

export function isLenderViewerUser(): boolean {
  return isLenderReadOnlyUser();
}
