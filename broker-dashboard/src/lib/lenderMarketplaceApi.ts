import { buildApiPublicFileUrl } from "./publicFileUrl";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export { API_BASE };

export function getBrokerAuthHeaders(): HeadersInit {
  const token = sessionStorage.getItem("broker_token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

export type DiscoverLender = {
  id: string;
  name: string;
  email: string;
  phone: string;
  brandLogoUrl?: string | null;
  brandName?: string | null;
  profileImage?: string | null;
  loanTypes: string[];
  minFunding: string;
  maxFunding: string;
  statesSupported?: string;
  industries?: string;
  fundingSpeedDays?: number | null;
  summary?: string;
  profileStatus?: string;
  isEligible: boolean;
};

export type ConnectedLender = {
  lenderId: string;
  lenderName: string;
  lenderEmail: string;
  connectedAt: string;
};

export type LenderProduct = {
  lenderProductId: string;
  loanProductCode: string;
  loanProductName: string;
  minLoanAmount: string;
  maxLoanAmount: string;
  termRange: string | null;
  regionsSupported: string;
  description?: string | null;
  industriesSupported: string;
  isActive: boolean;
};

export type PipelineSubmissionOption = {
  submissionId: string;
  applicationId: string;
  applicationNumber?: string;
  borrower: string;
  loanInfo?: string;
  amount: number;
  status: string;
  submittedOn?: string;
};

export type LenderInvite = {
  inviteId: string;
  lenderId: string;
  name: string;
  email: string;
  phone?: string;
  profileImage?: string | null;
  lenderStatus?: string;
  inviteStatus: "PENDING" | "ACCEPTED" | "REJECTED";
  invitedAt: string;
};

export type IncomingLenderInvite = {
  inviteId: string;
  lenderId: string;
  lenderName: string;
  lenderEmail: string;
  invitedAt: string;
};

export type InviteStats = {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
};

export type DiscoverLenderFilters = {
  loanProduct?: string;
  state?: string;
  fundingMax?: string;
  minAmount?: string;
  maxAmount?: string;
  industry?: string;
  eligible?: boolean;
};

export async function fetchDiscoverLenders(params: {
  q?: string;
  page?: number;
  limit?: number;
  filters?: DiscoverLenderFilters;
}) {
  const search = new URLSearchParams({
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 9),
    ...(params.q ? { q: params.q } : {}),
    ...(params.filters?.loanProduct
      ? { loanProduct: params.filters.loanProduct }
      : {}),
    ...(params.filters?.state ? { state: params.filters.state } : {}),
    ...(params.filters?.fundingMax
      ? { fundingMax: params.filters.fundingMax }
      : {}),
    ...(params.filters?.minAmount
      ? { minAmount: params.filters.minAmount }
      : {}),
    ...(params.filters?.maxAmount
      ? { maxAmount: params.filters.maxAmount }
      : {}),
    ...(params.filters?.industry
      ? { industry: params.filters.industry }
      : {}),
    ...(params.filters?.eligible ? { eligible: "true" } : {}),
  });

  const res = await fetch(`${API_BASE}/broker/lenders?${search}`, {
    headers: getBrokerAuthHeaders(),
  });
  const json = await res.json();
  if (!res.ok || json.success !== true) {
    throw new Error(json.message || "Failed to load lenders");
  }

  const data: DiscoverLender[] = (json.data || []).map((l: any) => ({
    id: l.id,
    name: l.name,
    email: l.email,
    phone: l.phone,
    profileImage: l.profileImage || null,
    brandLogoUrl: l.brandLogoUrl || null,
    brandName: l.brandName || null,
    loanTypes: l.lenderProfile?.loanTypes || [],
    minFunding: l.lenderProfile?.minFunding ?? "",
    maxFunding: l.lenderProfile?.maxFunding ?? "",
    statesSupported: l.lenderProfile?.statesSupported,
    industries: l.lenderProfile?.industries,
    fundingSpeedDays: l.lenderProfile?.fundingSpeedDays,
    summary: l.lenderProfile?.summary,
    profileStatus: l.lenderProfile?.profileStatus,
    isEligible: l.lenderProfile?.profileStatus === "COMPLETED",
  }));

  return { data, meta: json.meta || { page: 1, limit: 9, total: 0 } };
}

export async function inviteLender(lenderOrgId: string) {
  const res = await fetch(`${API_BASE}/broker/lenders/invite`, {
    method: "POST",
    headers: getBrokerAuthHeaders(),
    body: JSON.stringify({ lenderOrgId }),
  });
  const json = await res.json();
  if (!res.ok || json.success !== true) {
    throw new Error(json.message || "Failed to send invitation");
  }
  return json;
}

export type DuplicateLenderMatch = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  profileStatus: string | null;
  isVisible: boolean;
  website: string | null;
  isConnected: boolean;
};

export type DuplicateCheckResult = {
  duplicate: boolean;
  matchReason?: "email" | "website" | "companyName";
  lender?: DuplicateLenderMatch;
};

export type BrokerLenderSubmission = {
  id: string;
  lenderOrgId: string | null;
  companyName: string;
  contactPerson: string;
  businessEmail: string;
  phone: string;
  website: string | null;
  notes: string | null;
  inviteStatus: string;
  submissionStatus: string;
  expiresAt: string;
  lastSentAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
  lender: {
    id: string;
    name: string;
    status: string;
    profileStatus: string | null;
    isVisible: boolean;
  } | null;
};

export type SubmitBrokerLenderPayload = {
  companyName: string;
  businessEmail: string;
  contactPerson: string;
  phone: string;
  website?: string;
  notes?: string;
};

export async function checkBrokerLenderDuplicate(
  payload: Pick<
    SubmitBrokerLenderPayload,
    "companyName" | "businessEmail" | "website"
  >,
): Promise<DuplicateCheckResult> {
  const res = await fetch(`${API_BASE}/broker/lenders/community/check-duplicate`, {
    method: "POST",
    headers: getBrokerAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || json.success !== true) {
    throw new Error(json.message || "Duplicate check failed");
  }
  return {
    duplicate: Boolean(json.duplicate),
    matchReason: json.matchReason,
    lender: json.lender,
  };
}

export async function submitBrokerLender(payload: SubmitBrokerLenderPayload) {
  const res = await fetch(`${API_BASE}/broker/lenders/community/submit`, {
    method: "POST",
    headers: getBrokerAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (res.status === 409 && json.code === "DUPLICATE") {
    const err = new Error(json.message || "This lender already exists.") as Error & {
      code: string;
      duplicate?: DuplicateCheckResult;
    };
    err.code = "DUPLICATE";
    err.duplicate = json.duplicate;
    throw err;
  }
  if (!res.ok || json.success !== true) {
    throw new Error(json.message || "Failed to submit lender");
  }
  return json.data as BrokerLenderSubmission;
}

export async function fetchBrokerLenderSubmissions(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.search?.trim()) search.set("search", params.search.trim());

  const qs = search.toString();
  const res = await fetch(
    `${API_BASE}/broker/lenders/community/submissions${qs ? `?${qs}` : ""}`,
    { headers: getBrokerAuthHeaders() },
  );
  const json = await res.json();
  if (!res.ok || json.success !== true) {
    throw new Error(json.message || "Failed to load submissions");
  }
  return {
    data: (json.data || []) as BrokerLenderSubmission[],
    pagination: json.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 },
  };
}

export async function resendBrokerLenderInvite(inviteId: string) {
  const res = await fetch(
    `${API_BASE}/broker/lenders/community/submissions/${encodeURIComponent(inviteId)}/resend`,
    {
      method: "POST",
      headers: getBrokerAuthHeaders(),
    },
  );
  const json = await res.json();
  if (!res.ok || json.success !== true) {
    throw new Error(json.message || "Failed to resend invitation");
  }
  return json.data as BrokerLenderSubmission;
}

export function formatSubmissionStatus(status: string) {
  const map: Record<string, string> = {
    INVITE_SENT: "Invite Sent",
    EXPIRED: "Invite Expired",
    ACCEPTED: "Accepted — Profile Incomplete",
    PROFILE_COMPLETE: "Profile Complete",
    DECLINED: "Declined",
    CANCELLED: "Cancelled",
    PENDING: "Pending",
  };
  return map[status] || status.replace(/_/g, " ");
}

export function submissionStatusTone(status: string) {
  if (status === "PROFILE_COMPLETE") return "emerald";
  if (status === "ACCEPTED") return "blue";
  if (status === "INVITE_SENT") return "amber";
  if (status === "EXPIRED") return "rose";
  return "slate";
}

export async function fetchConnectedLenders() {
  const res = await fetch(`${API_BASE}/broker/lenders/connected`, {
    headers: getBrokerAuthHeaders(),
  });
  const json = await res.json();
  if (!res.ok || json.success !== true) {
    throw new Error(json.message || "Failed to load connected lenders");
  }
  return (json.data || []) as ConnectedLender[];
}

export async function fetchSentInvites() {
  const res = await fetch(`${API_BASE}/broker/lenders/invites/list`, {
    headers: getBrokerAuthHeaders(),
  });
  const json = await res.json();
  if (!res.ok || json.success !== true) {
    throw new Error(json.message || "Failed to load invites");
  }
  return {
    data: (json.data || []) as LenderInvite[],
    stats: (json.stats || {
      total: 0,
      pending: 0,
      accepted: 0,
      rejected: 0,
    }) as InviteStats,
  };
}

export async function fetchIncomingInvites() {
  const res = await fetch(`${API_BASE}/broker/lenders/invites`, {
    headers: getBrokerAuthHeaders(),
  });
  const json = await res.json();
  if (!res.ok || json.success !== true) {
    throw new Error(json.message || "Failed to load incoming invites");
  }
  return (json.data || []) as IncomingLenderInvite[];
}

export async function acceptIncomingInvite(inviteId: string) {
  const res = await fetch(`${API_BASE}/broker/lenders/accept/${inviteId}`, {
    method: "POST",
    headers: getBrokerAuthHeaders(),
    body: JSON.stringify({}),
  });
  const json = await res.json();
  if (!res.ok || json.success !== true) {
    throw new Error(json.message || "Failed to accept invite");
  }
  return json;
}

export async function rejectIncomingInvite(inviteId: string) {
  const res = await fetch(`${API_BASE}/broker/lenders/reject/${inviteId}`, {
    method: "POST",
    headers: getBrokerAuthHeaders(),
    body: JSON.stringify({}),
  });
  const json = await res.json();
  if (!res.ok || json.success !== true) {
    throw new Error(json.message || "Failed to reject invite");
  }
  return json;
}

export function formatFundingRange(min: string, max: string) {
  const fmt = (v: string) =>
    v ? `$${Number(v).toLocaleString()}` : null;
  const lo = fmt(min);
  const hi = fmt(max);
  if (lo && hi) return `${lo} – ${hi}`;
  if (lo) return `${lo}+`;
  if (hi) return `Up to ${hi}`;
  return "Not specified";
}

export function formatDateTime(date: string) {
  return new Date(date).toLocaleString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function fetchLenderProducts(lenderOrgId: string) {
  const res = await fetch(`${API_BASE}/broker/lenders/products/${lenderOrgId}`, {
    headers: getBrokerAuthHeaders(),
  });
  const json = await res.json();
  if (!res.ok || json.success !== true) {
    throw new Error(json.message || "Failed to load lender products");
  }
  return (json.data || []) as LenderProduct[];
}

export async function fetchRecentPipelineSubmissions(limit = 20) {
  const url = new URL(`${API_BASE}/broker/loan-pipeline/submissions`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("sortOrder", "desc");

  const res = await fetch(url.toString(), {
    headers: getBrokerAuthHeaders(),
  });
  const json = await res.json();
  if (!res.ok || json.success === false) {
    throw new Error(json.message || "Failed to load loan applications");
  }

  const list = Array.isArray(json.data) ? json.data : [];
  return list
    .filter((item: any) => item.status && item.status !== "DRAFT")
    .map(
      (item: any): PipelineSubmissionOption => ({
        submissionId: item.submissionId,
        applicationId: item.applicationId,
        applicationNumber: item.applicationNumber,
        borrower: item.borrower || "N/A",
        loanInfo: item.loanInfo,
        amount: Number(item.amount) || 0,
        status: item.status,
        submittedOn: item.submittedOn,
      }),
    );
}

export type EligibleLenderMatch = {
  lenderOrgId: string;
  lenderName: string;
  lenderProductId: string;
  canSend: boolean;
  eligible: boolean;
  alreadySent: boolean;
  loanProductCode: string;
  rejectionReasons?: string[];
};

export async function fetchEligibleLendersForSubmission(
  submissionId: string,
  options?: { limit?: number },
) {
  const limit = Math.min(options?.limit ?? 100, 100);
  const url = new URL(
    `${API_BASE}/broker/lender-discovery/applications/submissions/${submissionId}/eligible`,
  );
  url.searchParams.set("page", "1");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("filter", "eligible");

  const res = await fetch(url.toString(), {
    headers: getBrokerAuthHeaders(),
  });
  const json = await res.json();
  if (!res.ok || json.success !== true) {
    throw new Error(json.message || "Failed to load eligible lenders");
  }

  const eligible = json.data?.eligibleLenders || [];
  return eligible.map(
    (l: any): EligibleLenderMatch => ({
      lenderOrgId: l.lenderOrgId,
      lenderName: l.lenderName,
      lenderProductId: l.lenderProductId,
      canSend: Boolean(l.canSend),
      eligible: Boolean(l.eligible),
      alreadySent: Boolean(l.alreadySent),
      loanProductCode: l.loanProductCode,
      rejectionReasons: l.rejectionReasons || [],
    }),
  );
}

export async function sendSubmissionToLenders(
  applicationId: string,
  submissionId: string,
  lenderProductIds: string[],
) {
  const res = await fetch(
    `${API_BASE}/broker/lender-discovery/applications/${applicationId}/submissions/${submissionId}/send-to-lenders`,
    {
      method: "POST",
      headers: getBrokerAuthHeaders(),
      body: JSON.stringify({ lenderProductIds }),
    },
  );
  const json = await res.json();
  if (!res.ok || json.success !== true) {
    throw new Error(json.message || "Failed to send application");
  }
  return json.data as Array<{ lenderName?: string; applicationLenderId?: string }>;
}

export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const arr = JSON.parse(value);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function formatCurrency(amount: string | number) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `$${n.toLocaleString()}`;
}

export function formatCompactMoney(value: string | number | null | undefined) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toLocaleString()}`;
}

export type LenderProfileProduct = {
  id: string;
  loanProductCode: string;
  loanProductName: string;
  minLoanAmount?: string | number | null;
  maxLoanAmount?: string | number | null;
  minCreditScore?: number | null;
  minDscr?: string | number | null;
  interestRateRange?: string | null;
  statesSupported?: string | null;
  termRange?: string | null;
  documents?: LenderProfileDocument[];
};

export type LenderProfileDocument = {
  id: string;
  name: string | null;
  code?: string | null;
  isRequired?: boolean;
};

export type LenderFullProfile = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  brandLogoUrl?: string | null;
  brandName?: string | null;
  profileImage?: string | null;
  products?: LenderProfileProduct[];
  documentsRequired?: LenderProfileDocument[];
  profile: {
    summary?: string | null;
    loanTypes: string[];
    minFunding: string | number | null;
    maxFunding: string | number | null;
    statesSupported?: string | null;
    industries?: string | null;
    fundingSpeedDays?: number | null;
    profileStatus?: string;
    lendingCriteria?: string | null;
    lendingGuidelines?: string | null;
    creditRequirements?: string | null;
    propertyRequirements?: string | null;
    website?: string | null;
    nmls?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    lenderType?: string | null;
  };
};

export async function fetchLenderProfile(lenderOrgId: string) {
  const res = await fetch(`${API_BASE}/broker/lenders/${lenderOrgId}/profile`, {
    headers: getBrokerAuthHeaders(),
  });
  const json = await res.json();
  if (!res.ok || json.success !== true) {
    throw new Error(json.message || "Failed to load lender profile");
  }
  return json.data as LenderFullProfile;
}

/** Brand logo first, then admin profile image. Supports data URLs and /public paths. */
export function resolveLenderLogoUrl(sources?: {
  brandLogoUrl?: string | null;
  profileImage?: string | null;
} | null): string | null {
  const brandLogo = sources?.brandLogoUrl?.trim();
  if (brandLogo) {
    if (
      brandLogo.startsWith("data:") ||
      brandLogo.startsWith("http://") ||
      brandLogo.startsWith("https://")
    ) {
      return brandLogo;
    }
    return buildApiPublicFileUrl(API_BASE, brandLogo);
  }

  const profileImage = sources?.profileImage?.trim();
  if (profileImage) {
    return buildApiPublicFileUrl(API_BASE, profileImage);
  }

  return null;
}

export function getLenderDisplayName(
  name: string,
  brandName?: string | null,
): string {
  const trimmed = brandName?.trim();
  return trimmed || name;
}

export function parseDelimitedList(value?: string | null): string[] {
  if (!value?.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((s) => String(s).trim()).filter(Boolean);
    }
  } catch {
    /* fall through */
  }
  return value
    .split(/[,|/;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
export function parseStatesList(value?: string | null): string[] {
  return parseDelimitedList(value).map((s) => s.toUpperCase());
}

const STATE_NAME_TO_CODE: Record<string, string> = {
  ALABAMA: "AL",
  ALASKA: "AK",
  ARIZONA: "AZ",
  ARKANSAS: "AR",
  CALIFORNIA: "CA",
  COLORADO: "CO",
  CONNECTICUT: "CT",
  DELAWARE: "DE",
  FLORIDA: "FL",
  GEORGIA: "GA",
  HAWAII: "HI",
  IDAHO: "ID",
  ILLINOIS: "IL",
  INDIANA: "IN",
  IOWA: "IA",
  KANSAS: "KS",
  KENTUCKY: "KY",
  LOUISIANA: "LA",
  MAINE: "ME",
  MARYLAND: "MD",
  MASSACHUSETTS: "MA",
  MICHIGAN: "MI",
  MINNESOTA: "MN",
  MISSISSIPPI: "MS",
  MISSOURI: "MO",
  MONTANA: "MT",
  NEBRASKA: "NE",
  NEVADA: "NV",
  "NEW HAMPSHIRE": "NH",
  "NEW JERSEY": "NJ",
  "NEW MEXICO": "NM",
  "NEW YORK": "NY",
  "NORTH CAROLINA": "NC",
  "NORTH DAKOTA": "ND",
  OHIO: "OH",
  OKLAHOMA: "OK",
  OREGON: "OR",
  PENNSYLVANIA: "PA",
  "RHODE ISLAND": "RI",
  "SOUTH CAROLINA": "SC",
  "SOUTH DAKOTA": "SD",
  TENNESSEE: "TN",
  TEXAS: "TX",
  UTAH: "UT",
  VERMONT: "VT",
  VIRGINIA: "VA",
  WASHINGTON: "WA",
  "WEST VIRGINIA": "WV",
  WISCONSIN: "WI",
  WYOMING: "WY",
  "DISTRICT OF COLUMBIA": "DC",
};

export function abbreviateStateCode(state: string): string {
  const normalized = state.trim().toUpperCase().replace(/\./g, "");
  if (normalized.length === 2) return normalized;
  return STATE_NAME_TO_CODE[normalized] || normalized.slice(0, 2);
}

export function formatStatesSummary(states: string[]): {
  display: string;
  tooltip: string;
} {
  if (!states.length) return { display: "—", tooltip: "" };

  const codes = [...new Set(states.map(abbreviateStateCode))];
  const tooltip = codes.join(", ");

  if (codes.length > 8) {
    return {
      display: `${codes.length} States Served`,
      tooltip,
    };
  }

  if (codes.length <= 4) {
    return { display: codes.join(" · "), tooltip };
  }

  const visible = codes.slice(0, 4).join(" · ");
  return {
    display: `${visible} +${codes.length - 4}`,
    tooltip,
  };
}

export function formatFundingTime(days: number | null | undefined) {
  if (!days || days <= 0) return "—";
  return `${days} Business Day${days === 1 ? "" : "s"}`;
}

export function formatLoanAmountRange(
  min: string | number | null | undefined,
  max: string | number | null | undefined,
) {
  const minStr = formatCompactMoney(min);
  const maxStr = formatCompactMoney(max);
  if (minStr === "—" && maxStr === "—") return "—";
  if (minStr === "—") return `Up to ${maxStr}`;
  if (maxStr === "—") return `From ${minStr}`;
  return `${minStr} – ${maxStr}`;
}

export function formatLoanTypeLabel(code: string) {
  const map: Record<string, string> = {
    SBA_7A: "SBA 7(a)",
    SBA_504: "SBA 504",
    EQUIPMENT_FINANCE: "Equipment",
    BRIDGE: "Bridge",
    CONSTRUCTION: "Construction",
    CRE: "CRE",
    WORKING_CAPITAL: "Working Capital",
    CMBS: "CMBS",
    MEZZANINE: "Mezzanine",
    PREFERRED_EQUITY: "Pref Equity",
  };
  if (map[code]) return map[code];
  return code
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatLenderType(value?: string | null) {
  if (!value?.trim()) return "";
  const map: Record<string, string> = {
    bank: "Bank",
    hard_money: "Hard Money",
    private: "Private Lender",
    credit_union: "Credit Union",
    nbfc: "NBFC",
  };
  const key = value.trim().toLowerCase();
  return (
    map[key] ||
    value
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

export function formatDisplayPhone(value?: string | null) {
  if (!value?.trim()) return "";
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length !== 10) return value.trim();
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function mergeDiscoverProfile(
  detail: LenderFullProfile | null,
  lender: DiscoverLender,
): LenderFullProfile["profile"] & { loanTypes: string[] } {
  const profile = detail?.profile;
  return {
    summary: profile?.summary ?? lender.summary ?? null,
    loanTypes:
      profile?.loanTypes?.length ? profile.loanTypes : lender.loanTypes ?? [],
    minFunding: profile?.minFunding ?? lender.minFunding ?? null,
    maxFunding: profile?.maxFunding ?? lender.maxFunding ?? null,
    statesSupported: profile?.statesSupported ?? lender.statesSupported ?? null,
    industries: profile?.industries ?? lender.industries ?? null,
    fundingSpeedDays:
      profile?.fundingSpeedDays ?? lender.fundingSpeedDays ?? null,
    profileStatus: profile?.profileStatus ?? lender.profileStatus,
    lendingCriteria: profile?.lendingCriteria ?? null,
    lendingGuidelines: profile?.lendingGuidelines ?? null,
    creditRequirements: profile?.creditRequirements ?? null,
    propertyRequirements: profile?.propertyRequirements ?? null,
    website: profile?.website ?? null,
    nmls: profile?.nmls ?? null,
    address: profile?.address ?? null,
    city: profile?.city ?? null,
    state: profile?.state ?? null,
    zip: profile?.zip ?? null,
    lenderType: profile?.lenderType ?? null,
  };
}
