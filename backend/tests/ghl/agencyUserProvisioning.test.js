/**
 * Agency GHL team-user provisioning tests.
 * Mocked GHL client — no live writes.
 */
const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { applyPaymentEnv, reload, clearModule } = require("./helpers");

const PRO_LOC = "RQ3JZOrCXQUaIXK4FmYc";
const COMPANY = "HtXpcMHxPGpsuhqe0uiM";

describe("GHL Agency team-user provisioning", () => {
  let restore;
  let provisionOrganizationGhlAgencyUser;
  let PROVISION_RESULTS;
  let ghlCalls;
  let loggedErrors;
  let prisma;
  let agencyUsers;
  let mappingRows;

  beforeEach(() => {
    restore = applyPaymentEnv({
      GHL_AGENCY_COMPANY_ID: COMPANY,
      GHL_PRO_LOCATION_ID: PRO_LOC,
      GHL_ELITE_LOCATION_ID: "gw2PojfvG909sYV8Hrk7",
      GHL_AGENCY_PRIVATE_TOKEN: "pit-TESTTOKENVALUE",
    });
    ghlCalls = [];
    loggedErrors = [];
    agencyUsers = [];
    mappingRows = [];

    clearModule("../../services/logger/contextLogger");
    clearModule("../../services/ghl/ghlAgency.client");
    clearModule("../../services/ghl/ghlAccountLocation.service");
    clearModule("../../services/ghl/ghlAgencyUsers.service");
    clearModule("../../services/ghl/ghlAgencyUserProvisioning.service");

    const contextLoggerPath = require.resolve("../../services/logger/contextLogger");
    const realContext = require("../../services/logger/contextLogger");
    require.cache[contextLoggerPath] = {
      id: contextLoggerPath,
      filename: contextLoggerPath,
      loaded: true,
      exports: {
        ...realContext,
        commonLogs: {
          info: () => {},
          warn: () => {},
          error: (event, payload) => loggedErrors.push({ event, payload }),
        },
      },
    };

    reload("../../services/ghl/ghlAccountLocation.service");
    reload("../../services/ghl/ghlAgencyUsers.service");
    ({
      provisionOrganizationGhlAgencyUser,
      PROVISION_RESULTS,
    } = reload("../../services/ghl/ghlAgencyUserProvisioning.service"));

    prisma = buildPrisma();
  });

  afterEach(() => {
    restore();
    clearModule("../../services/logger/contextLogger");
    clearModule("../../services/ghl/ghlAgencyUsers.service");
    clearModule("../../services/ghl/ghlAgencyUserProvisioning.service");
  });

  function buildPrisma() {
    return {
      userAccount: {
        _users: {},
        async findUnique({ where }) {
          return this._users[where.id] || null;
        },
      },
      organizationGhlAgencyLocation: {
        _byOrg: {},
        async findUnique({ where }) {
          return this._byOrg[where.organizationId] || null;
        },
      },
      organizationGhlAgencyUser: {
        async findUnique({ where }) {
          return mappingRows.find((r) => r.userId === where.userId) || null;
        },
        async create({ data }) {
          const row = { id: `map_${mappingRows.length + 1}`, ...data };
          mappingRows.push(row);
          return { ...row };
        },
        async update({ where, data }) {
          const idx = mappingRows.findIndex((r) => r.userId === where.userId);
          mappingRows[idx] = { ...mappingRows[idx], ...data };
          return { ...mappingRows[idx] };
        },
        async upsert({ where, create, update }) {
          const idx = mappingRows.findIndex((r) => r.userId === where.userId);
          if (idx === -1) {
            const row = {
              id: `map_${mappingRows.length + 1}`,
              matchedAt: new Date(),
              lastError: null,
              ...create,
            };
            mappingRows.push(row);
            return { ...row };
          }
          mappingRows[idx] = {
            ...mappingRows[idx],
            ...update,
            matchedAt: new Date(),
          };
          return { ...mappingRows[idx] };
        },
      },
    };
  }

  function setUser({ id, organizationId, email, roles, firstName = "Ada", lastName = "Admin" }) {
    prisma.userAccount._users[id] = {
      id,
      organizationId,
      email,
      firstName,
      lastName,
      phone: null,
      isDeleted: false,
      roles: roles.map((name) => ({ role: { name } })),
    };
  }

  function setAgencyLocation(organizationId, overrides = {}) {
    prisma.organizationGhlAgencyLocation._byOrg[organizationId] = {
      organizationId,
      packageCode: "PRO",
      ghlCompanyId: COMPANY,
      ghlLocationId: PRO_LOC,
      status: "ACTIVE",
      ...overrides,
    };
  }

  function mockClient({ failCreate = false, failList = false } = {}) {
    return {
      async get(url, config) {
        ghlCalls.push({ method: "GET", url, params: config?.params || null });
        if (failList) {
          const err = new Error(
            "list boom GHL_AGENCY_PRIVATE_TOKEN=secret Bearer abc.def.ghi pit-ABCDEFG123",
          );
          err.response = {
            status: 500,
            data: {
              message:
                "list boom GHL_AGENCY_PRIVATE_TOKEN=secret Bearer abc.def.ghi pit-ABCDEFG123",
            },
          };
          throw err;
        }
        assert.equal(url, "/users/search");
        return { data: { users: agencyUsers } };
      },
      async post(url, body) {
        ghlCalls.push({ method: "POST", url, body });
        if (failCreate) {
          const err = new Error(
            "create boom GHL_AGENCY_PRIVATE_TOKEN=secret Bearer tok.en.val pit-XYZ999",
          );
          err.response = {
            status: 500,
            data: {
              message:
                "create boom GHL_AGENCY_PRIVATE_TOKEN=secret Bearer tok.en.val pit-XYZ999",
            },
          };
          throw err;
        }
        assert.equal(url, "/users/");
        assert.equal(body.companyId, COMPANY);
        assert.equal(body.type, "account");
        assert.ok(Array.isArray(body.locationIds));
        assert.ok(body.password && body.password.length >= 8);
        assert.equal(body.scopes, undefined);
        assert.equal(body.permissions, undefined);
        const created = {
          id: `ghl_new_${agencyUsers.length + 1}`,
          email: body.email,
          firstName: body.firstName,
          lastName: body.lastName,
          locationIds: body.locationIds,
          deleted: false,
        };
        agencyUsers.push(created);
        return { status: 201, data: created };
      },
      async put(url, body) {
        ghlCalls.push({ method: "PUT", url, body });
        return { status: 200, data: { id: url.split("/").pop(), ...body } };
      },
      async delete(url) {
        ghlCalls.push({ method: "DELETE", url });
        throw new Error("DELETE should not be called by provision");
      },
    };
  }

  it("1. BROKER_ADMIN provisioning creates GHL user + ACTIVE mapping", async () => {
    setUser({
      id: "u_admin",
      organizationId: "org_1",
      email: "Admin@Example.com",
      roles: ["BROKER_ADMIN"],
    });
    setAgencyLocation("org_1");
    const client = mockClient();

    const result = await provisionOrganizationGhlAgencyUser(prisma, {
      organizationId: "org_1",
      userId: "u_admin",
      client,
    });

    assert.equal(result.result, PROVISION_RESULTS.CREATED);
    assert.equal(result.ghlWriteCalled, true);
    assert.equal(mappingRows.length, 1);
    assert.equal(mappingRows[0].status, "ACTIVE");
    assert.equal(mappingRows[0].email, "admin@example.com");
    assert.equal(mappingRows[0].ghlLocationId, PRO_LOC);
    assert.equal(ghlCalls.filter((c) => c.method === "POST").length, 1);
    assert.equal(ghlCalls.find((c) => c.method === "POST").body.role, "admin");
  });

  it("2. BROKER_OFFICER provisioning creates GHL user with role=user", async () => {
    setUser({
      id: "u_lo",
      organizationId: "org_1",
      email: "lo@example.com",
      roles: ["BROKER_OFFICER"],
      firstName: "Loan",
      lastName: "Officer",
    });
    setAgencyLocation("org_1");
    const client = mockClient();

    const result = await provisionOrganizationGhlAgencyUser(prisma, {
      organizationId: "org_1",
      userId: "u_lo",
      client,
    });

    assert.equal(result.result, PROVISION_RESULTS.CREATED);
    assert.equal(ghlCalls.find((c) => c.method === "POST").body.role, "user");
  });

  it("3. SUB_BROKER rejected without GHL API call", async () => {
    setUser({
      id: "u_co",
      organizationId: "org_1",
      email: "co@example.com",
      roles: ["SUB_BROKER"],
    });
    setAgencyLocation("org_1");
    const client = mockClient();

    const result = await provisionOrganizationGhlAgencyUser(prisma, {
      organizationId: "org_1",
      userId: "u_co",
      client,
    });

    assert.equal(result.result, PROVISION_RESULTS.NOT_ELIGIBLE);
    assert.equal(result.ghlApiCalled, false);
    assert.equal(result.ghlWriteCalled, false);
    assert.equal(ghlCalls.length, 0);
  });

  it("4. Missing Agency location rejected without GHL write", async () => {
    setUser({
      id: "u_admin",
      organizationId: "org_1",
      email: "a@example.com",
      roles: ["BROKER_ADMIN"],
    });
    const client = mockClient();

    const result = await provisionOrganizationGhlAgencyUser(prisma, {
      organizationId: "org_1",
      userId: "u_admin",
      client,
    });

    assert.equal(result.result, PROVISION_RESULTS.NOT_CONFIGURED);
    assert.equal(result.ghlWriteCalled, false);
    assert.equal(ghlCalls.length, 0);
  });

  it("5. Existing GHL user reused (no POST)", async () => {
    setUser({
      id: "u_admin",
      organizationId: "org_1",
      email: "reuse@example.com",
      roles: ["BROKER_ADMIN"],
    });
    setAgencyLocation("org_1");
    agencyUsers.push({
      id: "ghl_existing",
      email: "reuse@example.com",
      firstName: "Re",
      lastName: "Use",
      locationIds: [PRO_LOC],
      deleted: false,
    });
    const client = mockClient();

    const result = await provisionOrganizationGhlAgencyUser(prisma, {
      organizationId: "org_1",
      userId: "u_admin",
      client,
    });

    assert.equal(result.result, PROVISION_RESULTS.REUSED);
    assert.equal(result.ghlUser.userId, "ghl_existing");
    assert.equal(ghlCalls.filter((c) => c.method === "POST").length, 0);
    assert.equal(mappingRows[0].ghlUserId, "ghl_existing");
    assert.equal(mappingRows[0].status, "ACTIVE");
  });

  it("6. Duplicate email / multiple GHL users → AMBIGUOUS", async () => {
    setUser({
      id: "u_admin",
      organizationId: "org_1",
      email: "dup@example.com",
      roles: ["BROKER_ADMIN"],
    });
    setAgencyLocation("org_1");
    agencyUsers.push(
      {
        id: "ghl_a",
        email: "dup@example.com",
        locationIds: [PRO_LOC],
      },
      {
        id: "ghl_b",
        email: "dup@example.com",
        locationIds: [PRO_LOC],
      },
    );
    const client = mockClient();

    const result = await provisionOrganizationGhlAgencyUser(prisma, {
      organizationId: "org_1",
      userId: "u_admin",
      client,
    });

    assert.equal(result.result, PROVISION_RESULTS.AMBIGUOUS);
    assert.equal(result.ghlWriteCalled, false);
    assert.equal(ghlCalls.filter((c) => c.method === "POST").length, 0);
    assert.equal(mappingRows.length, 0);
  });

  it("7. Successful new GHL user creation", async () => {
    setUser({
      id: "u_new",
      organizationId: "org_1",
      email: "new@example.com",
      roles: ["BROKER_ADMIN"],
    });
    setAgencyLocation("org_1");
    const client = mockClient();

    const result = await provisionOrganizationGhlAgencyUser(prisma, {
      organizationId: "org_1",
      userId: "u_new",
      client,
    });

    assert.equal(result.result, PROVISION_RESULTS.CREATED);
    assert.ok(result.ghlUser.userId);
    assert.equal(agencyUsers.length, 1);
  });

  it("8. GHL API failure → mapping ERROR, no throw (subscription-safe)", async () => {
    setUser({
      id: "u_admin",
      organizationId: "org_1",
      email: "fail@example.com",
      roles: ["BROKER_ADMIN"],
    });
    setAgencyLocation("org_1");
    const client = mockClient({ failCreate: true });

    const result = await provisionOrganizationGhlAgencyUser(prisma, {
      organizationId: "org_1",
      userId: "u_admin",
      client,
    });

    assert.equal(result.result, PROVISION_RESULTS.ERROR);
    assert.equal(mappingRows[0].status, "ERROR");
    assert.ok(mappingRows[0].lastError);
    // Caller can continue — provisioning does not throw.
  });

  it("9. Idempotent second provisioning → no duplicate GHL user", async () => {
    setUser({
      id: "u_admin",
      organizationId: "org_1",
      email: "idem@example.com",
      roles: ["BROKER_ADMIN"],
    });
    setAgencyLocation("org_1");
    const client = mockClient();

    const first = await provisionOrganizationGhlAgencyUser(prisma, {
      organizationId: "org_1",
      userId: "u_admin",
      client,
    });
    assert.equal(first.result, PROVISION_RESULTS.CREATED);

    const second = await provisionOrganizationGhlAgencyUser(prisma, {
      organizationId: "org_1",
      userId: "u_admin",
      client,
    });
    assert.equal(second.result, PROVISION_RESULTS.ALREADY_PROVISIONED);
    assert.equal(agencyUsers.length, 1);
    assert.equal(mappingRows.length, 1);
    assert.equal(ghlCalls.filter((c) => c.method === "POST").length, 1);
  });

  it("10. Error logs never expose Agency PIT / Bearer / pit- tokens", async () => {
    setUser({
      id: "u_admin",
      organizationId: "org_1",
      email: "secret@example.com",
      roles: ["BROKER_ADMIN"],
    });
    setAgencyLocation("org_1");
    const client = mockClient({ failCreate: true });

    await provisionOrganizationGhlAgencyUser(prisma, {
      organizationId: "org_1",
      userId: "u_admin",
      client,
    });

    const blob = JSON.stringify(loggedErrors);
    assert.doesNotMatch(blob, /GHL_AGENCY_PRIVATE_TOKEN=secret/);
    assert.doesNotMatch(blob, /Bearer tok\.en\.val/);
    assert.doesNotMatch(blob, /pit-XYZ999/);
    assert.match(blob, /\[REDACTED\]/);
  });

  it("dryRun performs no POST/PUT/DELETE", async () => {
    setUser({
      id: "u_admin",
      organizationId: "org_1",
      email: "dry@example.com",
      roles: ["BROKER_ADMIN"],
    });
    setAgencyLocation("org_1");
    const client = mockClient();

    const result = await provisionOrganizationGhlAgencyUser(prisma, {
      organizationId: "org_1",
      userId: "u_admin",
      dryRun: true,
      client,
    });

    assert.equal(result.result, PROVISION_RESULTS.DRY_RUN);
    assert.equal(result.plannedAction, "create_ghl_user");
    assert.equal(result.ghlWriteCalled, false);
    assert.equal(
      ghlCalls.filter((c) => ["POST", "PUT", "DELETE"].includes(c.method)).length,
      0,
    );
    assert.equal(mappingRows.length, 0);
  });

  it("inactive Agency location rejected without GHL write", async () => {
    setUser({
      id: "u_admin",
      organizationId: "org_1",
      email: "a@example.com",
      roles: ["BROKER_ADMIN"],
    });
    setAgencyLocation("org_1", { status: "INACTIVE" });
    const client = mockClient();

    const result = await provisionOrganizationGhlAgencyUser(prisma, {
      organizationId: "org_1",
      userId: "u_admin",
      client,
    });

    assert.equal(result.result, PROVISION_RESULTS.NOT_CONFIGURED);
    assert.equal(ghlCalls.length, 0);
  });
});
