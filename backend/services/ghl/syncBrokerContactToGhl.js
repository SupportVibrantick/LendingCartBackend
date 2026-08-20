const {
  createContact,
  updateContact,
  listContacts,
} = require("./brokerGhlContacts.service");
const { buildContactPayload } = require("./brokerGhlContacts.service");

function mapLendingCartContactToGhl(contact = {}) {
  const phone =
    contact.phone ||
    contact.cellNumber ||
    contact.tollFree ||
    contact.faxNumber ||
    undefined;

  const tags = Array.isArray(contact.tags)
    ? contact.tags
    : ["lendingcart-contact"];

  const source =
    contact.source ||
    contact.leadSource ||
    (contact.contactType ? `LendingCart ${contact.contactType}` : "LendingCart");

  return buildContactPayload("placeholder", {
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    phone,
    companyName: contact.companyName,
    source,
    tags,
  });
}

function pickEmailMatch(contacts, normalizedEmail) {
  const list = Array.isArray(contacts) ? contacts : [];
  return (
    list.find(
      (item) =>
        String(item.email || "")
          .trim()
          .toLowerCase() === normalizedEmail,
    ) || null
  );
}

/**
 * Sync a LendingCart contact to the broker's connected GHL location.
 * Does not persist GHL IDs on the LendingCart contact yet — returns GHL payload result only.
 *
 * @param {object} prisma
 * @param {string} organizationId
 * @param {object} contact LendingCart contact or compatible shape
 * @returns {Promise<{ action: 'created'|'updated', ghlContact: object }>}
 */
async function syncBrokerContactToGhl(prisma, organizationId, contact = {}) {
  const payload = mapLendingCartContactToGhl(contact);
  const email = payload.email;

  if (email) {
    const search = await listContacts(prisma, organizationId, {
      query: email,
      limit: 20,
    });
    const existing = pickEmailMatch(search.contacts, email);

    if (existing?.id) {
      const updated = await updateContact(
        prisma,
        organizationId,
        existing.id,
        payload,
      );
      return { action: "updated", ghlContact: updated };
    }
  }

  const created = await createContact(prisma, organizationId, payload);
  return { action: "created", ghlContact: created };
}

module.exports = {
  mapLendingCartContactToGhl,
  syncBrokerContactToGhl,
};
