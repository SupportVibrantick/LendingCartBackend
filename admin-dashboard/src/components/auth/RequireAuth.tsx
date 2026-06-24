import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  clearAdminSession,
  isAdminTokenExpired,
} from "../../lib/adminSession";

type Props = {
  children: React.ReactElement;
};

/**
 * Protects routes by checking sessionStorage for a valid, non-expired admin token.
 */
export default function RequireAuth({ children }: Props) {
  const location = useLocation();
  const token =
    typeof window !== "undefined" ? sessionStorage.getItem("admin_token") : null;

  if (!token || isAdminTokenExpired(token)) {
    if (token) {
      clearAdminSession();
    }
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  return children;
}
