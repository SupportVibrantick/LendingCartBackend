import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { fetchSubscriptionPackages } from "../lib/api";
import {
  expandAddOnCodesForCheckout,
  filterAddOnsForPackage,
  getAddOnDisplayName,
  getAddOnQuantity,
  getAddOnsCycleTotal,
  getApplicableSelectedAddOns,
  isQuantityAddOn,
  MAX_QUANTITY_ADDON,
  setAddOnQuantity,
  toggleAddOnCode,
} from "../lib/addOnCheckout";
import { buildPlanCheckoutState } from "../lib/planCheckout";
import PricingPlanCta from "./PricingPlanCta";
import PlanComparison from "./PlanComparison";
import PricingClosingCta from "./PricingClosingCta";
import { useAuth } from "../context/AuthContext";

const YEARLY_SAVE_PERCENT = 20;

/** Loan-category feature dropdowns shown on pricing cards. */
const LOAN_CATEGORY_CHILDREN = {
  "1-4 unit Residential": [
    "Bridge Loans",
    "Fix & Flip Loans",
    "DSCR Loans",
    "Construction Loans",
    "Rental portfolio Loans",
  ],
  "CRE & Multifamily": [
    "Bridge Loans",
    "Value Add Property Loans",
    "Construction Loans",
    "CRE Permanent Loans",
    "Conventional Loans",
    "CMBS Loans",
    "Agency Loans for Multifamily",
    "C-Pace Loans",
    "Mezzanine & Preferred Equity",
  ],
  "SBA & USDA Loans": [
    "SBA 7(a) Express",
    "SBA 7(a) Business Acquisition",
    "SBA 7(a) Equipment Finance",
    "SBA 7(a) Working Capital",
    "SBA 7(a) Real Estate + Construction",
    "SBA 504 Real Estate + Business",
    "SBA 504 Real Estate Construction",
    "USDA Business & Industry",
  ],
  "Asset-Based Lending": [
    "Equipment Finance",
    "Accounts Receivable Finance",
    "Accounts Payable Finance",
    "Purchase Order Finance",
  ],
};

function normalizeFeatureItem(item) {
  if (item == null) return null;

  if (typeof item === "string") {
    const label = item.trim();
    if (!label) return null;
    // Strip legacy parenthetical suffixes like "(Bridge, Fix & Flip, DSCR)"
    const baseLabel = label.replace(/\s*\([^)]*\)\s*$/, "").trim();
    const children =
      LOAN_CATEGORY_CHILDREN[baseLabel] || LOAN_CATEGORY_CHILDREN[label] || [];
    return { label: children.length ? baseLabel : label, children };
  }

  if (typeof item === "object") {
    const label = String(item.label || item.name || item.title || "").trim();
    if (!label) return null;
    const rawChildren = item.children || item.items || item.subItems || [];
    let children = Array.isArray(rawChildren)
      ? rawChildren.map((child) => String(child).trim()).filter(Boolean)
      : [];
    if (!children.length) {
      children = LOAN_CATEGORY_CHILDREN[label] || [];
    }
    return { label, children };
  }

  return null;
}

const TIER_ACCENTS = {
  BASIC: {
    ring: "border-slate-200 dark:border-white/10",
    badge: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-gray-300",
    price: "text-slate-900 dark:text-white",
    cta: "border border-slate-900 bg-white text-slate-900 hover:bg-slate-50",
  },
  STARTER: {
    ring: "border-slate-200 dark:border-white/10",
    badge: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-gray-300",
    price: "text-slate-900 dark:text-white",
    cta: "border border-slate-900 bg-white text-slate-900 hover:bg-slate-50",
  },
  PRO: {
    ring: "border-[#4B83FF]/50 shadow-[0_0_40px_rgba(75,131,255,0.15)]",
    badge: "bg-[#4B83FF] text-white",
    price: "text-slate-900 dark:text-white",
    cta: "bg-[#4B83FF] text-white hover:bg-[#3a6fe0]",
  },
  ELITE: {
    ring: "border-emerald-400/40 shadow-[0_0_40px_rgba(16,185,129,0.12)]",
    badge: "bg-emerald-500 text-white",
    price: "text-slate-900 dark:text-white",
    cta: "bg-emerald-500 text-white hover:bg-emerald-600",
  },
};

const DEFAULT_ACCENT = TIER_ACCENTS.BASIC;

function formatPrice(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function getAccent(code) {
  return TIER_ACCENTS[code?.toUpperCase()] ?? DEFAULT_ACCENT;
}

function normalizeFeatures(features) {
  if (Array.isArray(features)) return features.filter(Boolean);
  if (typeof features === "string" && features.trim()) {
    if (features.includes("\n")) {
      return features
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return features
      .split(/[,;|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeFeatureGroups(pkg) {
  if (Array.isArray(pkg?.featureGroups) && pkg.featureGroups.length > 0) {
    return pkg.featureGroups
      .map((group) => ({
        heading: group?.heading ? String(group.heading).trim() : null,
        variant: group?.variant === "highlight" ? "highlight" : "default",
        items: Array.isArray(group?.items)
          ? group.items.map(normalizeFeatureItem).filter(Boolean)
          : [],
      }))
      .filter((group) => group.items.length > 0);
  }

  const features = normalizeFeatures(pkg?.features);
  if (!features.length) return [];
  return [
    {
      heading: null,
      variant: "default",
      items: features.map(normalizeFeatureItem).filter(Boolean),
    },
  ];
}

function getDisplayPrice(pkg, billingCycle) {
  if (billingCycle === "YEARLY" && pkg.priceYearly != null) {
    const yearlyTotal = Number(pkg.priceYearly);
    const monthlyEquivalent = Math.round(yearlyTotal / 12);
    return {
      amount: monthlyEquivalent,
      suffix: "/ month",
      billingLabel: "Billed yearly",
      billedToday: yearlyTotal,
      checkoutAmount: yearlyTotal,
    };
  }

  return {
    amount: pkg.priceMonthly,
    suffix: "/ month",
    billingLabel: "Billed monthly",
    billedToday: null,
    checkoutAmount: pkg.priceMonthly,
  };
}

function getYearlySavingsPercent(pkg) {
  const monthly = Number(pkg.priceMonthly);
  const yearly = Number(pkg.priceYearly);
  if (!Number.isFinite(monthly) || !Number.isFinite(yearly) || monthly <= 0) {
    return null;
  }
  const annualFromMonthly = monthly * 12;
  if (yearly >= annualFromMonthly) return null;
  return Math.round(((annualFromMonthly - yearly) / annualFromMonthly) * 100);
}

function planDemoMessage(pkg, billingCycle) {
  const { amount } = getDisplayPrice(pkg, billingCycle);
  return `Interested in the ${pkg.name} plan (${pkg.code}) — ${formatPrice(amount)}/month (${billingCycle === "YEARLY" ? "yearly" : "monthly"} billing).`;
}

function FeatureDropdownItem({ feature, openKey, setOpenKey }) {
  const itemKey = feature.label;
  const isOpen = openKey === itemKey;
  const rootRef = useRef(null);
  const hasChildren = Array.isArray(feature.children) && feature.children.length > 0;

  useEffect(() => {
    if (!isOpen) return undefined;

    function handlePointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpenKey(null);
      }
    }

    function handleEscape(event) {
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
      <li className="flex items-start gap-3">
        <Check className="mt-0.5 shrink-0 text-[#4B83FF]" size={18} />
        <span className="text-sm text-slate-700 dark:text-gray-200">
          {feature.label}
        </span>
      </li>
    );
  }

  return (
    <li ref={rootRef} className="relative flex items-start gap-3">
      <Check className="mt-0.5 shrink-0 text-[#4B83FF]" size={18} />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setOpenKey(isOpen ? null : itemKey)}
          className="inline-flex items-center gap-1 text-left text-sm font-medium text-[#4B83FF] underline decoration-[#4B83FF]/70 underline-offset-2 transition hover:text-[#3a6fe0]"
        >
          {feature.label}
          <ChevronDown
            size={14}
            className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>

        {isOpen && (
          <div
            role="menu"
            className="absolute left-0 z-20 mt-2 min-w-[220px] max-w-[280px] rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-white/10 dark:bg-slate-900"
          >
            <ul className="space-y-2">
              {feature.children.map((child) => (
                <li key={child} className="flex items-start gap-2.5">
                  <Check
                    className="mt-0.5 shrink-0 text-[#4B83FF]"
                    size={16}
                  />
                  <span className="text-sm text-slate-700 dark:text-gray-200">
                    {child}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </li>
  );
}

function FeatureGroupsList({ groups }) {
  const [openKey, setOpenKey] = useState(null);

  if (!groups?.length) return null;

  return (
    <div className="mb-6 flex-1 space-y-5">
      {groups.map((group, groupIndex) => {
        const isHighlight = group.variant === "highlight";
        return (
          <div key={`${group.heading || "features"}-${groupIndex}`}>
            {group.heading && (
              <p
                className={`mb-3 text-[11px] font-bold uppercase tracking-wider ${
                  isHighlight
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-[#4B83FF]"
                }`}
              >
                {group.heading}
              </p>
            )}
            <ul className="space-y-2.5">
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

function UserSlider({ pkg, quantity, onChange, formatPrice }) {
  const included = Math.max(1, Number(pkg.includedUsers) || 1);
  const maxUsers = Math.max(included, Number(pkg.maxUsers) || included);
  const maxExtra = Math.max(0, maxUsers - included);
  const extraUserPrice =
    Number(pkg.extraUserPrice) > 0 ? Number(pkg.extraUserPrice) : 99;
  const extraQty = Math.min(Math.max(0, Number(quantity) || 0), maxExtra);
  const totalUsers = included + extraQty;
  const steps = Array.from(
    { length: maxExtra + 1 },
    (_, index) => included + index,
  );
  const progressPct =
    maxExtra === 0 ? 0 : ((totalUsers - included) / maxExtra) * 100;
  const compactLabels = steps.length > 8;

  if (maxExtra <= 0) return null;

  function setTotalUsers(nextTotal) {
    const clamped = Math.min(maxUsers, Math.max(included, Number(nextTotal) || included));
    onChange(clamped - included);
  }

  return (
    <div className="mb-6 border-b border-slate-100 pb-6 dark:border-white/10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-800 dark:text-white">
          Add Users
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTotalUsers(totalUsers - 1)}
            disabled={totalUsers <= included}
            aria-label="Decrease users"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/5"
          >
            −
          </button>
          <span className="min-w-[1.75rem] text-center text-sm font-bold tabular-nums text-slate-800 dark:text-white">
            {totalUsers}
          </span>
          <button
            type="button"
            onClick={() => setTotalUsers(totalUsers + 1)}
            disabled={totalUsers >= maxUsers}
            aria-label="Increase users"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/5"
          >
            +
          </button>
        </div>
      </div>

      <div className="relative px-0.5 pt-1">
        {/* Track + filled progress */}
        <div className="relative h-1.5 rounded-full bg-slate-200 dark:bg-white/15">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-[#4B83FF] transition-[width] duration-150"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Clickable step dots */}
        <div className="pointer-events-none absolute inset-x-0.5 top-1 flex h-1.5 items-center justify-between">
          {steps.map((step) => {
            const active = step <= totalUsers;
            return (
              <button
                key={step}
                type="button"
                onClick={() => setTotalUsers(step)}
                aria-label={`${step} users`}
                aria-pressed={step === totalUsers}
                className={`pointer-events-auto z-10 h-2.5 w-2.5 rounded-full border-2 transition ${
                  active
                    ? "border-[#4B83FF] bg-[#4B83FF]"
                    : "border-slate-300 bg-white dark:border-white/30 dark:bg-slate-900"
                } ${step === totalUsers ? "scale-125 ring-2 ring-[#4B83FF]/30" : ""}`}
              />
            );
          })}
        </div>

        {/* Invisible range for drag / keyboard */}
        <input
          type="range"
          min={included}
          max={maxUsers}
          step={1}
          value={totalUsers}
          onChange={(e) => setTotalUsers(Number(e.target.value))}
          className="absolute inset-x-0 top-0 z-20 h-6 w-full cursor-pointer opacity-0"
          aria-label={`Total users for ${pkg.name}`}
          aria-valuemin={included}
          aria-valuemax={maxUsers}
          aria-valuenow={totalUsers}
          list={`${pkg.code || pkg.id}-user-steps`}
        />
        <datalist id={`${pkg.code || pkg.id}-user-steps`}>
          {steps.map((step) => (
            <option key={step} value={step} label={String(step)} />
          ))}
        </datalist>

        {/* Step numbers: 1 → 2 → 3 → … */}
        <div
          className={`mt-3 flex justify-between ${
            compactLabels ? "gap-0.5" : "gap-1"
          }`}
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
                onClick={() => setTotalUsers(step)}
                className={`min-w-0 flex-1 text-center tabular-nums transition ${
                  compactLabels ? "text-[9px] leading-none" : "text-[11px]"
                } ${
                  selected
                    ? "font-bold text-[#4B83FF]"
                    : showLabel
                      ? "font-medium text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-gray-200"
                      : "text-transparent"
                }`}
                aria-hidden={!showLabel}
                tabIndex={showLabel ? 0 : -1}
              >
                {showLabel ? step : "·"}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500 dark:text-gray-400">
        Add up to {maxUsers} users
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-gray-200">
        Additional User Cost: {formatPrice(extraUserPrice)}/m
      </p>
    </div>
  );
}

function InCardAddOns({
  addOns,
  selectedCodes,
  onToggle,
  formatPrice,
}) {
  const checkboxAddOns = (addOns || []).filter((a) => !isQuantityAddOn(a));
  if (!checkboxAddOns.length) return null;

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="border-b border-slate-200/80 px-4 py-3 dark:border-white/10">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600 dark:text-gray-300">
          Add-ons
        </p>
      </div>
      <ul className="divide-y divide-slate-200/80 dark:divide-white/10">
        {checkboxAddOns.map((addOn) => {
          const selected = selectedCodes.some(
            (code) =>
              String(code).toUpperCase() === String(addOn.code).toUpperCase(),
          );
          const unit = Number(addOn.priceMonthly);

          return (
            <li key={addOn.code}>
              <button
                type="button"
                onClick={() => onToggle(addOn.code)}
                aria-pressed={selected}
                className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 px-4 py-3 text-left transition ${
                  selected
                    ? "bg-[#4B83FF]/[0.08] dark:bg-[#4B83FF]/15"
                    : "hover:bg-white/70 dark:hover:bg-white/[0.04]"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border transition ${
                    selected
                      ? "border-[#4B83FF] bg-[#4B83FF] text-white"
                      : "border-slate-300 bg-white dark:border-white/25 dark:bg-transparent"
                  }`}
                >
                  {selected ? <Check size={12} strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0 break-words text-[13px] leading-5 text-slate-800 dark:text-gray-200">
                  {getAddOnDisplayName(addOn)}
                </span>
                <span className="shrink-0 whitespace-nowrap pt-px text-[13px] font-semibold tabular-nums text-[#4B83FF]">
                  {formatPrice(unit)}/m
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PricingSkeleton() {
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-[520px] animate-pulse rounded-3xl border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-white/5"
        />
      ))}
    </div>
  );
}

const Pricing = () => {
  const { isAuthenticated, user, refreshUser } = useAuth();
  const [packages, setPackages] = useState([]);
  const [addOns, setAddOns] = useState([]);
  /** @type {[Record<string, string[]>, Function]} */
  const [selectedByPackage, setSelectedByPackage] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [billingCycle, setBillingCycle] = useState("YEARLY");

  const hasYearlyPricing = packages.some((pkg) => pkg.priceYearly != null);
  const isYearly = billingCycle === "YEARLY";

  useEffect(() => {
    if (!isAuthenticated) return;
    const checkoutHandled = sessionStorage.getItem("loan_ai_checkout_handled");
    if (checkoutHandled === "true") {
      sessionStorage.removeItem("loan_ai_checkout_handled");
      return;
    }
    refreshUser();
  }, [isAuthenticated, refreshUser]);

  useEffect(() => {
    let cancelled = false;

    async function loadPricing() {
      try {
        setLoading(true);
        setError("");
        const { packages: loadedPackages, addOns: loadedAddOns } =
          await fetchSubscriptionPackages();
        if (!cancelled) {
          setPackages(loadedPackages);
          setAddOns(loadedAddOns);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load pricing");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPricing();
    return () => {
      cancelled = true;
    };
  }, []);

  function getPackageSelections(pkgId) {
    return selectedByPackage[pkgId] || [];
  }

  function updatePackageSelections(pkgId, nextCodes) {
    setSelectedByPackage((prev) => ({
      ...prev,
      [pkgId]: nextCodes,
    }));
  }

  return (
    <section
      id="pricing"
      className="relative scroll-mt-24 overflow-hidden bg-slate-50 px-6 py-24 transition-colors md:py-28 dark:bg-black"
    >
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[#4B83FF]/20 blur-[120px]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl text-center">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[#4B83FF]">
          Pricing
        </p>

        <h2 className="mb-4 text-3xl font-bold text-slate-900 md:text-5xl dark:text-white">
          Scale Your <span className="text-emerald-500">Brokerage</span> Faster
        </h2>

        <p className="mx-auto mb-10 max-w-2xl text-slate-600 dark:text-gray-400">
          Transparent pricing for high-value loan brokerage workflows. Start
          with a {user?.freeTrialDays || 14}-day free trial — no card required.
        </p>

        {!loading && !error && hasYearlyPricing && (
          <div className="mb-12 flex flex-wrap items-center justify-center gap-3">
            <span
              className={`text-sm font-bold transition ${
                !isYearly
                  ? "text-slate-900 dark:text-white"
                  : "text-slate-500 dark:text-gray-400"
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
              onClick={() => setBillingCycle(isYearly ? "MONTHLY" : "YEARLY")}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4B83FF] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black ${
                isYearly ? "bg-[#4B83FF]" : "bg-slate-300 dark:bg-white/25"
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
                isYearly
                  ? "text-slate-900 dark:text-white"
                  : "text-slate-500 dark:text-gray-400"
              }`}
            >
              Yearly
            </span>

            <span className="inline-block animate-save-badge rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm shadow-emerald-500/40">
              Save {YEARLY_SAVE_PERCENT}%
            </span>
          </div>
        )}

        {loading && <PricingSkeleton />}

        {!loading && error && (
          <div className="mx-auto max-w-xl rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-8 text-red-200">
            <p className="mb-1 font-medium">Could not load pricing</p>
            <p className="text-sm text-red-300/80">{error}</p>
          </div>
        )}

        {!loading && !error && packages.length === 0 && (
          <p className="text-slate-500 dark:text-gray-400">
            Pricing plans coming soon.
          </p>
        )}

        {!loading && !error && packages.length > 0 && (
          <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-3">
            {packages.map((pkg) => {
              const accent = getAccent(pkg.code);
              const isPopular = Boolean(pkg.isPopular);
              const userBillingCycle = user?.subscribedBillingCycle || "MONTHLY";
              const isOnTrial = user?.subscriptionStatus === "TRIAL";
              const isCurrentPlan =
                Boolean(user?.hasBrokerSubscription) &&
                user?.subscribedPackageId === pkg.id &&
                userBillingCycle === billingCycle;

              const featureGroups = normalizeFeatureGroups(pkg);
              const planBadge =
                pkg.badge || (isPopular ? "MOST POPULAR" : null);

              const { amount, suffix, billingLabel, billedToday } =
                getDisplayPrice(pkg, billingCycle);
              const savings =
                billingCycle === "YEARLY"
                  ? getYearlySavingsPercent(pkg) || YEARLY_SAVE_PERCENT
                  : null;

              const selectedCodes = getPackageSelections(pkg.id);
              const packageAddOns = filterAddOnsForPackage(addOns, pkg.code);
              const extraUserAddOn = packageAddOns.find((a) =>
                isQuantityAddOn(a),
              );
              const extraUserQty = extraUserAddOn
                ? getAddOnQuantity(selectedCodes, extraUserAddOn.code)
                : 0;

              const applicableAddOns = getApplicableSelectedAddOns(
                addOns,
                selectedCodes,
                pkg.code,
              ).map((addOn) => {
                if (!isQuantityAddOn(addOn)) return addOn;
                const unit =
                  Number(pkg.extraUserPrice) > 0
                    ? Number(pkg.extraUserPrice)
                    : Number(addOn.priceMonthly);
                return { ...addOn, priceMonthly: unit };
              });

              const addOnsAmount = getAddOnsCycleTotal(
                applicableAddOns,
                billingCycle,
              );
              // When yearly, display monthly equivalent of plan + add-ons
              const displayTotal =
                billingCycle === "YEARLY"
                  ? amount + Math.round(addOnsAmount / 12)
                  : Number(amount) + addOnsAmount;
              const displayBilledToday =
                billingCycle === "YEARLY" && billedToday != null
                  ? Number(billedToday) + Number(addOnsAmount || 0)
                  : null;

              const addOnCodesForCheckout =
                expandAddOnCodesForCheckout(applicableAddOns);

              const checkoutState = buildPlanCheckoutState(
                pkg,
                billingCycle,
                formatPrice,
                addOnCodesForCheckout,
              );
              const trialCheckoutState = buildPlanCheckoutState(
                pkg,
                billingCycle,
                formatPrice,
                [],
                { mode: "trial" },
              );
              const demoState = {
                planCode: pkg.code,
                planName: pkg.name,
                planMessage: planDemoMessage(pkg, billingCycle),
              };

              return (
                <article
                  key={pkg.id}
                  className={`relative flex flex-col rounded-3xl border bg-white p-8 text-left backdrop-blur-xl transition-all duration-300 dark:bg-white/5 ${
                    isCurrentPlan
                      ? isOnTrial
                        ? "border-sky-400/40 bg-sky-500/[0.08] shadow-[0_0_40px_rgba(56,189,248,0.15)]"
                        : "border-emerald-400/40 bg-emerald-500/[0.08] shadow-[0_0_40px_rgba(16,185,129,0.15)]"
                      : accent.ring
                  } ${isPopular || isCurrentPlan ? "z-10" : ""}`}
                >
                  {isCurrentPlan && (
                    <span
                      className={`absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-1 text-xs font-semibold shadow-lg ${
                        isOnTrial
                          ? "bg-linear-to-r from-sky-500 to-blue-500 text-white"
                          : "bg-linear-to-r from-emerald-500 to-teal-500 text-white"
                      }`}
                    >
                      {isOnTrial ? "Your Trial" : "Your Plan"}
                    </span>
                  )}

                  {planBadge && !isCurrentPlan && (
                    <span
                      className={`absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-1 text-xs font-semibold shadow-lg ${
                        String(planBadge).toUpperCase().includes("VALUE")
                          ? "bg-emerald-500 text-white"
                          : "bg-[#4B83FF] text-white"
                      }`}
                    >
                      {planBadge}
                    </span>
                  )}

                  <h3 className="mb-4 text-2xl font-bold text-slate-900 dark:text-white">
                    {pkg.name}
                  </h3>

                  <div className="mb-6">
                    <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
                      <span
                        className={`text-4xl font-bold md:text-5xl ${accent.price}`}
                      >
                        {formatPrice(displayTotal)}
                      </span>
                      <span className="mb-1 text-sm text-slate-500 dark:text-gray-400">
                        {suffix}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
                      {billingLabel}
                    </p>
                    {displayBilledToday != null && (
                      <p className="mt-1.5 text-sm font-semibold text-slate-800 dark:text-gray-100">
                        {formatPrice(displayBilledToday)} billed today
                      </p>
                    )}
                    {savings != null && savings > 0 && (
                      <p className="mt-2 text-sm font-medium text-emerald-500">
                        Save {savings}% vs monthly
                      </p>
                    )}
                  </div>

                  {extraUserAddOn && (
                    <UserSlider
                      pkg={pkg}
                      quantity={extraUserQty}
                      formatPrice={formatPrice}
                      onChange={(qty) =>
                        updatePackageSelections(
                          pkg.id,
                          setAddOnQuantity(
                            selectedCodes,
                            extraUserAddOn.code,
                            qty,
                            Math.min(
                              MAX_QUANTITY_ADDON,
                              Math.max(
                                0,
                                Number(pkg.maxUsers || 5) -
                                  Number(pkg.includedUsers || 1),
                              ),
                            ),
                          ),
                        )
                      }
                    />
                  )}

                  <FeatureGroupsList groups={featureGroups} />

                  <InCardAddOns
                    addOns={packageAddOns}
                    selectedCodes={selectedCodes}
                    formatPrice={formatPrice}
                    onToggle={(code) =>
                      updatePackageSelections(
                        pkg.id,
                        toggleAddOnCode(selectedCodes, code),
                      )
                    }
                  />

                  <PricingPlanCta
                    pkg={pkg}
                    checkoutState={checkoutState}
                    trialCheckoutState={trialCheckoutState}
                    demoState={demoState}
                    freeTrialDays={user?.freeTrialDays || 14}
                  />
                </article>
              );
            })}
          </div>
        )}

        {!loading && !error && packages.length > 0 && (
          <PlanComparison packages={packages} />
        )}

        <p className="mt-10 text-sm text-slate-600 dark:text-gray-400">
          {user?.freeTrialDays || 14}-day free trial on every plan. No long-term
          contracts. Cancel anytime.
        </p>

        {!loading && !error && packages.length > 0 && (
          <PricingClosingCta
            startingPrice={packages.reduce((min, pkg) => {
              const price = Number(pkg.priceMonthly);
              if (!Number.isFinite(price)) return min;
              return min == null ? price : Math.min(min, price);
            }, null)}
          />
        )}
      </div>
    </section>
  );
};

export default Pricing;
