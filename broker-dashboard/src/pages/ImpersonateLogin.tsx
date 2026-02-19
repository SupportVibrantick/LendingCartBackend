import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

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

    try {
      // Clear old session
      sessionStorage.removeItem("broker_token");
      sessionStorage.removeItem("broker_user");

      // Save token
      sessionStorage.setItem("broker_token", token);

      // Save user if exists
      if (userParam) {
        const decodedUser = JSON.parse(decodeURIComponent(userParam));

        sessionStorage.setItem("broker_user", JSON.stringify(decodedUser));
      }

      navigate("/", { replace: true });
    } catch (err) {
      console.error("Impersonation error", err);
      navigate("/signin", { replace: true });
    }
  }, [navigate, searchParams]);

  return (
    <div className="flex items-center justify-center h-screen">
      Logging you in...
    </div>
  );
};

export default ImpersonateLogin;
