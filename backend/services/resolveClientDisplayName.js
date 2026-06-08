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
  isPlaceholderName,
  nameFromEmail,
};
