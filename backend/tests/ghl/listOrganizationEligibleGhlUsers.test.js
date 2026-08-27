const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { reload } = require("./helpers");

describe("listOrganizationEligibleGhlUsers (DB-only)", () => {
  let listOrganizationEligibleGhlUsers;
  let prisma;

  beforeEach(() => {
    ({ listOrganizationEligibleGhlUsers } = reload(
      "../../services/ghl/ghlAgencyUsers.service",
    ));

    prisma = {
      organization: {
        async findUnique({ where }) {
          if (where.id === "org_1") {
            return { id: "org_1", name: "Demo Broker" };
          }
          return null;
        },
      },
      userAccount: {
        async findMany() {
          return [
            {
              id: "11111111-1111-1111-1111-111111111111",
              firstName: "Ada",
              lastName: "Admin",
              email: "Admin@Example.com",
              roles: [{ role: { name: "BROKER_ADMIN" } }],
            },
            {
              id: "22222222-2222-2222-2222-222222222222",
              firstName: "Loan",
              lastName: "Officer",
              email: "lo@example.com",
              roles: [{ role: { name: "BROKER_OFFICER" } }],
            },
            {
              id: "33333333-3333-3333-3333-333333333333",
              firstName: "Co",
              lastName: "Broker",
              email: "co@example.com",
              roles: [{ role: { name: "SUB_BROKER" } }],
            },
            {
              id: "44444444-4444-4444-4444-444444444444",
              firstName: "Other",
              lastName: "Role",
              email: "other@example.com",
              roles: [{ role: { name: "LENDER_ADMIN" } }],
            },
          ];
        },
      },
    };
  });

  it("returns only BROKER_ADMIN and BROKER_OFFICER with safe fields", async () => {
    const result = await listOrganizationEligibleGhlUsers(prisma, {
      organizationId: "org_1",
    });

    assert.equal(result.organizationName, "Demo Broker");
    assert.equal(result.users.length, 2);
    assert.equal(result.excludedSubBrokerCount, 1);
    assert.deepEqual(
      result.users.map((u) => u.role).sort(),
      ["BROKER_ADMIN", "BROKER_OFFICER"],
    );
    assert.equal(result.users[0].email, "admin@example.com");
    assert.equal(result.users[0].id, "11111111-1111-1111-1111-111111111111");
    assert.ok(!("passwordHash" in result.users[0]));
  });

  it("excludes SUB_BROKER", async () => {
    const result = await listOrganizationEligibleGhlUsers(prisma, {
      organizationId: "org_1",
    });
    assert.equal(
      result.users.some((u) => u.role === "SUB_BROKER"),
      false,
    );
  });

  it("requires organizationId", async () => {
    const result = await listOrganizationEligibleGhlUsers(prisma, {});
    assert.equal(result.users.length, 0);
    assert.match(result.reason, /organizationId/i);
  });
});
