import { getBrokerToken, handleBrokerUnauthorized, checkBrokerResponse } from "./brokerSession";
import {
  getLoanOfficerToken,
  handleLoanOfficerUnauthorized,
  checkLoanOfficerResponse,
} from "./loanOfficerApi";

export function isLoanOfficerPortalPath(
  pathname = typeof window !== "undefined" ? window.location.pathname : "",
): boolean {
  return (
    pathname.startsWith("/loan-officer") &&
    !pathname.startsWith("/loan-officer/login") &&
    !pathname.startsWith("/loan-officer/impersonate")
  );
}

export function getPortalToken(): string | null {
  if (typeof window === "undefined") return null;
  if (isLoanOfficerPortalPath()) {
    return getLoanOfficerToken();
  }
  return getBrokerToken();
}

export function getPortalAuthHeaders(json = false): Record<string, string> {
  const token = getPortalToken();
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function handlePortalUnauthorized(_message?: string): Error {
  if (isLoanOfficerPortalPath()) {
    return handleLoanOfficerUnauthorized();
  }
  return handleBrokerUnauthorized();
}

export function checkPortalResponse(
  res: Response,
  json?: Record<string, unknown>,
): void {
  if (isLoanOfficerPortalPath()) {
    checkLoanOfficerResponse(res, json);
    return;
  }
  checkBrokerResponse(res, json);
}

export function assertPortalApiOk(
  res: Response,
  json: { success?: boolean; message?: string },
  fallback: string,
): void {
  checkPortalResponse(res, json);
  if (!res.ok || json.success === false) {
    throw new Error(json.message || fallback);
  }
}
