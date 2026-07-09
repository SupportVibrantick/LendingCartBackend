const GENERIC_CLIENT_NAMES = new Set([
  "individual applicant",
  "applicant",
  "customer",
  "client",
]);

function normalizeFieldValue(value) {
  if (value == null) return "";
  return String(value).trim();
}

function readFieldValue(fields, keys) {
  for (const key of keys) {
    const match = fields.find((field) => field.fieldKey === key);
    const value = normalizeFieldValue(match?.value);
    if (value) return value;
  }
  return "";
}

function resolveBorrowerNameParts(fields = []) {
  const firstName = readFieldValue(fields, [
    "first_name",
    "borrowerFirstName",
    "firstName",
  ]);
  const lastName = readFieldValue(fields, [
    "last_name",
    "borrowerLastName",
    "lastName",
  ]);

  const fullName = readFieldValue(fields, [
    "name",
    "borrowerName",
    "full_name",
    "borrower_full_name",
  ]);

  if (!firstName && !lastName && fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    return {
      firstName: parts[0] || "",
      lastName: parts.slice(1).join(" "),
      displayName: fullName,
    };
  }

  return {
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`.trim(),
  };
}

function isGenericClientName(name) {
  const normalized = normalizeFieldValue(name).toLowerCase();
  return !normalized || GENERIC_CLIENT_NAMES.has(normalized);
}

function resolveClientDisplayName({ client, contacts, fields } = {}) {
  const fromFields = resolveBorrowerNameParts(fields);
  if (fromFields.displayName && !isGenericClientName(fromFields.displayName)) {
    return fromFields.displayName;
  }

  const primaryContact =
    contacts?.find((contact) => contact.isPrimary) || contacts?.[0];
  const fromContact = `${primaryContact?.firstName || ""} ${
    primaryContact?.lastName || ""
  }`.trim();

  if (fromContact && !isGenericClientName(fromContact)) {
    return fromContact;
  }

  const legalName = normalizeFieldValue(client?.legalName);
  if (legalName && !isGenericClientName(legalName)) {
    return legalName;
  }

  return fromFields.displayName || fromContact || legalName || "Customer";
}

function resolveBorrowerEmail(fields = []) {
  return readFieldValue(fields, ["email", "borrowerEmail"]);
}

module.exports = {
  resolveBorrowerNameParts,
  resolveClientDisplayName,
  resolveBorrowerEmail,
  isGenericClientName,
  readFieldValue,
};
