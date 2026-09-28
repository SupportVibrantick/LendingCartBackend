import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";
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

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 dark:border-white/20 dark:bg-white/10 dark:text-white dark:placeholder:text-slate-400";

  const hasPlan = Boolean(planState.planName);

  if (authLoading || isAuthenticated) {
    return null;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900 transition-colors dark:bg-[#0b1020] dark:text-white">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="absolute -top-25 left-1/2 -translate-x-1/2 w-150 h-150 bg-indigo-500/20 blur-[120px] rounded-full" />

      <AuthPageHeader />

      <div className="relative z-10 max-w-lg mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Create your Loan AI account</h1>
        <p className="mb-8 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {planState.mode === "trial"
            ? "Sign up to start your free trial. Broker dashboard credentials are emailed after you complete organization details — no payment required."
            : "Sign up to subscribe to a plan. After payment, broker dashboard credentials are emailed separately."}
        </p>

        {hasPlan && (
          <div className={`mb-6 rounded-xl px-4 py-3 text-sm ${
            planState.mode === "trial"
              ? "bg-sky-500/10 border border-sky-500/30"
              : "bg-indigo-500/10 border border-indigo-500/30"
          }`}>
            <p className={planState.mode === "trial" ? "font-semibold text-sky-700 dark:text-sky-200" : "font-semibold text-indigo-700 dark:text-indigo-200"}>
              {planState.mode === "trial"
                ? `${planState.planName} — free trial`
                : `${planState.planName} plan selected`}
            </p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5"
        >
          <div className="grid grid-cols-2 gap-3">
            <input
              className={inputClass}
              placeholder="First name *"
              value={form.firstName}
              onChange={(e) => handleChange("firstName", e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="Last name *"
              value={form.lastName}
              onChange={(e) => handleChange("lastName", e.target.value)}
            />
          </div>
          <input
            className={inputClass}
            placeholder="Email *"
            type="email"
            value={form.email}
            onChange={(e) => handleChange("email", e.target.value)}
          />
          <div className="relative">
            <input
              className={inputClass}
              placeholder="Password *"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(e) => handleChange("password", e.target.value)}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <input
            className={inputClass}
            placeholder="Confirm password *"
            type={showPassword ? "text" : "password"}
            value={form.confirmPassword}
            onChange={(e) => handleChange("confirmPassword", e.target.value)}
          />

          <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-1"
            />
            <span>I agree to the Terms of Service and Privacy Policy</span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold bg-linear-to-r from-blue-500 to-indigo-500 disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>

          <p className="text-center text-sm text-slate-600 dark:text-slate-400">
            Already have an account?{" "}
            <Link
              to="/login"
              state={hasPlan ? planState : undefined}
              className="text-blue-400 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
