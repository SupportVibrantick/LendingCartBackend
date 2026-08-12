const axios = require("axios");
const { isGhlEnabled } = require("../../config/env");
const { createGhlApiClient } = require("./ghl.client");

/**
 * Strip secrets from axios error / config before logging.
 */
function sanitizeAxiosError(err) {
  const status = err.response?.status || null;
  const data = err.response?.data ?? null;
  return {
    message: err.message,
    code: err.code || null,
    status,
    data,
  };
}

function formatGhlHttpError(err) {
  const status = err.response?.status;
  const apiMessage =
    err.response?.data?.message ||
    err.response?.data?.msg ||
    err.response?.data?.error ||
    (Array.isArray(err.response?.data?.errors)
      ? err.response.data.errors.map((e) => e.message || e).join("; ")
      : null) ||
    err.message;

  if (status === 401) {
    return new Error(`GHL unauthorized (401): check GHL_API_KEY — ${apiMessage}`);
  }
  if (status === 403) {
    return new Error(
      `GHL forbidden (403): API key lacks Contacts permission — ${apiMessage}`,
    );
  }
  if (status === 422) {
    return new Error(`GHL validation failed (422): ${apiMessage}`);
  }
  if (!err.response && (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT")) {
    return new Error(`GHL network timeout: ${err.message}`);
  }
  if (!err.response && (err.code === "ENOTFOUND" || err.code === "ECONNREFUSED")) {
    return new Error(`GHL network error (${err.code}): ${err.message}`);
  }
  if (status) {
    return new Error(`GHL request failed (${status}): ${apiMessage}`);
  }
  return new Error(`GHL request failed: ${apiMessage}`);
}

function logGhlError(context, err) {
  console.error(`GHL ${context}:`, sanitizeAxiosError(err));
}

const triggerWebhook = async ({ email, name, message, subject }) => {
  if (!isGhlEnabled()) {
    console.log("GHL_ENABLED=false — webhook email skipped", {
      email,
      subject: subject || "Default Subject",
    });
    return { skipped: true, provider: "GHL" };
  }

  try {
    if (!email) {
      throw new Error("Email is required for GHL webhook");
    }

    const payload = {
      email,
      name: name || "User",
      message: message || "",
      subject: subject || "Default Subject",
    };

    const res = await axios.post(process.env.GHL_WEBHOOK_URL, payload, {
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log("GHL SUCCESS:", {
      email,
      subject: payload.subject,
      responseId: res.data?.id,
    });

    return res.data;
  } catch (err) {
    logGhlError("webhook", err);
    throw new Error("Failed to send email via GHL");
  }
};

function getLocationId() {
  const locationId = process.env.GHL_LOCATION_ID;
  if (!locationId || !String(locationId).trim()) {
    throw new Error("GHL_LOCATION_ID is required for contact sync");
  }
  return String(locationId).trim();
}

function requireContactApiCredentials() {
  if (!process.env.GHL_API_KEY || !String(process.env.GHL_API_KEY).trim()) {
    throw new Error("GHL_API_KEY is required for contact sync");
  }
  return getLocationId();
}

function canSyncContacts() {
  return Boolean(
    isGhlEnabled() &&
      process.env.GHL_API_KEY &&
      String(process.env.GHL_API_KEY).trim() &&
      process.env.GHL_LOCATION_ID &&
      String(process.env.GHL_LOCATION_ID).trim(),
  );
}

function buildPlanTag(planCode) {
  if (!planCode) return null;
  const normalized = String(planCode)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized ? `plan-${normalized}` : null;
}

function buildTags({ interestedPlanCode } = {}) {
  const tags = ["lendingcart-lead", "book-demo"];
  const planTag = buildPlanTag(interestedPlanCode);
  if (planTag) tags.push(planTag);
  return [...new Set(tags)];
}

/**
 * Build customFields array from env field IDs + explicit values.
 */
function buildCustomFieldsFromValues({
  leadSource,
  leadType,
  interestedPlan,
  lendingCartLeadId,
} = {}) {
  const fields = [];
  const map = [
    ["leadSource", process.env.GHL_CF_LEAD_SOURCE, leadSource],
    ["leadType", process.env.GHL_CF_LEAD_TYPE, leadType],
    ["interestedPlan", process.env.GHL_CF_INTERESTED_PLAN, interestedPlan],
    ["lendingCartLeadId", process.env.GHL_CF_LEAD_ID, lendingCartLeadId],
  ];

  for (const [, fieldId, value] of map) {
    if (!fieldId || !String(fieldId).trim()) continue;
    if (value === undefined || value === null) continue;
    fields.push({
      id: String(fieldId).trim(),
      field_value: String(value),
    });
  }

  return fields;
}

function pickEmailMatch(contacts, normalizedEmail) {
  const list = Array.isArray(contacts) ? contacts : [];
  return (
    list.find(
      (contact) =>
        String(contact.email || "")
          .trim()
          .toLowerCase() === normalizedEmail,
    ) || null
  );
}

async function findContactByEmail(client, email) {
  const locationId = getLocationId();
  const normalized = String(email).trim().toLowerCase();

  // 1) Preferred: advanced search with email equality filter
  try {
    const res = await client.post("/contacts/search", {
      locationId,
      page: 1,
      pageLimit: 20,
      filters: [
        {
          field: "email",
          operator: "eq",
          value: normalized,
        },
      ],
    });

    const match = pickEmailMatch(
      res.data?.contacts || res.data?.data?.contacts,
      normalized,
    );
    if (match) return match;
  } catch (err) {
    logGhlError("contact search (filters)", err);
  }

  // 2) Query search
  try {
    const res = await client.post("/contacts/search", {
      locationId,
      page: 1,
      pageLimit: 20,
      query: normalized,
    });

    const match = pickEmailMatch(
      res.data?.contacts || res.data?.data?.contacts,
      normalized,
    );
    if (match) return match;
  } catch (err) {
    logGhlError("contact search (query)", err);
  }

  // 3) Deprecated list endpoint
  try {
    const res = await client.get("/contacts/", {
      params: {
        locationId,
        query: normalized,
        limit: 20,
      },
    });
    return pickEmailMatch(
      res.data?.contacts || res.data?.data?.contacts,
      normalized,
    );
  } catch (err) {
    logGhlError("contact list fallback", err);
    throw formatGhlHttpError(err);
  }
}

/**
 * If create fails with duplicate, GHL often returns the existing contactId.
 * Only auto-update when the conflict is on email (our upsert key).
 */
function extractDuplicateContactId(err) {
  const meta = err.response?.data?.meta;
  if (!meta?.contactId) return null;
  if (String(meta.matchingField || "").toLowerCase() !== "email") return null;
  return String(meta.contactId);
}

async function addTagsToContact(client, contactId, tags) {
  if (!contactId || !tags?.length) return;

  try {
    await client.post(`/contacts/${contactId}/tags`, { tags });
  } catch (err) {
    console.warn("GHL add tags warning:", sanitizeAxiosError(err));
  }
}

/**
 * Reusable GHL contact upsert (Contacts API).
 * Does not touch landing-lead routes — call this from callers when ready.
 *
 * @param {object} data
 * @param {string} data.email
 * @param {string} [data.firstName]
 * @param {string} [data.lastName]
 * @param {string} [data.phone]
 * @param {string} [data.companyName]
 * @param {string} [data.leadSource]
 * @param {string} [data.leadType]
 * @param {string} [data.interestedPlan]
 * @param {string} [data.lendingCartLeadId]
 * @param {string[]} [data.tags]
 * @returns {Promise<{ ghlContactId: string|null, created: boolean, updated: boolean }>}
 */
async function upsertGhlContact(data = {}) {
  requireContactApiCredentials();

  const email = data.email?.trim()?.toLowerCase();
  if (!email) {
    throw new Error("email is required for upsertGhlContact");
  }

  const locationId = getLocationId();
  const customFields = buildCustomFieldsFromValues({
    leadSource: data.leadSource,
    leadType: data.leadType,
    interestedPlan: data.interestedPlan,
    lendingCartLeadId: data.lendingCartLeadId,
  });

  const payload = {
    locationId,
    firstName: data.firstName || "",
    lastName: data.lastName || "",
    email,
    phone: data.phone || undefined,
    companyName: data.companyName || undefined,
  };

  if (customFields.length) {
    payload.customFields = customFields;
  }

  if (Array.isArray(data.tags) && data.tags.length) {
    payload.tags = [...new Set(data.tags.filter(Boolean))];
  }

  const client = createGhlApiClient();

  let existing;
  try {
    existing = await findContactByEmail(client, email);
  } catch (err) {
    throw err instanceof Error && err.message.startsWith("GHL")
      ? err
      : formatGhlHttpError(err);
  }

  async function updateExisting(contactId) {
    const { locationId: _loc, tags, ...updateBody } = payload;
    const res = await client.put(`/contacts/${contactId}`, updateBody);

    if (tags?.length) {
      await addTagsToContact(client, contactId, tags);
    }

    return {
      ghlContactId: contactId,
      created: false,
      updated: true,
      response: res.data,
    };
  }

  try {
    if (existing?.id) {
      return await updateExisting(existing.id);
    }

    try {
      const res = await client.post("/contacts/", payload);
      const ghlContactId =
        res.data?.contact?.id || res.data?.id || res.data?.contactId || null;

      if (ghlContactId && payload.tags?.length) {
        await addTagsToContact(client, ghlContactId, payload.tags);
      }

      return {
        ghlContactId,
        created: true,
        updated: false,
        response: res.data,
      };
    } catch (createErr) {
      const duplicateId = extractDuplicateContactId(createErr);
      if (duplicateId) {
        return await updateExisting(duplicateId);
      }
      throw createErr;
    }
  } catch (err) {
    logGhlError("contact upsert", err);
    throw formatGhlHttpError(err);
  }
}

/**
 * Thin book-demo wrapper around upsertGhlContact (kept for compatibility).
 */
async function upsertBookDemoContact(lead) {
  if (!isGhlEnabled()) {
    return { skipped: true, reason: "GHL_ENABLED=false" };
  }

  if (!canSyncContacts()) {
    throw new Error(
      "GHL contact sync requires GHL_API_KEY + GHL_LOCATION_ID",
    );
  }

  if (!lead?.email) {
    throw new Error("Email is required for GHL contact sync");
  }

  const result = await upsertGhlContact({
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    phone: lead.phone,
    companyName: lead.company,
    leadSource: "LendingCart Website",
    leadType: "Book Demo",
    interestedPlan: lead.interestedPlanName || lead.interestedPlanCode || "",
    lendingCartLeadId: lead.id || "",
    tags: buildTags(lead),
  });

  return {
    contactId: result.ghlContactId,
    ghlContactId: result.ghlContactId,
    created: result.created,
    updated: result.updated,
    response: result.response,
  };
}

module.exports = {
  triggerWebhook,
  upsertGhlContact,
  upsertBookDemoContact,
  canSyncContacts,
  buildTags,
  buildCustomFieldsFromValues,
  formatGhlHttpError,
  sanitizeAxiosError,
  getLocationId,
  requireContactApiCredentials,
};
