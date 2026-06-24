import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  clearLenderSession,
  isLenderTokenExpired,
} from "../../lib/lenderSession";

type Props = {
  children: React.ReactElement;
};

/**
 * Protects routes by checking sessionStorage for a valid, non-expired lender token.
 */
export default function RequireAuth({ children }: Props) {
  const location = useLocation();
  const token =
    typeof window !== "undefined" ? sessionStorage.getItem("lender_token") : null;

  if (!token || isLenderTokenExpired(token)) {
    if (token) {
      clearLenderSession();
    }
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  return children;
}
