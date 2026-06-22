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

function normalizeSourceFilter(sourceFilter) {
  const value =
    typeof sourceFilter === "string" ? sourceFilter.trim().toLowerCase() : "all";

  if (value === "broker" || value === "lender" || value === "sub_broker") {
    return value;
  }

  return "all";
}

function buildSubmissionDocumentsWhere({
  loanApplicationId,
  search,
  applicationLenderId,
  lenderRequests,
  sourceFilter = "all",
  documentCategory = "upload",
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

  const normalizedSourceFilter = normalizeSourceFilter(sourceFilter);
  const normalizedCategory =
    documentCategory === "signable" ? "signable" : "upload";
  const signatureFilter =
    normalizedCategory === "signable"
      ? { requiresClientSignature: true }
      : { requiresClientSignature: false };

  if (normalizedSourceFilter === "broker") {
    return {
      loanApplicationId,
      source: "BROKER_ADDED",
      ...signatureFilter,
      ...searchFilter,
    };
  }

  if (normalizedSourceFilter === "sub_broker") {
    return {
      loanApplicationId,
      source: "SUB_BROKER_ADDED",
      isSentToBroker: true,
      ...signatureFilter,
      ...searchFilter,
    };
  }

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
      ...signatureFilter,
      ...searchFilter,
    };
  }

  if (normalizedSourceFilter === "lender") {
    return {
      loanApplicationId,
      source: "LENDER_ADDED",
      ...signatureFilter,
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
    ...signatureFilter,
    ...searchFilter,
  };
}

function documentMatchesSentFilter(doc, sentFilter, applicationLenderId) {
  if (!sentFilter || sentFilter === "all") return true;

  const sentToLenders = doc.sentToLenders || [];
  const uploadedCount = Number(doc.uploadedCount) || 0;
  let hasSent = false;
  let hasPending = false;

  if (applicationLenderId) {
    const entry = sentToLenders.find(
      (item) => item.applicationLenderId === applicationLenderId,
    );

    const sentCount = entry?.sentCount ?? (entry?.isSent ? uploadedCount : 0);
    const pendingCount =
      entry?.pendingCount ?? Math.max(0, uploadedCount - sentCount);

    hasSent = sentCount > 0;
    hasPending = pendingCount > 0;
  } else {
    hasSent = sentToLenders.some((item) => item.isSent);
    hasPending =
      doc.hasPendingSendToLender ??
      sentToLenders.some((item) => (item.pendingCount ?? 0) > 0);
  }

  if (sentFilter === "sent") {
    return hasSent && !hasPending;
  }

  return !hasSent || hasPending;
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
  normalizeSourceFilter,
  documentMatchesSentFilter,
  paginateDocuments,
  filterDocumentLenderContext,
};
