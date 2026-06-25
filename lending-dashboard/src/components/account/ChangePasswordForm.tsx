import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import toast from "react-hot-toast";
import { EyeCloseIcon, EyeIcon } from "../../icons";
import {
  LENDER_API_BASE,
  getLenderAuthHeaders,
} from "../../lib/lenderApi";

function validateNewPassword(password: string) {
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

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputWrap =
    "flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 transition focus-within:border-[#134E4A] focus-within:bg-white dark:border-gray-700 dark:bg-gray-900";

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword.trim()) {
      toast.error("Current password is required");
      return;
    }

    const passwordError = validateNewPassword(newPassword);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading("Updating password...");

    try {
      const res = await fetch(`${LENDER_API_BASE}/lender/auth/change-password`, {
        method: "PUT",
        headers: getLenderAuthHeaders(true),
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const json = await res.json();

      if (!res.ok || json.success === false) {
        throw new Error(json.message || "Unable to change password");
      }

      resetForm();
      toast.success(json.message || "Password changed successfully", {
        id: toastId,
      });
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Unable to change password",
        { id: toastId },
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[#134E4A] hover:underline dark:text-emerald-400"
        >
          <ArrowLeft size={16} />
          Back to dashboard
        </Link>

        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Account security
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
          Change password
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Update your lender portal password. Use at least 8 characters with
          uppercase, lowercase, number, and special character.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Current password
            </label>
            <div className={inputWrap}>
              <LockKeyhole size={18} className="text-gray-400" />
              <input
                type={showCurrentPassword ? "text" : "password"}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-transparent text-sm text-gray-900 outline-none dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="text-gray-400 hover:text-gray-600"
                aria-label={showCurrentPassword ? "Hide password" : "Show password"}
              >
                {showCurrentPassword ? (
                  <EyeIcon className="fill-gray-500 size-5" />
                ) : (
                  <EyeCloseIcon className="fill-gray-500 size-5" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              New password
            </label>
            <div className={inputWrap}>
              <LockKeyhole size={18} className="text-gray-400" />
              <input
                type={showNewPassword ? "text" : "password"}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-transparent text-sm text-gray-900 outline-none dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="text-gray-400 hover:text-gray-600"
                aria-label={showNewPassword ? "Hide password" : "Show password"}
              >
                {showNewPassword ? (
                  <EyeIcon className="fill-gray-500 size-5" />
                ) : (
                  <EyeCloseIcon className="fill-gray-500 size-5" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Confirm new password
            </label>
            <div className={inputWrap}>
              <LockKeyhole size={18} className="text-gray-400" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-transparent text-sm text-gray-900 outline-none dark:text-white"
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
            {isSubmitting ? "Saving..." : "Update password"}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
