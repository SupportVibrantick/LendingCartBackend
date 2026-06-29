import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  LO_TOKEN_KEY,
  LO_USER_KEY,
  clearLoanOfficerSession,
  verifyLoanOfficerSession,
} from "../../../lib/loanOfficerApi";

export default function LoanOfficerImpersonateLogin() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get("token");
    const userParam = searchParams.get("user");
    const permissionsParam = searchParams.get("permissions");

    if (!token) {
      navigate("/loan-officer/login", { replace: true });
      return;
    }

    void (async () => {
      try {
        clearLoanOfficerSession();

        let user: Record<string, unknown> | null = null;
        if (userParam) {
          user = JSON.parse(userParam);
        }

        sessionStorage.setItem(LO_TOKEN_KEY, token);
        if (user) {
          sessionStorage.setItem(LO_USER_KEY, JSON.stringify(user));
        }
        sessionStorage.setItem("roles", JSON.stringify(["BROKER_OFFICER"]));

        if (permissionsParam) {
          const permissions = JSON.parse(permissionsParam);
          sessionStorage.setItem("permissions", JSON.stringify(permissions));
        }

        const verified = await verifyLoanOfficerSession(token);
        if (!verified) {
          clearLoanOfficerSession();
          navigate("/loan-officer/login", { replace: true });
          return;
        }

        navigate("/loan-officer/dashboard", { replace: true });
      } catch (err) {
        console.error("Loan officer impersonation error", err);
        clearLoanOfficerSession();
        navigate("/loan-officer/login", { replace: true });
      }
    })();
  }, [navigate, searchParams]);

  return (
    <div className="flex h-screen items-center justify-center">
      Opening loan officer portal...
    </div>
  );
}
