import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Check,
  CreditCard,
  Loader2,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import PageMeta from "../../components/common/PageMeta";
import StatPill from "../../components/common/StatPill";
import { brokerFetch } from "../../lib/brokerApi";

type PurchasedAddOn = {
  code: string;
  name: string;
  priceMonthly: number;
  quantity: number;
};

type AvailableAddOn = {
  code: string;
  name: string;
  priceMonthly: number;
  note?: string | null;
  description?: string | null;
};

type AddOnsPayload = {
  subscriptionId: string;
  status: string;
  packageCode: string | null;
  packageName: string | null;
  billingCycle: "MONTHLY" | "YEARLY" | string;
  currentPeriodEnd?: string;
  trialEndsAt?: string | null;
  remainingTrialDays?: number;
  canPurchaseAddOns?: boolean;
  purchasedAddOns: PurchasedAddOn[];
  ownedAddOnCodes: string[];
  availableAddOns: AvailableAddOn[];
  paymentProvider?: "stripe" | "ghl" | null;
  extraUser: {
    currentQuantity: number;
    unitPriceMonthly: number | null;
    code: string;
    name: string;
    description?: string | null;
  };
};

const ADDON_BLURBS: Record<string, string> = {
  CRE_PACK: "Unlock CRE & Multifamily loan categories for your pipeline.",
  FEE_AGREEMENT_PACK: "Create fee agreements, term sheets, and LOIs.",
  BUSINESS_LENDING_PACK: "Enable SBA, USDA, and Asset-Based Lending products.",
  LENDER_MARKETPLACE_PACK: "Match deals and add your own lender network.",
  GHL_STARTER: "GoHighLevel CRM starter suite for your brokerage.",
  GHL_GROWTH: "GoHighLevel Growth automation and marketing tools.",
  GHL_BASIC_SYNC: "GoHighLevel Growth automation and marketing tools.",
  WHITE_LABEL: "White-label branding across your broker portal.",
};

function formatMoney(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `$${Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function statusTone(status: string) {
  const s = String(status || "").toUpperCase();
  if (s === "TRIAL")
    return "bg-amber-50 text-amber-800 ring-amber-200";
  if (s === "ACTIVE")
    return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (s === "PAST_DUE")
    return "bg-rose-50 text-rose-800 ring-rose-200";
  return "bg-slate-50 text-slate-700 ring-slate-200";
}

export default function PlanAddOns() {
  const [data, setData] = useState<AddOnsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [extraUserTotal, setExtraUserTotal] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = await brokerFetch<{ success: boolean; data: AddOnsPayload }>(
        "/broker/subscription/addons",
      );
      if (!json?.success || !json.data) {
        throw new Error("Failed to load plan add-ons");
      }
      setData(json.data);
      setExtraUserTotal(json.data.extraUser?.currentQuantity || 0);
      setSelected(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load add-ons");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const addons = params.get("addons");
    if (addons === "paid") {
      toast.success(
        "Payment received. Your add-ons unlock once Stripe confirms (usually a few seconds).",
      );
      void load();
      window.history.replaceState({}, "", "/settings/plan");
    } else if (addons === "cancelled") {
      toast("Checkout cancelled — no charges were made.", { icon: "ℹ️" });
      window.history.replaceState({}, "", "/settings/plan");
    }
  }, [load]);

  const isYearly = data?.billingCycle === "YEARLY";
  const periodSuffix = isYearly ? "/yr" : "/mo";
  const priceLabel = isYearly ? "billed yearly" : "billed monthly";
  const isOnTrial = String(data?.status || "").toUpperCase() === "TRIAL";
  const trialDaysLeft = Math.max(0, Number(data?.remainingTrialDays) || 0);
  const trialEndLabel = data?.trialEndsAt
    ? new Date(data.trialEndsAt).toLocaleDateString()
    : null;

  const seatDelta = Math.max(
    0,
    extraUserTotal - (data?.extraUser.currentQuantity || 0),
  );

  const lineItems = useMemo(() => {
    if (!data) return [];
    const items: {
      code: string;
      name: string;
      amount: number;
      detail?: string;
    }[] = [];
    for (const code of selected) {
      const item = data.availableAddOns.find((a) => a.code === code);
      if (!item) continue;
      const unit = Number(item.priceMonthly) || 0;
      items.push({
        code,
        name: item.name,
        amount: isYearly ? unit * 12 : unit,
        detail: isYearly
          ? `${formatMoney(unit)}/mo × 12`
          : `${formatMoney(unit)}/mo`,
      });
    }
    if (seatDelta > 0) {
      const unit = Number(data.extraUser.unitPriceMonthly) || 0;
      items.push({
        code: "EXTRA_USER",
        name: `${data.extraUser.name} × ${seatDelta}`,
        amount: seatDelta * (isYearly ? unit * 12 : unit),
        detail: `${formatMoney(unit)}/seat${isYearly ? " × 12" : ""}`,
      });
    }
    return items;
  }, [data, selected, seatDelta, isYearly]);

  const estimated = useMemo(
    () => lineItems.reduce((sum, row) => sum + row.amount, 0),
    [lineItems],
  );
  const dueTodayAmount = isOnTrial && trialDaysLeft > 0 ? 0 : estimated;

  const hasDelta = lineItems.length > 0;

  function toggleAddOn(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function handleCheckout() {
    if (!data || !hasDelta) {
      toast.error("Select an add-on or increase team seats first");
      return;
    }
    if (!data.paymentProvider) {
      toast.error("Payments are not configured yet. Contact support.");
      return;
    }
    setSubmitting(true);
    try {
      const origin = window.location.origin;
      const json = await brokerFetch<{
        success: boolean;
        data?: { checkoutUrl?: string; provider?: string };
        message?: string;
      }>("/broker/subscription/addons/checkout", {
        method: "POST",
        body: JSON.stringify({
          addOnCodes: [...selected],
          extraUserTotal,
          successUrl: `${origin}/settings/plan?addons=paid`,
          cancelUrl: `${origin}/settings/plan?addons=cancelled`,
        }),
      });
      if (!json?.success || !json.data?.checkoutUrl) {
        throw new Error(json?.message || "Checkout failed");
      }
      window.location.href = json.data.checkoutUrl;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed");
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageMeta
        title="Plan & Add-ons | Broker"
        description="Manage subscription add-ons and additional users"
      />

      <div className="w-full min-w-0 space-y-4 pb-4 text-text-primary">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="ds-page-title">Plan & Add-ons</h1>
            <p className="ds-page-subtitle">
              Manage your subscription, team seats, and paid upgrades.
            </p>
          </div>
          <nav className="shrink-0 text-[12px] text-text-secondary">
            <ol className="flex items-center gap-1.5">
              <li>
                <Link to="/" className="hover:text-[#4C78F5]">
                  Home
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="font-medium text-text-primary">Plan & Add-ons</li>
            </ol>
          </nav>
        </div>

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center rounded-2xl border border-border bg-white">
            <div className="inline-flex items-center gap-2 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin text-[#4C78F5]" />
              Loading your plan…
            </div>
          </div>
        ) : !data ? (
          <div className="rounded-2xl border border-dashed border-border bg-white px-6 py-14 text-center">
            <p className="text-sm text-text-secondary">
              No active subscription found for this organization.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              <StatPill
                icon={<Sparkles size={14} />}
                label="Plan"
                value={data.packageName || data.packageCode || "—"}
                color="blue"
              />
              <StatPill
                icon={<ShieldCheck size={14} />}
                label="Status"
                value={data.status}
                color={
                  String(data.status).toUpperCase() === "ACTIVE"
                    ? "emerald"
                    : String(data.status).toUpperCase() === "TRIAL"
                      ? "amber"
                      : "rose"
                }
              />
              <StatPill
                icon={<Users size={14} />}
                label="Team seats"
                value={extraUserTotal}
                color="slate"
              />
              <StatPill
                icon={<CreditCard size={14} />}
                label="Checkout"
                value={lineItems.length}
                color={hasDelta ? "amber" : "slate"}
              />
            </div>

            {isOnTrial ? (
              <div className="rounded-xl border border-[#4C78F5]/20 bg-[#4C78F5]/5 px-4 py-3.5 text-sm text-text-primary">
                <p className="font-semibold text-[#2F5AD0]">
                  Free trial active
                  {trialDaysLeft > 0
                    ? ` · ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left`
                    : ""}
                  {trialEndLabel ? ` (ends ${trialEndLabel})` : ""}
                </p>
                <p className="mt-1 text-[13px] text-text-secondary">
                  You can purchase add-ons and team seats during your trial.
                  {data.paymentProvider === "stripe"
                    ? " Stripe will keep new add-ons at $0 until your trial ends, then bill them with your plan."
                    : " Complete checkout to unlock them on your brokerage."}
                  {data.availableAddOns.length === 0
                    ? " Your current plan already includes all feature upgrades — you can still add seats below."
                    : ""}
                </p>
              </div>
            ) : null}

            <div className="grid w-full gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-w-0 space-y-4">
                {/* Current plan */}
                <section className="overflow-hidden rounded-2xl border border-border bg-white">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                        Current plan
                      </p>
                      <h2 className="mt-1 text-xl font-semibold tracking-tight text-text-primary">
                        {data.packageName || data.packageCode || "Plan"}
                      </h2>
                      <p className="mt-1 text-[13px] text-text-secondary">
                        {isOnTrial
                          ? `Free trial${trialDaysLeft > 0 ? ` · ${trialDaysLeft} days left` : ""}`
                          : priceLabel}
                        {!isOnTrial && data.currentPeriodEnd
                          ? ` · renews ${new Date(data.currentPeriodEnd).toLocaleDateString()}`
                          : ""}
                        {isOnTrial && trialEndLabel
                          ? ` · ends ${trialEndLabel}`
                          : ""}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${statusTone(data.status)}`}
                    >
                      {data.status}
                    </span>
                  </div>

                  <div className="px-4 py-4 sm:px-5">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-primary">
                      <Sparkles className="h-4 w-4 text-[#4C78F5]" />
                      Included / unlocked add-ons
                    </div>
                    {data.purchasedAddOns.length === 0 ? (
                      <p className="text-[13px] text-text-secondary">
                        {data.availableAddOns.length === 0
                          ? "Your current plan already includes the full upgrade set. You can still add team seats below."
                          : "No paid add-ons yet. Pick upgrades below to expand your plan."}
                      </p>
                    ) : (
                      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {data.purchasedAddOns.map((item) => (
                          <li
                            key={`${item.code}-${item.quantity}`}
                            className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] font-medium text-emerald-800"
                          >
                            <Check className="h-4 w-4 shrink-0" />
                            <span>
                              {item.name}
                              {item.quantity > 1
                                ? ` × ${item.quantity}`
                                : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>

                {/* Seats */}
                <section className="overflow-hidden rounded-2xl border border-border bg-white">
                  <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-4 sm:px-5">
                    <div className="min-w-0 max-w-xl">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#4C78F5]/10 text-[#4C78F5]">
                          <Users className="h-4 w-4" />
                        </span>
                        <h3 className="text-sm font-semibold text-text-primary">
                          Team seats
                        </h3>
                      </div>
                      <p className="mt-2 text-[13px] text-text-secondary">
                        {data.extraUser.description ||
                          "Add loan officer or co-broker seats. You can only increase seats here."}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-text-primary">
                        {formatMoney(data.extraUser.unitPriceMonthly)}
                        <span className="font-medium text-text-secondary">
                          /mo per seat
                        </span>
                        {isYearly ? (
                          <span className="ml-1 text-[12px] font-normal text-text-secondary">
                            ({formatMoney(
                              (Number(data.extraUser.unitPriceMonthly) || 0) *
                                12,
                            )}
                            /yr at checkout)
                          </span>
                        ) : null}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-white px-2.5 py-2">
                      <button
                        type="button"
                        aria-label="Decrease seats"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-secondary transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={
                          extraUserTotal <=
                          (data.extraUser.currentQuantity || 0)
                        }
                        onClick={() =>
                          setExtraUserTotal((n) =>
                            Math.max(
                              data.extraUser.currentQuantity || 0,
                              n - 1,
                            ),
                          )
                        }
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <div className="min-w-14 text-center">
                        <div className="text-xl font-bold tabular-nums text-text-primary">
                          {extraUserTotal}
                        </div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                          seats
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label="Increase seats"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-secondary transition hover:border-[#4C78F5]/30 hover:bg-[#4C78F5]/5 hover:text-[#4C78F5]"
                        onClick={() => setExtraUserTotal((n) => n + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {seatDelta > 0 ? (
                    <div className="border-t border-border px-4 py-3 sm:px-5">
                      <p className="rounded-xl border border-[#4C78F5]/20 bg-[#4C78F5]/5 px-3 py-2 text-[13px] font-medium text-[#2F5AD0]">
                        Adding {seatDelta} new seat
                        {seatDelta === 1 ? "" : "s"} — charged at checkout.
                      </p>
                    </div>
                  ) : null}
                </section>

                {/* Available add-ons */}
                <section className="overflow-hidden rounded-2xl border border-border bg-white">
                  <div className="border-b border-border px-4 py-3.5 sm:px-5">
                    <h3 className="text-sm font-semibold text-text-primary">
                      Available upgrades
                    </h3>
                    <p className="mt-0.5 text-[13px] text-text-secondary">
                      Select what you need. You&apos;ll pay securely
                      {data.paymentProvider === "stripe"
                        ? " with Stripe"
                        : data.paymentProvider === "ghl"
                          ? " via invoice"
                          : ""}
                      .
                    </p>
                  </div>

                  <div className="p-4 sm:p-5">
                    {data.availableAddOns.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[13px] text-text-secondary">
                        Everything available for your plan is already included
                        or owned.
                      </p>
                    ) : (
                      <ul className="grid gap-2.5 md:grid-cols-2">
                        {data.availableAddOns.map((item) => {
                          const checked = selected.has(item.code);
                          const blurb =
                            item.description ||
                            ADDON_BLURBS[item.code] ||
                            "Expand your brokerage toolkit.";
                          const unit = Number(item.priceMonthly) || 0;
                          return (
                            <li key={item.code}>
                              <button
                                type="button"
                                onClick={() => toggleAddOn(item.code)}
                                className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-3.5 text-left transition ${
                                  checked
                                    ? "border-[#4C78F5] bg-[#4C78F5]/5 ring-1 ring-[#4C78F5]/20"
                                    : "border-border bg-white hover:border-[#4C78F5]/30 hover:bg-surface"
                                }`}
                              >
                                <span
                                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                                    checked
                                      ? "border-[#4C78F5] bg-[#4C78F5] text-white"
                                      : "border-border bg-white"
                                  }`}
                                >
                                  {checked ? (
                                    <Check className="h-3.5 w-3.5" />
                                  ) : null}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="flex flex-wrap items-start justify-between gap-2">
                                    <span className="font-semibold text-text-primary">
                                      {item.name}
                                    </span>
                                    <span className="text-sm font-semibold tabular-nums text-text-primary">
                                      {formatMoney(unit)}
                                      <span className="font-medium text-text-secondary">
                                        /mo
                                      </span>
                                      {isYearly ? (
                                        <span className="ml-1 text-xs font-normal text-text-secondary">
                                          ({formatMoney(unit * 12)}
                                          {periodSuffix})
                                        </span>
                                      ) : null}
                                    </span>
                                  </span>
                                  <span className="mt-1 block text-[13px] text-text-secondary">
                                    {blurb}
                                  </span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </section>
              </div>

              {/* Checkout summary */}
              <aside className="min-w-0 xl:sticky xl:top-20 xl:self-start">
                <div className="overflow-hidden rounded-2xl border border-border bg-white">
                  <div className="flex items-center gap-2 border-b border-border px-4 py-3.5 sm:px-5">
                    <CreditCard className="h-4 w-4 text-[#4C78F5]" />
                    <h3 className="text-sm font-semibold text-text-primary">
                      Order summary
                    </h3>
                  </div>

                  <div className="px-4 py-4 sm:px-5">
                    {lineItems.length === 0 ? (
                      <p className="text-[13px] text-text-secondary">
                        Select upgrades or seats to see your total.
                      </p>
                    ) : (
                      <ul className="space-y-3 border-b border-border pb-4">
                        {lineItems.map((row) => (
                          <li
                            key={row.code}
                            className="flex items-start justify-between gap-3 text-sm"
                          >
                            <div className="min-w-0">
                              <div className="font-medium text-text-primary">
                                {row.name}
                              </div>
                              {row.detail ? (
                                <div className="text-xs text-text-secondary">
                                  {row.detail}
                                </div>
                              ) : null}
                            </div>
                            <div className="shrink-0 font-semibold tabular-nums text-text-primary">
                              {formatMoney(row.amount)}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                        Due today
                      </p>
                      <p className="mt-1 text-2xl font-bold tabular-nums text-text-primary">
                        {formatMoney(dueTodayAmount)}
                        <span className="ml-1 text-sm font-medium text-text-secondary">
                          {periodSuffix}
                        </span>
                      </p>
                      {isOnTrial && trialDaysLeft > 0 && hasDelta ? (
                        <p className="mt-1 text-xs font-medium text-[#2F5AD0]">
                          Then {formatMoney(estimated)}
                          {periodSuffix} after trial
                        </p>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      disabled={
                        !hasDelta || submitting || !data.paymentProvider
                      }
                      onClick={() => void handleCheckout()}
                      className="ds-btn-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                      {submitting
                        ? "Redirecting…"
                        : isOnTrial && trialDaysLeft > 0
                          ? data.paymentProvider === "stripe"
                            ? "Add with Stripe (trial)"
                            : "Unlock on trial"
                          : data.paymentProvider === "stripe"
                            ? "Pay with Stripe"
                            : "Pay & unlock"}
                    </button>

                    <p className="mt-3 text-center text-[11px] leading-relaxed text-text-secondary">
                      {isOnTrial
                        ? "Trial brokers can add upgrades anytime. Card is required; add-ons bill when the trial ends."
                        : data.paymentProvider === "stripe"
                          ? "Secure checkout powered by Stripe. You can use cards and saved payment methods."
                          : data.paymentProvider === "ghl"
                            ? "You will complete payment on a secure invoice page."
                            : "Payment provider is not configured for this environment."}
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    </>
  );
}
