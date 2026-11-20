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
const LOCATION_FIELD_KEYS = [
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
];
const ENTITY_FIELD_KEYS = [
  "entityLegalName",
  "entityName",
  "companyName",
  "businessName",
  "legalName",
];
const EMAIL_FIELD_KEYS = [
  "email",
  "borrowerEmail",
  "preferredEmail",
  "contactEmail",
];
const PHONE_SSN_FIELD_KEYS = [
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
];
const TEXT_FIELD_KEYS = [
  ...FIRST_NAME_KEYS,
  ...LAST_NAME_KEYS,
  ...FULL_NAME_KEYS,
  ...LOCATION_FIELD_KEYS,
  ...ENTITY_FIELD_KEYS,
];
const TEXT_FIELD_KEY_PATTERN =
  "(address|street|streetName|city|state|zip|entityName|entityLegalName|companyName|businessName|legalName|firstName|lastName|borrowerName|fullName)$";
const EMAIL_FIELD_KEY_PATTERN = "(email)$";
const NUMERIC_FIELD_KEY_PATTERN =
  "(phone|ssn|ssnLast4|taxId|ein|itin|address|street|streetName|zip|zipCode)$";

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

function classifySearch(term) {
  const value = String(term || "").trim();
  if (!value) return "empty";
  if (value.includes("@")) return "email";
  if (digitsOnly(value).length >= 3) return "numeric";
  return "text";
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
  const kind = classifySearch(term);
  const or = [
    { applicationNumber: { contains: term, mode: "insensitive" } },
  ];

  if (kind !== "text") {
    or.push({ purpose: { contains: term, mode: "insensitive" } });
  }

  if (kind !== "text") {
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
  }

  if (includeBorrower && kind !== "text") {
    // Email / phone / tax ID on the Client record. Names are matched from
    // submission fields so reused portal clients do not leak unrelated files.
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

  if (includeAssignedStaff && (kind !== "text" || tokens.length >= 2)) {
    // Assigned LO / co-broker only — never the creating broker admin.
    // Skip 1-token text queries so searching "Saina" does not match staff email.
    const staffOr =
      kind === "text"
        ? [
            { firstName: { contains: term, mode: "insensitive" } },
            { lastName: { contains: term, mode: "insensitive" } },
          ]
        : personNameFieldOr(term);
    const staffMulti = kind === "text" ? contactNamePairOr(tokens) : null;
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
  {
    limit = 500,
    fieldKeys = SEARCHABLE_SUBMISSION_FIELD_KEYS,
    keyPattern = SEARCHABLE_FIELD_KEY_PATTERN,
    matchDigits = true,
  } = {},
) {
  const term = String(search || "").trim();
  if (!term || !prisma || !fieldKeys.length) return [];

  const like = `%${term}%`;
  const digitTerm = matchDigits ? digitsOnly(term) : "";
  const digitLike = digitTerm.length >= 3 ? `%${digitTerm}%` : null;
  const pattern = keyPattern || "a^";

  try {
    const rows = digitLike
      ? await prisma.$queryRaw`
          SELECT DISTINCT s."applicationId" AS id
          FROM application_submission_fields f
          INNER JOIN application_submissions s ON s.id = f."submissionId"
          WHERE s.status <> 'SUPERSEDED'
            AND (
              f."fieldKey" IN (${Prisma.join(fieldKeys)})
              OR EXISTS (
                SELECT 1
                FROM broker_application_product_fields bf
                WHERE bf.id = f."fieldId"
                  AND bf."fieldKey" IN (${Prisma.join(fieldKeys)})
              )
              OR f."fieldKey" ~* ${pattern}
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
              f."fieldKey" IN (${Prisma.join(fieldKeys)})
              OR EXISTS (
                SELECT 1
                FROM broker_application_product_fields bf
                WHERE bf.id = f."fieldId"
                  AND bf."fieldKey" IN (${Prisma.join(fieldKeys)})
              )
              OR f."fieldKey" ~* ${pattern}
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

  const kind = classifySearch(term);
  const fieldOptions =
    kind === "email"
      ? {
          fieldKeys: EMAIL_FIELD_KEYS,
          keyPattern: EMAIL_FIELD_KEY_PATTERN,
          matchDigits: false,
        }
      : kind === "numeric"
        ? {
            fieldKeys: [
              ...PHONE_SSN_FIELD_KEYS,
              ...LOCATION_FIELD_KEYS,
            ],
            keyPattern: NUMERIC_FIELD_KEY_PATTERN,
            matchDigits: true,
          }
        : {
            fieldKeys: TEXT_FIELD_KEYS,
            keyPattern: TEXT_FIELD_KEY_PATTERN,
            matchDigits: false,
          };

  const idSet = new Set(
    await findApplicationIdsBySubmissionFieldSearch(prisma, term, fieldOptions),
  );

  if (kind === "text") {
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
  EMAIL_FIELD_KEYS,
  buildApplicationSearchWhere,
  buildEnrichedApplicationSearchWhere,
  enrichApplicationSearchOrWithSubmissionFields,
  findApplicationIdsBySubmissionFieldSearch,
  findApplicationIdsByBorrowerNameSearch,
  loanApplicationListInclude,
};
