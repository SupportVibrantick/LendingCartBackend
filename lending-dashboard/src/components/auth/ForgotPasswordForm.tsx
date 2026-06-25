import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Mail } from "lucide-react";
import toast from "react-hot-toast";
import { LENDER_API_BASE } from "../../lib/lenderApi";

const API_BASE = LENDER_API_BASE;

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!cleanEmail) {
      toast.error("Email is required");
      return;
    }

    if (!emailRegex.test(cleanEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading("Sending reset link...");

    try {
      const res = await fetch(`${API_BASE}/lender/auth/forgot-password`, {
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
    } catch (err: any) {
      toast.error(err.message || "Unable to send reset link", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (emailSent) {
    return (
      <div className="w-full">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Check your email
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            If an account exists for <strong>{email}</strong>, we sent a
            password reset link. The link expires in 1 hour.
          </p>
          <Link
            to="/signin"
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#134E4A] to-[#1a6b65] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#134E4A]/25 transition hover:shadow-[#134E4A]/40"
          >
            <ArrowLeft size={18} />
            Back to sign in
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Forgot password?
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Enter your lender portal email and we&apos;ll send you a reset link.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email address
            </label>
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 focus-within:border-[#134E4A] focus-within:bg-white dark:border-gray-700 dark:bg-gray-900">
              <Mail size={18} className="text-gray-400" />
              <input
                type="email"
                autoComplete="email"
                placeholder="you@lender.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
              />
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#134E4A] to-[#1a6b65] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#134E4A]/25 transition hover:shadow-[#134E4A]/40 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Sending..." : "Send reset link"}
          </motion.button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          Remember your password?{" "}
          <Link
            to="/signin"
            className="font-semibold text-[#134E4A] hover:text-[#0d3532] dark:text-emerald-400"
          >
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
