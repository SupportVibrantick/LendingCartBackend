import { canRequestDocuments } from "./lenderPermissions";

export const PRODUCT_LABELS: Record<string, string> = {
  FIX_AND_FLIP_LOAN_1_TO_4_UNITS: "Fix & Flip",
  DSCR_LOAN_1_TO_4_UNITS: "DSCR",
  CONSTRUCTION_LOAN_1_TO_4_UNITS: "Construction",
  BRIDGE_LOAN_1_TO_4_UNITS: "Bridge",
  SBA_504_REAL_ESTATE_AND_EQUIPMENT: "SBA 504",
  USDA_BI: "USDA B&I",
  AGENCY_LOAN_MULTIFAMILY: "Agency Multifamily",
  CRE_PERMANENT_LOAN: "CRE Permanent",
  RENTAL_PORTFOLIO: "Rental Portfolio",
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
  const cleaned = (status || "").replace("LENDER_", "");

  switch (cleaned) {
    case "APPROVED":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";
    case "DECLINED":
      return "bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20";
    case "PENDING":
      return "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
    case "IN_REVIEW":
      return "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20";
    case "LENDER_APPROVED":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";
    case "LENDER_DECLINED":
      return "bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20";
    case "SENT":
      return "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20";
    case "CONDITIONAL":
      return "bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/20";
    default:
      return "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
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

export function canLenderRequestDocuments(
  lenderStatus?: string | null,
  latestReviewStatus?: string | null,
) {
  if (!canRequestDocuments()) {
    return false;
  }

  const status = (lenderStatus || "").toUpperCase().trim();
  const review = (latestReviewStatus || "").toUpperCase().trim();

  if (["APPROVED", "DECLINED"].includes(status)) return false;
  if (["APPROVED", "DECLINED"].includes(review)) return false;

  return true;
}

export function getLenderRequestDocumentsDisabledReason(
  lenderStatus?: string | null,
  latestReviewStatus?: string | null,
) {
  if (!canRequestDocuments()) {
    return "You do not have permission to request documents.";
  }

  const status = (lenderStatus || "").toUpperCase().trim();
  const review = (latestReviewStatus || "").toUpperCase().trim();

  if (status === "APPROVED" || review === "APPROVED") {
    return "This application is already approved. Additional documents cannot be requested.";
  }

  if (status === "DECLINED" || review === "DECLINED") {
    return "This application was declined. Documents cannot be requested.";
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
