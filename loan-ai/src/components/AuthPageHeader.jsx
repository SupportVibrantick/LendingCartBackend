import { Link } from "react-router-dom";
import LoanAutomationLogo from "./LoanAutomationLogo";
import { useAuth } from "../context/AuthContext";
import { getBrokerSignInUrl } from "../lib/brokerAuth";

export default function AuthPageHeader() {
  const { isAuthenticated, user, logout, loading } = useAuth();

  return (
    <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/10 backdrop-blur-md">
      <LoanAutomationLogo />

      <div className="flex items-center gap-2 sm:gap-3">
        {!loading && isAuthenticated && (
          <>
            <span className="hidden md:inline text-sm text-slate-400 truncate max-w-[180px]">
              {user?.email}
            </span>
            {user?.hasBrokerSubscription && (
              <a
                href={getBrokerSignInUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/30 transition"
              >
                Dashboard
              </a>
            )}
            <button
              type="button"
              onClick={logout}
              className="hidden sm:inline-flex px-4 py-2 rounded-lg text-sm text-slate-300 border border-white/10 hover:border-white/30 hover:text-white transition"
            >
              Sign out
            </button>
          </>
        )}

        <Link
          to="/"
          className="px-4 sm:px-5 py-2 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 transition text-sm"
        >
          ← Home
        </Link>
      </div>
    </div>
  );
}
