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

/** Every token must appear in firstName or lastName (or email/phone). */
function contactNameTokenAnd(tokens) {
  if (tokens.length < 2) return null;
  return {
    AND: tokens.map((token) => ({
      OR: [
        { firstName: { contains: token, mode: "insensitive" } },
        { lastName: { contains: token, mode: "insensitive" } },
        { email: { contains: token, mode: "insensitive" } },
        { phone: { contains: token, mode: "insensitive" } },
      ],
    })),
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

    const multiWordContact = contactNameTokenAnd(tokens);
    if (multiWordContact) {
      contactOr.push(multiWordContact);
    }

    const clientOr = [
      { legalName: { contains: term, mode: "insensitive" } },
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

    // "saina saluja" → legalName must contain both tokens when split across words
    if (tokens.length >= 2) {
      clientOr.push({
        AND: tokens.map((token) => ({
          legalName: { contains: token, mode: "insensitive" },
        })),
      });
    }

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
    const staffMulti = contactNameTokenAnd(tokens);
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

function intersectIdLists(lists) {
  if (!lists.length) return [];
  const [first, ...rest] = lists;
  const sets = rest.map((list) => new Set(list));
  return first.filter((id) => sets.every((set) => set.has(id)));
}

/**
 * Append submission-field matches onto an existing LoanApplication OR array.
 * Multi-word queries match when every token appears in searchable fields
 * (e.g. firstName "Saina" + lastName "Saluja" for "saina saluja").
 */
async function enrichApplicationSearchOrWithSubmissionFields(
  prisma,
  orClauses,
  search,
) {
  const term = String(search || "").trim();
  if (!term || !Array.isArray(orClauses)) return orClauses || [];

  const tokens = searchTokens(term);
  const idSet = new Set(
    await findApplicationIdsBySubmissionFieldSearch(prisma, term),
  );

  if (tokens.length >= 2) {
    const perTokenIds = await Promise.all(
      tokens.map((token) =>
        findApplicationIdsBySubmissionFieldSearch(prisma, token),
      ),
    );
    for (const id of intersectIdLists(perTokenIds)) {
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
  loanApplicationListInclude,
};
