import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getBrokerToken } from "../../lib/brokerSession";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const DISMISS_KEY = "clm_trial_completed_banner_dismissed";

type SubscriptionStatus = {
  hasSubscription: boolean;
  isClmSoftTrial: boolean;
  canDiscontinue: boolean;
  showTrialCompletedAlert: boolean;
  packageName?: string | null;
  planPriceLabel?: string;
  subscribeUrl?: string;
  status?: string;
};

function isBrokerAdmin(): boolean {
  try {
    const roles = JSON.parse(sessionStorage.getItem("roles") || "[]");
    return Array.isArray(roles) && roles.includes("BROKER_ADMIN");
  } catch {
    return false;
  }
}

export default function ClmTrialBanner() {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    const token = getBrokerToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/broker/subscription/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json?.success && json.data) {
        setStatus(json.data as SubscriptionStatus);
      }
    } catch {
      /* non-blocking */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!status?.showTrialCompletedAlert || dismissed) {
    return null;
  }

  const price = status.planPriceLabel || "$699/month";
  const admin = isBrokerAdmin();

  const onDismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  const onDiscontinue = async () => {
    const token = getBrokerToken();
    if (!token) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/broker/subscription/discontinue`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Failed to discontinue");
      }
      toast.success(
        "Loan Automation discontinued. Subscribe again to restore access.",
      );
      setConfirmOpen(false);
      const url = status.subscribeUrl;
      if (url) {
        window.location.href = url;
      } else {
        window.location.reload();
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to discontinue",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              Your free Loan Automation trial is complete
            </p>
            <p className="mt-1 text-sm opacity-90">
              Your account stays open. Ongoing billing is{" "}
              <strong>{price}</strong> on the card from your Commercial Lending
              Mastery order. Use Discontinue only if you want to stop billing and
              end access — you will need a new subscription to continue later.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {admin ? (
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={busy}
                className="rounded-md border border-amber-700/40 bg-white px-3 py-1.5 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-400/40 dark:bg-transparent dark:text-amber-50 dark:hover:bg-amber-500/20"
              >
                Discontinue
              </button>
            ) : (
              <span className="text-xs opacity-80">
                Ask your broker admin to discontinue if needed.
              </span>
            )}
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-md px-2 py-1.5 text-sm text-amber-800/80 hover:underline dark:text-amber-200/80"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>

      {confirmOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900 dark:text-gray-100">
            <h3 className="text-lg font-semibold">Discontinue Loan Automation?</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              This stops software access and requests cancellation of the{" "}
              {price} charge on your CLM order. To use Loan Automation again you
              must purchase a subscription.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmOpen(false)}
                className="rounded-md px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Keep access
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onDiscontinue()}
                className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {busy ? "Discontinuing…" : "Yes, discontinue"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
