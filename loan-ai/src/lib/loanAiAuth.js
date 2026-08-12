import { API_BASE } from "./api";
import {
  CheckoutRequestError,
  getCheckoutUserMessage,
} from "./checkoutErrors";
import { getAuthUserMessage } from "./authErrors";

const TOKEN_KEY = "loan_ai_token";
const USER_KEY = "loan_ai_user";

async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

async function parseAuthJsonResponse(res, context = "register") {
  const json = await readJson(res);
  if (!res.ok || !json.success) {
    const err = new Error(
      getAuthUserMessage(
        { message: json.message, status: res.status, code: json.code },
        context,
      ),
    );
    err.status = res.status;
    err.code = json.code;
    throw err;
  }
  return json;
}

async function parseCheckoutJsonResponse(res) {
  const json = await readJson(res);
  if (!res.ok || !json.success) {
    throw new CheckoutRequestError(
      getCheckoutUserMessage({
        code: json.code,
        message: json.message,
      }),
      { code: json.code, status: res.status },
    );
  }
  return json;
}

export function getStoredLoanAiToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredLoanAiUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function persistLoanAiSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearLoanAiSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function registerLoanAiUser(payload) {
  const res = await fetch(`${API_BASE}/public/loan-ai/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseAuthJsonResponse(res, "register");
}

export async function loginLoanAiUser(email, password) {
  const res = await fetch(`${API_BASE}/public/loan-ai/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  return parseAuthJsonResponse(res, "login");
}

export async function fetchLoanAiMe(token) {
  const res = await fetch(`${API_BASE}/public/loan-ai/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseAuthJsonResponse(res, "login");
}

export async function purchaseLoanAiSubscription(token, payload) {
  const res = await fetch(`${API_BASE}/public/loan-ai/subscriptions/purchase`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return parseCheckoutJsonResponse(res);
}

/**
 * Start GHL checkout via LendingCart backend (never call GHL from the browser).
 * @param {string} token
 * @param {{ packageId: string, billingCycle: 'MONTHLY'|'YEARLY', successUrl?: string, cancelUrl?: string, phone?: string }} payload
 */
export async function startLoanAiCheckout(token, payload) {
  const res = await fetch(`${API_BASE}/public/payments/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      packageId: payload.packageId,
      billingCycle: payload.billingCycle || payload.billingPeriod || "MONTHLY",
      successUrl: payload.successUrl,
      cancelUrl: payload.cancelUrl,
      phone: payload.phone,
    }),
  });
  return parseCheckoutJsonResponse(res);
}
