import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Mail, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import { BROKER_API_BASE } from "../../lib/brokerApi";

const API_BASE = BROKER_API_BASE;

type Portal = "broker" | "sub-broker" | "loan-officer";

function getSignInPath(portal: Portal) {
  if (portal === "sub-broker") return "/sub-broker/login";
  if (portal === "loan-officer") return "/loan-officer/login";
  return "/signin";
}

function inputWrap(hasError: boolean) {
  return `flex items-center gap-3 rounded-xl border px-4 py-3.5 transition focus-within:ring-2 focus-within:ring-[#13538A]/30 ${
    hasError
      ? "border-red-300 bg-red-50 dark:border-red-500/50 dark:bg-red-950/20"
      : "border-gray-200 bg-gray-50 focus-within:border-[#13538A] focus-within:bg-white dark:border-gray-700 dark:bg-gray-900 dark:focus-within:border-cyan-500 dark:focus-within:bg-gray-900"
  }`;
}

export default function ForgotPasswordForm({
  portal = "broker",
}: {
  portal?: Portal;
}) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>();

  const signInPath = getSignInPath(portal);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!cleanEmail) {
      setEmailError("Email is required");
      return;
    }

    if (!emailRegex.test(cleanEmail)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    setEmailError(undefined);
    setIsSubmitting(true);
    const toastId = toast.loading("Sending reset link...");

    try {
      const res = await fetch(`${API_BASE}/broker/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Unable to send reset link");
      }

      setEmailSent(true);
      toast.success(json.message || "Check your email for a reset link", {
        id: toastId,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unable to send reset link";
      toast.error(message, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full">
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
        transition={{ duration: 0.4 }}
      >
        <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[#13538A]/20 bg-[#13538A]/5 px-3 py-1 text-xs font-semibold text-[#13538A] dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300">
          <ShieldCheck size={12} />
          Account recovery
        </span>

        {emailSent ? (
          <>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              Check your email
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              If an account exists for{" "}
              <span className="font-medium text-gray-700 dark:text-gray-200">
                {email}
              </span>
              , we sent a reset link. It expires in about 1 hour.
            </p>
            <Link
              to={signInPath}
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-[#13538A] to-[#1a6aad] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#13538A]/25"
            >
              Back to sign in
              <ArrowRight size={16} />
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              Forgot password?
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Enter your broker email and we&apos;ll send a secure link to set a
              new password.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email address
                </label>
                <div className={inputWrap(Boolean(emailError))}>
                  <Mail
                    size={18}
                    className={emailError ? "text-red-400" : "text-gray-400"}
                  />
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="you@brokerage.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailError(undefined);
                    }}
                    className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
                  />
                </div>
                {emailError && (
                  <p className="mt-1.5 text-xs font-medium text-red-500">
                    {emailError}
                  </p>
                )}
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
                    Sending…
                  </>
                ) : (
                  <>
                    Send reset link
                    <ArrowRight
                      size={18}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </>
                )}
              </motion.button>
            </form>

            <Link
              to={signInPath}
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-[#13538A] dark:text-cyan-400"
            >
              <ArrowLeft size={14} />
              Back to sign in
            </Link>
          </>
        )}
      </motion.div>

      <p className="mt-8 text-center text-xs text-gray-400">
        Developed by Vibrantick Infotech Solutions
      </p>
    </div>
  );
}
