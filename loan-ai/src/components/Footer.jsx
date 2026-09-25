import { Link } from "react-router-dom";
import { Home } from "lucide-react";

const LEGAL_LINKS = [
  { label: "Terms & Conditions", href: "#terms" },
  { label: "Privacy Policy", href: "#privacy" },
];

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer id="contact" className="scroll-mt-24">
      {/* Promo strip */}
      <div className="border-t border-slate-200/80 bg-gradient-to-b from-slate-50 to-white px-4 py-4 text-center dark:border-white/10 dark:from-slate-950 dark:to-black">
        <p className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[12px] leading-relaxed text-slate-500 sm:text-[13px] dark:text-slate-400">
          <Home
            size={14}
            className="shrink-0 text-amber-500 dark:text-amber-400"
            aria-hidden
          />
          <span className="font-medium text-slate-600 dark:text-slate-300">
            Loan Automation
          </span>
          <span className="hidden text-slate-300 sm:inline dark:text-slate-600" aria-hidden>
            —
          </span>
          <span>Close More Deals In Less Time</span>
          <span className="text-slate-300 dark:text-slate-600" aria-hidden>
            •
          </span>
          <span>87% Faster With Zero Chasing</span>
          <span className="text-slate-300 dark:text-slate-600" aria-hidden>
            -
          </span>
          <a
            href="https://loanautomation.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[#4B83FF] transition hover:underline"
          >
            loanautomation.ai
          </a>
        </p>
      </div>

      {/* Dark brand footer */}
      <div className="relative overflow-hidden bg-black px-6 py-12 text-center md:py-14">
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#4B83FF]/20 blur-[80px]"
          aria-hidden
        />

        <div className="relative mx-auto flex max-w-2xl flex-col items-center">
          <Link
            to="/"
            className="group mb-8 inline-flex transition-transform hover:scale-[1.03]"
            aria-label="Loan Automation home"
          >
            <span className="relative flex h-20 w-20 items-center justify-center sm:h-[88px] sm:w-[88px]">
              <span
                className="absolute inset-[-6px] rounded-full bg-[#4B83FF]/25 blur-md transition group-hover:bg-[#4B83FF]/40"
                aria-hidden
              />
              <img
                src="/loanAutomation.jpeg"
                alt="Loan Automation"
                className="relative h-full w-full rounded-full object-cover ring-2 ring-[#4B83FF]/70 shadow-[0_0_40px_rgba(75,131,255,0.45)]"
              />
            </span>
          </Link>

          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[13px] text-slate-400">
            <span>© {year}. CLM &amp; Loan Automation. All rights reserved.</span>
            {LEGAL_LINKS.map((item) => (
              <span key={item.href} className="inline-flex items-center gap-x-2">
                <span className="text-slate-600" aria-hidden>
                  |
                </span>
                <a
                  href={item.href}
                  className="underline-offset-2 transition hover:text-white hover:underline"
                >
                  {item.label}
                </a>
              </span>
            ))}
          </div>

          <p className="mt-5 max-w-xl text-[13px] leading-relaxed text-slate-400 sm:text-sm">
            LOAN AUTOMATION software is created for loan advisors and brokers to
            accelerate the loan process and save time.
          </p>

          <div className="mt-7 w-full max-w-xl rounded-xl border border-white/[0.06] bg-white/[0.03] px-5 py-4">
            <p className="text-left text-[12px] leading-relaxed text-slate-500 sm:text-center sm:text-[13px]">
              <span className="font-medium text-slate-400">Disclaimer:</span>{" "}
              The success stories you see from our students are real—but
              they&apos;re not guaranteed for everyone. Your results will depend
              on your background, experience, work ethic, and how much effort you
              put in. Commercial lending is a business that takes consistent
              action, focus, and risk-taking. If you&apos;re not ready to commit
              and put in the work, this business is not for you.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
