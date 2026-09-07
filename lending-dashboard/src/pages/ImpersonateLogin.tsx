import { useEffect } from "react";
import { useNavigate } from "react-router";
import { readImpersonateParams } from "../lib/impersonateUrl";
import {
  clearLenderSession,
  saveLenderSession,
  verifyLenderSession,
} from "../lib/lenderSession";

const ImpersonateLogin = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = readImpersonateParams();
    const token = params.get("token");
    const userParam = params.get("user");
    const redirectTo = params.get("redirectTo") || "/";

    if (!token) {
      navigate("/signin", { replace: true });
      return;
    }

    void (async () => {
      try {
        clearLenderSession();

        let user: Record<string, unknown> | null = null;
        if (userParam) {
          user = JSON.parse(userParam);
        }

        saveLenderSession(token, user);

        const verified = await verifyLenderSession(token);
        if (!verified) {
          clearLenderSession();
          navigate("/signin", { replace: true });
          return;
        }

        // Clear hash so the token is not left in the address bar.
        if (window.location.hash) {
          window.history.replaceState(
            null,
            "",
            `${window.location.pathname}${window.location.search}`,
          );
        }

        navigate(redirectTo, { replace: true });
      } catch (err) {
        console.error("Impersonation error", err);
        clearLenderSession();
        navigate("/signin", { replace: true });
      }
    })();
  }, [navigate]);

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">
      Opening team member dashboard...
    </div>
  );
};

export default ImpersonateLogin;
