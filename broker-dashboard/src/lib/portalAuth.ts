import { getBrokerToken, handleBrokerUnauthorized, checkBrokerResponse } from "./brokerSession";
import {
  getLoanOfficerToken,
  handleLoanOfficerUnauthorized,
  checkLoanOfficerResponse,
} from "./loanOfficerApi";
import {
  getCoBrokerToken,
  handleCoBrokerUnauthorized,
  checkCoBrokerResponse,
} from "./coBrokerPortal";

export function isLoanOfficerPortalPath(
  pathname = typeof window !== "undefined" ? window.location.pathname : "",
): boolean {
  return (
    pathname.startsWith("/loan-officer") &&
    !pathname.startsWith("/loan-officer/login") &&
    !pathname.startsWith("/loan-officer/impersonate")
  );
}

export function isCoBrokerPortalPath(
  pathname = typeof window !== "undefined" ? window.location.pathname : "",
): boolean {
  if (
    pathname.startsWith("/sub-broker/login") ||
    pathname.startsWith("/sub-broker/impersonate")
  ) {
    return false;
  }

  // Co-broker portal lives under /sub-broker/* — not broker admin /sub-brokers.
  return pathname === "/sub-broker" || pathname.startsWith("/sub-broker/");
}

export function getPortalToken(): string | null {
  if (typeof window === "undefined") return null;
  if (isCoBrokerPortalPath()) {
    return getCoBrokerToken();
  }
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
  if (isCoBrokerPortalPath()) {
    return handleCoBrokerUnauthorized();
  }
  if (isLoanOfficerPortalPath()) {
    return handleLoanOfficerUnauthorized();
  }
  return handleBrokerUnauthorized();
}

export function checkPortalResponse(
  res: Response,
  json?: Record<string, unknown>,
): void {
  if (isCoBrokerPortalPath()) {
    checkCoBrokerResponse(res, json as { message?: string } | undefined);
    return;
  }
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
