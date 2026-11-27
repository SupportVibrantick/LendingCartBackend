import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import GridShape from "../../../components/common/GridShape";
import ThemeTogglerTwo from "../../../components/common/ThemeTogglerTwo";
import PageMeta from "../../../components/common/PageMeta";
import Checkbox from "../../../components/form/input/Checkbox";
import {
  CO_BROKER_API_BASE,
  CO_BROKER_PORTAL_LABEL,
  CO_BROKER_TOKEN_KEY,
  CO_BROKER_USER_KEY,
  clearCoBrokerSession,
  isCoBrokerTokenExpired,
  resolveCoBrokerLogoUrl,
  storeCoBrokerBranding,
  verifyCoBrokerSession,
} from "../../../lib/coBrokerPortal";
import { ensureChatSocket } from "../../../lib/chatSocketManager";
import { getOrgIdsFromToken } from "../../../lib/chatSocket";
import "../../ClientPortal/clientPortalTheme.css";

const FEATURES = [
  "Work your assigned loan pipeline",
  "Collaborate with your broker team",
  "Upload documents and track progress",
  "Chat securely with your broker team",
];

export default function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );

  const validate = () => {
    const next: { email?: string; password?: string } = {};
    if (!email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = "Please enter a valid email address";
    if (!password) next.password = "Password is required";
    else if (password.length < 6)
      next.password = "Password must be at least 6 characters";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErrors({});
    if (!validate()) return;

    const cleanEmail = email.trim();
    const toastId = toast.loading("Signing in...");

    try {
      setLoading(true);
      clearCoBrokerSession();

      const res = await fetch(`${CO_BROKER_API_BASE}/subbroker/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, password }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        if (json.errors && Array.isArray(json.errors)) {
          const fieldErrors: Record<string, string> = {};
          json.errors.forEach((err: { field: string; message: string }) => {
            fieldErrors[err.field] = err.message;
          });
          setErrors(fieldErrors);
        }
        toast.error(json.message || "Login failed", { id: toastId });
        return;
      }

      sessionStorage.setItem(CO_BROKER_TOKEN_KEY, json.token);
      sessionStorage.setItem(CO_BROKER_USER_KEY, JSON.stringify(json.user));
      if (json.roles) {
        sessionStorage.setItem("roles", JSON.stringify(json.roles));
      } else {
        sessionStorage.setItem("roles", JSON.stringify(["SUB_BROKER"]));
      }

      if (json.branding) {
        storeCoBrokerBranding(json.branding);
      }

      const orgIds = getOrgIdsFromToken(json.token);
      ensureChatSocket(json.token, {
        getBrokerOrgId: () =>
          json.user?.organizationId || orgIds.brokerOrgId,
      });

      const verified = await verifyCoBrokerSession(json.token);
      if (!verified) {
        clearCoBrokerSession();
        toast.error("Login succeeded but session could not be verified", {
          id: toastId,
        });
        return;
      }

      toast.success("Welcome back!", { id: toastId });
      navigate("/sub-broker/dashboard");
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Something went wrong", {
        id: toastId,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = sessionStorage.getItem(CO_BROKER_TOKEN_KEY);
    if (token && !isCoBrokerTokenExpired(token)) {
      navigate("/sub-broker/dashboard");
    } else if (token) {
      clearCoBrokerSession();
    }
  }, [navigate]);

  const logoSrc = resolveCoBrokerLogoUrl();

  const inputWrap = (hasError: boolean) =>
    `flex items-center gap-3 rounded-xl border px-4 py-3.5 transition focus-within:ring-2 focus-within:ring-[#4C78F5]/25 ${
      hasError
        ? "border-red-300 bg-red-50"
        : "border-[#E2E8F0] bg-[#F7F9FC] focus-within:border-[#4C78F5] focus-within:bg-white"
    }`;

  return (
    <>
      <PageMeta
        title={`Sign In | ${CO_BROKER_PORTAL_LABEL}`}
        description="Sign in to your Loan Automation co-broker portal"
      />

      <div className="relative h-dvh overflow-hidden bg-white font-[Inter,ui-sans-serif,system-ui,sans-serif] antialiased dark:bg-gray-950">
        <div className="flex h-full min-h-0 flex-col lg:flex-row">
          <div className="auth-form-scrollbar relative flex h-full min-h-0 w-full justify-center overflow-y-auto overscroll-contain lg:w-[48%] xl:w-[44%]">
            <div className="my-auto w-full max-w-md px-4 py-6 sm:px-5 lg:px-5">
              <div className="w-full font-[Inter,ui-sans-serif,system-ui,sans-serif] antialiased">
                <div className="mb-8 flex items-center gap-3 lg:hidden">
                  <img
                    src={logoSrc}
                    alt="Loan Automation"
                    className="h-12 w-12 rounded-full object-cover ring-2 ring-[#4C78F5]/20"
                  />
                  <div>
                    <p className="text-lg font-semibold text-[#4C78F5]">
                      Loan Automation
                    </p>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-[#94A3B8]">
                      Co-Broker Portal
                    </p>
                  </div>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45 }}
                >
                  <span className="mb-4 inline-flex rounded-full border border-[#4C78F5]/20 bg-[#4C78F5]/10 px-3 py-1 text-xs font-semibold text-[#4C78F5]">
                    {CO_BROKER_PORTAL_LABEL}
                  </span>

                  <h1 className="text-[26px] font-semibold tracking-tight text-[#111827]">
                    Welcome back
                  </h1>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#64748B]">
                    Sign in to manage assigned applications, documents, and
                    broker updates.
                  </p>

                  <form
                    onSubmit={handleSubmit}
                    className="mt-8 space-y-5"
                    noValidate
                  >
                    <div>
                      <label className="mb-2 block text-sm font-medium text-[#334155]">
                        Email address
                      </label>
                      <div className={inputWrap(Boolean(errors.email))}>
                        <Mail
                          size={18}
                          className={
                            errors.email ? "text-red-400" : "text-[#94A3B8]"
                          }
                        />
                        <input
                          type="email"
                          autoComplete="email"
                          placeholder="you@company.com"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            setErrors((p) => ({ ...p, email: undefined }));
                          }}
                          className="w-full bg-transparent text-sm text-[#111827] outline-none placeholder:text-[#94A3B8]"
                        />
                      </div>
                      {errors.email ? (
                        <p className="mt-1.5 text-xs font-medium text-red-500">
                          {errors.email}
                        </p>
                      ) : null}
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
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                        >
                          {showPassword ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                      </div>
                      {errors.password ? (
                        <p className="mt-1.5 text-xs font-medium text-red-500">
                          {errors.password}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <label className="flex cursor-pointer items-center gap-2.5">
                        <Checkbox
                          checked={keepSignedIn}
                          onChange={setKeepSignedIn}
                        />
                        <span className="text-sm text-[#64748B]">
                          Keep me signed in
                        </span>
                      </label>
                      <Link
                        to="/reset-password?portal=sub-broker"
                        className="text-sm font-medium text-[#4C78F5] transition hover:text-[#3B66E0]"
                      >
                        Forgot password?
                      </Link>
                    </div>

                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={loading}
                      className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#4C78F5] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#4C78F5]/25 transition hover:bg-[#3B66E0] hover:shadow-[#4C78F5]/35 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {loading ? (
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
            </div>
          </div>

          <div className="relative hidden h-full min-h-0 shrink-0 overflow-hidden bg-[#4C78F5] lg:flex lg:flex-1">
            <div className="absolute inset-0 bg-[linear-gradient(145deg,#4C78F5_0%,#3A5FD4_45%,#2E4BB0_100%)]" />
            <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-white/15 blur-[100px]" />
            <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-[#93B4FF]/20 blur-[80px]" />
            <GridShape />

            <div className="relative z-10 flex h-full flex-col items-center justify-center px-12 text-center">
              <Link
                to="/sub-broker/login"
                className="mb-8 block transition hover:scale-[1.02]"
              >
                <div className="mx-auto h-24 w-24 overflow-hidden rounded-full shadow-2xl shadow-black/30 ring-4 ring-white/15">
                  <img
                    src={logoSrc}
                    alt="Loan Automation"
                    className="h-full w-full object-cover"
                  />
                </div>
              </Link>

              <h2 className="text-3xl font-semibold tracking-tight text-white xl:text-[34px]">
                Co-Broker Portal
              </h2>
              <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-white/65">
                Your assigned pipeline, documents, and broker updates — in one
                place.
              </p>

              <ul className="mt-10 space-y-3 text-left">
                {FEATURES.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-3 text-sm text-white/80"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs text-white">
                      ✓
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="fixed bottom-6 right-6 z-50 hidden sm:block">
          <ThemeTogglerTwo />
        </div>
      </div>
    </>
  );
}
