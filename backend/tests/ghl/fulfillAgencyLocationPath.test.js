/**
 * Path verification: paid checkout fulfillment → OrganizationGhlAgencyLocation.
 * Uses mocked checkout/payment data only — no real GHL payment or writes.
 */
const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { applyPaymentEnv, reload, clearModule, stubCreateAgencyLocation } = require("./helpers");

const PRO_LOC = "RQ3JZOrCXQUaIXK4FmYc";
const ELITE_LOC = "gw2PojfvG909sYV8Hrk7";
const COMPANY = "HtXpcMHxPGpsuhqe0uiM";

const ACCOUNT_LOCATION_ENV = {
  GHL_AGENCY_COMPANY_ID: COMPANY,
  GHL_PRO_LOCATION_ID: PRO_LOC,
  GHL_ELITE_LOCATION_ID: ELITE_LOC,
  GHL_AGENCY_PRIVATE_TOKEN: "pit-TESTONLY",
  GHL_PRO_SNAPSHOT_ID: "snap_pro",
  GHL_ELITE_SNAPSHOT_ID: "snap_elite",
};

describe("Fulfillment → Agency GHL location path (A–H)", () => {
  let restore;
  let fulfillPaidGhlCheckout;
  let agencyRows;
  let checkoutRow;
  let subRow;
  let userRow;
  let packageRow;
  let provisionCalls;
  let assignPlanCalls;
  let changePlanCalls;
  let syncThrows;
  let loggedErrors;
  let createSeq;

  beforeEach(() => {
    restore = applyPaymentEnv(ACCOUNT_LOCATION_ENV);
    agencyRows = [];
    provisionCalls = 0;
    assignPlanCalls = 0;
    changePlanCalls = 0;
    syncThrows = false;
    loggedErrors = [];
    createSeq = 0;

    packageRow = { id: "pkg_pro", code: "PRO" };
    userRow = {
      id: "user_1",
      email: "broker@example.com",
      firstName: "Ada",
      lastName: "Broker",
      brokerOrganizationId: null,
    };
    subRow = {
      id: "sub_1",
      organizationId: "org_existing",
      packageId: "pkg_pro",
      billingCycle: "MONTHLY",
      status: "ACTIVE",
    };
    checkoutRow = {
      id: "chk_1",
      status: "CHECKOUT_CREATED",
      paymentStatus: "PENDING",
      loanAiUserId: "user_1",
      packageId: "pkg_pro",
      billingCycle: "MONTHLY",
      organizationSubscriptionId: null,
      ghlContactId: null,
      ghlInvoiceId: null,
      ghlSubscriptionId: null,
      ghlProductId: null,
      ghlPriceId: null,
      amount: 399,
      currency: "USD",
    };

    clearModule("../../services/subscription/subscriptionBilling");
    clearModule("../../services/broker/provisionBrokerFromLoanAi");
    clearModule("../../services/ghl/ghlPaymentLogger");
    clearModule("../../services/logger/contextLogger");
    clearModule("../../services/ghl/organizationGhlAgencyLocation.service");
    clearModule("../../services/ghl/ghlAccountLocation.service");
    clearModule("../../services/ghl/fulfillGhlCheckout");

    require.cache[require.resolve("../../services/subscription/subscriptionBilling")] = {
      id: require.resolve("../../services/subscription/subscriptionBilling"),
      filename: require.resolve("../../services/subscription/subscriptionBilling"),
      loaded: true,
      exports: {
        assignPlanToOrganization: async (_prisma, payload) => {
          assignPlanCalls += 1;
          subRow = {
            id: "sub_assigned",
            organizationId: payload.organizationId,
            packageId: payload.packageId,
            billingCycle: payload.billingCycle,
            status: "ACTIVE",
          };
          return {
            subscription: { id: subRow.id },
            invoice: { id: "inv_1" },
          };
        },
        markInvoicePaid: async (_prisma, id) => ({ id }),
        changePlan: async (_prisma, payload) => {
          changePlanCalls += 1;
          subRow = {
            ...subRow,
            packageId: payload.packageId,
            billingCycle: payload.billingCycle,
          };
          return { id: subRow.id };
        },
      },
    };

    require.cache[require.resolve("../../services/broker/provisionBrokerFromLoanAi")] = {
      id: require.resolve("../../services/broker/provisionBrokerFromLoanAi"),
      filename: require.resolve("../../services/broker/provisionBrokerFromLoanAi"),
      loaded: true,
      exports: {
        provisionBrokerFromLoanAi: async () => {
          provisionCalls += 1;
          userRow.brokerOrganizationId = "org_new";
          subRow = {
            id: "sub_new",
            organizationId: "org_new",
            packageId: packageRow.id,
            billingCycle: checkoutRow.billingCycle,
            status: "ACTIVE",
          };
          return {
            organizationId: "org_new",
            userId: "admin_1",
            subscriptionId: "sub_new",
            invoiceId: "inv_new",
          };
        },
      },
    };

    require.cache[require.resolve("../../services/ghl/ghlPaymentLogger")] = {
      id: require.resolve("../../services/ghl/ghlPaymentLogger"),
      filename: require.resolve("../../services/ghl/ghlPaymentLogger"),
      loaded: true,
      exports: {
        logPaymentStatusChanged: () => {},
      },
    };

    // Capture safe agency sync error logs (no secrets).
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
          error: (event, payload) => {
            loggedErrors.push({ event, payload });
          },
        },
      },
    };

    reload("../../services/ghl/ghlAccountLocation.service");
    stubCreateAgencyLocation(async ({ companyId, snapshotId }) => {
      if (syncThrows) {
        throw new Error("simulated agency mapping failure");
      }
      createSeq += 1;
      return {
        locationId: `dedicated_${createSeq}`,
        companyId,
        snapshotId: snapshotId || null,
      };
    });
    reload("../../services/ghl/organizationGhlAgencyLocation.service");
    ({ fulfillPaidGhlCheckout } = reload("../../services/ghl/fulfillGhlCheckout"));
  });

  afterEach(() => {
    restore();
    clearModule("../../services/subscription/subscriptionBilling");
    clearModule("../../services/broker/provisionBrokerFromLoanAi");
    clearModule("../../services/ghl/ghlPaymentLogger");
    clearModule("../../services/logger/contextLogger");
    clearModule("../../services/ghl/organizationGhlAgencyLocation.service");
    clearModule("../../services/ghl/ghlAccountLocation.service");
    clearModule("../../services/ghl/fulfillGhlCheckout");
  });

  function buildPrisma(overrides = {}) {
    return {
      loanAiGhlCheckout: {
        async findUnique() {
          return {
            ...checkoutRow,
            loanAiUser: { ...userRow },
            package: { ...packageRow },
            organizationSubscription: checkoutRow.organizationSubscriptionId
              ? {
                  ...subRow,
                  id: checkoutRow.organizationSubscriptionId,
                  organizationId: subRow.organizationId,
                }
              : null,
          };
        },
        async update({ data }) {
          checkoutRow = { ...checkoutRow, ...data };
          return { ...checkoutRow };
        },
      },
      organizationSubscription: {
        async findFirst() {
          if (overrides.existingSub !== undefined) return overrides.existingSub;
          if (!userRow.brokerOrganizationId) return null;
          return { ...subRow };
        },
        async update({ where, data }) {
          subRow = { ...subRow, id: where.id, ...data };
          return { ...subRow };
        },
        async findUnique({ where }) {
          if (where.id === subRow.id || where.id === "sub_new" || where.id === "sub_assigned") {
            return {
              ...subRow,
              id: where.id,
              package: packageRow,
            };
          }
          return null;
        },
        async count() {
          return subRow?.id ? 1 : 0;
        },
      },
      subscriptionInvoice: {
        async findFirst() {
          return null;
        },
        async update({ where, data }) {
          return { id: where.id, ...data };
        },
      },
      organizationGhlAgencyLocation: {
        async findUnique({ where }) {
          return (
            agencyRows.find((r) => r.organizationId === where.organizationId) ||
            null
          );
        },
        async upsert({ where, create, update }) {
          if (syncThrows) {
            throw new Error("simulated agency mapping failure with GHL_AGENCY_PRIVATE_TOKEN=secret");
          }
          const idx = agencyRows.findIndex(
            (r) => r.organizationId === where.organizationId,
          );
          if (idx === -1) {
            const row = {
              id: `map_${agencyRows.length + 1}`,
              lastError: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              ...create,
            };
            agencyRows.push(row);
            return { ...row };
          }
          agencyRows[idx] = {
            ...agencyRows[idx],
            ...update,
            updatedAt: new Date(),
          };
          return { ...agencyRows[idx] };
        },
        async update({ where, data }) {
          const idx = agencyRows.findIndex(
            (r) => r.organizationId === where.organizationId,
          );
          if (idx === -1) throw new Error("not found");
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

  function assertMapping({ organizationId, packageCode, ghlLocationId }) {
    assert.equal(agencyRows.length, 1);
    assert.equal(agencyRows[0].organizationId, organizationId);
    assert.equal(agencyRows[0].packageCode, packageCode);
    assert.equal(agencyRows[0].ghlCompanyId, COMPANY);
    assert.equal(agencyRows[0].ghlLocationId, ghlLocationId);
    assert.equal(agencyRows[0].status, "ACTIVE");
  }

  it("A. NEW BROKER + PRO creates ACTIVE Pro Agency mapping", async () => {
    userRow.brokerOrganizationId = null;
    packageRow = { id: "pkg_pro", code: "PRO" };
    checkoutRow.packageId = "pkg_pro";
    const prisma = buildPrisma({ existingSub: null });

    const result = await fulfillPaidGhlCheckout(prisma, null, { id: "chk_1" }, {});

    assert.equal(provisionCalls, 1);
    assert.equal(result.provisioned, true);
    assert.equal(result.organizationId, "org_new");
    assert.equal(checkoutRow.status, "PAID");
    assert.equal(subRow.status, "ACTIVE");
    assertMapping({
      organizationId: "org_new",
      packageCode: "PRO",
      ghlLocationId: "dedicated_1",
    });
  });

  it("B. NEW BROKER + ELITE creates ACTIVE Elite Agency mapping", async () => {
    userRow.brokerOrganizationId = null;
    packageRow = { id: "pkg_elite", code: "ELITE" };
    checkoutRow.packageId = "pkg_elite";
    const prisma = buildPrisma({ existingSub: null });

    const result = await fulfillPaidGhlCheckout(prisma, null, { id: "chk_1" }, {});

    assert.equal(provisionCalls, 1);
    assert.equal(result.organizationId, "org_new");
    assertMapping({
      organizationId: "org_new",
      packageCode: "ELITE",
      ghlLocationId: "dedicated_1",
    });
  });

  it("C. EXISTING BROKER + PRO reuses org and maps Pro location", async () => {
    userRow.brokerOrganizationId = "org_existing";
    packageRow = { id: "pkg_pro", code: "PRO" };
    checkoutRow.packageId = "pkg_pro";
    const prisma = buildPrisma();

    const result = await fulfillPaidGhlCheckout(prisma, null, { id: "chk_1" }, {});

    assert.equal(provisionCalls, 0);
    assert.equal(result.organizationId, "org_existing");
    assert.equal(result.provisioned, false);
    assert.equal(checkoutRow.status, "PAID");
    assertMapping({
      organizationId: "org_existing",
      packageCode: "PRO",
      ghlLocationId: "dedicated_1",
    });
  });

  it("D. EXISTING BROKER + ELITE maps Elite location", async () => {
    userRow.brokerOrganizationId = "org_existing";
    packageRow = { id: "pkg_elite", code: "ELITE" };
    checkoutRow.packageId = "pkg_elite";
    subRow.packageId = "pkg_pro";
    const prisma = buildPrisma();

    const result = await fulfillPaidGhlCheckout(prisma, null, { id: "chk_1" }, {});

    assert.equal(provisionCalls, 0);
    assert.equal(changePlanCalls, 1);
    assert.equal(result.organizationId, "org_existing");
    assertMapping({
      organizationId: "org_existing",
      packageCode: "ELITE",
      ghlLocationId: "dedicated_1",
    });
  });

  it("E. IDEMPOTENCY — second fulfill does not duplicate org/sub/mapping", async () => {
    userRow.brokerOrganizationId = null;
    packageRow = { id: "pkg_pro", code: "PRO" };
    const prisma = buildPrisma({ existingSub: null });

    const first = await fulfillPaidGhlCheckout(prisma, null, { id: "chk_1" }, {});
    assert.equal(first.alreadyProcessed, false);
    assert.equal(provisionCalls, 1);
    assert.equal(agencyRows.length, 1);

    const second = await fulfillPaidGhlCheckout(prisma, null, { id: "chk_1" }, {});
    assert.equal(second.alreadyProcessed, true);
    assert.equal(provisionCalls, 1, "must not provision a second organization");
    assert.equal(assignPlanCalls, 0);
    assert.equal(agencyRows.length, 1);
    assert.equal(agencyRows[0].status, "ACTIVE");
    assert.equal(agencyRows[0].ghlLocationId, "dedicated_1");
  });

  it("F. WEBHOOK REPLAY retries mapping without duplicates", async () => {
    userRow.brokerOrganizationId = "org_existing";
    checkoutRow.status = "PAID";
    checkoutRow.paymentStatus = "PAID";
    checkoutRow.organizationSubscriptionId = "sub_1";
    packageRow = { id: "pkg_pro", code: "PRO" };
    const prisma = buildPrisma();

    const first = await fulfillPaidGhlCheckout(prisma, null, { id: "chk_1" }, {});
    assert.equal(first.alreadyProcessed, true);
    assert.equal(agencyRows.length, 1);

    const replay = await fulfillPaidGhlCheckout(prisma, null, { id: "chk_1" }, {});
    assert.equal(replay.alreadyProcessed, true);
    assert.equal(agencyRows.length, 1);
    assert.equal(agencyRows[0].status, "ACTIVE");
    assert.equal(agencyRows[0].ghlLocationId, "dedicated_1");
  });

  it("G. BASIC deactivates existing Agency mapping (does not create ACTIVE)", async () => {
    userRow.brokerOrganizationId = "org_existing";
    packageRow = { id: "pkg_basic", code: "BASIC" };
    checkoutRow.packageId = "pkg_basic";
    agencyRows.push({
      id: "map_existing",
      organizationId: "org_existing",
      packageCode: "PRO",
      ghlCompanyId: COMPANY,
      ghlLocationId: PRO_LOC,
      status: "ACTIVE",
      lastError: null,
    });
    const prisma = buildPrisma();

    await fulfillPaidGhlCheckout(prisma, null, { id: "chk_1" }, {});

    assert.equal(agencyRows.length, 1);
    assert.equal(agencyRows[0].status, "INACTIVE");
    assert.equal(agencyRows[0].ghlLocationId, PRO_LOC);
  });

  it("H. FAILURE SAFETY — mapping error keeps checkout PAID and logs without secrets", async () => {
    userRow.brokerOrganizationId = "org_existing";
    packageRow = { id: "pkg_pro", code: "PRO" };
    syncThrows = true;
    const prisma = buildPrisma();

    const result = await fulfillPaidGhlCheckout(prisma, null, { id: "chk_1" }, {});

    assert.equal(checkoutRow.status, "PAID");
    assert.equal(checkoutRow.paymentStatus, "PAID");
    assert.ok(result.organizationSubscriptionId);
    assert.equal(result.agencyLocation.ok, false);
    assert.equal(agencyRows.length, 0);

    const blob = JSON.stringify(loggedErrors);
    assert.doesNotMatch(blob, /GHL_AGENCY_PRIVATE_TOKEN=secret/);
    assert.ok(
      loggedErrors.some((e) => e.event === "ghl.agency_location.sync_failed"),
    );
  });
});

describe("I. Admin changePlan Agency location sync (source check)", () => {
  it("changePlan / assignPlanToOrganization call Agency location sync helper", () => {
    const billingPath = path.join(
      __dirname,
      "../../services/subscription/subscriptionBilling.js",
    );
    const src = fs.readFileSync(billingPath, "utf8");
    assert.match(src, /syncAgencyLocationAfterPlanChange/);
    const changeStart = src.indexOf("async function changePlan");
    const cancelStart = src.indexOf("async function cancelSubscription");
    const assignStart = src.indexOf("async function assignPlanToOrganization");
    const changeBody = src.slice(changeStart, cancelStart);
    const assignBody = src.slice(assignStart, changeStart);
    assert.match(changeBody, /syncAgencyLocationAfterPlanChange/);
    assert.match(assignBody, /syncAgencyLocationAfterPlanChange/);
  });
});
