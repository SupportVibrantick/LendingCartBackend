const BLOCKED_LENDER_STATUSES = new Set(["APPROVED", "DECLINED", "WITHDRAWN"]);

type SubmittedLenderOption = {
  canReceiveDocuments?: boolean;
  status?: string;
};

export function canLenderReceiveDocuments(lender: SubmittedLenderOption) {
  if (typeof lender.canReceiveDocuments === "boolean") {
    return lender.canReceiveDocuments;
  }

  return !BLOCKED_LENDER_STATUSES.has(lender.status || "");
}

export function getLenderStatusBadgeClass(status?: string) {
  switch (status) {
    case "IN_REVIEW":
      return "bg-yellow-100 text-yellow-700";
    case "APPROVED":
      return "bg-emerald-100 text-emerald-700";
    case "DECLINED":
      return "bg-rose-100 text-rose-700";
    case "WITHDRAWN":
      return "bg-slate-100 text-slate-600";
    default:
      return "bg-blue-100 text-blue-700";
  }
}
