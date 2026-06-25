export type LenderTeamRole =
  | "LENDER_ADMIN"
  | "LENDER_UNDERWRITER"
  | "LENDER_ANALYST"
  | "LENDER_VIEWER";

export type LenderTeamMember = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  status: string;
  displayStatus: string;
  role: LenderTeamRole | null;
  roleLabel: string;
  lastLoginAt?: string | null;
  createdAt: string;
};

export const LENDER_TEAM_ROLE_OPTIONS: Array<{
  value: LenderTeamRole;
  label: string;
  description: string;
}> = [
  {
    value: "LENDER_ADMIN",
    label: "Admin",
    description: "Full portal access.",
  },
  {
    value: "LENDER_UNDERWRITER",
    label: "Underwriter",
    description:
      "Review deals, request documents, approve or decline, generate LOI, and chat with brokers.",
  },
  {
    value: "LENDER_ANALYST",
    label: "Analyst",
    description:
      "Review deals and documents, request supporting documents, and chat with brokers.",
  },
  {
    value: "LENDER_VIEWER",
    label: "Viewer",
    description: "Read-only access. Can view deals and chat history but cannot make changes or send messages.",
  },
];

export function getLenderRoles(): string[] {
  try {
    const raw = sessionStorage.getItem("roles");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isLenderAdminUser(): boolean {
  return getLenderRoles().includes("LENDER_ADMIN");
}

export function getRoleOption(role?: string | null) {
  return LENDER_TEAM_ROLE_OPTIONS.find((option) => option.value === role);
}

export function formatTeamMemberName(member: Pick<LenderTeamMember, "firstName" | "lastName">) {
  return `${member.firstName || ""} ${member.lastName || ""}`.trim();
}

export function getMemberInitials(member: Pick<LenderTeamMember, "firstName" | "lastName">) {
  const first = member.firstName?.charAt(0) || "";
  const last = member.lastName?.charAt(0) || "";
  return `${first}${last}`.toUpperCase() || "?";
}

export function formatDisplayStatus(status?: string | null) {
  switch (String(status || "").toUpperCase()) {
    case "INVITED":
      return "Invited";
    case "ACTIVE":
      return "Active";
    case "DISABLED":
      return "Disabled";
    default:
      return status || "—";
  }
}

export function formatTeamDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTeamDateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function roleBadgeClass(role?: string | null) {
  switch (role) {
    case "LENDER_ADMIN":
      return "bg-violet-100 text-violet-700 ring-violet-200";
    case "LENDER_UNDERWRITER":
      return "bg-sky-100 text-sky-700 ring-sky-200";
    case "LENDER_ANALYST":
      return "bg-amber-100 text-amber-700 ring-amber-200";
    case "LENDER_VIEWER":
      return "bg-slate-100 text-slate-700 ring-slate-200";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

export function statusBadgeClass(status?: string | null) {
  switch (String(status || "").toUpperCase()) {
    case "INVITED":
      return "bg-amber-100 text-amber-700 ring-amber-200";
    case "ACTIVE":
      return "bg-emerald-100 text-emerald-700 ring-emerald-200";
    case "DISABLED":
      return "bg-rose-100 text-rose-700 ring-rose-200";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}
