export const APPLICATION_DOCUMENT_TYPE_OPTIONS = [
  "Driving License",
  "Social Security Number Card",
  "Purchase Agreement",
  "Financial Statements",
  "Tax Returns",
  "Profit & Loss",
  "Property Appraisal",
  "Property Tax Bill",
  "Construction Quote",
  "Construction Plans",
  "Construction Budget",
  "Sources & Uses",
  "Proforma",
  "Permits & Approvals",
  "Certificate of Occupancy",
  "Bank Statements",
  "Entity Docs",
  "Insurance Binder",
  "Rent Roll",
  "Personal Financial Statement",
  "Credit Report",
  "Title Report",
  "Other",
] as const;

export type ApplicationDocumentType =
  (typeof APPLICATION_DOCUMENT_TYPE_OPTIONS)[number];

export interface PendingApplicationDocument {
  id: string;
  file: File;
  fileName: string;
  documentType: ApplicationDocumentType | "";
  previewUrl: string;
}

export const createPendingDocument = (file: File): PendingApplicationDocument => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  file,
  fileName: file.name,
  documentType: "Other",
  previewUrl: URL.createObjectURL(file),
});

export const revokePendingDocumentPreview = (doc: PendingApplicationDocument) => {
  if (doc.previewUrl.startsWith("blob:")) {
    URL.revokeObjectURL(doc.previewUrl);
  }
};
