import { useEffect, useState } from "react";

import { Check } from "lucide-react";

import { fetchSubscriptionPackages } from "../lib/api";
import {
  getAddOnAvailabilityLabel,
  getAddOnsCycleTotal,
  getApplicableSelectedAddOns,
  toggleAddOnCode,
} from "../lib/addOnCheckout";
import { buildPlanCheckoutState } from "../lib/planCheckout";
import PricingPlanCta from "./PricingPlanCta";
import PlanComparison from "./PlanComparison";
import PricingClosingCta from "./PricingClosingCta";
import { useAuth } from "../context/AuthContext";

const TIER_ACCENTS = {
  BASIC: {
    ring: "border-white/10",
    badge: "bg-white/10 text-gray-300",
    price: "text-white",
    glow: "",
  },
  PRO: {
    ring: "border-[#4B83FF]/45 shadow-[0_0_60px_rgba(75,131,255,0.22)]",
    badge: "bg-[#4B83FF]/15 text-[#4B83FF]",
    price: "text-white",
    glow: "scale-[1.02] md:scale-105",
  },
  ELITE: {
    ring: "border-amber-400/35 shadow-[0_0_40px_rgba(251,191,36,0.12)]",
    badge: "bg-amber-500/15 text-amber-300",
    price: "text-amber-100",
    glow: "",
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

/**
 * Prefer structured featureGroups from the API; fall back to flat features.
 * @returns {{ heading: string | null, variant: string, items: string[] }[]}
 */
function normalizeFeatureGroups(pkg) {
  if (Array.isArray(pkg?.featureGroups) && pkg.featureGroups.length > 0) {
    return pkg.featureGroups
      .map((group) => ({
        heading: group?.heading ? String(group.heading).trim() : null,
        variant: group?.variant === "highlight" ? "highlight" : "default",
        items: Array.isArray(group?.items)
          ? group.items.map((item) => String(item).trim()).filter(Boolean)
          : [],
      }))
      .filter((group) => group.items.length > 0);
  }

  const features = normalizeFeatures(pkg?.features);
  if (!features.length) return [];
  return [{ heading: null, variant: "default", items: features }];
}

function FeatureGroupsList({ groups }) {
  if (!groups?.length) return null;

  return (
    <div className="mb-8 flex-1 space-y-5">
      {groups.map((group, groupIndex) => {
        const isHighlight = group.variant === "highlight";
        return (
          <div
            key={`${group.heading || "features"}-${groupIndex}`}
            className={
              isHighlight
                ? "rounded-2xl border border-amber-400/30 bg-amber-500/[0.06] p-4"
                : ""
            }
          >
            {group.heading && (
              <p
                className={`mb-3 text-[11px] font-bold uppercase tracking-wider ${
                  isHighlight ? "text-amber-300" : "text-blue-400"
                }`}
              >
                {group.heading}
              </p>
            )}
            <ul className="space-y-2.5">
              {group.items.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <Check
                    className={`shrink-0 mt-0.5 ${
                      isHighlight ? "text-amber-400" : "text-blue-400"
                    }`}
                    size={18}
                  />
                  <span className="text-gray-200 text-sm">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}



function getDisplayPrice(pkg, billingCycle) {

  if (billingCycle === "YEARLY" && pkg.priceYearly != null) {

    return {

      amount: pkg.priceYearly,

      suffix: "/year",

      sublabel:

        pkg.priceMonthly != null

          ? `${formatPrice(pkg.priceMonthly)}/mo when billed annually`

          : null,

    };

  }

  return {

    amount: pkg.priceMonthly,

    suffix: "/month",

    sublabel: null,

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
  const cycleLabel = billingCycle === "YEARLY" ? "yearly" : "monthly";
  const { amount } = getDisplayPrice(pkg, billingCycle);
  return `Interested in the ${pkg.name} plan (${pkg.code}) — ${formatPrice(amount)}/${billingCycle === "YEARLY" ? "year" : "month"} (${cycleLabel} billing).`;
}



function formatUsageLimit(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return String(n);
}

const USAGE_LIMIT_LABELS = {
  LOAN_APPLICATIONS: "Loan apps / mo",
  ACTIVE_USERS: "Active users",
  LOAN_OFFICERS: "Loan officers",
  LENDER_CONNECTIONS: "Lender connections",
};

function UsageLimitsSummary({ limits }) {
  if (!limits || typeof limits !== "object") return null;

  const entries = Object.entries(USAGE_LIMIT_LABELS).filter(
    ([key]) => limits[key] != null,
  );

  if (entries.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
        Usage limits
      </p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
        {entries.map(([key, label]) => (
          <div key={key}>
            <dt className="text-[11px] text-gray-500 leading-tight">{label}</dt>
            <dd className="text-sm font-semibold text-white">
              {formatUsageLimit(limits[key])}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function AddOnsSection({
  addOns,
  selectedCodes,
  onChange,
  onClear,
  formatPrice,
  billingCycle,
}) {
  if (!addOns?.length) return null;

  const cycleSuffix = billingCycle === "YEARLY" ? "/yr" : "/mo";
  const selectedCount = selectedCodes.length;

  return (
    <div id="customize-addons" className="mb-14 max-w-5xl mx-auto text-left scroll-mt-24">
      <div className="text-center mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#4B83FF] mb-2">
          Customize
        </p>
        <h3 className="text-xl md:text-2xl font-bold text-white mb-2">
          Available Add-Ons
        </h3>
        <p className="text-sm text-gray-400 max-w-xl mx-auto">
          Tap add-ons to customize each plan. Prices update in real time — only
          add-ons that apply to a plan are added to that card.
        </p>
      </div>

      {selectedCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-[#4B83FF]/25 bg-[#4B83FF]/10 px-4 py-3">
          <p className="text-sm text-[#4B83FF] font-medium">
            {selectedCount} add-on{selectedCount === 1 ? "" : "s"} selected · plan
            prices updated below
          </p>
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-semibold uppercase tracking-wide text-white/80 hover:text-white underline underline-offset-2"
          >
            Clear all
          </button>
        </div>
      )}

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {addOns.map((addOn) => {
          const selected = selectedCodes.some(
            (code) =>
              String(code).toUpperCase() === String(addOn.code).toUpperCase(),
          );
          const cycleAmount =
            billingCycle === "YEARLY"
              ? Number(addOn.priceMonthly) * 12
              : Number(addOn.priceMonthly);
          const availability = getAddOnAvailabilityLabel(addOn);

          return (
            <li key={addOn.code || addOn.name}>
              <button
                type="button"
                onClick={() => onChange(toggleAddOnCode(selectedCodes, addOn.code))}
                aria-pressed={selected}
                className={`w-full text-left rounded-2xl border px-5 py-4 transition-all duration-200 ${
                  selected
                    ? "border-[#4B83FF]/60 bg-[#4B83FF]/15 shadow-[0_0_24px_rgba(75,131,255,0.2)]"
                    : "border-white/10 bg-white/[0.04] hover:border-[#4B83FF]/30 hover:bg-white/[0.06]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                        selected
                          ? "border-[#4B83FF] bg-[#4B83FF] text-white"
                          : "border-white/25 bg-transparent"
                      }`}
                    >
                      {selected ? <Check size={12} strokeWidth={3} /> : null}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-100">{addOn.name}</p>
                      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                        {availability}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-[#4B83FF] whitespace-nowrap">
                    +{formatPrice(cycleAmount)}
                    {cycleSuffix}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PlanPriceBlock({
  accent,
  billingCycle,
  baseAmount,
  suffix,
  sublabel,
  savings,
  applicableAddOns,
  formatPrice,
}) {
  const addOnsAmount = getAddOnsCycleTotal(applicableAddOns, billingCycle);
  const totalAmount = Number(baseAmount) + addOnsAmount;
  const hasAddOns = applicableAddOns.length > 0;

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
        <span className={`text-4xl md:text-5xl font-bold ${accent.price}`}>
          {formatPrice(totalAmount)}
        </span>
        <span className="text-gray-400 text-base mb-1">{suffix}</span>
      </div>

      {hasAddOns ? (
        <div className="mt-3 space-y-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
          <p className="flex justify-between gap-3 text-xs text-gray-400">
            <span>Base plan</span>
            <span>{formatPrice(baseAmount)}</span>
          </p>
          {applicableAddOns.map((addOn) => {
            const line =
              billingCycle === "YEARLY"
                ? Number(addOn.priceMonthly) * 12
                : Number(addOn.priceMonthly);
            return (
              <p
                key={addOn.code}
                className="flex justify-between gap-3 text-xs text-[#4B83FF]"
              >
                <span className="truncate">+ {addOn.name}</span>
                <span className="shrink-0">{formatPrice(line)}</span>
              </p>
            );
          })}
          <p className="flex justify-between gap-3 border-t border-white/10 pt-1.5 text-xs font-semibold text-white">
            <span>Custom total</span>
            <span>{formatPrice(totalAmount)}</span>
          </p>
        </div>
      ) : (
        <>
          {sublabel && (
            <p className="text-sm text-gray-500 mt-2">{sublabel}</p>
          )}
          {savings != null && savings > 0 && (
            <p className="text-sm text-emerald-400 mt-2 font-medium">
              Save {savings}% vs monthly
            </p>
          )}
        </>
      )}

      {hasAddOns && savings != null && savings > 0 && (
        <p className="text-sm text-emerald-400 mt-2 font-medium">
          Save {savings}% on base plan vs monthly
        </p>
      )}
    </div>
  );
}



function PricingSkeleton() {

  return (

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">

      {[1, 2, 3].map((i) => (

        <div

          key={i}

          className="h-[420px] rounded-3xl bg-white/5 border border-white/10 animate-pulse"

        />

      ))}

    </div>

  );

}



const Pricing = () => {
  const { isAuthenticated, user, refreshUser } = useAuth();
  const [packages, setPackages] = useState([]);
  const [addOns, setAddOns] = useState([]);
  const [selectedAddOnCodes, setSelectedAddOnCodes] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [billingCycle, setBillingCycle] = useState("MONTHLY");



  const hasYearlyPricing = packages.some((pkg) => pkg.priceYearly != null);

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



  return (

    <section

      id="pricing"

      className="scroll-mt-24 relative overflow-hidden bg-black py-24 px-6 md:py-28"

    >

      <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[#4B83FF]/20 blur-[120px]" aria-hidden />



      <div className="relative max-w-6xl mx-auto text-center">

        <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[#4B83FF]">
          Pricing
        </p>

        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">

          Simple{" "}

          <span className="text-[#4B83FF]">

            Pricing

          </span>

        </h2>



        <p className="text-gray-400 mb-10 max-w-2xl mx-auto">

          Choose the plan that fits your brokerage. Start with a{" "}

          {user?.freeTrialDays || 14}-day free trial — no card required. Upgrade

          or cancel anytime.

        </p>



        {!loading && !error && hasYearlyPricing && (

          <div className="inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/15 p-1 mb-12">

            <button

              type="button"

              onClick={() => setBillingCycle("MONTHLY")}

              className={`px-5 py-2 rounded-full text-sm font-semibold transition ${

                billingCycle === "MONTHLY"

                  ? "bg-white text-[#0b0f2a] shadow"

                  : "text-gray-300 hover:text-white"

              }`}

            >

              Monthly

            </button>

            <button

              type="button"

              onClick={() => setBillingCycle("YEARLY")}

              className={`px-5 py-2 rounded-full text-sm font-semibold transition ${

                billingCycle === "YEARLY"

                  ? "bg-white text-[#0b0f2a] shadow"

                  : "text-gray-300 hover:text-white"

              }`}

            >

              Yearly

            </button>

          </div>

        )}



        {!loading && !error && addOns.length > 0 && (
          <AddOnsSection
            addOns={addOns}
            selectedCodes={selectedAddOnCodes}
            onChange={setSelectedAddOnCodes}
            onClear={() => setSelectedAddOnCodes([])}
            formatPrice={formatPrice}
            billingCycle={billingCycle}
          />
        )}

        {loading && <PricingSkeleton />}



        {!loading && error && (

          <div className="max-w-xl mx-auto rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-8 text-red-200">

            <p className="font-medium mb-1">Could not load pricing</p>

            <p className="text-sm text-red-300/80">{error}</p>

          </div>

        )}



        {!loading && !error && packages.length === 0 && (

          <p className="text-gray-400">Pricing plans coming soon.</p>

        )}



        {!loading && !error && packages.length > 0 && (

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">

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
                pkg.badge ||
                (isPopular ? "MOST POPULAR" : null);

              const { amount, suffix, sublabel } = getDisplayPrice(pkg, billingCycle);

              const savings = billingCycle === "YEARLY" ? getYearlySavingsPercent(pkg) : null;

              const applicableAddOns = getApplicableSelectedAddOns(
                addOns,
                selectedAddOnCodes,
                pkg.code,
              );
              const addOnCodesForCheckout = applicableAddOns.map((a) => a.code);

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

                  className={`relative flex flex-col text-left backdrop-blur-xl border rounded-3xl p-8 transition-all duration-300 ${

                    isCurrentPlan
                      ? isOnTrial
                        ? "bg-sky-500/[0.08] border-sky-400/40 shadow-[0_0_40px_rgba(56,189,248,0.15)]"
                        : "bg-emerald-500/[0.08] border-emerald-400/40 shadow-[0_0_40px_rgba(16,185,129,0.15)]"
                      : `bg-white/5 hover:bg-white/[0.07] ${accent.ring}`
                  } ${isPopular && !isCurrentPlan ? accent.glow : ""} ${

                    isPopular || isCurrentPlan ? "z-10" : ""

                  }`}

                >

                  {isCurrentPlan && (

                    <span className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-semibold shadow-lg whitespace-nowrap ${
                      isOnTrial
                        ? "bg-linear-to-r from-sky-500 to-blue-500 text-white"
                        : "bg-linear-to-r from-emerald-500 to-teal-500 text-white"
                    }`}>

                      {isOnTrial ? "Your Trial" : "Your Plan"}

                    </span>

                  )}

                  {planBadge && !isCurrentPlan && (

                    <span
                      className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-semibold shadow-lg whitespace-nowrap ${
                        String(planBadge).toUpperCase().includes("VALUE")
                          ? "bg-linear-to-r from-amber-400 to-yellow-500 text-slate-900"
                          : "bg-linear-to-r from-blue-500 to-indigo-500 text-white"
                      }`}
                    >
                      {planBadge}
                    </span>

                  )}



                  <h3 className="text-2xl font-bold text-white mb-2">{pkg.name}</h3>



                  {pkg.description && (

                    <p className="text-sm text-gray-400 mb-6 leading-relaxed min-h-[40px]">

                      {pkg.description}

                    </p>

                  )}



                  <PlanPriceBlock
                    accent={accent}
                    billingCycle={billingCycle}
                    baseAmount={amount}
                    suffix={suffix}
                    sublabel={sublabel}
                    savings={savings}
                    applicableAddOns={applicableAddOns}
                    formatPrice={formatPrice}
                  />

                  {pkg.usersLabel ? (
                    <p className="text-sm text-gray-400 mb-6">{pkg.usersLabel}</p>
                  ) : (
                    <UsageLimitsSummary limits={pkg.usageLimits} />
                  )}

                  <FeatureGroupsList groups={featureGroups} />



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

        <p className="text-gray-400 text-sm mt-10">
          {user?.freeTrialDays || 14}-day free trial on every plan. No long-term
          contracts. Cancel anytime.
        </p>

        {!loading && !error && packages.length > 0 && (
          <PricingClosingCta
            startingPrice={
              packages.reduce((min, pkg) => {
                const price = Number(pkg.priceMonthly);
                if (!Number.isFinite(price)) return min;
                return min == null ? price : Math.min(min, price);
              }, null)
            }
          />
        )}

      </div>

    </section>

  );

};



export default Pricing;


