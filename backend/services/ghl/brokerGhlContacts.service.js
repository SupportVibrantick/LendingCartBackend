const { requestForOrganization } = require("./brokerGhlClient.service");
const { brokerGhlError, BROKER_GHL_ERROR_CODES } = require("./brokerGhlErrors");

function normalizeContactsList(payload) {
  const contacts =
    payload?.contacts ||
    payload?.data?.contacts ||
    payload?.data ||
    payload?.items ||
    [];
  const meta = payload?.meta || payload?.data?.meta || {};
  return {
    contacts: Array.isArray(contacts) ? contacts : [],
    meta,
    total: meta.total ?? payload?.total ?? null,
  };
}

function normalizeContact(payload) {
  return (
    payload?.contact ||
    payload?.data?.contact ||
    payload?.data ||
    payload ||
    null
  );
}

function buildContactPayload(locationId, input = {}) {
  const payload = {
    locationId,
    firstName: input.firstName || "",
    lastName: input.lastName || "",
  };

  if (input.email) payload.email = String(input.email).trim().toLowerCase();
  if (input.phone) payload.phone = String(input.phone).trim();
  if (input.companyName) payload.companyName = String(input.companyName).trim();
  if (input.source) payload.source = String(input.source).trim();
  if (Array.isArray(input.tags) && input.tags.length) {
    payload.tags = [...new Set(input.tags.filter(Boolean))];
  }
  if (input.customFields?.length) payload.customFields = input.customFields;

  return payload;
}

async function listContacts(prisma, organizationId, params = {}) {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
  const query = params.query ? String(params.query).trim() : undefined;

  const { getClientForOrganization } = require("./brokerGhlClient.service");
  const { locationId } = await getClientForOrganization(prisma, organizationId);

  if (query) {
    const data = await requestForOrganization(prisma, organizationId, {
      method: "POST",
      url: "/contacts/search",
      data: {
        locationId,
        page,
        pageLimit: limit,
        query,
      },
    });
    return normalizeContactsList(data);
  }

  const data = await requestForOrganization(prisma, organizationId, {
    method: "GET",
    url: "/contacts/",
    params: {
      locationId,
      limit,
      ...(params.startAfterId ? { startAfterId: params.startAfterId } : {}),
    },
  });

  return normalizeContactsList(data);
}

async function getContact(prisma, organizationId, contactId) {
  if (!contactId) {
    throw brokerGhlError(BROKER_GHL_ERROR_CODES.VALIDATION_FAILED, 400);
  }

  const data = await requestForOrganization(prisma, organizationId, {
    method: "GET",
    url: `/contacts/${contactId}`,
  });

  const contact = normalizeContact(data);
  if (!contact) {
    throw brokerGhlError(BROKER_GHL_ERROR_CODES.NOT_FOUND, 404);
  }

  return contact;
}

async function createContact(prisma, organizationId, input = {}) {
  const { getClientForOrganization } = require("./brokerGhlClient.service");
  const { locationId } = await getClientForOrganization(prisma, organizationId);

  const payload = buildContactPayload(locationId, input);
  if (!payload.email && !payload.phone) {
    throw brokerGhlError(BROKER_GHL_ERROR_CODES.VALIDATION_FAILED, 400);
  }

  const data = await requestForOrganization(prisma, organizationId, {
    method: "POST",
    url: "/contacts/",
    data: payload,
  });

  const contact = normalizeContact(data);
  if (!contact) {
    throw brokerGhlError(BROKER_GHL_ERROR_CODES.CONTACT_FAILED, 502);
  }

  return contact;
}

async function updateContact(prisma, organizationId, contactId, input = {}) {
  if (!contactId) {
    throw brokerGhlError(BROKER_GHL_ERROR_CODES.VALIDATION_FAILED, 400);
  }

  const { locationId: _locationId, tags, ...rest } = buildContactPayload(
    "unused",
    input,
  );
  const updateBody = { ...rest };
  if (tags?.length) updateBody.tags = tags;

  const data = await requestForOrganization(prisma, organizationId, {
    method: "PUT",
    url: `/contacts/${contactId}`,
    data: updateBody,
  });

  const contact = normalizeContact(data);
  if (!contact) {
    throw brokerGhlError(BROKER_GHL_ERROR_CODES.CONTACT_FAILED, 502);
  }

  return contact;
}

async function deleteContact(prisma, organizationId, contactId) {
  if (!contactId) {
    throw brokerGhlError(BROKER_GHL_ERROR_CODES.VALIDATION_FAILED, 400);
  }

  await requestForOrganization(prisma, organizationId, {
    method: "DELETE",
    url: `/contacts/${contactId}`,
  });

  return { deleted: true, contactId: String(contactId) };
}

module.exports = {
  normalizeContactsList,
  normalizeContact,
  buildContactPayload,
  listContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
};
