/**
 * Broker-owned GHL Websites (Funnels) service.
 *
 * Supported public APIs (location OAuth, sub-account):
 *   GET /funnels/funnel/list          — scope: funnels/funnel.readonly
 *   GET /funnels/page                 — scope: funnels/page.readonly
 *   GET /funnels/page/count           — scope: funnels/pagecount.readonly
 *
 * GHL Website Builder / Funnels are the source of truth. LendingCart only lists
 * and surfaces URLs returned by GHL — no page CRUD via public API.
 */

const { requestForOrganization } = require("./brokerGhlClient.service");
const { brokerGhlError, BROKER_GHL_ERROR_CODES } = require("./brokerGhlErrors");

/** Documented capabilities for frontend — do not enable unsupported actions. */
const GHL_WEBSITE_CAPABILITIES = Object.freeze({
  listWebsites: true,
  getWebsite: true,
  listPages: true,
  getPage: true,
  pageCount: true,
  createWebsite: false,
  createPage: false,
  updatePage: false,
  deletePage: false,
  templates: false,
  publish: false,
  domainManagement: false,
  mediaAssets: false,
  editorDeepLink: false,
});

const URL_FIELD_CANDIDATES = [
  "url",
  "previewUrl",
  "preview_url",
  "liveUrl",
  "live_url",
  "publicUrl",
  "public_url",
  "fullUrl",
  "full_url",
  "pageUrl",
  "page_url",
  "link",
];

function pickFirstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function extractPublicUrl(record = {}) {
  for (const key of URL_FIELD_CANDIDATES) {
    const value = record[key];
    if (typeof value === "string" && /^https?:\/\//i.test(value.trim())) {
      return value.trim();
    }
  }
  return null;
}

function normalizeFunnelArray(payload) {
  const raw =
    payload?.funnels ??
    payload?.data?.funnels ??
    (Array.isArray(payload?.data) ? payload.data : null) ??
    [];
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") return Object.values(raw);
  return [];
}

function normalizePageArray(payload) {
  if (Array.isArray(payload)) return payload;
  const raw =
    payload?.pages ??
    payload?.funnelPages ??
    payload?.data?.pages ??
    payload?.data?.funnelPages ??
    payload?.data ??
    payload?.items ??
    [];
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") return Object.values(raw);
  return [];
}

function mapFunnelToWebsite(funnel = {}) {
  const id = pickFirstString(funnel._id, funnel.id);
  const domain = pickFirstString(
    funnel.domain,
    funnel.domainName,
    funnel.customDomain,
    funnel.custom_domain,
  );
  const previewUrl = extractPublicUrl(funnel);

  return {
    id,
    name: pickFirstString(funnel.name) || "Untitled Website",
    type: pickFirstString(funnel.type, funnel.category) || "funnel",
    locationId: pickFirstString(funnel.locationId, funnel.location_id),
    domain,
    previewUrl,
    status: funnel.published === true ? "Published" : funnel.status || null,
    updatedAt: funnel.updatedAt || funnel.updated_at || null,
    pageCount: null,
  };
}

function mapPageToWebsitePage(page = {}, websiteId = null) {
  const id = pickFirstString(page._id, page.id);
  return {
    id,
    websiteId: pickFirstString(page.funnelId, page.funnel_id, websiteId),
    locationId: pickFirstString(page.locationId, page.location_id),
    name: pickFirstString(page.name) || "Untitled Page",
    stepId: pickFirstString(page.stepId, page.step_id),
    previewUrl: extractPublicUrl(page),
    editorUrl: extractPublicUrl({ editorUrl: page.editorUrl, editor_url: page.editor_url }),
    updatedAt: page.updatedAt || page.updated_at || null,
    deleted: page.deleted === true || page.deleted === "true",
  };
}

const GHL_MAX_PAGE_SIZE = 20;

function clampLimit(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return GHL_MAX_PAGE_SIZE;
  return Math.min(n, GHL_MAX_PAGE_SIZE);
}

function normalizeOffset(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

async function fetchFunnelsRaw(prisma, organizationId, locationId, params = {}) {
  const query = {
    locationId,
    limit: String(clampLimit(params.limit)),
    offset: String(normalizeOffset(params.offset)),
  };
  if (params.name) query.name = String(params.name).trim();

  return requestForOrganization(prisma, organizationId, {
    method: "GET",
    url: "/funnels/funnel/list",
    params: query,
  });
}

async function countWebsitePages(prisma, organizationId, websiteId, locationId) {
  const data = await requestForOrganization(prisma, organizationId, {
    method: "GET",
    url: "/funnels/page/count",
    params: {
      locationId,
      funnelId: websiteId,
    },
  });

  const count =
    data?.count ??
    data?.data?.count ??
    data?.total ??
    data?.data?.total ??
    null;

  return typeof count === "number" ? count : Number(count) || 0;
}

async function listWebsites(prisma, organizationId, params = {}) {
  const { getClientForOrganization } = require("./brokerGhlClient.service");
  const { locationId } = await getClientForOrganization(prisma, organizationId);

  const payload = await fetchFunnelsRaw(
    prisma,
    organizationId,
    locationId,
    params,
  );

  const websites = normalizeFunnelArray(payload).map(mapFunnelToWebsite);

  await Promise.all(
    websites.map(async (website) => {
      if (!website.id) return;
      try {
        website.pageCount = await countWebsitePages(
          prisma,
          organizationId,
          website.id,
          locationId,
        );
      } catch {
        website.pageCount = null;
      }
    }),
  );

  return {
    websites,
    total: payload?.count ?? websites.length,
    locationId,
    capabilities: GHL_WEBSITE_CAPABILITIES,
  };
}

async function getWebsite(prisma, organizationId, websiteId) {
  if (!websiteId) {
    throw brokerGhlError(BROKER_GHL_ERROR_CODES.VALIDATION_FAILED, 400);
  }

  const { getClientForOrganization } = require("./brokerGhlClient.service");
  const { locationId } = await getClientForOrganization(prisma, organizationId);

  const payload = await fetchFunnelsRaw(prisma, organizationId, locationId, {});
  const funnel = normalizeFunnelArray(payload).find(
    (item) => pickFirstString(item._id, item.id) === String(websiteId),
  );

  if (!funnel) {
    throw brokerGhlError(BROKER_GHL_ERROR_CODES.NOT_FOUND, 404);
  }

  const website = mapFunnelToWebsite(funnel);
  try {
    website.pageCount = await countWebsitePages(
      prisma,
      organizationId,
      websiteId,
      locationId,
    );
  } catch {
    website.pageCount = null;
  }

  return {
    website,
    capabilities: GHL_WEBSITE_CAPABILITIES,
  };
}

async function listWebsitePages(prisma, organizationId, websiteId, params = {}) {
  if (!websiteId) {
    throw brokerGhlError(BROKER_GHL_ERROR_CODES.VALIDATION_FAILED, 400);
  }

  const { getClientForOrganization } = require("./brokerGhlClient.service");
  const { locationId } = await getClientForOrganization(prisma, organizationId);

  // Ensure website exists under this location before listing pages.
  await getWebsite(prisma, organizationId, websiteId);

  const query = {
    locationId,
    funnelId: String(websiteId),
    limit: String(clampLimit(params.limit)),
    offset: String(normalizeOffset(params.offset)),
  };
  if (params.name) query.name = String(params.name).trim();

  const payload = await requestForOrganization(prisma, organizationId, {
    method: "GET",
    url: "/funnels/page",
    params: query,
  });

  const pages = normalizePageArray(payload)
    .map((page) => mapPageToWebsitePage(page, websiteId))
    .filter((page) => page.id && !page.deleted);

  return {
    pages,
    total: payload?.count ?? pages.length,
    websiteId: String(websiteId),
    capabilities: GHL_WEBSITE_CAPABILITIES,
  };
}

async function getWebsitePage(prisma, organizationId, websiteId, pageId) {
  if (!websiteId || !pageId) {
    throw brokerGhlError(BROKER_GHL_ERROR_CODES.VALIDATION_FAILED, 400);
  }

  const { pages } = await listWebsitePages(prisma, organizationId, websiteId, {
    limit: GHL_MAX_PAGE_SIZE,
    offset: 0,
  });

  const page = pages.find((item) => item.id === String(pageId));
  if (!page) {
    throw brokerGhlError(BROKER_GHL_ERROR_CODES.NOT_FOUND, 404);
  }

  return {
    page,
    capabilities: GHL_WEBSITE_CAPABILITIES,
  };
}

module.exports = {
  GHL_WEBSITE_CAPABILITIES,
  mapFunnelToWebsite,
  mapPageToWebsitePage,
  normalizeFunnelArray,
  normalizePageArray,
  listWebsites,
  getWebsite,
  listWebsitePages,
  getWebsitePage,
  countWebsitePages,
};
