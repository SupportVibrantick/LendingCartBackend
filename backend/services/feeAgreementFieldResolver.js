const { pickField, buildSubmissionFieldMap } = require("./buildLoiTemplateData");
const {
  resolveClientDisplayNameFromData,
  resolveClientEntityLabelFromData,
} = require("./resolveClientDisplayName");

function isBlank(value) {
  if (value === null || value === undefined) return true;
  const text = String(value).trim();
  if (!text) return true;
  const lower = text.toLowerCase();
  return lower === "n/a" || lower === "na" || text === "—" || text === "-";
}

function coalesce(...values) {
  for (const value of values) {
    if (!isBlank(value)) return value;
  }
  return null;
}

function extractSubmissionFieldMap(submission) {
  if (!submission) return {};
  return buildSubmissionFieldMap(submission.fields || []);
}

function joinAddressParts(...parts) {
  return parts
    .map((part) => (part == null ? "" : String(part).trim()))
    .filter(Boolean)
    .join(", ");
}

function formatStreetCityStateZip(fieldMap, prefix = "") {
  const street = pickField(
    fieldMap,
    prefix ? `${prefix}Street` : "propertyStreet",
    prefix ? `${prefix}Address` : "propertyAddress",
    "address_line1",
    "addressLine1",
    "street",
  );
  const city = pickField(
    fieldMap,
    prefix ? `${prefix}City` : "propertyCity",
    "city",
    "borrowerCity",
  );
  const state = pickField(
    fieldMap,
    prefix ? `${prefix}State` : "propertyState",
    "state",
    "borrowerState",
  );
  const zip = pickField(
    fieldMap,
    prefix ? `${prefix}Zip` : "propertyZip",
    "zip",
    "zipCode",
    "postalCode",
  );

  const line1 = street;
  const line2 = joinAddressParts(city, state, zip);
  return joinAddressParts(line1, line2);
}

function resolveSubjectAddress(fieldMap = {}) {
  const direct = pickField(
    fieldMap,
    "propertyAddress",
    "property_address",
    "businessAddress",
    "business_address",
    "subjectProperty",
    "subject_property",
    "subjectAddress",
  );

  if (direct) return direct;

  const composed = formatStreetCityStateZip(fieldMap);
  return composed || null;
}

function resolveClientMailingAddress(fieldMap = {}, primaryContact = null) {
  const direct = pickField(
    fieldMap,
    "address",
    "borrowerAddress",
    "mailingAddress",
    "clientAddress",
    "homeAddress",
  );

  if (direct) return direct;

  const composed = joinAddressParts(
    pickField(fieldMap, "address_line1", "addressLine1", "street"),
    joinAddressParts(
      pickField(fieldMap, "city", "borrowerCity"),
      pickField(fieldMap, "state", "borrowerState"),
      pickField(fieldMap, "zip", "zipCode", "postalCode"),
    ),
  );

  if (composed) return composed;
  if (primaryContact?.address && !isBlank(primaryContact.address)) {
    return primaryContact.address;
  }

  return null;
}

function resolveIssuerPropertyAddress(fieldMap = {}, subjectAddress = null, primaryContact = null) {
  return (
    coalesce(
      resolveClientMailingAddress(fieldMap, primaryContact),
      subjectAddress,
      resolveSubjectAddress(fieldMap),
    ) || null
  );
}

function formatBrokerProfileAddress(profile) {
  if (!profile) return null;

  const line1 = joinAddressParts(profile.address, profile.suite);
  const line2 = joinAddressParts(profile.city, profile.state, profile.zipCode);

  return coalesce(joinAddressParts(line1, line2), line1, line2);
}

function resolveBrokerContact(brokerUser = null, brokerOrg = null, orgBrokerUser = null) {
  const profileUser = brokerUser?.brokerProfile
    ? brokerUser
    : orgBrokerUser?.brokerProfile
      ? orgBrokerUser
      : brokerUser || orgBrokerUser;

  const profile = profileUser?.brokerProfile || null;
  const user = profileUser || brokerUser || orgBrokerUser || null;

  const brokerName =
    user && (user.firstName || user.lastName)
      ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
      : null;

  return {
    brokerName: coalesce(brokerName, brokerOrg?.name),
    brokerCompany: coalesce(profile?.company, brokerOrg?.name),
    brokerEmail: coalesce(user?.email, brokerOrg?.email),
    brokerPhone: coalesce(user?.phone, brokerOrg?.phone, profile?.tollFree),
    brokerAddress: formatBrokerProfileAddress(profile),
    brokerState: profile?.state || null,
    brokerCounty: null,
  };
}

async function loadOrgBrokerUser(prisma, brokerOrgId, brokerUserId = null) {
  if (!prisma || !brokerOrgId) return null;

  if (brokerUserId) {
    const assigned = await prisma.userAccount.findUnique({
      where: { id: brokerUserId },
      include: { brokerProfile: true },
    });
    if (assigned) return assigned;
  }

  return prisma.userAccount.findFirst({
    where: {
      organizationId: brokerOrgId,
      status: "ACTIVE",
    },
    include: { brokerProfile: true },
    orderBy: { createdAt: "asc" },
  });
}

function resolveFeeAgreementSnapshot({
  loanApplication,
  submission = null,
  primaryContact = null,
  orgBrokerUser = null,
}) {
  const fieldMap = extractSubmissionFieldMap(submission);
  const submissions = submission ? [submission] : loanApplication?.submissions || [];
  const client = loanApplication?.client;
  const brokerOrg = loanApplication?.brokerOrg;
  const brokerUser = loanApplication?.brokerUser;

  const subjectAddress = resolveSubjectAddress(fieldMap);
  const issuerPropertyAddress = resolveIssuerPropertyAddress(
    fieldMap,
    subjectAddress,
    primaryContact,
  );

  const brokerContact = resolveBrokerContact(
    brokerUser,
    brokerOrg,
    orgBrokerUser,
  );

  const propertyState = pickField(
    fieldMap,
    "propertyState",
    "state",
    "borrowerState",
  );

  return {
    clientName: resolveClientDisplayNameFromData(client, submissions),
    clientEntityName: resolveClientEntityLabelFromData(client, submissions),
    clientEmail: coalesce(
      primaryContact?.email,
      pickField(fieldMap, "email", "borrowerEmail", "clientEmail"),
    ),
    clientPhone: coalesce(
      primaryContact?.phone,
      pickField(fieldMap, "phone", "borrowerPhone", "mobile", "cell"),
    ),
    clientAddress: issuerPropertyAddress,
    subjectAddress,
    brokerState: coalesce(brokerContact.brokerState, propertyState),
    ...brokerContact,
  };
}

function mergeMissingFeeAgreementFields(stored = {}, resolved = {}) {
  const merged = { ...stored };

  for (const key of [
    "clientName",
    "clientEntityName",
    "clientEmail",
    "clientPhone",
    "clientAddress",
    "subjectAddress",
    "brokerName",
    "brokerCompany",
    "brokerEmail",
    "brokerPhone",
    "brokerAddress",
    "brokerState",
    "brokerCounty",
  ]) {
    if (isBlank(merged[key]) && !isBlank(resolved[key])) {
      merged[key] = resolved[key];
    }
  }

  return merged;
}

function hasResolvableFieldGaps(stored = {}, merged = {}) {
  return [
    "clientAddress",
    "subjectAddress",
    "brokerAddress",
    "brokerState",
    "brokerEmail",
    "brokerPhone",
  ].some((key) => isBlank(stored[key]) && !isBlank(merged[key]));
}

module.exports = {
  extractSubmissionFieldMap,
  resolveSubjectAddress,
  resolveClientMailingAddress,
  resolveIssuerPropertyAddress,
  resolveBrokerContact,
  loadOrgBrokerUser,
  resolveFeeAgreementSnapshot,
  mergeMissingFeeAgreementFields,
  hasResolvableFieldGaps,
};
