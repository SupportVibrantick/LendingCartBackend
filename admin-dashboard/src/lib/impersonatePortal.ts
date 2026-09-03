/**
 * Broker-dashboard hosts LO / co-broker / client portals.
 * Prefer VITE_BROKER_URI; default matches local broker-dashboard (5173).
 */
export const BROKER_DASHBOARD_URI = (
  import.meta.env.VITE_BROKER_URI || "http://localhost:5173"
).replace(/\/$/, "");

/**
 * Build impersonation URLs using the hash fragment so JWTs are not sent to
 * nginx in the request line (avoids ERR_CONNECTION_CLOSED on long query strings).
 */
export function buildImpersonatePortalUrl(
  basePath: string,
  params: Record<string, string>,
): string {
  const path = basePath.startsWith("http")
    ? basePath
    : `${BROKER_DASHBOARD_URI}${basePath.startsWith("/") ? basePath : `/${basePath}`}`;
  const payload = new URLSearchParams(params).toString();
  return `${path}#${payload}`;
}

/**
 * Open a blank tab synchronously (must run in the click handler), then navigate
 * after the impersonation API returns. Returns null if the popup was blocked.
 */
export function openBlankPortalTab(): Window | null {
  const newTab = window.open("about:blank", "_blank");
  if (!newTab) return null;
  try {
    newTab.opener = null;
  } catch {
    // ignore cross-origin opener assignment failures
  }
  return newTab;
}

export function navigatePortalTab(tab: Window, portalUrl: string) {
  tab.location.href = portalUrl;
}
