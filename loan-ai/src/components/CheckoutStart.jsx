import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Legacy bridge: /checkout now requires organization details first.
 * Redirect to /subscribe with the same plan state.
 */
export default function CheckoutStart() {
  const { loading: authLoading, isAuthenticated, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const planState = location.state || {};

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      navigate("/signup", { state: planState, replace: true });
      return;
    }

    if (user?.hasBrokerSubscription) {
      navigate({ pathname: "/", hash: "#pricing" }, { replace: true });
      return;
    }

    navigate("/subscribe", { state: planState, replace: true });
  }, [authLoading, isAuthenticated, user, planState, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b1020] px-6 text-white">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-blue-400" />
    </div>
  );
}
