import { Link } from "react-router";
import GridShape from "../../components/common/GridShape";
import ThemeTogglerTwo from "../../components/common/ThemeTogglerTwo";

const FEATURES = [
  "Review and approve loan applications",
  "Set products, rates, and lending criteria",
  "Communicate directly with brokers",
  "Track pipeline performance in real time",
];

export default function AuthLayout({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="relative min-h-screen bg-white dark:bg-gray-950">
      <div className="flex min-h-screen flex-col lg:flex-row">
        {/* Form panel */}
        <div className="relative flex min-h-screen w-full items-start justify-center overflow-y-auto lg:w-[48%] xl:w-[44%] lg:items-center">
          <div
            className={`w-full px-6 py-8 sm:px-10 lg:px-8 lg:py-10 ${
              wide ? "max-w-xl" : "max-w-md"
            }`}
          >
            {children}
          </div>
        </div>

        {/* Brand panel */}
        <div className="relative hidden overflow-hidden bg-[#0d3532] lg:flex lg:flex-1">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#0d3532_0%,#134E4A_50%,#1a6b65_100%)]" />
          <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-emerald-400/20 blur-[100px]" />
          <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-teal-500/20 blur-[80px]" />

          <GridShape />

          <div className="relative z-10 flex flex-col items-center justify-center px-12 text-center">
            <Link to="/" className="mb-8 block transition hover:scale-[1.02]">
              <div className="mx-auto h-28 w-28 overflow-hidden rounded-full ring-4 ring-white/20 shadow-2xl shadow-black/30">
                <img
                  src="/loanAutomation.jpeg"
                  alt="Loan Automation"
                  className="h-full w-full object-cover"
                />
              </div>
            </Link>

            <h2 className="text-3xl font-bold tracking-tight text-white xl:text-4xl">
              Lender Portal
            </h2>
            <p className="mt-3 max-w-sm text-base leading-relaxed text-emerald-100/80">
              Smart Loans for Smarter Businesses.
            </p>

            <ul className="mt-10 space-y-3 text-left">
              {FEATURES.map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-3 text-sm text-emerald-50/90"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs text-emerald-200">
                    {"\u2713"}
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="fixed bottom-6 right-6 z-50 hidden sm:block">
        <ThemeTogglerTwo />
      </div>
    </div>
  );
}
