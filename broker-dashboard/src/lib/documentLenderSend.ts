export type DocumentSendRow = {
  requirementId: string;
  source?: string;
  status?: string;
  documentName?: string;
  isRequired?: boolean;
  requestedByLenders?: Array<{
    applicationLenderId?: string | null;
    lenderName?: string | null;
  }>;
  sentToLenders?: Array<{
    applicationLenderId: string;
    lenderName: string;
    isSent: boolean;
    sentAt?: string | null;
  }>;
  isSentToAnyLender?: boolean;
  [key: string]: unknown;
};

export type DocumentSentFilter = "all" | "sent" | "not_sent";

export type DocumentDisplayRow = DocumentSendRow & {
  rowKey: string;
  sourceLender?: {
    applicationLenderId: string;
    lenderName: string;
    sourceClass: string;
  } | null;
};

const BROKER_SENDABLE_SOURCES = new Set(["BROKER_ADDED", "SUB_BROKER_ADDED"]);

const LENDER_SOURCE_COLORS = [
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
  "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-200",
  "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-200",
  "bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-200",
];

export function getLenderSourceColor(
  applicationLenderId: string,
  orderedLenderIds: string[],
) {
  const index = orderedLenderIds.indexOf(applicationLenderId);
  const colorIndex = index >= 0 ? index : 0;
  return LENDER_SOURCE_COLORS[colorIndex % LENDER_SOURCE_COLORS.length];
}

function collectOrderedLenderIds(documents: DocumentSendRow[]) {
  const ids: string[] = [];

  for (const doc of documents) {
    for (const lender of doc.requestedByLenders || []) {
      if (
        lender.applicationLenderId &&
        !ids.includes(lender.applicationLenderId)
      ) {
        ids.push(lender.applicationLenderId);
      }
    }
  }

  return ids;
}

export function expandDocumentsForDisplay(
  documents: DocumentSendRow[],
  options?: { applicationLenderId?: string },
): DocumentDisplayRow[] {
  const orderedLenderIds = collectOrderedLenderIds(documents);
  const rows: DocumentDisplayRow[] = [];
  const lenderFilterId = options?.applicationLenderId;

  for (const doc of documents) {
    let lenders = doc.requestedByLenders || [];

    if (lenderFilterId) {
      lenders = lenders.filter(
        (lender) => lender.applicationLenderId === lenderFilterId,
      );

      if (lenders.length === 0) {
        continue;
      }
    }

    const shouldSplit =
      doc.source === "LENDER_ADDED" &&
      !lenderFilterId &&
      lenders.filter((lender) => lender.applicationLenderId).length > 1;

    if (shouldSplit) {
      for (const lender of lenders) {
        if (!lender.applicationLenderId) continue;

        rows.push({
          ...doc,
          rowKey: `${doc.requirementId}:${lender.applicationLenderId}`,
          sourceLender: {
            applicationLenderId: lender.applicationLenderId,
            lenderName: lender.lenderName || "Lender",
            sourceClass: getLenderSourceColor(
              lender.applicationLenderId,
              orderedLenderIds,
            ),
          },
          requestedByLenders: [lender],
        });
      }
      continue;
    }

    const singleLender =
      doc.source === "LENDER_ADDED" && lenders.length === 1
        ? lenders[0]
        : null;

    rows.push({
      ...doc,
      rowKey: doc.requirementId,
      sourceLender:
        singleLender?.applicationLenderId
          ? {
              applicationLenderId: singleLender.applicationLenderId,
              lenderName: singleLender.lenderName || "Lender",
              sourceClass: getLenderSourceColor(
                singleLender.applicationLenderId,
                orderedLenderIds,
              ),
            }
          : null,
    });
  }

  return rows;
}

export function getDocumentSourceDisplay(
  doc: DocumentDisplayRow,
  options?: { brokerSourceLabel?: string },
) {
  if (doc.source === "BROKER_ADDED") {
    return {
      label: options?.brokerSourceLabel ?? "Principal Broker",
      className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200",
    };
  }

  if (doc.source === "SUB_BROKER_ADDED") {
    return {
      label: "Sub Broker",
      className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-200",
    };
  }

  if (doc.sourceLender) {
    return {
      label: doc.sourceLender.lenderName,
      className: doc.sourceLender.sourceClass,
    };
  }

  return {
    label: "-",
    className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  };
}

export function getDocumentSentDisplay(doc: DocumentDisplayRow) {
  const sentToLenders = doc.sentToLenders || [];

  if (doc.sourceLender?.applicationLenderId) {
    const entry = sentToLenders.find(
      (item) =>
        item.applicationLenderId === doc.sourceLender?.applicationLenderId,
    );

    if (!entry) {
      return {
        isSent: false,
        detail: `Not sent to ${doc.sourceLender.lenderName}`,
      };
    }

    return {
      isSent: entry.isSent,
      detail: entry.isSent
        ? `Sent to ${entry.lenderName}`
        : `Not sent to ${entry.lenderName}`,
    };
  }

  const sentEntries = sentToLenders.filter((item) => item.isSent);

  if (sentEntries.length === 0) {
    if (sentToLenders.length > 0) {
      return { isSent: false, detail: "Not sent to lenders" };
    }

    if (doc.isSentToAnyLender) {
      return { isSent: true, detail: "Sent to lender" };
    }

    return null;
  }

  if (sentEntries.length === 1) {
    return {
      isSent: true,
      detail: `Sent to ${sentEntries[0].lenderName}`,
    };
  }

  return {
    isSent: true,
    detail: `Sent to ${sentEntries.length} lenders`,
  };
}

export function isDocumentSentToLender(doc: DocumentDisplayRow) {
  const sentDisplay = getDocumentSentDisplay(doc);
  if (sentDisplay) return sentDisplay.isSent;
  return Boolean(doc.isSentToAnyLender);
}

export function matchesDocumentSentFilter(
  doc: DocumentDisplayRow,
  filter: DocumentSentFilter,
) {
  if (filter === "all") return true;

  const isSent = isDocumentSentToLender(doc);
  return filter === "sent" ? isSent : !isSent;
}

export function canSendDocumentToLender(
  doc: DocumentSendRow,
  applicationLenderId: string,
) {
  if (!doc?.requirementId) return false;

  if (doc.source && BROKER_SENDABLE_SOURCES.has(doc.source)) {
    return true;
  }

  return (doc.requestedByLenders || []).some(
    (lender) => lender.applicationLenderId === applicationLenderId,
  );
}

export function buildSendPayloadFromSelection(
  displayRows: DocumentDisplayRow[],
  selectedRowKeys: string[],
  selectedLenderIds: string[],
) {
  const selectedRows = displayRows.filter((row) =>
    selectedRowKeys.includes(row.rowKey),
  );

  const payloadMap = new Map<string, Set<string>>();

  for (const lenderId of selectedLenderIds) {
    payloadMap.set(lenderId, new Set());
  }

  for (const row of selectedRows) {
    if (row.sourceLender?.applicationLenderId) {
      const lenderId = row.sourceLender.applicationLenderId;
      if (selectedLenderIds.includes(lenderId)) {
        payloadMap.get(lenderId)?.add(row.requirementId);
      }
      continue;
    }

    if (row.source && BROKER_SENDABLE_SOURCES.has(row.source)) {
      for (const lenderId of selectedLenderIds) {
        payloadMap.get(lenderId)?.add(row.requirementId);
      }
      continue;
    }

    for (const lenderId of selectedLenderIds) {
      if (canSendDocumentToLender(row, lenderId)) {
        payloadMap.get(lenderId)?.add(row.requirementId);
      }
    }
  }

  return [...payloadMap.entries()]
    .map(([applicationLenderId, requirementIds]) => ({
      applicationLenderId,
      requirementIds: [...requirementIds],
    }))
    .filter((entry) => entry.requirementIds.length > 0);
}

export function summarizeSendFromDisplayRows(
  displayRows: DocumentDisplayRow[],
  selectedRowKeys: string[],
  selectedLenderIds: string[],
) {
  const payload = buildSendPayloadFromSelection(
    displayRows,
    selectedRowKeys,
    selectedLenderIds,
  );

  const selectedRows = displayRows.filter((row) =>
    selectedRowKeys.includes(row.rowKey),
  );

  const skippedByLender = selectedLenderIds
    .map((applicationLenderId) => {
      const sentIds = new Set(
        payload.find((entry) => entry.applicationLenderId === applicationLenderId)
          ?.requirementIds || [],
      );

      const applicableSelected = selectedRows.filter((row) => {
        if (row.sourceLender?.applicationLenderId) {
          return row.sourceLender.applicationLenderId === applicationLenderId;
        }

        return (
          row.source === "BROKER_ADDED" || row.source === "SUB_BROKER_ADDED"
        );
      });

      return {
        applicationLenderId,
        skippedCount: applicableSelected.filter(
          (row) => !sentIds.has(row.requirementId),
        ).length,
      };
    })
    .filter((entry) => entry.skippedCount > 0);

  return {
    payload,
    skippedByLender,
    totalDocumentsToSend: payload.reduce(
      (sum, entry) => sum + entry.requirementIds.length,
      0,
    ),
  };
}

export function getRequirementIdsForLender(
  documents: DocumentSendRow[],
  selectedRequirementIds: string[],
  applicationLenderId: string,
) {
  const docById = new Map(documents.map((doc) => [doc.requirementId, doc]));

  return selectedRequirementIds.filter((requirementId) => {
    const doc = docById.get(requirementId);
    if (!doc) return false;
    return canSendDocumentToLender(doc, applicationLenderId);
  });
}

export function buildLenderDocumentPayload(
  documents: DocumentSendRow[],
  selectedRequirementIds: string[],
  selectedLenderIds: string[],
) {
  return selectedLenderIds
    .map((applicationLenderId) => ({
      applicationLenderId,
      requirementIds: getRequirementIdsForLender(
        documents,
        selectedRequirementIds,
        applicationLenderId,
      ),
    }))
    .filter((entry) => entry.requirementIds.length > 0);
}

export function summarizeLenderDocumentPayload(
  documents: DocumentSendRow[],
  selectedRequirementIds: string[],
  selectedLenderIds: string[],
) {
  const payload = buildLenderDocumentPayload(
    documents,
    selectedRequirementIds,
    selectedLenderIds,
  );

  const skippedByLender = selectedLenderIds
    .map((applicationLenderId) => {
      const allowed = new Set(
        getRequirementIdsForLender(
          documents,
          selectedRequirementIds,
          applicationLenderId,
        ),
      );

      return {
        applicationLenderId,
        skippedCount: selectedRequirementIds.filter((id) => !allowed.has(id))
          .length,
      };
    })
    .filter((entry) => entry.skippedCount > 0);

  return {
    payload,
    skippedByLender,
    totalDocumentsToSend: payload.reduce(
      (sum, entry) => sum + entry.requirementIds.length,
      0,
    ),
  };
}
