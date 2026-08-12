import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { startPlanCheckoutAndRedirect } from "../lib/startPlanCheckout";
import { getCheckoutUserMessage } from "../lib/checkoutErrors";

/**
 * Bridge page: after signup/login (or guest redirect), start GHL checkout.
 * Route: /checkout
 */
export default function CheckoutStart() {
  const { token, isAuthenticated, loading: authLoading, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const planState = location.state || {};
  const startedRef = useRef(false);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    if (authLoading || startedRef.current) return;

    if (!isAuthenticated || !token) {
      navigate("/signup", { state: planState, replace: true });
      return;
    }

    if (user?.hasBrokerSubscription) {
      navigate({ pathname: "/", hash: "#pricing" }, { replace: true });
      return;
    }

    const packageId = planState.packageId;
    const billingCycle = planState.billingCycle || "MONTHLY";

    if (!packageId) {
      navigate({ pathname: "/", hash: "#pricing" }, { replace: true });
      return;
    }

    startedRef.current = true;
    setStarting(true);
    setError(null);

    startPlanCheckoutAndRedirect({
      token,
      packageId,
      billingCycle,
    }).catch((err) => {
      const message = getCheckoutUserMessage(err);
      setError(message);
      setStarting(false);
      toast.error(message);
    });
  }, [
    authLoading,
    isAuthenticated,
    token,
    user,
    planState,
    navigate,
  ]);

  return (
    <div className="min-h-screen bg-[#0b1020] text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        {starting && !error ? (
          <>
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-blue-400" />
            <h1 className="text-xl font-semibold">Redirecting to secure checkout…</h1>
            <p className="mt-2 text-sm text-slate-400">
              {planState.planName
                ? `Preparing ${planState.planName} (${planState.billingCycle === "YEARLY" ? "yearly" : "monthly"}).`
                : "Please wait while we prepare your payment."}
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-red-300">Checkout failed</h1>
            <p className="mt-2 text-sm text-slate-300">{error}</p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                className="w-full rounded-xl bg-linear-to-r from-blue-500 to-indigo-500 py-3 font-semibold disabled:opacity-60"
                disabled={starting}
                onClick={() => {
                  if (!token || !planState.packageId || starting) return;
                  setError(null);
                  setStarting(true);
                  startPlanCheckoutAndRedirect({
                    token,
                    packageId: planState.packageId,
                    billingCycle: planState.billingCycle || "MONTHLY",
                  }).catch((err) => {
                    const message = getCheckoutUserMessage(err);
                    setError(message);
                    setStarting(false);
                    toast.error(message);
                  });
                }}
              >
                Try again
              </button>
              <Link
                to={{ pathname: "/", hash: "#pricing" }}
                className="w-full rounded-xl border border-white/20 py-3 font-semibold text-white hover:bg-white/10"
              >
                Back to pricing
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
