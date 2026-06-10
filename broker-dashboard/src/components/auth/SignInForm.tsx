import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import toast from "react-hot-toast";
import Checkbox from "../form/input/Checkbox";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

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

    sessionStorage.setItem("broker_token", token);

    const rawUser = searchParams.get("user");
    if (rawUser) {
      try {
        const user = JSON.parse(decodeURIComponent(rawUser));
        sessionStorage.setItem("broker_user", JSON.stringify(user));
        sessionStorage.setItem("roles", JSON.stringify(user.roles || []));
      } catch {
        /* ignore malformed user payload */
      }
    }

    toast.success("Signed in successfully");
    navigate("/", { replace: true });
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

      sessionStorage.setItem("broker_token", token);

      if (json.data?.user) {
        const user = json.data.user;
        sessionStorage.setItem("broker_user", JSON.stringify(user));
        sessionStorage.setItem("roles", JSON.stringify(user.roles || []));
        sessionStorage.setItem(
          "permissions",
          JSON.stringify(user.permissions || []),
        );
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
    `flex items-center gap-3 rounded-xl border px-4 py-3.5 transition focus-within:ring-2 focus-within:ring-[#13538A]/30 ${
      hasError
        ? "border-red-300 bg-red-50 dark:border-red-500/50 dark:bg-red-950/20"
        : "border-gray-200 bg-gray-50 focus-within:border-[#13538A] focus-within:bg-white dark:border-gray-700 dark:bg-gray-900 dark:focus-within:border-cyan-500 dark:focus-within:bg-gray-900"
    }`;

  return (
    <div className="w-full">
      {/* Mobile logo */}
      <div className="mb-8 flex items-center gap-3 lg:hidden">
        <img
          src="/loanAutomation.jpeg"
          alt="Loan Automation"
          className="h-12 w-12 rounded-full ring-2 ring-[#13538A]/20"
        />
        <div>
          <p className="text-lg font-bold text-[#13538A] dark:text-cyan-400">
            Loan Automation
          </p>
          <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
            Broker Dashboard
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <span className="mb-4 inline-flex rounded-full border border-[#13538A]/20 bg-[#13538A]/5 px-3 py-1 text-xs font-semibold text-[#13538A] dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300">
          Broker Portal
        </span>

        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Sign in to manage your loan pipeline, lenders, and team.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email address
            </label>
            <div className={inputWrap(Boolean(errors.email))}>
              <Mail
                size={18}
                className={errors.email ? "text-red-400" : "text-gray-400"}
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
                className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
              />
            </div>
            {errors.email && (
              <p className="mt-1.5 text-xs font-medium text-red-500">
                {errors.email}
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Password
            </label>
            <div className={inputWrap(Boolean(errors.password))}>
              <LockKeyhole
                size={18}
                className={errors.password ? "text-red-400" : "text-gray-400"}
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
                className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-gray-400 transition hover:text-gray-600 dark:hover:text-gray-300"
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
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Keep me signed in
              </span>
            </label>
            <Link
              to="/reset-password"
              className="text-sm font-medium text-[#13538A] hover:text-[#0f3d66] dark:text-cyan-400 dark:hover:text-cyan-300"
            >
              Forgot password?
            </Link>
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isSubmitting}
            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-[#13538A] to-[#1a6aad] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#13538A]/25 transition hover:shadow-[#13538A]/40 disabled:cursor-not-allowed disabled:opacity-70"
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

        {/* <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          Don&apos;t have an account?{" "}
          <Link
            to="/signup"
            className="font-semibold text-[#13538A] hover:underline dark:text-cyan-400"
          >
            Create broker account
          </Link>
        </p> */}

        {/* <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-gray-100 pt-6 dark:border-gray-800">
          <Link
            to="/sub-broker/login"
            className="text-xs font-medium text-gray-500 transition hover:text-[#13538A] dark:text-gray-400 dark:hover:text-cyan-400"
          >
            Sub-broker login
          </Link>
          <span className="text-gray-300 dark:text-gray-700">·</span>
          <Link
            to="/loan-officer/login"
            className="text-xs font-medium text-gray-500 transition hover:text-[#13538A] dark:text-gray-400 dark:hover:text-cyan-400"
          >
            Loan officer login
          </Link>
        </div> */}
      </motion.div>

      <p className="mt-8 text-center text-xs text-gray-400">
        Developed by Vibrantick Infotech Solutions
      </p>
    </div>
  );
}
