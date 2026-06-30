import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { readImpersonateParams } from "../../../lib/impersonateUrl";
import {
  LO_TOKEN_KEY,
  LO_USER_KEY,
  clearLoanOfficerSession,
  verifyLoanOfficerSession,
} from "../../../lib/loanOfficerApi";

export default function LoanOfficerImpersonateLogin() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = readImpersonateParams();
    const token = params.get("token");
    const userParam = params.get("user");
    const permissionsParam = params.get("permissions");
    const redirectTo = params.get("redirectTo") || "/loan-officer/dashboard";

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

        navigate(redirectTo, { replace: true });
      } catch (err) {
        console.error("Loan officer impersonation error", err);
        clearLoanOfficerSession();
        navigate("/loan-officer/login", { replace: true });
      }
    })();
  }, [navigate]);

  return (
    <div className="flex h-screen items-center justify-center">
      Opening loan officer portal...
    </div>
  );
}
