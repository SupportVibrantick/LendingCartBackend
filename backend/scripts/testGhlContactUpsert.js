/**
 * One-off smoke test for upsertGhlContact against live GHL.
 * Usage (from backend/): node scripts/testGhlContactUpsert.js
 *
 * Does not print API keys. Safe to run locally with .env loaded.
 */
require("dotenv").config();

const { upsertGhlContact } = require("../modules/ghl/ghl.service");
const { createGhlApiClient } = require("../modules/ghl/ghl.client");

async function fetchContact(contactId) {
  const client = createGhlApiClient();
  const res = await client.get(`/contacts/${contactId}`);
  return res.data?.contact || res.data;
}

function summarizeCustomFields(contact) {
  const fields = contact?.customFields || contact?.customField || [];
  const idToEnv = {
    [process.env.GHL_CF_LEAD_SOURCE]: "Lead Source",
    [process.env.GHL_CF_LEAD_TYPE]: "Lead Type",
    [process.env.GHL_CF_INTERESTED_PLAN]: "Interested Plan",
    [process.env.GHL_CF_LEAD_ID]: "LendingCart Lead ID",
  };

  return (Array.isArray(fields) ? fields : [])
    .filter((f) => idToEnv[f.id] || idToEnv[f.key])
    .map((f) => ({
      name: idToEnv[f.id] || idToEnv[f.key] || f.id,
      value: f.value ?? f.field_value ?? f.fieldValue,
    }));
}

async function main() {
  const stamp = Date.now();
  const email = `lc.ghl.test.${stamp}@example.com`;
  // Unique phone per run — this GHL location rejects duplicate phones.
  const phone = `+1555${String(stamp).slice(-7)}`;

  console.log("Testing upsertGhlContact (create)...");
  console.log({
    email,
    phone,
    locationConfigured: Boolean(process.env.GHL_LOCATION_ID),
    apiKeyConfigured: Boolean(process.env.GHL_API_KEY),
    cfLeadSource: Boolean(process.env.GHL_CF_LEAD_SOURCE),
    cfLeadType: Boolean(process.env.GHL_CF_LEAD_TYPE),
    cfInterestedPlan: Boolean(process.env.GHL_CF_INTERESTED_PLAN),
    cfLeadId: Boolean(process.env.GHL_CF_LEAD_ID),
  });

  const created = await upsertGhlContact({
    firstName: "LC",
    lastName: "GhlTest",
    email,
    phone,
    companyName: "LendingCart Test Co",
    leadSource: "LendingCart Website",
    leadType: "Book Demo",
    interestedPlan: "Starter (test)",
    lendingCartLeadId: `test-lead-${stamp}`,
  });

  console.log("Create result:", {
    ghlContactId: created.ghlContactId,
    created: created.created,
    updated: created.updated,
  });

  console.log("Testing upsertGhlContact (update same email, no duplicate)...");
  const updated = await upsertGhlContact({
    firstName: "LC",
    lastName: "GhlTestUpdated",
    email,
    phone,
    companyName: "LendingCart Test Co",
    leadSource: "LendingCart Website",
    leadType: "Book Demo",
    interestedPlan: "Growth (test)",
    lendingCartLeadId: `test-lead-${stamp}`,
  });

  console.log("Update result:", {
    ghlContactId: updated.ghlContactId,
    created: updated.created,
    updated: updated.updated,
    sameContact: updated.ghlContactId === created.ghlContactId,
  });

  if (!created.ghlContactId) {
    throw new Error("Create did not return ghlContactId");
  }
  if (updated.ghlContactId !== created.ghlContactId) {
    throw new Error("Update created a different contact (duplicate risk)");
  }
  if (!updated.updated) {
    throw new Error("Second call should update existing contact");
  }

  const contact = await fetchContact(created.ghlContactId);
  const customFields = summarizeCustomFields(contact);
  console.log("Contact after upsert:", {
    id: contact.id || created.ghlContactId,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    companyName: contact.companyName,
    customFields,
  });

  const names = new Set(customFields.map((f) => f.name));
  for (const required of [
    "Lead Source",
    "Lead Type",
    "Interested Plan",
    "LendingCart Lead ID",
  ]) {
    if (!names.has(required)) {
      throw new Error(`Missing custom field on contact: ${required}`);
    }
  }

  console.log("OK — verify in GHL Contacts UI:");
  console.log(`  email: ${email}`);
  console.log(`  contactId: ${created.ghlContactId}`);
}

main().catch((err) => {
  console.error("TEST FAILED:", err.message);
  process.exit(1);
});
