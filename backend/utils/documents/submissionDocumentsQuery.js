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
      requestedAt: reqItem.requestedAt || null,
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

function buildUnsentLoiDocumentsExcludeClause() {
  return {
    NOT: {
      AND: [
        { source: "LENDER_ADDED" },
        { requiresClientSignature: false },
        {
          requestApplicationLender: {
            is: {
              loiUrl: { not: null },
              loiSentToBrokerAt: null,
            },
          },
        },
      ],
    },
  };
}

function applyBrokerDocumentVisibility(where, viewerRole = "broker") {
  if (viewerRole !== "broker" && viewerRole !== "loan_officer") {
    return where;
  }

  return {
    AND: [where, buildUnsentLoiDocumentsExcludeClause()],
  };
}

function buildSubmissionDocumentsWhere({
  loanApplicationId,
  search,
  applicationLenderId,
  lenderRequests,
  sourceFilter = "all",
  documentCategory = "upload",
  viewerRole = "broker",
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

  const subBrokerVisibility =
    viewerRole === "sub_broker"
      ? { source: "SUB_BROKER_ADDED" }
      : { source: "SUB_BROKER_ADDED", isSentToBroker: true };

  if (normalizedSourceFilter === "broker") {
    return applyBrokerDocumentVisibility(
      {
        loanApplicationId,
        source: "BROKER_ADDED",
        ...signatureFilter,
        ...searchFilter,
      },
      viewerRole,
    );
  }

  if (normalizedSourceFilter === "sub_broker") {
    return {
      loanApplicationId,
      ...(viewerRole === "sub_broker"
        ? { source: "SUB_BROKER_ADDED" }
        : { source: "SUB_BROKER_ADDED", isSentToBroker: true }),
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

    return applyBrokerDocumentVisibility(
      {
        loanApplicationId,
        source: "LENDER_ADDED",
        documentTypeId: {
          in: documentTypeIds,
        },
        ...signatureFilter,
        ...searchFilter,
      },
      viewerRole,
    );
  }

  if (normalizedSourceFilter === "lender") {
    return applyBrokerDocumentVisibility(
      {
        loanApplicationId,
        source: "LENDER_ADDED",
        ...signatureFilter,
        ...searchFilter,
      },
      viewerRole,
    );
  }

  return applyBrokerDocumentVisibility(
    {
      loanApplicationId,
      OR: [
        { source: "BROKER_ADDED" },
        subBrokerVisibility,
        { source: "LENDER_ADDED" },
      ],
      ...signatureFilter,
      ...searchFilter,
    },
    viewerRole,
  );
}

function evaluateLenderSendState(doc, lenderId) {
  const sentToLenders = doc.sentToLenders || [];
  const uploadedCount = Number(doc.uploadedCount) || 0;

  if (lenderId) {
    const entry = sentToLenders.find(
      (item) => item.applicationLenderId === lenderId,
    );
    const sentCount = entry?.sentCount ?? (entry?.isSent ? uploadedCount : 0);
    const pendingCount =
      entry?.pendingCount ?? Math.max(0, uploadedCount - sentCount);

    return { uploadedCount, sentCount, pendingCount };
  }

  if (uploadedCount <= 0) {
    return { uploadedCount, sentCount: 0, pendingCount: 0 };
  }

  if (sentToLenders.length === 0) {
    return { uploadedCount, sentCount: 0, pendingCount: uploadedCount };
  }

  const sentCount = Math.max(
    ...sentToLenders.map(
      (item) => item.sentCount ?? (item.isSent ? uploadedCount : 0),
    ),
  );
  const pendingCount = Math.max(
    ...sentToLenders.map((item) => {
      const itemSentCount =
        item.sentCount ?? (item.isSent ? uploadedCount : 0);
      return item.pendingCount ?? Math.max(0, uploadedCount - itemSentCount);
    }),
  );

  return { uploadedCount, sentCount, pendingCount };
}

function isDocumentFullySentToLender(doc, lenderId) {
  const { uploadedCount, sentCount, pendingCount } = evaluateLenderSendState(
    doc,
    lenderId,
  );

  return uploadedCount > 0 && sentCount >= uploadedCount && pendingCount === 0;
}

function getSentFilterLenderContexts(doc, applicationLenderId) {
  if (applicationLenderId) return [applicationLenderId];

  const lenders = (doc.requestedByLenders || [])
    .map((item) => item.applicationLenderId)
    .filter(Boolean);

  if (doc.source === "LENDER_ADDED" && lenders.length > 0) {
    return lenders;
  }

  return [null];
}

function rowMatchesSentFilter(doc, sentFilter, lenderId) {
  if (sentFilter === "sent_to_client") {
    return (
      isClientForwardableDocument(doc) && Boolean(doc.isForwardedToClient)
    );
  }

  if (sentFilter === "not_sent_to_client") {
    return (
      isClientForwardableDocument(doc) && !Boolean(doc.isForwardedToClient)
    );
  }

  const isFullySent = isDocumentFullySentToLender(doc, lenderId);

  if (sentFilter === "sent") return isFullySent;

  return !isFullySent;
}

function isClientForwardableDocument(doc) {
  const source = String(doc?.source || "");
  return (
    source === "BROKER_ADDED" ||
    source === "LENDER_ADDED" ||
    source === "SUB_BROKER_ADDED"
  );
}

function documentMatchesSentFilter(doc, sentFilter, applicationLenderId) {
  if (!sentFilter || sentFilter === "all") return true;

  if (
    sentFilter === "sent_to_client" ||
    sentFilter === "not_sent_to_client"
  ) {
    return rowMatchesSentFilter(doc, sentFilter, null);
  }

  const contexts = getSentFilterLenderContexts(doc, applicationLenderId);

  return contexts.some((lenderId) =>
    rowMatchesSentFilter(doc, sentFilter, lenderId),
  );
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
  buildUnsentLoiDocumentsExcludeClause,
  applyBrokerDocumentVisibility,
  normalizeSourceFilter,
  documentMatchesSentFilter,
  paginateDocuments,
  filterDocumentLenderContext,
};
