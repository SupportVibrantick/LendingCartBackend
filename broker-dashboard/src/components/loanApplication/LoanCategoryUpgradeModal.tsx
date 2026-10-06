import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  Check,
  CreditCard,
  Loader2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import { Modal } from "../ui/modal";
import { brokerFetch } from "../../lib/brokerApi";
import { isBrokerAdmin } from "../../lib/brokerPermissions";
import {
  getLoanCategoryPlanTag,
  getUpgradeAddOnCodesForCategory,
} from "../../pages/LoanApplication/loanCategoryAccess";

type AvailableAddOn = {
  code: string;
  name: string;
  priceMonthly: number;
  note?: string | null;
  description?: string | null;
};

type AddOnsPayload = {
  subscriptionId?: string;
  status?: string | null;
  packageCode: string | null;
  packageName: string | null;
  billingCycle: "MONTHLY" | "YEARLY" | string;
  availableAddOns: AvailableAddOn[];
  paymentProvider?: "stripe" | "ghl" | null;
};

type Props = {
  isOpen: boolean;
  category: string | null;
  categoryLabel: string;
  /** Broker admin portal can purchase; LO / co-broker see contact-admin copy. */
  canPurchase: boolean;
  onClose: () => void;
};

const YEARLY_SAVE_PERCENT = 20;

const CATEGORY_UNLOCK_BULLETS: Record<string, string[]> = {
  CRE_MULTIFAMILY: [
    "CRE & Multifamily loan products",
    "Commercial deal pipeline support",
    "Keep your current Starter base plan",
  ],
  SBA_USDA: [
    "SBA & USDA loan products",
    "Also unlocks Asset-Based Lending",
    "Elite also includes CRE & Multifamily",
  ],
  ABL: [
    "Asset-Based Lending products",
    "Also unlocks SBA & USDA",
    "Elite also includes CRE & Multifamily",
  ],
};

function shortAddOnLabel(name: string) {
  // "Business Lending (SBA, USDA, ABL)" → "Business Lending"
  return String(name || "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
}

function formatMoney(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `$${Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export default function LoanCategoryUpgradeModal({
  isOpen,
  category,
  categoryLabel,
  canPurchase,
  onClose,
}: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<AddOnsPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const planTag = category ? getLoanCategoryPlanTag(category) : null;
  const preferredCodes = useMemo(
    () => (category ? getUpgradeAddOnCodesForCategory(category) : []),
    [category],
  );

  const matchingAddOn = useMemo(() => {
    if (!data?.availableAddOns?.length || !preferredCodes.length) return null;
    for (const code of preferredCodes) {
      const found = data.availableAddOns.find(
        (a) => String(a.code).toUpperCase() === code.toUpperCase(),
      );
      if (found) return found;
    }
    return null;
  }, [data, preferredCodes]);

  const isYearly = String(data?.billingCycle || "").toUpperCase() === "YEARLY";
  const billingCycleLabel = isYearly ? "Yearly" : "Monthly";
  const displayPrice = matchingAddOn
    ? isYearly
      ? Number(matchingAddOn.priceMonthly) * 12
      : Number(matchingAddOn.priceMonthly)
    : null;
  const bullets =
    (category && CATEGORY_UNLOCK_BULLETS[category]) ||
    [
      `Access ${categoryLabel} in new applications`,
      planTag ? `Included with ${planTag} or this add-on` : "Unlock with a matching add-on",
      "Secure checkout — cancel anytime from billing",
    ];

  const load = useCallback(async () => {
    if (!canPurchase) {
      setData(null);
      setLoadError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const json = await brokerFetch<{ success: boolean; data: AddOnsPayload }>(
        "/broker/subscription/addons",
      );
      if (!json?.success || !json.data) {
        throw new Error("Failed to load upgrade options");
      }
      setData(json.data);
    } catch (err) {
      setData(null);
      setLoadError(
        err instanceof Error ? err.message : "Failed to load upgrade options",
      );
    } finally {
      setLoading(false);
    }
  }, [canPurchase]);

  useEffect(() => {
    if (!isOpen || !category) return;
    void load();
  }, [isOpen, category, load]);

  async function handleCheckout() {
    if (!category || !matchingAddOn) return;
    if (!data?.paymentProvider) {
      toast.error("Payments are not configured yet. Contact support.");
      return;
    }
    setSubmitting(true);
    try {
      const origin = window.location.origin;
      const path = window.location.pathname;
      const json = await brokerFetch<{
        success: boolean;
        data?: { checkoutUrl?: string };
        message?: string;
      }>("/broker/subscription/addons/checkout", {
        method: "POST",
        body: JSON.stringify({
          addOnCodes: [matchingAddOn.code],
          successUrl: `${origin}${path}?categoryUpgrade=paid&unlock=${encodeURIComponent(category)}`,
          cancelUrl: `${origin}${path}?categoryUpgrade=cancelled`,
        }),
      });
      if (!json?.success || !json.data?.checkoutUrl) {
        throw new Error(json?.message || "Checkout failed");
      }
      const checkoutUrl = json.data.checkoutUrl;
      // Do not pass "noopener" in windowFeatures — many browsers then return null
      // even when the tab opened, which incorrectly triggers same-tab navigation.
      const checkoutTab = window.open(checkoutUrl, "_blank");
      if (checkoutTab) {
        checkoutTab.opener = null;
        toast.success(
          "Checkout opened in a new tab. Keep this page open — we’ll unlock the category after payment.",
        );
        setSubmitting(false);
        return;
      }
      toast.error(
        "Popup blocked. Allow popups for this site, then try again — or use Plan settings.",
      );
      setSubmitting(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed");
      setSubmitting(false);
    }
  }

  function goToPlanSettings() {
    onClose();
    navigate("/settings/plan");
  }

  if (!category) return null;

  const addOnShort = matchingAddOn
    ? shortAddOnLabel(matchingAddOn.name)
    : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-xl p-0 shadow-2xl sm:max-w-2xl"
      showCloseButton={!submitting}
    >
      <div className="overflow-hidden rounded-3xl">
        {/* Header */}
        <div className="relative border-b border-slate-100 bg-[#13538A] px-6 pb-5 pt-6 dark:border-slate-800">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.14),_transparent_55%)]" />
          <div className="relative pr-8">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white ring-1 ring-white/25">
                <Lock size={18} />
              </div>
              {planTag && (
                <span className="rounded-md bg-amber-400/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-950">
                  {planTag} feature
                </span>
              )}
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-white">
              Unlock {categoryLabel}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-sky-100/90">
              {planTag === "Elite"
                ? "Elite includes CRE & Multifamily, SBA & USDA, and Asset-Based Lending — or unlock business lending on your current plan."
                : planTag
                  ? `Available on ${planTag}, or add it to your current plan in one step.`
                  : "Add this category to your subscription to continue."}
            </p>
            {data?.packageName && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs text-sky-50 ring-1 ring-white/15">
                  <span className="opacity-80">You’re on</span>
                  <span className="font-semibold">{data.packageName}</span>
                </p>
                <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs text-sky-50 ring-1 ring-white/15">
                  <span className="opacity-80">Billing</span>
                  <span className="font-semibold">{billingCycleLabel}</span>
                </p>
                {data.status ? (
                  <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs text-sky-50 ring-1 ring-white/15">
                    <span className="opacity-80">Status</span>
                    <span className="font-semibold">
                      {String(data.status).replace(/_/g, " ")}
                    </span>
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          {canPurchase && !loading && !loadError && data?.billingCycle && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-xs leading-relaxed text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-100">
              Your subscription uses a{" "}
              <span className="font-semibold">{billingCycleLabel.toLowerCase()}</span>{" "}
              billing cycle. This add-on will be charged on the same{" "}
              <span className="font-semibold">{billingCycleLabel.toLowerCase()}</span>{" "}
              cycle
              {isYearly
                ? " (yearly rate with 20% savings shown below)."
                : " (monthly rate shown below)."}
            </div>
          )}

          {!canPurchase && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
              Only the <span className="font-semibold">broker admin</span> can
              purchase upgrades. Ask them to unlock{" "}
              <span className="font-semibold">{categoryLabel}</span> from{" "}
              <span className="font-semibold">Plan &amp; Add-ons</span>.
            </div>
          )}

          {canPurchase && loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-[#2C92D5]" />
              Loading upgrade options…
            </div>
          )}

          {canPurchase && !loading && loadError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
              {loadError}
            </div>
          )}

          {canPurchase && !loading && !loadError && matchingAddOn && (
            <>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Recommended add-on
                    </p>
                    <p className="mt-0.5 text-base font-semibold text-slate-900 dark:text-white">
                      {addOnShort}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      {planTag === "Elite"
                        ? "This add-on unlocks SBA, USDA & ABL on your current plan. Elite also includes CRE & Multifamily."
                        : matchingAddOn.description ||
                          matchingAddOn.note ||
                          `Unlocks ${categoryLabel} for your team.`}
                    </p>
                  </div>
                  <div className="shrink-0 rounded-xl bg-white px-3 py-2 text-right shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-600">
                    {isYearly ? (
                      <>
                        <div className="mb-1 flex justify-end">
                          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                            Save {YEARLY_SAVE_PERCENT}%
                          </span>
                        </div>
                        <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">
                          {formatMoney(matchingAddOn.priceMonthly)}
                          <span className="text-sm font-medium text-slate-400">
                            /mo
                          </span>
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {formatMoney(displayPrice)}/yr billed yearly
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">
                          {formatMoney(displayPrice)}
                          <span className="text-sm font-medium text-slate-400">
                            /mo
                          </span>
                        </p>
                        <p className="text-[11px] text-slate-500">billed monthly</p>
                      </>
                    )}
                  </div>
                </div>

                <ul className="mt-4 space-y-2 border-t border-slate-200/80 pt-3.5 dark:border-slate-600/60">
                  {bullets.map((line) => (
                    <li
                      key={line}
                      className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300"
                    >
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                        <Check size={10} strokeWidth={3} />
                      </span>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={() => void handleCheckout()}
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2C92D5] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#247bb4] disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                {submitting ? "Opening checkout…" : "Continue to checkout"}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                Secure payment
                {data?.paymentProvider === "stripe"
                  ? " via Stripe"
                  : data?.paymentProvider === "ghl"
                    ? " via invoice"
                    : ""}
                . Opens in a new tab — keep this page open.
              </div>
            </>
          )}

          {canPurchase && !loading && !loadError && !matchingAddOn && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
              No matching add-on is available for checkout on your current plan.
              Review all options in Plan &amp; Add-ons
              {planTag ? ` (including ${planTag})` : ""}.
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="text-sm font-medium text-slate-500 transition hover:text-slate-800 disabled:opacity-50 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Not now
            </button>
            {canPurchase && (
              <button
                type="button"
                onClick={goToPlanSettings}
                disabled={submitting}
                className="text-sm font-medium text-[#2C92D5] transition hover:text-[#247bb4] disabled:opacity-50"
              >
                View all plan options →
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** Broker admin on the main broker portal can start add-on checkout. */
export function canPurchaseCategoryUpgrade(
  portal: "broker" | "loanOfficer" | "coBroker",
  publicEmbed?: boolean,
): boolean {
  if (publicEmbed) return false;
  if (portal !== "broker") return false;
  return isBrokerAdmin("broker");
}
