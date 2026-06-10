import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ChevronDown,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import LoanAutomationLogo from "./LoanAutomationLogo";
import { useAuth } from "../context/AuthContext";
import { getBrokerSignInUrl } from "../lib/brokerAuth";

const NAV_LINKS = [
  { name: "How it Works", link: "#how-it-works" },
  { name: "Benefits", link: "#benefits" },
  { name: "Pricing", link: "#pricing" },
  { name: "Contact", link: "#contact" },
];

function getUserInitials(user) {
  const first = user?.firstName?.[0] || "";
  const last = user?.lastName?.[0] || "";
  if (first || last) return `${first}${last}`.toUpperCase();
  return (user?.email?.[0] || "?").toUpperCase();
}

function NavLink({ href, label, active, onClick }) {
  return (
    <a
      href={href}
      onClick={onClick}
      className={`relative px-1 py-2 text-sm font-medium transition-colors ${
        active
          ? "text-white"
          : "text-slate-400 hover:text-white"
      }`}
    >
      {label}
      <span
        className={`absolute left-0 -bottom-0.5 h-0.5 rounded-full bg-linear-to-r from-blue-400 to-indigo-400 transition-all duration-300 ${
          active ? "w-full" : "w-0 group-hover:w-full"
        }`}
      />
    </a>
  );
}

function UserMenu({ user, hasSubscription, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.email?.split("@")[0] ||
    "Account";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 py-1.5 pl-1.5 pr-2.5 text-sm transition hover:border-white/20 hover:bg-white/10"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white">
          {getUserInitials(user)}
        </span>
        <span className="hidden max-w-[100px] truncate text-slate-300 lg:inline">
          {displayName}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 overflow-hidden rounded-2xl border border-white/10 bg-[#0f1428]/95 shadow-2xl shadow-black/40 backdrop-blur-xl"
        >
          <div className="border-b border-white/10 px-4 py-3">
            <p className="truncate text-sm font-medium text-white">{displayName}</p>
            <p className="mt-0.5 truncate text-xs text-slate-400">{user?.email}</p>
            {hasSubscription && (
              <span className="mt-2 inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                Active plan
              </span>
            )}
          </div>

          <div className="p-1.5">
            {hasSubscription && (
              <a
                href={getBrokerSignInUrl()}
                target="_blank"
                rel="noopener noreferrer"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-slate-200 transition hover:bg-white/5"
              >
                <LayoutDashboard size={16} className="text-emerald-400" />
                Open broker dashboard
                <ExternalLink size={12} className="ml-auto text-slate-500" />
              </a>
            )}

            {!hasSubscription && (
              <Link
                to="/subscribe"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-slate-200 transition hover:bg-white/5"
              >
                <LayoutDashboard size={16} className="text-blue-400" />
                Complete subscription
              </Link>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-red-300 transition hover:bg-red-500/10"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const Navbar = () => {
  const { isAuthenticated, user, logout, loading } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeHash, setActiveHash] = useState("");

  const hasSubscription = Boolean(user?.hasBrokerSubscription);

  useEffect(() => {
    const syncHash = () => setActiveHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const primaryHref = hasSubscription
    ? getBrokerSignInUrl()
    : isAuthenticated
      ? "/subscribe"
      : "/login";

  const primaryLabel = hasSubscription
    ? "Dashboard"
    : isAuthenticated
      ? "Subscribe"
      : "Login";

  const closeMobile = () => setMobileOpen(false);

  return (
    <header className="fixed top-0 left-0 z-50 w-full border-b border-white/10 bg-[#0b0f2a]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <LoanAutomationLogo size="sm" className="shrink-0" />

        <nav className="hidden items-center gap-6 lg:flex lg:gap-8">
          {NAV_LINKS.map((item) => (
            <NavLink
              key={item.link}
              href={item.link}
              label={item.name}
              active={activeHash === item.link}
            />
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {loading ? (
            <div className="h-9 w-32 animate-pulse rounded-xl bg-white/10" />
          ) : isAuthenticated ? (
            <>
              <UserMenu
                user={user}
                hasSubscription={hasSubscription}
                onLogout={logout}
              />
              {hasSubscription ? (
                <a
                  href={primaryHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden items-center gap-1.5 rounded-xl bg-linear-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:scale-[1.02] sm:inline-flex"
                >
                  <LayoutDashboard size={16} />
                  {primaryLabel}
                </a>
              ) : (
                <Link
                  to={primaryHref}
                  className="hidden rounded-xl bg-linear-to-r from-blue-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:scale-[1.02] sm:inline-flex"
                >
                  {primaryLabel}
                </Link>
              )}
            </>
          ) : (
            <>
              <Link
                to="/signup"
                className="hidden rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-white/25 hover:bg-white/5 hover:text-white sm:inline-flex"
              >
                Get Started
              </Link>
              <Link
                to={primaryHref}
                className="rounded-xl bg-linear-to-r from-blue-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:scale-[1.02]"
              >
                {primaryLabel}
              </Link>
            </>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-slate-300 transition hover:bg-white/5 hover:text-white lg:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/10 bg-[#0b0f2a]/95 backdrop-blur-xl lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
            {NAV_LINKS.map((item) => (
              <a
                key={item.link}
                href={item.link}
                onClick={closeMobile}
                className={`rounded-xl px-4 py-3 text-sm font-medium transition ${
                  activeHash === item.link
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.name}
              </a>
            ))}

            {isAuthenticated && hasSubscription && (
              <a
                href={getBrokerSignInUrl()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={closeMobile}
                className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-emerald-500 to-teal-500 px-4 py-3 text-sm font-semibold text-white"
              >
                <LayoutDashboard size={16} />
                Open broker dashboard
              </a>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Navbar;
