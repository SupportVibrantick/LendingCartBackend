import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import toast from "react-hot-toast";
import Checkbox from "../form/input/Checkbox";
import { BROKER_API_BASE } from "../../lib/brokerApi";
import {
  clearBrokerSession,
  saveBrokerSession,
  verifyBrokerSession,
} from "../../lib/brokerSession";

const API_BASE = BROKER_API_BASE;

export default function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) return;

    const rawUser = searchParams.get("user");

    void (async () => {
      try {
        clearBrokerSession();

        let user: Record<string, unknown> | null = null;
        if (rawUser) {
          try {
            user = JSON.parse(decodeURIComponent(rawUser));
          } catch {
            /* ignore malformed user payload */
          }
        }

        saveBrokerSession(token, user);
        const verified = await verifyBrokerSession(token);
        if (!verified) {
          clearBrokerSession();
          toast.error("Sign-in link is invalid or expired");
          navigate("/signin", { replace: true });
          return;
        }

        toast.success("Signed in successfully");
        navigate("/", { replace: true });
      } catch {
        clearBrokerSession();
        toast.error("Sign-in failed");
        navigate("/signin", { replace: true });
      }
    })();
  }, [navigate, searchParams]);

  const validate = () => {
    const next: { email?: string; password?: string } = {};

    if (!email.trim()) {
      next.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Please enter a valid email address";
    }

    if (!password) {
      next.password = "Password is required";
    } else if (password.length < 6) {
      next.password = "Password must be at least 6 characters";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrors({});
    if (!validate()) return;

    const cleanEmail = email.trim();

    setIsSubmitting(true);
    const toastId = toast.loading("Signing in...");

    try {
      clearBrokerSession();

      const res = await fetch(`${API_BASE}/broker/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      const text = await res.text();
      let json: any;

      try {
        json = JSON.parse(text);
      } catch {
        throw new Error("Server returned invalid response");
      }

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Invalid email or password");
      }

      const token = json?.data?.token || json?.token || json?.data;

      if (!token) {
        throw new Error("Login succeeded but token missing");
      }

      saveBrokerSession(token, json.data?.user);

      const verified = await verifyBrokerSession(token);
      if (!verified) {
        clearBrokerSession();
        throw new Error("Login succeeded but session could not be verified");
      }

      toast.success("Welcome back!", { id: toastId });
      navigate("/");
    } catch (err: any) {
      toast.error(err.message || "Login failed", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputWrap = (hasError: boolean) =>
    `flex items-center gap-3 rounded-xl border px-4 py-3.5 transition focus-within:ring-2 focus-within:ring-[#4C78F5]/25 ${
      hasError
        ? "border-red-300 bg-red-50"
        : "border-[#E2E8F0] bg-[#F7F9FC] focus-within:border-[#4C78F5] focus-within:bg-white"
    }`;

  return (
    <div className="w-full font-[Inter,ui-sans-serif,system-ui,sans-serif] antialiased">
      {/* Mobile logo */}
      <div className="mb-8 flex items-center gap-3 lg:hidden">
        <img
          src="/loanAutomation.jpeg"
          alt="Loan Automation"
          className="h-12 w-12 rounded-full ring-2 ring-[#4C78F5]/20"
        />
        <div>
          <p className="text-lg font-semibold text-[#4C78F5]">Loan Automation</p>
          <p className="text-[10px] font-medium uppercase tracking-wider text-[#94A3B8]">
            Broker Portal
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <span className="mb-4 inline-flex rounded-full border border-[#4C78F5]/20 bg-[#4C78F5]/10 px-3 py-1 text-xs font-semibold text-[#4C78F5]">
          Broker Portal
        </span>

        <h1 className="text-[26px] font-semibold tracking-tight text-[#111827]">
          Welcome back
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-[#64748B]">
          Sign in to manage your loan pipeline, lenders, and team.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-[#334155]">
              Email address
            </label>
            <div className={inputWrap(Boolean(errors.email))}>
              <Mail
                size={18}
                className={errors.email ? "text-red-400" : "text-[#94A3B8]"}
              />
              <input
                type="email"
                autoComplete="email"
                placeholder="you@brokerage.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors((p) => ({ ...p, email: undefined }));
                }}
                className="w-full bg-transparent text-sm text-[#111827] outline-none placeholder:text-[#94A3B8]"
              />
            </div>
            {errors.email && (
              <p className="mt-1.5 text-xs font-medium text-red-500">
                {errors.email}
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[#334155]">
              Password
            </label>
            <div className={inputWrap(Boolean(errors.password))}>
              <LockKeyhole
                size={18}
                className={
                  errors.password ? "text-red-400" : "text-[#94A3B8]"
                }
              />
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors((p) => ({ ...p, password: undefined }));
                }}
                className="w-full bg-transparent text-sm text-[#111827] outline-none placeholder:text-[#94A3B8]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[#94A3B8] transition hover:text-[#64748B]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1.5 text-xs font-medium text-red-500">
                {errors.password}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-4">
            <label className="flex cursor-pointer items-center gap-2.5">
              <Checkbox checked={isChecked} onChange={setIsChecked} />
              <span className="text-sm text-[#64748B]">Keep me signed in</span>
            </label>
            <Link
              to="/reset-password"
              className="text-sm font-medium text-[#4C78F5] transition hover:text-[#3B66E0]"
            >
              Forgot password?
            </Link>
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isSubmitting}
            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#4C78F5] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#4C78F5]/25 transition hover:bg-[#3B66E0] hover:shadow-[#4C78F5]/35 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Signing in...
              </>
            ) : (
              <>
                Sign in to dashboard
                <ArrowRight
                  size={18}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </>
            )}
          </motion.button>
        </form>
      </motion.div>

      <p className="mt-8 text-center text-xs text-[#94A3B8]">
        Developed by Vibrantick Inc
      </p>
    </div>
  );
}
