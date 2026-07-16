import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  clearLenderSession,
  isLenderTokenExpired,
  verifyLenderSession,
} from "../../lib/lenderSession";

type Props = {
  children: React.ReactElement;
};

/**
 * Protects routes by checking sessionStorage for a valid, non-expired lender token
 * and confirming the account has verified email via /me.
 */
export default function RequireAuth({ children }: Props) {
  const location = useLocation();
  const token =
    typeof window !== "undefined" ? sessionStorage.getItem("lender_token") : null;

  const [status, setStatus] = useState<"checking" | "ok" | "deny">(
    !token || isLenderTokenExpired(token) ? "deny" : "checking",
  );

  useEffect(() => {
    if (!token || isLenderTokenExpired(token)) {
      if (token) clearLenderSession();
      setStatus("deny");
      return;
    }

    let cancelled = false;
    (async () => {
      const ok = await verifyLenderSession(token);
      if (cancelled) return;
      if (!ok) {
        clearLenderSession();
        setStatus("deny");
        return;
      }
      setStatus("ok");
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status === "deny") {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-gray-950">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Checking session...
        </p>
      </div>
    );
  }

  return children;
}
