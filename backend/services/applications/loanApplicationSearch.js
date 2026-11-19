const { Prisma, LoanApplicationStatus, LoanProductCode } = require("@prisma/client");

/** Submission field keys used for pipeline free-text search. */
const SEARCHABLE_SUBMISSION_FIELD_KEYS = [
  "borrowerFirstName",
  "firstName",
  "first_name",
  "borrowerLastName",
  "lastName",
  "last_name",
  "borrowerName",
  "applicantName",
  "fullName",
  "name",
  "email",
  "phone",
  "cellPhone",
  "mobile",
  "mobilePhone",
  "ssn",
  "taxId",
  "socialSecurityNumber",
  "address",
  "street",
  "streetAddress",
  "streetName",
  "mailingAddress",
  "propertyAddress",
  "city",
  "propertyCity",
  "borrowerCity",
  "state",
  "propertyState",
  "borrowerState",
  "zip",
  "zipCode",
  "propertyZip",
  "entityLegalName",
  "entityName",
  "companyName",
  "businessName",
  "legalName",
];

/** Co-borrower / dynamic keys that end with these suffixes. */
const SEARCHABLE_FIELD_KEY_PATTERN =
  "(email|phone|ssn|taxId|address|city|state|entityName|entityLegalName|companyName|legalName|firstName|lastName|borrowerName|fullName)$";

function filterEnumMatches(search, enumValues) {
  const needle = search.trim().toLowerCase();
  if (!needle) return [];

  return enumValues.filter((value) => {
    const normalized = String(value).toLowerCase();
    const spaced = normalized.replace(/_/g, " ");
    return normalized.includes(needle) || spaced.includes(needle);
  });
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

/**
 * Sync Prisma OR clauses for LoanApplication free-text search.
 * Covers app #, purpose, product/status enums, client/contact, and optional broker org name.
 * Submission field values (JSON) are added via enrichApplicationSearchOrWithSubmissionFields.
 */
function buildApplicationSearchWhere(
  search,
  {
    includeBorrower = false,
    includeBrokerOrg = false,
    includeAssignedStaff = false,
  } = {},
) {
  const term = String(search || "").trim();
  if (!term) return [];

  const or = [
    { applicationNumber: { contains: term, mode: "insensitive" } },
    { purpose: { contains: term, mode: "insensitive" } },
  ];

  const statusMatches = filterEnumMatches(
    term,
    Object.values(LoanApplicationStatus),
  );
  if (statusMatches.length) {
    or.push({ status: { in: statusMatches } });
  }

  const productMatches = filterEnumMatches(
    term,
    Object.values(LoanProductCode),
  );
  if (productMatches.length) {
    or.push({ loanProductCode: { in: productMatches } });
  }

  if (includeBorrower) {
    const contactOr = [
      { firstName: { contains: term, mode: "insensitive" } },
      { lastName: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      { phone: { contains: term, mode: "insensitive" } },
    ];

    const digitTerm = digitsOnly(term);
    if (digitTerm.length >= 3 && digitTerm !== term) {
      contactOr.push({ phone: { contains: digitTerm } });
    }

    or.push({
      client: {
        is: {
          OR: [
            { legalName: { contains: term, mode: "insensitive" } },
            { taxId: { contains: term, mode: "insensitive" } },
            ...(digitTerm.length >= 3
              ? [{ taxId: { contains: digitTerm } }]
              : []),
            {
              contacts: {
                some: {
                  OR: contactOr,
                },
              },
            },
          ],
        },
      },
    });
  }

  if (includeBrokerOrg) {
    or.push({
      brokerOrg: {
        is: {
          name: { contains: term, mode: "insensitive" },
        },
      },
    });
  }

  if (includeAssignedStaff) {
    or.push({
      brokerUser: {
        is: {
          OR: [
            { firstName: { contains: term, mode: "insensitive" } },
            { lastName: { contains: term, mode: "insensitive" } },
            { email: { contains: term, mode: "insensitive" } },
          ],
        },
      },
    });
    or.push({
      subBrokerAssignments: {
        some: {
          subBroker: {
            OR: [
              { firstName: { contains: term, mode: "insensitive" } },
              { lastName: { contains: term, mode: "insensitive" } },
              { email: { contains: term, mode: "insensitive" } },
            ],
          },
        },
      },
    });
  }

  return or;
}

/**
 * Find application IDs whose submission field values match the search term
 * (name, email, phone, SSN, address, city, state, entity name, etc.).
 */
async function findApplicationIdsBySubmissionFieldSearch(
  prisma,
  search,
  { limit = 500 } = {},
) {
  const term = String(search || "").trim();
  if (!term || !prisma) return [];

  const like = `%${term}%`;
  const digitTerm = digitsOnly(term);
  const digitLike = digitTerm.length >= 3 ? `%${digitTerm}%` : null;

  try {
    const rows = digitLike
      ? await prisma.$queryRaw`
          SELECT DISTINCT s."applicationId" AS id
          FROM application_submission_fields f
          INNER JOIN application_submissions s ON s.id = f."submissionId"
          WHERE s.status <> 'SUPERSEDED'
            AND (
              f."fieldKey" IN (${Prisma.join(SEARCHABLE_SUBMISSION_FIELD_KEYS)})
              OR EXISTS (
                SELECT 1
                FROM broker_application_product_fields bf
                WHERE bf.id = f."fieldId"
                  AND bf."fieldKey" IN (${Prisma.join(SEARCHABLE_SUBMISSION_FIELD_KEYS)})
              )
              OR f."fieldKey" ~* ${SEARCHABLE_FIELD_KEY_PATTERN}
            )
            AND (
              (
                CASE
                  WHEN jsonb_typeof(f.value) = 'string' THEN f.value #>> '{}'
                  ELSE f.value::text
                END
              ) ILIKE ${like}
              OR regexp_replace(
                CASE
                  WHEN jsonb_typeof(f.value) = 'string' THEN f.value #>> '{}'
                  ELSE f.value::text
                END,
                '\\D',
                '',
                'g'
              ) LIKE ${digitLike}
            )
          LIMIT ${limit}
        `
      : await prisma.$queryRaw`
          SELECT DISTINCT s."applicationId" AS id
          FROM application_submission_fields f
          INNER JOIN application_submissions s ON s.id = f."submissionId"
          WHERE s.status <> 'SUPERSEDED'
            AND (
              f."fieldKey" IN (${Prisma.join(SEARCHABLE_SUBMISSION_FIELD_KEYS)})
              OR EXISTS (
                SELECT 1
                FROM broker_application_product_fields bf
                WHERE bf.id = f."fieldId"
                  AND bf."fieldKey" IN (${Prisma.join(SEARCHABLE_SUBMISSION_FIELD_KEYS)})
              )
              OR f."fieldKey" ~* ${SEARCHABLE_FIELD_KEY_PATTERN}
            )
            AND (
              CASE
                WHEN jsonb_typeof(f.value) = 'string' THEN f.value #>> '{}'
                ELSE f.value::text
              END
            ) ILIKE ${like}
          LIMIT ${limit}
        `;

    return (rows || [])
      .map((row) => row.id)
      .filter(Boolean);
  } catch (err) {
    console.error(
      "[loanApplicationSearch] submission field search failed:",
      err?.message || err,
    );
    return [];
  }
}

/**
 * Append submission-field matches onto an existing LoanApplication OR array.
 */
async function enrichApplicationSearchOrWithSubmissionFields(
  prisma,
  orClauses,
  search,
) {
  const term = String(search || "").trim();
  if (!term || !Array.isArray(orClauses)) return orClauses || [];

  const ids = await findApplicationIdsBySubmissionFieldSearch(prisma, term);
  if (ids.length) {
    orClauses.push({ id: { in: ids } });
  }
  return orClauses;
}

/**
 * Full async builder: borrower/contact + submission field value search.
 */
async function buildEnrichedApplicationSearchWhere(
  prisma,
  search,
  options = {},
) {
  const {
    includeBorrower = true,
    includeBrokerOrg = false,
    includeAssignedStaff = false,
    includeSubmissionFields = true,
  } = options;

  const or = buildApplicationSearchWhere(search, {
    includeBorrower,
    includeBrokerOrg,
    includeAssignedStaff,
  });

  if (includeSubmissionFields) {
    await enrichApplicationSearchOrWithSubmissionFields(prisma, or, search);
  }

  return or;
}

const loanApplicationListInclude = {
  client: {
    select: {
      id: true,
      legalName: true,
      entityType: true,
      contacts: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          isPrimary: true,
        },
        orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
      },
    },
  },
  submissions: {
    include: { fields: true },
  },
};

module.exports = {
  SEARCHABLE_SUBMISSION_FIELD_KEYS,
  buildApplicationSearchWhere,
  buildEnrichedApplicationSearchWhere,
  enrichApplicationSearchOrWithSubmissionFields,
  findApplicationIdsBySubmissionFieldSearch,
  loanApplicationListInclude,
};
