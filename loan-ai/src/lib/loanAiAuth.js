import { API_BASE } from "./api";

const TOKEN_KEY = "loan_ai_token";
const USER_KEY = "loan_ai_user";

async function parseJsonResponse(res) {
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Request failed");
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
  return parseJsonResponse(res);
}

export async function loginLoanAiUser(email, password) {
  const res = await fetch(`${API_BASE}/public/loan-ai/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  return parseJsonResponse(res);
}

export async function fetchLoanAiMe(token) {
  const res = await fetch(`${API_BASE}/public/loan-ai/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJsonResponse(res);
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
  return parseJsonResponse(res);
}
