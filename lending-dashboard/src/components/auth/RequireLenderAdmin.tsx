import { useEffect } from "react";
import { Navigate, useLocation } from "react-router";
import toast from "react-hot-toast";
import { canManageTeam } from "../../lib/lenderPermissions";

type RequireLenderAdminProps = {
  children: React.ReactNode;
};

/** Guards lender-admin pages (team, branding, document config, products mutate). */
export default function RequireLenderAdmin({ children }: RequireLenderAdminProps) {
  const location = useLocation();
  const isAllowed = canManageTeam();

  useEffect(() => {
    if (!isAllowed) {
      toast.error("Admin access required. Contact your lender admin.");
    }
  }, [isAllowed]);

  if (!isAllowed) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
