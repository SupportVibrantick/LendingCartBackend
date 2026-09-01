const {
  formatSignDocumentRequirement,
  REQUEST_APPLICATION_LENDER_INCLUDE,
} = require("./formatSignDocument");
const { countWorkflow } = require("./signDocumentWorkflow");

const SIGN_DOCUMENT_LIST_INCLUDE = {
  documentType: true,
  uploads: {
    where: { isSignedOutput: true },
    orderBy: { uploadedAt: "desc" },
  },
  requestApplicationLender: {
    include: REQUEST_APPLICATION_LENDER_INCLUDE,
  },
  activeFormVersion: true,
  signFormSubmissions: {
    orderBy: { createdAt: "desc" },
    take: 1,
    include: { values: true },
  },
};

function appendSignDocumentSearch(where, searchTerm) {
  if (!searchTerm) return where;

  const searchClause = {
    OR: [
      { signDocumentTitle: { contains: searchTerm, mode: "insensitive" } },
      { templateFileName: { contains: searchTerm, mode: "insensitive" } },
      {
        documentType: {
          name: { contains: searchTerm, mode: "insensitive" },
        },
      },
      {
        requestApplicationLender: {
          lender: { name: { contains: searchTerm, mode: "insensitive" } },
        },
      },
    ],
  };

  return { AND: [where, searchClause] };
}

function buildBrokerSignDocumentWhere(
  loanApplicationId,
  { searchTerm = "", lenderId = "" } = {},
) {
  const where = {
    loanApplicationId,
    requiresClientSignature: true,
  };

  if (lenderId && lenderId !== "all") {
    if (lenderId === "broker-uploads") {
      where.source = "BROKER_ADDED";
    } else {
      where.requestApplicationLenderId = lenderId;
    }
  }

  return appendSignDocumentSearch(where, searchTerm);
}

function buildLenderGroupSummaries(rows) {
  const map = new Map();

  for (const row of rows) {
    const key =
      row.source === "BROKER_ADDED"
        ? "broker-uploads"
        : row.requestApplicationLenderId ||
          row.lenderOrgId ||
          row.lenderName ||
          "unknown";
    const existing = map.get(key);

    if (existing) {
      existing.count += 1;
      continue;
    }

    map.set(key, {
      key,
      lenderName:
        row.source === "BROKER_ADDED"
          ? "Your uploads"
          : row.lenderName || "Unknown lender",
      loanProductName: row.loanProductName || row.loanProductCode || null,
      count: 1,
    });
  }

  return Array.from(map.values()).sort((left, right) =>
    left.lenderName.localeCompare(right.lenderName),
  );
}

async function listBrokerSignDocuments(
  prisma,
  {
    loanApplicationId,
    pageNumber = 1,
    pageSize = 9,
    searchTerm = "",
    lenderId = "",
    viewer = "broker",
  },
) {
  const where = buildBrokerSignDocumentWhere(loanApplicationId, {
    searchTerm,
    lenderId,
  });

  const [total, requirements, allForSummary] = await Promise.all([
    prisma.applicationDocumentRequirement.count({ where }),
    prisma.applicationDocumentRequirement.findMany({
      where,
      include: SIGN_DOCUMENT_LIST_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: (pageNumber - 1) * pageSize,
      take: pageSize,
    }),
    prisma.applicationDocumentRequirement.findMany({
      where,
      include: SIGN_DOCUMENT_LIST_INCLUDE,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const formattedPage = requirements.map((item) =>
    formatSignDocumentRequirement(item, { viewer }),
  );
  const formattedAll = allForSummary.map((item) =>
    formatSignDocumentRequirement(item, { viewer }),
  );
  const bucketCounts = countWorkflow(formattedAll, "broker");

  return {
    data: formattedPage,
    pagination: {
      page: pageNumber,
      limit: pageSize,
      total,
      totalPages: Math.max(Math.ceil(total / pageSize), 1),
    },
    summary: {
      awaitingYou: bucketCounts.awaitingYou,
      withClient: bucketCounts.withClient,
      readyToForward: bucketCounts.readyToForward,
      forwarded: bucketCounts.forwarded,
    },
    lenderGroups: buildLenderGroupSummaries(formattedAll),
  };
}

const CLIENT_SIGN_STATUSES = [
  "SENT_TO_CLIENT",
  "CLIENT_SIGNED",
  "FORWARDED_TO_LENDER",
  "LENDER_SEEN",
];

function isBrokerLoiRequirement(item) {
  return (
    item?.documentType?.code === "BROKER_LOI_TERM_SHEET" ||
    /\/broker\/LOI\//i.test(item?.templateFileUrl || "")
  );
}

function matchesClientScope(item, scope = "all") {
  const isBrokerLoi = isBrokerLoiRequirement(item);
  if (scope === "termSheet") return isBrokerLoi;
  if (scope === "signForms") return !isBrokerLoi;
  return true;
}

function matchesClientBucket(row, bucket = "all") {
  if (!bucket || bucket === "all") return true;
  return row.clientBucket === bucket;
}

function sortClientSignDocuments(left, right) {
  const leftTime = new Date(
    left.sentToClientAt || left.updatedAt || left.createdAt || 0,
  ).getTime();
  const rightTime = new Date(
    right.sentToClientAt || right.updatedAt || right.createdAt || 0,
  ).getTime();
  return rightTime - leftTime;
}

async function listClientSignDocuments(
  prisma,
  {
    loanApplicationId,
    scope = "all",
    bucket = "all",
    pageNumber = 1,
    pageSize = 9,
    searchTerm = "",
    viewer = "client",
  },
) {
  const where = appendSignDocumentSearch(
    {
      loanApplicationId,
      requiresClientSignature: true,
      signStatus: { in: CLIENT_SIGN_STATUSES },
    },
    searchTerm,
  );

  const requirements = await prisma.applicationDocumentRequirement.findMany({
    where,
    include: SIGN_DOCUMENT_LIST_INCLUDE,
    orderBy: [{ sentToClientAt: "desc" }, { updatedAt: "desc" }],
  });

  const scopedRequirements = requirements.filter((item) =>
    matchesClientScope(item, scope),
  );

  const formattedAll = scopedRequirements
    .map((item) => formatSignDocumentRequirement(item, { viewer }))
    .sort(sortClientSignDocuments);

  const bucketCounts = countWorkflow(formattedAll, "client");
  const filteredRows = formattedAll.filter((row) =>
    matchesClientBucket(row, bucket),
  );
  const total = filteredRows.length;
  const safePageSize = Math.min(Math.max(pageSize, 1), 50);
  const safePageNumber = Math.max(pageNumber, 1);
  const data = filteredRows.slice(
    (safePageNumber - 1) * safePageSize,
    safePageNumber * safePageSize,
  );

  return {
    data,
    pagination: {
      page: safePageNumber,
      limit: safePageSize,
      total,
      totalPages: Math.max(Math.ceil(total / safePageSize), 1),
    },
    summary: {
      actionRequired: bucketCounts.actionRequired,
      waitingOnBroker: bucketCounts.waitingOnBroker,
      completed: bucketCounts.completed,
    },
  };
}

module.exports = {
  SIGN_DOCUMENT_LIST_INCLUDE,
  appendSignDocumentSearch,
  buildBrokerSignDocumentWhere,
  listBrokerSignDocuments,
  listClientSignDocuments,
  isBrokerLoiRequirement,
  matchesClientScope,
  matchesClientBucket,
  CLIENT_SIGN_STATUSES,
};
