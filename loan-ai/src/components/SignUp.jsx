import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import AuthPageHeader from "./AuthPageHeader";
import { useAuth } from "../context/AuthContext";
import useGuestRedirect from "../hooks/useGuestRedirect";
import { getAuthUserMessage } from "../lib/authErrors";

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  confirmPassword: "",
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-white/15 dark:bg-white/10 dark:text-white dark:placeholder:text-slate-400 dark:focus:border-blue-400/60";

const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400";

function validateForm(form, acceptedTerms) {
  if (!form.firstName.trim() || !form.lastName.trim()) {
    return "Please enter your first and last name.";
  }
  if (!form.email.includes("@")) {
    return "Please enter a valid email address.";
  }
  if (form.password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (!/[A-Z]/.test(form.password)) {
    return "Password must include at least one uppercase letter.";
  }
  if (!/[a-z]/.test(form.password)) {
    return "Password must include at least one lowercase letter.";
  }
  if (!/[0-9]/.test(form.password)) {
    return "Password must include at least one number.";
  }
  if (!/[^A-Za-z0-9]/.test(form.password)) {
    return "Password must include at least one special character.";
  }
  if (form.password !== form.confirmPassword) {
    return "Passwords do not match.";
  }
  if (!acceptedTerms) {
    return "Please accept the Terms of Service and Privacy Policy.";
  }
  return null;
}

export default function SignUpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const planState = location.state || {};
  const { register, loading: authLoading, isAuthenticated } = useAuth();
  useGuestRedirect();

  const [form, setForm] = useState(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const error = validateForm(form, acceptedTerms);
    if (error) {
      toast.error(error);
      return;
    }

    try {
      setLoading(true);
      await register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        ...(planState.planCode || planState.packageCode
          ? {
              interestedPlanCode: String(
                planState.planCode || planState.packageCode,
              ),
            }
          : {}),
        ...(planState.planName
          ? { interestedPlanName: String(planState.planName) }
          : {}),
        ...(planState.mode === "trial" || planState.mode === "paid"
          ? { signupMode: planState.mode }
          : {}),
      });
      toast.success("Account created! Continue with organization details…");

      if (planState.packageId) {
        navigate("/subscribe", { state: planState, replace: true });
      } else {
        navigate({ pathname: "/", hash: "#pricing" }, { replace: true });
      }
    } catch (err) {
      toast.error(getAuthUserMessage(err, "register"));
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
      <div className="absolute -top-25 left-1/2 h-150 w-150 -translate-x-1/2 rounded-full bg-indigo-500/15 blur-[120px] dark:bg-indigo-500/20" />

      <AuthPageHeader />

      <div className="relative z-10 mx-auto max-w-lg px-6 py-12">
        <div className="mb-8 text-center sm:text-left">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#4B83FF]">
            Get started
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Create your Loan AI account
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {planState.mode === "trial"
              ? "Sign up to start your free trial. After signup you'll add a card ($0 today) — billing starts when the trial ends unless you Discontinue."
              : "Sign up to subscribe to a plan. After payment, broker dashboard credentials are emailed separately."}
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
                : `${planState.planName} plan selected`}
            </p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-7 dark:border-white/10 dark:bg-white/5 dark:shadow-none"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="signup-first-name">
                First name <span className="text-rose-500">*</span>
              </label>
              <input
                id="signup-first-name"
                className={inputClass}
                placeholder="Jane"
                value={form.firstName}
                onChange={(e) => handleChange("firstName", e.target.value)}
                autoComplete="given-name"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="signup-last-name">
                Last name <span className="text-rose-500">*</span>
              </label>
              <input
                id="signup-last-name"
                className={inputClass}
                placeholder="Smith"
                value={form.lastName}
                onChange={(e) => handleChange("lastName", e.target.value)}
                autoComplete="family-name"
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="signup-email">
              Email <span className="text-rose-500">*</span>
            </label>
            <input
              id="signup-email"
              className={inputClass}
              placeholder="you@company.com"
              type="email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              autoComplete="email"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="signup-password">
              Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                id="signup-password"
                className={`${inputClass} pr-11`}
                placeholder="Min. 8 characters"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => handleChange("password", e.target.value)}
                autoComplete="new-password"
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
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              Use upper, lower, number, and a special character.
            </p>
          </div>

          <div>
            <label className={labelClass} htmlFor="signup-confirm-password">
              Confirm password <span className="text-rose-500">*</span>
            </label>
            <input
              id="signup-confirm-password"
              className={inputClass}
              placeholder="Repeat password"
              type={showPassword ? "text" : "password"}
              value={form.confirmPassword}
              onChange={(e) => handleChange("confirmPassword", e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-600 transition hover:bg-slate-100/80 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>
              I agree to the Terms of Service and Privacy Policy
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-blue-500 to-indigo-500 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:from-blue-600 hover:to-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating account…
              </>
            ) : (
              "Create account"
            )}
          </button>

          <p className="text-center text-sm text-slate-600 dark:text-slate-400">
            Already have an account?{" "}
            <Link
              to="/login"
              state={hasPlan ? planState : undefined}
              className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
