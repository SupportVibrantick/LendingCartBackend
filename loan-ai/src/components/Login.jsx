import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";
import AuthPageHeader from "./AuthPageHeader";
import { useAuth } from "../context/AuthContext";
import useGuestRedirect from "../hooks/useGuestRedirect";
import { getAuthUserMessage } from "../lib/authErrors";

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
        navigate("/checkout", { state: planState, replace: true });
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

  const inputClass =
    "w-full rounded-xl px-4 py-2.5 text-sm bg-white/10 border border-white/20 text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500";

  const hasPlan = Boolean(planState.planName);

  if (authLoading || isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen relative bg-[#0b1020] text-white overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="absolute -top-25 left-1/2 -translate-x-1/2 w-150 h-150 bg-blue-500/20 blur-[120px] rounded-full" />

      <AuthPageHeader />

      <div className="relative z-10 max-w-md mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-2">Sign in to Loan AI</h1>
        <p className="text-slate-400 mb-6 text-sm leading-relaxed">
          Use your Loan AI website account. This is separate from your broker dashboard login —
          broker credentials are emailed only after you subscribe.
        </p>

        {hasPlan && (
          <div className="mb-6 rounded-xl bg-indigo-500/10 border border-indigo-500/30 px-4 py-3 text-sm">
            <p className="text-indigo-200 font-semibold">
              {planState.planName} plan
              {planState.planPrice ? ` — ${planState.planPrice}/${planState.billingLabel || "month"}` : ""}
            </p>
            <p className="text-slate-400 mt-2 text-xs">
              Sign in to continue to secure checkout for this plan.
            </p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-4 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl"
        >
          <input
            className={inputClass}
            placeholder="Email *"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="relative">
            <input
              className={inputClass}
              placeholder="Password *"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold bg-linear-to-r from-blue-500 to-indigo-500 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <p className="text-center text-sm text-slate-400">
            Don&apos;t have an account?{" "}
            <Link
              to="/signup"
              state={hasPlan ? planState : undefined}
              className="text-blue-400 hover:underline"
            >
              Create account
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
