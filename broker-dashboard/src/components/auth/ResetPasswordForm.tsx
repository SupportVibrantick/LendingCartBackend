import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../form/Label";
import Input from "../form/input/InputField";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

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

  const signInPath = getSignInPath(portal);

  useEffect(() => {
    const validateToken = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/broker/auth/reset-password/validate?token=${encodeURIComponent(token)}`
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
      toast.success(json.message || "Password reset successfully", {
        id: toastId,
      });
    } catch (err: any) {
      toast.error(err.message || "Unable to reset password", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return (
      <div className="flex flex-col flex-1 justify-center w-full max-w-md mx-auto">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Validating reset link...
        </p>
      </div>
    );
  }

  if (!isTokenValid) {
    return (
      <div className="flex flex-col flex-1 justify-center w-full max-w-md mx-auto">
        <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
          Invalid or expired link
        </h1>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          This password reset link is invalid or has expired. Request a new one.
        </p>
        <Link
          to={`/reset-password${portal !== "broker" ? `?portal=${portal}` : ""}`}
          className="inline-flex justify-center w-full px-4 py-2 text-sm text-white rounded-md bg-blue-600 hover:bg-blue-700"
        >
          Request new link
        </Link>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="flex flex-col flex-1 justify-center w-full max-w-md mx-auto">
        <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
          Password updated
        </h1>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          Your password has been reset. You can now sign in with your new password.
        </p>
        <Link
          to={signInPath}
          className="inline-flex justify-center w-full px-4 py-2 text-sm text-white rounded-md bg-blue-600 hover:bg-blue-700"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div className="mb-5 sm:mb-8">
          <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
            Set new password
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {accountEmail
              ? `Create a new password for ${accountEmail}.`
              : "Create a new password for your account."}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            <div>
              <Label>
                New password <span className="text-error-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <span
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                >
                  {showPassword ? (
                    <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                  ) : (
                    <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                  )}
                </span>
              </div>
            </div>

            <div>
              <Label>
                Confirm password <span className="text-error-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <span
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                >
                  {showConfirmPassword ? (
                    <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                  ) : (
                    <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                  )}
                </span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full px-4 py-2 text-sm text-white rounded-md bg-blue-600 disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Reset password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
