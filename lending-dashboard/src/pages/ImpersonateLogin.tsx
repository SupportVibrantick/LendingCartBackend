import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  clearLenderSession,
  saveLenderSession,
  verifyLenderSession,
} from "../lib/lenderSession";

const ImpersonateLogin = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get("token");
    const userParam = searchParams.get("user");

    if (!token) {
      navigate("/signin", { replace: true });
      return;
    }

    void (async () => {
      try {
        clearLenderSession();

        let user: Record<string, unknown> | null = null;
        if (userParam) {
          user = JSON.parse(decodeURIComponent(userParam));
        }

        saveLenderSession(token, user);

        const verified = await verifyLenderSession(token);
        if (!verified) {
          clearLenderSession();
          navigate("/signin", { replace: true });
          return;
        }

        navigate("/", { replace: true });
      } catch (err) {
        console.error("Impersonation error", err);
        clearLenderSession();
        navigate("/signin", { replace: true });
      }
    })();
  }, [navigate, searchParams]);

  return (
    <div className="flex items-center justify-center h-screen">
      Logging you in...
    </div>
  );
};

export default ImpersonateLogin;
