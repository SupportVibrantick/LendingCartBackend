/**
 * Admin plan change → OrganizationGhlAgencyLocation sync.
 * No GHL API calls — env resolver only.
 */
const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { applyPaymentEnv, reload, clearModule, stubCreateAgencyLocation } = require("./helpers");

const PRO_LOC = "RQ3JZOrCXQUaIXK4FmYc";
const ELITE_LOC = "gw2PojfvG909sYV8Hrk7";
const COMPANY = "HtXpcMHxPGpsuhqe0uiM";
const DEDICATED_LOC = "org1DedicatedLoc99";

const ENV = {
  GHL_AGENCY_COMPANY_ID: COMPANY,
  GHL_PRO_LOCATION_ID: PRO_LOC,
  GHL_ELITE_LOCATION_ID: ELITE_LOC,
  GHL_AGENCY_PRIVATE_TOKEN: "pit-TESTONLY",
  GHL_PRO_SNAPSHOT_ID: "snap_pro",
  GHL_ELITE_SNAPSHOT_ID: "snap_elite",
};

describe("Admin plan change → Agency GHL location sync", () => {
  let restore;
  let changePlan;
  let assignPlanToOrganization;
  let syncOrganizationAgencyLocation;
  let agencyRows;
  let ghlHttpCalls;
  let loggedErrors;
  let prisma;

  beforeEach(() => {
    restore = applyPaymentEnv(ENV);
    agencyRows = [];
    ghlHttpCalls = [];
    loggedErrors = [];

    clearModule("../../services/logger/contextLogger");
    clearModule("../../services/ghl/ghlAccountLocation.service");
    clearModule("../../services/ghl/organizationGhlAgencyLocation.service");
    clearModule("../../services/subscription/subscriptionBilling");

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
    stubCreateAgencyLocation(async ({ companyId, snapshotId }) => {
      ghlHttpCalls.push({ method: "POST", url: "/locations/", snapshotId });
      return {
        locationId: `created_${ghlHttpCalls.filter((c) => c.method === "POST").length}`,
        companyId,
        snapshotId: snapshotId || null,
      };
    });
    ({ syncOrganizationAgencyLocation } = reload(
      "../../services/ghl/organizationGhlAgencyLocation.service",
    ));
    ({ changePlan, assignPlanToOrganization } = reload(
      "../../services/subscription/subscriptionBilling",
    ));

    prisma = buildPrisma();
  });

  afterEach(() => {
    restore();
    clearModule("../../services/logger/contextLogger");
    clearModule("../../services/ghl/ghlAccountLocation.service");
    clearModule("../../services/ghl/organizationGhlAgencyLocation.service");
    clearModule("../../services/subscription/subscriptionBilling");
  });

  function buildPrisma() {
    const packages = {
      pkg_pro: {
        id: "pkg_pro",
        code: "PRO",
        isActive: true,
        name: "Pro",
        usageLimits: {},
        priceMonthly: 99,
        priceYearly: 990,
      },
      pkg_elite: {
        id: "pkg_elite",
        code: "ELITE",
        isActive: true,
        name: "Elite",
        usageLimits: {},
        priceMonthly: 199,
        priceYearly: 1990,
      },
      pkg_basic: {
        id: "pkg_basic",
        code: "BASIC",
        isActive: true,
        name: "Basic",
        usageLimits: {},
        priceMonthly: 0,
        priceYearly: 0,
      },
    };

    const periodStart = new Date("2026-01-01T00:00:00.000Z");
    const periodEnd = new Date("2026-02-01T00:00:00.000Z");
    let sub = {
      id: "sub_1",
      organizationId: "org_1",
      packageId: "pkg_pro",
      billingCycle: "MONTHLY",
      status: "ACTIVE",
      notes: null,
      assignedByAdminId: null,
      purchasedAddOns: null,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      priceMonthly: 99,
      package: { ...packages.pkg_pro, priceMonthly: 99, priceYearly: 990 },
    };

    return {
      _getSub: () => sub,
      _setSub: (next) => {
        sub = next;
      },
      organization: {
        async findUnique({ where }) {
          if (where.id === "org_1") {
            return { id: "org_1", type: "BROKER", name: "Demo" };
          }
          return null;
        },
      },
      subscriptionPackage: {
        async findFirst({ where }) {
          const pkg = packages[where.id];
          if (!pkg || (where.isActive && !pkg.isActive)) return null;
          return pkg;
        },
      },
      organizationSubscription: {
        async findFirst() {
          return { ...sub, package: packages[sub.packageId] };
        },
        async create({ data, include }) {
          sub = {
            id: "sub_assigned",
            purchasedAddOns: null,
            ...data,
            package: packages[data.packageId],
            organization: { id: data.organizationId },
          };
          return include ? { ...sub } : sub;
        },
        async update({ where, data, include }) {
          sub = {
            ...sub,
            id: where.id,
            ...data,
            package: packages[data.packageId || sub.packageId],
            organization: { id: sub.organizationId },
          };
          return include ? { ...sub } : sub;
        },
        async findUnique({ where, include }) {
          if (where.id !== sub.id && where.id !== "sub_assigned") return null;
          return {
            ...sub,
            id: where.id === "sub_assigned" ? "sub_assigned" : sub.id,
            package: include?.package ? packages[sub.packageId] : packages[sub.packageId],
          };
        },
      },
      loanApplication: {
        async count() {
          return 0;
        },
      },
      userAccount: {
        async count() {
          return 0;
        },
      },
      userRole: {
        async count() {
          return 0;
        },
      },
      brokerLenderAccess: {
        async count() {
          return 0;
        },
      },
      subscriptionUsage: {
        async deleteMany() {
          return { count: 0 };
        },
        async create() {
          return {};
        },
        async createMany() {
          return { count: 0 };
        },
        async upsert() {
          return {};
        },
      },
      subscriptionInvoice: {
        async findFirst() {
          return null;
        },
        async findUnique() {
          return null;
        },
        async create({ data }) {
          return { id: "inv_1", ...data };
        },
      },
      role: {
        async findFirst() {
          return { id: "role_officer", name: "BROKER_OFFICER" };
        },
      },
      $queryRaw: async () => [{ acquired: true }],
      $executeRaw: async () => 1,
      $executeRawUnsafe: async () => 1,
      $transaction: async (fn) => fn(prisma),
      organizationGhlAgencyLocation: {
        async findUnique({ where }) {
          return (
            agencyRows.find((r) => r.organizationId === where.organizationId) ||
            null
          );
        },
        async upsert({ where, create, update }) {
          ghlHttpCalls.push({ method: "DB_UPSERT" });
          const idx = agencyRows.findIndex(
            (r) => r.organizationId === where.organizationId,
          );
          if (idx === -1) {
            const row = {
              id: `map_${agencyRows.length + 1}`,
              createdAt: new Date(),
              updatedAt: new Date(),
              lastError: null,
              ...create,
            };
            agencyRows.push(row);
            return { ...row };
          }
          agencyRows[idx] = { ...agencyRows[idx], ...update, updatedAt: new Date() };
          return { ...agencyRows[idx] };
        },
        async update({ where, data }) {
          const idx = agencyRows.findIndex(
            (r) => r.organizationId === where.organizationId,
          );
          agencyRows[idx] = { ...agencyRows[idx], ...data };
          return { ...agencyRows[idx] };
        },
        async updateMany({ where, data }) {
          let count = 0;
          for (let i = 0; i < agencyRows.length; i += 1) {
            if (agencyRows[i].organizationId === where.organizationId) {
              agencyRows[i] = { ...agencyRows[i], ...data };
              count += 1;
            }
          }
          return { count };
        },
      },
    };
  }

  function seedActiveMapping(packageCode, locationId = DEDICATED_LOC) {
    agencyRows.push({
      id: "map_1",
      organizationId: "org_1",
      packageCode,
      ghlCompanyId: COMPANY,
      ghlLocationId: locationId,
      status: "ACTIVE",
      assignedAt: new Date("2026-01-01"),
      lastError: null,
    });
  }

  it("1. PRO -> ELITE keeps the same dedicated location", async () => {
    seedActiveMapping("PRO");
    const result = await changePlan(prisma, {
      organizationId: "org_1",
      packageId: "pkg_elite",
      billingCycle: "MONTHLY",
    });
    assert.equal(result.subscription.package.code, "ELITE");
    assert.equal(agencyRows.length, 1);
    assert.equal(agencyRows[0].packageCode, "ELITE");
    assert.equal(agencyRows[0].ghlLocationId, DEDICATED_LOC);
    assert.equal(agencyRows[0].ghlCompanyId, COMPANY);
    assert.equal(agencyRows[0].status, "ACTIVE");
  });

  it("2. ELITE -> PRO keeps the same dedicated location", async () => {
    prisma._setSub({
      ...prisma._getSub(),
      packageId: "pkg_elite",
      package: { id: "pkg_elite", code: "ELITE", isActive: true },
    });
    seedActiveMapping("ELITE");
    await changePlan(prisma, {
      organizationId: "org_1",
      packageId: "pkg_pro",
    });
    assert.equal(agencyRows[0].packageCode, "PRO");
    assert.equal(agencyRows[0].ghlLocationId, DEDICATED_LOC);
    assert.equal(agencyRows[0].status, "ACTIVE");
  });

  it("3. PRO -> BASIC deactivates mapping", async () => {
    seedActiveMapping("PRO");
    await changePlan(prisma, {
      organizationId: "org_1",
      packageId: "pkg_basic",
    });
    assert.equal(agencyRows.length, 1);
    assert.equal(agencyRows[0].status, "INACTIVE");
    assert.equal(agencyRows[0].ghlLocationId, DEDICATED_LOC);
  });

  it("4. ELITE -> BASIC deactivates mapping", async () => {
    prisma._setSub({
      ...prisma._getSub(),
      packageId: "pkg_elite",
      package: { id: "pkg_elite", code: "ELITE", isActive: true },
    });
    seedActiveMapping("ELITE");
    await changePlan(prisma, {
      organizationId: "org_1",
      packageId: "pkg_basic",
    });
    assert.equal(agencyRows[0].status, "INACTIVE");
  });

  it("5. BASIC -> PRO creates/reactivates Pro mapping", async () => {
    prisma._setSub({
      ...prisma._getSub(),
      packageId: "pkg_basic",
      package: { id: "pkg_basic", code: "BASIC", isActive: true },
    });
    agencyRows.push({
      id: "map_1",
      organizationId: "org_1",
      packageCode: "PRO",
      ghlCompanyId: COMPANY,
      ghlLocationId: DEDICATED_LOC,
      status: "INACTIVE",
      assignedAt: new Date("2026-01-01"),
      lastError: null,
    });
    await changePlan(prisma, {
      organizationId: "org_1",
      packageId: "pkg_pro",
    });
    assert.equal(agencyRows.length, 1);
    assert.equal(agencyRows[0].status, "ACTIVE");
    assert.equal(agencyRows[0].packageCode, "PRO");
    assert.equal(agencyRows[0].ghlLocationId, DEDICATED_LOC);
  });

  it("6. BASIC -> ELITE creates/reactivates Elite mapping", async () => {
    prisma._setSub({
      ...prisma._getSub(),
      packageId: "pkg_basic",
      package: { id: "pkg_basic", code: "BASIC", isActive: true },
    });
    await changePlan(prisma, {
      organizationId: "org_1",
      packageId: "pkg_elite",
    });
    assert.equal(agencyRows.length, 1);
    assert.equal(agencyRows[0].status, "ACTIVE");
    assert.equal(agencyRows[0].packageCode, "ELITE");
    assert.equal(agencyRows[0].ghlLocationId, "created_1");
  });

  it("7. PRO -> PRO keeps ACTIVE without duplicate mapping", async () => {
    seedActiveMapping("PRO");
    const beforeAssignedAt = agencyRows[0].assignedAt;
    const result = await changePlan(prisma, {
      organizationId: "org_1",
      packageId: "pkg_pro",
    });
    assert.equal(result.agencyLocation.action, "unchanged");
    assert.equal(agencyRows.length, 1);
    assert.equal(agencyRows[0].status, "ACTIVE");
    assert.equal(agencyRows[0].ghlLocationId, DEDICATED_LOC);
    assert.equal(agencyRows[0].assignedAt, beforeAssignedAt);
  });

  it("8. ELITE -> ELITE keeps ACTIVE without duplicate mapping", async () => {
    prisma._setSub({
      ...prisma._getSub(),
      packageId: "pkg_elite",
      package: { id: "pkg_elite", code: "ELITE", isActive: true },
    });
    seedActiveMapping("ELITE");
    const result = await changePlan(prisma, {
      organizationId: "org_1",
      packageId: "pkg_elite",
    });
    assert.equal(result.agencyLocation.action, "unchanged");
    assert.equal(agencyRows.length, 1);
    assert.equal(agencyRows[0].status, "ACTIVE");
  });

  it("9. Mapping sync failure does not roll back plan change", async () => {
    stubCreateAgencyLocation(async () => {
      throw Object.assign(new Error("create failed"), {
        code: "AGENCY_LOCATION_CREATE_FAILED",
      });
    });
    reload("../../services/ghl/ghlAccountLocation.service");
    reload("../../services/ghl/organizationGhlAgencyLocation.service");
    ({ changePlan } = reload("../../services/subscription/subscriptionBilling"));

    const result = await changePlan(prisma, {
      organizationId: "org_1",
      packageId: "pkg_elite",
    });

    assert.equal(result.subscription.packageId, "pkg_elite");
    assert.equal(result.subscription.status, "ACTIVE");
    assert.equal(result.agencyLocation.ok, false);
  });

  it("10. Existing dedicated mapping plan change does not POST a new location", async () => {
    seedActiveMapping("PRO");
    await changePlan(prisma, {
      organizationId: "org_1",
      packageId: "pkg_elite",
    });
    assert.equal(
      ghlHttpCalls.filter((c) => ["POST", "PUT", "DELETE"].includes(c.method))
        .length,
      0,
    );
  });

  it("11. No duplicate mapping on repeated changePlan", async () => {
    seedActiveMapping("PRO");
    await changePlan(prisma, {
      organizationId: "org_1",
      packageId: "pkg_elite",
    });
    await changePlan(prisma, {
      organizationId: "org_1",
      packageId: "pkg_elite",
    });
    assert.equal(agencyRows.length, 1);
  });

  it("12. Error logs never expose Agency PIT / Bearer / pit- tokens", async () => {
    const result = await syncOrganizationAgencyLocation(prisma, {
      organizationId: "org_1",
      packageCode: "PRO",
    });
    assert.ok(result);

    // Simulate failure path through syncAgencyLocationForSubscription.
    const {
      syncAgencyLocationForSubscription,
    } = require("../../services/ghl/organizationGhlAgencyLocation.service");
    const badPrisma = {
      ...prisma,
      organizationGhlAgencyLocation: {
        ...prisma.organizationGhlAgencyLocation,
        async findUnique() {
          throw new Error(
            "boom GHL_AGENCY_PRIVATE_TOKEN=secret Bearer abc.def.ghi pit-ABCDEFG123",
          );
        },
        async updateMany() {
          return { count: 0 };
        },
      },
    };
    await syncAgencyLocationForSubscription(badPrisma, {
      organizationId: "org_1",
      packageCode: "PRO",
    });

    const blob = JSON.stringify(loggedErrors);
    assert.doesNotMatch(blob, /GHL_AGENCY_PRIVATE_TOKEN=secret/);
    assert.doesNotMatch(blob, /Bearer abc\.def\.ghi/);
    assert.doesNotMatch(blob, /pit-ABCDEFG123/);
    assert.match(blob, /\[REDACTED\]/);
  });

  it("assignPlanToOrganization also syncs Agency location for PRO", async () => {
    prisma._setSub({
      id: "gone",
      organizationId: "org_1",
      packageId: "pkg_pro",
      status: "CANCELLED",
      billingCycle: "MONTHLY",
      package: { id: "pkg_pro", code: "PRO", isActive: true },
    });
    // findFirst returns active only — force no active sub by returning null via override.
    prisma.organizationSubscription.findFirst = async () => null;

    const result = await assignPlanToOrganization(prisma, {
      organizationId: "org_1",
      packageId: "pkg_pro",
      billingCycle: "MONTHLY",
      trialDays: 0,
      generateInvoice: false,
    });

    assert.equal(result.subscription.status, "ACTIVE");
    assert.equal(agencyRows.length, 1);
    assert.equal(agencyRows[0].ghlLocationId, "created_1");
    assert.equal(agencyRows[0].status, "ACTIVE");
  });

  it("source: changePlan and assignPlanToOrganization call Agency sync", () => {
    const billingPath = path.join(
      __dirname,
      "../../services/subscription/subscriptionBilling.js",
    );
    const src = fs.readFileSync(billingPath, "utf8");
    assert.match(src, /syncAgencyLocationAfterPlanChange/);
    const changeStart = src.indexOf("async function changePlan");
    const cancelStart = src.indexOf("async function cancelSubscription");
    const assignStart = src.indexOf("async function assignPlanToOrganization");
    assert.match(src.slice(changeStart, cancelStart), /syncAgencyLocationAfterPlanChange/);
    assert.match(src.slice(assignStart, changeStart), /syncAgencyLocationAfterPlanChange/);
  });
});
