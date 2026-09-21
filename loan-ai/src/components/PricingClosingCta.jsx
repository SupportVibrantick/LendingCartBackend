import { Link } from "react-router-dom";
import { ArrowRight, Home } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getBrokerSignInUrl } from "../lib/brokerAuth";

const STATS = [
  { value: "100+", label: "Lenders" },
  { value: "12+", label: "Loan Types" },
  { value: "4", label: "Portals" },
  { value: "$199", label: "Starting Price", key: "startingPrice" },
];

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
      <div className="h-14 w-72 max-w-full rounded-xl bg-blue-500/30 animate-pulse" />
    );
  } else if (hasSubscription) {
    cta = (
      <a
        href={getBrokerSignInUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4B83FF] px-8 py-4 text-base font-semibold text-white shadow-[0_0_40px_rgba(75,131,255,0.35)] transition hover:bg-[#3d73ef] hover:scale-[1.02]"
      >
        Open broker dashboard
        <ArrowRight size={18} />
      </a>
    );
  } else if (isAuthenticated) {
    cta = (
      <Link
        to="/#pricing"
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4B83FF] px-8 py-4 text-base font-semibold text-white shadow-[0_0_40px_rgba(75,131,255,0.35)] transition hover:bg-[#3d73ef] hover:scale-[1.02]"
      >
        Choose a plan
        <ArrowRight size={18} />
      </Link>
    );
  } else {
    cta = (
      <Link
        to="/signup"
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4B83FF] px-8 py-4 text-base font-semibold text-white shadow-[0_0_40px_rgba(75,131,255,0.35)] transition hover:bg-[#3d73ef] hover:scale-[1.02]"
      >
        Start Your 14-Day Free Trial
        <ArrowRight size={18} />
      </Link>
    );
  }

  return (
    <div className="mt-20 -mx-4 sm:-mx-6 lg:-mx-8">
      <section className="relative overflow-hidden px-6 py-20 md:py-24 text-center">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(37,99,235,0.28)_0%,_rgba(0,0,0,0)_65%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-[#0a1628]/80 to-black"
          aria-hidden
        />

        <div className="relative max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight tracking-tight">
            Ready to Close More Deals{" "}
            <span className="text-[#4B83FF]">In Less Time?</span>
          </h2>

          <p className="mt-6 text-sm sm:text-base text-gray-300 leading-relaxed max-w-2xl mx-auto">
            Join the brokers using Loan Automation to close deals 87% faster. Get
            your branded website, smart loan wizard, automated lender matching,
            client portal, and full GHL integration — all in one platform.
          </p>

          <div className="mt-10 flex justify-center">{cta}</div>

          <dl className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-6">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <dt className="sr-only">{stat.label}</dt>
                <dd className="text-3xl md:text-4xl font-bold text-[#4B83FF]">
                  {stat.value}
                </dd>
                <p className="mt-1.5 text-sm text-gray-400">{stat.label}</p>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="border-t border-white/5 bg-black px-4 py-3">
        <p className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center text-[11px] sm:text-xs text-gray-500">
          <Home size={12} className="shrink-0 text-gray-500" aria-hidden />
          <span>
            Loan Automation — Close More Deals In Less Time • 87% Faster With Zero
            Chasing -{" "}
            <a
              href="https://loanautomation.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-300 transition"
            >
              loanautomation.com
            </a>
          </span>
        </p>
      </div>
    </div>
  );
}
