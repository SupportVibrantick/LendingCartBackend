import { brokerFetch } from "./brokerApi";

export type GhlWebsiteCapabilities = {
  listWebsites: boolean;
  getWebsite: boolean;
  listPages: boolean;
  getPage: boolean;
  pageCount: boolean;
  createWebsite: boolean;
  createPage: boolean;
  updatePage: boolean;
  deletePage: boolean;
  templates: boolean;
  publish: boolean;
  domainManagement: boolean;
  mediaAssets: boolean;
  editorDeepLink: boolean;
};

export type GhlWebsite = {
  id: string;
  name: string;
  type: string;
  locationId?: string | null;
  domain?: string | null;
  previewUrl?: string | null;
  status?: string | null;
  updatedAt?: string | null;
  pageCount?: number | null;
};

export type GhlWebsitePage = {
  id: string;
  websiteId?: string | null;
  locationId?: string | null;
  name: string;
  stepId?: string | null;
  previewUrl?: string | null;
  editorUrl?: string | null;
  updatedAt?: string | null;
};

type ListWebsitesResponse = {
  success: boolean;
  data: {
    websites: GhlWebsite[];
    total: number;
    locationId: string;
    capabilities: GhlWebsiteCapabilities;
  };
};

type GetWebsiteResponse = {
  success: boolean;
  data: {
    website: GhlWebsite;
    capabilities: GhlWebsiteCapabilities;
  };
};

type ListPagesResponse = {
  success: boolean;
  data: {
    pages: GhlWebsitePage[];
    total: number;
    websiteId: string;
    capabilities: GhlWebsiteCapabilities;
  };
};

type GetPageResponse = {
  success: boolean;
  data: {
    page: GhlWebsitePage;
    capabilities: GhlWebsiteCapabilities;
  };
};

type CapabilitiesResponse = {
  success: boolean;
  data: {
    capabilities: GhlWebsiteCapabilities;
    note?: string;
  };
};

export async function fetchGhlWebsiteCapabilities(): Promise<GhlWebsiteCapabilities> {
  const json = await brokerFetch<CapabilitiesResponse>(
    "/broker/integrations/ghl/websites/capabilities",
  );
  return json.data.capabilities;
}

export async function fetchGhlWebsites(params?: {
  limit?: number;
  offset?: number;
  name?: string;
}): Promise<ListWebsitesResponse["data"]> {
  const search = new URLSearchParams();
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.offset != null) search.set("offset", String(params.offset));
  if (params?.name) search.set("name", params.name);

  const qs = search.toString();
  const json = await brokerFetch<ListWebsitesResponse>(
    `/broker/integrations/ghl/websites${qs ? `?${qs}` : ""}`,
  );
  return json.data;
}

export async function fetchGhlWebsite(websiteId: string): Promise<GetWebsiteResponse["data"]> {
  const json = await brokerFetch<GetWebsiteResponse>(
    `/broker/integrations/ghl/websites/${encodeURIComponent(websiteId)}`,
  );
  return json.data;
}

export async function fetchGhlWebsitePages(
  websiteId: string,
  params?: { limit?: number; offset?: number; name?: string },
): Promise<ListPagesResponse["data"]> {
  const search = new URLSearchParams();
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.offset != null) search.set("offset", String(params.offset));
  if (params?.name) search.set("name", params.name);

  const qs = search.toString();
  const json = await brokerFetch<ListPagesResponse>(
    `/broker/integrations/ghl/websites/${encodeURIComponent(websiteId)}/pages${qs ? `?${qs}` : ""}`,
  );
  return json.data;
}

export async function fetchGhlWebsitePage(
  websiteId: string,
  pageId: string,
): Promise<GetPageResponse["data"]> {
  const json = await brokerFetch<GetPageResponse>(
    `/broker/integrations/ghl/websites/${encodeURIComponent(websiteId)}/pages/${encodeURIComponent(pageId)}`,
  );
  return json.data;
}

export function formatGhlWebsiteDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function sanitizeGhlWebsiteError(message?: string | null): string {
  if (!message) return "Unable to load GoHighLevel websites. Please try again.";
  const trimmed = String(message).trim();
  if (
    /GHL_|leadconnector|gohighlevel|Bearer |access_token|refresh_token|secret|enc:v1:/i.test(
      trimmed,
    )
  ) {
    return "Unable to load GoHighLevel websites. Please try again.";
  }
  return trimmed.length > 240 ? `${trimmed.slice(0, 240)}…` : trimmed;
}
