import { adminFetch, adminFetchMultipart, type PaginatedResponse } from "./adminApi";
import { fetchSubscriberDetail, type SubscriberDetail } from "./subscriptionApi";

export type BrokerAdminProfile = {
  company?: string | null;
  licenseNumber?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  website?: string | null;
};

export type BrokerDetail = {
  id: string;
  name: string;
  organizationName?: string;
  email?: string | null;
  phone?: string | null;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  admins?: Array<{
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    status?: string;
    createdAt?: string;
    updatedAt?: string;
    role?: string | null;
    roles?: string[];
    profile?: BrokerAdminProfile | null;
  }>;
  primaryAdmin?: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    status?: string;
    createdAt?: string;
    updatedAt?: string;
    role?: string | null;
    roles?: string[];
    profile?: BrokerAdminProfile | null;
  } | null;
  affiliateLinks?: Array<{
    id: string;
    code?: string;
    targetType?: string;
    isActive?: boolean;
    createdAt?: string;
  }>;
  lenderAccess?: Array<{
    id: string;
    lenderOrgId?: string;
    source?: string;
    isActive?: boolean;
    lender?: {
      id: string;
      name: string;
      email?: string | null;
      phone?: string | null;
      status?: string;
      createdAt?: string;
    };
  }>;
  whiteLabel?:
    | {
        id?: string;
        brandName?: string | null;
        platformSubdomain?: string | null;
        customDomain?: string | null;
        domainVerified?: boolean;
        sslStatus?: string | null;
        primaryColor?: string | null;
        secondaryColor?: string | null;
        fontFamily?: string | null;
        logoUrl?: string | null;
        faviconUrl?: string | null;
        supportEmail?: string | null;
        footerText?: string | null;
        fullWhiteLabel?: boolean;
        showBrokerBrandOnApproval?: boolean;
      }
    | Array<{
        id?: string;
        brandName?: string | null;
        platformSubdomain?: string | null;
        customDomain?: string | null;
        domainVerified?: boolean;
        sslStatus?: string | null;
        primaryColor?: string | null;
        secondaryColor?: string | null;
        fontFamily?: string | null;
        logoUrl?: string | null;
        faviconUrl?: string | null;
        supportEmail?: string | null;
        footerText?: string | null;
        fullWhiteLabel?: boolean;
        showBrokerBrandOnApproval?: boolean;
      }>
    | null;
  counts?: {
    admins?: number;
    affiliateLinks?: number;
    lenderAccess?: number;
  };
};

export function resolveBrokerOrganizationName(broker: Pick<BrokerDetail, "name" | "organizationName">) {
  return broker.organizationName?.trim() || broker.name?.trim() || "";
}

export function resolveBrokerPrimaryAdmin(broker: BrokerDetail) {
  if (broker.primaryAdmin) return broker.primaryAdmin;
  return (
    broker.admins?.find(
      (admin) =>
        admin.role === "BROKER_ADMIN" || admin.roles?.includes("BROKER_ADMIN"),
    ) ||
    broker.admins?.[broker.admins.length - 1] ||
    null
  );
}

export function resolveBrokerAdminProfile(broker: BrokerDetail) {
  const primary = resolveBrokerPrimaryAdmin(broker);
  const hasProfileData = (profile?: BrokerAdminProfile | null) =>
    Boolean(
      profile &&
        Object.values(profile).some(
          (value) => value !== null && value !== undefined && String(value).trim() !== "",
        ),
    );

  if (hasProfileData(primary?.profile)) {
    return primary!.profile!;
  }

  const adminWithProfile = broker.admins?.find((admin) => hasProfileData(admin.profile));
  return adminWithProfile?.profile || primary?.profile || null;
}

export function resolveBrokerWhiteLabel(broker: BrokerDetail) {
  const settings = broker.whiteLabel;
  if (!settings) return null;
  if (Array.isArray(settings)) return settings[0] ?? null;
  if (typeof settings === "object" && Object.keys(settings).length > 0) {
    return settings;
  }
  return null;
}

export function formatBrokerRole(role?: string | null) {
  if (!role) return "—";
  return role.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export type BrokerTeamMember = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
  status?: string;
  lastLoginAt?: string | null;
  createdAt?: string;
  assignedDeals?: number;
  assignedApplications?: number;
  lastActivityAt?: string | null;
};

export type BrokerClientRow = {
  id: string;
  legalName?: string;
  displayName?: string;
  entityLabel?: string | null;
  entityType?: string;
  industry?: string | null;
  isActive?: boolean;
  createdAt?: string;
  brokerOrgId?: string;
  brokerName?: string | null;
  primaryContact?: {
    email?: string;
    phone?: string | null;
    firstName?: string;
    lastName?: string | null;
  } | null;
  applicationsCount?: number;
  portalUsersCount?: number;
};

export type BrokerApplicationRow = {
  applicationId: string;
  applicationNumber?: string;
  loanProductCode?: string;
  amountRequested?: number | null;
  status?: string;
  createdAt?: string;
  borrowerName?: string;
  entityType?: string;
  purpose?: string | null;
};

export type BrokerLenderAccessRow = {
  id: string;
  lenderOrgId?: string;
  brokerOrgId?: string;
  source?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lender?: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    status?: string;
    createdAt?: string;
    updatedAt?: string;
  };
};

export type BrokerLenderDetail = BrokerLenderAccessRow & {
  admin?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    status?: string;
    lastLoginAt?: string | null;
    createdAt?: string;
  } | null;
  profile?: {
    summary?: string | null;
    loanTypes?: string[];
    minFunding?: number | null;
    maxFunding?: number | null;
    statesSupported?: string | null;
    industries?: string | null;
    fundingSpeedDays?: number | null;
    profileStatus?: string;
    isVisible?: boolean;
  } | null;
  counts?: {
    loanProducts?: number;
    activeBrokerConnections?: number;
  };
};

export type PlatformLenderRow = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  status?: string;
};

export async function fetchBrokerDetail(brokerId: string) {
  return adminFetch<{ success: boolean; data: BrokerDetail }>(
    `/admin/brokers/read/${brokerId}`,
  );
}

export type BrokerUpdateInput = {
  name: string;
  email: string;
  phone: string;
  status?: string;
  admin?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    password?: string;
    status?: string;
    profile?: BrokerAdminProfile;
  };
};

export async function updateBrokerOrganization(orgId: string, payload: BrokerUpdateInput) {
  return adminFetch<{ success: boolean; data?: { organization?: BrokerDetail } }>(
    `/admin/brokers/update/${orgId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export async function changeBrokerOrganizationStatus(
  orgId: string,
  next: "ACTIVE" | "INACTIVE" | "SUSPENDED",
) {
  const toActive = next === "ACTIVE";
  try {
    return await adminFetch<{ success: boolean; data?: { status?: string; organization?: BrokerDetail } }>(
      `/admin/brokers/status/${toActive ? "activate" : "deactivate"}/${orgId}`,
      {
        method: "PATCH",
        body: JSON.stringify({}),
      },
    );
  } catch {
    return adminFetch<{ success: boolean; data?: { status?: string; organization?: BrokerDetail } }>(
      `/admin/brokers/update/${orgId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      },
    );
  }
}

export async function fetchBrokerLoanOfficers(
  brokerOrgId: string,
  page = 1,
  search = "",
  limit = 10,
) {
  const q = new URLSearchParams({
    brokerOrgId,
    page: String(page),
    limit: String(limit),
  });
  if (search.trim()) q.set("search", search.trim());
  return adminFetch<PaginatedResponse<BrokerTeamMember[]>>(
    `/admin/loan-officers?${q}`,
  );
}

export type BrokerLoanOfficerDetail = BrokerTeamMember & {
  confirmEmail?: string;
  profile?: {
    company?: string | null;
    tollFree?: string | null;
    tollFreeExt?: string | null;
    serviceProvider?: string | null;
    address?: string | null;
    suite?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
    agentType?: string | null;
    licenseNumber?: string | null;
    preferredComm?: string | null;
    website?: string | null;
    avatarUrl?: string | null;
  } | null;
};

export type BrokerLoanOfficerInput = {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  phone?: string;
  status?: "ACTIVE" | "DISABLED" | "INVITED";
};

export async function fetchBrokerLoanOfficerApplications(
  brokerOrgId: string,
  userId: string,
  options?: { page?: number; limit?: number; search?: string },
) {
  const q = new URLSearchParams();
  if (options?.page) q.set("page", String(options.page));
  if (options?.limit) q.set("limit", String(options.limit));
  if (options?.search?.trim()) q.set("search", options.search.trim());

  const query = q.toString();
  return adminFetch<{
    success: boolean;
    data: BrokerApplicationRow[];
    meta: { page: number; limit: number; total: number; totalPages: number };
    summary?: { totalAmount?: number };
  }>(
    `/admin/brokers/loan-officers/${brokerOrgId}/${userId}/applications${query ? `?${query}` : ""}`,
  );
}

export type LoanOfficerActivitySummary = {
  id: string;
  name: string;
  email: string;
  status: string;
  lastLoginAt?: string | null;
  assignedApplications: number;
  contactsCreated: number;
  lastActivityAt?: string | null;
};

export type LoanOfficerActivityItem = {
  id: string;
  category: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  ipAddress?: string | null;
  officer: { id: string; name: string; email: string } | null;
  newValue?: unknown;
  oldValue?: unknown;
};

export async function fetchBrokerLoanOfficerActivity(
  brokerOrgId: string,
  options: { officerId?: string; page?: number; limit?: number } = {},
) {
  const q = new URLSearchParams({
    page: String(options.page ?? 1),
    limit: String(options.limit ?? 20),
  });
  if (options.officerId) q.set("officerId", options.officerId);

  return adminFetch<{
    success: boolean;
    data: {
      officers: LoanOfficerActivitySummary[];
      activity: LoanOfficerActivityItem[];
    };
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }>(`/admin/brokers/loan-officer-activity/${brokerOrgId}?${q}`);
}

export async function fetchBrokerLoanOfficerDetail(brokerOrgId: string, userId: string) {
  return adminFetch<{ success: boolean; data: BrokerLoanOfficerDetail }>(
    `/admin/brokers/loan-officers/${brokerOrgId}/${userId}`,
  );
}

export async function createBrokerLoanOfficer(
  brokerOrgId: string,
  payload: BrokerLoanOfficerInput | FormData,
) {
  if (payload instanceof FormData) {
    return adminFetchMultipart<{ success: boolean; data: BrokerTeamMember }>(
      `/admin/brokers/loan-officers/${brokerOrgId}`,
      payload,
      "POST",
    );
  }

  return adminFetch<{ success: boolean; data: BrokerTeamMember }>(
    `/admin/brokers/loan-officers/${brokerOrgId}`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function updateBrokerLoanOfficer(
  brokerOrgId: string,
  userId: string,
  payload: Partial<BrokerLoanOfficerInput> | FormData,
) {
  if (payload instanceof FormData) {
    return adminFetchMultipart<{ success: boolean; data: BrokerTeamMember }>(
      `/admin/brokers/loan-officers/${brokerOrgId}/${userId}`,
      payload,
      "PATCH",
    );
  }

  return adminFetch<{ success: boolean; data: BrokerTeamMember }>(
    `/admin/brokers/loan-officers/${brokerOrgId}/${userId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export async function deleteBrokerLoanOfficer(userId: string) {
  return adminFetch<{ success: boolean; message?: string }>(
    `/admin/loan-officers/${userId}`,
    { method: "DELETE" },
  );
}

export async function updateBrokerLoanOfficerStatus(
  userId: string,
  status: "ACTIVE" | "DISABLED" | "INVITED",
) {
  return adminFetch<{ success: boolean; data: { id: string; status: string } }>(
    `/admin/loan-officers/${userId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
}

export async function fetchBrokerSubBrokers(
  brokerOrgId: string,
  page = 1,
  search = "",
  limit = 10,
) {
  const q = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (search.trim()) q.set("search", search.trim());
  return adminFetch<PaginatedResponse<BrokerTeamMember[]>>(
    `/admin/brokers/sub-brokers/${brokerOrgId}?${q}`,
  );
}

export type BrokerSubBrokerInput = {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  phone: string;
};

export async function fetchBrokerSubBrokerDetail(brokerOrgId: string, userId: string) {
  return adminFetch<{ success: boolean; data: BrokerTeamMember }>(
    `/admin/brokers/sub-brokers/${brokerOrgId}/${userId}`,
  );
}

export async function fetchBrokerSubBrokerApplications(
  brokerOrgId: string,
  userId: string,
  options?: { page?: number; limit?: number; search?: string },
) {
  const q = new URLSearchParams();
  if (options?.page) q.set("page", String(options.page));
  if (options?.limit) q.set("limit", String(options.limit));
  if (options?.search?.trim()) q.set("search", options.search.trim());

  const query = q.toString();
  return adminFetch<{
    success: boolean;
    data: BrokerApplicationRow[];
    meta: { page: number; limit: number; total: number; totalPages: number };
    summary?: { totalAmount?: number };
  }>(
    `/admin/brokers/sub-brokers/${brokerOrgId}/${userId}/applications${query ? `?${query}` : ""}`,
  );
}

export async function createBrokerSubBroker(
  brokerOrgId: string,
  payload: BrokerSubBrokerInput,
) {
  return adminFetch<{ success: boolean; data: BrokerTeamMember }>(
    `/admin/brokers/sub-brokers/${brokerOrgId}`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function updateBrokerSubBroker(
  brokerOrgId: string,
  userId: string,
  payload: Partial<BrokerSubBrokerInput>,
) {
  return adminFetch<{ success: boolean; data: BrokerTeamMember }>(
    `/admin/brokers/sub-brokers/${brokerOrgId}/${userId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export async function updateBrokerSubBrokerStatus(
  brokerOrgId: string,
  userId: string,
  status: "ACTIVE" | "DISABLED" | "INVITED",
) {
  return adminFetch<{ success: boolean; data: { id: string; status: string } }>(
    `/admin/brokers/sub-brokers/${brokerOrgId}/${userId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
}

export async function deleteBrokerSubBroker(brokerOrgId: string, userId: string) {
  return adminFetch<{ success: boolean; message: string }>(
    `/admin/brokers/sub-brokers/${brokerOrgId}/${userId}`,
    { method: "DELETE" },
  );
}

export async function fetchBrokerClients(
  brokerOrgId: string,
  page = 1,
  search = "",
  limit = 10,
) {
  const q = new URLSearchParams({
    brokerOrgId,
    page: String(page),
    limit: String(limit),
  });
  if (search.trim()) q.set("search", search.trim());
  return adminFetch<PaginatedResponse<BrokerClientRow[]>>(
    `/admin/clients?${q}`,
  );
}

export async function fetchBrokerClientDetail(brokerOrgId: string, clientId: string) {
  const q = new URLSearchParams({ brokerOrgId });
  return adminFetch<{ success: boolean; data: BrokerClientRow }>(
    `/admin/clients/${clientId}?${q}`,
  );
}

export async function fetchBrokerClientApplications(
  brokerOrgId: string,
  clientId: string,
  options?: { page?: number; limit?: number; search?: string },
) {
  const q = new URLSearchParams({ brokerOrgId });
  if (options?.page) q.set("page", String(options.page));
  if (options?.limit) q.set("limit", String(options.limit));
  if (options?.search?.trim()) q.set("search", options.search.trim());

  return adminFetch<{
    success: boolean;
    data: BrokerApplicationRow[];
    meta: { page: number; limit: number; total: number; totalPages: number };
    summary?: { totalAmount?: number };
  }>(`/admin/clients/${clientId}/applications?${q}`);
}

export async function updateBrokerClientStatus(clientId: string, isActive: boolean) {
  return adminFetch<{ success: boolean; data: { id: string; isActive: boolean } }>(
    `/admin/clients/${clientId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    },
  );
}

export async function deleteBrokerClient(clientId: string) {
  return adminFetch<{ success: boolean; message: string }>(
    `/admin/clients/${clientId}`,
    { method: "DELETE" },
  );
}

export async function fetchBrokerApplications(
  brokerOrgId: string,
  options?: { page?: number; limit?: number; search?: string },
) {
  const q = new URLSearchParams({ brokerOrgId });
  if (options?.page) q.set("page", String(options.page));
  if (options?.limit) q.set("limit", String(options.limit));
  if (options?.search?.trim()) q.set("search", options.search.trim());

  return adminFetch<{
    success: boolean;
    data: BrokerApplicationRow[];
    total?: number;
    meta?: { page: number; limit: number; total: number; totalPages: number };
    summary?: { totalAmount?: number };
  }>(`/admin/loan-pipeline?${q}`);
}

export async function fetchApplicationDetail(applicationId: string) {
  return adminFetch<{ success: boolean; data: Record<string, any> }>(
    `/admin/loan-pipeline/${applicationId}`,
  );
}

export async function fetchBrokerLenders(
  brokerOrgId: string,
  page = 1,
  search = "",
  limit = 10,
) {
  const q = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (search.trim()) q.set("search", search.trim());

  return adminFetch<PaginatedResponse<BrokerLenderAccessRow[]>>(
    `/admin/brokers/lenders/${brokerOrgId}?${q}`,
  );
}

export async function fetchBrokerLenderDetail(brokerOrgId: string, accessId: string) {
  return adminFetch<{ success: boolean; data: BrokerLenderDetail }>(
    `/admin/brokers/lenders/${brokerOrgId}/${accessId}`,
  );
}

export async function assignBrokerLender(brokerOrgId: string, lenderOrgId: string) {
  return adminFetch<{ success: boolean; data: BrokerLenderAccessRow; message?: string }>(
    `/admin/brokers/lenders/${brokerOrgId}`,
    {
      method: "POST",
      body: JSON.stringify({ lenderOrgId }),
    },
  );
}

export async function updateBrokerLenderStatus(
  brokerOrgId: string,
  accessId: string,
  isActive: boolean,
) {
  return adminFetch<{ success: boolean; data: BrokerLenderAccessRow }>(
    `/admin/brokers/lenders/${brokerOrgId}/${accessId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    },
  );
}

export async function removeBrokerLender(brokerOrgId: string, accessId: string) {
  return adminFetch<{ success: boolean; message: string }>(
    `/admin/brokers/lenders/${brokerOrgId}/${accessId}`,
    { method: "DELETE" },
  );
}

export async function fetchPlatformLenders(search = "", page = 1, limit = 12) {
  const q = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (search.trim()) q.set("search", search.trim());

  const json = await adminFetch<{
    success: boolean;
    data?: {
      total?: number;
      page?: number;
      limit?: number;
      totalPages?: number;
      results?: Array<{
        id: string;
        organizationName?: string;
        organizationEmail?: string | null;
        organizationPhone?: string | null;
        organizationStatus?: string;
      }>;
    };
  }>(`/admin/lenders/read?${q}`);

  return {
    success: json.success,
    data: (json.data?.results || []).map((row) => ({
      id: row.id,
      name: row.organizationName || "—",
      email: row.organizationEmail,
      phone: row.organizationPhone,
      status: row.organizationStatus,
    })),
    meta: {
      page: json.data?.page ?? page,
      limit: json.data?.limit ?? limit,
      total: json.data?.total ?? 0,
      totalPages: Math.max(json.data?.totalPages ?? 1, 1),
    },
  };
}

export async function fetchBrokerSubscription(brokerOrgId: string) {
  try {
    return await fetchSubscriberDetail(brokerOrgId);
  } catch {
    return { success: false as const, data: null as SubscriberDetail | null };
  }
}

export type BrokerContact = {
  id: string;
  contactType: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  companyName?: string | null;
  website?: string | null;
  phone?: string | null;
  tollFree?: string | null;
  cellNumber?: string | null;
  faxNumber?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  stateOfFormation?: string | null;
  entityType?: string | null;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export const BROKER_CONTACT_TYPES = [
  "ACCOUNTANT",
  "APPRAISER",
  "ASSIGNOR",
  "ATTORNEY",
  "AUDITOR",
  "BROKER",
  "BROKER_PROCESSOR",
  "CLOSING_CONTACT",
  "CONTRACTOR",
  "COUNSELOR",
  "CUSTODIAN",
  "ESCROW",
  "ESCROW_ASSISTANT",
  "FINANCIAL_ADVISOR",
  "GENERAL_CONTRACTOR",
  "HOA",
  "INSPECTOR",
  "INSURANCE_FLOOD",
  "INSURANCE_GENERAL",
  "INSURANCE_HOA",
  "INSURANCE_PROPERTY",
  "INVESTOR",
  "LENDER",
  "LENDER_ATTORNEY",
  "LOAN_PREPARER",
  "OTHER_UNSPECIFIED",
  "OWNER",
  "PARALEGAL",
  "PROPERTY_MANAGER",
  "PROSPECT",
  "RE_AGENT_BUYER",
  "RE_AGENT_SELLER",
  "REALTOR_BPO",
  "SECONDARY_NOTE_BUYER",
  "SELLER_ATTORNEY",
  "SERVICER",
  "TITLE_REP",
  "TRUSTEE",
  "OTHER",
] as const;

export type BrokerContactInput = {
  contactType: (typeof BROKER_CONTACT_TYPES)[number];
  firstName?: string;
  lastName?: string;
  email?: string;
  companyName?: string;
  website?: string;
  phone?: string;
  tollFree?: string;
  cellNumber?: string;
  faxNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  stateOfFormation?: string;
  entityType?: string;
  description?: string;
};

export async function fetchBrokerContacts(
  brokerOrgId: string,
  page = 1,
  search = "",
  limit = 10,
) {
  const q = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (search.trim()) q.set("search", search.trim());
  return adminFetch<PaginatedResponse<BrokerContact[]>>(
    `/admin/brokers/contacts/${brokerOrgId}?${q}`,
  );
}

export async function createBrokerContact(brokerOrgId: string, payload: BrokerContactInput) {
  return adminFetch<{ success: boolean; data: BrokerContact }>(
    `/admin/brokers/contacts/${brokerOrgId}`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function updateBrokerContact(
  brokerOrgId: string,
  contactId: string,
  payload: Partial<BrokerContactInput>,
) {
  return adminFetch<{ success: boolean; data: BrokerContact }>(
    `/admin/brokers/contacts/${brokerOrgId}/${contactId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export async function deleteBrokerContact(brokerOrgId: string, contactId: string) {
  return adminFetch<{ success: boolean; message?: string }>(
    `/admin/brokers/contacts/${brokerOrgId}/${contactId}`,
    {
      method: "DELETE",
    },
  );
}
