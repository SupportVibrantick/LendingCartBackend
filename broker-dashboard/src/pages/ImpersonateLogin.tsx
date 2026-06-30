import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { readImpersonateParams } from "../lib/impersonateUrl";
import {
  clearBrokerSession,
  saveBrokerSession,
  verifyBrokerSession,
} from "../lib/brokerSession";

const ImpersonateLogin = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = readImpersonateParams();
    const token = params.get("token");
    const userParam = params.get("user");

    if (!token) {
      navigate("/signin", { replace: true });
      return;
    }

    void (async () => {
      try {
        clearBrokerSession();

        let user: Record<string, unknown> | null = null;
        if (userParam) {
          user = JSON.parse(userParam);
        }

        saveBrokerSession(token, user);

        const verified = await verifyBrokerSession(token);
        if (!verified) {
          clearBrokerSession();
          navigate("/signin", { replace: true });
          return;
        }

        navigate("/", { replace: true });
      } catch (err) {
        console.error("Impersonation error", err);
        clearBrokerSession();
        navigate("/signin", { replace: true });
      }
    })();
  }, [navigate]);

  return (
    <div className="flex h-screen items-center justify-center">
      Logging you in...
    </div>
  );
};

export default ImpersonateLogin;
