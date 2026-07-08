const prisma = require("../../prisma/client");
const {
  ensureLenderProfileFields,
} = require("../../prisma/ensureLenderProfileFields");

const EXTENDED_FIELD_NAMES = [
  "lendingCriteria",
  "lendingGuidelines",
  "creditRequirements",
  "propertyRequirements",
  "website",
  "nmls",
  "address",
  "city",
  "state",
  "zip",
  "lenderType",
];

const EMPTY_EXTENDED_FIELDS = Object.fromEntries(
  EXTENDED_FIELD_NAMES.map((name) => [name, null]),
);

function pickExtendedFields(source = {}) {
  const fields = {};

  for (const name of EXTENDED_FIELD_NAMES) {
    if (source[name] !== undefined) {
      fields[name] = source[name] || null;
    }
  }

  return fields;
}

async function ensureLenderProfileRow(lenderOrgId) {
  await prisma.lenderProfile.upsert({
    where: { lenderOrgId },
    create: { lenderOrgId },
    update: {},
  });
}

async function readExtendedLenderProfileFields(lenderOrgId) {
  await ensureLenderProfileFields();

  const rows = await prisma.$queryRaw`
    SELECT
      "lendingCriteria",
      "lendingGuidelines",
      "creditRequirements",
      "propertyRequirements",
      "website",
      "nmls",
      "address",
      "city",
      "state",
      "zip",
      "lenderType"
    FROM "lender_profiles"
    WHERE "lenderOrgId" = ${lenderOrgId}::uuid
    LIMIT 1
  `;

  const row = rows?.[0];

  if (!row) {
    return { ...EMPTY_EXTENDED_FIELDS };
  }

  return {
    lendingCriteria: row.lendingCriteria ?? null,
    lendingGuidelines: row.lendingGuidelines ?? null,
    creditRequirements: row.creditRequirements ?? null,
    propertyRequirements: row.propertyRequirements ?? null,
    website: row.website ?? null,
    nmls: row.nmls ?? null,
    address: row.address ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    zip: row.zip ?? null,
    lenderType: row.lenderType ?? null,
  };
}

async function writeExtendedLenderProfileFields(lenderOrgId, fields) {
  const payload = pickExtendedFields(fields);

  if (Object.keys(payload).length === 0) {
    return;
  }

  await ensureLenderProfileFields();
  await ensureLenderProfileRow(lenderOrgId);

  for (const [key, value] of Object.entries(payload)) {
    await prisma.$executeRawUnsafe(
      `UPDATE "lender_profiles" SET "${key}" = $1 WHERE "lenderOrgId" = $2::uuid`,
      value,
      lenderOrgId,
    );
  }
}

module.exports = {
  EXTENDED_FIELD_NAMES,
  pickExtendedFields,
  readExtendedLenderProfileFields,
  writeExtendedLenderProfileFields,
  ensureLenderProfileRow,
};
