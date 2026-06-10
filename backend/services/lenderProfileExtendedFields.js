const prisma = require("../prisma/client");
const {
  ensureLenderProfileFields,
} = require("../prisma/ensureLenderProfileFields");

const EXTENDED_FIELD_NAMES = [
  "lendingCriteria",
  "lendingGuidelines",
  "creditRequirements",
  "propertyRequirements",
];

function pickExtendedFields(source = {}) {
  const fields = {};

  for (const name of EXTENDED_FIELD_NAMES) {
    if (source[name] !== undefined) {
      fields[name] = source[name] || null;
    }
  }

  return fields;
}

async function readExtendedLenderProfileFields(lenderOrgId) {
  await ensureLenderProfileFields();

  const rows = await prisma.$queryRaw`
    SELECT
      "lendingCriteria",
      "lendingGuidelines",
      "creditRequirements",
      "propertyRequirements"
    FROM "lender_profiles"
    WHERE "lenderOrgId" = ${lenderOrgId}::uuid
    LIMIT 1
  `;

  const row = rows?.[0];

  if (!row) {
    return {
      lendingCriteria: null,
      lendingGuidelines: null,
      creditRequirements: null,
      propertyRequirements: null,
    };
  }

  return {
    lendingCriteria: row.lendingCriteria ?? null,
    lendingGuidelines: row.lendingGuidelines ?? null,
    creditRequirements: row.creditRequirements ?? null,
    propertyRequirements: row.propertyRequirements ?? null,
  };
}

async function writeExtendedLenderProfileFields(lenderOrgId, fields) {
  const payload = pickExtendedFields(fields);

  if (Object.keys(payload).length === 0) {
    return;
  }

  await ensureLenderProfileFields();

  await prisma.$executeRaw`
    UPDATE "lender_profiles"
    SET
      "lendingCriteria" = COALESCE(${payload.lendingCriteria ?? null}, "lendingCriteria"),
      "lendingGuidelines" = COALESCE(${payload.lendingGuidelines ?? null}, "lendingGuidelines"),
      "creditRequirements" = COALESCE(${payload.creditRequirements ?? null}, "creditRequirements"),
      "propertyRequirements" = COALESCE(${payload.propertyRequirements ?? null}, "propertyRequirements")
    WHERE "lenderOrgId" = ${lenderOrgId}::uuid
  `;
}

module.exports = {
  EXTENDED_FIELD_NAMES,
  pickExtendedFields,
  readExtendedLenderProfileFields,
  writeExtendedLenderProfileFields,
};
