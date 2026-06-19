function buildLenderRequestMap(lenderRequests) {
  const lenderMap = new Map();

  for (const reqItem of lenderRequests) {
    const docId = reqItem.documentTypeId;

    if (!lenderMap.has(docId)) {
      lenderMap.set(docId, []);
    }

    lenderMap.get(docId).push({
      lenderId: reqItem.applicationLender?.lender?.id || null,
      lenderName: reqItem.applicationLender?.lender?.name || null,
      applicationLenderId: reqItem.applicationLenderId,
    });
  }

  return lenderMap;
}

function buildDocumentFilterLenders(lenderRequests) {
  const lenders = new Map();

  for (const reqItem of lenderRequests) {
    if (!reqItem.applicationLenderId) continue;

    if (!lenders.has(reqItem.applicationLenderId)) {
      lenders.set(reqItem.applicationLenderId, {
        applicationLenderId: reqItem.applicationLenderId,
        lenderId: reqItem.applicationLender?.lender?.id || null,
        lenderName: reqItem.applicationLender?.lender?.name || "Lender",
        requestedDocumentCount: 0,
      });
    }

    lenders.get(reqItem.applicationLenderId).requestedDocumentCount += 1;
  }

  return [...lenders.values()].sort((a, b) =>
    a.lenderName.localeCompare(b.lenderName),
  );
}

function buildSubmissionDocumentsWhere({
  loanApplicationId,
  search,
  applicationLenderId,
  lenderRequests,
}) {
  const searchFilter = search
    ? {
        documentType: {
          name: {
            contains: search,
            mode: "insensitive",
          },
        },
      }
    : {};

  if (applicationLenderId) {
    const documentTypeIds = [
      ...new Set(
        lenderRequests
          .filter((item) => item.applicationLenderId === applicationLenderId)
          .map((item) => item.documentTypeId),
      ),
    ];

    return {
      loanApplicationId,
      source: "LENDER_ADDED",
      documentTypeId: {
        in: documentTypeIds,
      },
      ...searchFilter,
    };
  }

  return {
    loanApplicationId,
    OR: [
      { source: "BROKER_ADDED" },
      {
        source: "SUB_BROKER_ADDED",
        isSentToBroker: true,
      },
      { source: "LENDER_ADDED" },
    ],
    ...searchFilter,
  };
}

function documentMatchesSentFilter(doc, sentFilter, applicationLenderId) {
  if (!sentFilter || sentFilter === "all") return true;

  const sentToLenders = doc.sentToLenders || [];
  let isSent = false;

  if (applicationLenderId) {
    isSent = Boolean(
      sentToLenders.find(
        (item) =>
          item.applicationLenderId === applicationLenderId && item.isSent,
      ),
    );
  } else {
    isSent = Boolean(doc.isSentToAnyLender);
  }

  return sentFilter === "sent" ? isSent : !isSent;
}

function paginateDocuments(documents, pageNumber, pageSize) {
  const total = documents.length;
  const skip = (pageNumber - 1) * pageSize;

  return {
    documents: documents.slice(skip, skip + pageSize),
    pagination: {
      page: pageNumber,
      limit: pageSize,
      total,
      totalPages: Math.max(Math.ceil(total / pageSize), 1),
    },
  };
}

function filterDocumentLenderContext(items, applicationLenderId) {
  if (!applicationLenderId) return items;

  return items.filter((item) => item.applicationLenderId === applicationLenderId);
}

module.exports = {
  buildLenderRequestMap,
  buildDocumentFilterLenders,
  buildSubmissionDocumentsWhere,
  documentMatchesSentFilter,
  paginateDocuments,
  filterDocumentLenderContext,
};
