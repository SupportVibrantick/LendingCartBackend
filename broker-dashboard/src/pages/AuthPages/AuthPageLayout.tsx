import { Link } from "react-router";
import GridShape from "../../components/common/GridShape";
import ThemeTogglerTwo from "../../components/common/ThemeTogglerTwo";

const FEATURES = [
  "Manage loan pipeline in one place",
  "Match borrowers with lenders instantly",
  "Track applications and documents",
  "Collaborate with loan officers & co-brokers",
];

export default function AuthLayout({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  /** Wider form column for multi-section flows (team join). */
  wide?: boolean;
}) {
  return (
    <div className="relative h-dvh overflow-hidden bg-white dark:bg-gray-950">
      <div className="flex h-full min-h-0 flex-col lg:flex-row">
        {/* Form panel — only this side scrolls */}
        <div
          className={`auth-form-scrollbar relative flex h-full min-h-0 w-full justify-center overflow-y-auto overscroll-contain ${
            wide ? "lg:w-[58%] xl:w-[60%]" : "lg:w-[48%] xl:w-[44%]"
          }`}
        >
          <div
            className={`my-auto w-full px-4 py-6 sm:px-5 lg:px-5 ${
              wide ? "max-w-2xl xl:max-w-3xl" : "max-w-md"
            }`}
          >
            {children}
          </div>
        </div>

        {/* Brand panel — fixed, never scrolls */}
        <div className="relative hidden h-full min-h-0 shrink-0 overflow-hidden bg-[#0b1f3a] lg:flex lg:flex-1">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#0b1f3a_0%,#13538A_45%,#1a6aad_100%)]" />
          <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-cyan-400/20 blur-[100px]" />
          <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-blue-500/20 blur-[80px]" />

          <GridShape />

          <div className="relative z-10 flex h-full flex-col items-center justify-center px-12 text-center">
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
              Broker Dashboard
            </h2>
            <p className="mt-3 max-w-sm text-base leading-relaxed text-blue-100/80">
              Smart Loans for Smarter Businesses.
            </p>

            <ul className="mt-10 space-y-3 text-left">
              {FEATURES.map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-3 text-sm text-blue-50/90"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs text-cyan-200">
                    ✓
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
