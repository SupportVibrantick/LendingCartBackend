import { Link } from "react-router-dom";
import { Home } from "lucide-react";

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer id="contact" className="scroll-mt-24">
      <div className="border-t border-slate-200/80 bg-gradient-to-b from-slate-50 to-white px-4 py-2.5 text-center dark:border-white/10 dark:from-slate-950 dark:to-black">
        <p className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[11px] leading-snug text-slate-500 sm:text-[12px] dark:text-slate-400">
          <Home
            size={12}
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

      <div className="bg-gradient-to-b from-[#f4f6fb] via-[#f8f9fd] to-[#eef1f8] px-4 py-5 text-center sm:px-6 sm:py-6 dark:from-[#0b0f2a] dark:via-[#0b0f2a] dark:to-[#080b1c]">
        <div className="mx-auto flex w-full max-w-[720px] flex-col items-center">
          <Link
            to="/"
            className="mb-3 inline-flex"
            aria-label="Loan Automation home"
          >
            <img
              src="/loanAutomation.jpeg"
              alt="Loan Automation"
              className="h-12 w-12 rounded-full object-cover shadow-[0_0_16px_rgba(34,211,238,0.3)] ring-2 ring-cyan-300/80 sm:h-14 sm:w-14 dark:ring-[#4B83FF]/70"
            />
          </Link>

          <p className="text-[11px] leading-snug text-[#6b7280] sm:text-[12px] dark:text-slate-400">
            © {year}. CLM &amp; Loan Automation. All rights reserved.{" "}
            <span className="text-[#9ca3af]" aria-hidden>
              |
            </span>{" "}
            <a
              href="#terms"
              className="text-[#6b7280] transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
            >
              Terms &amp; Conditions
            </a>{" "}
            <span className="text-[#9ca3af]" aria-hidden>
              |
            </span>{" "}
            <a
              href="#privacy"
              className="text-[#6b7280] transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
            >
              Privacy Policy
            </a>
          </p>

          <p className="mt-1.5 text-[11px] leading-snug text-[#6b7280] sm:text-[12px] dark:text-slate-400">
            LOAN AUTOMATION software is created for loan advisors and brokers to
            accelerate the loan process and save time
          </p>

          <p className="mt-2 w-full text-[10px] leading-snug text-[#9ca3af] sm:text-[11px] dark:text-slate-500">
            Disclaimer: The success stories you see from our students are
            real—but they&apos;re not guaranteed for everyone. Your results may
            vary depending on your experience, work ethic, and efforts.
          </p>

          <p className="mt-0.5 w-full text-[10px] leading-snug text-[#9ca3af] sm:text-[11px] dark:text-slate-500">
            Commercial lending takes consistent action, focus, and risk-taking.
            If you&apos;re not ready to commit and put in the work, this
            business is not for you.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
