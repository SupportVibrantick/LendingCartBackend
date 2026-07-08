const PLACEHOLDER_NAMES = new Set([
  "Applicant",
  "Individual Applicant",
  "Unknown",
  "Client",
  "Customer",
  "N/A",
]);

function isPlaceholderName(name) {
  if (!name) return true;
  const trimmed = String(name).trim();
  return !trimmed || PLACEHOLDER_NAMES.has(trimmed);
}

function buildFullName(first, last) {
  return [first, last].filter(Boolean).join(" ").trim();
}

function getSubmissionFieldValues(submissions, keys) {
  for (const submission of submissions || []) {
    for (const field of submission.fields || []) {
      const key = field.builderField?.fieldKey || field.fieldKey;
      if (!keys.includes(key) || field.value == null || field.value === "") continue;

      const raw = field.value;
      if (typeof raw === "string") return raw.trim();
      if (typeof raw === "number") return String(raw);
      if (typeof raw === "object" && raw !== null && raw.value != null) {
        return String(raw.value).trim();
      }
      return String(raw).trim();
    }
  }
  return null;
}

function nameFromEmail(email) {
  if (!email || !email.includes("@")) return null;
  const local = email.split("@")[0].replace(/\d+/g, " ").replace(/[._-]+/g, " ").trim();
  if (local.length < 2) return null;

  const words = local.split(/\s+/).filter(Boolean);
  const formatted = words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  return isPlaceholderName(formatted) ? null : formatted;
}

function formatEntityTypeLabel(value) {
  if (!value) return null;
  return String(value)
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isGenericIndividualEntityType(value) {
  if (!value) return true;
  const normalized = String(value).trim().toUpperCase().replace(/\s+/g, "_");
  return (
    normalized === "INDIVIDUAL" ||
    normalized === "SOLE_PROPRIETOR" ||
    normalized === "SOLE_PROPRIETORSHIP"
  );
}

function resolveClientEntityLabelFromData(client, submissions = []) {
  const entityLegalName = getSubmissionFieldValues(submissions, [
    "entityLegalName",
    "businessName",
    "businessLegalName",
    "companyName",
    "dba",
    "doingBusinessAs",
  ]);

  if (!isPlaceholderName(entityLegalName)) {
    return entityLegalName;
  }

  const displayName = resolveClientDisplayNameFromData(client, submissions);
  const clientLegalName = client?.legalName?.trim();

  if (
    clientLegalName &&
    !isPlaceholderName(clientLegalName) &&
    clientLegalName !== displayName
  ) {
    return clientLegalName;
  }

  const submissionEntityType = getSubmissionFieldValues(submissions, [
    "entityType",
    "borrowerEntityType",
    "businessEntityType",
  ]);

  if (submissionEntityType && !isGenericIndividualEntityType(submissionEntityType)) {
    return formatEntityTypeLabel(submissionEntityType);
  }

  const clientEntityType = client?.entityType;
  if (clientEntityType && !isGenericIndividualEntityType(clientEntityType)) {
    return formatEntityTypeLabel(clientEntityType);
  }

  return null;
}

function resolveClientDisplayNameFromData(client, submissions = []) {
  const primaryContact =
    client?.contacts?.find((contact) => contact.isPrimary) || client?.contacts?.[0];

  const primaryContactName = buildFullName(
    primaryContact?.firstName,
    primaryContact?.lastName,
  );

  if (!isPlaceholderName(primaryContactName)) {
    return primaryContactName;
  }

  for (const contact of client?.contacts || []) {
    const contactName = buildFullName(contact.firstName, contact.lastName);
    if (!isPlaceholderName(contactName)) {
      return contactName;
    }
  }

  const borrowerFirstName = getSubmissionFieldValues(submissions, [
    "borrowerFirstName",
    "first_name",
    "firstName",
  ]);
  const borrowerLastName = getSubmissionFieldValues(submissions, [
    "borrowerLastName",
    "last_name",
    "lastName",
  ]);
  const submissionName = buildFullName(borrowerFirstName, borrowerLastName);

  if (!isPlaceholderName(submissionName)) {
    return submissionName;
  }

  const singleFieldName = getSubmissionFieldValues(submissions, [
    "borrowerName",
    "applicantName",
    "fullName",
    "name",
    "legalName",
    "businessName",
  ]);

  if (!isPlaceholderName(singleFieldName)) {
    return singleFieldName;
  }

  if (!isPlaceholderName(client?.legalName)) {
    return client.legalName.trim();
  }

  const emailName =
    nameFromEmail(primaryContact?.email) ||
    nameFromEmail(client?.contacts?.find((c) => c.email)?.email);

  if (emailName) {
    return emailName;
  }

  return "Client";
}

function resolveClientEntityTypeFromData(client, submissions = []) {
  const submissionEntityType = getSubmissionFieldValues(submissions, [
    "entityType",
    "borrowerEntityType",
    "businessEntityType",
  ]);

  if (submissionEntityType) {
    return submissionEntityType;
  }

  if (client?.entityType && !isGenericIndividualEntityType(client.entityType)) {
    return client.entityType;
  }

  return client?.entityType || null;
}

function resolveClientIndustryFromData(client, submissions = []) {
  if (client?.industry?.trim()) {
    return client.industry.trim();
  }

  const directIndustry = getSubmissionFieldValues(submissions, [
    "industry",
    "business_industry",
    "businessIndustry",
    "businessType",
    "business_type",
    "naics",
    "naicsCode",
  ]);

  if (directIndustry) {
    return directIndustry;
  }

  const propertyType = getSubmissionFieldValues(submissions, ["propertyType"]);
  const subPropertyType = getSubmissionFieldValues(submissions, ["subPropertyType"]);

  if (propertyType && subPropertyType) {
    return `${formatEntityTypeLabel(propertyType)} · ${formatEntityTypeLabel(subPropertyType)}`;
  }

  if (propertyType) {
    return formatEntityTypeLabel(propertyType);
  }

  if (subPropertyType) {
    return formatEntityTypeLabel(subPropertyType);
  }

  return null;
}

function resolveClientEmailFromData(client, submissions = []) {
  const primaryContact =
    client?.contacts?.find((contact) => contact.isPrimary) || client?.contacts?.[0];

  if (primaryContact?.email?.trim()) {
    return primaryContact.email.trim();
  }

  for (const contact of client?.contacts || []) {
    if (contact.email?.trim()) {
      return contact.email.trim();
    }
  }

  return getSubmissionFieldValues(submissions, [
    "email",
    "borrowerEmail",
    "clientEmail",
    "contactEmail",
  ]);
}

function resolveClientPhoneFromData(client, submissions = []) {
  const primaryContact =
    client?.contacts?.find((contact) => contact.isPrimary) || client?.contacts?.[0];

  if (primaryContact?.phone?.trim()) {
    return primaryContact.phone.trim();
  }

  for (const contact of client?.contacts || []) {
    if (contact.phone?.trim()) {
      return contact.phone.trim();
    }
  }

  return getSubmissionFieldValues(submissions, [
    "phone",
    "mobile",
    "borrowerPhone",
    "phone_number",
    "phoneNumber",
    "cellPhone",
    "cell_phone",
    "borrower_phone",
  ]);
}

function resolveClientPrimaryContactFromData(client, submissions = []) {
  const primaryContact =
    client?.contacts?.find((contact) => contact.isPrimary) || client?.contacts?.[0] || null;
  const phone = resolveClientPhoneFromData(client, submissions);

  if (primaryContact) {
    return {
      ...primaryContact,
      phone: phone || primaryContact.phone || null,
    };
  }

  if (!phone) {
    return null;
  }

  return {
    firstName: "",
    lastName: "",
    email: "",
    phone,
    isPrimary: true,
  };
}

async function resolveClientDisplayName(
  prisma,
  { clientId, loanApplicationId } = {},
) {
  const client = clientId
    ? await prisma.client.findUnique({
        where: { id: clientId },
        include: {
          contacts: {
            orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
          },
        },
      })
    : null;

  let submissions = [];

  if (loanApplicationId) {
    const loan = await prisma.loanApplication.findUnique({
      where: { id: loanApplicationId },
      select: {
        submissions: {
          orderBy: { createdAt: "desc" },
          include: {
            fields: {
              include: {
                builderField: {
                  select: { fieldKey: true },
                },
              },
            },
          },
        },
      },
    });

    submissions = loan?.submissions || [];
  } else if (clientId) {
    const latestApp = await prisma.loanApplication.findFirst({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      select: {
        submissions: {
          orderBy: { createdAt: "desc" },
          include: {
            fields: {
              include: {
                builderField: {
                  select: { fieldKey: true },
                },
              },
            },
          },
        },
      },
    });

    submissions = latestApp?.submissions || [];
  }

  return resolveClientDisplayNameFromData(client, submissions);
}

module.exports = {
  resolveClientDisplayName,
  resolveClientDisplayNameFromData,
  resolveClientEntityLabelFromData,
  resolveClientEntityTypeFromData,
  resolveClientIndustryFromData,
  resolveClientEmailFromData,
  resolveClientPhoneFromData,
  resolveClientPrimaryContactFromData,
  isPlaceholderName,
  nameFromEmail,
};
