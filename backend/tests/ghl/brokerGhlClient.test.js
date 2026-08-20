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
    scopes: ["contacts.readonly", "contacts.write"],
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
            { ...config, ...requestConfig, headers: { ...config.headers, ...requestConfig.headers } },
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
    "../../services/ghl/brokerGhlContacts.service",
    "../../services/ghl/syncBrokerContactToGhl",
  ].forEach((mod) => delete require.cache[require.resolve(mod)]);
}

describe("brokerGhlClient.service", () => {
  let restoreAxios;
  let restoreEnv;
  let refreshCalls;

  beforeEach(() => {
    refreshCalls = 0;
    restoreEnv = process.env.GHL_OAUTH_TOKEN_ENCRYPTION_KEY;
    process.env.GHL_OAUTH_TOKEN_ENCRYPTION_KEY = TEST_KEY;
    process.env.GHL_OAUTH_CLIENT_ID = "client-id";
    process.env.GHL_OAUTH_CLIENT_SECRET = "client-secret";
    process.env.GHL_OAUTH_REDIRECT_URI = "http://localhost/callback";
    reloadModules();
  });

  afterEach(() => {
    if (restoreAxios) restoreAxios.restore();
    if (restoreEnv === undefined) delete process.env.GHL_OAUTH_TOKEN_ENCRYPTION_KEY;
    else process.env.GHL_OAUTH_TOKEN_ENCRYPTION_KEY = restoreEnv;
    reloadModules();
  });

  it("organization A uses token A and organization B uses token B", async () => {
    const prisma = createConnectionStore([
      seedConnectedOrg(ORG_A, { id: CONN_A, locationId: LOC_A, accessToken: "token-a" }),
      seedConnectedOrg(ORG_B, { id: CONN_B, locationId: LOC_B, accessToken: "token-b" }),
    ]);

    const seen = [];
    restoreAxios = mockAxiosRequest(async (config) => {
      seen.push(config.headers.Authorization);
      return { data: { ok: true } };
    });

    const client = require("../../services/ghl/brokerGhlClient.service");
    await client.requestForOrganization(prisma, ORG_A, { method: "GET", url: "/ping" });
    await client.requestForOrganization(prisma, ORG_B, { method: "GET", url: "/ping" });

    assert.deepEqual(seen, ["Bearer token-a", "Bearer token-b"]);
  });

  it("missing connection returns safe NOT_CONNECTED error", async () => {
    const prisma = createConnectionStore([]);
    const client = require("../../services/ghl/brokerGhlClient.service");

    await assert.rejects(
      () => client.getAccessTokenForOrganization(prisma, ORG_A),
      (err) => err.code === "BROKER_GHL_NOT_CONNECTED",
    );
  });

  it("DISCONNECTED and ERROR connections cannot make API calls", async () => {
    const client = require("../../services/ghl/brokerGhlClient.service");
    const disconnected = createConnectionStore([
      seedConnectedOrg(ORG_A, {
        id: CONN_A,
        locationId: LOC_A,
        status: "DISCONNECTED",
      }),
    ]);
    await assert.rejects(
      () => client.getAccessTokenForOrganization(disconnected, ORG_A),
      (err) => err.code === "BROKER_GHL_CONNECTION_INACTIVE",
    );

    const errored = createConnectionStore([
      seedConnectedOrg(ORG_A, {
        id: CONN_A,
        locationId: LOC_A,
        status: "ERROR",
      }),
    ]);
    await assert.rejects(
      () => client.getAccessTokenForOrganization(errored, ORG_A),
      (err) => err.code === "BROKER_GHL_CONNECTION_ERROR",
    );
  });

  it("expired token triggers refresh and stores encrypted tokens", async () => {
    const prisma = createConnectionStore([
      seedConnectedOrg(ORG_A, {
        id: CONN_A,
        locationId: LOC_A,
        accessToken: "old-access",
        refreshToken: "old-refresh",
        tokenExpiresAt: new Date(Date.now() - 1000),
      }),
    ]);

    const oauth = require("../../services/ghl/ghlOAuth.service");
    const originalRefresh = oauth.refreshAccessToken;
    oauth.refreshAccessToken = async () => {
      refreshCalls += 1;
      return {
        accessToken: "new-access",
        refreshToken: "new-refresh",
        expiresIn: 3600,
        scopes: ["contacts.readonly"],
        locationId: LOC_A,
        companyId: "company_1",
      };
    };

    restoreAxios = mockAxiosRequest(async () => ({ data: { ok: true } }));

    const client = require("../../services/ghl/brokerGhlClient.service");
    const result = await client.getAccessTokenForOrganization(prisma, ORG_A);

    assert.equal(refreshCalls, 1);
    assert.equal(result.accessToken, "new-access");
    assert.equal(result.refreshed, true);
    assert.match(prisma.rows[0].accessToken, /^enc:v1:/);
    assert.match(prisma.rows[0].refreshToken, /^enc:v1:/);
    assert.notEqual(prisma.rows[0].accessToken, "new-access");

    oauth.refreshAccessToken = originalRefresh;
  });

  it("refresh failure marks connection ERROR with safe lastError", async () => {
    const prisma = createConnectionStore([
      seedConnectedOrg(ORG_A, {
        id: CONN_A,
        locationId: LOC_A,
        tokenExpiresAt: new Date(Date.now() - 1000),
      }),
    ]);

    const oauth = require("../../services/ghl/ghlOAuth.service");
    oauth.refreshAccessToken = async () => {
      throw new Error("refresh failed access_token=secret");
    };

    const client = require("../../services/ghl/brokerGhlClient.service");
    await assert.rejects(
      () => client.getAccessTokenForOrganization(prisma, ORG_A),
      (err) => err.code === "BROKER_GHL_TOKEN_REFRESH_FAILED",
    );

    assert.equal(prisma.rows[0].status, "ERROR");
    assert.match(prisma.rows[0].lastError, /refresh failed/i);
    assert.doesNotMatch(prisma.rows[0].lastError, /access_token|secret/i);
  });

  it("401 from GHL is handled safely and marks connection ERROR", async () => {
    const prisma = createConnectionStore([
      seedConnectedOrg(ORG_A, { id: CONN_A, locationId: LOC_A }),
    ]);

    restoreAxios = mockAxiosRequest(async () => {
      const err = new Error("Unauthorized");
      err.response = {
        status: 401,
        data: { message: "invalid access_token abc" },
      };
      throw err;
    });

    const client = require("../../services/ghl/brokerGhlClient.service");
    await assert.rejects(
      () => client.requestForOrganization(prisma, ORG_A, { method: "GET", url: "/contacts/1" }),
      (err) => err.code === "BROKER_GHL_TOKEN_EXPIRED",
    );

    assert.equal(prisma.rows[0].status, "ERROR");
    assert.doesNotMatch(String(prisma.rows[0].lastError || ""), /access_token|abc/i);
  });

  it("organization A cannot load organization B connection via isolation check", async () => {
    const prisma = createConnectionStore([
      seedConnectedOrg(ORG_B, { id: CONN_B, locationId: LOC_B }),
    ]);

    const client = require("../../services/ghl/brokerGhlClient.service");
    await assert.rejects(
      () => client.getAccessTokenForOrganization(prisma, ORG_A),
      (err) => err.code === "BROKER_GHL_NOT_CONNECTED",
    );
  });
});

describe("brokerGhlContacts.service", () => {
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

  function prismaWithOrgA() {
    return createConnectionStore([
      seedConnectedOrg(ORG_A, { id: CONN_A, locationId: LOC_A, accessToken: "token-a" }),
    ]);
  }

  it("lists, gets, creates, updates, and deletes contacts via mocked HTTP", async () => {
    const prisma = prismaWithOrgA();
    const calls = [];

    restoreAxios = mockAxiosRequest(async (config) => {
      calls.push({ method: config.method, url: config.url, data: config.data, params: config.params });

      if (config.method === "GET" && config.url === "/contacts/") {
        return {
          data: {
            contacts: [{ id: "ghl-1", email: "a@example.com", firstName: "Ann" }],
          },
        };
      }
      if (config.method === "GET" && config.url === "/contacts/ghl-1") {
        return { data: { contact: { id: "ghl-1", email: "a@example.com" } } };
      }
      if (config.method === "POST" && config.url === "/contacts/") {
        return {
          data: { contact: { id: "ghl-new", ...config.data } },
        };
      }
      if (config.method === "PUT" && config.url === "/contacts/ghl-1") {
        return {
          data: { contact: { id: "ghl-1", ...config.data } },
        };
      }
      if (config.method === "DELETE" && config.url === "/contacts/ghl-1") {
        return { data: { success: true } };
      }
      throw new Error(`Unexpected request ${config.method} ${config.url}`);
    });

    const contacts = require("../../services/ghl/brokerGhlContacts.service");

    const listed = await contacts.listContacts(prisma, ORG_A, { limit: 10 });
    assert.equal(listed.contacts.length, 1);

    const fetched = await contacts.getContact(prisma, ORG_A, "ghl-1");
    assert.equal(fetched.id, "ghl-1");

    const created = await contacts.createContact(prisma, ORG_A, {
      email: "new@example.com",
      firstName: "New",
    });
    assert.equal(created.id, "ghl-new");
    assert.equal(created.locationId, LOC_A);

    const updated = await contacts.updateContact(prisma, ORG_A, "ghl-1", {
      lastName: "Updated",
    });
    assert.equal(updated.lastName, "Updated");

    const deleted = await contacts.deleteContact(prisma, ORG_A, "ghl-1");
    assert.equal(deleted.deleted, true);

    assert.ok(calls.some((c) => c.url === "/contacts/" && c.params?.locationId === LOC_A));
    assert.ok(
      calls.some(
        (c) => c.url === "/contacts/" && c.method === "POST" && c.data?.locationId === LOC_A,
      ),
    );
  });

  it("syncBrokerContactToGhl maps LendingCart contact fields and upserts by email", async () => {
    const prisma = prismaWithOrgA();
    let createCalled = false;

    restoreAxios = mockAxiosRequest(async (config) => {
      if (config.method === "POST" && config.url === "/contacts/search") {
        return {
          data: {
            contacts: [{ id: "ghl-existing", email: "lead@example.com", firstName: "Old" }],
          },
        };
      }
      if (config.method === "PUT" && config.url === "/contacts/ghl-existing") {
        return {
          data: {
            contact: {
              id: "ghl-existing",
              email: "lead@example.com",
              firstName: "Jane",
              companyName: "Acme",
            },
          },
        };
      }
      if (config.method === "POST" && config.url === "/contacts/") {
        createCalled = true;
        return { data: { contact: { id: "should-not-create" } } };
      }
      throw new Error(`Unexpected ${config.method} ${config.url}`);
    });

    const { syncBrokerContactToGhl } = require("../../services/ghl/syncBrokerContactToGhl");
    const result = await syncBrokerContactToGhl(prisma, ORG_A, {
      firstName: "Jane",
      lastName: "Doe",
      email: "lead@example.com",
      phone: "5551234567",
      companyName: "Acme",
      contactType: "BORROWER",
      tags: ["pipeline"],
    });

    assert.equal(result.action, "updated");
    assert.equal(result.ghlContact.firstName, "Jane");
    assert.equal(createCalled, false);
  });
});
