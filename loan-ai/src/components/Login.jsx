import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import AuthPageHeader from "./AuthPageHeader";
import { useAuth } from "../context/AuthContext";
import useGuestRedirect from "../hooks/useGuestRedirect";
import { getAuthUserMessage } from "../lib/authErrors";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-white/15 dark:bg-white/10 dark:text-white dark:placeholder:text-slate-400 dark:focus:border-blue-400/60";

const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400";

export default function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, loading: authLoading, isAuthenticated } = useAuth();
  useGuestRedirect();
  const planState = location.state || {};

  const [email, setEmail] = useState(planState.email || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Email and password are required");
      return;
    }

    try {
      setLoading(true);
      await login(email, password);
      toast.success("Signed in successfully");

      if (planState.packageId) {
        navigate("/subscribe", { state: planState, replace: true });
      } else if (planState.redirectTo) {
        navigate(planState.redirectTo, { replace: true });
      } else {
        navigate({ pathname: "/", hash: "#pricing" }, { replace: true });
      }
    } catch (err) {
      toast.error(getAuthUserMessage(err, "login"));
    } finally {
      setLoading(false);
    }
  };

  const hasPlan = Boolean(planState.planName);

  if (authLoading || isAuthenticated) {
    return null;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900 transition-colors dark:bg-[#0b1020] dark:text-white">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-[size:40px_40px] dark:bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)]" />
      <div className="absolute -top-25 left-1/2 h-150 w-150 -translate-x-1/2 rounded-full bg-blue-500/15 blur-[120px] dark:bg-blue-500/20" />

      <AuthPageHeader />

      <div className="relative z-10 mx-auto max-w-md px-6 py-12 md:py-16">
        <div className="mb-8 text-center sm:text-left">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#4B83FF]">
            Welcome back
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Sign in to Loan AI</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Use your Loan AI website account. This is separate from your broker
            dashboard login —
            {planState.mode === "trial"
              ? " broker credentials are emailed when your free trial starts."
              : " broker credentials are emailed only after you subscribe."}
          </p>
        </div>

        {hasPlan && (
          <div
            className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
              planState.mode === "trial"
                ? "border-sky-200 bg-sky-50 dark:border-sky-500/30 dark:bg-sky-500/10"
                : "border-indigo-200 bg-indigo-50 dark:border-indigo-500/30 dark:bg-indigo-500/10"
            }`}
          >
            <p
              className={
                planState.mode === "trial"
                  ? "font-semibold text-sky-800 dark:text-sky-200"
                  : "font-semibold text-indigo-800 dark:text-indigo-200"
              }
            >
              {planState.mode === "trial"
                ? `${planState.planName} — free trial`
                : `${planState.planName} plan${
                    planState.planPrice
                      ? ` — ${planState.planPrice}/${planState.billingLabel || "month"}`
                      : ""
                  }`}
            </p>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
              {planState.mode === "trial"
                ? "Sign in to start your free trial — card required, $0 due today."
                : "Sign in to continue to secure checkout for this plan."}
            </p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-7 dark:border-white/10 dark:bg-white/5 dark:shadow-none"
        >
          <div>
            <label className={labelClass} htmlFor="login-email">
              Email <span className="text-rose-500">*</span>
            </label>
            <input
              id="login-email"
              className={inputClass}
              placeholder="you@company.com"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="login-password">
              Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                id="login-password"
                className={`${inputClass} pr-11`}
                placeholder="Your password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-blue-500 to-indigo-500 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:from-blue-600 hover:to-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </button>

          <p className="text-center text-sm text-slate-600 dark:text-slate-400">
            Don&apos;t have an account?{" "}
            <Link
              to="/signup"
              state={hasPlan ? planState : undefined}
              className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              Create account
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
