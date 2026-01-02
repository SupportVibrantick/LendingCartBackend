// src/components/auth/RequireAuth.tsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";

type Props = {
  children: React.ReactElement;
};

/**
 * Protects routes by checking sessionStorage for the admin token.
 * If not present, redirects to /signin and preserves attempted location.
 */
export default function RequireAuth({ children }: Props) {
  const location = useLocation();
  const token = typeof window !== "undefined" ? sessionStorage.getItem("admin_token") : null;

  if (!token) {
    // redirect to signin and remember where user wanted to go
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  return children;
}
