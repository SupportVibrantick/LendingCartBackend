import { useCallback, useEffect, useMemo, useState } from "react";
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
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
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
  if (s === "TRIAL") return "bg-amber-50 text-amber-800 ring-amber-200";
  if (s === "ACTIVE") return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (s === "PAST_DUE") return "bg-rose-50 text-rose-800 ring-rose-200";
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

  const seatDelta = Math.max(
    0,
    extraUserTotal - (data?.extraUser.currentQuantity || 0),
  );

  const lineItems = useMemo(() => {
    if (!data) return [];
    const items: { code: string; name: string; amount: number; detail?: string }[] =
      [];
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
      <PageBreadcrumb pageTitle="Plan & Add-ons" />

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading your plan…
          </div>
        </div>
      ) : !data ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            No active subscription found for this organization.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            {/* Current plan */}
            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="bg-gradient-to-br from-[#13538A] via-[#1a6bab] to-[#2C92D5] px-6 py-6 text-white">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
                      Current plan
                    </p>
                    <h2 className="mt-1 text-2xl font-bold tracking-tight">
                      {data.packageName || data.packageCode || "Plan"}
                    </h2>
                    <p className="mt-1 text-sm text-white/80">
                      {priceLabel}
                      {data.currentPeriodEnd
                        ? ` · renews ${new Date(data.currentPeriodEnd).toLocaleDateString()}`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${statusTone(data.status)}`}
                  >
                    {data.status}
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-100 px-6 py-5 dark:border-gray-800">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                  <Sparkles className="h-4 w-4 text-[#2C92D5]" />
                  Included / unlocked add-ons
                </div>
                {data.purchasedAddOns.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No paid add-ons yet. Pick upgrades below to expand your plan.
                  </p>
                ) : (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {data.purchasedAddOns.map((item) => (
                      <li
                        key={`${item.code}-${item.quantity}`}
                        className="flex items-center gap-2 rounded-xl bg-emerald-50/80 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200"
                      >
                        <Check className="h-4 w-4 shrink-0" />
                        <span className="font-medium">
                          {item.name}
                          {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* Seats */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-md">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-[#13538A] dark:bg-sky-500/10">
                      <Users className="h-4 w-4" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                      Team seats
                    </h3>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    {data.extraUser.description ||
                      "Add loan officer or co-broker seats. You can only increase seats here."}
                  </p>
                  <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                    {formatMoney(data.extraUser.unitPriceMonthly)} per seat
                    {periodSuffix.replace("/", " / ")}
                  </p>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-white/[0.04]">
                  <button
                    type="button"
                    aria-label="Decrease seats"
                    className="rounded-xl border border-gray-200 bg-white p-2 text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-gray-900 dark:hover:bg-gray-800"
                    disabled={
                      extraUserTotal <= (data.extraUser.currentQuantity || 0)
                    }
                    onClick={() =>
                      setExtraUserTotal((n) =>
                        Math.max(data.extraUser.currentQuantity || 0, n - 1),
                      )
                    }
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <div className="min-w-14 text-center">
                    <div className="text-xl font-bold text-gray-900 dark:text-white">
                      {extraUserTotal}
                    </div>
                    <div className="text-[11px] uppercase tracking-wide text-gray-400">
                      seats
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Increase seats"
                    className="rounded-xl border border-gray-200 bg-white p-2 text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900 dark:hover:bg-gray-800"
                    onClick={() => setExtraUserTotal((n) => n + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {seatDelta > 0 ? (
                <p className="mt-4 rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:bg-sky-500/10 dark:text-sky-100">
                  Adding {seatDelta} new seat{seatDelta === 1 ? "" : "s"} — charged
                  at checkout.
                </p>
              ) : null}
            </section>

            {/* Available add-ons */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                Available upgrades
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Select what you need. You&apos;ll pay securely
                {data.paymentProvider === "stripe"
                  ? " with Stripe"
                  : data.paymentProvider === "ghl"
                    ? " via invoice"
                    : ""}
                .
              </p>

              {data.availableAddOns.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-700">
                  Everything available for your plan is already included or owned.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
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
                          className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left transition ${
                            checked
                              ? "border-[#2C92D5] bg-sky-50/80 ring-1 ring-[#2C92D5]/30 dark:bg-sky-500/10"
                              : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                              checked
                                ? "border-[#2C92D5] bg-[#2C92D5] text-white"
                                : "border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900"
                            }`}
                          >
                            {checked ? <Check className="h-3.5 w-3.5" /> : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {item.name}
                              </span>
                              <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                                {formatMoney(unit)}
                                <span className="font-normal text-gray-500">
                                  /mo
                                </span>
                                {isYearly ? (
                                  <span className="ml-1 text-xs font-normal text-gray-400">
                                    ({formatMoney(unit * 12)}
                                    {periodSuffix})
                                  </span>
                                ) : null}
                              </span>
                            </span>
                            <span className="mt-1 block text-sm text-gray-500">
                              {blurb}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          {/* Checkout summary */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-[#13538A]" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Order summary
                </h3>
              </div>

              {lineItems.length === 0 ? (
                <p className="mt-4 text-sm text-gray-500">
                  Select upgrades or seats to see your total.
                </p>
              ) : (
                <ul className="mt-4 space-y-3 border-b border-gray-100 pb-4 dark:border-gray-800">
                  {lineItems.map((row) => (
                    <li
                      key={row.code}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <div>
                        <div className="font-medium text-gray-800 dark:text-gray-100">
                          {row.name}
                        </div>
                        {row.detail ? (
                          <div className="text-xs text-gray-400">{row.detail}</div>
                        ) : null}
                      </div>
                      <div className="shrink-0 font-semibold text-gray-900 dark:text-white">
                        {formatMoney(row.amount)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Due today
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatMoney(estimated)}
                    <span className="ml-1 text-sm font-medium text-gray-400">
                      {periodSuffix}
                    </span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={!hasDelta || submitting || !data.paymentProvider}
                onClick={() => void handleCheckout()}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#13538A] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0f4470] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                {submitting
                  ? "Redirecting…"
                  : data.paymentProvider === "stripe"
                    ? "Pay with Stripe"
                    : "Pay & unlock"}
              </button>

              <p className="mt-3 text-center text-xs text-gray-400">
                {data.paymentProvider === "stripe"
                  ? "Secure checkout powered by Stripe. You can use cards and saved payment methods."
                  : data.paymentProvider === "ghl"
                    ? "You will complete payment on a secure invoice page."
                    : "Payment provider is not configured for this environment."}
              </p>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
