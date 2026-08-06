import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import {
  getFirstAllowedLoanOfficerPath,
  hasAnyPermission,
  type PermissionKey,
  type PermissionPortal,
} from "../../lib/brokerPermissions";

type RequirePermissionProps = {
  children: ReactNode;
  permission: PermissionKey | PermissionKey[];
  portal?: PermissionPortal;
  fallbackPath?: string;
};

export default function RequirePermission({
  children,
  permission,
  portal = "loanOfficer",
  fallbackPath,
}: RequirePermissionProps) {
  const required = Array.isArray(permission) ? permission : [permission];
  const allowed = hasAnyPermission(required, portal);

  if (!allowed) {
    const redirect =
      fallbackPath ||
      (portal === "loanOfficer"
        ? getFirstAllowedLoanOfficerPath(portal)
        : "/");

    return <Navigate to={redirect} replace />;
  }

  return <>{children}</>;
}
