export const ACTIVE_BROKER_ID_KEY = "admin_active_broker_id";
export const BROKER_DETAIL_PATH = "/broker-detail";

export function setActiveBrokerId(id: string) {
  sessionStorage.setItem(ACTIVE_BROKER_ID_KEY, id);
}

export function getActiveBrokerId(): string | null {
  return sessionStorage.getItem(ACTIVE_BROKER_ID_KEY);
}

export function clearActiveBrokerId() {
  sessionStorage.removeItem(ACTIVE_BROKER_ID_KEY);
}
