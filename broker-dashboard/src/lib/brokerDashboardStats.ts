export type DashboardPeriod = "7d" | "30d" | "90d" | "12m";

export type MetricComparison = {
  current: number;
  previous: number;
  changePercent: number | null;
};

export type MonthlyTrendPoint = {
  label: string;
  applications: number;
  submitted: number;
  approved: number;
  funded: number;
  fundedVolume: number;
};

export type ProductVolumePoint = {
  product: string;
  totalApprovedAmount: number;
};

export type BrokerMetricKey =
  | "totalApplications"
  | "totalSubmitted"
  | "totalInReview"
  | "totalApproved"
  | "totalDeclined"
  | "totalFunded"
  | "totalWithdrawn"
  | "totalVolumeFunded"
  | "uniqueLendersAccessed";

export type BrokerStats = {
  totalApplications: number;
  totalSubmitted: number;
  totalInReview: number;
  totalApproved: number;
  totalDeclined: number;
  totalFunded: number;
  totalWithdrawn: number;
  totalVolumeFunded: number;
  uniqueLendersAccessed: number;
  applicationsByStatus: Record<string, number>;
  conversion: {
    submissionRate: number;
    approvalRate: number;
    fundingRate: number;
  };
  monthlyTrend: MonthlyTrendPoint[];
  productWiseApprovedVolume: ProductVolumePoint[];
  period?: {
    key: DashboardPeriod;
    start: string;
    end: string;
    granularity: "day" | "week" | "month";
  };
  comparison?: Partial<Record<BrokerMetricKey, MetricComparison>>;
};

export function formatCompactCurrency(value: number) {
  const amount = Number(value) || 0;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(amount >= 10_000 ? 0 : 1)}K`;
  return `$${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function formatCompactCount(value: number) {
  const count = Number(value) || 0;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toLocaleString();
}

export function formatChangePercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}
