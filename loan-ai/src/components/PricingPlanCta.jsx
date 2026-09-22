import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getBrokerSignInUrl } from "../lib/brokerAuth";

const TIER_PRIMARY = {
  BASIC:
    "bg-linear-to-r from-[#4B83FF] to-blue-600 shadow-[0_8px_28px_rgba(75,131,255,0.35)] hover:shadow-[0_10px_36px_rgba(75,131,255,0.45)]",
  PRO:
    "bg-linear-to-r from-[#4B83FF] to-indigo-500 shadow-[0_8px_28px_rgba(75,131,255,0.4)] hover:shadow-[0_12px_40px_rgba(75,131,255,0.55)]",
  ELITE:
    "bg-linear-to-r from-amber-400 to-yellow-500 text-slate-900 shadow-[0_8px_28px_rgba(251,191,36,0.35)] hover:shadow-[0_12px_40px_rgba(251,191,36,0.5)]",
};

/** Outline CTAs tinted to each plan — readable in light and dark */
const TIER_BUY_NOW = {
  BASIC:
    "border-[#4B83FF]/50 bg-[#4B83FF]/10 text-[#2f5fd4] hover:border-[#4B83FF] hover:bg-[#4B83FF]/18 dark:border-[#4B83FF]/55 dark:bg-[#4B83FF]/15 dark:text-[#9bb8ff] dark:hover:border-[#4B83FF] dark:hover:bg-[#4B83FF]/25 dark:hover:text-white dark:shadow-[0_0_20px_rgba(75,131,255,0.12)]",
  PRO:
    "border-indigo-400/50 bg-indigo-500/10 text-indigo-700 hover:border-indigo-500 hover:bg-indigo-500/18 dark:border-indigo-400/55 dark:bg-indigo-500/15 dark:text-indigo-200 dark:hover:border-indigo-400 dark:hover:bg-indigo-500/25 dark:hover:text-white dark:shadow-[0_0_20px_rgba(99,102,241,0.14)]",
  ELITE:
    "border-amber-400/50 bg-amber-500/10 text-amber-800 hover:border-amber-500 hover:bg-amber-500/18 dark:border-amber-400/55 dark:bg-amber-500/15 dark:text-amber-200 dark:hover:border-amber-400 dark:hover:bg-amber-500/25 dark:hover:text-amber-50 dark:shadow-[0_0_20px_rgba(251,191,36,0.12)]",
};

const TIER_BOOK_DEMO = {
  BASIC:
    "border-slate-200 bg-slate-50 text-slate-700 hover:border-[#4B83FF]/40 hover:bg-[#4B83FF]/10 hover:text-[#2f5fd4] dark:border-white/20 dark:bg-white/[0.06] dark:text-gray-200 dark:hover:border-[#4B83FF]/40 dark:hover:bg-[#4B83FF]/10 dark:hover:text-white",
  PRO:
    "border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-400/50 hover:bg-indigo-500/10 hover:text-indigo-700 dark:border-white/20 dark:bg-white/[0.06] dark:text-gray-200 dark:hover:border-indigo-400/40 dark:hover:bg-indigo-500/10 dark:hover:text-white",
  ELITE:
    "border-slate-200 bg-slate-50 text-slate-700 hover:border-amber-400/50 hover:bg-amber-500/10 hover:text-amber-800 dark:border-white/20 dark:bg-white/[0.06] dark:text-gray-200 dark:hover:border-amber-400/40 dark:hover:bg-amber-500/10 dark:hover:text-amber-50",
};

const basePrimary =
  "group inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 disabled:hover:scale-100";

const baseSecondary =
  "inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-5 py-3.5 text-sm font-semibold transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]";

const dashboardClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-emerald-500 to-teal-500 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_8px_28px_rgba(16,185,129,0.35)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_12px_36px_rgba(16,185,129,0.45)]";

const disabledClass =
  "inline-flex w-full cursor-not-allowed items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-400 opacity-60 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-500";

function formatTrialEnds(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Pricing CTA: free trial (no payment) or paid subscribe.
 * Authenticated users go to /subscribe to fill organization details.
 */
export default function PricingPlanCta({
  pkg,
  checkoutState,
  trialCheckoutState,
  demoState,
  freeTrialDays = 14,
}) {
  const { isAuthenticated, user, loading } = useAuth();
  const navigate = useNavigate();
  const tier = String(pkg?.code || "BASIC").toUpperCase();
  const primaryTone = TIER_PRIMARY[tier] || TIER_PRIMARY.BASIC;
  const primaryClass = `${basePrimary} ${primaryTone}`;
  const buyNowClass = `${baseSecondary} ${TIER_BUY_NOW[tier] || TIER_BUY_NOW.BASIC}`;
  const demoClass = `${baseSecondary} ${TIER_BOOK_DEMO[tier] || TIER_BOOK_DEMO.BASIC}`;
  const arrowTone = tier === "ELITE" ? "text-slate-900" : "text-white/90";

  if (loading) {
    return (
      <div className="mt-auto space-y-3">
        <div className="h-12 w-full animate-pulse rounded-2xl bg-slate-200 dark:bg-white/10" />
        <div className="h-12 w-full animate-pulse rounded-2xl bg-slate-100 dark:bg-white/5" />
      </div>
    );
  }

  const hasSubscription = Boolean(user?.hasBrokerSubscription);
  const isOnTrial = user?.subscriptionStatus === "TRIAL";
  const isPaidActive = hasSubscription && !isOnTrial;
  const userBillingCycle = user?.subscribedBillingCycle || "MONTHLY";
  const isCurrentPlan =
    hasSubscription &&
    user?.subscribedPackageId === pkg.id &&
    userBillingCycle === checkoutState?.billingCycle;
  const trialEndLabel = formatTrialEnds(user?.trialEndsAt);
  const canStartTrial =
    !hasSubscription && !user?.hasUsedFreeTrial;
  const trialLabel = `Start ${freeTrialDays}-day free trial`;

  const goToSubscribe = (state) => {
    if (!state?.packageId) {
      toast.error("Package is missing. Please refresh and try again.");
      return;
    }
    navigate("/subscribe", { state });
  };

  return (
    <div className="mt-auto flex flex-col gap-2.5 pt-2">
      {isCurrentPlan && isOnTrial && (
        <div className="mb-1 flex flex-col items-center gap-1 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-3 py-2.5 text-sm font-medium text-sky-700 dark:text-sky-200">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0" />
            Free trial active
          </span>
          {trialEndLabel && (
            <span className="text-xs font-normal text-sky-600/80 dark:text-sky-300/80">
              Ends {trialEndLabel}
            </span>
          )}
        </div>
      )}

      {isCurrentPlan && isPaidActive && (
        <div className="mb-1 flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 size={16} className="shrink-0" />
          Purchased · Active plan
        </div>
      )}

      {isCurrentPlan && isPaidActive ? (
        <a
          href={getBrokerSignInUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className={dashboardClass}
        >
          Open broker dashboard
          <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
        </a>
      ) : isCurrentPlan && isOnTrial ? (
        <>
          <button
            type="button"
            onClick={() => goToSubscribe(checkoutState)}
            className={primaryClass}
          >
            Subscribe now
            <ArrowRight
              size={16}
              className={`${arrowTone} transition-transform group-hover:translate-x-0.5`}
            />
          </button>
          <a
            href={getBrokerSignInUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className={demoClass}
          >
            Open broker dashboard
          </a>
        </>
      ) : isPaidActive ? (
        <button type="button" disabled className={disabledClass}>
          Subscribe
        </button>
      ) : isOnTrial ? (
        <button
          type="button"
          onClick={() => goToSubscribe(checkoutState)}
          className={primaryClass}
        >
            Switch & subscribe
          <ArrowRight
            size={16}
            className={`${arrowTone} transition-transform group-hover:translate-x-0.5`}
          />
        </button>
      ) : isAuthenticated ? (
        <>
          {canStartTrial ? (
            <button
              type="button"
              onClick={() => goToSubscribe(trialCheckoutState || { ...checkoutState, mode: "trial", addOnCodes: [] })}
              className={primaryClass}
            >
              {trialLabel}
              <ArrowRight
                size={16}
                className={`${arrowTone} transition-transform group-hover:translate-x-0.5`}
              />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => goToSubscribe(checkoutState)}
            className={canStartTrial ? buyNowClass : primaryClass}
          >
            {canStartTrial ? "Buy now" : "Subscribe"}
            <ArrowRight
              size={16}
              className={`${canStartTrial ? "" : arrowTone} transition-transform group-hover:translate-x-0.5`}
            />
          </button>
        </>
      ) : (
        <>
          <Link
            to="/signup"
            state={trialCheckoutState || { ...checkoutState, mode: "trial", addOnCodes: [] }}
            className={primaryClass}
          >
            {trialLabel}
            <ArrowRight
              size={16}
              className={`${arrowTone} transition-transform group-hover:translate-x-0.5`}
            />
          </Link>
          <Link to="/signup" state={checkoutState} className={buyNowClass}>
            Buy now
            <ArrowRight size={16} className="opacity-80" />
          </Link>
        </>
      )}

      {!isAuthenticated && (
        <Link to="/book-demo" state={demoState} className={demoClass}>
          Book Demo
        </Link>
      )}
    </div>
  );
}
