const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  signFormSchemaJsonSchema,
  saveSignFormDraftSchema,
} = require("../../schemas/documents/signForm.schema");

test("sign form schema accepts a valid v1 field overlay", () => {
  const parsed = signFormSchemaJsonSchema.parse({
    schemaVersion: 1,
    pages: [{ page: 1, widthPt: 612, heightPt: 792 }],
    fields: [
      {
        id: "fld_borrower_name",
        key: "borrower_name",
        label: "Borrower Name",
        type: "text",
        page: 1,
        rect: { x: 120, y: 520, width: 300, height: 24 },
        required: true,
        fillRole: "client",
      },
      {
        id: "fld_signature",
        key: "borrower_signature",
        label: "Borrower Signature",
        type: "signature",
        page: 1,
        rect: { x: 72, y: 80, width: 180, height: 40 },
        required: true,
        fillRole: "client",
      },
    ],
    conditionals: [],
  });

  assert.equal(parsed.fields.length, 2);
  assert.equal(parsed.fields[0].fillRole, "client");
});

test("sign form schema rejects empty pages", () => {
  assert.throws(() =>
    signFormSchemaJsonSchema.parse({
      schemaVersion: 1,
      pages: [],
      fields: [],
    }),
  );
});

test("save draft payload requires schemaVersion 1", () => {
  const parsed = saveSignFormDraftSchema.parse({
    schema: {
      schemaVersion: 1,
      pages: [{ page: 1, widthPt: 612, heightPt: 792 }],
      fields: [],
    },
  });
  assert.equal(parsed.schema.schemaVersion, 1);
});
