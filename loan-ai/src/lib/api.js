export const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:4000";

/**
 * Fetch active subscription packages for public pricing pages.
 * @returns {Promise<import('../types/pricing').SubscriptionPackage[]>}
 */
export async function fetchSubscriptionPackages() {
  const res = await fetch(`${API_BASE}/common/subscriptions`);

  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.message || "Failed to load pricing");
  }

  return json.data || [];
}

/**
 * Submit a book-demo request from the Loan AI marketing site.
 */
export async function submitBookDemoRequest(payload) {
  const res = await fetch(`${API_BASE}/public/landing-leads/loan-ai-book-demo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.message || "Failed to submit demo request");
  }

  return json;
}
