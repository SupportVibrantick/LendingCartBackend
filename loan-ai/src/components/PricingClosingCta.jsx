import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getBrokerSignInUrl } from "../lib/brokerAuth";

const STATS = [
  { value: "100+", label: "Lenders" },
  { value: "12+", label: "Loan Types" },
  { value: "4", label: "Portals" },
  { value: "$199", label: "Starting Price", key: "startingPrice" },
];

const ctaClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#4B83FF] px-8 py-4 text-base font-semibold text-white shadow-[0_0_40px_rgba(75,131,255,0.25)] transition hover:scale-[1.02] hover:bg-[#3d73ef] dark:shadow-[0_0_40px_rgba(75,131,255,0.35)]";

/**
 * Closing CTA below the plan comparison table.
 * @param {{ startingPrice?: number | null }} props
 */
export default function PricingClosingCta({ startingPrice = 199 }) {
  const { isAuthenticated, user, loading } = useAuth();
  const hasSubscription = Boolean(user?.hasBrokerSubscription);

  const priceLabel =
    startingPrice != null && Number.isFinite(Number(startingPrice))
      ? `$${Math.round(Number(startingPrice))}`
      : "$199";

  const stats = STATS.map((stat) =>
    stat.key === "startingPrice" ? { ...stat, value: priceLabel } : stat,
  );

  let cta;
  if (loading) {
    cta = (
      <div className="h-14 w-72 max-w-full animate-pulse rounded-xl bg-[#4B83FF]/25" />
    );
  } else if (hasSubscription) {
    cta = (
      <a
        href={getBrokerSignInUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className={ctaClass}
      >
        Open broker dashboard
        <ArrowRight size={18} />
      </a>
    );
  } else if (isAuthenticated) {
    cta = (
      <Link to="/#pricing" className={ctaClass}>
        Choose a plan
        <ArrowRight size={18} />
      </Link>
    );
  } else {
    cta = (
      <Link to="/signup" className={ctaClass}>
        Start Your 14-Day Free Trial
        <ArrowRight size={18} />
      </Link>
    );
  }

  return (
    <div className="mt-20 -mx-4 sm:-mx-6 lg:-mx-8">
      <section className="relative overflow-hidden border-t border-slate-200 bg-slate-100 px-6 py-20 text-center text-slate-900 transition-colors md:py-24 dark:border-transparent dark:bg-[#07101f] dark:text-white">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(75,131,255,0.16)_0%,_rgba(0,0,0,0)_65%)] dark:bg-[radial-gradient(ellipse_at_center,_rgba(37,99,235,0.28)_0%,_rgba(0,0,0,0)_65%)]"
          aria-hidden
        />

        <div className="relative mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl md:text-5xl dark:text-white">
            Ready to Close More Deals{" "}
            <span className="text-[#4B83FF]">In Less Time?</span>
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-300">
            Join the brokers using Loan Automation to close deals 87% faster. Get
            your branded website, smart loan wizard, automated lender matching,
            client portal, and full GHL integration — all in one platform.
          </p>

          <div className="mt-10 flex justify-center">{cta}</div>

          <dl className="mt-14 grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-6">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <dt className="sr-only">{stat.label}</dt>
                <dd className="text-3xl font-bold text-[#4B83FF] md:text-4xl">
                  {stat.value}
                </dd>
                <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                  {stat.label}
                </p>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </div>
  );
}
