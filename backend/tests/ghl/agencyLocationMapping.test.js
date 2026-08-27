const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { applyPaymentEnv, reload, clearModule, stubCreateAgencyLocation } = require("./helpers");

const CONFIRMED_PRO_LOCATION_ID = "RQ3JZOrCXQUaIXK4FmYc";
const CONFIRMED_ELITE_LOCATION_ID = "gw2PojfvG909sYV8Hrk7";
const CONFIRMED_AGENCY_COMPANY_ID = "HtXpcMHxPGpsuhqe0uiM";
const PRO_SNAPSHOT = "snap_pro_template";
const ELITE_SNAPSHOT = "snap_elite_template";

const ACCOUNT_LOCATION_ENV = {
  GHL_AGENCY_COMPANY_ID: CONFIRMED_AGENCY_COMPANY_ID,
  GHL_PRO_LOCATION_ID: CONFIRMED_PRO_LOCATION_ID,
  GHL_ELITE_LOCATION_ID: CONFIRMED_ELITE_LOCATION_ID,
  GHL_PRO_SNAPSHOT_ID: PRO_SNAPSHOT,
  GHL_ELITE_SNAPSHOT_ID: ELITE_SNAPSHOT,
  GHL_AGENCY_PRIVATE_TOKEN: "pit-TESTONLY",
};

function createMemoryPrisma() {
  const rows = [];

  return {
    rows,
    organization: {
      async findUnique({ where }) {
        return {
          id: where.id,
          name: String(where.id),
          phone: null,
          email: null,
        };
      },
    },
    organizationGhlAgencyLocation: {
      async findUnique({ where }) {
        return (
          rows.find((r) => r.organizationId === where.organizationId) || null
        );
      },
      async upsert({ where, create, update }) {
        const idx = rows.findIndex(
          (r) => r.organizationId === where.organizationId,
        );
        if (idx === -1) {
          const row = {
            id: `map_${rows.length + 1}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastError: null,
            ...create,
          };
          rows.push(row);
          return { ...row };
        }
        rows[idx] = {
          ...rows[idx],
          ...update,
          updatedAt: new Date(),
        };
        return { ...rows[idx] };
      },
      async update({ where, data }) {
        const idx = rows.findIndex(
          (r) => r.organizationId === where.organizationId,
        );
        if (idx === -1) throw new Error("not found");
        rows[idx] = { ...rows[idx], ...data, updatedAt: new Date() };
        return { ...rows[idx] };
      },
      async updateMany({ where, data }) {
        let count = 0;
        for (let i = 0; i < rows.length; i += 1) {
          if (rows[i].organizationId === where.organizationId) {
            rows[i] = { ...rows[i], ...data, updatedAt: new Date() };
            count += 1;
          }
        }
        return { count };
      },
    },
    organizationSubscription: {
      async findUnique({ where, include }) {
        const sub = this._subs?.find((s) => s.id === where.id) || null;
        if (!sub) return null;
        if (include?.package) {
          return {
            ...sub,
            package: this._packages?.[sub.packageId] || { code: sub.packageCode },
          };
        }
        return sub;
      },
      _subs: [],
      _packages: {},
    },
  };
}

describe("Organization → dedicated Agency GHL location mapping", () => {
  let restore;
  let syncOrganizationAgencyLocation;
  let syncAgencyLocationForSubscription;
  let prisma;
  let createCalls;

  beforeEach(() => {
    restore = applyPaymentEnv(ACCOUNT_LOCATION_ENV);
    createCalls = [];
    stubCreateAgencyLocation(async ({ name, companyId, snapshotId }) => {
      createCalls.push({ name, companyId, snapshotId });
      return {
        locationId: `dedicated_${createCalls.length}_${name}`,
        companyId,
        snapshotId: snapshotId || null,
      };
    });
    clearModule("../../services/ghl/ghlAccountLocation.service");
    reload("../../services/ghl/ghlAccountLocation.service");
    ({
      syncOrganizationAgencyLocation,
      syncAgencyLocationForSubscription,
    } = reload("../../services/ghl/organizationGhlAgencyLocation.service"));
    prisma = createMemoryPrisma();
  });

  afterEach(() => {
    restore();
    clearModule("../../services/ghl/ghlAgencyLocationCreate.service");
    clearModule("../../services/ghl/organizationGhlAgencyLocation.service");
  });

  it("1. PRO organization creates a dedicated location (not the shared pool)", async () => {
    const result = await syncOrganizationAgencyLocation(prisma, {
      organizationId: "org_pro",
      packageCode: "PRO",
    });
    assert.equal(result.action, "created");
    assert.equal(result.mapping.status, "ACTIVE");
    assert.equal(result.mapping.packageCode, "PRO");
    assert.notEqual(result.mapping.ghlLocationId, CONFIRMED_PRO_LOCATION_ID);
    assert.equal(result.mapping.ghlCompanyId, CONFIRMED_AGENCY_COMPANY_ID);
    assert.equal(createCalls.length, 1);
    assert.equal(createCalls[0].snapshotId, PRO_SNAPSHOT);
    assert.equal(prisma.rows.length, 1);
  });

  it("2. ELITE organization creates a dedicated location with Elite snapshot", async () => {
    const result = await syncOrganizationAgencyLocation(prisma, {
      organizationId: "org_elite",
      packageCode: "ELITE",
    });
    assert.notEqual(result.mapping.ghlLocationId, CONFIRMED_ELITE_LOCATION_ID);
    assert.equal(result.mapping.packageCode, "ELITE");
    assert.equal(result.mapping.status, "ACTIVE");
    assert.equal(createCalls[0].snapshotId, ELITE_SNAPSHOT);
  });

  it("3. BASIC organization → no Agency GHL location", async () => {
    const result = await syncOrganizationAgencyLocation(prisma, {
      organizationId: "org_basic",
      packageCode: "BASIC",
    });
    assert.equal(result.action, "noop");
    assert.equal(result.mapping, null);
    assert.equal(prisma.rows.length, 0);
    assert.equal(createCalls.length, 0);
  });

  it("4. Two organizations get two different location IDs", async () => {
    const a = await syncOrganizationAgencyLocation(prisma, {
      organizationId: "org_a",
      packageCode: "PRO",
    });
    const b = await syncOrganizationAgencyLocation(prisma, {
      organizationId: "org_b",
      packageCode: "PRO",
    });
    assert.equal(createCalls.length, 2);
    assert.notEqual(a.mapping.ghlLocationId, b.mapping.ghlLocationId);
    assert.equal(prisma.rows.length, 2);
  });

  it("5. Webhook replay does not create a second location", async () => {
    await syncOrganizationAgencyLocation(prisma, {
      organizationId: "org_replay_pro",
      packageCode: "PRO",
    });
    const firstId = prisma.rows[0].ghlLocationId;
    const second = await syncOrganizationAgencyLocation(prisma, {
      organizationId: "org_replay_pro",
      packageCode: "PRO",
    });
    assert.equal(createCalls.length, 1);
    assert.equal(prisma.rows.length, 1);
    assert.equal(second.action, "unchanged");
    assert.equal(second.mapping.ghlLocationId, firstId);
  });

  it("6. PRO → ELITE keeps the same dedicated location", async () => {
    await syncOrganizationAgencyLocation(prisma, {
      organizationId: "org_upgrade",
      packageCode: "PRO",
    });
    const originalId = prisma.rows[0].ghlLocationId;
    const upgraded = await syncOrganizationAgencyLocation(prisma, {
      organizationId: "org_upgrade",
      packageCode: "ELITE",
    });
    assert.equal(createCalls.length, 1);
    assert.equal(prisma.rows.length, 1);
    assert.equal(upgraded.mapping.packageCode, "ELITE");
    assert.equal(upgraded.mapping.ghlLocationId, originalId);
    assert.equal(upgraded.mapping.status, "ACTIVE");
  });

  it("7. ELITE → PRO keeps the same dedicated location", async () => {
    await syncOrganizationAgencyLocation(prisma, {
      organizationId: "org_downgrade",
      packageCode: "ELITE",
    });
    const originalId = prisma.rows[0].ghlLocationId;
    const downgraded = await syncOrganizationAgencyLocation(prisma, {
      organizationId: "org_downgrade",
      packageCode: "PRO",
    });
    assert.equal(createCalls.length, 1);
    assert.equal(downgraded.mapping.packageCode, "PRO");
    assert.equal(downgraded.mapping.ghlLocationId, originalId);
  });

  it("BASIC after PRO deactivates mapping (does not delete GHL location)", async () => {
    await syncOrganizationAgencyLocation(prisma, {
      organizationId: "org_to_basic",
      packageCode: "PRO",
    });
    const originalId = prisma.rows[0].ghlLocationId;
    const result = await syncOrganizationAgencyLocation(prisma, {
      organizationId: "org_to_basic",
      packageCode: "BASIC",
    });
    assert.equal(result.action, "deactivated");
    assert.equal(result.mapping.status, "INACTIVE");
    assert.equal(result.mapping.ghlLocationId, originalId);
    assert.equal(prisma.rows.length, 1);
    assert.equal(createCalls.length, 1);
  });

  it("legacy shared-pool mapping is replaced with a dedicated location", async () => {
    prisma.rows.push({
      id: "map_pool",
      organizationId: "org_legacy",
      packageCode: "PRO",
      ghlCompanyId: CONFIRMED_AGENCY_COMPANY_ID,
      ghlLocationId: CONFIRMED_PRO_LOCATION_ID,
      status: "ACTIVE",
      assignedAt: new Date(),
      lastError: null,
    });
    const result = await syncOrganizationAgencyLocation(prisma, {
      organizationId: "org_legacy",
      packageCode: "PRO",
    });
    assert.equal(result.action, "created");
    assert.notEqual(result.mapping.ghlLocationId, CONFIRMED_PRO_LOCATION_ID);
    assert.equal(createCalls.length, 1);
  });

  it("8. Existing organization fulfillment path uses organizationId", async () => {
    const result = await syncAgencyLocationForSubscription(prisma, {
      organizationId: "org_existing",
      organizationSubscriptionId: "sub_1",
      packageCode: "PRO",
    });
    assert.equal(result.ok, true);
    assert.equal(result.mapping.organizationId, "org_existing");
    assert.ok(result.mapping.ghlLocationId);
    assert.notEqual(result.mapping.ghlLocationId, CONFIRMED_PRO_LOCATION_ID);
  });

  it("9. New organization fulfillment path uses organizationId", async () => {
    const result = await syncAgencyLocationForSubscription(prisma, {
      organizationId: "org_new",
      packageCode: "ELITE",
    });
    assert.equal(result.ok, true);
    assert.equal(result.mapping.organizationId, "org_new");
    assert.notEqual(result.mapping.ghlLocationId, CONFIRMED_ELITE_LOCATION_ID);
  });

  it("10. GHL mapping failure does not throw (subscription-safe)", async () => {
    stubCreateAgencyLocation(async () => {
      throw Object.assign(new Error("create boom GHL_AGENCY_PRIVATE_TOKEN=secret"), {
        code: "AGENCY_LOCATION_CREATE_FAILED",
      });
    });
    reload("../../services/ghl/ghlAccountLocation.service");
    ({ syncAgencyLocationForSubscription } = reload(
      "../../services/ghl/organizationGhlAgencyLocation.service",
    ));

    const result = await syncAgencyLocationForSubscription(prisma, {
      organizationId: "org_fail",
      packageCode: "PRO",
    });

    assert.equal(result.ok, false);
    assert.equal(result.action, "error");
    assert.match(result.code, /AGENCY_LOCATION_CREATE_FAILED/);
  });
});
