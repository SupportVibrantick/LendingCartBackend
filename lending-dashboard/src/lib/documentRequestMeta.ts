export function formatDocumentTimelineDate(
  value?: string | Date | null,
): string | null {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export type DocumentRequestHistoryEntry = {
  requestedAt: string;
  source: string;
  lenderName?: string | null;
  documentName?: string;
};

export type RequestedDocumentListItem = {
  documentTypeId: string;
  documentName: string;
  requestedAt: string;
};

export function buildRequestedDocumentsList(
  documents: Array<{
    documentTypeId?: string | null;
    documentName?: string | null;
    lastRequestedAt?: string | null;
    lenderRequestedAt?: string | null;
    source?: string | null;
    createdAt?: string | null;
  }>,
): RequestedDocumentListItem[] {
  const byTypeId = new Map<string, RequestedDocumentListItem>();

  for (const doc of documents) {
    const typeId = doc.documentTypeId ? String(doc.documentTypeId) : "";
    if (!typeId) continue;

    const requestedAt = getDocumentRequestedAt(doc);
    if (!requestedAt) continue;

    const documentName = doc.documentName?.trim() || "Document";
    const existing = byTypeId.get(typeId);

    if (
      !existing ||
      new Date(requestedAt).getTime() > new Date(existing.requestedAt).getTime()
    ) {
      byTypeId.set(typeId, {
        documentTypeId: typeId,
        documentName,
        requestedAt,
      });
    }
  }

  return [...byTypeId.values()].sort(
    (a, b) =>
      new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime(),
  );
}

export function formatDocumentRequestSourceLabel(
  source?: string | null,
  lenderName?: string | null,
): string {
  switch (source) {
    case "BROKER_ADDED":
      return "Broker";
    case "LENDER_ADDED":
      return lenderName ? `Lender · ${lenderName}` : "Lender";
    case "SUB_BROKER_ADDED":
      return "Co-Broker";
    default:
      return "Requested";
  }
}

export function getDocumentRequestedAt(doc: {
  lastRequestedAt?: string | null;
  lenderRequestedAt?: string | null;
  createdAt?: string | null;
}): string | null {
  return (
    doc.lenderRequestedAt || doc.lastRequestedAt || doc.createdAt || null
  );
}

export function buildDocumentRequestHistoryByTypeId(
  documents: Array<{
    documentTypeId?: string | null;
    documentName?: string | null;
    lastRequestedAt?: string | null;
    lenderRequestedAt?: string | null;
    source?: string | null;
    sourceLabel?: string | null;
    createdAt?: string | null;
  }>,
): Record<string, DocumentRequestHistoryEntry> {
  const history: Record<string, DocumentRequestHistoryEntry> = {};

  for (const doc of documents) {
    const typeId = doc.documentTypeId ? String(doc.documentTypeId) : "";
    if (!typeId) continue;

    const requestedAt = getDocumentRequestedAt(doc);
    if (!requestedAt) continue;

    const existing = history[typeId];
    if (
      !existing ||
      new Date(requestedAt).getTime() > new Date(existing.requestedAt).getTime()
    ) {
      history[typeId] = {
        requestedAt,
        source: String(doc.source || ""),
        lenderName:
          doc.source === "LENDER_ADDED"
            ? doc.sourceLabel?.replace(/^Lender\s*·?\s*/i, "").trim() || null
            : null,
        documentName: doc.documentName?.trim() || existing?.documentName,
      };
    }
  }

  return history;
}

export function getDocumentRequestDisplay(doc: {
  lastRequestedAt?: string | null;
  lenderRequestedAt?: string | null;
  source?: string | null;
  sourceLabel?: string | null;
  createdAt?: string | null;
}): { label: string; date: string | null } | null {
  const requestedAt = getDocumentRequestedAt(doc);
  if (!requestedAt) return null;

  const lenderName =
    doc.source === "LENDER_ADDED"
      ? doc.sourceLabel?.replace(/^Lender\s*·?\s*/i, "").trim() || null
      : null;

  return {
    label: formatDocumentRequestSourceLabel(doc.source, lenderName),
    date: formatDocumentTimelineDate(requestedAt),
  };
}
