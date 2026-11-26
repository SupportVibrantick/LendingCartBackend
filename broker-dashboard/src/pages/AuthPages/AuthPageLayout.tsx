import { Link } from "react-router";
import GridShape from "../../components/common/GridShape";
import ThemeTogglerTwo from "../../components/common/ThemeTogglerTwo";
import "../../pages/ClientPortal/clientPortalTheme.css";

export type AuthPortal = "broker" | "sub-broker" | "loan-officer";

const PORTAL_BRAND: Record<
  AuthPortal,
  {
    title: string;
    subtitle: string;
    homePath: string;
    features: string[];
  }
> = {
  broker: {
    title: "Broker Portal",
    subtitle: "Smart Loans for Smarter Businesses.",
    homePath: "/signin",
    features: [
      "Manage loan pipeline in one place",
      "Match borrowers with lenders instantly",
      "Track applications and documents",
      "Collaborate with loan officers & co-brokers",
    ],
  },
  "loan-officer": {
    title: "Officer Portal",
    subtitle: "Your assigned pipeline, clients, and documents — in one place.",
    homePath: "/loan-officer/login",
    features: [
      "Create and manage assigned applications",
      "Work with borrowers and co-brokers",
      "Upload documents and track progress",
      "Chat securely with your broker team",
    ],
  },
  "sub-broker": {
    title: "Co-Broker Portal",
    subtitle: "Collaborate on assigned loans with your broker team.",
    homePath: "/sub-broker/login",
    features: [
      "Work assigned loan applications",
      "Upload and manage borrower documents",
      "Stay in sync with the broker team",
      "Track application progress in real time",
    ],
  },
};

export default function AuthLayout({
  children,
  wide = false,
  portal = "broker",
}: {
  children: React.ReactNode;
  /** Wider form column for multi-section flows (team join). */
  wide?: boolean;
  portal?: AuthPortal;
}) {
  const brand = PORTAL_BRAND[portal] || PORTAL_BRAND.broker;

  return (
    <div className="relative h-dvh overflow-hidden bg-white font-[Inter,ui-sans-serif,system-ui,sans-serif] antialiased dark:bg-gray-950">
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
        <div className="relative hidden h-full min-h-0 shrink-0 overflow-hidden bg-[#4C78F5] lg:flex lg:flex-1">
          <div className="absolute inset-0 bg-[linear-gradient(145deg,#4C78F5_0%,#3A5FD4_45%,#2E4BB0_100%)]" />
          <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-white/15 blur-[100px]" />
          <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-[#93B4FF]/20 blur-[80px]" />

          <GridShape />

          <div className="relative z-10 flex h-full flex-col items-center justify-center px-12 text-center">
            <Link
              to={brand.homePath}
              className="mb-8 block transition hover:scale-[1.02]"
            >
              <div className="mx-auto h-24 w-24 overflow-hidden rounded-full shadow-2xl shadow-black/30 ring-4 ring-white/15">
                <img
                  src="/loanAutomation.jpeg"
                  alt="Loan Automation"
                  className="h-full w-full object-cover"
                />
              </div>
            </Link>

            <h2 className="text-3xl font-semibold tracking-tight text-white xl:text-[34px]">
              {brand.title}
            </h2>
            <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-white/65">
              {brand.subtitle}
            </p>

            <ul className="mt-10 space-y-3 text-left">
              {brand.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-3 text-sm text-white/80"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs text-white">
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
