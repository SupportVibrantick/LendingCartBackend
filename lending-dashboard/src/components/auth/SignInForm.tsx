import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";
import { EyeCloseIcon, EyeIcon } from "../../icons";
import toast from "react-hot-toast";
import Checkbox from "../form/input/Checkbox";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export default function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const navigate = useNavigate();

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
      const res = await fetch(`${API_BASE}/lender/auth/login`, {
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

      if (!res.ok) {
        throw new Error(json?.message || `Login failed (${res.status})`);
      }

      const accessToken = json?.data?.token ?? null;

      if (!accessToken) {
        throw new Error("Login succeeded but no access token received");
      }

      sessionStorage.setItem("lender_token", accessToken);

      if (json?.data?.user) {
        sessionStorage.setItem("lender_user", JSON.stringify(json.data.user));
      }

      toast.success("Welcome back!", { id: toastId });
      navigate("/");
    } catch (err: any) {
      toast.error(err?.message || "Login failed", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputWrap = (hasError: boolean) =>
    `flex items-center gap-3 rounded-xl border px-4 py-3.5 transition focus-within:ring-2 focus-within:ring-[#134E4A]/30 ${
      hasError
        ? "border-red-300 bg-red-50 dark:border-red-500/50 dark:bg-red-950/20"
        : "border-gray-200 bg-gray-50 focus-within:border-[#134E4A] focus-within:bg-white dark:border-gray-700 dark:bg-gray-900 dark:focus-within:border-emerald-500 dark:focus-within:bg-gray-900"
    }`;

  return (
    <div className="w-full">
      {/* Mobile logo */}
      <div className="mb-8 flex items-center gap-3 lg:hidden">
        <img
          src="/loanAutomation.jpeg"
          alt="Loan Automation"
          className="h-12 w-12 rounded-full ring-2 ring-[#134E4A]/20"
        />
        <div>
          <p className="text-lg font-bold text-[#134E4A] dark:text-emerald-400">
            Loan Automation
          </p>
          <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
            Lender Portal
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <span className="mb-4 inline-flex rounded-full border border-[#134E4A]/20 bg-[#134E4A]/5 px-3 py-1 text-xs font-semibold text-[#134E4A] dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          Lender Portal
        </span>

        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Sign in to review applications, manage products, and track your pipeline.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          {/* Email */}
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
                placeholder="you@lender.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors((p) => ({ ...p, email: undefined }));
                }}
                className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
              />
            </div>
            {errors.email && (
              <p className="mt-1.5 text-xs font-medium text-red-500">{errors.email}</p>
            )}
          </div>

          {/* Password */}
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
                {showPassword ? (
                  <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                ) : (
                  <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1.5 text-xs font-medium text-red-500">{errors.password}</p>
            )}
          </div>

          {/* Remember + Forgot */}
          <div className="flex items-center justify-between gap-4">
            <label className="flex cursor-pointer items-center gap-2.5">
              <Checkbox checked={isChecked} onChange={setIsChecked} />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Keep me signed in
              </span>
            </label>
            <Link
              to="/reset-password"
              className="text-sm font-medium text-[#134E4A] hover:text-[#0d3532] dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              Forgot password?
            </Link>
          </div>

          {/* Submit */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isSubmitting}
            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#134E4A] to-[#1a6b65] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#134E4A]/25 transition hover:shadow-[#134E4A]/40 disabled:cursor-not-allowed disabled:opacity-70"
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

        {/* <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          Don&apos;t have an account?{" "}
          <Link
            to="/signup"
            className="font-semibold text-[#134E4A] hover:text-[#0d3532] dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            Sign up
          </Link>
        </div> */}
      </motion.div>

      <p className="mt-8 text-center text-xs text-gray-400">
        Developed by Vibrantick Infotech Solutions
      </p>
    </div>
  );
}
