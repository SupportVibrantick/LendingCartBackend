const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const TEST_KEY = crypto.randomBytes(32).toString("hex");
const ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const CONN_A = "conn-a-id";
const CONN_B = "conn-b-id";
const LOC_A = "loc_org_a";
const LOC_B = "loc_org_b";
const FUNNEL_A = "funnel_a_1";
const FUNNEL_B = "funnel_b_1";
const PAGE_A1 = "page_a_1";
const PAGE_A2 = "page_a_2";

function encrypt(value) {
  delete require.cache[require.resolve("../../utils/security/secretEncryption")];
  process.env.GHL_OAUTH_TOKEN_ENCRYPTION_KEY = TEST_KEY;
  return require("../../utils/security/secretEncryption").encryptSecret(value);
}

function createConnectionStore(initial = []) {
  const rows = initial.map((row) => ({ ...row }));

  return {
    rows,
    organizationGhlConnection: {
      async findUnique({ where }) {
        if (where.organizationId) {
          return (
            rows.find((row) => row.organizationId === where.organizationId) ||
            null
          );
        }
        if (where.id) {
          return rows.find((row) => row.id === where.id) || null;
        }
        return null;
      },
      async update({ where, data }) {
        const idx = rows.findIndex((row) => row.id === where.id);
        if (idx === -1) throw new Error("not found");
        rows[idx] = { ...rows[idx], ...data, updatedAt: new Date() };
        return JSON.parse(JSON.stringify(rows[idx]));
      },
    },
  };
}

function seedConnectedOrg(
  organizationId,
  {
    id,
    locationId,
    accessToken = "access-token",
    refreshToken = "refresh-token",
    status = "CONNECTED",
    tokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000),
  },
) {
  return {
    id,
    organizationId,
    ghlLocationId: locationId,
    ghlCompanyId: "company_1",
    accessToken: encrypt(accessToken),
    refreshToken: encrypt(refreshToken),
    tokenExpiresAt,
    scopes: [
      "funnels/funnel.readonly",
      "funnels/page.readonly",
      "funnels/pagecount.readonly",
    ],
    status,
    connectedAt: new Date(),
    connectedByUserId: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function mockAxiosRequest(impl) {
  const axiosPath = require.resolve("axios");
  const original = require(axiosPath);
  const instances = [];

  require.cache[axiosPath].exports = {
    ...original,
    create: (config) => {
      const instance = {
        defaults: { ...config, headers: { ...config.headers } },
        async request(requestConfig) {
          return impl(
            {
              ...config,
              ...requestConfig,
              headers: { ...config.headers, ...requestConfig.headers },
            },
            instance,
          );
        },
      };
      instances.push(instance);
      return instance;
    },
  };

  return {
    instances,
    restore: () => {
      require.cache[axiosPath].exports = original;
    },
  };
}

function reloadModules() {
  [
    "../../utils/security/secretEncryption",
    "../../services/ghl/ghlOAuth.service",
    "../../services/ghl/brokerGhlErrors",
    "../../services/ghl/brokerGhlClient.service",
    "../../services/ghl/brokerGhlWebsites.service",
  ].forEach((mod) => delete require.cache[require.resolve(mod)]);
}

function ghlWebsitesHandler(config) {
  const auth = config.headers?.Authorization || "";

  if (config.method === "GET" && config.url === "/funnels/funnel/list") {
    const locationId = config.params?.locationId;
    if (auth === "Bearer token-a" && locationId === LOC_A) {
      return {
        data: {
          funnels: [
            {
              _id: FUNNEL_A,
              name: "ACOM Capital",
              locationId: LOC_A,
              published: true,
              domain: "acom.example.com",
              updatedAt: "2026-01-15T10:00:00.000Z",
            },
          ],
          count: 1,
        },
      };
    }
    if (auth === "Bearer token-b" && locationId === LOC_B) {
      return {
        data: {
          funnels: [{ _id: FUNNEL_B, name: "Broker B Site", locationId: LOC_B }],
          count: 1,
        },
      };
    }
  }

  if (config.method === "GET" && config.url === "/funnels/page/count") {
    if (config.params?.funnelId === FUNNEL_A && config.params?.locationId === LOC_A) {
      return { data: { count: 8 } };
    }
    return { data: { count: 0 } };
  }

  if (config.method === "GET" && config.url === "/funnels/page") {
    if (
      config.params?.locationId === LOC_A &&
      config.params?.funnelId === FUNNEL_A
    ) {
      return {
        data: {
          pages: [
            {
              _id: PAGE_A1,
              funnelId: FUNNEL_A,
              name: "Home",
              url: "https://pages.example.com/home",
              locationId: LOC_A,
            },
            {
              _id: PAGE_A2,
              funnelId: FUNNEL_A,
              name: "Thank You",
              locationId: LOC_A,
            },
          ],
          count: 2,
        },
      };
    }
    return { data: { pages: [], count: 0 } };
  }

  throw new Error(`Unexpected request ${config.method} ${config.url}`);
}

describe("brokerGhlWebsites.service", () => {
  let restoreAxios;

  beforeEach(() => {
    process.env.GHL_OAUTH_TOKEN_ENCRYPTION_KEY = TEST_KEY;
    process.env.GHL_OAUTH_CLIENT_ID = "client-id";
    process.env.GHL_OAUTH_CLIENT_SECRET = "client-secret";
    process.env.GHL_OAUTH_REDIRECT_URI = "http://localhost/callback";
    reloadModules();
  });

  afterEach(() => {
    if (restoreAxios) restoreAxios.restore();
    reloadModules();
  });

  function prismaWithBothOrgs() {
    return createConnectionStore([
      seedConnectedOrg(ORG_A, { id: CONN_A, locationId: LOC_A, accessToken: "token-a" }),
      seedConnectedOrg(ORG_B, { id: CONN_B, locationId: LOC_B, accessToken: "token-b" }),
    ]);
  }

  it("lists websites with page counts via mocked HTTP", async () => {
    const prisma = prismaWithBothOrgs();
    restoreAxios = mockAxiosRequest(ghlWebsitesHandler);

    const websites = require("../../services/ghl/brokerGhlWebsites.service");
    const result = await websites.listWebsites(prisma, ORG_A);

    assert.equal(result.websites.length, 1);
    assert.equal(result.websites[0].name, "ACOM Capital");
    assert.equal(result.websites[0].pageCount, 8);
    assert.equal(result.websites[0].status, "Published");
    assert.equal(result.capabilities.createPage, false);
  });

  it("gets website by id from funnel list", async () => {
    const prisma = prismaWithBothOrgs();
    restoreAxios = mockAxiosRequest(ghlWebsitesHandler);

    const websites = require("../../services/ghl/brokerGhlWebsites.service");
    const result = await websites.getWebsite(prisma, ORG_A, FUNNEL_A);

    assert.equal(result.website.id, FUNNEL_A);
    assert.equal(result.website.domain, "acom.example.com");
    assert.equal(result.website.pageCount, 8);
  });

  it("lists and gets website pages", async () => {
    const prisma = prismaWithBothOrgs();
    restoreAxios = mockAxiosRequest(ghlWebsitesHandler);

    const websites = require("../../services/ghl/brokerGhlWebsites.service");
    const listed = await websites.listWebsitePages(prisma, ORG_A, FUNNEL_A);
    assert.equal(listed.pages.length, 2);
    assert.equal(listed.pages[0].previewUrl, "https://pages.example.com/home");

    const page = await websites.getWebsitePage(prisma, ORG_A, FUNNEL_A, PAGE_A1);
    assert.equal(page.page.name, "Home");
    assert.equal(page.page.previewUrl, "https://pages.example.com/home");
  });

  it("returns NOT_FOUND for unknown website or page", async () => {
    const prisma = prismaWithBothOrgs();
    restoreAxios = mockAxiosRequest(ghlWebsitesHandler);

    const websites = require("../../services/ghl/brokerGhlWebsites.service");

    await assert.rejects(
      () => websites.getWebsite(prisma, ORG_A, "missing-funnel"),
      (err) => err.code === "BROKER_GHL_NOT_FOUND",
    );

    await assert.rejects(
      () => websites.getWebsitePage(prisma, ORG_A, FUNNEL_A, "missing-page"),
      (err) => err.code === "BROKER_GHL_NOT_FOUND",
    );
  });

  it("organization A cannot access organization B GHL websites", async () => {
    const prisma = prismaWithBothOrgs();
    restoreAxios = mockAxiosRequest(ghlWebsitesHandler);

    const websites = require("../../services/ghl/brokerGhlWebsites.service");
    const resultA = await websites.listWebsites(prisma, ORG_A);
    const resultB = await websites.listWebsites(prisma, ORG_B);

    assert.equal(resultA.websites[0].id, FUNNEL_A);
    assert.equal(resultB.websites[0].id, FUNNEL_B);
    assert.notEqual(resultA.websites[0].id, resultB.websites[0].id);
  });

  it("rejects DISCONNECTED GHL connection", async () => {
    const prisma = createConnectionStore([
      seedConnectedOrg(ORG_A, {
        id: CONN_A,
        locationId: LOC_A,
        status: "DISCONNECTED",
      }),
    ]);
    restoreAxios = mockAxiosRequest(ghlWebsitesHandler);

    const websites = require("../../services/ghl/brokerGhlWebsites.service");
    await assert.rejects(
      () => websites.listWebsites(prisma, ORG_A),
      (err) => err.code === "BROKER_GHL_CONNECTION_INACTIVE",
    );
  });

  it("handles GHL 401 safely and marks connection ERROR", async () => {
    const prisma = createConnectionStore([
      seedConnectedOrg(ORG_A, { id: CONN_A, locationId: LOC_A, accessToken: "token-a" }),
    ]);

    restoreAxios = mockAxiosRequest(async () => {
      const err = new Error("Unauthorized");
      err.response = {
        status: 401,
        data: { message: "invalid access_token secret-value" },
      };
      throw err;
    });

    const websites = require("../../services/ghl/brokerGhlWebsites.service");
    await assert.rejects(
      () => websites.listWebsites(prisma, ORG_A),
      (err) => err.code === "BROKER_GHL_TOKEN_EXPIRED",
    );

    assert.equal(prisma.rows[0].status, "ERROR");
    assert.doesNotMatch(String(prisma.rows[0].lastError || ""), /access_token|secret-value/i);
  });

  it("sanitized provider errors never expose tokens in API mapping", async () => {
    const prisma = createConnectionStore([
      seedConnectedOrg(ORG_A, { id: CONN_A, locationId: LOC_A, accessToken: "token-a" }),
    ]);

    restoreAxios = mockAxiosRequest(async (config) => {
      assert.equal(config.headers.Authorization, "Bearer token-a");
      assert.doesNotMatch(JSON.stringify(config), /enc:v1:/);
      const err = new Error("upstream");
      err.response = {
        status: 502,
        data: { message: "Bearer leaked-token-value" },
      };
      throw err;
    });

    const websites = require("../../services/ghl/brokerGhlWebsites.service");
    const { toBrokerGhlErrorResponse } = require("../../services/ghl/brokerGhlErrors");

    try {
      await websites.listWebsites(prisma, ORG_A);
      assert.fail("expected rejection");
    } catch (err) {
      const { body } = toBrokerGhlErrorResponse(err);
      assert.doesNotMatch(JSON.stringify(body), /Bearer|leaked-token|enc:v1:/i);
      assert.doesNotMatch(JSON.stringify(body), /token-a/);
    }
  });

  it("normalizePageArray handles direct array response from GHL", () => {
    const { normalizePageArray } = require("../../services/ghl/brokerGhlWebsites.service");

    const directArray = [
      {
        _id: "a17YgemUcxLYlR3Xdy4B",
        deleted: false,
        funnelId: "FfWFq7ItpSV4rfx50IIz",
        locationId: "6jBeYyShRGMLdxetPasx",
        name: "Home",
        stepId: "7d8f853f-8d71-4089-b56a-a4ad6a4fa7ea",
        updatedAt: "2026-08-19T10:41:16.151Z",
      },
    ];

    const result = normalizePageArray(directArray);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, "Home");
    assert.strictEqual(result[0]._id, "a17YgemUcxLYlR3Xdy4B");

    // Existing wrapped shapes still work
    assert.strictEqual(normalizePageArray({ pages: directArray }).length, 1);
    assert.strictEqual(normalizePageArray({ data: directArray }).length, 1);
    assert.strictEqual(normalizePageArray(null).length, 0);
    assert.strictEqual(normalizePageArray(undefined).length, 0);
  });

  it("maps funnel and page objects without leaking raw tokens", async () => {
    const {
      mapFunnelToWebsite,
      mapPageToWebsitePage,
    } = require("../../services/ghl/brokerGhlWebsites.service");

    const website = mapFunnelToWebsite({
      _id: "f1",
      name: "Site",
      accessToken: "should-not-leak",
    });
    assert.equal(website.id, "f1");
    assert.doesNotMatch(JSON.stringify(website), /should-not-leak|accessToken/);

    const page = mapPageToWebsitePage({
      _id: "p1",
      name: "Home",
      url: "https://example.com/home",
      refreshToken: "secret",
    });
    assert.equal(page.previewUrl, "https://example.com/home");
    assert.doesNotMatch(JSON.stringify(page), /secret|refreshToken/);
  });
});
