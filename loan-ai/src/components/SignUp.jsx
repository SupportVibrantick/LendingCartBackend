import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";
import AuthPageHeader from "./AuthPageHeader";
import { useAuth } from "../context/AuthContext";
import useGuestRedirect from "../hooks/useGuestRedirect";

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  confirmPassword: "",
};

function validateForm(form, acceptedTerms) {
  if (!form.firstName.trim() || !form.lastName.trim()) return "Name is required";
  if (!form.email.includes("@")) return "Valid email is required";
  if (form.password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(form.password)) return "Password needs an uppercase letter";
  if (!/[a-z]/.test(form.password)) return "Password needs a lowercase letter";
  if (!/[0-9]/.test(form.password)) return "Password needs a number";
  if (!/[^A-Za-z0-9]/.test(form.password)) return "Password needs a special character";
  if (form.password !== form.confirmPassword) return "Passwords do not match";
  if (!acceptedTerms) return "Please accept the terms";
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
      toast.success("Account created!");

      if (planState.packageId) {
        navigate("/subscribe", { state: planState, replace: true });
      } else {
        navigate({ pathname: "/", hash: "#pricing" }, { replace: true });
      }
    } catch (err) {
      toast.error(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-xl px-4 py-2.5 text-sm bg-white/10 border border-white/20 text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500";

  const hasPlan = Boolean(planState.planName);

  if (authLoading || isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen relative bg-[#0b1020] text-white overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="absolute -top-25 left-1/2 -translate-x-1/2 w-150 h-150 bg-indigo-500/20 blur-[120px] rounded-full" />

      <AuthPageHeader />

      <div className="relative z-10 max-w-lg mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Create your Loan AI account</h1>
        <p className="text-slate-400 mb-8 text-sm leading-relaxed">
          Sign up to subscribe to a plan. Your broker dashboard login will be emailed to the same
          address after successful payment — with a separate password.
        </p>

        {hasPlan && (
          <div className="mb-6 rounded-xl bg-indigo-500/10 border border-indigo-500/30 px-4 py-3 text-sm">
            <p className="text-indigo-200 font-semibold">
              {planState.planName} plan selected
            </p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-4 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl"
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

          <label className="flex items-start gap-2 text-sm text-slate-400 cursor-pointer">
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

          <p className="text-center text-sm text-slate-400">
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
