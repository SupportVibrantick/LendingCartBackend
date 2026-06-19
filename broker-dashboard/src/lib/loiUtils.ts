export type BrokerLoiCondition = {
  conditionId: string;
  description: string;
  status: string;
  satisfiedAt?: string | null;
};

export type BrokerLoiRecord = {
  applicationLenderId: string;
  loanApplicationId?: string;
  lenderOrgId?: string | null;
  lenderName: string;
  lenderEmail?: string | null;
  lenderPhone?: string | null;
  status: string;
  reviewStatus?: string | null;
  loiUrl?: string | null;
  sentAt?: string | null;
  lastUpdatedAt?: string | null;
  approvedAmount?: number | null;
  interestRate?: number | null;
  notes?: string | null;
  generatedAt?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: {
    userId: string;
    name?: string | null;
    email?: string | null;
  } | null;
  conditions?: BrokerLoiCondition[];
  lenderProduct?: {
    id: string;
    loanProductCode?: string | null;
    productName?: string | null;
    minLoanAmount?: number | null;
    maxLoanAmount?: number | null;
    minTermMonths?: number | null;
    maxTermMonths?: number | null;
    interestRateRange?: string | null;
    maxLtvPercent?: number | null;
    maxArvPercent?: number | null;
    maxLtcPercent?: number | null;
  } | null;
};

export type BrokerLoiPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
};

export type BrokerLoiListResponse = {
  applicationId: string;
  applicationNumber?: string | null;
  applicationStatus?: string | null;
  amountRequested?: number | null;
  purpose?: string | null;
  totalLoiReceived: number;
  lois: BrokerLoiRecord[];
  pagination: BrokerLoiPagination;
};

export function formatCurrency(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `$${Number(value).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}`;
}

export function formatPercent(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `${Number(value)}%`;
}

export function formatLoiDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatLoiStatusLabel(status?: string | null) {
  if (!status) return "—";
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getLoiStatusChipClass(status?: string | null) {
  const normalized = (status || "").toUpperCase();

  if (["APPROVED", "LENDER_APPROVED", "AUTO_APPROVED"].includes(normalized)) {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300";
  }

  if (["DECLINED", "LENDER_DECLINED", "REJECTED"].includes(normalized)) {
    return "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300";
  }

  if (["CONDITIONAL", "IN_REVIEW", "SENT", "PENDING"].includes(normalized)) {
    return "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300";
  }

  return "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300";
}

export function buildLoiPdfUrl(apiBase: string, loiUrl?: string | null) {
  if (!loiUrl) return null;
  if (loiUrl.startsWith("http://") || loiUrl.startsWith("https://")) {
    return loiUrl;
  }
  return `${apiBase}/public${loiUrl}`;
}
