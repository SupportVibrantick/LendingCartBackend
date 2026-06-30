import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { readImpersonateParams } from "../../lib/impersonateUrl";
import {
  clearClientPortalSession,
  saveClientPortalSession,
  verifyClientPortalSession,
} from "../../lib/clientPortalSession";

export default function ClientImpersonateLogin() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = readImpersonateParams();
    const token = params.get("token");
    const userParam = params.get("user");
    const redirectTo = params.get("redirectTo") || "/client-portal";

    if (!token) {
      navigate("/client-upload", { replace: true });
      return;
    }

    void (async () => {
      try {
        clearClientPortalSession();

        let user: {
          clientName?: string;
          email?: string;
          clientId?: string;
        } | null = null;

        if (userParam) {
          const parsed = JSON.parse(userParam) as {
            clientName?: string;
            email?: string;
            clientId?: string;
          };
          user = {
            clientName: parsed.clientName,
            email: parsed.email,
            clientId: parsed.clientId,
          };
        }

        saveClientPortalSession(token, user || undefined);

        const verified = await verifyClientPortalSession(token);
        if (!verified) {
          clearClientPortalSession();
          navigate("/client-upload", { replace: true });
          return;
        }

        navigate(redirectTo, { replace: true });
      } catch (err) {
        console.error("Client portal impersonation error", err);
        clearClientPortalSession();
        navigate("/client-upload", { replace: true });
      }
    })();
  }, [navigate]);

  return (
    <div className="flex h-screen items-center justify-center">
      Opening client portal...
    </div>
  );
}
