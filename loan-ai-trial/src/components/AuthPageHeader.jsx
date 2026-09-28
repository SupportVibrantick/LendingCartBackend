import { Link } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import LoanAutomationLogo from "./LoanAutomationLogo";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { getBrokerSignInUrl } from "../lib/brokerAuth";

export default function AuthPageHeader() {
  const { isAuthenticated, user, logout, loading } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="relative z-10 flex items-center justify-between border-b border-slate-200 px-6 py-4 backdrop-blur-md dark:border-white/10">
      <LoanAutomationLogo />

      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={toggleTheme}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20"
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {!loading && isAuthenticated && (
          <>
            <span className="hidden max-w-[180px] truncate text-sm text-slate-500 md:inline dark:text-slate-400">
              {user?.email}
            </span>
            {user?.hasBrokerSubscription && (
              <a
                href={getBrokerSignInUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-800 transition hover:bg-sky-100 sm:inline-flex dark:border-sky-500/30 dark:bg-sky-500/20 dark:text-sky-200 dark:hover:bg-sky-500/30"
              >
                Dashboard
              </a>
            )}
            <button
              type="button"
              onClick={logout}
              className="hidden rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:border-slate-300 hover:text-slate-900 sm:inline-flex dark:border-white/10 dark:text-slate-300 dark:hover:border-white/30 dark:hover:text-white"
            >
              Sign out
            </button>
          </>
        )}

        <Link
          to="/"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50 sm:px-5 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
        >
          ← Home
        </Link>
      </div>
    </div>
  );
}
