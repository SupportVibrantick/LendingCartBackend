export function formatDocumentStatusLabel(status?: string | null): string {
  if (!status) return "UNKNOWN";

  const labels: Record<string, string> = {
    PARTIAL: "UPLOADED",
    PENDING: "PENDING",
    COMPLETE: "COMPLETE",
    COMPLETED: "COMPLETE",
    SKIPPED: "SKIPPED",
    SENT_TO_LENDER: "SENT TO LENDER",
  };

 return labels[status] || status.replace(/_/g, " ").toUpperCase();
}
