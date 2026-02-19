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
      sessionStorage.removeItem("lender_token");
      sessionStorage.removeItem("lender_user");

      // Save token
      sessionStorage.setItem("lender_token", token);

      // Save user if exists
      if (userParam) {
        const decodedUser = JSON.parse(
          decodeURIComponent(userParam)
        );

        sessionStorage.setItem(
          "lender_user",
          JSON.stringify(decodedUser)
        );
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
