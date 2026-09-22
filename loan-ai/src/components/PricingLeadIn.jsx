import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  ClipboardList,
  FileSignature,
  FolderOpen,
  Globe2,
  KeyRound,
  PenLine,
  Target,
  UserRound,
  Zap,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getBrokerSignInUrl } from "../lib/brokerAuth";

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.55, ease: "easeOut" },
};

const HERO_STATS = [
  { value: "87%", label: "Less Time to Close" },
  { value: "100+", label: "Lenders" },
  { value: "12+", label: "Loan Types" },
  { value: "4", label: "Powerful Portals" },
];

const HOW_IT_WORKS = [
  {
    step: 1,
    title: "Submit Application",
    description:
      "Smart multi-step wizard with conditional logic by loan type. Real-time LTV, LTC & ARV calculator built in.",
    Icon: ClipboardList,
    iconClass: "text-amber-600 dark:text-amber-300",
  },
  {
    step: 2,
    title: "Instant Lender Matching",
    description:
      "Engine scores deals against 100+ lenders by type, LTV, LTC, DSCR, State & loan size. Ranked results with match reasons.",
    Icon: Target,
    iconClass: "text-rose-500 dark:text-rose-400",
  },
  {
    step: 3,
    title: "Automated Docs Collection",
    description:
      "Client portal auto-generates document checklist by loan program. Clients upload directly—no more email chains.",
    Icon: FolderOpen,
    iconClass: "text-amber-600 dark:text-amber-300",
  },
  {
    step: 4,
    title: "E-Sign & Close",
    description:
      "Fee agreements & NDAs sent for e-signature from inside the platform. Track every deal in live pipeline to funded.",
    Icon: PenLine,
    iconClass: "text-sky-600 dark:text-sky-300",
  },
];

const FEATURES = [
  {
    title: "Smart Loan Wizard",
    subtitle: "12+ Loan Types",
    Icon: ClipboardList,
    iconClass: "text-amber-600 dark:text-amber-300",
  },
  {
    title: "Lender Matching",
    subtitle: "100+ Lenders",
    Icon: Target,
    iconClass: "text-rose-500 dark:text-rose-400",
  },
  {
    title: "Client Portal",
    subtitle: "No Login Required",
    Icon: UserRound,
    iconClass: "text-sky-600 dark:text-sky-400",
  },
  {
    title: "Broker Website",
    subtitle: "Branded & Hosted",
    Icon: Globe2,
    iconClass: "text-sky-600 dark:text-sky-400",
  },
  {
    title: "Fee Agreement & E-Sign",
    subtitle: "PDF + Digital Signature",
    Icon: FileSignature,
    iconClass: "text-slate-600 dark:text-gray-200",
  },
  {
    title: "Performance Dashboard",
    subtitle: "Real-Time Pipeline",
    Icon: BarChart3,
    iconClass: "text-sky-600 dark:text-sky-400",
  },
  {
    title: "Role-Based Access",
    subtitle: "4 User Roles",
    Icon: KeyRound,
    iconClass: "text-amber-600 dark:text-amber-200",
  },
  {
    title: "GHL Integration",
    subtitle: "2-Way CRM Sync",
    Icon: Zap,
    iconClass: "text-amber-600 dark:text-amber-300",
  },
];

const LOAN_TYPES = [
  "Bridge Loans",
  "Fix & Flip",
  "DSCR Loans",
  "Hard Money",
  "CRE Permanent",
  "New Construction",
  "SBA 7(a)",
  "SBA 504",
  "USDA B&I",
  "CMBS / Agency",
  "Mezz / Pref Equity",
  "C-Pace",
  "Asset-Based Lending",
  "Equipment Financing",
  "PO Financing",
  "AR/AP Financing",
  "Business Lines of Credit",
];

function SectionEyebrow({ children }) {
  return (
    <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[#4B83FF]">
      {children}
    </p>
  );
}

function PrimaryCta() {
  const { isAuthenticated, user, loading } = useAuth();
  const hasSubscription = Boolean(user?.hasBrokerSubscription);

  const className =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-[#4B83FF] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_0_36px_rgba(75,131,255,0.4)] transition hover:bg-[#3d73ef] hover:scale-[1.02] sm:text-base";

  if (loading) {
    return <div className="h-12 w-44 animate-pulse rounded-xl bg-blue-500/30" />;
  }

  if (hasSubscription) {
    return (
      <a
        href={getBrokerSignInUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        Open broker dashboard
        <ArrowRight size={18} />
      </a>
    );
  }

  if (isAuthenticated) {
    return (
      <a href="#pricing" className={className}>
        Choose a plan
        <ArrowRight size={18} />
      </a>
    );
  }

  return (
    <Link to="/signup" className={className}>
      Start Free Trial
      <ArrowRight size={18} />
    </Link>
  );
}

/**
 * Primary landing content (hero → how it works → features → loan types).
 */
export default function PricingLeadIn() {
  return (
    <div className="bg-slate-50 text-slate-900 transition-colors dark:bg-black dark:text-white">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-20 pt-16 text-center md:pb-28 md:pt-24">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(75,131,255,0.28)_0%,rgba(0,0,0,0)_55%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04] bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-size-[48px_48px]"
          aria-hidden
        />

        <motion.div className="relative mx-auto max-w-4xl" {...fadeUp}>
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#4B83FF]/40 bg-[#4B83FF]/10 px-4 py-1.5 text-xs font-medium text-[#4B83FF] sm:text-sm">
            <Zap size={14} className="shrink-0 text-amber-300" aria-hidden />
            #1 Commercial Loan Origination Platform for Brokers
          </div>

          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Close More Deals
            <br />
            <span className="text-[#4B83FF]">In Less Time</span>
          </h1>

          <p className="mt-5 text-lg font-semibold text-[#4B83FF] sm:text-xl">
            87% Faster With Zero Chasing
          </p>

          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base dark:text-gray-400">
            Loan Automation matches your deals to qualified lenders, collects all
            documents through the Client Portal, and keeps every party updated in
            real time — from application to funded.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <PrimaryCta />
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-7 py-3.5 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 sm:text-base dark:border-white/15 dark:bg-white/[0.03] dark:text-white dark:hover:border-white/30 dark:hover:bg-white/[0.06]"
            >
              See How It Works
            </a>
          </div>

          <dl className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-8 md:grid-cols-4 md:gap-6">
            {HERO_STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <dt className="sr-only">{stat.label}</dt>
                <dd className="text-3xl font-bold text-[#4B83FF] md:text-4xl">
                  {stat.value}
                </dd>
                <p className="mt-1.5 text-xs text-slate-500 sm:text-sm dark:text-gray-400">{stat.label}</p>
              </div>
            ))}
          </dl>
        </motion.div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-24 px-6 py-20 md:py-24">
        <motion.div className="mx-auto max-w-6xl text-center" {...fadeUp}>
          <SectionEyebrow>How It Works</SectionEyebrow>
          <h2 className="text-3xl font-bold md:text-4xl">
            From Application to Funded —{" "}
            <span className="text-[#4B83FF]">Fully Automated</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-slate-600 sm:text-base dark:text-gray-400">
            Loan Automation handles every step of the deal so you can focus on
            closing, not chasing paperwork.
          </p>

          <div className="relative mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div
              className="pointer-events-none absolute top-8 right-[12%] left-[12%] hidden h-px bg-gradient-to-r from-transparent via-[#4B83FF]/35 to-transparent lg:block"
              aria-hidden
            />
            {HOW_IT_WORKS.map(
              ({ step, title, description, Icon, iconClass }, index) => (
                <motion.article
                  key={step}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: index * 0.08 }}
                  className="relative rounded-2xl border border-slate-200 bg-white px-5 pt-10 pb-6 text-left shadow-sm transition hover:border-[#4B83FF]/40 dark:border-white/10 dark:bg-white/[0.06] dark:hover:border-[#4B83FF]/30 dark:hover:bg-white/[0.08]"
                >
                  <span className="absolute -top-3 left-1/2 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full bg-[#4B83FF] text-xs font-bold text-white shadow-lg shadow-blue-500/30">
                    {step}
                  </span>
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 ring-1 ring-slate-200 dark:bg-white/[0.06] dark:ring-white/10">
                    <Icon className={iconClass} size={22} aria-hidden />
                  </div>
                  <h3 className="mb-2 text-base font-semibold text-slate-900 dark:text-white">
                    {title}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-gray-400">
                    {description}
                  </p>
                </motion.article>
              ),
            )}
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-24 px-6 py-20 md:py-24">
        <motion.div className="mx-auto max-w-6xl text-center" {...fadeUp}>
          <SectionEyebrow>Features</SectionEyebrow>
          <h2 className="text-3xl font-bold md:text-4xl">
            Everything You Need to{" "}
            <span className="text-[#4B83FF]">Run Your Brokerage</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-slate-600 sm:text-base dark:text-gray-400">
            Built specifically for commercial mortgage brokers — not generic CRM
            software repurposed for lending.
          </p>

          <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ title, subtitle, Icon, iconClass }, index) => (
              <motion.article
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.04 }}
                className="group rounded-2xl border border-slate-200 bg-white px-5 py-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#4B83FF]/40 dark:border-white/10 dark:bg-white/[0.06] dark:hover:border-[#4B83FF]/35 dark:hover:bg-white/[0.08]"
              >
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 ring-1 ring-slate-200 transition group-hover:ring-[#4B83FF]/30 dark:bg-white/[0.05] dark:ring-white/10">
                  <Icon className={iconClass} size={20} aria-hidden />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  {title}
                </h3>
                <p className="mt-1.5 text-sm font-medium text-[#4B83FF]">{subtitle}</p>
              </motion.article>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Loan types */}
      <section id="loan-types" className="scroll-mt-24 px-6 pb-8 pt-8 md:pb-16 md:pt-12">
        <motion.div className="mx-auto max-w-5xl text-center" {...fadeUp}>
          <SectionEyebrow>Supported Loan Types</SectionEyebrow>
          <h2 className="text-3xl font-bold md:text-4xl">
            12+ Loan Programs <span className="text-[#4B83FF]">Built In</span>
          </h2>

          <ul className="mt-10 flex flex-wrap justify-center gap-2.5">
            {LOAN_TYPES.map((type) => (
              <li
                key={type}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:border-[#4B83FF]/40 hover:bg-[#4B83FF]/10 hover:text-[#4B83FF] dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-200 dark:hover:text-white"
              >
                {type}
              </li>
            ))}
          </ul>
        </motion.div>
      </section>
    </div>
  );
}
