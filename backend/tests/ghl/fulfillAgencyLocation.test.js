const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { applyPaymentEnv, reload, clearModule, stubCreateAgencyLocation } = require("./helpers");

const CONFIRMED_PRO_LOCATION_ID = "RQ3JZOrCXQUaIXK4FmYc";
const CONFIRMED_ELITE_LOCATION_ID = "gw2PojfvG909sYV8Hrk7";
const CONFIRMED_AGENCY_COMPANY_ID = "HtXpcMHxPGpsuhqe0uiM";

const ACCOUNT_LOCATION_ENV = {
  GHL_AGENCY_COMPANY_ID: CONFIRMED_AGENCY_COMPANY_ID,
  GHL_PRO_LOCATION_ID: CONFIRMED_PRO_LOCATION_ID,
  GHL_ELITE_LOCATION_ID: CONFIRMED_ELITE_LOCATION_ID,
  GHL_AGENCY_PRIVATE_TOKEN: "pit-TESTONLY",
  GHL_PRO_SNAPSHOT_ID: "snap_pro",
  GHL_ELITE_SNAPSHOT_ID: "snap_elite",
};

describe("fulfillPaidGhlCheckout Agency location integration", () => {
  let restore;
  let fulfillPaidGhlCheckout;
  let agencyRows;
  let checkoutRow;
  let subRow;
  let userRow;
  let packageRow;
  let provisionCalls;
  let syncThrows;
  let createSeq;

  beforeEach(() => {
    restore = applyPaymentEnv(ACCOUNT_LOCATION_ENV);
    agencyRows = [];
    provisionCalls = 0;
    syncThrows = false;
    createSeq = 0;

    packageRow = { id: "pkg_pro", code: "PRO" };
    userRow = {
      id: "user_1",
      email: "broker@example.com",
      firstName: "Ada",
      lastName: "Broker",
      brokerOrganizationId: "org_existing",
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

    // Stub billing + provision before loading fulfill module.
    clearModule("../../services/subscription/subscriptionBilling");
    clearModule("../../services/broker/provisionBrokerFromLoanAi");
    clearModule("../../services/ghl/ghlPaymentLogger");
    clearModule("../../services/ghl/organizationGhlAgencyLocation.service");
    clearModule("../../services/ghl/ghlAccountLocation.service");
    clearModule("../../services/ghl/fulfillGhlCheckout");

    require.cache[require.resolve("../../services/subscription/subscriptionBilling")] = {
      id: require.resolve("../../services/subscription/subscriptionBilling"),
      filename: require.resolve("../../services/subscription/subscriptionBilling"),
      loaded: true,
      exports: {
        assignPlanToOrganization: async () => ({
          subscription: { id: "sub_assigned" },
          invoice: { id: "inv_1" },
        }),
        markInvoicePaid: async (prisma, id) => ({ id }),
        changePlan: async () => ({ id: "sub_1" }),
      },
    };

    require.cache[require.resolve("../../services/broker/provisionBrokerFromLoanAi")] = {
      id: require.resolve("../../services/broker/provisionBrokerFromLoanAi"),
      filename: require.resolve("../../services/broker/provisionBrokerFromLoanAi"),
      loaded: true,
      exports: {
        provisionBrokerFromLoanAi: async () => {
          provisionCalls += 1;
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

    reload("../../services/ghl/ghlAccountLocation.service");
    reload("../../services/ghl/organizationGhlAgencyLocation.service");
    ({ fulfillPaidGhlCheckout } = reload("../../services/ghl/fulfillGhlCheckout"));
  });

  afterEach(() => {
    restore();
    clearModule("../../services/subscription/subscriptionBilling");
    clearModule("../../services/broker/provisionBrokerFromLoanAi");
    clearModule("../../services/ghl/ghlPaymentLogger");
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
              ? { ...subRow, id: checkoutRow.organizationSubscriptionId }
              : null,
            ...overrides.checkoutInclude,
          };
        },
        async update({ data }) {
          checkoutRow = { ...checkoutRow, ...data };
          return { ...checkoutRow };
        },
      },
      organizationSubscription: {
        async findFirst() {
          return overrides.existingSub === undefined ? { ...subRow } : overrides.existingSub;
        },
        async update({ where, data }) {
          subRow = { ...subRow, id: where.id, ...data };
          return { ...subRow };
        },
        async findUnique({ where }) {
          if (where.id === subRow.id || where.id === "sub_new") {
            return {
              ...subRow,
              id: where.id,
              organizationId:
                where.id === "sub_new" ? "org_new" : subRow.organizationId,
              package: packageRow,
            };
          }
          return null;
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
            throw new Error("simulated agency mapping failure");
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

  it("8. Existing organization fulfillment maps Pro location", async () => {
    const prisma = buildPrisma();
    const result = await fulfillPaidGhlCheckout(prisma, null, { id: "chk_1" }, {});

    assert.equal(result.alreadyProcessed, false);
    assert.equal(result.organizationId, "org_existing");
    assert.equal(checkoutRow.status, "PAID");
    assert.equal(agencyRows.length, 1);
    assert.equal(agencyRows[0].organizationId, "org_existing");
    assert.equal(agencyRows[0].ghlLocationId, "dedicated_1");
    assert.equal(result.agencyLocation.ok, true);
  });

  it("9. New organization fulfillment maps location by org id", async () => {
    userRow.brokerOrganizationId = null;
    packageRow = { id: "pkg_elite", code: "ELITE" };
    checkoutRow.packageId = "pkg_elite";
    const prisma = buildPrisma({ existingSub: null });

    const result = await fulfillPaidGhlCheckout(prisma, null, { id: "chk_1" }, {});

    assert.equal(provisionCalls, 1);
    assert.equal(result.organizationId, "org_new");
    assert.equal(result.provisioned, true);
    assert.equal(agencyRows.length, 1);
    assert.equal(agencyRows[0].organizationId, "org_new");
    assert.equal(agencyRows[0].ghlLocationId, "dedicated_1");
  });

  it("10. Mapping failure keeps checkout PAID / subscription intact", async () => {
    syncThrows = true;
    const prisma = buildPrisma();
    const result = await fulfillPaidGhlCheckout(prisma, null, { id: "chk_1" }, {});

    assert.equal(checkoutRow.status, "PAID");
    assert.equal(checkoutRow.paymentStatus, "PAID");
    assert.ok(result.organizationSubscriptionId);
    assert.equal(result.agencyLocation.ok, false);
    assert.equal(agencyRows.length, 0);
  });

  it("webhook replay retries mapping without failing paid checkout", async () => {
    checkoutRow.status = "PAID";
    checkoutRow.paymentStatus = "PAID";
    checkoutRow.organizationSubscriptionId = "sub_1";
    const prisma = buildPrisma();

    const result = await fulfillPaidGhlCheckout(prisma, null, { id: "chk_1" }, {});

    assert.equal(result.alreadyProcessed, true);
    assert.equal(agencyRows.length, 1);
    assert.equal(agencyRows[0].ghlLocationId, "dedicated_1");

    const replay = await fulfillPaidGhlCheckout(prisma, null, { id: "chk_1" }, {});
    assert.equal(replay.alreadyProcessed, true);
    assert.equal(agencyRows.length, 1);
  });
});
