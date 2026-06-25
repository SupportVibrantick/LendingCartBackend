import { useEffect } from "react";
import { Navigate, useLocation } from "react-router";
import toast from "react-hot-toast";
import { isLenderAdminUser } from "../../lib/lenderTeamMembers";

type RequireLenderAdminProps = {
  children: React.ReactNode;
};

export default function RequireLenderAdmin({ children }: RequireLenderAdminProps) {
  const location = useLocation();
  const allowed = isLenderAdminUser();

  useEffect(() => {
    if (!allowed) {
      toast.error("You have read-only access. Contact your lender admin.");
    }
  }, [allowed]);

  if (!allowed) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
