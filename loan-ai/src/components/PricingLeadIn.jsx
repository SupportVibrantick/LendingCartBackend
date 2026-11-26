import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileSignature,
  FolderOpen,
  Globe2,
  KeyRound,
  PenLine,
  Sparkles,
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
    step: "01",
    title: "Submit Application",
    description:
      "Smart multi-step wizard with conditional logic by loan type. Real-time LTV, LTC & ARV calculator built in.",
    detail: "Guided intake",
    Icon: ClipboardList,
  },
  {
    step: "02",
    title: "Instant Lender Matching",
    description:
      "Engine scores deals against 100+ lenders by type, LTV, LTC, DSCR, State & loan size. Ranked results with match reasons.",
    detail: "Ranked matches",
    Icon: Target,
  },
  {
    step: "03",
    title: "Automated Docs Collection",
    description:
      "Client portal auto-generates document checklist by loan program. Clients upload directly—no more email chains.",
    detail: "Zero chase",
    Icon: FolderOpen,
  },
  {
    step: "04",
    title: "E-Sign & Close",
    description:
      "Fee agreements & NDAs sent for e-signature from inside the platform. Track every deal in live pipeline to funded.",
    detail: "Close faster",
    Icon: PenLine,
  },
];

const FEATURES = [
  {
    title: "Smart Loan Wizard",
    subtitle: "12+ Loan Types",
    description:
      "Conditional workflows that adapt to each loan program so brokers never miss required deal data.",
    Icon: ClipboardList,
    featured: true,
  },
  {
    title: "Lender Matching",
    subtitle: "100+ Lenders",
    description: "Score and rank lenders by fit in seconds.",
    Icon: Target,
  },
  {
    title: "Client Portal",
    subtitle: "No Login Required",
    description: "Borrowers upload docs from a branded link.",
    Icon: UserRound,
  },
  {
    title: "Broker Website",
    subtitle: "Branded & Hosted",
    description: "Launch a polished online presence fast.",
    Icon: Globe2,
  },
  {
    title: "Fee Agreement & E-Sign",
    subtitle: "PDF + Digital Signature",
    description: "Send, sign, and track agreements in-flow.",
    Icon: FileSignature,
  },
  {
    title: "Performance Dashboard",
    subtitle: "Real-Time Pipeline",
    description: "See every deal stage without spreadsheet chaos.",
    Icon: BarChart3,
  },
  {
    title: "Role-Based Access",
    subtitle: "4 User Roles",
    description: "Control visibility across your brokerage team.",
    Icon: KeyRound,
  },
  {
    title: "GHL Integration",
    subtitle: "2-Way CRM Sync",
    description: "Keep CRM and loan ops moving together.",
    Icon: Zap,
  },
];

const LOAN_TYPE_GROUPS = [
  {
    title: "Residential & Bridge",
    Icon: Building2,
    items: [
      "Bridge Loans",
      "Fix & Flip",
      "DSCR Loans",
      "Hard Money",
      "New Construction",
    ],
  },
  {
    title: "CRE & Agency",
    Icon: BarChart3,
    items: [
      "CRE Permanent",
      "CMBS / Agency",
      "Mezz / Pref Equity",
      "C-Pace",
    ],
  },
  {
    title: "SBA & USDA",
    Icon: ClipboardList,
    items: ["SBA 7(a)", "SBA 504", "USDA B&I"],
  },
  {
    title: "Asset-Based",
    Icon: FolderOpen,
    items: [
      "Asset-Based Lending",
      "Equipment Financing",
      "PO Financing",
      "AR/AP Financing",
      "Business Lines of Credit",
    ],
  },
];

function SectionEyebrow({ children }) {
  return (
    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#4B83FF]/25 bg-[#4B83FF]/10 px-3.5 py-1.5">
      <Sparkles size={12} className="text-[#4B83FF]" aria-hidden />
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#4B83FF]">
        {children}
      </p>
    </div>
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

  return (
    <a href="#pricing" className={className}>
      Choose a plan
      <ArrowRight size={18} />
    </a>
  );
}

/**
 * Primary landing content (hero → how it works → features → loan types).
 */
export default function PricingLeadIn() {
  const featured = FEATURES.find((f) => f.featured) || FEATURES[0];
  const FeaturedIcon = featured.Icon;
  const secondaryFeatures = FEATURES.filter((f) => f !== featured);

  return (
    <div className="bg-slate-50 text-slate-900 transition-colors dark:bg-black dark:text-white">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-20 pt-16 text-center md:pb-28 md:pt-24">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_15%,rgba(75,131,255,0.32)_0%,rgba(0,0,0,0)_58%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-20 top-24 h-64 w-64 rounded-full bg-sky-400/15 blur-[90px] dark:bg-sky-500/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-16 bottom-10 h-72 w-72 rounded-full bg-[#4B83FF]/15 blur-[100px]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.045] bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-size-[48px_48px]"
          aria-hidden
        />

        <motion.div className="relative mx-auto max-w-4xl" {...fadeUp}>
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#4B83FF]/40 bg-[#4B83FF]/10 px-4 py-1.5 text-xs font-medium text-[#4B83FF] sm:text-sm">
            <Zap size={14} className="shrink-0 text-amber-400" aria-hidden />
            #1 Commercial Loan Origination Platform for Brokers
          </div>

          <h1 className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Close More Deals
            <br />
            <span className="bg-linear-to-r from-[#4B83FF] to-[#6BA0FF] bg-clip-text text-transparent">
              In Less Time
            </span>
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
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white/90 px-7 py-3.5 text-sm font-semibold text-slate-800 shadow-sm backdrop-blur transition hover:border-slate-300 hover:bg-white sm:text-base dark:border-white/15 dark:bg-white/[0.04] dark:text-white dark:hover:border-white/30 dark:hover:bg-white/[0.07]"
            >
              See How It Works
            </a>
          </div>

          <dl className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {HERO_STATS.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.08 * index }}
                className="rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-4 text-center shadow-[0_12px_30px_-20px_rgba(15,23,42,0.45)] backdrop-blur dark:border-white/10 dark:bg-white/[0.05] dark:shadow-none"
              >
                <dt className="sr-only">{stat.label}</dt>
                <dd className="text-2xl font-bold tracking-tight text-[#4B83FF] md:text-3xl">
                  {stat.value}
                </dd>
                <p className="mt-1.5 text-[11px] font-medium text-slate-500 sm:text-xs dark:text-gray-400">
                  {stat.label}
                </p>
              </motion.div>
            ))}
          </dl>
        </motion.div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="scroll-mt-24 relative overflow-hidden bg-slate-50 px-6 py-20 md:py-28 dark:bg-black"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(75,131,255,0.12)_0%,transparent_50%),radial-gradient(ellipse_at_90%_80%,rgba(14,165,233,0.08)_0%,transparent_45%)] dark:bg-[radial-gradient(ellipse_at_20%_0%,rgba(75,131,255,0.22)_0%,transparent_50%),radial-gradient(ellipse_at_90%_80%,rgba(14,165,233,0.1)_0%,transparent_45%)]"
          aria-hidden
        />

        <motion.div className="relative mx-auto max-w-6xl" {...fadeUp}>
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>How It Works</SectionEyebrow>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl lg:text-[2.75rem] dark:text-white">
              From Application to Funded —{" "}
              <span className="text-[#4B83FF]">Fully Automated</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-400">
              Loan Automation handles every step of the deal so you can focus on
              closing, not chasing paperwork.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {HOW_IT_WORKS.map(
              ({ step, title, description, detail, Icon }, index) => (
                <motion.article
                  key={step}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: index * 0.07 }}
                  className="group relative overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.45)] transition duration-300 hover:-translate-y-1 hover:border-[#4B83FF]/40 hover:shadow-[0_24px_50px_-28px_rgba(75,131,255,0.45)] sm:p-6 dark:border-white/12 dark:bg-[#111827] dark:shadow-none dark:hover:border-[#4B83FF]/45 dark:hover:bg-[#152033]"
                >
                  <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[#4B83FF]/10 blur-2xl transition group-hover:bg-[#4B83FF]/20 dark:bg-[#4B83FF]/15 dark:group-hover:bg-[#4B83FF]/25" />
                  <div className="relative flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-[#4B83FF] text-white shadow-lg shadow-[#4B83FF]/30 dark:shadow-[#4B83FF]/40">
                      <Icon size={20} strokeWidth={1.9} aria-hidden />
                      <span className="mt-0.5 text-[10px] font-bold tracking-wide opacity-90">
                        {step}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                          {title}
                        </h3>
                        <span className="rounded-full bg-[#4B83FF]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#4B83FF] dark:bg-[#4B83FF]/20 dark:text-[#9CBCFF]">
                          {detail}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                        {description}
                      </p>
                    </div>
                  </div>
                </motion.article>
              ),
            )}
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section
        id="features"
        className="scroll-mt-24 relative overflow-hidden border-y border-slate-200 bg-white px-6 py-20 text-slate-900 md:py-28 dark:border-white/10 dark:bg-slate-950 dark:text-white"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_10%,rgba(75,131,255,0.12)_0%,transparent_45%),radial-gradient(ellipse_at_90%_80%,rgba(75,131,255,0.06)_0%,transparent_40%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035] bg-[linear-gradient(to_right,#94a3b8_1px,transparent_1px),linear-gradient(to_bottom,#94a3b8_1px,transparent_1px)] bg-size-[42px_42px] dark:opacity-[0.05]"
          aria-hidden
        />

        <motion.div className="relative mx-auto max-w-6xl" {...fadeUp}>
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Features</SectionEyebrow>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-[2.75rem]">
              Everything You Need to{" "}
              <span className="text-[#4B83FF]">Run Your Brokerage</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-400">
              Built specifically for commercial mortgage brokers — not generic CRM
              software repurposed for lending.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
            <motion.article
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45 }}
              className="group relative overflow-hidden rounded-[1.5rem] border border-[#4B83FF]/20 bg-gradient-to-br from-[#4B83FF]/[0.12] via-white to-slate-50 p-6 text-left shadow-[0_20px_50px_-30px_rgba(75,131,255,0.45)] sm:p-8 lg:col-span-5 dark:border-[#4B83FF]/25 dark:from-[#4B83FF]/20 dark:via-slate-950 dark:to-slate-950"
            >
              <div className="pointer-events-none absolute -right-8 top-0 h-40 w-40 rounded-full bg-[#4B83FF]/20 blur-3xl" />
              <div className="relative flex h-full flex-col">
                <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#4B83FF] text-white shadow-lg shadow-[#4B83FF]/35">
                  <FeaturedIcon size={26} strokeWidth={1.8} aria-hidden />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4B83FF]">
                  {featured.subtitle}
                </p>
                <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {featured.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {featured.description}
                </p>
                <ul className="mt-6 space-y-2.5">
                  {[
                    "Program-aware fields",
                    "Built-in deal math",
                    "Faster complete apps",
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"
                    >
                      <CheckCircle2
                        size={16}
                        className="shrink-0 text-[#4B83FF]"
                        aria-hidden
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.article>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-7">
              {secondaryFeatures.map(
                ({ title, subtitle, description, Icon }, index) => (
                  <motion.article
                    key={title}
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.04 }}
                    className="group relative overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white p-5 text-left shadow-[0_12px_30px_-22px_rgba(15,23,42,0.35)] transition duration-300 hover:-translate-y-1 hover:border-[#4B83FF]/40 hover:shadow-[0_18px_40px_-24px_rgba(75,131,255,0.4)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none dark:hover:border-[#4B83FF]/35 dark:hover:bg-white/[0.06]"
                  >
                    <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#4B83FF]/10 text-[#4B83FF] ring-1 ring-[#4B83FF]/15 transition group-hover:bg-[#4B83FF] group-hover:text-white">
                      <Icon size={20} strokeWidth={1.85} aria-hidden />
                    </div>
                    <h3 className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-white">
                      {title}
                    </h3>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#4B83FF]">
                      {subtitle}
                    </p>
                    <p className="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                      {description}
                    </p>
                  </motion.article>
                ),
              )}
            </div>
          </div>
        </motion.div>
      </section>

      {/* Loan types */}
      <section
        id="loan-types"
        className="scroll-mt-24 relative overflow-hidden px-6 py-20 md:py-24"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(75,131,255,0.08)_0%,transparent_55%)]"
          aria-hidden
        />
        <motion.div className="relative mx-auto max-w-6xl" {...fadeUp}>
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Supported Loan Types</SectionEyebrow>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              12+ Loan Programs{" "}
              <span className="text-[#4B83FF]">Built In</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base dark:text-gray-400">
              Cover residential, CRE, SBA/USDA, and asset-based lending from one
              origination workflow.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {LOAN_TYPE_GROUPS.map(({ title, Icon, items }, index) => (
              <motion.article
                key={title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.06 }}
                className="rounded-[1.25rem] border border-slate-200 bg-white p-5 text-left shadow-[0_14px_34px_-24px_rgba(15,23,42,0.4)] transition hover:-translate-y-0.5 hover:border-[#4B83FF]/35 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none"
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#4B83FF]/10 text-[#4B83FF]">
                    <Icon size={18} aria-hidden />
                  </span>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {title}
                  </h3>
                </div>
                <ul className="space-y-2">
                  {items.map((type) => (
                    <li
                      key={type}
                      className="flex items-center gap-2 text-sm text-slate-600 dark:text-gray-300"
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#4B83FF]" />
                      {type}
                    </li>
                  ))}
                </ul>
              </motion.article>
            ))}
          </div>
        </motion.div>
      </section>
    </div>
  );
}
