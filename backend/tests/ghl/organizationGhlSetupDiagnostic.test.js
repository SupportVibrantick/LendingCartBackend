const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { applyPaymentEnv, reload } = require("./helpers");

const PRO_LOC = "RQ3JZOrCXQUaIXK4FmYc";
const ELITE_LOC = "gw2PojfvG909sYV8Hrk7";
const COMPANY = "HtXpcMHxPGpsuhqe0uiM";

const ENV = {
  GHL_AGENCY_COMPANY_ID: COMPANY,
  GHL_PRO_LOCATION_ID: PRO_LOC,
  GHL_ELITE_LOCATION_ID: ELITE_LOC,
};

describe("diagnoseOrganizationGhlSetup (read-only readiness)", () => {
  let restore;
  let diagnoseOrganizationGhlSetup;
  let SETUP_STATUS;
  let prisma;

  beforeEach(() => {
    restore = applyPaymentEnv(ENV);
    ({ diagnoseOrganizationGhlSetup, SETUP_STATUS } = reload(
      "../../services/ghl/diagnoseOrganizationGhlSetup.service",
    ));
    // Ensure account location env helpers see fresh env
    reload("../../services/ghl/ghlAccountLocation.service");
    ({ diagnoseOrganizationGhlSetup, SETUP_STATUS } = reload(
      "../../services/ghl/diagnoseOrganizationGhlSetup.service",
    ));

    prisma = {
      organization: {
        async findUnique({ where }) {
          return this._orgs[where.id] || null;
        },
        _orgs: {},
      },
      organizationSubscription: {
        async findFirst({ where }) {
          const rows = (this._subs || []).filter(
            (s) => s.organizationId === where.organizationId,
          );
          return rows.sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
          )[0] || null;
        },
        _subs: [],
      },
      organizationGhlAgencyLocation: {
        async findUnique({ where }) {
          return this._byOrg[where.organizationId] || null;
        },
        _byOrg: {},
      },
    };
  });

  afterEach(() => {
    restore();
  });

  function setOrg(id = "org1", overrides = {}) {
    prisma.organization._orgs[id] = {
      id,
      name: "Demo Broker",
      type: "BROKER",
      isDeleted: false,
      ...overrides,
    };
  }

  function setSub({
    organizationId = "org1",
    status = "ACTIVE",
    packageCode = "PRO",
    billingCycle = "MONTHLY",
  } = {}) {
    prisma.organizationSubscription._subs.push({
      organizationId,
      status,
      billingCycle,
      ghlSubscriptionId: "sub_ghl_1",
      createdAt: new Date(),
      package: { id: "pkg1", code: packageCode, name: packageCode },
    });
  }

  function setMapping({
    organizationId = "org1",
    packageCode = "PRO",
    ghlLocationId = PRO_LOC,
    status = "ACTIVE",
  } = {}) {
    prisma.organizationGhlAgencyLocation._byOrg[organizationId] = {
      organizationId,
      packageCode,
      ghlCompanyId: COMPANY,
      ghlLocationId,
      status,
      assignedAt: new Date(),
    };
  }

  it("PRO org with correct ACTIVE mapping -> READY", async () => {
    setOrg();
    setSub({ packageCode: "PRO" });
    setMapping({ packageCode: "PRO", ghlLocationId: PRO_LOC });
    const report = await diagnoseOrganizationGhlSetup(prisma, {
      organizationId: "org1",
    });
    assert.equal(
      report.status,
      SETUP_STATUS.READY_FOR_GHL_USER_RECONCILIATION,
    );
  });

  it("ELITE org with correct ACTIVE mapping -> READY", async () => {
    setOrg();
    setSub({ packageCode: "ELITE" });
    setMapping({ packageCode: "ELITE", ghlLocationId: ELITE_LOC });
    const report = await diagnoseOrganizationGhlSetup(prisma, {
      organizationId: "org1",
    });
    assert.equal(
      report.status,
      SETUP_STATUS.READY_FOR_GHL_USER_RECONCILIATION,
    );
  });

  it("missing mapping -> NOT_READY", async () => {
    setOrg();
    setSub({ packageCode: "PRO" });
    const report = await diagnoseOrganizationGhlSetup(prisma, {
      organizationId: "org1",
    });
    assert.equal(report.status, SETUP_STATUS.NOT_READY);
    assert.ok(
      report.reasons.some((r) => /mapping does not exist/i.test(r)),
    );
  });

  it("inactive mapping -> NOT_READY", async () => {
    setOrg();
    setSub({ packageCode: "PRO" });
    setMapping({ status: "INACTIVE" });
    const report = await diagnoseOrganizationGhlSetup(prisma, {
      organizationId: "org1",
    });
    assert.equal(report.status, SETUP_STATUS.NOT_READY);
    assert.ok(report.reasons.some((r) => /INACTIVE/i.test(r)));
  });

  it("wrong location ID is still READY when dedicated mapping exists", async () => {
    setOrg();
    setSub({ packageCode: "PRO" });
    setMapping({ ghlLocationId: "DEDICATED_ORG_LOCATION" });
    const report = await diagnoseOrganizationGhlSetup(prisma, {
      organizationId: "org1",
    });
    assert.equal(
      report.status,
      SETUP_STATUS.READY_FOR_GHL_USER_RECONCILIATION,
    );
  });

  it("BASIC -> NOT_READY", async () => {
    setOrg();
    setSub({ packageCode: "BASIC" });
    setMapping({ packageCode: "BASIC", ghlLocationId: PRO_LOC });
    const report = await diagnoseOrganizationGhlSetup(prisma, {
      organizationId: "org1",
    });
    assert.equal(report.status, SETUP_STATUS.NOT_READY);
    assert.ok(report.reasons.some((r) => /BASIC|not PRO or ELITE/i.test(r)));
  });

  it("cancelled/expired subscription -> NOT_READY", async () => {
    setOrg();
    setSub({ status: "CANCELLED", packageCode: "PRO" });
    setMapping();
    const cancelled = await diagnoseOrganizationGhlSetup(prisma, {
      organizationId: "org1",
    });
    assert.equal(cancelled.status, SETUP_STATUS.NOT_READY);
    assert.ok(cancelled.reasons.some((r) => /CANCELLED/i.test(r)));

    prisma.organizationSubscription._subs = [];
    setSub({ status: "EXPIRED", packageCode: "PRO" });
    const expired = await diagnoseOrganizationGhlSetup(prisma, {
      organizationId: "org1",
    });
    assert.equal(expired.status, SETUP_STATUS.NOT_READY);
    assert.ok(expired.reasons.some((r) => /EXPIRED/i.test(r)));
  });

  it("missing organization -> NOT_READY", async () => {
    const report = await diagnoseOrganizationGhlSetup(prisma, {
      organizationId: "missing-org",
    });
    assert.equal(report.status, SETUP_STATUS.NOT_READY);
    assert.ok(report.reasons.some((r) => /not found/i.test(r)));
  });
});

describe("findOrganizationsReadyForGhlUserProvisioning (read-only)", () => {
  let restore;
  let findOrganizationsReadyForGhlUserProvisioning;
  let prisma;

  beforeEach(() => {
    restore = applyPaymentEnv(ENV);
    reload("../../services/ghl/ghlAccountLocation.service");
    ({ findOrganizationsReadyForGhlUserProvisioning } = reload(
      "../../services/ghl/diagnoseOrganizationGhlSetup.service",
    ));

    prisma = {
      organization: {
        _orgs: {},
        async findUnique({ where }) {
          return this._orgs[where.id] || null;
        },
      },
      organizationSubscription: {
        _subs: [],
        async findFirst({ where }) {
          return (
            this._subs.find((s) => s.organizationId === where.organizationId) ||
            null
          );
        },
      },
      organizationGhlAgencyLocation: {
        _rows: [],
        async findMany() {
          return this._rows;
        },
        async findUnique({ where }) {
          return (
            this._rows.find((r) => r.organizationId === where.organizationId) ||
            null
          );
        },
      },
    };
  });

  afterEach(() => {
    restore();
  });

  it("returns READY orgs with matching ACTIVE PRO mapping", async () => {
    prisma.organization._orgs.org_ready = {
      id: "org_ready",
      name: "Ready Broker",
      type: "BROKER",
      isDeleted: false,
    };
    prisma.organizationSubscription._subs.push({
      organizationId: "org_ready",
      status: "ACTIVE",
      billingCycle: "MONTHLY",
      createdAt: new Date(),
      package: { id: "p1", code: "PRO", name: "Pro" },
    });
    prisma.organizationGhlAgencyLocation._rows.push({
      organizationId: "org_ready",
      packageCode: "PRO",
      ghlLocationId: PRO_LOC,
      ghlCompanyId: COMPANY,
      status: "ACTIVE",
      assignedAt: new Date(),
    });

    const found = await findOrganizationsReadyForGhlUserProvisioning(prisma, {
      limit: 10,
    });
    assert.equal(found.readyCount, 1);
    assert.equal(found.organizations[0].organizationId, "org_ready");
    assert.equal(found.organizations[0].packageCode, "PRO");
    assert.equal(found.organizations[0].ghlLocationId, PRO_LOC);
  });

  it("includes orgs with dedicated location ids that differ from legacy pools", async () => {
    prisma.organization._orgs.org_dedicated = {
      id: "org_dedicated",
      name: "Dedicated Loc",
      type: "BROKER",
      isDeleted: false,
    };
    prisma.organizationSubscription._subs.push({
      organizationId: "org_dedicated",
      status: "ACTIVE",
      billingCycle: "MONTHLY",
      createdAt: new Date(),
      package: { id: "p1", code: "PRO", name: "Pro" },
    });
    prisma.organizationGhlAgencyLocation._rows.push({
      organizationId: "org_dedicated",
      packageCode: "PRO",
      ghlLocationId: "DEDICATED_NOT_POOL",
      ghlCompanyId: COMPANY,
      status: "ACTIVE",
      assignedAt: new Date(),
    });

    const found = await findOrganizationsReadyForGhlUserProvisioning(prisma);
    assert.equal(found.readyCount, 1);
    assert.equal(found.organizations[0].ghlLocationId, "DEDICATED_NOT_POOL");
  });
});
