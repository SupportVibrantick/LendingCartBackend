import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import Label from "../form/Label";
import Input from "../form/input/InputField";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

type Portal = "broker" | "sub-broker" | "loan-officer";

function getSignInPath(portal: Portal) {
  if (portal === "sub-broker") return "/sub-broker/login";
  if (portal === "loan-officer") return "/loan-officer/login";
  return "/signin";
}

export default function ForgotPasswordForm({ portal = "broker" }: { portal?: Portal }) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanEmail = email.trim();
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
    } catch (err: any) {
      toast.error(err.message || "Unable to send reset link", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const signInPath = getSignInPath(portal);

  if (emailSent) {
    return (
      <div className="flex flex-col flex-1">
        <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Check your email
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              If an account exists for <strong>{email}</strong>, we sent a password
              reset link. The link expires in 1 hour.
            </p>
          </div>

          <Link
            to={signInPath}
            className="inline-flex justify-center w-full px-4 py-2 text-sm text-white rounded-md bg-blue-600 hover:bg-blue-700"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div className="mb-5 sm:mb-8">
          <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
            Forgot password?
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            <div>
              <Label>
                Email <span className="text-error-500">*</span>
              </Label>
              <Input
                type="email"
                placeholder="broker@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="w-full px-4 py-2 text-sm text-white rounded-md bg-blue-600 disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Sending..." : "Send reset link"}
            </button>
          </div>
        </form>

        <div className="mt-5">
          <p className="text-sm text-center text-gray-700 dark:text-gray-400 sm:text-start">
            Remember your password?{" "}
            <Link to={signInPath} className="text-brand-500 hover:text-brand-600">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
