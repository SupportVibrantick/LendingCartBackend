import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import toast from "react-hot-toast";
import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export default function VerifyEmailPending() {
  const [searchParams] = useSearchParams();
  const email = useMemo(
    () => String(searchParams.get("email") || "").trim().toLowerCase(),
    [searchParams],
  );
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    if (!email) {
      toast.error("Email is missing. Please sign up again.");
      return;
    }

    try {
      setResending(true);
      const res = await fetch(`${API_BASE}/lender/auth/verify-email/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        toast.error(json.message || "Failed to resend verification email");
        return;
      }
      if (json.data?.alreadyVerified) {
        toast.success("Email is already verified. You can sign in.");
        return;
      }
      toast.success("Verification email sent. Check your inbox.");
    } catch {
      toast.error("Failed to resend verification email");
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <PageMeta
        title="Verify your email | LendingCart"
        description="Verify your email to access the lender dashboard"
      />
      <AuthLayout>
        <div className="w-full">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">
            Almost there
          </p>
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-white sm:text-3xl">
            Verify your email
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            We sent a verification link
            {email ? (
              <>
                {" "}
                to <span className="font-semibold text-gray-800 dark:text-white">{email}</span>
              </>
            ) : null}
            . Please verify your email before signing in to the lender dashboard.
          </p>

          <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50/70 px-4 py-3 text-sm text-brand-900 dark:border-brand-900/40 dark:bg-brand-950/30 dark:text-brand-100">
            Check your inbox and spam folder. The link expires in 24 hours.
          </div>

          <button
            type="button"
            onClick={handleResend}
            disabled={resending || !email}
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800"
          >
            {resending ? "Sending..." : "Resend verification email"}
          </button>

          <Link
            to="/signin"
            className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-[#264863] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#183b57]"
          >
            Go to sign in
          </Link>

          <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Wrong email?{" "}
            <Link
              to="/partner/signup"
              className="font-semibold text-brand-800 hover:underline dark:text-brand-300"
            >
              Sign up again
            </Link>
          </p>
        </div>
      </AuthLayout>
    </>
  );
}
