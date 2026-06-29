import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  clearClientPortalSession,
  saveClientPortalSession,
  verifyClientPortalSession,
} from "../../lib/clientPortalSession";

export default function ClientImpersonateLogin() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get("token");
    const userParam = searchParams.get("user");
    const redirectTo = searchParams.get("redirectTo") || "/client-portal";

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
  }, [navigate, searchParams]);

  return (
    <div className="flex h-screen items-center justify-center">
      Opening client portal...
    </div>
  );
}
