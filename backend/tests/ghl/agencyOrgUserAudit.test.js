const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { reload } = require("./helpers");

describe("GHL Agency org-user diagnostic audit (read-only)", () => {
  let auditOrganizationGhlAgencyUsers;
  let RECONCILE_RESULTS;
  let ghlCalls;
  let persistCalls;
  let prisma;

  beforeEach(() => {
    ghlCalls = [];
    persistCalls = 0;
    ({ auditOrganizationGhlAgencyUsers, RECONCILE_RESULTS } = reload(
      "../../services/ghl/ghlAgencyUsers.service",
    ));

    prisma = {
      organization: {
        async findUnique({ where }) {
          return this._orgs[where.id] || null;
        },
        _orgs: {
          org1: { id: "org1", name: "Demo Broker" },
        },
      },
      userAccount: {
        async findMany({ where }) {
          return (this._users || []).filter(
            (u) =>
              u.organizationId === where.organizationId &&
              u.isDeleted === false,
          );
        },
        _users: [],
      },
      organizationGhlAgencyLocation: {
        async findUnique({ where }) {
          return this._byOrg[where.organizationId] || null;
        },
        _byOrg: {},
      },
      organizationGhlAgencyUser: {
        async upsert() {
          persistCalls += 1;
          throw new Error("Diagnostic must not persist mappings");
        },
      },
    };
  });

  function mockClient(users) {
    return {
      async get(url, config) {
        ghlCalls.push({ method: "GET", url, params: config?.params || null });
        assert.equal(url, "/users/search");
        return { data: { users } };
      },
      async post() {
        throw new Error("GHL write POST must never be called");
      },
      async put() {
        throw new Error("GHL write PUT must never be called");
      },
      async delete() {
        throw new Error("GHL write DELETE must never be called");
      },
    };
  }

  function addUser({ id, email, roles }) {
    prisma.userAccount._users.push({
      id,
      organizationId: "org1",
      email,
      isDeleted: false,
      createdAt: new Date(),
      roles: roles.map((name) => ({ role: { name } })),
    });
  }

  function setAgencyLocation() {
    prisma.organizationGhlAgencyLocation._byOrg.org1 = {
      organizationId: "org1",
      ghlLocationId: "RQ3JZOrCXQUaIXK4FmYc",
      ghlCompanyId: "HtXpcMHxPGpsuhqe0uiM",
      status: "ACTIVE",
      packageCode: "PRO",
    };
  }

  it("includes BROKER_ADMIN", async () => {
    addUser({
      id: "admin1",
      email: "admin@example.com",
      roles: ["BROKER_ADMIN"],
    });
    setAgencyLocation();
    const audit = await auditOrganizationGhlAgencyUsers(prisma, {
      organizationId: "org1",
      client: mockClient([{ id: "g1", email: "admin@example.com" }]),
    });
    assert.equal(audit.eligibleUsers.length, 1);
    assert.equal(audit.eligibleUsers[0].role, "BROKER_ADMIN");
    assert.equal(audit.eligibleUsers[0].result, RECONCILE_RESULTS.MATCHED);
  });

  it("includes BROKER_OFFICER", async () => {
    addUser({
      id: "lo1",
      email: "lo@example.com",
      roles: ["BROKER_OFFICER"],
    });
    setAgencyLocation();
    const audit = await auditOrganizationGhlAgencyUsers(prisma, {
      organizationId: "org1",
      client: mockClient([{ id: "g2", email: "lo@example.com" }]),
    });
    assert.equal(audit.eligibleUsers[0].role, "BROKER_OFFICER");
    assert.equal(audit.eligibleUsers[0].result, RECONCILE_RESULTS.MATCHED);
  });

  it("excludes SUB_BROKER", async () => {
    addUser({
      id: "admin1",
      email: "admin@example.com",
      roles: ["BROKER_ADMIN"],
    });
    addUser({
      id: "sb1",
      email: "co@example.com",
      roles: ["SUB_BROKER"],
    });
    setAgencyLocation();
    const audit = await auditOrganizationGhlAgencyUsers(prisma, {
      organizationId: "org1",
      client: mockClient([
        { id: "g1", email: "admin@example.com" },
        { id: "g2", email: "co@example.com" },
      ]),
    });
    assert.equal(audit.eligibleUsers.length, 1);
    assert.equal(audit.summary.SUB_BROKER_EXCLUDED, 1);
    assert.equal(audit.excludedSubBrokers[0].userId, "sb1");
  });

  it("email matching is case-insensitive", async () => {
    addUser({
      id: "lo1",
      email: "  Officer@Example.COM ",
      roles: ["BROKER_OFFICER"],
    });
    setAgencyLocation();
    const audit = await auditOrganizationGhlAgencyUsers(prisma, {
      organizationId: "org1",
      client: mockClient([{ id: "g1", email: "officer@example.com", name: "O" }]),
    });
    assert.equal(audit.eligibleUsers[0].result, RECONCILE_RESULTS.MATCHED);
    assert.equal(audit.eligibleUsers[0].email, "officer@example.com");
  });

  it("unmatched user is NOT_PROVISIONED", async () => {
    addUser({
      id: "lo1",
      email: "missing@example.com",
      roles: ["BROKER_OFFICER"],
    });
    setAgencyLocation();
    const audit = await auditOrganizationGhlAgencyUsers(prisma, {
      organizationId: "org1",
      client: mockClient([{ id: "g1", email: "other@example.com" }]),
    });
    assert.equal(
      audit.eligibleUsers[0].result,
      RECONCILE_RESULTS.NOT_PROVISIONED,
    );
    assert.equal(audit.summary.NOT_PROVISIONED, 1);
  });

  it("duplicate GHL email is AMBIGUOUS", async () => {
    addUser({
      id: "lo1",
      email: "dup@example.com",
      roles: ["BROKER_OFFICER"],
    });
    setAgencyLocation();
    const audit = await auditOrganizationGhlAgencyUsers(prisma, {
      organizationId: "org1",
      client: mockClient([
        { id: "g1", email: "dup@example.com" },
        { id: "g2", email: "DUP@example.com" },
      ]),
    });
    assert.equal(audit.eligibleUsers[0].result, RECONCILE_RESULTS.AMBIGUOUS);
    assert.equal(audit.summary.AMBIGUOUS, 1);
  });

  it("no POST/PUT/DELETE calls occur", async () => {
    addUser({
      id: "admin1",
      email: "admin@example.com",
      roles: ["BROKER_ADMIN"],
    });
    setAgencyLocation();
    const client = mockClient([{ id: "g1", email: "admin@example.com" }]);
    await auditOrganizationGhlAgencyUsers(prisma, {
      organizationId: "org1",
      client,
    });
    assert.deepEqual(
      ghlCalls.map((c) => c.method),
      ["GET"],
    );
    await assert.rejects(() => client.post("/users/", {}), /POST must never/);
    await assert.rejects(() => client.put("/users/x", {}), /PUT must never/);
    await assert.rejects(() => client.delete("/users/x"), /DELETE must never/);
  });

  it("no mapping is persisted by the diagnostic audit", async () => {
    addUser({
      id: "admin1",
      email: "admin@example.com",
      roles: ["BROKER_ADMIN"],
    });
    setAgencyLocation();
    const audit = await auditOrganizationGhlAgencyUsers(prisma, {
      organizationId: "org1",
      client: mockClient([{ id: "g1", email: "admin@example.com" }]),
    });
    assert.equal(audit.persisted, false);
    assert.equal(persistCalls, 0);
  });
});
