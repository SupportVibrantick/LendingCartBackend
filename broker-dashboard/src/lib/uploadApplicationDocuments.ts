import type {
  PendingApplicationDocument,
  ApplicationDocumentType,
} from "./applicationDocumentTypes";

type DocumentTypeRecord = {
  id: string;
  code?: string | null;
  name: string;
};

type DocumentUploadPaths = {
  requestDocuments: (loanApplicationId: string) => string;
  listDocuments: (submissionId: string) => string;
  uploadDocument: (submissionId: string, requirementId: string) => string;
};

const defaultDocumentPaths = (apiBase: string): DocumentUploadPaths => ({
  requestDocuments: (loanApplicationId: string) =>
    `${apiBase}/broker/loan-pipeline/${loanApplicationId}/request-documents`,
  listDocuments: (submissionId: string) =>
    `${apiBase}/broker/loan-pipeline/submissions/${submissionId}/documents?limit=100&documentCategory=upload`,
  uploadDocument: (submissionId: string, requirementId: string) =>
    `${apiBase}/broker/loan-pipeline/submissions/${submissionId}/documents/${requirementId}/upload`,
});

/**
 * Resolve a wizard label (one of the 23 strings in
 * APPLICATION_DOCUMENT_TYPE_OPTIONS) to a DB DocumentType row.
 *
 * Exported so the wizard can map labels to ids upfront, then pass ids
 * straight to /request-documents below — no more fuzzy `includes()` matching.
 *
 * Match priority:
 *   1. exact code (when DB rows have wizard-vocabulary codes)
 *   2. exact (case-insensitive) name
 *   3. fall back to "Other"
 */
export function resolveDocumentTypeByLabel(
  label: ApplicationDocumentType | "",
  documentTypes: DocumentTypeRecord[],
): DocumentTypeRecord | undefined {
  const normalized = (label || "Other").trim().toLowerCase();

  // 1. exact code match
  const byCode = documentTypes.find(
    (d) => typeof d.code === "string" && d.code.toLowerCase() === normalized,
  );
  if (byCode) return byCode;

  // 2. exact name match (case-insensitive)
  const byName = documentTypes.find((d) => d.name.trim().toLowerCase() === normalized);
  if (byName) return byName;

  // 3. fall back to "Other"
  return (
    documentTypes.find((d) => d.name.toLowerCase() === "other") ||
    documentTypes.find((d) => (d.code || "").toLowerCase() === "other") ||
    documentTypes[0]
  );
}

/**
 * Upload pending wizard documents into a freshly-created loan application.
 *
 * The wizard passes `documents` with each file's `documentType` tag set from
 * the 23-option dropdown. The function resolves each label to a DocumentType
 * row using `resolveDocumentTypeByLabel` (exact code match → exact name →
 * "Other"), then POSTs the resolved ids to /request-documents. NO fuzzy
 * `includes()` matching — the previous behavior drifted wizard labels onto
 * unrelated catalog rows.
 */
export async function uploadPendingApplicationDocuments({
  apiBase,
  token,
  loanApplicationId,
  submissionId,
  documents,
  documentPaths,
}: {
  apiBase: string;
  token: string | null;
  loanApplicationId: string;
  submissionId: string;
  documents: PendingApplicationDocument[];
  documentPaths?: DocumentUploadPaths;
}) {
  if (documents.length === 0) return;

  const paths = documentPaths || defaultDocumentPaths(apiBase);

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // Fetch the active catalog so we can resolve labels → ids via exact match.
  // Always pull the wizard-options endpoint (which is keyed by code) — it's
  // both faster and aligned with what the wizard just selected. Fall back to
  // /document-types/active only if the wizard-options endpoint is unavailable.
  let documentTypes: DocumentTypeRecord[] = [];
  try {
    const wizardRes = await fetch(`${apiBase}/document-types/wizard-options`, {
      headers,
    });
    const wizardJson = await wizardRes.json();
    if (wizardRes.ok && wizardJson?.success) {
      documentTypes = (wizardJson.data || []) as DocumentTypeRecord[];
    }
  } catch {
    // Fall through to next attempt.
  }

  if (documentTypes.length === 0) {
    const fallbackRes = await fetch(`${apiBase}/document-types/active?all=true`, {
      headers,
    });
    const fallbackJson = await fallbackRes.json();
    if (fallbackRes.ok && fallbackJson?.success) {
      documentTypes = (fallbackJson.data || []) as DocumentTypeRecord[];
    }
  }

  // Derive the unique set of types we need to materialize as
  // ApplicationDocumentRequirement rows. Source: each file's tagged label.
  const orderedLabels = dedupeLabels(
    documents.map((doc) => doc.documentType),
  );

  const typeIds = orderedLabels
    .map((label) => resolveDocumentTypeByLabel(label, documentTypes)?.id)
    .filter((id): id is string => Boolean(id));

  if (typeIds.length > 0) {
    const requestRes = await fetch(paths.requestDocuments(loanApplicationId), {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ documentTypeIds: typeIds }),
    });

    if (!requestRes.ok) {
      const requestJson = await requestRes.json().catch(() => ({}));
      throw new Error(
        requestJson.message || "Failed to prepare document requirements",
      );
    }
  }

  const docsRes = await fetch(paths.listDocuments(submissionId), { headers });
  const docsJson = await docsRes.json();

  if (!docsRes.ok) {
    throw new Error(docsJson.message || "Failed to load document requirements");
  }

  const requirements: Array<{
    requirementId: string;
    documentName: string | null;
    documentTypeId: string;
  }> = docsJson?.data?.documents || [];

  for (const doc of documents) {
    const resolved = resolveDocumentTypeByLabel(
      doc.documentType || "Other",
      documentTypes,
    );
    if (!resolved) continue;

    const requirement =
      requirements.find((item) => item.documentTypeId === resolved.id) ||
      requirements.find(
        (item) =>
          (item.documentName || "").trim().toLowerCase() ===
          (doc.documentType || "Other").trim().toLowerCase(),
      );

    if (!requirement?.requirementId) continue;

    const formData = new FormData();
    formData.append("file", doc.file);

    const uploadRes = await fetch(
      paths.uploadDocument(submissionId, requirement.requirementId),
      {
        method: "POST",
        headers,
        body: formData,
      },
    );

    const uploadJson = await uploadRes.json();
    if (!uploadRes.ok || !uploadJson.success) {
      throw new Error(
        uploadJson.message || `Failed to upload ${doc.fileName}`,
      );
    }
  }
}

function dedupeLabels(labels: Array<ApplicationDocumentType | "">) {
  const seen = new Set<string>();
  const out: ApplicationDocumentType[] = [];
  for (const label of labels) {
    const key = (label || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(label as ApplicationDocumentType);
  }
  return out;
}