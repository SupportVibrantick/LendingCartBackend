import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import PageMeta from "../../components/common/PageMeta";
import { BROKER_API_BASE, brokerFetch } from "../../lib/brokerApi";
import {
  areAllCheckboxAddOnsSelected,
  getAddOnDisplayName,
  setCheckboxAddOnsSelected,
} from "../../lib/addOnCheckout";
import {
  type DisplayBilling,
  type PricingAddOn,
  type PricingPackage,
  YEARLY_SAVE_PERCENT,
  type FeatureGroup,
  canUpgradePackage,
  filterAddOnsForPackage,
  formatPrice,
  getAccent,
  getDisplayPrice,
  isQuantityAddOn,
  normalizeFeatureGroups,
} from "../../lib/planPricingUi";

const CTA_PRIMARY_BASE =
  "group inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 disabled:hover:scale-100";

const CTA_DISABLED =
  "inline-flex w-full cursor-not-allowed items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-400 opacity-60";

type PurchasedAddOn = {
  code: string;
  name: string;
  priceMonthly: number;
  quantity: number;
};

type SubscriptionPayload = {
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
  availableAddOns: Array<{
    code: string;
    name: string;
    priceMonthly: number;
    description?: string | null;
  }>;
  paymentProvider?: "stripe" | "ghl" | null;
  includedUsers?: number;
  teamSeats?: number;
  extraUser: {
    currentQuantity: number;
    unitPriceMonthly: number | null;
    unitPriceMonthlyCycle?: number | null;
    unitPriceYearlyMonthly?: number | null;
    code: string;
    name: string;
    description?: string | null;
  };
};

function FeatureDropdownItem({
  feature,
  openKey,
  setOpenKey,
}: {
  feature: { label: string; children: string[] };
  openKey: string | null;
  setOpenKey: (key: string | null) => void;
}) {
  const itemKey = feature.label;
  const isOpen = openKey === itemKey;
  const rootRef = useRef<HTMLLIElement | null>(null);
  const hasChildren = feature.children.length > 0;

  useEffect(() => {
    if (!isOpen) return undefined;

    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpenKey(null);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenKey(null);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, setOpenKey]);

  if (!hasChildren) {
    return (
      <li className="flex items-start gap-2">
        <Check className="mt-0.5 shrink-0 text-[#4B83FF]" size={15} />
        <span className="text-[13px] leading-snug text-slate-700">
          {feature.label}
        </span>
      </li>
    );
  }

  return (
    <li ref={rootRef} className="relative flex items-start gap-2">
      <Check className="mt-0.5 shrink-0 text-[#4B83FF]" size={15} />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setOpenKey(isOpen ? null : itemKey)}
          className="inline-flex cursor-pointer items-center gap-1 text-left text-[13px] font-medium leading-snug text-[#4B83FF] underline decoration-[#4B83FF]/70 underline-offset-2 transition hover:text-[#3a6fe0]"
        >
          {feature.label}
          <ChevronDown
            size={13}
            className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>

        {isOpen ? (
          <div
            role="menu"
            className="absolute left-0 z-20 mt-1.5 min-w-[200px] max-w-[260px] rounded-lg border border-slate-200 bg-white p-2.5 shadow-lg"
          >
            <ul className="space-y-1.5">
              {feature.children.map((child) => (
                <li key={child} className="flex items-start gap-2">
                  <Check
                    className="mt-0.5 shrink-0 text-[#4B83FF]"
                    size={14}
                  />
                  <span className="text-[13px] leading-snug text-slate-700">
                    {child}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </li>
  );
}

function FeatureGroupsList({ groups }: { groups: FeatureGroup[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  if (!groups?.length) return null;

  return (
    <div className="mb-4 flex-1 space-y-3.5">
      {groups.map((group, groupIndex) => {
        const isHighlight = group.variant === "highlight";
        return (
          <div key={`${group.heading || "features"}-${groupIndex}`}>
            {group.heading ? (
              <p
                className={`mb-1.5 text-[10px] font-bold uppercase tracking-wider ${
                  isHighlight ? "text-emerald-700" : "text-[#4B83FF]"
                }`}
              >
                {group.heading}
              </p>
            ) : null}
            <ul className="space-y-1.5">
              {group.items.map((feature) => (
                <FeatureDropdownItem
                  key={feature.label}
                  feature={feature}
                  openKey={openKey}
                  setOpenKey={setOpenKey}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function UserSlider({
  included,
  maxUsers,
  extraQty,
  minExtra,
  extraUserPrice,
  onChange,
}: {
  included: number;
  maxUsers: number;
  extraQty: number;
  minExtra: number;
  extraUserPrice: number;
  onChange: (qty: number) => void;
}) {
  const maxExtra = Math.max(0, maxUsers - included);
  const clampedExtra = Math.min(
    maxExtra,
    Math.max(minExtra, Number(extraQty) || 0),
  );
  const totalUsers = included + clampedExtra;
  const steps = Array.from(
    { length: maxExtra + 1 },
    (_, index) => included + index,
  );
  const progressPct =
    maxExtra === 0 ? 0 : ((totalUsers - included) / maxExtra) * 100;
  const compactLabels = steps.length > 8;

  if (maxExtra <= 0) return null;

  function setTotalUsers(nextTotal: number) {
    const minTotal = included + minExtra;
    const clamped = Math.min(
      maxUsers,
      Math.max(minTotal, Number(nextTotal) || minTotal),
    );
    onChange(clamped - included);
  }

  return (
    <div className="mb-4 border-b border-slate-100 pb-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-800">Add Users</p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTotalUsers(totalUsers - 1)}
            disabled={totalUsers <= included + minExtra}
            aria-label="Decrease users"
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            −
          </button>
          <span className="min-w-[1.5rem] text-center text-sm font-bold tabular-nums text-slate-800">
            {totalUsers}
          </span>
          <button
            type="button"
            onClick={() => setTotalUsers(totalUsers + 1)}
            disabled={totalUsers >= maxUsers}
            aria-label="Increase users"
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      <div className="relative px-0.5 pt-0.5">
        <div className="relative h-1.5 rounded-full bg-slate-200">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-[#4B83FF] transition-[width] duration-150"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="pointer-events-none absolute inset-x-0.5 top-0.5 flex h-1.5 items-center justify-between">
          {steps.map((step) => {
            const active = step <= totalUsers;
            const belowMin = step < included + minExtra;
            return (
              <button
                key={step}
                type="button"
                disabled={belowMin}
                onClick={() => setTotalUsers(step)}
                aria-label={`${step} users`}
                aria-pressed={step === totalUsers}
                className={`pointer-events-auto z-10 h-2 w-2 rounded-full border-2 transition ${
                  active
                    ? "border-[#4B83FF] bg-[#4B83FF]"
                    : "border-slate-300 bg-white"
                } ${step === totalUsers ? "scale-125 ring-2 ring-[#4B83FF]/30" : ""} ${
                  belowMin ? "cursor-not-allowed opacity-40" : "cursor-pointer"
                }`}
              />
            );
          })}
        </div>
        <input
          type="range"
          min={included + minExtra}
          max={maxUsers}
          step={1}
          value={totalUsers}
          onChange={(e) => setTotalUsers(Number(e.target.value))}
          className="absolute inset-x-0 top-0 z-20 h-5 w-full cursor-pointer opacity-0"
          aria-label="Total team seats"
        />
        <div
          className={`mt-2 flex justify-between ${compactLabels ? "gap-0.5" : "gap-1"}`}
        >
          {steps.map((step) => {
            const selected = step === totalUsers;
            const showLabel =
              !compactLabels ||
              step === included ||
              step === maxUsers ||
              selected ||
              (step - included) % 5 === 0;
            return (
              <button
                key={`label-${step}`}
                type="button"
                disabled={step < included + minExtra}
                onClick={() => setTotalUsers(step)}
                className={`min-w-0 flex-1 cursor-pointer text-center tabular-nums transition ${
                  compactLabels ? "text-[9px] leading-none" : "text-[10px]"
                } ${
                  selected
                    ? "font-bold text-[#4B83FF]"
                    : showLabel
                      ? "font-medium text-slate-500 hover:text-slate-800"
                      : "text-transparent"
                }`}
              >
                {showLabel ? step : "·"}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-2 text-[11px] leading-snug text-slate-500">
        Add up to {maxUsers} users · Additional User Cost:{" "}
        <span className="font-semibold text-slate-700">
          {formatPrice(extraUserPrice)}/m
        </span>
      </p>
    </div>
  );
}

function InCardAddOns({
  addOns,
  selectedCodes,
  ownedCodes,
  interactive,
  onToggle,
  onChange,
}: {
  addOns: PricingAddOn[];
  selectedCodes: string[];
  ownedCodes: Set<string>;
  interactive: boolean;
  onToggle: (code: string) => void;
  onChange: (codes: string[]) => void;
}) {
  const checkboxAddOns = (addOns || []).filter((a) => !isQuantityAddOn(a));
  if (!checkboxAddOns.length) return null;

  const selectable = checkboxAddOns.filter(
    (a) => !ownedCodes.has(String(a.code).toUpperCase()),
  );
  const allSelected =
    selectable.length > 0 &&
    areAllCheckboxAddOnsSelected(selectedCodes, selectable);

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
          Add-ons
        </p>
        {interactive && selectable.length > 0 ? (
          <button
            type="button"
            onClick={() =>
              onChange(
                setCheckboxAddOnsSelected(
                  selectedCodes,
                  selectable,
                  !allSelected,
                ),
              )
            }
            className="shrink-0 cursor-pointer text-[10px] font-semibold uppercase tracking-wide text-[#4B83FF] transition hover:opacity-80"
          >
            {allSelected ? "Deselect all" : "Select all"}
          </button>
        ) : null}
      </div>
      <ul className="divide-y divide-slate-200/80">
        {checkboxAddOns.map((addOn) => {
          const code = String(addOn.code);
          const owned = ownedCodes.has(code.toUpperCase());
          const selected =
            owned ||
            selectedCodes.some(
              (c) => String(c).toUpperCase() === code.toUpperCase(),
            );
          const unit = Number(addOn.priceMonthly) || 0;

          return (
            <li key={code}>
              <button
                type="button"
                disabled={!interactive || owned}
                onClick={() => {
                  if (!interactive || owned) return;
                  onToggle(code);
                }}
                aria-pressed={selected}
                className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 px-3 py-2 text-left transition ${
                  selected
                    ? "bg-[#4B83FF]/[0.08]"
                    : "hover:bg-white/70"
                } ${!interactive || owned ? "cursor-default" : "cursor-pointer"} ${
                  owned ? "opacity-80" : ""
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition ${
                    selected
                      ? "border-[#4B83FF] bg-[#4B83FF] text-white"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  {selected ? <Check size={10} strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0 break-words text-[12px] leading-snug text-slate-800">
                  {getAddOnDisplayName(addOn)}
                  {owned ? (
                    <span className="ml-1 text-[10px] font-semibold uppercase text-emerald-600">
                      Owned
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 whitespace-nowrap text-[12px] font-semibold tabular-nums text-[#4B83FF]">
                  {owned ? "Included" : `${formatPrice(unit)}/m`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function PlanAddOns() {
  const [packages, setPackages] = useState<PricingPackage[]>([]);
  const [catalogAddOns, setCatalogAddOns] = useState<PricingAddOn[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionPayload | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<DisplayBilling>("YEARLY");
  const [selectedAddOns, setSelectedAddOns] = useState<Set<string>>(new Set());
  const [extraUserTotal, setExtraUserTotal] = useState(0);
  /** Extra seats selected on non-current plan cards (e.g. Elite while on Pro). */
  const [previewExtrasByPackageId, setPreviewExtrasByPackageId] = useState<
    Record<string, number>
  >({});
  /** Checkbox add-ons selected on upgradeable plan cards. */
  const [previewAddOnsByPackageId, setPreviewAddOnsByPackageId] = useState<
    Record<string, string[]>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [upgradingPackageId, setUpgradingPackageId] = useState<string | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [catalogRes, subJson] = await Promise.all([
        fetch(`${BROKER_API_BASE}/common/subscriptions`).then(async (res) => {
          const json = await res.json();
          if (!res.ok || !json.success) {
            throw new Error(json.message || "Failed to load pricing");
          }
          return json as {
            data: PricingPackage[];
            addOns: PricingAddOn[];
          };
        }),
        brokerFetch<{ success: boolean; data: SubscriptionPayload }>(
          "/broker/subscription/addons",
        ),
      ]);

      if (!subJson?.success || !subJson.data) {
        throw new Error("Failed to load plan add-ons");
      }

      setPackages(catalogRes.data || []);
      setCatalogAddOns(catalogRes.addOns || []);
      setSubscription(subJson.data);
      setExtraUserTotal(subJson.data.extraUser?.currentQuantity || 0);
      setPreviewExtrasByPackageId({});
      setPreviewAddOnsByPackageId({});
      setSelectedAddOns(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load plan");
      setPackages([]);
      setSubscription(null);
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
    if (addons === "paid" || addons === "upgraded") {
      toast.success(
        addons === "upgraded"
          ? "Payment received. Your plan upgrade unlocks once Stripe confirms (usually a few seconds)."
          : "Payment received. Your add-ons unlock once Stripe confirms (usually a few seconds).",
      );
      void load();
      window.history.replaceState({}, "", "/settings/plan");
    } else if (addons === "cancelled") {
      toast("Checkout cancelled — no charges were made.", { icon: "ℹ️" });
      window.history.replaceState({}, "", "/settings/plan");
    }
  }, [load]);

  const isYearly = billingCycle === "YEARLY";
  const hasYearlyPricing = packages.some((pkg) => pkg.priceYearly != null);
  const currentCode = String(subscription?.packageCode || "").toUpperCase();
  const planBillingIsYearly =
    String(subscription?.billingCycle || "").toUpperCase() === "YEARLY";
  const planBillingLabel = planBillingIsYearly ? "Yearly" : "Monthly";
  const planBillingHint = planBillingIsYearly
    ? "You’re on yearly billing"
    : "You’re on monthly billing";
  const ownedCodes = useMemo(
    () =>
      new Set(
        (subscription?.ownedAddOnCodes || []).map((c) =>
          String(c).toUpperCase(),
        ),
      ),
    [subscription],
  );
  const minExtra = Number(subscription?.extraUser?.currentQuantity) || 0;
  const isOnTrial =
    String(subscription?.status || "").toUpperCase() === "TRIAL";
  const trialDaysLeft = Math.max(
    0,
    Number(subscription?.remainingTrialDays) || 0,
  );

  const seatDelta = Math.max(0, extraUserTotal - minExtra);
  const newAddOnCodes = useMemo(
    () =>
      [...selectedAddOns].filter(
        (code) => !ownedCodes.has(String(code).toUpperCase()),
      ),
    [selectedAddOns, ownedCodes],
  );
  const hasDelta = newAddOnCodes.length > 0 || seatDelta > 0;

  const estimatedMonthly = useMemo(() => {
    if (!subscription) return 0;
    let total = 0;
    for (const code of newAddOnCodes) {
      const fromSub = subscription.availableAddOns.find(
        (a) => a.code === code,
      );
      if (fromSub) {
        total += Number(fromSub.priceMonthly) || 0;
        continue;
      }
      const fromCatalog = catalogAddOns.find(
        (a) => String(a.code).toUpperCase() === String(code).toUpperCase(),
      );
      if (fromCatalog) {
        total +=
          billingCycle === "YEARLY"
            ? Number(fromCatalog.priceYearlyMonthly ?? fromCatalog.priceMonthly) ||
              0
            : Number(fromCatalog.priceMonthly) || 0;
      }
    }
    if (seatDelta > 0) {
      const unit =
        billingCycle === "YEARLY"
          ? Number(
              subscription.extraUser.unitPriceYearlyMonthly ??
                subscription.extraUser.unitPriceMonthly,
            ) || 0
          : Number(
              subscription.extraUser.unitPriceMonthlyCycle ??
                subscription.extraUser.unitPriceMonthly,
            ) || 0;
      total += seatDelta * unit;
    }
    return total;
  }, [
    subscription,
    newAddOnCodes,
    seatDelta,
    catalogAddOns,
    billingCycle,
  ]);

  const estimated = isYearly ? estimatedMonthly * 12 : estimatedMonthly;
  const dueTodayAmount =
    isOnTrial && trialDaysLeft > 0 ? 0 : estimated;

  function toggleAddOn(code: string) {
    if (ownedCodes.has(String(code).toUpperCase())) return;
    setSelectedAddOns((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function togglePreviewAddOn(packageId: string, code: string) {
    if (ownedCodes.has(String(code).toUpperCase())) return;
    setPreviewAddOnsByPackageId((prev) => {
      const current = new Set(prev[packageId] || []);
      if (current.has(code)) current.delete(code);
      else current.add(code);
      return { ...prev, [packageId]: [...current] };
    });
  }

  function setCurrentAddOnCodes(codes: string[]) {
    setSelectedAddOns(
      new Set(
        codes.filter((code) => !ownedCodes.has(String(code).toUpperCase())),
      ),
    );
  }

  function setPreviewAddOnCodes(packageId: string, codes: string[]) {
    setPreviewAddOnsByPackageId((prev) => ({
      ...prev,
      [packageId]: codes.filter(
        (code) => !ownedCodes.has(String(code).toUpperCase()),
      ),
    }));
  }

  async function handleCheckout() {
    if (!subscription || !hasDelta) {
      toast.error("Select an add-on or increase team seats first");
      return;
    }
    if (!subscription.paymentProvider) {
      toast.error("Payments are not configured yet. Contact support.");
      return;
    }
    setSubmitting(true);
    try {
      const origin = window.location.origin;
      const json = await brokerFetch<{
        success: boolean;
        data?: { checkoutUrl?: string };
        message?: string;
      }>("/broker/subscription/addons/checkout", {
        method: "POST",
        body: JSON.stringify({
          addOnCodes: newAddOnCodes,
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

  async function handlePlanUpgrade(pkg: PricingPackage) {
    if (!subscription) return;
    if (!canUpgradePackage(subscription.packageCode, pkg.code)) {
      toast.error("This plan is not available as an upgrade from your current plan.");
      return;
    }
    if (!subscription.paymentProvider) {
      toast.error("Payments are not configured yet. Contact support.");
      return;
    }

    const previewExtra = Math.max(
      0,
      Number(previewExtrasByPackageId[pkg.id]) || 0,
    );
    const previewAddOnCodes = (previewAddOnsByPackageId[pkg.id] || []).filter(
      (code) => !ownedCodes.has(String(code).toUpperCase()),
    );

    setUpgradingPackageId(pkg.id);
    try {
      const origin = window.location.origin;
      const json = await brokerFetch<{
        success: boolean;
        data?: { checkoutUrl?: string };
        message?: string;
      }>("/broker/subscription/plan/upgrade", {
        method: "POST",
        body: JSON.stringify({
          packageId: pkg.id,
          packageCode: pkg.code,
          billingCycle,
          extraUserTotal: previewExtra,
          addOnCodes: previewAddOnCodes,
          successUrl: `${origin}/settings/plan?addons=upgraded`,
          cancelUrl: `${origin}/settings/plan?addons=cancelled`,
        }),
      });
      if (!json?.success || !json.data?.checkoutUrl) {
        throw new Error(json?.message || "Plan upgrade checkout failed");
      }
      window.location.href = json.data.checkoutUrl;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Plan upgrade checkout failed",
      );
      setUpgradingPackageId(null);
    }
  }

  return (
    <>
      <PageMeta
        title="Plan & Add-ons | Broker"
        description="Manage subscription add-ons and additional users"
      />

      <div className="w-full min-w-0 space-y-6 pb-6 text-text-primary">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="ds-page-title">Plan & Add-ons</h1>
            <p className="ds-page-subtitle">
              Same pricing experience as Loan Automation — upgrade seats and
              add-ons on your current plan.
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
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[420px] animate-pulse rounded-2xl border border-border bg-surface"
              />
            ))}
          </div>
        ) : !subscription ? (
          <div className="rounded-2xl border border-dashed border-border bg-white px-6 py-14 text-center">
            <p className="text-sm text-text-secondary">
              No active subscription found for this organization.
            </p>
          </div>
        ) : (
          <>
            <div className="mx-auto flex max-w-6xl flex-col items-center gap-3">
              <div
                className={`inline-flex flex-wrap items-center justify-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-semibold ${
                  planBillingIsYearly
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-[#4C78F5]/25 bg-[#4C78F5]/10 text-[#2F5AD0]"
                }`}
                role="status"
              >
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white ${
                    planBillingIsYearly ? "bg-emerald-500" : "bg-[#4C78F5]"
                  }`}
                >
                  {planBillingLabel}
                </span>
                <span>
                  {planBillingHint}
                  {subscription.packageName
                    ? ` · ${subscription.packageName}`
                    : ""}
                  {subscription.currentPeriodEnd
                    ? ` · renews ${new Date(
                        subscription.currentPeriodEnd,
                      ).toLocaleDateString()}`
                    : ""}
                </span>
              </div>

              {hasYearlyPricing ? (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <span
                    className={`text-sm font-bold transition ${
                      !isYearly ? "text-text-primary" : "text-text-secondary"
                    }`}
                  >
                    Monthly
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isYearly}
                    aria-label={
                      isYearly
                        ? "Switch to monthly billing"
                        : "Switch to yearly billing"
                    }
                    onClick={() =>
                      setBillingCycle(isYearly ? "MONTHLY" : "YEARLY")
                    }
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4B83FF]/25 ${
                      isYearly ? "bg-[#4B83FF]" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        isYearly ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <span
                    className={`text-sm font-bold transition ${
                      isYearly ? "text-text-primary" : "text-text-secondary"
                    }`}
                  >
                    Yearly
                  </span>
                  <span className="inline-block rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm shadow-emerald-500/40">
                    Save {YEARLY_SAVE_PERCENT}%
                  </span>
                </div>
              ) : null}

              {hasYearlyPricing ? (
                <p className="text-center text-[12px] text-text-secondary">
                  Toggle only changes displayed prices. Your purchased billing
                  stays{" "}
                  <span className="font-semibold text-text-primary">
                    {planBillingLabel.toLowerCase()}
                  </span>
                  .
                </p>
              ) : null}
            </div>

            <div className="mx-auto grid max-w-6xl grid-cols-1 items-stretch gap-6 md:grid-cols-3">
              {packages.map((pkg) => {
                const accent = getAccent(pkg.code);
                const isPopular = Boolean(pkg.isPopular);
                const isCurrent =
                  String(pkg.code || "").toUpperCase() === currentCode;
                const featureGroups = normalizeFeatureGroups(pkg);
                const planBadge =
                  pkg.badge || (isPopular ? "MOST POPULAR" : null);
                const { amount, suffix, billingLabel, billedToday } =
                  getDisplayPrice(pkg, billingCycle);
                const savings = isYearly ? YEARLY_SAVE_PERCENT : null;

                const packageAddOns = filterAddOnsForPackage(
                  catalogAddOns,
                  pkg.code,
                  billingCycle,
                );
                const included = Math.max(1, Number(pkg.includedUsers) || 1);
                const maxUsers = Math.max(
                  included,
                  Number(pkg.maxUsers) || included,
                );
                const extraUserPrice =
                  Number(pkg.extraUserPrice) > 0
                    ? Number(pkg.extraUserPrice)
                    : Number(
                        isYearly
                          ? subscription.extraUser.unitPriceYearlyMonthly ??
                              subscription.extraUser.unitPriceMonthly
                          : subscription.extraUser.unitPriceMonthlyCycle ??
                              subscription.extraUser.unitPriceMonthly,
                      ) || 99;

                const canUpgradeThis = canUpgradePackage(currentCode, pkg.code);
                const interactiveAddOns = isCurrent || canUpgradeThis;
                const previewExtraQty = isCurrent
                  ? Math.max(0, seatDelta)
                  : Math.max(0, Number(previewExtrasByPackageId[pkg.id]) || 0);
                const seatUnitPrice =
                  Number(pkg.extraUserPrice) > 0
                    ? Number(pkg.extraUserPrice)
                    : Number(
                        isYearly
                          ? subscription.extraUser.unitPriceYearlyMonthly ??
                              subscription.extraUser.unitPriceMonthly
                          : subscription.extraUser.unitPriceMonthlyCycle ??
                              subscription.extraUser.unitPriceMonthly,
                      ) || 0;
                const seatAddMonthly =
                  previewExtraQty > 0 ? previewExtraQty * seatUnitPrice : 0;
                const selectedCodesForCard = isCurrent
                  ? [...selectedAddOns]
                  : previewAddOnsByPackageId[pkg.id] || [];
                const addOnAddMonthly = selectedCodesForCard.reduce(
                  (sum, code) => {
                    if (ownedCodes.has(String(code).toUpperCase())) return sum;
                    const item = packageAddOns.find(
                      (a) =>
                        String(a.code).toUpperCase() ===
                        String(code).toUpperCase(),
                    );
                    return sum + (Number(item?.priceMonthly) || 0);
                  },
                  0,
                );
                const displayTotal =
                  Number(amount) + seatAddMonthly + addOnAddMonthly;
                const displayBilledToday =
                  isYearly && billedToday != null
                    ? Number(billedToday) +
                      (seatAddMonthly + addOnAddMonthly) * 12
                    : null;
                const primaryCta = `${CTA_PRIMARY_BASE} ${accent.primary}`;
                const arrowTone =
                  String(pkg.code || "").toUpperCase() === "ELITE"
                    ? "text-slate-900"
                    : "text-white/90";

                return (
                  <article
                    key={pkg.id}
                    className={`relative flex flex-col rounded-2xl border bg-white p-5 text-left backdrop-blur-xl transition-all duration-300 md:p-6 ${
                      isCurrent
                        ? isOnTrial
                          ? "border-sky-400/40 bg-sky-500/[0.08] shadow-[0_0_40px_rgba(56,189,248,0.15)]"
                          : "border-emerald-400/40 bg-emerald-500/[0.08] shadow-[0_0_40px_rgba(16,185,129,0.15)]"
                        : accent.ring
                    } ${isPopular || isCurrent ? "z-10" : ""}`}
                  >
                    {isCurrent ? (
                      <span
                        className={`absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-0.5 text-[11px] font-semibold shadow-lg ${
                          isOnTrial
                            ? "bg-gradient-to-r from-sky-500 to-blue-500 text-white"
                            : "bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                        }`}
                      >
                        {isOnTrial ? "Current plan" : "Your Plan"}
                      </span>
                    ) : planBadge ? (
                      <span
                        className={`absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-0.5 text-[11px] font-semibold shadow-lg ${
                          String(planBadge).toUpperCase().includes("VALUE")
                            ? "bg-emerald-500 text-white"
                            : "bg-[#4B83FF] text-white"
                        }`}
                      >
                        {planBadge}
                      </span>
                    ) : null}

                    <h3 className="mb-2 text-xl font-bold text-slate-900">
                      {pkg.name}
                    </h3>

                    <div className="mb-4">
                      <div className="flex flex-wrap items-end gap-x-2 gap-y-0.5">
                        <span
                          className={`text-3xl font-bold md:text-4xl ${accent.price}`}
                        >
                          {formatPrice(displayTotal)}
                        </span>
                        <span className="mb-0.5 text-sm text-slate-500">
                          {suffix}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {billingLabel}
                        {isCurrent &&
                        billingCycle !==
                          String(subscription.billingCycle || "").toUpperCase()
                          ? " (preview)"
                          : ""}
                      </p>
                      {displayBilledToday != null ? (
                        <p className="mt-1 text-sm font-semibold text-slate-800">
                          {formatPrice(displayBilledToday)} billed today
                        </p>
                      ) : null}
                      {savings != null && savings > 0 ? (
                        <p className="mt-1 text-xs font-medium text-emerald-500">
                          Save {savings}% vs monthly
                        </p>
                      ) : null}
                    </div>

                    {maxUsers > included ? (
                      <UserSlider
                        included={included}
                        maxUsers={maxUsers}
                        extraQty={
                          isCurrent
                            ? extraUserTotal
                            : previewExtrasByPackageId[pkg.id] || 0
                        }
                        minExtra={isCurrent ? minExtra : 0}
                        extraUserPrice={extraUserPrice}
                        onChange={(qty) => {
                          if (isCurrent) {
                            setExtraUserTotal(qty);
                            return;
                          }
                          if (!canUpgradeThis) return;
                          setPreviewExtrasByPackageId((prev) => ({
                            ...prev,
                            [pkg.id]: qty,
                          }));
                        }}
                      />
                    ) : null}

                    <FeatureGroupsList groups={featureGroups} />

                    <InCardAddOns
                      addOns={packageAddOns}
                      selectedCodes={selectedCodesForCard}
                      ownedCodes={ownedCodes}
                      interactive={interactiveAddOns}
                      onToggle={(code) =>
                        isCurrent
                          ? toggleAddOn(code)
                          : togglePreviewAddOn(pkg.id, code)
                      }
                      onChange={(codes) =>
                        isCurrent
                          ? setCurrentAddOnCodes(codes)
                          : setPreviewAddOnCodes(pkg.id, codes)
                      }
                    />

                    <div className="mt-auto flex flex-col gap-2 pt-1">
                      {isCurrent && !isOnTrial ? (
                        <div className="mb-0.5 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700">
                          <CheckCircle2 size={16} className="shrink-0" />
                          Purchased · {planBillingLabel} · Active
                        </div>
                      ) : null}
                      {isCurrent && isOnTrial ? (
                        <div className="mb-0.5 flex flex-col items-center gap-0.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm font-medium text-sky-700">
                          <span className="inline-flex items-center gap-2">
                            <CheckCircle2 size={16} className="shrink-0" />
                            Free trial active
                          </span>
                          {trialDaysLeft > 0 ? (
                            <span className="text-xs font-normal text-sky-600/80">
                              {trialDaysLeft} day
                              {trialDaysLeft === 1 ? "" : "s"} left
                            </span>
                          ) : null}
                        </div>
                      ) : null}

                      {isCurrent ? (
                        <>
                          <button
                            type="button"
                            disabled={
                              !hasDelta ||
                              submitting ||
                              !subscription.paymentProvider
                            }
                            onClick={() => void handleCheckout()}
                            className={
                              hasDelta ? primaryCta : CTA_DISABLED
                            }
                          >
                            {submitting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : null}
                            {submitting
                              ? "Redirecting…"
                              : hasDelta
                                ? isOnTrial && trialDaysLeft > 0
                                  ? "Unlock add-ons on trial"
                                  : dueTodayAmount > 0
                                    ? `Pay ${formatPrice(dueTodayAmount)}${isYearly ? "/yr" : "/mo"}`
                                    : "Pay & unlock"
                                : "Select add-ons or seats"}
                            {hasDelta && !submitting ? (
                              <ArrowRight
                                size={16}
                                className={`${arrowTone} transition-transform group-hover:translate-x-0.5`}
                              />
                            ) : null}
                          </button>
                          <p className="text-center text-[11px] leading-relaxed text-slate-500">
                            Checkout follows your purchased{" "}
                            {planBillingLabel.toLowerCase()} billing.
                          </p>
                        </>
                      ) : canUpgradeThis ? (
                        <>
                          <button
                            type="button"
                            disabled={
                              upgradingPackageId === pkg.id ||
                              !subscription.paymentProvider
                            }
                            onClick={() => void handlePlanUpgrade(pkg)}
                            className={primaryCta}
                          >
                            {upgradingPackageId === pkg.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : null}
                            {upgradingPackageId === pkg.id
                              ? "Redirecting…"
                              : `Upgrade to ${pkg.name}`}
                            {upgradingPackageId !== pkg.id ? (
                              <ArrowRight
                                size={16}
                                className={`${arrowTone} transition-transform group-hover:translate-x-0.5`}
                              />
                            ) : null}
                          </button>
                          <p className="text-center text-[11px] leading-relaxed text-slate-500">
                            Checkout uses {isYearly ? "yearly" : "monthly"}{" "}
                            pricing. Seats and owned add-ons are kept.
                          </p>
                        </>
                      ) : (
                        <button type="button" disabled className={CTA_DISABLED}>
                          Current plan is{" "}
                          {subscription.packageName || subscription.packageCode}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {packages.length === 0 ? (
              <div className="rounded-2xl border border-border bg-white px-4 py-8 text-center text-sm text-text-secondary">
                Pricing plans are not available yet.
              </div>
            ) : null}

            <div className="mx-auto flex max-w-6xl items-start gap-2 rounded-xl border border-border bg-white px-4 py-3 text-[12px] text-text-secondary">
              <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-[#4C78F5]" />
              <p>
                Team seats on this page start from your current purchased extras
                and can only increase. Feature add-ons you already own stay
                locked on.
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
