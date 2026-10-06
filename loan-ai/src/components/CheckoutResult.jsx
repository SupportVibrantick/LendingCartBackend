import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  Home,
  RefreshCw,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import {
  fetchBrokerSetupLink,
  syncLoanAiCheckout,
} from "../lib/loanAiAuth";
import { getCheckoutUserMessage } from "../lib/checkoutErrors";
import { getBrokerSignInUrl } from "../lib/brokerAuth";
import {
  clearStoredCheckoutUrl,
  getStoredCheckoutId,
  getStoredCheckoutUrl,
  openCheckoutInNewTab,
} from "../lib/startPlanCheckout";

const STATUS = {
  success: "success",
  pending: "pending",
  cancelled: "cancelled",
  failed: "failed",
};

const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:from-blue-400 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-60";

const secondaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20 dark:bg-white/5 dark:text-white dark:hover:bg-white/10";

const headingClass =
  "mt-5 text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white";
const bodyClass =
  "mt-3 text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-300";
const tipClass = "mt-6 text-xs text-slate-500 dark:text-slate-400";
const infoBoxClass =
  "mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300";
const infoTitleClass = "font-semibold text-slate-900 dark:text-white";
const infoMutedClass = "mt-1 text-slate-600 dark:text-slate-400";
const warnBoxClass =
  "mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-left text-sm font-medium text-amber-950 dark:border-amber-400/40 dark:bg-amber-500/15 dark:text-amber-100";

function ResultShell({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-16 text-slate-900 transition-colors dark:bg-[#0b1020] dark:text-white">
      {/* Solid dark:bg so it replaces bg-white (gradients alone leave the white fill). */}
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-900/10 sm:p-10 dark:border-white/10 dark:bg-[#12182a] dark:shadow-2xl dark:shadow-black/40">
        {children}
      </div>
    </div>
  );
}

function IconBubble({ children, tone }) {
  const tones = {
    green:
      "bg-emerald-100 text-emerald-600 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/30",
    amber:
      "bg-amber-100 text-amber-600 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/30",
    red: "bg-red-100 text-red-600 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/30",
  };
  return (
    <div
      className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ring-1 ${tones[tone] || tones.green}`}
    >
      {children}
    </div>
  );
}

function normalizeStatus(value) {
  const raw = String(value || "").toLowerCase();
  if (
    raw === "success" ||
    raw === "pending" ||
    raw === "cancelled" ||
    raw === "failed"
  ) {
    return raw;
  }
  return "success";
}

/**
 * Post-payment landing page (Loan AI).
 * Stripe Checkout redirects here with session_id; GHL may keep the user pending
 * while they pay in a new tab. We poll/sync until the subscription activates.
 */
export default function CheckoutResult() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    isAuthenticated,
    token,
    refreshUserAndVerifySubscription,
    loading: authLoading,
  } = useAuth();

  const status = normalizeStatus(
    searchParams.get("status") || searchParams.get("checkout"),
  );

  const [verifying, setVerifying] = useState(
    status === STATUS.success || status === STATUS.pending,
  );
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [packageCode, setPackageCode] = useState(null);
  const [checkoutUrl, setCheckoutUrl] = useState(() => getStoredCheckoutUrl());
  const [syncing, setSyncing] = useState(false);
  const [openingSetup, setOpeningSetup] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(
    () =>
      searchParams.get("popup") === "blocked" ||
      searchParams.has("popup-blocked"),
  );

  const brokerSignInUrl = getBrokerSignInUrl();

  const markActiveAndNavigate = useCallback(
    (updated) => {
      setSubscriptionActive(true);
      setPackageCode(updated?.subscribedPackageCode || null);
      setVerifying(false);
      clearStoredCheckoutUrl();
      toast.success(
        `Payment successful! Your ${updated?.subscribedPackageCode || "plan"} is active.`,
      );
      if (status === STATUS.pending) {
        navigate("/checkout/success?status=success", { replace: true });
      }
    },
    [navigate, status],
  );

  const syncPaymentFromProvider = useCallback(async () => {
    if (!token || !isAuthenticated) return null;
    try {
      const checkoutId = getStoredCheckoutId();
      const sessionId =
        searchParams.get("session_id") ||
        searchParams.get("sessionId") ||
        undefined;
      const result = await syncLoanAiCheckout(
        token,
        checkoutId || undefined,
        sessionId || undefined,
      );
      return result;
    } catch (err) {
      console.warn("[CheckoutResult] sync failed:", err);
      throw err;
    }
  }, [token, isAuthenticated, searchParams]);

  const verifySubscription = useCallback(async () => {
    if (
      (status !== STATUS.success && status !== STATUS.pending) ||
      !isAuthenticated
    ) {
      setVerifying(false);
      return;
    }

    setVerifying(true);
    let attempt = 0;
    const maxAttempts = status === STATUS.pending ? 24 : 8;

    while (attempt < maxAttempts) {
      // Local/dev: webhooks often never arrive — poll Stripe/GHL via sync.
      // Stripe success redirects include session_id; sync immediately on first attempt.
      const shouldSync =
        (status === STATUS.success && attempt === 0) ||
        (status === STATUS.pending && attempt > 0 && attempt % 2 === 0);
      if (shouldSync) {
        try {
          const synced = await syncPaymentFromProvider();
          if (synced?.alreadyPaid || synced?.paymentStatus === "PAID") {
            const updated = await refreshUserAndVerifySubscription?.();
            if (updated?.hasBrokerSubscription) {
              markActiveAndNavigate(updated);
              return;
            }
          }
        } catch {
          // keep polling user subscription
        }
      }

      try {
        const updated = await refreshUserAndVerifySubscription?.();
        if (updated?.hasBrokerSubscription) {
          markActiveAndNavigate(updated);
          return;
        }
      } catch (err) {
        console.warn("[CheckoutResult] verify failed:", err);
      }
      attempt += 1;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 2500));
      }
    }

    setVerifying(false);
  }, [
    status,
    isAuthenticated,
    refreshUserAndVerifySubscription,
    syncPaymentFromProvider,
    markActiveAndNavigate,
  ]);

  useEffect(() => {
    if (authLoading) return;
    if (status === STATUS.success || status === STATUS.pending) {
      sessionStorage.setItem("loan_ai_checkout_handled", "true");
      void verifySubscription();
    }
  }, [authLoading, status, verifySubscription]);

  const reopenPayment = () => {
    const url = checkoutUrl || getStoredCheckoutUrl();
    if (!url) {
      toast.error("Payment link expired. Please start checkout again from pricing.");
      navigate({ pathname: "/", hash: "#pricing" });
      return;
    }
    setCheckoutUrl(url);
    const { opened } = openCheckoutInNewTab(url);
    setPopupBlocked(!opened);
    if (!opened) {
      toast.error("Popup blocked — use the button below or allow popups.");
    }
  };

  const handleAlreadyPaid = async () => {
    if (syncing) return;
    setSyncing(true);
    setVerifying(true);
    try {
      const synced = await syncPaymentFromProvider();
      if (synced?.alreadyPaid || synced?.paymentStatus === "PAID") {
        const updated = await refreshUserAndVerifySubscription?.();
        if (updated?.hasBrokerSubscription) {
          markActiveAndNavigate(updated);
          return;
        }
        toast.success("Payment confirmed. Finishing activation…");
        await verifySubscription();
        return;
      }
      toast(
        synced?.message ||
          "Payment not confirmed yet. Wait a few seconds and try again.",
      );
      setVerifying(false);
    } catch (err) {
      toast.error(getCheckoutUserMessage(err));
      setVerifying(false);
    } finally {
      setSyncing(false);
    }
  };

  const openBrokerPasswordSetup = async () => {
    if (openingSetup) return;

    if (!isAuthenticated || !token) {
      navigate("/login", {
        state: { redirectTo: "/checkout/success?status=success" },
      });
      return;
    }

    setOpeningSetup(true);
    try {
      const json = await fetchBrokerSetupLink(token);
      const url =
        json?.data?.setPasswordUrl ||
        json?.setPasswordUrl ||
        null;
      if (!url) {
        throw new Error("Password setup link was not returned");
      }
      window.location.href = url;
    } catch (err) {
      toast.error(
        err?.message ||
          "Could not open password setup. Try again in a moment.",
      );
      // Fallback: broker sign-in if setup link fails
      window.open(brokerSignInUrl, "_blank", "noopener,noreferrer");
      setOpeningSetup(false);
    }
  };

  if (status === STATUS.cancelled) {
    return (
      <ResultShell>
        <IconBubble tone="amber">
          <XCircle className="h-10 w-10" />
        </IconBubble>
        <h1 className={headingClass}>
          Checkout cancelled
        </h1>
        <p className={bodyClass}>
          No payment was completed. You can pick a plan again whenever you are
          ready — your Loan AI account is unchanged.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link to={{ pathname: "/", hash: "#pricing" }} className={primaryBtn}>
            Back to pricing
          </Link>
          <Link to="/" className={secondaryBtn}>
            <Home className="h-4 w-4" />
            Go home
          </Link>
        </div>
      </ResultShell>
    );
  }

  if (status === STATUS.failed) {
    return (
      <ResultShell>
        <IconBubble tone="red">
          <XCircle className="h-10 w-10" />
        </IconBubble>
        <h1 className={headingClass}>
          Payment did not complete
        </h1>
        <p className={bodyClass}>
          Something went wrong during checkout. If you were charged, contact
          support with your email and we will help activate your plan.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link to={{ pathname: "/", hash: "#pricing" }} className={primaryBtn}>
            Try again
          </Link>
          <Link to="/" className={secondaryBtn}>
            <Home className="h-4 w-4" />
            Go home
          </Link>
        </div>
      </ResultShell>
    );
  }

  if (status === STATUS.pending && !subscriptionActive) {
    return (
      <ResultShell>
        <IconBubble tone="amber">
          <Clock3 className="h-10 w-10 animate-pulse" />
        </IconBubble>
        <h1 className={headingClass}>
          Complete your payment
        </h1>
        <p className={bodyClass}>
          A secure payment tab should have opened. Finish paying there — this
          page updates automatically when payment succeeds. You do not need to
          come back from the invoice page manually.
        </p>

        {popupBlocked ? (
          <div className={warnBoxClass}>
            Your browser blocked the payment popup. Click{" "}
            <strong>Open payment page</strong> below to continue.
          </div>
        ) : null}

        <div className={infoBoxClass}>
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 h-5 w-5 shrink-0 animate-pulse text-blue-600 dark:text-blue-300" />
            <div>
              <p className={infoTitleClass}>
                {verifying
                  ? "Waiting for payment confirmation…"
                  : "Still waiting for payment"}
              </p>
              <p className={infoMutedClass}>
                After you see{" "}
                <strong className="text-slate-800 dark:text-slate-200">
                  PAID
                </strong>{" "}
                on the invoice, you can close that tab. Keep this page open.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button type="button" className={primaryBtn} onClick={reopenPayment}>
            <ExternalLink className="h-4 w-4" />
            Open payment page
          </button>
          <button
            type="button"
            className={secondaryBtn}
            disabled={syncing}
            onClick={() => void handleAlreadyPaid()}
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Confirming payment…" : "I already paid — refresh"}
          </button>
        </div>

        {!isAuthenticated ? (
          <button
            type="button"
            className={`${secondaryBtn} mt-3 w-full sm:w-auto`}
            onClick={() =>
              navigate("/login", {
                state: { redirectTo: "/checkout/pending?status=pending" },
              })
            }
          >
            Sign in to verify
          </button>
        ) : null}

        <p className={tipClass}>
          Tip: leave this tab open. Closing the invoice tab after payment is
          fine.
        </p>
      </ResultShell>
    );
  }

  // success (or pending that already activated)
  return (
    <ResultShell>
      <IconBubble tone="green">
        <CheckCircle2 className="h-10 w-10" />
      </IconBubble>
      <h1 className={headingClass}>
        Payment successful
      </h1>
      <p className={bodyClass}>
        Thank you. Your Pro/Elite subscription is being activated
        {packageCode ? ` (${packageCode} plan)` : ""}. Next, set your broker
        password to open the dashboard.
      </p>

      <div className={infoBoxClass}>
        {verifying ? (
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 h-5 w-5 shrink-0 animate-pulse text-blue-600 dark:text-blue-300" />
            <div>
              <p className={infoTitleClass}>Confirming activation…</p>
              <p className={infoMutedClass}>
                This usually takes a few seconds after payment. You can leave
                this page — we will also email you.
              </p>
            </div>
          </div>
        ) : subscriptionActive ? (
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
            <div>
              <p className={infoTitleClass}>Subscription active</p>
              <p className={infoMutedClass}>
                Your broker account is ready. Set your password to open the
                dashboard.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
            <div>
              <p className={infoTitleClass}>Almost there</p>
              <p className={infoMutedClass}>
                Activation can take a minute after payment. Use the email link
                we sent, or refresh this page shortly.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          className={primaryBtn}
          disabled={openingSetup}
          onClick={() => void openBrokerPasswordSetup()}
        >
          <ExternalLink className="h-4 w-4" />
          {openingSetup
            ? "Opening password setup…"
            : "Set password & open dashboard"}
        </button>
        {!isAuthenticated ? (
          <button
            type="button"
            className={secondaryBtn}
            onClick={() =>
              navigate("/login", {
                state: { redirectTo: "/checkout/success?status=success" },
              })
            }
          >
            Sign in to verify
          </button>
        ) : (
          <Link to="/" className={secondaryBtn}>
            <Home className="h-4 w-4" />
            Back to Loan AI
          </Link>
        )}
      </div>

      <p className={tipClass}>
        Next you will set your broker password, then sign in. You can safely
        close the payment invoice tab.
      </p>
    </ResultShell>
  );
}

