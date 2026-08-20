const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const TEST_KEY = crypto.randomBytes(32).toString("hex");
const ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const USER_A = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const LOC_1 = "loc_ghl_111";
const LOC_2 = "loc_ghl_222";

function createMemoryGhlConnectionStore() {
  const rows = [];

  const clone = (value) => JSON.parse(JSON.stringify(value));

  return {
    rows,
    organizationGhlConnection: {
      async findUnique({ where }) {
        if (where.organizationId) {
          return clone(
            rows.find((row) => row.organizationId === where.organizationId) ||
              null,
          );
        }
        if (where.ghlLocationId) {
          return clone(
            rows.find((row) => row.ghlLocationId === where.ghlLocationId) ||
              null,
          );
        }
        if (where.id) {
          return clone(rows.find((row) => row.id === where.id) || null);
        }
        return null;
      },
      async upsert({ where, create, update }) {
        const idx = rows.findIndex(
          (row) => row.organizationId === where.organizationId,
        );
        if (idx === -1) {
          const row = {
            id: crypto.randomUUID(),
            createdAt: new Date(),
            updatedAt: new Date(),
            ...create,
          };
          rows.push(row);
          return clone(row);
        }
        rows[idx] = {
          ...rows[idx],
          ...update,
          updatedAt: new Date(),
        };
        return clone(rows[idx]);
      },
      async update({ where, data }) {
        const idx = rows.findIndex((row) => row.id === where.id);
        if (idx === -1) throw new Error("not found");
        rows[idx] = { ...rows[idx], ...data, updatedAt: new Date() };
        return clone(rows[idx]);
      },
      async delete({ where }) {
        const idx = rows.findIndex((row) => row.id === where.id);
        if (idx === -1) throw new Error("not found");
        const [deleted] = rows.splice(idx, 1);
        return clone(deleted);
      },
    },
  };
}

function applyOAuthEnv(overrides = {}) {
  const keys = [
    "GHL_OAUTH_CLIENT_ID",
    "GHL_OAUTH_CLIENT_SECRET",
    "GHL_OAUTH_REDIRECT_URI",
    "GHL_OAUTH_TOKEN_ENCRYPTION_KEY",
    ...Object.keys(overrides),
  ];
  const snap = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.GHL_OAUTH_CLIENT_ID = overrides.GHL_OAUTH_CLIENT_ID ?? "client-id";
  process.env.GHL_OAUTH_CLIENT_SECRET =
    overrides.GHL_OAUTH_CLIENT_SECRET ?? "client-secret";
  process.env.GHL_OAUTH_REDIRECT_URI =
    overrides.GHL_OAUTH_REDIRECT_URI ??
    "http://localhost:4000/broker/integrations/ghl/callback";
  process.env.GHL_OAUTH_TOKEN_ENCRYPTION_KEY =
    overrides.GHL_OAUTH_TOKEN_ENCRYPTION_KEY ?? TEST_KEY;

  return () => {
    for (const [key, value] of Object.entries(snap)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

function reloadOAuthService() {
  delete require.cache[require.resolve("../../utils/security/secretEncryption")];
  delete require.cache[require.resolve("../../services/ghl/ghlOAuth.service")];
  return require("../../services/ghl/ghlOAuth.service");
}

describe("ghlOAuth connection service", () => {
  let restoreEnv;

  beforeEach(() => {
    restoreEnv = applyOAuthEnv();
  });

  afterEach(() => {
    restoreEnv();
    delete require.cache[require.resolve("../../utils/security/secretEncryption")];
    delete require.cache[require.resolve("../../services/ghl/ghlOAuth.service")];
  });

  it("toPublicConnectionStatus never exposes token fields", () => {
    const service = reloadOAuthService();
    const publicStatus = service.toPublicConnectionStatus({
      status: "CONNECTED",
      ghlLocationId: LOC_1,
      ghlCompanyId: "company_1",
      scopes: ["contacts.readonly"],
      connectedAt: new Date("2026-01-01T00:00:00.000Z"),
      connectedByUserId: USER_A,
      tokenExpiresAt: new Date("2026-01-02T00:00:00.000Z"),
      lastError: null,
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      accessToken: "enc:v1:should-not-leak",
      refreshToken: "enc:v1:should-not-leak",
    });

    assert.equal(publicStatus.connected, true);
    assert.equal(publicStatus.ghlLocationId, LOC_1);
    assert.equal("accessToken" in publicStatus, false);
    assert.equal("refreshToken" in publicStatus, false);
  });

  it("prevents the same GHL location from connecting to two organizations", async () => {
    const service = reloadOAuthService();
    const prisma = createMemoryGhlConnectionStore();

    await service.saveOrganizationConnection(prisma, {
      organizationId: ORG_A,
      connectedByUserId: USER_A,
      tokenPayload: {
        accessToken: "access-a",
        refreshToken: "refresh-a",
        expiresIn: 3600,
        scopes: ["contacts.readonly"],
        locationId: LOC_1,
        companyId: "company_1",
      },
    });

    await assert.rejects(
      () =>
        service.saveOrganizationConnection(prisma, {
          organizationId: ORG_B,
          connectedByUserId: USER_A,
          tokenPayload: {
            accessToken: "access-b",
            refreshToken: "refresh-b",
            expiresIn: 3600,
            scopes: ["contacts.readonly"],
            locationId: LOC_1,
            companyId: "company_1",
          },
        }),
      (err) => err.code === "LOCATION_ALREADY_CONNECTED",
    );
  });

  it("allows the same organization to reconnect and update its connection", async () => {
    const service = reloadOAuthService();
    const prisma = createMemoryGhlConnectionStore();

    await service.saveOrganizationConnection(prisma, {
      organizationId: ORG_A,
      connectedByUserId: USER_A,
      tokenPayload: {
        accessToken: "access-old",
        refreshToken: "refresh-old",
        expiresIn: 3600,
        scopes: ["contacts.readonly"],
        locationId: LOC_1,
        companyId: "company_1",
      },
    });

    await service.saveOrganizationConnection(prisma, {
      organizationId: ORG_A,
      connectedByUserId: USER_A,
      tokenPayload: {
        accessToken: "access-new",
        refreshToken: "refresh-new",
        expiresIn: 7200,
        scopes: ["contacts.readonly", "contacts.write"],
        locationId: LOC_2,
        companyId: "company_2",
      },
    });

    assert.equal(prisma.rows.length, 1);
    assert.equal(prisma.rows[0].organizationId, ORG_A);
    assert.equal(prisma.rows[0].ghlLocationId, LOC_2);
    assert.match(prisma.rows[0].accessToken, /^enc:v1:/);
  });

  it("disconnect removes the connection and releases the location", async () => {
    const service = reloadOAuthService();
    const prisma = createMemoryGhlConnectionStore();

    await service.saveOrganizationConnection(prisma, {
      organizationId: ORG_A,
      connectedByUserId: USER_A,
      tokenPayload: {
        accessToken: "access-a",
        refreshToken: "refresh-a",
        expiresIn: 3600,
        scopes: ["contacts.readonly"],
        locationId: LOC_1,
        companyId: "company_1",
      },
    });

    const disconnected = await service.disconnectOrganizationConnection(
      prisma,
      ORG_A,
    );
    assert.equal(disconnected.disconnected, true);
    assert.equal(prisma.rows.length, 0);

    await service.saveOrganizationConnection(prisma, {
      organizationId: ORG_B,
      connectedByUserId: USER_A,
      tokenPayload: {
        accessToken: "access-b",
        refreshToken: "refresh-b",
        expiresIn: 3600,
        scopes: ["contacts.readonly"],
        locationId: LOC_1,
        companyId: "company_1",
      },
    });

    assert.equal(prisma.rows[0].organizationId, ORG_B);
  });

  it("normalizeTokenResponse requires locationId for sub-account installs", () => {
    const service = reloadOAuthService();
    const normalized = service.normalizeTokenResponse({
      access_token: "abc",
      refresh_token: "def",
      expires_in: 3600,
      scope: "contacts.readonly contacts.write",
      userType: "Location",
      locationId: LOC_1,
      companyId: "company_1",
    });

    assert.equal(normalized.locationId, LOC_1);
    assert.equal(normalized.accessToken, "abc");
    assert.deepEqual(normalized.scopes, [
      "contacts.readonly",
      "contacts.write",
    ]);
  });
});
