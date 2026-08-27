const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  computeProgress,
  fieldEditableByRole,
  missingRequiredFields,
} = require("../../services/documents/signForm/submissionService");

const schema = {
  schemaVersion: 1,
  pages: [{ page: 1, widthPt: 612, heightPt: 792 }],
  fields: [
    {
      id: "1",
      key: "borrower_name",
      label: "Borrower Name",
      type: "text",
      page: 1,
      rect: { x: 1, y: 1, width: 10, height: 10 },
      required: true,
      fillRole: "client",
    },
    {
      id: "2",
      key: "broker_nmls",
      label: "Broker NMLS",
      type: "text",
      page: 1,
      rect: { x: 1, y: 1, width: 10, height: 10 },
      required: true,
      fillRole: "broker",
    },
    {
      id: "3",
      key: "notes",
      label: "Notes",
      type: "text",
      page: 1,
      rect: { x: 1, y: 1, width: 10, height: 10 },
      required: false,
      fillRole: "either",
    },
    {
      id: "4",
      key: "locked",
      label: "Locked",
      type: "text",
      page: 1,
      rect: { x: 1, y: 1, width: 10, height: 10 },
      required: false,
      fillRole: "readonly",
    },
  ],
};

test("fieldEditableByRole allows client and broker on any non-readonly field", () => {
  assert.equal(fieldEditableByRole(schema.fields[0], "client"), true);
  assert.equal(fieldEditableByRole(schema.fields[0], "broker"), true);
  assert.equal(fieldEditableByRole(schema.fields[1], "client"), true);
  assert.equal(fieldEditableByRole(schema.fields[1], "broker"), true);
  assert.equal(fieldEditableByRole(schema.fields[2], "client"), true);
  assert.equal(fieldEditableByRole(schema.fields[2], "broker"), true);
  assert.equal(fieldEditableByRole(schema.fields[3], "client"), false);
  assert.equal(fieldEditableByRole(schema.fields[3], "broker"), false);
});

test("computeProgress treats fillable fields as a shared pool", () => {
  const progress = computeProgress(schema, {
    borrower_name: "Jane",
  });
  assert.equal(progress.client.complete, false);
  assert.equal(progress.broker.complete, false);
  assert.equal(progress.all.complete, false);
  assert.equal(progress.client.total, 3);
  assert.equal(progress.broker.total, 3);

  const done = computeProgress(schema, {
    borrower_name: "Jane",
    broker_nmls: "12345",
  });
  assert.equal(done.client.complete, true);
  assert.equal(done.broker.complete, true);
  assert.equal(done.all.complete, true);
});

test("missingRequiredFields for broker includes all required fillable fields", () => {
  const missing = missingRequiredFields(
    schema,
    { borrower_name: "Jane" },
    "broker",
  );
  assert.equal(missing.length, 1);
  assert.equal(missing[0].key, "broker_nmls");

  const missingForClient = missingRequiredFields(
    schema,
    { broker_nmls: "12345" },
    "client",
  );
  assert.equal(missingForClient.length, 1);
  assert.equal(missingForClient[0].key, "borrower_name");
});
