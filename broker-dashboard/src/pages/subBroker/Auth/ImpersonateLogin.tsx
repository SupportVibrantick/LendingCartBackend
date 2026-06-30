import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { readImpersonateParams } from "../../../lib/impersonateUrl";
import {
  CO_BROKER_TOKEN_KEY,
  CO_BROKER_USER_KEY,
  clearCoBrokerSession,
  storeCoBrokerBranding,
  verifyCoBrokerSession,
  type CoBrokerBranding,
} from "../../../lib/coBrokerPortal";

export default function CoBrokerImpersonateLogin() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = readImpersonateParams();
    const token = params.get("token");
    const userParam = params.get("user");
    const brandingParam = params.get("branding");
    const redirectTo = params.get("redirectTo") || "/sub-broker/loan-pipeline";

    if (!token) {
      navigate("/sub-broker/login", { replace: true });
      return;
    }

    void (async () => {
      try {
        clearCoBrokerSession();

        let user: Record<string, unknown> | null = null;
        if (userParam) {
          user = JSON.parse(userParam);
        }

        sessionStorage.setItem(CO_BROKER_TOKEN_KEY, token);
        if (user) {
          sessionStorage.setItem(
            CO_BROKER_USER_KEY,
            JSON.stringify({
              ...user,
              name: `${String(user.firstName || "")} ${String(user.lastName || "")}`.trim(),
            }),
          );
        }

        if (brandingParam) {
          const branding = JSON.parse(brandingParam) as CoBrokerBranding;
          storeCoBrokerBranding(branding);
        }

        const verified = await verifyCoBrokerSession(token);
        if (!verified) {
          clearCoBrokerSession();
          navigate("/sub-broker/login", { replace: true });
          return;
        }

        navigate(redirectTo, { replace: true });
      } catch (err) {
        console.error("Co-broker impersonation error", err);
        clearCoBrokerSession();
        navigate("/sub-broker/login", { replace: true });
      }
    })();
  }, [navigate]);

  return (
    <div className="flex h-screen items-center justify-center">
      Opening co-broker portal...
    </div>
  );
}
