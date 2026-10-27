import { BROKER_API_BASE, getBrokerAuthHeaders } from "./brokerApi";

export type BrokerTeamInviteRole = "LOAN_OFFICER" | "SUB_BROKER";

export type BrokerTeamInviteResult = {
  id: string;
  role: BrokerTeamInviteRole;
  token: string;
  expiresAt: string;
  inviteUrl: string;
  expiresInHours: number;
};

function buildLocalInviteUrl(role: BrokerTeamInviteRole, token: string) {
  const path =
    role === "SUB_BROKER" ? "/join/co-broker" : "/join/loan-officer";
  return `${window.location.origin}${path}?token=${encodeURIComponent(token)}`;
}

export async function createBrokerTeamInvite(
  role: BrokerTeamInviteRole,
): Promise<BrokerTeamInviteResult> {
  const res = await fetch(`${BROKER_API_BASE}/broker/team-invites`, {
    method: "POST",
    headers: getBrokerAuthHeaders(true),
    body: JSON.stringify({ role }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success || !json.data?.token) {
    throw new Error(json.message || "Failed to create invite link");
  }

  const data = json.data as BrokerTeamInviteResult;
  return {
    ...data,
    // Prefer current origin so local/prod host always matches the open app.
    inviteUrl: buildLocalInviteUrl(role, data.token),
  };
}

export async function copyBrokerTeamInviteLink(
  role: BrokerTeamInviteRole,
): Promise<BrokerTeamInviteResult> {
  const invite = await createBrokerTeamInvite(role);
  await navigator.clipboard.writeText(invite.inviteUrl);
  return invite;
}
