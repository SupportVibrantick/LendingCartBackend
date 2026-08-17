import type { PendingApplicationDocument } from "./applicationDocumentTypes";

type DocumentTypeRecord = {
  id: string;
  name: string;
};

type RequirementRecord = {
  requirementId: string;
  documentName: string | null;
  documentTypeId: string;
};

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

async function loadActiveDocumentTypes(
  apiBase: string,
  headers: Record<string, string>,
): Promise<DocumentTypeRecord[]> {
  const typesRes = await fetch(`${apiBase}/document-types/active`, { headers });
  const typesJson = await typesRes.json();
  return typesJson?.data || [];
}

async function fetchRequirements(
  listUrl: string,
  headers: Record<string, string>,
): Promise<RequirementRecord[]> {
  const docsRes = await fetch(listUrl, { headers });
  const docsJson = await docsRes.json();

  if (!docsRes.ok) {
    throw new Error(docsJson.message || "Failed to load document requirements");
  }

  return docsJson?.data?.documents || [];
}

async function uploadSingleDocument({
  apiBase,
  submissionId,
  requirementId,
  doc,
  headers,
}: {
  apiBase: string;
  submissionId: string;
  requirementId: string;
  doc: PendingApplicationDocument;
  headers: Record<string, string>;
}) {
  const formData = new FormData();
  formData.append("file", doc.file);

  const uploadRes = await fetch(
    `${apiBase}/broker/loan-pipeline/submissions/${submissionId}/documents/${requirementId}/upload`,
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

/**
 * Authenticated broker / sub-broker / loan-officer upload path. Uses the
 * token-protected broker pipeline endpoints.
 */
export async function uploadPendingApplicationDocuments({
  apiBase,
  token,
  loanApplicationId,
  submissionId,
  documents,
}: {
  apiBase: string;
  token: string | null;
  loanApplicationId: string;
  submissionId: string;
  documents: PendingApplicationDocument[];
}) {
  if (documents.length === 0) return;

  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const documentTypes = await loadActiveDocumentTypes(apiBase, headers);

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
      `${apiBase}/broker/loan-pipeline/${loanApplicationId}/request-documents`,
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

  const requirements = await fetchRequirements(
    `${apiBase}/broker/loan-pipeline/submissions/${submissionId}/documents?limit=100&documentCategory=upload`,
    headers,
  );

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

    await uploadSingleDocument({
      apiBase,
      submissionId,
      requirementId: requirement.requirementId,
      doc,
      headers,
    });
  }
}

/**
 * Unauthenticated public-embed upload path. Mirrors the broker flow but
 * hits the public (no-token) counterparts of request-documents and
 * upload so the borrower's submission survives without a portal token.
 *
 * Used after a successful POST to /api/public/broker/applications/submit.
 *
 * The public /document-types/active endpoint requires auth, so the
 * document-type catalog is resolved server-side in the public
 * requestDocuments route. We send the human-readable labels here.
 */
export async function uploadPublicPendingDocuments({
  apiBase,
  loanApplicationId,
  submissionId,
  documents,
}: {
  apiBase: string;
  loanApplicationId: string;
  submissionId: string;
  documents: PendingApplicationDocument[];
}) {
  if (documents.length === 0) return;

  const headers: Record<string, string> = {};

  // Dedupe labels while preserving order. Backend resolves them to ids.
  const labels = (() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const doc of documents) {
      const label = (doc.documentType || "Other").trim();
      if (!label || seen.has(label)) continue;
      seen.add(label);
      out.push(label);
    }
    return out;
  })();

  if (labels.length > 0) {
    const requestRes = await fetch(
      `${apiBase}/api/public/broker/applications/${loanApplicationId}/request-documents`,
      {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ documentTypes: labels }),
      },
    );

    if (!requestRes.ok) {
      const requestJson = await requestRes.json().catch(() => ({}));
      throw new Error(
        requestJson.message || "Failed to prepare document requirements",
      );
    }
  }

  const requirements = await fetchRequirements(
    `${apiBase}/api/public/broker/applications/submissions/${submissionId}/documents?limit=100&documentCategory=upload`,
    headers,
  );

  for (const doc of documents) {
    const label = (doc.documentType || "Other").trim().toLowerCase();
    const requirement =
      requirements.find(
        (item) => item.documentName?.trim().toLowerCase() === label,
      ) ||
      requirements.find((item) =>
        item.documentName?.trim().toLowerCase().includes(label),
      );

    if (!requirement?.requirementId) continue;

    const formData = new FormData();
    formData.append("file", doc.file);

    const uploadRes = await fetch(
      `${apiBase}/api/public/broker/applications/submissions/${submissionId}/documents/${requirement.requirementId}/upload`,
      {
        method: "POST",
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
