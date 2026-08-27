const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { reload } = require("./helpers");

describe("GHL Agency user reconciliation (read-only)", () => {
  let isGhlEligibleLendingCartRole;
  let normalizeEmail;
  let normalizeGhlAgencyUser;
  let reconcileOrganizationGhlAgencyUser;
  let RECONCILE_RESULTS;
  let ghlCalls;
  let prisma;

  beforeEach(() => {
    ghlCalls = [];
    ({
      isGhlEligibleLendingCartRole,
      normalizeEmail,
      normalizeGhlAgencyUser,
      reconcileOrganizationGhlAgencyUser,
      RECONCILE_RESULTS,
    } = reload("../../services/ghl/ghlAgencyUsers.service"));

    prisma = {
      userAccount: {
        async findUnique({ where }) {
          return this._users[where.id] || null;
        },
        _users: {},
      },
      organizationGhlAgencyLocation: {
        async findUnique({ where }) {
          return this._byOrg[where.organizationId] || null;
        },
        _byOrg: {},
      },
    };
  });

  afterEach(() => {});

  function mockClient(users) {
    return {
      async get(url, config) {
        ghlCalls.push({
          method: "GET",
          url,
          params: config?.params || null,
        });
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
      async patch() {
        throw new Error("GHL write PATCH must never be called");
      },
    };
  }

  function setUser({ id, organizationId, email, roles, isDeleted = false }) {
    prisma.userAccount._users[id] = {
      id,
      organizationId,
      email,
      isDeleted,
      roles: roles.map((name) => ({ role: { name } })),
    };
  }

  function setAgencyLocation(organizationId, overrides = {}) {
    prisma.organizationGhlAgencyLocation._byOrg[organizationId] = {
      organizationId,
      ghlLocationId: "RQ3JZOrCXQUaIXK4FmYc",
      ghlCompanyId: "HtXpcMHxPGpsuhqe0uiM",
      status: "ACTIVE",
      packageCode: "PRO",
      ...overrides,
    };
  }

  it("1. BROKER_ADMIN is eligible", () => {
    assert.equal(isGhlEligibleLendingCartRole("BROKER_ADMIN"), true);
  });

  it("2. BROKER_OFFICER is eligible", () => {
    assert.equal(isGhlEligibleLendingCartRole("BROKER_OFFICER"), true);
  });

  it("3. SUB_BROKER is rejected", () => {
    assert.equal(isGhlEligibleLendingCartRole("SUB_BROKER"), false);
  });

  it("4. Unknown role is rejected", () => {
    assert.equal(isGhlEligibleLendingCartRole("LENDER_ADMIN"), false);
    assert.equal(isGhlEligibleLendingCartRole(""), false);
    assert.equal(isGhlEligibleLendingCartRole(null), false);
  });

  it("5. Email matching is case-insensitive", () => {
    assert.equal(normalizeEmail("User@Example.COM"), "user@example.com");
    const u = normalizeGhlAgencyUser({
      id: "g1",
      email: "User@Example.COM",
    });
    assert.equal(u.email, "user@example.com");
  });

  it("6. Email matching trims whitespace", () => {
    assert.equal(normalizeEmail("  user@example.com  "), "user@example.com");
  });

  it("7. Existing GHL user returns MATCHED", async () => {
    setUser({
      id: "u1",
      organizationId: "org1",
      email: "officer@example.com",
      roles: ["BROKER_OFFICER"],
    });
    setAgencyLocation("org1");

    const result = await reconcileOrganizationGhlAgencyUser(prisma, {
      organizationId: "org1",
      userId: "u1",
      client: mockClient([
        {
          id: "ghl_1",
          email: "Officer@Example.com",
          name: "Officer One",
          deleted: false,
        },
      ]),
    });

    assert.equal(result.result, RECONCILE_RESULTS.MATCHED);
    assert.equal(result.ghlUser.userId, "ghl_1");
    assert.equal(result.ghlApiCalled, true);
    assert.equal(ghlCalls.length, 1);
    assert.equal(ghlCalls[0].method, "GET");
  });

  it("8. Missing GHL user returns NOT_PROVISIONED", async () => {
    setUser({
      id: "u2",
      organizationId: "org1",
      email: "missing@example.com",
      roles: ["BROKER_ADMIN"],
    });
    setAgencyLocation("org1");

    const result = await reconcileOrganizationGhlAgencyUser(prisma, {
      organizationId: "org1",
      userId: "u2",
      client: mockClient([{ id: "ghl_x", email: "other@example.com" }]),
    });

    assert.equal(result.result, RECONCILE_RESULTS.NOT_PROVISIONED);
    assert.equal(result.ghlApiCalled, true);
  });

  it("9. Multiple matching GHL users returns AMBIGUOUS", async () => {
    setUser({
      id: "u3",
      organizationId: "org1",
      email: "dup@example.com",
      roles: ["BROKER_OFFICER"],
    });
    setAgencyLocation("org1");

    const result = await reconcileOrganizationGhlAgencyUser(prisma, {
      organizationId: "org1",
      userId: "u3",
      client: mockClient([
        { id: "ghl_a", email: "dup@example.com" },
        { id: "ghl_b", email: " DUP@example.com " },
      ]),
    });

    assert.equal(result.result, RECONCILE_RESULTS.AMBIGUOUS);
    assert.equal(result.matches.length, 2);
  });

  it("10. Missing Agency location returns NOT_CONFIGURED", async () => {
    setUser({
      id: "u4",
      organizationId: "org_none",
      email: "admin@example.com",
      roles: ["BROKER_ADMIN"],
    });

    const result = await reconcileOrganizationGhlAgencyUser(prisma, {
      organizationId: "org_none",
      userId: "u4",
      client: mockClient([{ id: "ghl_1", email: "admin@example.com" }]),
    });

    assert.equal(result.result, RECONCILE_RESULTS.NOT_CONFIGURED);
    assert.equal(result.ghlApiCalled, false);
    assert.equal(ghlCalls.length, 0);
  });

  it("11. No GHL API call happens for SUB_BROKER", async () => {
    setUser({
      id: "u5",
      organizationId: "org1",
      email: "cobroker@example.com",
      roles: ["SUB_BROKER"],
    });
    setAgencyLocation("org1");

    const result = await reconcileOrganizationGhlAgencyUser(prisma, {
      organizationId: "org1",
      userId: "u5",
      client: mockClient([{ id: "ghl_1", email: "cobroker@example.com" }]),
    });

    assert.equal(result.result, RECONCILE_RESULTS.NOT_ELIGIBLE);
    assert.match(result.reason, /SUB_BROKER/);
    assert.equal(result.ghlApiCalled, false);
    assert.equal(ghlCalls.length, 0);
  });

  it("12. No GHL write method is called anywhere", async () => {
    setUser({
      id: "u6",
      organizationId: "org1",
      email: "admin@example.com",
      roles: ["BROKER_ADMIN"],
    });
    setAgencyLocation("org1");

    const client = mockClient([
      { id: "ghl_1", email: "admin@example.com", name: "Admin" },
    ]);

    await reconcileOrganizationGhlAgencyUser(prisma, {
      organizationId: "org1",
      userId: "u6",
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
});
