export const SESSION_EXPIRED_MESSAGE =
  "Your session has expired. Please sign in again.";

let activeLogout: "loanOfficer" | "broker" | "coBroker" | null = null;

export function isSessionLogoutInProgress() {
  return activeLogout !== null;
}

export function beginSessionLogout(
  portal: "loanOfficer" | "broker" | "coBroker",
): boolean {
  if (activeLogout) return false;
  activeLogout = portal;
  return true;
}

export function showSessionExpiredToast() {
  void import("react-hot-toast").then(({ default: toast }) => {
    toast.error(SESSION_EXPIRED_MESSAGE, { id: "session-expired" });
  });
}

export function isSessionExpiredError(err: unknown): boolean {
  if (isSessionLogoutInProgress()) return true;
  return err instanceof Error && err.message === SESSION_EXPIRED_MESSAGE;
}
