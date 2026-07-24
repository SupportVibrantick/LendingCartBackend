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

/** Normalizes product interest range strings like "8-12" → "8% – 12%". */
export function formatInterestRateRange(value?: string | null) {
  if (!value?.trim()) return "—";

  const raw = value.trim().replace(/\s+/g, " ");
  const numbers = raw.match(/\d+(\.\d+)?/g);

  if (!numbers?.length) return raw;

  if (numbers.length >= 2) {
    return `${numbers[0]}% – ${numbers[1]}%`;
  }

  if (raw.includes("%")) return raw;
  return `${numbers[0]}%`;
}

export function formatLoiInterestDisplay(loi: BrokerLoiRecord) {
  if (loi.interestRate != null && !Number.isNaN(Number(loi.interestRate))) {
    return formatPercent(loi.interestRate);
  }

  return formatInterestRateRange(loi.lenderProduct?.interestRateRange);
}

export function getLoiProductLabel(loi: BrokerLoiRecord) {
  return (
    loi.lenderProduct?.productName ||
    loi.lenderProduct?.loanProductCode?.replace(/_/g, " ") ||
    "Commercial Term Sheet"
  );
}

export function formatLoiApprovedDisplay(
  amount?: number | null,
  status?: string | null,
) {
  if (amount != null && !Number.isNaN(Number(amount))) {
    return formatCurrency(amount);
  }

  const normalized = (status || "").toUpperCase();
  if (["SENT", "IN_REVIEW", "PENDING"].includes(normalized)) {
    return "Pending";
  }

  if (
    ["APPROVED", "LENDER_APPROVED", "AUTO_APPROVED", "CONDITIONAL"].includes(
      normalized,
    )
  ) {
    return "Under review";
  }

  return "—";
}

export function formatLoiGeneratedLabel(value?: string | null) {
  if (!value) return "Not generated yet";
  const formatted = formatLoiDate(value);
  return formatted === "—" ? "Not generated yet" : formatted;
}

export function hasLoiPdf(loi: BrokerLoiRecord) {
  return Boolean(loi.loiUrl?.trim());
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
  const normalizedBase = apiBase.replace(/\/+$/, "");
  if (loiUrl.startsWith("/uploads/")) {
    return `${normalizedBase}${loiUrl}`;
  }
  if (loiUrl.startsWith("/public/")) {
    return `${normalizedBase}${loiUrl}`;
  }
  return `${normalizedBase}/public${loiUrl}`;
}

export type LoiSortOption =
  | "newest"
  | "oldest"
  | "amount_desc"
  | "amount_asc"
  | "rate_asc"
  | "rate_desc"
  | "lender_az";

export type LoiComparisonSummary = {
  total: number;
  bestRate: { value: number; lenderName: string } | null;
  highestAmount: { value: number; lenderName: string } | null;
  latestGenerated: { date: string; lenderName: string } | null;
};

export function sortBrokerLois(
  lois: BrokerLoiRecord[],
  sortBy: LoiSortOption,
): BrokerLoiRecord[] {
  const copy = [...lois];

  copy.sort((a, b) => {
    switch (sortBy) {
      case "oldest":
        return (
          new Date(a.generatedAt || 0).getTime() -
          new Date(b.generatedAt || 0).getTime()
        );
      case "amount_desc":
        return (b.approvedAmount ?? -1) - (a.approvedAmount ?? -1);
      case "amount_asc":
        return (a.approvedAmount ?? Infinity) - (b.approvedAmount ?? Infinity);
      case "rate_asc":
        return (a.interestRate ?? Infinity) - (b.interestRate ?? Infinity);
      case "rate_desc":
        return (b.interestRate ?? -1) - (a.interestRate ?? -1);
      case "lender_az":
        return a.lenderName.localeCompare(b.lenderName);
      case "newest":
      default:
        return (
          new Date(b.generatedAt || 0).getTime() -
          new Date(a.generatedAt || 0).getTime()
        );
    }
  });

  return copy;
}

export function buildLoiComparisonSummary(
  lois: BrokerLoiRecord[],
): LoiComparisonSummary {
  const withRate = lois.filter((loi) => loi.interestRate != null);
  const withAmount = lois.filter((loi) => loi.approvedAmount != null);
  const withDate = lois.filter((loi) => loi.generatedAt);

  const bestRate =
    withRate.length > 0
      ? withRate.reduce((best, loi) =>
          (loi.interestRate as number) < (best.interestRate as number)
            ? loi
            : best,
        )
      : null;

  const highestAmount =
    withAmount.length > 0
      ? withAmount.reduce((best, loi) =>
          (loi.approvedAmount as number) > (best.approvedAmount as number)
            ? loi
            : best,
        )
      : null;

  const latestGenerated =
    withDate.length > 0
      ? withDate.reduce((latest, loi) =>
          new Date(loi.generatedAt as string).getTime() >
          new Date(latest.generatedAt as string).getTime()
            ? loi
            : latest,
        )
      : null;

  return {
    total: lois.length,
    bestRate: bestRate
      ? {
          value: bestRate.interestRate as number,
          lenderName: bestRate.lenderName,
        }
      : null,
    highestAmount: highestAmount
      ? {
          value: highestAmount.approvedAmount as number,
          lenderName: highestAmount.lenderName,
        }
      : null,
    latestGenerated: latestGenerated
      ? {
          date: latestGenerated.generatedAt as string,
          lenderName: latestGenerated.lenderName,
        }
      : null,
  };
}
