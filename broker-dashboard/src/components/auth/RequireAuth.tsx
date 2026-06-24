import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  clearBrokerSession,
  isBrokerTokenExpired,
} from "../../lib/brokerSession";

type Props = {
  children: React.ReactElement;
};

/**
 * Protects routes by checking sessionStorage for a valid, non-expired broker token.
 */
export default function RequireAuth({ children }: Props) {
  const location = useLocation();
  const token =
    typeof window !== "undefined" ? sessionStorage.getItem("broker_token") : null;

  if (!token || isBrokerTokenExpired(token)) {
    if (token) {
      clearBrokerSession();
    }
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  return children;
}
