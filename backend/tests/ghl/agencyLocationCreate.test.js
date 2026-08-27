const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { applyPaymentEnv, reload, clearModule } = require("./helpers");

describe("createAgencyLocation (POST /locations/)", () => {
  let restore;
  let createAgencyLocation;
  let extractCreatedLocation;
  let GhlAccountLocationError;

  beforeEach(() => {
    restore = applyPaymentEnv({
      GHL_AGENCY_COMPANY_ID: "HtXpcMHxPGpsuhqe0uiM",
      GHL_AGENCY_PRIVATE_TOKEN: "pit-TESTONLY",
    });
    clearModule("../../services/ghl/ghlAgency.client");
    clearModule("../../services/ghl/ghlAccountLocation.service");
    clearModule("../../services/ghl/ghlAgencyLocationCreate.service");
    reload("../../services/ghl/ghlAccountLocation.service");
    ({
      createAgencyLocation,
      extractCreatedLocation,
    } = reload("../../services/ghl/ghlAgencyLocationCreate.service"));
    ({ GhlAccountLocationError } = require("../../services/ghl/ghlAccountLocation.service"));
  });

  afterEach(() => {
    restore();
    clearModule("../../services/ghl/ghlAgencyLocationCreate.service");
  });

  it("extracts location id from wrapped or flat GHL payloads", () => {
    assert.equal(extractCreatedLocation({ id: "loc1" }).locationId, "loc1");
    assert.equal(
      extractCreatedLocation({ location: { id: "loc2", companyId: "co" } }).locationId,
      "loc2",
    );
  });

  it("POSTs required name + companyId and optional snapshotId", async () => {
    const posts = [];
    const client = {
      async post(url, body) {
        posts.push({ url, body });
        return { status: 201, data: { id: "newLoc", companyId: body.companyId, name: body.name } };
      },
    };

    const created = await createAgencyLocation({
      name: "Ada Brokerage",
      companyId: "HtXpcMHxPGpsuhqe0uiM",
      snapshotId: "snap_pro",
      client,
    });

    assert.equal(posts.length, 1);
    assert.equal(posts[0].url, "/locations/");
    assert.equal(posts[0].body.name, "Ada Brokerage");
    assert.equal(posts[0].body.companyId, "HtXpcMHxPGpsuhqe0uiM");
    assert.equal(posts[0].body.snapshotId, "snap_pro");
    assert.equal(posts[0].body.prospectInfo.firstName, "Ada");
    assert.equal(posts[0].body.prospectInfo.lastName, "Brokerage");
    assert.equal(created.locationId, "newLoc");
  });

  it("includes prospectInfo first/last/email when provided", async () => {
    const posts = [];
    const client = {
      async post(url, body) {
        posts.push({ url, body });
        return { status: 201, data: { id: "locB" } };
      },
    };
    await createAgencyLocation({
      name: "Org Name",
      companyId: "co1",
      email: "ops@example.com",
      firstName: "Ratan",
      lastName: "Tata",
      client,
    });
    assert.deepEqual(posts[0].body.prospectInfo, {
      firstName: "Ratan",
      lastName: "Tata",
      email: "ops@example.com",
    });
  });

  it("omits snapshotId when not provided", async () => {
    const posts = [];
    const client = {
      async post(url, body) {
        posts.push({ url, body });
        return { status: 201, data: { location: { id: "locA" } } };
      },
    };
    await createAgencyLocation({
      name: "Broker",
      companyId: "co1",
      client,
    });
    assert.equal(posts[0].body.snapshotId, undefined);
  });

  it("throws when name is missing", async () => {
    await assert.rejects(
      () => createAgencyLocation({ companyId: "co1", client: { post: async () => ({}) } }),
      (err) => err instanceof GhlAccountLocationError && err.code === "MISSING_LOCATION_NAME",
    );
  });

  it("redacts secrets from provider errors", async () => {
    const client = {
      async post() {
        const err = new Error("failed Bearer abc.def pit-ABCDEFG");
        err.response = { status: 403, data: { message: "nope Bearer tok pit-XYZ" } };
        throw err;
      },
    };
    await assert.rejects(
      () =>
        createAgencyLocation({
          name: "X",
          companyId: "co1",
          client,
        }),
      (err) => {
        assert.doesNotMatch(String(err.message), /pit-XYZ/);
        assert.doesNotMatch(String(err.message), /Bearer tok/);
        return err.code === "AGENCY_LOCATION_CREATE_FAILED";
      },
    );
  });
});
