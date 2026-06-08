import { Navigate } from "react-router-dom";
import { LO_TOKEN_KEY } from "../../lib/loanOfficerApi";

export default function LoanOfficerProtected({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = sessionStorage.getItem(LO_TOKEN_KEY);

  if (!token) {
    return <Navigate to="/loan-officer/login" replace />;
  }

  return <>{children}</>;
}
