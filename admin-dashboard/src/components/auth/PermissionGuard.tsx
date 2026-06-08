import { ShieldOff } from "lucide-react";
import { Link, useLocation } from "react-router";
import { useAdminPermissions } from "../../context/AdminPermissionsContext";
import { getRequiredPermission } from "../../lib/adminPermissions";

const FALLBACK_PATHS = [
  "/",
  "/platform-reports",
  "/all-brokers-database",
  "/all-loan-products",
  "/all-lenders-Organization",
  "/loan-pipeline",
  "/profile",
];

export default function PermissionGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { loading, canAccess, permissions, hasFullAccess } = useAdminPermissions();

  const homePath =
    FALLBACK_PATHS.find((path) => canAccess(path)) ?? "/profile";

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-[#13538A]" />
      </div>
    );
  }

  if (canAccess(location.pathname)) {
    return <>{children}</>;
  }

  const required = getRequiredPermission(location.pathname);
  const requiredLabel = Array.isArray(required)
    ? required.join(", ")
    : required ?? "Unknown";

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-900/20">
        <ShieldOff size={32} />
      </div>
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
        Access Denied
      </h2>
      <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
        You don&apos;t have permission to view this page.
        {!hasFullAccess && required && (
          <span className="mt-1 block text-xs text-slate-400">
            Required: {requiredLabel.replace(/_/g, " ")}
          </span>
        )}
      </p>
      <Link
        to={homePath}
        className="mt-6 rounded-lg bg-[#13538A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a6aad]"
      >
        {homePath === "/" ? "Go to Dashboard" : "Go to Home"}
      </Link>
      {!hasFullAccess && permissions.length > 0 && (
        <p className="mt-4 text-xs text-slate-400">
          Your account has {permissions.length} assigned permission(s).
        </p>
      )}
    </div>
  );
}
