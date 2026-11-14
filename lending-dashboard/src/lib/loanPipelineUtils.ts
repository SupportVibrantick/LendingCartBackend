import { canRequestDocuments } from "./lenderPermissions";

export const PRODUCT_LABELS: Record<string, string> = {
  FIX_AND_FLIP_LOAN_1_TO_4_UNITS: "Fix & Flip",
  DSCR_LOAN_1_TO_4_UNITS: "DSCR",
  CONSTRUCTION_LOAN_1_TO_4_UNITS: "Construction (1-4 Units Residential)",
  BRIDGE_LOAN_1_TO_4_UNITS: "Bridge Loan (1-4 Units Residential)",
  RENTAL_PORTFOLIO: "Rental Portfolio (1-4 Units Residential)",
  CONSTRUCTION_LOAN: "Construction (CRE & Multifamily)",
  BRIDGE_LOAN: "Bridge Loan (CRE & Multifamily)",
  RENTAL_PORTFOLIO_CRE: "Rental Portfolio (CRE & Multifamily)",
  C_PACE: "C-Pace Loans (CRE & Multifamily)",
  SBA_504_REAL_ESTATE_AND_EQUIPMENT: "SBA 504",
  USDA_BI: "USDA B&I",
  AGENCY_LOAN_MULTIFAMILY: "Agency Multifamily",
  CRE_PERMANENT_LOAN: "CRE Permanent",
  PURCHASE_ORDER_FINANCE: "Purchase Order",
  ACCOUNTS_PAYABLE_FINANCE: "AP Supply Chain",
  ACCOUNTS_RECEIVABLE: "Accounts Receivable",
  INVOICE_FACTORING: "AR Factoring",
};

export const DECISION_FILTERS = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Needs Review" },
  { value: "CONDITIONAL", label: "Docs Requested" },
  { value: "APPROVED", label: "Approved" },
  { value: "DECLINED", label: "Declined" },
] as const;

export type DecisionFilterValue =
  (typeof DECISION_FILTERS)[number]["value"];

export function formatLoanProduct(code?: string) {
  if (!code) return "—";
  if (PRODUCT_LABELS[code]) return PRODUCT_LABELS[code];
  return code
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatCompactAmount(amount?: number | null) {
  if (!amount || amount <= 0) return "—";

  if (amount >= 1_000_000_000) {
    return `$${(amount / 1_000_000_000).toFixed(
      amount % 1_000_000_000 === 0 ? 0 : 1,
    )}B`;
  }

  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(
      amount % 1_000_000 === 0 ? 0 : 1,
    )}M`;
  }

  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(amount % 1_000 === 0 ? 0 : 1)}K`;
  }

  return `$${amount.toLocaleString()}`;
}

export function formatApplicationStatus(status?: string) {
  if (!status) return "—";

  if (status === "LENDER_APPROVED") return "Lender Approved";
  if (status === "LENDER_DECLINED") return "Lender Declined";

  const cleaned = status.replace("LENDER_", "");
  if (cleaned === "CONDITIONAL") return "Docs Requested";
  if (cleaned === "DECLINED") return "Declined";

  return cleaned
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getApplicationStatusColor(status?: string) {
  const s = status?.toLowerCase();

  switch (s) {
    case "new":
      return "bg-[#13538A] text-white";
    case "pending":
      return "bg-amber-500 text-white";
    case "client_pending":
      return "bg-rose-500 text-white";
    case "submitted":
      return "bg-[#1a6aad] text-white";
    case "sent":
    case "selected":
      return "bg-[#13538A] text-white";
    case "updated":
      return "bg-[#0e3d66] text-white";
    case "approved":
    case "auto_approved":
      return "bg-emerald-600 text-white";
    case "lender_approved":
      return "bg-green-600 text-white";
    case "declined":
    case "rejected":
    case "auto_declined":
    case "withdrawn":
      return "bg-red-600 text-white";
    case "lender_declined":
      return "bg-rose-700 text-white";
    case "in_review":
      return "bg-[#13538A] text-white";
    case "conditional":
      return "bg-amber-500 text-white";
    case "draft":
      return "bg-slate-500 text-white";
    case "incomplete":
    case "superseded":
    case "suspended":
      return "bg-orange-500 text-white";
    case "completed":
      return "bg-teal-600 text-white";
    case "funded":
      return "bg-emerald-700 text-white";
    default:
      return "bg-slate-600 text-white";
  }
}

export function formatShortDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function buildBorrowerDisplayName(item: {
  borrowerFirstName?: string;
  borrowerLastName?: string;
  borrowerName?: string;
  client?: { legalName?: string | null };
}) {
  const fullName = [item.borrowerFirstName, item.borrowerLastName]
    .map((value) => (value || "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();

  if (fullName) return fullName;

  if (
    item.borrowerName &&
    !["Individual Applicant", "Applicant"].includes(item.borrowerName)
  ) {
    return item.borrowerName;
  }

  const legalName = item.client?.legalName?.trim();
  if (legalName && !["Individual Applicant", "Applicant"].includes(legalName)) {
    return legalName;
  }

  return "N/A";
}

export function getBorrowerInitials(name?: string) {
  const cleaned = (name || "").trim();
  if (!cleaned || cleaned === "N/A") return "?";

  return cleaned
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export function formatEntityTypeLabel(value?: string) {
  if (!value || value === "-") return "—";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function canLenderTakeDecision(input?: {
  applicationStatus?: string | null;
  lenderStatus?: string | null;
  lenderDecision?: string | null;
}) {
  const applicationStatus = (input?.applicationStatus || "")
    .toUpperCase()
    .trim();
  const lenderStatus = (input?.lenderStatus || "").toUpperCase().trim();
  const lenderDecision = (input?.lenderDecision || "").toUpperCase().trim();

  if (["FUNDED", "WITHDRAWN", "SUSPENDED"].includes(applicationStatus)) {
    return false;
  }

  if (["APPROVED", "DECLINED"].includes(lenderDecision)) {
    return false;
  }

  if (["APPROVED", "DECLINED"].includes(lenderStatus)) {
    return false;
  }

  return true;
}

export function normalizeLenderDecision(status?: string | null) {
  return (status || "").toUpperCase().trim();
}

export function canShowFinalApprovalAction(input: {
  lenderDecision?: string | null;
  canDecide: boolean;
  canTakeDecision: boolean;
}) {
  return (
    input.canDecide &&
    input.canTakeDecision &&
    normalizeLenderDecision(input.lenderDecision) === "CONDITIONAL"
  );
}

export function canShowRequestDocumentsAction(input: {
  lenderDecision?: string | null;
  canRequestDocuments: boolean;
  canTakeDecision: boolean;
}) {
  const decision = normalizeLenderDecision(input.lenderDecision);

  if (["APPROVED", "DECLINED", "CONDITIONAL"].includes(decision)) {
    return false;
  }

  return input.canRequestDocuments && input.canTakeDecision;
}

export function canShowRejectAction(input: {
  lenderDecision?: string | null;
  canDecide: boolean;
  canTakeDecision: boolean;
}) {
  const decision = normalizeLenderDecision(input.lenderDecision);

  if (["APPROVED", "DECLINED"].includes(decision)) {
    return false;
  }

  return input.canDecide && input.canTakeDecision;
}

export function canLenderRequestDocuments(
  _lenderStatus?: string | null,
  _latestReviewStatus?: string | null,
) {
  // Always available once the lender role allows it — approval, decline,
  // and LOI generation must not hide Request Documents.
  return canRequestDocuments();
}

export function getLenderRequestDocumentsDisabledReason(
  _lenderStatus?: string | null,
  _latestReviewStatus?: string | null,
) {
  if (!canRequestDocuments()) {
    return "You do not have permission to request documents.";
  }

  return "";
}

export function getPaginationWindow(
  currentPage: number,
  totalPages: number,
  maxButtons = 5,
) {
  if (totalPages <= maxButtons) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const half = Math.floor(maxButtons / 2);
  let start = Math.max(1, currentPage - half);
  let end = Math.min(totalPages, start + maxButtons - 1);

  if (end - start + 1 < maxButtons) {
    start = Math.max(1, end - maxButtons + 1);
  }

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}
