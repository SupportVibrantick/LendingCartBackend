import type {
  PendingApplicationDocument,
  ApplicationDocumentType,
} from "./applicationDocumentTypes";

type DocumentTypeRecord = {
  id: string;
  code?: string | null;
  name: string;
  /** Present on `/document-types/wizard-options` — matches wizard dropdown labels. */
  label?: string | null;
};

type DocumentUploadPaths = {
  requestDocuments: (loanApplicationId: string) => string;
  listDocuments: (submissionId: string) => string;
  uploadDocument: (submissionId: string, requirementId: string) => string;
};

/** Wizard dropdown label → DocumentType.code (keep in sync with backend wizardOptions). */
const WIZARD_LABEL_TO_CODE: Record<string, string> = {
  "Driving License": "DRIVING_LICENSE",
  "Social Security Number Card": "SSN_CARD",
  "Purchase Agreement": "PURCHASE_AGREEMENT",
  "Financial Statements": "FINANCIAL_STATEMENTS",
  "Tax Returns": "TAX_RETURNS",
  "Profit & Loss": "PROFIT_AND_LOSS",
  "Property Appraisal": "PROPERTY_APPRAISAL",
  "Property Tax Bill": "PROPERTY_TAX_BILL",
  "Construction Quote": "CONSTRUCTION_QUOTE",
  "Construction Plans": "CONSTRUCTION_PLANS",
  "Construction Budget": "CONSTRUCTION_BUDGET",
  "Sources & Uses": "SOURCES_AND_USES",
  Proforma: "PROFORMA",
  "Permits & Approvals": "PERMITS_APPROVALS",
  "Certificate of Occupancy": "CERTIFICATE_OF_OCCUPANCY",
  "Bank Statements": "BANK_STATEMENTS",
  "Entity Docs": "ENTITY_DOCS",
  "Insurance Binder": "INSURANCE_BINDER",
  "Rent Roll": "RENT_ROLL",
  "Personal Financial Statement": "PERSONAL_FINANCIAL_STATEMENT",
  "Credit Report": "CREDIT_REPORT",
  "Title Report": "TITLE_REPORT",
  Other: "OTHER",
};

const defaultDocumentPaths = (apiBase: string): DocumentUploadPaths => ({
  requestDocuments: (loanApplicationId: string) =>
    `${apiBase}/broker/loan-pipeline/${loanApplicationId}/request-documents`,
  // API caps page size at 50
  listDocuments: (submissionId: string) =>
    `${apiBase}/broker/loan-pipeline/submissions/${submissionId}/documents?limit=50&documentCategory=upload`,
  uploadDocument: (submissionId: string, requirementId: string) =>
    `${apiBase}/broker/loan-pipeline/submissions/${submissionId}/documents/${requirementId}/upload`,
});

function findOtherDocumentType(
  documentTypes: DocumentTypeRecord[],
): DocumentTypeRecord | undefined {
  return (
    documentTypes.find((d) => (d.code || "").toUpperCase() === "OTHER") ||
    documentTypes.find((d) => (d.label || "").trim().toLowerCase() === "other") ||
    documentTypes.find((d) => d.name.trim().toLowerCase() === "other")
  );
}

/**
 * Resolve a wizard label (one of the 23 strings in
 * APPLICATION_DOCUMENT_TYPE_OPTIONS) to a DB DocumentType row.
 *
 * Match priority:
 *   1. wizard label → code map, then exact code
 *   2. exact wizard `label` field (from /wizard-options)
 *   3. exact code string
 *   4. exact name
 *   5. fall back to "Other" only (never the first catalog row)
 */
export function resolveDocumentTypeByLabel(
  label: ApplicationDocumentType | "",
  documentTypes: DocumentTypeRecord[],
): DocumentTypeRecord | undefined {
  const raw = (label || "Other").trim();
  const normalized = raw.toLowerCase();
  if (!normalized || documentTypes.length === 0) {
    return findOtherDocumentType(documentTypes);
  }

  const mappedCode = WIZARD_LABEL_TO_CODE[raw] || WIZARD_LABEL_TO_CODE[
    Object.keys(WIZARD_LABEL_TO_CODE).find(
      (key) => key.toLowerCase() === normalized,
    ) || ""
  ];

  if (mappedCode) {
    const byMappedCode = documentTypes.find(
      (d) => (d.code || "").toUpperCase() === mappedCode,
    );
    if (byMappedCode) return byMappedCode;
  }

  const byLabel = documentTypes.find(
    (d) => (d.label || "").trim().toLowerCase() === normalized,
  );
  if (byLabel) return byLabel;

  const byCode = documentTypes.find(
    (d) => typeof d.code === "string" && d.code.toLowerCase() === normalized,
  );
  if (byCode) return byCode;

  const byName = documentTypes.find(
    (d) => d.name.trim().toLowerCase() === normalized,
  );
  if (byName) return byName;

  return findOtherDocumentType(documentTypes);
}

/**
 * Upload pending wizard documents into a freshly-created loan application.
 * Each file is uploaded to the requirement for its selected document type.
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

  let documentTypes: DocumentTypeRecord[] = [];
  const byId = new Map<string, DocumentTypeRecord>();

  try {
    const wizardRes = await fetch(`${apiBase}/document-types/wizard-options`, {
      headers,
    });
    const wizardJson = await wizardRes.json();
    if (wizardRes.ok && wizardJson?.success) {
      for (const row of (wizardJson.data || []) as DocumentTypeRecord[]) {
        if (row?.id) byId.set(row.id, row);
      }
    }
  } catch {
    // Fall through — merge active catalog below.
  }

  try {
    const fallbackRes = await fetch(`${apiBase}/document-types/active?all=true`, {
      headers,
    });
    const fallbackJson = await fallbackRes.json();
    if (fallbackRes.ok && fallbackJson?.success) {
      for (const row of (fallbackJson.data || []) as DocumentTypeRecord[]) {
        if (!row?.id) continue;
        // Prefer wizard-options rows (have `label`); fill gaps from active catalog.
        if (!byId.has(row.id)) byId.set(row.id, row);
      }
    }
  } catch {
    // ignore
  }

  documentTypes = Array.from(byId.values());

  if (documentTypes.length === 0) {
    throw new Error(
      "Document type catalog is empty. Ask an admin to seed document types, then try again.",
    );
  }

  const orderedLabels = dedupeLabels(
    documents.map((doc) => doc.documentType),
  );

  const typeIds = [
    ...new Set(
      orderedLabels
        .map((label) => resolveDocumentTypeByLabel(label, documentTypes)?.id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

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

  const requirementByTypeId = new Map(
    requirements.map((item) => [item.documentTypeId, item]),
  );

  for (const doc of documents) {
    const resolved = resolveDocumentTypeByLabel(
      doc.documentType || "Other",
      documentTypes,
    );
    if (!resolved) {
      throw new Error(
        `Could not resolve document type for "${doc.fileName}" (${doc.documentType || "Other"})`,
      );
    }

    const requirement = requirementByTypeId.get(resolved.id);
    if (!requirement?.requirementId) {
      throw new Error(
        `No document requirement found for "${doc.documentType || "Other"}" (${doc.fileName})`,
      );
    }

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
    const key = (label || "Other").trim() || "Other";
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key as ApplicationDocumentType);
  }
  return out;
}
