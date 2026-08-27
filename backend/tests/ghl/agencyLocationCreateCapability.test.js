const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { applyPaymentEnv, reload, clearModule } = require("./helpers");

const ENV = {
  GHL_AGENCY_COMPANY_ID: "HtXpcMHxPGpsuhqe0uiM",
  GHL_PRO_LOCATION_ID: "RQ3JZOrCXQUaIXK4FmYc",
  GHL_ELITE_LOCATION_ID: "gw2PojfvG909sYV8Hrk7",
  GHL_AGENCY_PRIVATE_TOKEN: "pit-TESTONLY",
};

describe("Agency location CREATE capability diagnostic (read-only)", () => {
  let restore;
  let assessAgencyLocationCreateCapability;
  let OFFICIAL_CREATE_LOCATION_CONTRACT;

  beforeEach(() => {
    restore = applyPaymentEnv(ENV);
    clearModule("../../services/ghl/ghlAccountLocation.service");
    clearModule("../../services/ghl/ghlAgency.client");
    clearModule("../../services/ghl/ghlAgencyLocations.service");
    clearModule("../../services/ghl/ghlAgencyLocationCreateCapability.service");

    reload("../../services/ghl/ghlAccountLocation.service");
    reload("../../services/ghl/ghlAgency.client");
    ({
      assessAgencyLocationCreateCapability,
      OFFICIAL_CREATE_LOCATION_CONTRACT,
    } = reload(
      "../../services/ghl/ghlAgencyLocationCreateCapability.service",
    ));
  });

  afterEach(() => {
    restore();
    clearModule("../../services/ghl/ghlAgencyLocationCreateCapability.service");
  });

  it("documents official POST /locations/ contract (no invented endpoint)", () => {
    assert.equal(OFFICIAL_CREATE_LOCATION_CONTRACT.method, "POST");
    assert.equal(OFFICIAL_CREATE_LOCATION_CONTRACT.path, "/locations/");
    assert.equal(OFFICIAL_CREATE_LOCATION_CONTRACT.requiredScope, "locations.write");
    assert.deepEqual(
      [...OFFICIAL_CREATE_LOCATION_CONTRACT.requiredBodyFields].sort(),
      ["companyId", "name"],
    );
    assert.ok(
      OFFICIAL_CREATE_LOCATION_CONTRACT.documentationUrl.includes(
        "create-location",
      ),
    );
  });

  it("never reports a write and never calls POST via injected list stub", async () => {
    const calls = [];
    const report = await assessAgencyLocationCreateCapability({
      probeList: true,
      listLocationsFn: async (args) => {
        calls.push({ method: "GET", args });
        return {
          ok: true,
          code: "OK",
          message: "ok",
          locations: [{ locationId: "loc1", name: "Demo" }],
        };
      },
    });

    assert.equal(report.writePerformed, false);
    assert.equal(report.mode, "READ_ONLY");
    assert.deepEqual(report.httpMethodsAllowedInThisDiagnostic, ["GET"]);
    assert.equal(report.writeCapability.liveWriteVerified, false);
    assert.equal(report.listProbe.ok, true);
    assert.equal(report.listProbe.locationCount, 1);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, "GET");
    assert.equal(report.readinessForFutureImplementation.safeToChangeProductionMappingYet, false);
  });

  it("records list failure without inventing write success", async () => {
    const report = await assessAgencyLocationCreateCapability({
      probeList: true,
      listLocationsFn: async () => ({
        ok: false,
        code: "AGENCY_LOCATIONS_LIST_FAILED",
        message: "token not authorized for this scope Bearer abc.def pit-ABCDEF",
        locations: [],
      }),
    });

    assert.equal(report.listProbe.ok, false);
    assert.equal(report.writePerformed, false);
    assert.doesNotMatch(report.listProbe.message, /Bearer abc\.def/);
    assert.doesNotMatch(report.listProbe.message, /pit-ABCDEF/);
  });

  it("states team users are a separate POST /users/ operation", () => {
    assert.match(
      OFFICIAL_CREATE_LOCATION_CONTRACT.initialTeamUserCreation,
      /POST \/users\//i,
    );
  });

  it("states PRO/ELITE setup uses optional snapshotId, not shared location pools", () => {
    assert.match(
      OFFICIAL_CREATE_LOCATION_CONTRACT.proEliteSetupViaApi,
      /snapshotId/i,
    );
  });
});
