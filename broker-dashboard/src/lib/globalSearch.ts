const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

function getAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("broker_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type GlobalSearchPerson = {
  kind: "subBroker" | "loanOfficer";
  id: string;
  label: string;
  subtitle: string;
};

export type GlobalSearchClient = {
  kind: "client";
  id: string;
  label: string;
  subtitle: string;
  submissionId?: string | null;
  applicationNumber?: string | null;
};

export type GlobalSearchContact = {
  kind: "contact";
  id: string;
  label: string;
  subtitle: string;
};

export type GlobalSearchLender = {
  kind: "lender";
  id: string;
  label: string;
  subtitle: string;
  isConnected: boolean;
};

export type GlobalSearchApplication = {
  kind: "application";
  id: string;
  submissionId: string;
  applicationId?: string;
  label: string;
  subtitle: string;
};

export type GlobalSearchViewAllSection =
  | "subBrokers"
  | "loanOfficers"
  | "clients"
  | "contacts"
  | "lenders"
  | "applications";

export type GlobalSearchResults = {
  subBrokers: GlobalSearchPerson[];
  loanOfficers: GlobalSearchPerson[];
  clients: GlobalSearchClient[];
  contacts: GlobalSearchContact[];
  lenders: GlobalSearchLender[];
  applications: GlobalSearchApplication[];
};

export async function runGlobalSearch(
  query: string,
  limit = 5,
): Promise<GlobalSearchResults> {
  const trimmed = query.trim();
  if (!trimmed) {
    return emptyResults();
  }

  const [priority, applications] = await Promise.all([
    fetchPrioritySearch(trimmed, limit),
    fetchApplications(trimmed, limit),
  ]);

  return {
    subBrokers: priority.subBrokers.map((item) => ({
      ...item,
      kind: "subBroker" as const,
    })),
    loanOfficers: priority.loanOfficers.map((item) => ({
      ...item,
      kind: "loanOfficer" as const,
    })),
    clients: priority.clients.map((item) => ({
      ...item,
      kind: "client" as const,
    })),
    contacts: priority.contacts.map((item) => ({
      ...item,
      kind: "contact" as const,
    })),
    lenders: priority.lenders.map((item) => ({
      ...item,
      kind: "lender" as const,
    })),
    applications,
  };
}

function emptyResults(): GlobalSearchResults {
  return {
    subBrokers: [],
    loanOfficers: [],
    clients: [],
    contacts: [],
    lenders: [],
    applications: [],
  };
}

async function fetchPrioritySearch(query: string, limit: number) {
  try {
    const url = new URL(`${API_BASE}/broker/global-search`);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(limit));

    const res = await fetch(url.toString(), { headers: getAuthHeaders() });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return {
        subBrokers: [],
        loanOfficers: [],
        clients: [],
        contacts: [],
        lenders: [],
      };
    }

    return json.data as {
      subBrokers: Omit<GlobalSearchPerson, "kind">[];
      loanOfficers: Omit<GlobalSearchPerson, "kind">[];
      clients: Omit<GlobalSearchClient, "kind">[];
      contacts: Omit<GlobalSearchContact, "kind">[];
      lenders: Omit<GlobalSearchLender, "kind">[];
    };
  } catch {
    return {
      subBrokers: [],
      loanOfficers: [],
      clients: [],
      contacts: [],
      lenders: [],
    };
  }
}

async function fetchApplications(
  query: string,
  limit: number,
): Promise<GlobalSearchApplication[]> {
  try {
    const url = new URL(`${API_BASE}/broker/loan-pipeline/submissions`);
    url.searchParams.set("search", query);
    url.searchParams.set("limit", String(limit));

    const res = await fetch(url.toString(), { headers: getAuthHeaders() });
    const json = await res.json();
    if (!res.ok || !json.success) return [];

    const list = Array.isArray(json.data) ? json.data : [];
    return list.map((item: any) => ({
      kind: "application" as const,
      id: item.submissionId,
      submissionId: item.submissionId,
      applicationId: item.applicationId,
      label: item.borrower || "Unknown borrower",
      subtitle: [item.applicationNumber, item.loanInfo, item.location]
        .filter(Boolean)
        .join(" · "),
    }));
  } catch {
    return [];
  }
}
