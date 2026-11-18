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

const EXTENDED_FIELD_SELECT = Object.fromEntries(
  EXTENDED_FIELD_NAMES.map((name) => [name, true]),
);

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

function mapExtendedFields(source = {}) {
  return {
    lendingCriteria: source.lendingCriteria ?? null,
    lendingGuidelines: source.lendingGuidelines ?? null,
    creditRequirements: source.creditRequirements ?? null,
    propertyRequirements: source.propertyRequirements ?? null,
    website: source.website ?? null,
    nmls: source.nmls ?? null,
    address: source.address ?? null,
    city: source.city ?? null,
    state: source.state ?? null,
    zip: source.zip ?? null,
    lenderType: source.lenderType ?? null,
  };
}

async function ensureLenderProfileRow(lenderOrgId) {
  await prisma.lenderProfile.upsert({
    where: { lenderOrgId },
    create: { lenderOrgId },
    update: {},
  });
}

async function readExtendedLenderProfileFields(lenderOrgId) {
  const profile = await prisma.lenderProfile.findUnique({
    where: { lenderOrgId },
    select: EXTENDED_FIELD_SELECT,
  });

  if (!profile) {
    return { ...EMPTY_EXTENDED_FIELDS };
  }

  return mapExtendedFields(profile);
}

async function writeExtendedLenderProfileFields(lenderOrgId, fields) {
  const payload = pickExtendedFields(fields);

  if (Object.keys(payload).length === 0) {
    return;
  }

  // Keep a one-time schema ensure for older environments; cached per process.
  await ensureLenderProfileFields();
  await ensureLenderProfileRow(lenderOrgId);

  await prisma.lenderProfile.update({
    where: { lenderOrgId },
    data: payload,
  });
}

module.exports = {
  EXTENDED_FIELD_NAMES,
  EXTENDED_FIELD_SELECT,
  pickExtendedFields,
  mapExtendedFields,
  readExtendedLenderProfileFields,
  writeExtendedLenderProfileFields,
  ensureLenderProfileRow,
};
