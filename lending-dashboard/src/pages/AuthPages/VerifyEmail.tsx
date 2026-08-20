import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import toast from "react-hot-toast";
import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    token ? "loading" : "error",
  );
  const [message, setMessage] = useState(
    token ? "Verifying your email..." : "Verification token is missing",
  );
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/lender/auth/verify-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (!res.ok || !json.success) {
          setStatus("error");
          setMessage(json.message || "Verification failed");
          return;
        }

        setStatus("success");
        setMessage(json.message || "Email verified successfully");
        setEmail(String(json.data?.email || ""));
        toast.success(json.message || "Email verified");
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("Verification failed");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const signInHref = email
    ? `/signin?email=${encodeURIComponent(email)}`
    : "/signin";

  return (
    <>
      <PageMeta title="Verify Email | LendingCart" description="" />
      <AuthLayout>
        <div className="w-full text-center">
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-white">
            Email verification
          </h1>
          <p
            className={`mt-4 text-sm ${
              status === "error"
                ? "text-red-600 dark:text-red-400"
                : "text-gray-600 dark:text-gray-300"
            }`}
          >
            {message}
          </p>
          {status === "success" && (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              You can now sign in to access your lender dashboard.
            </p>
          )}
          <Link
            to={status === "success" ? signInHref : "/signin"}
            className="mt-8 inline-flex items-center justify-center rounded-xl bg-[#264863] px-5 py-3 text-sm font-semibold text-white"
          >
            {status === "success" ? "Continue to sign in" : "Sign in"}
          </Link>
          {status === "error" && (
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Need a new link?{" "}
              <Link
                to="/verify-email-pending"
                className="font-semibold text-brand-800 hover:underline dark:text-brand-300"
              >
                Resend verification
              </Link>
            </p>
          )}
        </div>
      </AuthLayout>
    </>
  );
}
