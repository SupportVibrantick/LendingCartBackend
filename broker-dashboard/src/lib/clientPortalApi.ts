const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:4000";

export function getClientPortalApiBase() {
  return API_BASE.replace(/\/$/, "");
}

export function getClientPortalAuthHeaders(): Record<string, string> {
  const clientToken = sessionStorage.getItem("client_token");
  const headers: Record<string, string> = {};
  if (clientToken) {
    headers.Authorization = `Bearer ${clientToken}`;
  }
  return headers;
}

export type ClientSignDocumentRow = {
  requirementId: string;
  documentName: string;
  signStatus?: string | null;
  signStatusLabel?: string | null;
  signMode?: string | null;
  fieldCount?: number | null;
  hasSignatureField?: boolean | null;
  lenderName?: string | null;
  loiVersionLabel?: string | null;
  isBrokerLoi?: boolean | null;
  isStandaloneBrokerLoi?: boolean | null;
  requestApplicationLenderId?: string | null;
  templateFileUrl?: string | null;
  templateFileName?: string | null;
  templateMimeType?: string | null;
  signedUpload?: {
    uploadId?: string;
    fileName?: string;
    fileUrl?: string;
    fileMimeType?: string | null;
  } | null;
};

export async function fetchClientSignDocument(
  loanApplicationId: string,
  requirementId: string,
): Promise<ClientSignDocumentRow | null> {
  const res = await fetch(
    `${getClientPortalApiBase()}/client-portal/applications/${loanApplicationId}/sign-documents`,
    { headers: getClientPortalAuthHeaders() },
  );
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Failed to load sign documents");
  }
  const rows = (json.data || []) as ClientSignDocumentRow[];
  return rows.find((row) => row.requirementId === requirementId) || null;
}

export function isBrokerTermSheetDoc(row: ClientSignDocumentRow) {
  if (row.isBrokerLoi) return true;
  return /\/broker\/LOI\//i.test(row.templateFileUrl || "");
}

export function isStandaloneBrokerTermSheet(row: ClientSignDocumentRow) {
  if (row.isStandaloneBrokerLoi) return true;
  return (
    isBrokerTermSheetDoc(row) &&
    !row.requestApplicationLenderId &&
    !row.lenderName
  );
}
