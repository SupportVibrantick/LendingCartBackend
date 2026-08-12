import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getBrokerSignInUrl } from "../lib/brokerAuth";
import { startPlanCheckoutAndRedirect } from "../lib/startPlanCheckout";
import { getCheckoutUserMessage } from "../lib/checkoutErrors";

const subscribeClass =
  "w-full text-center bg-linear-to-r from-blue-500 to-indigo-500 text-white py-3 rounded-xl font-semibold shadow-lg hover:scale-[1.02] hover:shadow-blue-500/30 transition disabled:opacity-60 disabled:hover:scale-100 disabled:cursor-not-allowed";

const dashboardClass =
  "w-full text-center bg-linear-to-r from-emerald-500 to-teal-500 text-white py-3 rounded-xl font-semibold shadow-lg hover:scale-[1.02] transition";

const disabledClass =
  "w-full text-center bg-white/5 border border-white/10 text-gray-500 py-3 rounded-xl font-semibold cursor-not-allowed opacity-60";

const demoClass =
  "w-full text-center bg-white/10 border border-white/20 text-white py-3 rounded-xl hover:bg-white/20 transition";

export default function PricingPlanCta({ pkg, checkoutState, demoState }) {
  const { isAuthenticated, user, loading, token } = useAuth();
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  if (loading) {
    return <div className="h-12 w-full rounded-xl bg-white/10 animate-pulse" />;
  }

  const hasSubscription = Boolean(user?.hasBrokerSubscription);
  const isCurrentPlan =
    hasSubscription && user?.subscribedPackageId === pkg.id;

  const handleSubscribe = async () => {
    if (checkoutLoading) return;
    if (!checkoutState?.packageId) {
      toast.error("Package is missing. Please refresh and try again.");
      return;
    }

    try {
      setCheckoutLoading(true);
      await startPlanCheckoutAndRedirect({
        token,
        packageId: checkoutState.packageId,
        billingCycle: checkoutState.billingCycle || "MONTHLY",
      });
    } catch (err) {
      toast.error(getCheckoutUserMessage(err));
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 mt-auto">
      {isCurrentPlan && (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-sm font-medium text-emerald-300">
          <CheckCircle2 size={16} className="shrink-0" />
          Purchased · Active plan
        </div>
      )}

      {isCurrentPlan ? (
        <a
          href={getBrokerSignInUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className={dashboardClass}
        >
          Open broker dashboard
        </a>
      ) : hasSubscription ? (
        <button type="button" disabled className={disabledClass}>
          Subscribe
        </button>
      ) : isAuthenticated ? (
        <button
          type="button"
          disabled={checkoutLoading}
          onClick={handleSubscribe}
          className={subscribeClass}
          aria-busy={checkoutLoading}
        >
          {checkoutLoading ? "Redirecting…" : "Subscribe"}
        </button>
      ) : (
        <Link to="/signup" state={checkoutState} className={subscribeClass}>
          Get Started
        </Link>
      )}

      {!isAuthenticated && (
        <Link to="/book-demo" state={demoState} className={demoClass}>
          Book Demo
        </Link>
      )}
    </div>
  );
}
