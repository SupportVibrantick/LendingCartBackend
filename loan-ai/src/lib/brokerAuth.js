export const BROKER_DASHBOARD_URL =
  import.meta.env.VITE_BROKER_DASHBOARD_URL || "http://localhost:5173";

export function getBrokerSignInUrl() {
  return `${BROKER_DASHBOARD_URL.replace(/\/$/, "")}/signin`;
}

export function getBrokerSetPasswordUrl(token) {
  const base = BROKER_DASHBOARD_URL.replace(/\/$/, "");
  if (!token) return `${base}/reset-password`;
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

export function redirectToBrokerDashboard(token, user) {
  const base = getBrokerSignInUrl();
  const params = new URLSearchParams({ token });
  if (user) {
    params.set("user", encodeURIComponent(JSON.stringify(user)));
  }
  window.location.href = `${base}?${params.toString()}`;
}
