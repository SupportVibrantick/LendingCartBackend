import type { PendingApplicationDocument } from "./applicationDocumentTypes";

type DocumentTypeRecord = {
  id: string;
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

const resolveDocumentTypeId = (
  label: string,
  documentTypes: DocumentTypeRecord[],
) => {
  const normalized = label.trim().toLowerCase();
  if (!normalized) {
    return documentTypes.find((d) => d.name.toLowerCase() === "other")?.id;
  }

  const exact = documentTypes.find(
    (d) => d.name.trim().toLowerCase() === normalized,
  );
  if (exact) return exact.id;

  const partial = documentTypes.find((d) => {
    const name = d.name.trim().toLowerCase();
    return name.includes(normalized) || normalized.includes(name);
  });
  if (partial) return partial.id;

  return (
    documentTypes.find((d) => d.name.toLowerCase() === "other")?.id ||
    documentTypes[0]?.id
  );
};

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

  const typesRes = await fetch(`${apiBase}/document-types/active`, { headers });
  const typesJson = await typesRes.json();
  const documentTypes: DocumentTypeRecord[] = typesJson?.data || [];

  const typeIds = [
    ...new Set(
      documents
        .map((doc) =>
          resolveDocumentTypeId(doc.documentType || "Other", documentTypes),
        )
        .filter(Boolean),
    ),
  ] as string[];

  if (typeIds.length > 0) {
    const requestRes = await fetch(
      paths.requestDocuments(loanApplicationId),
      {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ documentTypeIds: typeIds }),
      },
    );

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
    const typeId = resolveDocumentTypeId(
      doc.documentType || "Other",
      documentTypes,
    );
    const label = (doc.documentType || "Other").trim().toLowerCase();
    const requirement =
      requirements.find((item) => item.documentTypeId === typeId) ||
      requirements.find(
        (item) => item.documentName?.trim().toLowerCase() === label,
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
