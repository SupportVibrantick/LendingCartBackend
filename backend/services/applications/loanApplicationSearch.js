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
  "ssnLast4",
  "taxId",
  "ein",
  "itin",
  "socialSecurityNumber",
  "social_security_number",
  "address",
  "street",
  "streetAddress",
  "streetName",
  "street_name",
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

const FIRST_NAME_KEYS = ["borrowerFirstName", "firstName", "first_name"];
const LAST_NAME_KEYS = ["borrowerLastName", "lastName", "last_name"];
const FULL_NAME_KEYS = ["borrowerName", "applicantName", "fullName"];

/** Co-borrower / dynamic keys that end with these suffixes. */
const SEARCHABLE_FIELD_KEY_PATTERN =
  "(email|phone|ssn|ssnLast4|taxId|ein|itin|address|street|streetName|city|state|zip|entityName|entityLegalName|companyName|businessName|legalName|firstName|lastName|borrowerName|fullName)$";

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

function searchTokens(search) {
  const seen = new Set();
  const tokens = [];
  for (const part of String(search || "")
    .trim()
    .split(/\s+/)) {
    const token = part.trim().toLowerCase();
    if (!token || seen.has(token)) continue;
    seen.add(token);
    tokens.push(part.trim());
  }
  return tokens;
}

/** First + last name pairing on a single contact (not token scatter). */
function contactNamePairOr(tokens) {
  if (tokens.length < 2) return null;
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  return {
    OR: [
      {
        AND: [
          { firstName: { contains: first, mode: "insensitive" } },
          { lastName: { contains: last, mode: "insensitive" } },
        ],
      },
      {
        AND: [
          { firstName: { contains: last, mode: "insensitive" } },
          { lastName: { contains: first, mode: "insensitive" } },
        ],
      },
    ],
  };
}

function personNameFieldOr(term) {
  return [
    { firstName: { contains: term, mode: "insensitive" } },
    { lastName: { contains: term, mode: "insensitive" } },
    { email: { contains: term, mode: "insensitive" } },
  ];
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

  const tokens = searchTokens(term);
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
    // Email / phone / tax ID on the Client record. Do not match contact
    // first/last or legalName here — reused portal clients would return
    // every file on that client even when the displayed borrower differs.
    // Names, address, entity, and SSN are matched from submission fields.
    const contactOr = [
      { email: { contains: term, mode: "insensitive" } },
      { phone: { contains: term, mode: "insensitive" } },
    ];

    const digitTerm = digitsOnly(term);
    if (digitTerm.length >= 3 && digitTerm !== term) {
      contactOr.push({ phone: { contains: digitTerm } });
    }

    const clientOr = [
      { taxId: { contains: term, mode: "insensitive" } },
      ...(digitTerm.length >= 3 ? [{ taxId: { contains: digitTerm } }] : []),
      {
        contacts: {
          some: {
            OR: contactOr,
          },
        },
      },
    ];

    or.push({
      client: {
        is: {
          OR: clientOr,
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
    // Search assigned LO / co-broker only — never brokerUser (creator/admin),
    // or searching the logged-in broker's own name would return every app.
    const staffOr = personNameFieldOr(term);
    const staffMulti = contactNamePairOr(tokens);
    if (staffMulti) staffOr.push(staffMulti);

    or.push({
      loanOfficerAssignments: {
        some: {
          loanOfficer: {
            OR: staffOr,
          },
        },
      },
    });
    or.push({
      subBrokerAssignments: {
        some: {
          subBroker: {
            OR: staffOr,
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
 * Match the displayed borrower: first+last pairing, or a full-name field.
 * Used for queries like "Tushar Jain" so split name fields still hit.
 */
async function findApplicationIdsByBorrowerNameSearch(
  prisma,
  search,
  { limit = 500 } = {},
) {
  const term = String(search || "").trim();
  if (!term || !prisma) return [];

  const tokens = String(term).split(/\s+/).filter(Boolean);
  const like = `%${term}%`;
  const firstLike = `%${tokens[0]}%`;
  const lastLike = `%${tokens[tokens.length - 1]}%`;
  const nameKeys = [...FIRST_NAME_KEYS, ...LAST_NAME_KEYS, ...FULL_NAME_KEYS];

  try {
    const rows = await prisma.$queryRaw`
      SELECT DISTINCT s."applicationId" AS id
      FROM application_submissions s
      WHERE s.status <> 'SUPERSEDED'
        AND (
          EXISTS (
            SELECT 1
            FROM application_submission_fields f
            LEFT JOIN broker_application_product_fields bf ON bf.id = f."fieldId"
            WHERE f."submissionId" = s.id
              AND COALESCE(NULLIF(f."fieldKey", ''), bf."fieldKey") IN (${Prisma.join(nameKeys)})
              AND (
                CASE
                  WHEN jsonb_typeof(f.value) = 'string' THEN f.value #>> '{}'
                  ELSE f.value::text
                END
              ) ILIKE ${like}
          )
          OR (
            EXISTS (
              SELECT 1
              FROM application_submission_fields f
              LEFT JOIN broker_application_product_fields bf ON bf.id = f."fieldId"
              WHERE f."submissionId" = s.id
                AND COALESCE(NULLIF(f."fieldKey", ''), bf."fieldKey") IN (${Prisma.join(FIRST_NAME_KEYS)})
                AND (
                  CASE
                    WHEN jsonb_typeof(f.value) = 'string' THEN f.value #>> '{}'
                    ELSE f.value::text
                  END
                ) ILIKE ${firstLike}
            )
            AND EXISTS (
              SELECT 1
              FROM application_submission_fields f
              LEFT JOIN broker_application_product_fields bf ON bf.id = f."fieldId"
              WHERE f."submissionId" = s.id
                AND COALESCE(NULLIF(f."fieldKey", ''), bf."fieldKey") IN (${Prisma.join(LAST_NAME_KEYS)})
                AND (
                  CASE
                    WHEN jsonb_typeof(f.value) = 'string' THEN f.value #>> '{}'
                    ELSE f.value::text
                  END
                ) ILIKE ${lastLike}
            )
          )
          OR (
            EXISTS (
              SELECT 1
              FROM application_submission_fields f
              LEFT JOIN broker_application_product_fields bf ON bf.id = f."fieldId"
              WHERE f."submissionId" = s.id
                AND COALESCE(NULLIF(f."fieldKey", ''), bf."fieldKey") IN (${Prisma.join(FIRST_NAME_KEYS)})
                AND (
                  CASE
                    WHEN jsonb_typeof(f.value) = 'string' THEN f.value #>> '{}'
                    ELSE f.value::text
                  END
                ) ILIKE ${lastLike}
            )
            AND EXISTS (
              SELECT 1
              FROM application_submission_fields f
              LEFT JOIN broker_application_product_fields bf ON bf.id = f."fieldId"
              WHERE f."submissionId" = s.id
                AND COALESCE(NULLIF(f."fieldKey", ''), bf."fieldKey") IN (${Prisma.join(LAST_NAME_KEYS)})
                AND (
                  CASE
                    WHEN jsonb_typeof(f.value) = 'string' THEN f.value #>> '{}'
                    ELSE f.value::text
                  END
                ) ILIKE ${firstLike}
            )
          )
        )
      LIMIT ${limit}
    `;

    return (rows || []).map((row) => row.id).filter(Boolean);
  } catch (err) {
    console.error(
      "[loanApplicationSearch] borrower name search failed:",
      err?.message || err,
    );
    return [];
  }
}

/**
 * Append submission-field matches onto an existing LoanApplication OR array.
 * Full-term search covers name, email, phone, SSN, address, city, state, entity.
 * Multi-word queries also pair first+last name fields.
 */
async function enrichApplicationSearchOrWithSubmissionFields(
  prisma,
  orClauses,
  search,
) {
  const term = String(search || "").trim();
  if (!term || !Array.isArray(orClauses)) return orClauses || [];

  const tokens = String(term).split(/\s+/).filter(Boolean);
  const idSet = new Set(
    await findApplicationIdsBySubmissionFieldSearch(prisma, term),
  );

  if (tokens.length >= 2) {
    for (const id of await findApplicationIdsByBorrowerNameSearch(
      prisma,
      term,
    )) {
      idSet.add(id);
    }
  }

  const ids = [...idSet];
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
  findApplicationIdsByBorrowerNameSearch,
  loanApplicationListInclude,
};
