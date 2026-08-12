import { useEffect, useState } from "react";

import { Check } from "lucide-react";

import { fetchSubscriptionPackages } from "../lib/api";
import { buildPlanCheckoutState } from "../lib/planCheckout";
import PricingPlanCta from "./PricingPlanCta";
import { useAuth } from "../context/AuthContext";

const TIER_ACCENTS = {
  BASIC: {

    ring: "border-white/10",

    badge: "bg-white/10 text-gray-300",

    price: "text-white",

    glow: "",

  },

  PRO: {

    ring: "border-indigo-400/40 shadow-[0_0_60px_rgba(99,102,241,0.25)]",

    badge: "bg-indigo-500/20 text-indigo-300",

    price: "text-white",

    glow: "scale-[1.02] md:scale-105",

  },

  ELITE: {

    ring: "border-amber-400/30",

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

function AddOnsSection({ addOns, formatPrice }) {
  if (!addOns?.length) return null;

  return (
    <div className="mt-16 max-w-4xl mx-auto text-left">
      <h3 className="text-xl md:text-2xl font-bold text-white text-center mb-2">
        Optional add-ons
      </h3>
      <p className="text-sm text-gray-400 text-center mb-8">
        Extend any plan with product packs, extra seats, and integrations. Select add-ons during
        checkout when you subscribe.
      </p>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {addOns.map((addOn) => (
          <li
            key={addOn.code || addOn.name}
            className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4"
          >
            <div>
              <p className="text-sm font-medium text-gray-100">{addOn.name}</p>
              {addOn.note && (
                <p className="text-xs text-gray-500 mt-1">{addOn.note}</p>
              )}
            </div>
            <span className="text-sm font-semibold text-indigo-300 whitespace-nowrap">
              +{formatPrice(addOn.priceMonthly)}/mo
            </span>
          </li>
        ))}
      </ul>
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

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [billingCycle, setBillingCycle] = useState("MONTHLY");



  const hasYearlyPricing = packages.some((pkg) => pkg.priceYearly != null);

  useEffect(() => {
    if (isAuthenticated) {
      refreshUser();
    }
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

      className="scroll-mt-24 bg-[#0b0f2a] py-28 px-6 relative overflow-hidden"

    >

      <div className="absolute -top-30 left-1/2 -translate-x-1/2 w-150 h-150 bg-indigo-500/20 blur-[120px] rounded-full" />



      <div className="relative max-w-6xl mx-auto text-center">

        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">

          Simple{" "}

          <span className="bg-linear-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">

            Pricing

          </span>

        </h2>



        <p className="text-gray-300 mb-10 max-w-2xl mx-auto">

          Choose the plan that fits your brokerage. No hidden fees — upgrade or

          cancel anytime.

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
              const isCurrentPlan =
                Boolean(user?.hasBrokerSubscription) &&
                user?.subscribedPackageId === pkg.id;

              const features = normalizeFeatures(pkg.features);

              const { amount, suffix, sublabel } = getDisplayPrice(pkg, billingCycle);

              const savings = billingCycle === "YEARLY" ? getYearlySavingsPercent(pkg) : null;

              const checkoutState = buildPlanCheckoutState(pkg, billingCycle, formatPrice);
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
                      ? "bg-emerald-500/[0.08] border-emerald-400/40 shadow-[0_0_40px_rgba(16,185,129,0.15)]"
                      : `bg-white/5 hover:bg-white/[0.07] ${accent.ring}`
                  } ${isPopular && !isCurrentPlan ? accent.glow : ""} ${

                    isPopular || isCurrentPlan ? "z-10" : ""

                  }`}

                >

                  {isCurrentPlan && (

                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-semibold bg-linear-to-r from-emerald-500 to-teal-500 text-white shadow-lg whitespace-nowrap">

                      Your Plan

                    </span>

                  )}

                  {isPopular && !isCurrentPlan && (

                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-semibold bg-linear-to-r from-blue-500 to-indigo-500 text-white shadow-lg">

                      Most Popular

                    </span>

                  )}



                  <span

                    className={`inline-flex w-fit px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide mb-4 ${accent.badge}`}

                  >

                    {pkg.code}

                  </span>



                  <h3 className="text-2xl font-bold text-white mb-2">{pkg.name}</h3>



                  {pkg.description && (

                    <p className="text-sm text-gray-400 mb-6 leading-relaxed min-h-[40px]">

                      {pkg.description}

                    </p>

                  )}



                  <div className="mb-8">

                    <span className={`text-4xl md:text-5xl font-bold ${accent.price}`}>

                      {formatPrice(amount)}

                    </span>

                    <span className="text-gray-400 text-base ml-1">{suffix}</span>

                    {sublabel && (

                      <p className="text-sm text-gray-500 mt-2">{sublabel}</p>

                    )}

                    {savings != null && savings > 0 && (

                      <p className="text-sm text-emerald-400 mt-2 font-medium">

                        Save {savings}% vs monthly

                      </p>

                    )}

                  </div>



                  <UsageLimitsSummary limits={pkg.usageLimits} />

                  {features.length > 0 && (

                    <ul className="space-y-3 mb-8 flex-1">

                      {features.map((feature) => (

                        <li key={feature} className="flex items-start gap-3">

                          <Check className="text-blue-400 shrink-0 mt-0.5" size={18} />

                          <span className="text-gray-200 text-sm">{feature}</span>

                        </li>

                      ))}

                    </ul>

                  )}



                  <PricingPlanCta
                    pkg={pkg}
                    checkoutState={checkoutState}
                    demoState={demoState}
                  />

                </article>

              );

            })}

          </div>

        )}

        {!loading && !error && addOns.length > 0 && (
          <AddOnsSection addOns={addOns} formatPrice={formatPrice} />
        )}



        <p className="text-gray-400 text-sm mt-10">

          No long-term contracts. Cancel anytime.

        </p>

      </div>

    </section>

  );

};



export default Pricing;


