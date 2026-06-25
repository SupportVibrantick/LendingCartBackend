import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { EyeCloseIcon, EyeIcon } from "../../icons";
import toast from "react-hot-toast";
import { LENDER_API_BASE } from "../../lib/lenderApi";

const API_BASE = LENDER_API_BASE;

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

export default function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const validateToken = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/lender/auth/reset-password/validate?token=${encodeURIComponent(token)}`,
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

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const passwordError = validatePassword(password);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading("Resetting password...");

    try {
      const res = await fetch(`${API_BASE}/lender/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Unable to reset password");
      }

      setIsComplete(true);
      toast.success(json.message || "Password reset successfully", {
        id: toastId,
      });
    } catch (err: any) {
      toast.error(err.message || "Unable to reset password", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputWrap =
    "flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 transition focus-within:border-[#134E4A] focus-within:bg-white dark:border-gray-700 dark:bg-gray-900";

  if (isValidating) {
    return (
      <div className="w-full">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Validating reset link...
        </p>
      </div>
    );
  }

  if (!isTokenValid) {
    return (
      <div className="w-full">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Invalid or expired link
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          This password reset link is invalid or has expired. Request a new one.
        </p>
        <Link
          to="/reset-password"
          className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#134E4A] to-[#1a6b65] px-5 py-3.5 text-sm font-semibold text-white"
        >
          Request new link
        </Link>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="w-full">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Password updated
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Your password has been reset. You can now sign in with your new
          password.
        </p>
        <Link
          to="/signin"
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#134E4A] to-[#1a6b65] px-5 py-3.5 text-sm font-semibold text-white"
        >
          Sign in to dashboard
        </Link>
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
          Set new password
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {accountEmail
            ? `Create a new password for ${accountEmail}.`
            : "Create a new password for your lender portal account."}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              New password
            </label>
            <div className={inputWrap}>
              <LockKeyhole size={18} className="text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeIcon className="fill-gray-500 size-5" />
                ) : (
                  <EyeCloseIcon className="fill-gray-500 size-5" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Confirm password
            </label>
            <div className={inputWrap}>
              <LockKeyhole size={18} className="text-gray-400" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="text-gray-400 hover:text-gray-600"
                aria-label={
                  showConfirmPassword ? "Hide password" : "Show password"
                }
              >
                {showConfirmPassword ? (
                  <EyeIcon className="fill-gray-500 size-5" />
                ) : (
                  <EyeCloseIcon className="fill-gray-500 size-5" />
                )}
              </button>
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#134E4A] to-[#1a6b65] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#134E4A]/25 transition hover:shadow-[#134E4A]/40 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Saving..." : "Reset password"}
          </motion.button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          <Link
            to="/signin"
            className="inline-flex items-center gap-1 font-semibold text-[#134E4A] hover:text-[#0d3532] dark:text-emerald-400"
          >
            <ArrowLeft size={14} />
            Back to sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
