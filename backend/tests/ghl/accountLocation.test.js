const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { applyPaymentEnv, reload } = require("./helpers");

const CONFIRMED_PRO_LOCATION_ID = "RQ3JZOrCXQUaIXK4FmYc";
const CONFIRMED_ELITE_LOCATION_ID = "gw2PojfvG909sYV8Hrk7";
const CONFIRMED_AGENCY_COMPANY_ID = "HtXpcMHxPGpsuhqe0uiM";

const ACCOUNT_LOCATION_ENV = {
  GHL_AGENCY_COMPANY_ID: CONFIRMED_AGENCY_COMPANY_ID,
  GHL_PRO_LOCATION_ID: CONFIRMED_PRO_LOCATION_ID,
  GHL_ELITE_LOCATION_ID: CONFIRMED_ELITE_LOCATION_ID,
};

describe("GHL account location resolver (PRO / ELITE config)", () => {
  let restore;
  let getProLocationId;
  let getEliteLocationId;
  let getLocationIdForPlan;
  let getAgencyCompanyId;
  let normalizeAccountPlan;
  let GhlAccountLocationError;

  beforeEach(() => {
    restore = applyPaymentEnv(ACCOUNT_LOCATION_ENV);
    ({
      getProLocationId,
      getEliteLocationId,
      getLocationIdForPlan,
      getAgencyCompanyId,
      normalizeAccountPlan,
      GhlAccountLocationError,
    } = reload("../../services/ghl/ghlAccountLocation.service"));
  });

  afterEach(() => {
    restore();
  });

  it("PRO resolves to confirmed Pro locationId", () => {
    assert.equal(getProLocationId(), CONFIRMED_PRO_LOCATION_ID);
    const resolved = getLocationIdForPlan("PRO");
    assert.equal(resolved.plan, "PRO");
    assert.equal(resolved.locationId, CONFIRMED_PRO_LOCATION_ID);
    assert.equal(resolved.envKey, "GHL_PRO_LOCATION_ID");
  });

  it("ELITE resolves to confirmed Elite locationId", () => {
    assert.equal(getEliteLocationId(), CONFIRMED_ELITE_LOCATION_ID);
    const resolved = getLocationIdForPlan("ELITE");
    assert.equal(resolved.plan, "ELITE");
    assert.equal(resolved.locationId, CONFIRMED_ELITE_LOCATION_ID);
    assert.equal(resolved.envKey, "GHL_ELITE_LOCATION_ID");
  });

  it("normalizes common Pro/Elite plan labels", () => {
    assert.equal(normalizeAccountPlan("pro"), "PRO");
    assert.equal(normalizeAccountPlan("Pro Account"), "PRO");
    assert.equal(normalizeAccountPlan("elite_account"), "ELITE");
    assert.equal(normalizeAccountPlan("BASIC"), null);
    assert.equal(normalizeAccountPlan(""), null);
  });

  it("reads agency company ID from env", () => {
    assert.equal(getAgencyCompanyId(), CONFIRMED_AGENCY_COMPANY_ID);
  });

  it("throws for unsupported plan (no silent fallback)", () => {
    assert.throws(
      () => getLocationIdForPlan("BASIC"),
      (err) =>
        err instanceof GhlAccountLocationError &&
        err.code === "UNSUPPORTED_ACCOUNT_PLAN" &&
        err.statusCode === 400,
    );
  });

  it("reads optional snapshot IDs without requiring them", () => {
    restore();
    restore = applyPaymentEnv({
      ...ACCOUNT_LOCATION_ENV,
      GHL_PRO_SNAPSHOT_ID: "snap_pro",
      GHL_ELITE_SNAPSHOT_ID: "snap_elite",
    });
    const {
      getOptionalSnapshotIdForPlan,
      isSharedPoolLocationId,
      buildAgencyLocationDashboardUrl,
    } = reload("../../services/ghl/ghlAccountLocation.service");

    assert.equal(getOptionalSnapshotIdForPlan("PRO").snapshotId, "snap_pro");
    assert.equal(getOptionalSnapshotIdForPlan("ELITE").snapshotId, "snap_elite");
    assert.equal(isSharedPoolLocationId(CONFIRMED_PRO_LOCATION_ID), true);
    assert.equal(isSharedPoolLocationId("someDedicatedLocation"), false);
    assert.match(
      buildAgencyLocationDashboardUrl("abc123"),
      /\/v2\/location\/abc123\/dashboard$/,
    );
  });

  it("throws when Pro location env is missing", () => {
    restore();
    restore = applyPaymentEnv({
      ...ACCOUNT_LOCATION_ENV,
      GHL_PRO_LOCATION_ID: "",
    });
    ({ getLocationIdForPlan, GhlAccountLocationError } = reload(
      "../../services/ghl/ghlAccountLocation.service",
    ));

    assert.throws(
      () => getLocationIdForPlan("PRO"),
      (err) =>
        err instanceof GhlAccountLocationError &&
        err.code === "MISSING_GHL_PRO_LOCATION_ID" &&
        err.statusCode === 503,
    );
  });
});
