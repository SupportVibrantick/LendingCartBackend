import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import { BROKER_API_BASE } from "../../lib/brokerApi";

const API_BASE = BROKER_API_BASE;

type Portal = "broker" | "sub-broker" | "loan-officer";

function getSignInPath(portal: Portal) {
  if (portal === "sub-broker") return "/sub-broker/login";
  if (portal === "loan-officer") return "/loan-officer/login";
  return "/signin";
}

function validatePassword(password: string) {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(password))
    return "Password must contain at least one uppercase letter";
  if (!/[a-z]/.test(password))
    return "Password must contain at least one lowercase letter";
  if (!/[0-9]/.test(password))
    return "Password must contain at least one number";
  if (!/[^A-Za-z0-9]/.test(password))
    return "Password must contain at least one special character";
  return null;
}

const RULES = [
  { id: "len", label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { id: "upper", label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { id: "lower", label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { id: "num", label: "One number", test: (p: string) => /[0-9]/.test(p) },
  {
    id: "special",
    label: "One special character",
    test: (p: string) => /[^A-Za-z0-9]/.test(p),
  },
];

function inputWrap(hasError: boolean) {
  return `flex items-center gap-3 rounded-xl border px-4 py-3.5 transition focus-within:ring-2 focus-within:ring-[#4C78F5]/25 ${
    hasError
      ? "border-red-300 bg-red-50"
      : "border-[#E2E8F0] bg-[#F7F9FC] focus-within:border-[#4C78F5] focus-within:bg-white"
  }`;
}

function MobileBrand() {
  return (
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
  );
}

export default function ResetPasswordForm({
  token,
  portal = "broker",
}: {
  token: string;
  portal?: Portal;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [confirmError, setConfirmError] = useState<string | undefined>();

  const signInPath = getSignInPath(portal);

  const ruleStatus = useMemo(
    () => RULES.map((rule) => ({ ...rule, ok: rule.test(password) })),
    [password],
  );

  useEffect(() => {
    const validateToken = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/broker/auth/reset-password/validate?token=${encodeURIComponent(token)}`,
        );
        const json = await res.json();

        if (!res.ok || !json.success || !json.data?.valid) {
          setIsTokenValid(false);
          return;
        }

        setIsTokenValid(true);
        setAccountEmail(json.data.email || "");
      } catch {
        setIsTokenValid(false);
      } finally {
        setIsValidating(false);
      }
    };

    void validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const passwordError = validatePassword(password);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setConfirmError("Passwords do not match");
      toast.error("Passwords do not match");
      return;
    }

    setConfirmError(undefined);
    setIsSubmitting(true);
    const toastId = toast.loading("Saving your password...");

    try {
      const res = await fetch(`${API_BASE}/broker/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Unable to reset password");
      }

      setIsComplete(true);
      toast.success(json.message || "Password updated successfully", {
        id: toastId,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unable to reset password";
      toast.error(message, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return (
      <div className="w-full font-[Inter,ui-sans-serif,system-ui,sans-serif] antialiased">
        <MobileBrand />
        <div className="flex items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-[#F7F9FC] px-4 py-5">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#4C78F5] border-t-transparent" />
          <p className="text-sm text-[#64748B]">Validating your secure link…</p>
        </div>
      </div>
    );
  }

  if (!isTokenValid) {
    return (
      <div className="w-full font-[Inter,ui-sans-serif,system-ui,sans-serif] antialiased">
        <MobileBrand />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-amber-200 bg-amber-50/80 p-6"
        >
          <h1 className="text-[26px] font-semibold tracking-tight text-[#111827]">
            Link expired or invalid
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-[#64748B]">
            This password link can only be used once and expires quickly.
            Request a fresh link to continue.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              to={`/reset-password${portal !== "broker" ? `?portal=${portal}` : ""}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4C78F5] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#4C78F5]/25 transition hover:bg-[#3B66E0]"
            >
              Request new link
              <ArrowRight size={16} />
            </Link>
            <Link
              to={signInPath}
              className="text-center text-sm font-medium text-[#4C78F5] transition hover:text-[#3B66E0]"
            >
              Back to sign in
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="w-full font-[Inter,ui-sans-serif,system-ui,sans-serif] antialiased">
        <MobileBrand />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
            <CheckCircle2 size={32} />
          </div>
          <h1 className="mt-5 text-[26px] font-semibold tracking-tight text-[#111827]">
            Password ready
          </h1>
          <p className="mt-2 text-[13px] text-[#64748B]">
            Your broker account password is updated. Sign in to open your
            dashboard.
          </p>
          <Link
            to={signInPath}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#4C78F5] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#4C78F5]/25 transition hover:bg-[#3B66E0]"
          >
            Sign in to dashboard
            <ArrowRight size={16} />
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full font-[Inter,ui-sans-serif,system-ui,sans-serif] antialiased">
      <MobileBrand />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[#4C78F5]/20 bg-[#4C78F5]/10 px-3 py-1 text-xs font-semibold text-[#4C78F5]">
          <ShieldCheck size={12} />
          Secure setup
        </span>

        <h1 className="text-[26px] font-semibold tracking-tight text-[#111827]">
          Set your password
        </h1>
        <p className="mt-2 text-[13px] text-[#64748B]">
          {accountEmail ? (
            <>
              Create a password for{" "}
              <span className="font-medium text-[#334155]">{accountEmail}</span>
              .
            </>
          ) : (
            "Create a password for your broker account."
          )}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-[#334155]">
              New password
            </label>
            <div className={inputWrap(false)}>
              <LockKeyhole size={18} className="text-[#94A3B8]" />
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Create a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent text-sm text-[#111827] outline-none placeholder:text-[#94A3B8]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-[#94A3B8] transition hover:text-[#64748B]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <ul className="grid grid-cols-1 gap-1.5 rounded-xl border border-[#E2E8F0] bg-[#F7F9FC] p-3 sm:grid-cols-2">
            {ruleStatus.map((rule) => (
              <li
                key={rule.id}
                className={`flex items-center gap-2 text-xs ${
                  rule.ok ? "text-emerald-600" : "text-[#94A3B8]"
                }`}
              >
                <CheckCircle2 size={14} className="shrink-0" />
                {rule.label}
              </li>
            ))}
          </ul>

          <div>
            <label className="mb-2 block text-sm font-medium text-[#334155]">
              Confirm password
            </label>
            <div className={inputWrap(Boolean(confirmError))}>
              <LockKeyhole
                size={18}
                className={confirmError ? "text-red-400" : "text-[#94A3B8]"}
              />
              <input
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setConfirmError(undefined);
                }}
                className="w-full bg-transparent text-sm text-[#111827] outline-none placeholder:text-[#94A3B8]"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="text-[#94A3B8] transition hover:text-[#64748B]"
                aria-label={
                  showConfirmPassword ? "Hide password" : "Show password"
                }
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmError && (
              <p className="mt-1.5 text-xs font-medium text-red-500">
                {confirmError}
              </p>
            )}
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
                Saving…
              </>
            ) : (
              <>
                Save password & continue
                <ArrowRight
                  size={18}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </>
            )}
          </motion.button>
        </form>

        <p className="mt-6 text-center text-sm text-[#64748B]">
          Already set up?{" "}
          <Link
            to={signInPath}
            className="font-semibold text-[#4C78F5] transition hover:text-[#3B66E0]"
          >
            Sign in
          </Link>
        </p>
      </motion.div>

      <p className="mt-8 text-center text-xs text-[#94A3B8]">
        Developed by Vibrantick Inc
      </p>
    </div>
  );
}
