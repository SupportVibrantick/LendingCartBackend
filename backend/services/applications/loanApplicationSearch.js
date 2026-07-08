const { LoanApplicationStatus, LoanProductCode } = require("@prisma/client");

function filterEnumMatches(search, enumValues) {
  const needle = search.trim().toLowerCase();
  if (!needle) return [];

  return enumValues.filter((value) => {
    const normalized = String(value).toLowerCase();
    const spaced = normalized.replace(/_/g, " ");
    return normalized.includes(needle) || spaced.includes(needle);
  });
}

function buildApplicationSearchWhere(search, { includeBorrower = false } = {}) {
  const or = [
    { applicationNumber: { contains: search, mode: "insensitive" } },
    { purpose: { contains: search, mode: "insensitive" } },
  ];

  const statusMatches = filterEnumMatches(search, Object.values(LoanApplicationStatus));
  if (statusMatches.length) {
    or.push({ status: { in: statusMatches } });
  }

  const productMatches = filterEnumMatches(search, Object.values(LoanProductCode));
  if (productMatches.length) {
    or.push({ loanProductCode: { in: productMatches } });
  }

  if (includeBorrower) {
    or.push({
      client: {
        legalName: { contains: search, mode: "insensitive" },
      },
    });
    or.push({
      client: {
        contacts: {
          some: {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      },
    });
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
  buildApplicationSearchWhere,
  loanApplicationListInclude,
};
