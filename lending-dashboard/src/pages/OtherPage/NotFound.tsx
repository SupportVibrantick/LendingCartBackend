import { ArrowLeft, Home, SearchX } from "lucide-react";
import { Link, useNavigate } from "react-router";
import GridShape from "../../components/common/GridShape";
import PageMeta from "../../components/common/PageMeta";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <>
      <PageMeta
        title="Page Not Found | Loan Automation Lender"
        description="The page you requested could not be found."
      />

      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-sky-50 px-6 py-16 dark:from-gray-950 dark:via-gray-950 dark:to-[#0b1f3a]">
        <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-cyan-300/30 blur-[100px] dark:bg-cyan-500/15" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-[#13538A]/20 blur-[110px] dark:bg-[#13538A]/30" />
        <GridShape />

        <div className="relative z-10 w-full max-w-lg text-center">
          <div className="mb-8 flex items-center justify-center gap-3">
            <img
              src="/loanAutomation.jpeg"
              alt="Loan Automation"
              className="h-12 w-12 rounded-full object-cover ring-2 ring-[#13538A]/20 dark:ring-cyan-400/30"
            />
            <div className="text-left">
              <p className="text-base font-bold text-[#13538A] dark:text-cyan-300">
                Loan Automation
              </p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                Lender Portal
              </p>
            </div>
          </div>

          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#13538A]/10 text-[#13538A] dark:bg-cyan-500/15 dark:text-cyan-300">
            <SearchX className="h-8 w-8" strokeWidth={1.75} />
          </div>

          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#13538A]/80 dark:text-cyan-400/80">
            Error 404
          </p>

          <h1 className="bg-gradient-to-r from-[#0b1f3a] via-[#13538A] to-[#1a6aad] bg-clip-text text-7xl font-black tracking-tight text-transparent sm:text-8xl dark:from-cyan-200 dark:via-sky-300 dark:to-white">
            404
          </h1>

          <h2 className="mt-5 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Page not found
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            The link may be broken, or the page may have moved. Head back to your
            dashboard to keep working.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#183b57] to-[#36536c] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#183b57]/25 transition hover:brightness-110 sm:w-auto"
            >
              <Home className="h-4 w-4" />
              Back to dashboard
            </Link>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              Go back
            </button>
          </div>
        </div>

        <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center text-xs text-gray-400 dark:text-gray-500">
          © {new Date().getFullYear()} Loan Automation
        </p>
      </div>
    </>
  );
}
