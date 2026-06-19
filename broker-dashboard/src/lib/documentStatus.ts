export function formatDocumentStatusLabel(status?: string | null): string {
  if (!status) return "UNKNOWN";

  const labels: Record<string, string> = {
    PARTIAL: "UPLOADED",
    PENDING: "PENDING",
    COMPLETE: "COMPLETE",
    SKIPPED: "SKIPPED",
    SENT_TO_LENDER: "SENT TO LENDER",
  };

  return labels[status] || status.replace(/_/g, " ").toUpperCase();
}

export function getDocumentStatusChipClass(status: string) {
  switch (status) {
    case "COMPLETE":
      return "bg-emerald-100 text-emerald-700";
    case "PARTIAL":
      return "bg-amber-100 text-amber-700";
    case "PENDING":
      return "bg-yellow-100 text-yellow-600";
    case "SKIPPED":
      return "bg-red-100 text-red-700";
    case "SENT_TO_LENDER":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-slate-100 text-slate-500";
  }
}
