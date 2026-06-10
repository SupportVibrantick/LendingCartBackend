export const SUBSCRIBER_DETAIL_PATH = "/subscription-subscribers/detail";

const STORAGE_KEY = "admin_subscriber_org_id";

export function setSubscriberOrgId(orgId: string) {
  sessionStorage.setItem(STORAGE_KEY, orgId);
}

export function getSubscriberOrgId(
  state?: { organizationId?: string } | null,
): string | null {
  if (state?.organizationId) return state.organizationId;
  const stored = sessionStorage.getItem(STORAGE_KEY);
  return stored || null;
}

export function openSubscriberDetail(
  navigate: (path: string, options?: { state?: { organizationId: string } }) => void,
  orgId: string,
) {
  setSubscriberOrgId(orgId);
  navigate(SUBSCRIBER_DETAIL_PATH, { state: { organizationId: orgId } });
}
