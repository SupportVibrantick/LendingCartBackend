const PLACEHOLDER_CLIENT_NAMES = new Set([
  "applicant",
  "client",
  "customer",
  "individual applicant",
  "individual",
]);

function normalizeText(value) {
  return String(value || "").trim();
}

function isPlaceholderClientName(name) {
  const normalized = normalizeText(name).toLowerCase();
  if (!normalized) return true;
  return PLACEHOLDER_CLIENT_NAMES.has(normalized);
}

function buildContactName(contact) {
  if (!contact) return "";
  return `${normalizeText(contact.firstName)} ${normalizeText(contact.lastName)}`
    .trim()
    .replace(/\s+/g, " ");
}

function extractFieldValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    return normalizeText(value.text ?? value.value ?? value.label ?? "");
  }
  return normalizeText(value);
}

function buildBorrowerNameFromFields(fields = []) {
  const fieldMap = new Map();

  for (const field of fields) {
    if (!field?.fieldKey) continue;
    fieldMap.set(field.fieldKey, extractFieldValue(field.value));
  }

  const firstName =
    fieldMap.get("borrowerFirstName") ||
    fieldMap.get("firstName") ||
    fieldMap.get("first_name") ||
    "";
  const lastName =
    fieldMap.get("borrowerLastName") ||
    fieldMap.get("lastName") ||
    fieldMap.get("last_name") ||
    "";

  return `${firstName} ${lastName}`.trim().replace(/\s+/g, " ");
}

async function resolveClientDisplayName(prisma, { clientId, client, contacts = [] }) {
  const primaryContact =
    contacts.find((contact) => contact.isPrimary) || contacts[0] || null;

  const contactName = buildContactName(primaryContact);
  if (contactName && !isPlaceholderClientName(contactName)) {
    return contactName;
  }

  const legalName = normalizeText(client?.legalName);
  if (legalName && !isPlaceholderClientName(legalName)) {
    return legalName;
  }

  const latestApplication = await prisma.loanApplication.findFirst({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    select: {
      submissions: {
        where: {
          status: { not: "SUPERSEDED" },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          fields: {
            select: {
              fieldKey: true,
              value: true,
            },
          },
        },
      },
    },
  });

  const borrowerName = buildBorrowerNameFromFields(
    latestApplication?.submissions?.[0]?.fields || [],
  );

  if (borrowerName && !isPlaceholderClientName(borrowerName)) {
    return borrowerName;
  }

  if (contactName) return contactName;
  if (legalName) return legalName;
  return "Client";
}

module.exports = {
  resolveClientDisplayName,
  isPlaceholderClientName,
  buildContactName,
  buildBorrowerNameFromFields,
};
