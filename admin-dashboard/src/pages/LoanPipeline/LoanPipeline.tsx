import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import {
  Eye,
  Search,
  ChevronLeft,
  ChevronRight,
  Building2,
  MoreHorizontal,
  TrendingUp,
  RefreshCw,
  SearchX,
  FileText,
  Clock3,
  BadgeCheck,
  CircleDollarSign,
  X,
} from "lucide-react";
import { ADMIN_API_BASE } from "../../lib/adminApi";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { openLoanPipelineDetail } from "../../lib/loanPipelineNavigation";
import {
  resolveBorrowerName,
  resolveEntityType,
  resolveLoanAmount,
} from "../../lib/loanPipelineUtils";

/* ================= TYPES ================= */
type LenderItem = {
  lenderOrgId: string;
  lenderName: string;
  lenderProduct: string;
  lenderStatus: string;
  sentAt: string;
};

type TableRow = {
  applicationId: string;
  applicationNumber: string;
  borrowerName: string;
  entityType: string;
  loanType: string;
  amount: number | null;
  applicationStatus: string;
  brokerName: string;
  lenderStatus: string;
  sentAt: string | null;
  lenders: LenderItem[];
  createdAt: string;
};

const LOAN_TYPE_LABELS: Record<string, string> = {
  FIX_AND_FLIP_LOAN_1_TO_4_UNITS: "Fix & Flip",
  DSCR_LOAN: "DSCR",
  BRIDGE_LOAN: "Bridge",
  EQUIPMENT_FINANCE: "Equipment",
};

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "CLIENT_PENDING", label: "Client Pending" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "IN_REVIEW", label: "In Review" },
  { value: "APPROVED", label: "Approved" },
  { value: "DECLINED", label: "Rejected" },
];

const TABLE_COLUMNS = 8;

/* ================= HELPERS ================= */
function formatLoanType(code?: string) {
  if (!code) return "—";
  if (LOAN_TYPE_LABELS[code]) return LOAN_TYPE_LABELS[code];
  return code.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCompactAmount(value?: number | null) {
  const num = Number(value) || 0;
  if (!Number.isFinite(num) || num <= 0) return "$0";
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1).replace(/\.0$/, "")}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
  return `$${num.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatShortDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatStatusLabel(status?: string) {
  if (!status) return "Unknown";
  if (status === "APPROVED" || status === "LENDER_APPROVED" || status === "AUTO_APPROVED") {
    return "Approved";
  }
  if (status === "FUNDED") return "Funded";
  if (
    status === "DECLINED" ||
    status === "REJECTED" ||
    status === "LENDER_DECLINED" ||
    status === "AUTO_DECLINED"
  ) {
    return "Rejected";
  }
  if (status === "CLIENT_PENDING") return "Client Pending";
  if (status === "IN_REVIEW") return "In Review";
  if (status === "LENDER_SELECTED") return "Lender Selected";
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getApplicationStatusColor(status?: string) {
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
      return "bg-red-600 text-white";
    case "lender_declined":
      return "bg-rose-700 text-white";
    case "in_review":
      return "bg-[#13538A] text-white";
    case "draft":
      return "bg-slate-500 text-white";
    case "incomplete":
    case "superseded":
      return "bg-orange-500 text-white";
    case "completed":
      return "bg-teal-600 text-white";
    case "funded":
      return "bg-emerald-700 text-white";
    default:
      return "bg-slate-600 text-white";
  }
}

function getVisiblePageNumbers(
  currentPage: number,
  totalPages: number,
): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages: Array<number | "ellipsis"> = [1];

  if (currentPage > 3) {
    pages.push("ellipsis");
  }

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  if (currentPage < totalPages - 2) {
    pages.push("ellipsis");
  }

  pages.push(totalPages);
  return pages;
}

function getAuthHeaders(): HeadersInit {
  const token = sessionStorage.getItem("admin_token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

function getInitials(name: string) {
  const cleaned = name?.trim();
  if (!cleaned || cleaned === "N/A" || cleaned === "Client") return "?";

  return cleaned
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

/* ================= COMPONENT ================= */
export default function LoanPipeline() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm.trim(), 350);
  const [statusFilter, setStatusFilter] = useState("");
  const [viewLenders, setViewLenders] = useState<LenderItem[] | null>(null);
  const [lenderModalQuery, setLenderModalQuery] = useState("");
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalVolume, setTotalVolume] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [countsTotal, setCountsTotal] = useState(0);
  const [inReviewCount, setInReviewCount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(8);

  const loadSubmissions = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setLoading(true);

        const params = new URLSearchParams({
          page: String(currentPage),
          limit: String(rowsPerPage),
        });
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (statusFilter) params.set("status", statusFilter);

        const res = await fetch(
          `${ADMIN_API_BASE}/admin/loan-pipeline?${params.toString()}`,
          {
            headers: getAuthHeaders(),
            signal,
          },
        );

        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.message || "Failed to load loan pipeline");
        }

        const mappedRows: TableRow[] = (json.data || []).map((item: any) => {
          const lender = item.lenders?.[0];

          return {
            applicationId: item.applicationId,
            applicationNumber: item.applicationNumber,
            borrowerName: resolveBorrowerName(item),
            entityType: resolveEntityType(item),
            loanType: item.loanProductCode,
            amount: resolveLoanAmount(item),
            applicationStatus: item.status,
            brokerName: item.broker?.name || "-",
            lenderStatus: lender?.lenderStatus || "-",
            sentAt: lender?.sentAt || null,
            createdAt: item.createdAt,
            lenders: item.lenders || [],
          };
        });

        setRows(mappedRows);
        setTotal(json.pagination?.total ?? json.total ?? mappedRows.length);
        setTotalPages(json.pagination?.totalPages || 1);
        setTotalVolume(Number(json.summary?.totalAmount || 0));
        setStatusCounts(json.summary?.statusCounts || {});
        setCountsTotal(
          Number(
            json.summary?.countsTotal ??
              json.pagination?.total ??
              mappedRows.length,
          ),
        );
        setInReviewCount(Number(json.summary?.inReviewCount || 0));
        setApprovedCount(Number(json.summary?.approvedCount || 0));
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        toast.error(err.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [currentPage, debouncedSearch, statusFilter, rowsPerPage],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, rowsPerPage]);

  useEffect(() => {
    const controller = new AbortController();
    loadSubmissions(controller.signal);
    return () => controller.abort();
  }, [loadSubmissions]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (dropdownRef.current?.contains(target)) return;

      if (
        target instanceof HTMLElement &&
        target.closest("[data-dropdown-trigger]")
      ) {
        return;
      }

      setActiveActionId(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openRowPreview = (applicationId: string) => {
    openLoanPipelineDetail(navigate, applicationId);
  };

  const hasActiveFilters = Boolean(debouncedSearch || statusFilter);
  const showingFrom = total === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const showingTo = Math.min(currentPage * rowsPerPage, total);

  const filteredViewLenders = useMemo(() => {
    if (!viewLenders) return [];
    const q = lenderModalQuery.trim().toLowerCase();
    if (!q) return viewLenders;
    return viewLenders.filter((lender) => {
      const name = (lender.lenderName || "").toLowerCase();
      const product = formatLoanType(lender.lenderProduct).toLowerCase();
      const status = formatStatusLabel(lender.lenderStatus).toLowerCase();
      return name.includes(q) || product.includes(q) || status.includes(q);
    });
  }, [viewLenders, lenderModalQuery]);

  const kpiCards = [
    {
      label: "Total Apps",
      value: countsTotal,
      hint: "All applications",
      icon: FileText,
      iconWrap: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400",
    },
    {
      label: "In Review",
      value: inReviewCount,
      hint: "Awaiting decision",
      icon: Clock3,
      iconWrap:
        "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
    },
    {
      label: "Approved",
      value: approvedCount,
      hint: "Lender approved",
      icon: BadgeCheck,
      iconWrap:
        "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
    },
    {
      label: "Volume",
      value: formatCompactAmount(totalVolume),
      hint: "Requested amount",
      icon: CircleDollarSign,
      iconWrap:
        "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400",
    },
  ] as const;

  return (
    <div className="w-full space-y-4 pb-6 text-slate-900 dark:text-slate-100">
      {/* Hero */}
      <section className="overflow-hidden rounded-xl border border-[#13538A]/20 bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#5D28A8] p-4 text-white sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
              Platform Overview
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Loan Pipeline
              </h1>
              <button
                type="button"
                onClick={() => loadSubmissions()}
                disabled={loading}
                title="Refresh"
                className="group inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/25 bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : "transition-transform duration-500 group-hover:rotate-180"}`}
                />
              </button>
            </div>
            <p className="mt-1.5 max-w-2xl text-sm text-white/80">
              {total} application{total === 1 ? "" : "s"}
              {statusFilter ? ` · ${formatStatusLabel(statusFilter)}` : ""}
              {debouncedSearch ? ` · “${debouncedSearch}”` : ""} ·{" "}
              {formatCompactAmount(totalVolume)} total volume
            </p>
          </div>

          <div className="inline-flex items-center gap-2 self-start rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-white/90 backdrop-blur-sm">
            <TrendingUp className="h-3.5 w-3.5" />
            Live deal flow
          </div>
        </div>
      </section>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpiCards.map(({ label, value, hint, icon: Icon, iconWrap }) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3.5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                {label}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
                {value}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">{hint}</p>
            </div>
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconWrap}`}
            >
              <Icon className="h-5 w-5" />
            </div>
          </div>
        ))}
      </div>

      {/* Filters toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Per page
            </span>
            <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
              {[4, 8, 12, 16, 20].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setRowsPerPage(size)}
                  className={`min-w-9 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                    rowsPerPage === size
                      ? "bg-[#13538A] text-white"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div className="relative w-full max-w-[300px] self-end sm:self-auto">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              placeholder="Search borrower, app #, broker..."
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/15 dark:border-slate-700 dark:bg-slate-900"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map(({ value, label }) => {
            const count = value ? statusCounts[value] || 0 : countsTotal;
            const active = statusFilter === value;

            return (
              <button
                key={value || "all"}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "border-[#13538A] bg-[#13538A] text-white"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {label}
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${
                    active ? "bg-white/20" : "bg-white dark:bg-slate-900"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-[#13538A]/15 bg-white shadow-sm dark:border-[#13538A]/30 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-3 border-b border-[#13538A]/10 bg-[#13538A]/[0.04] px-5 py-3.5 dark:border-[#13538A]/20 dark:bg-[#13538A]/10 lg:px-6">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[#13538A] dark:text-[#9fd0f0]">
              Applications
            </h2>
            <p className="text-xs text-[#13538A]/70 dark:text-[#9fd0f0]/80">
              {loading
                ? "Loading pipeline…"
                : total === 0
                  ? "0 shown"
                  : `Showing ${showingFrom}–${showingTo} of ${total}`}
              {statusFilter
                ? ` · ${formatStatusLabel(statusFilter)}`
                : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("");
                }}
                className="text-xs font-semibold text-[#13538A] hover:underline dark:text-[#9fd0f0]"
              >
                Clear filters
              </button>
            ) : null}
            <span className="inline-flex items-center rounded-full bg-[#13538A] px-2.5 py-1 text-[11px] font-semibold text-white">
              {loading && rows.length === 0 ? "…" : total}
            </span>
          </div>
        </div>

        <div className="min-w-0 overflow-hidden">
          <table className="w-full table-fixed text-left">
            <colgroup>
              <col className="w-[18%]" />
              <col className="w-[11%]" />
              <col className="w-[9%]" />
              <col className="w-[13%]" />
              <col className="w-[11%]" />
              <col className="w-[10%]" />
              <col className="w-[18%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead className="sticky top-0 z-[1] bg-[#13538A] text-white">
              <tr>
                {[
                  "Borrower",
                  "Loan Type",
                  "Amount",
                  "Broker",
                  "Status",
                  "Created",
                  "Lenders",
                  "Actions",
                ].map((label) => (
                  <th
                    key={label}
                    className={`px-3 py-3 text-[11px] font-semibold uppercase tracking-wider first:pl-5 last:pr-5 lg:first:pl-6 lg:last:pr-6 ${
                      label === "Amount" || label === "Actions"
                        ? "text-right"
                        : "text-left"
                    }`}
                  >
                    <span className="block truncate">{label}</span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-[#13538A]/10 dark:divide-[#13538A]/20">
              {loading && rows.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: TABLE_COLUMNS }).map((__, cell) => (
                      <td key={cell} className="px-4 py-4">
                        <div className="h-8 animate-pulse rounded-lg bg-[#13538A]/10 dark:bg-[#13538A]/20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length > 0 ? (
                rows.map((row) => (
                  <tr
                    key={row.applicationId}
                    className="group cursor-pointer border-l-2 border-transparent transition hover:border-l-[#13538A] hover:bg-[#13538A]/[0.045] dark:hover:bg-[#13538A]/15"
                  >
                    <td
                      onClick={() => openRowPreview(row.applicationId)}
                      className="px-3 py-3.5 align-middle first:pl-5 lg:first:pl-6"
                      title={`${row.borrowerName} · ${row.applicationNumber}`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#13538A] text-[11px] font-semibold text-white shadow-sm">
                          {getInitials(row.borrowerName)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                            {row.borrowerName || "Untitled"}
                          </p>
                          <span className="mt-0.5 inline-flex max-w-full truncate rounded-md bg-[#13538A]/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-[#13538A] dark:bg-[#13538A]/20 dark:text-[#9fd0f0]">
                            {row.applicationNumber || "—"}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td
                      onClick={() => openRowPreview(row.applicationId)}
                      className="px-3 py-3.5 align-middle"
                      title={row.loanType}
                    >
                      <span className="inline-flex max-w-full truncate rounded-full bg-[#13538A]/10 px-2 py-0.5 text-xs font-medium text-[#13538A] dark:bg-[#13538A]/20 dark:text-[#9fd0f0]">
                        {formatLoanType(row.loanType)}
                      </span>
                    </td>

                    <td
                      onClick={() => openRowPreview(row.applicationId)}
                      className="px-3 py-3.5 align-middle text-right"
                    >
                      <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                        {formatCompactAmount(row.amount)}
                      </span>
                    </td>

                    <td
                      onClick={() => openRowPreview(row.applicationId)}
                      className="px-3 py-3.5 align-middle text-sm text-slate-600 dark:text-slate-300"
                      title={row.brokerName}
                    >
                      <span className="block truncate">
                        {row.brokerName || "Unknown broker"}
                      </span>
                    </td>

                    <td
                      onClick={() => openRowPreview(row.applicationId)}
                      className="px-3 py-3.5 align-middle"
                    >
                      <span
                        className={`inline-flex max-w-full items-center truncate rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${getApplicationStatusColor(row.applicationStatus)}`}
                        title={formatStatusLabel(row.applicationStatus)}
                      >
                        {formatStatusLabel(row.applicationStatus)}
                      </span>
                    </td>

                    <td
                      onClick={() => openRowPreview(row.applicationId)}
                      className="whitespace-nowrap px-3 py-3.5 align-middle text-sm text-slate-500 dark:text-slate-400"
                    >
                      {formatShortDate(row.createdAt)}
                    </td>

                    <td className="px-3 py-3.5 align-middle">
                      {row.lenders.length === 0 ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[#13538A]/25 px-2 py-0.5 text-[11px] text-[#13538A]/55">
                          <Building2 className="h-3 w-3" />
                          Not sent
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLenderModalQuery("");
                            setViewLenders(row.lenders);
                          }}
                          className="group/lender flex w-full max-w-[220px] items-start gap-2 rounded-xl border border-[#13538A]/15 bg-[#13538A]/[0.04] px-2.5 py-2 text-left transition hover:border-[#13538A]/35 hover:bg-white hover:shadow-sm dark:border-[#13538A]/30 dark:bg-[#13538A]/10 dark:hover:bg-slate-800"
                          title={
                            row.lenders.length === 1
                              ? row.lenders[0].lenderName
                              : `View ${row.lenders.length} lenders`
                          }
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#13538A] text-white shadow-sm">
                            <Building2 size={14} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                                {row.lenders[0].lenderName}
                              </p>
                              {row.lenders.length > 1 ? (
                                <span className="shrink-0 rounded-full bg-[#13538A] px-1.5 py-0.5 text-[9px] font-bold text-white">
                                  +{row.lenders.length - 1}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span
                                className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${getApplicationStatusColor(row.lenders[0].lenderStatus)}`}
                              >
                                {formatStatusLabel(row.lenders[0].lenderStatus)}
                              </span>
                              <span className="truncate text-[10px] text-slate-500">
                                {formatLoanType(row.lenders[0].lenderProduct)}
                              </span>
                            </div>
                          </div>
                        </button>
                      )}
                    </td>

                    <td
                      className="overflow-visible px-2 py-3.5 pr-5 text-right align-middle lg:pr-6"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex shrink-0 items-center justify-end gap-1.5">
                        <button
                          type="button"
                          title="View details"
                          onClick={(e) => {
                            e.stopPropagation();
                            openRowPreview(row.applicationId);
                          }}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#13538A] text-white shadow-sm transition hover:bg-[#0e3d66]"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          data-dropdown-trigger
                          data-id={row.applicationId}
                          title="More actions"
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect =
                              e.currentTarget.getBoundingClientRect();
                            setDropdownPos({
                              top: rect.bottom + 4,
                              left: rect.right - 192,
                            });
                            setActiveActionId(
                              activeActionId === row.applicationId
                                ? null
                                : row.applicationId,
                            );
                          }}
                          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white shadow-sm transition ${
                            activeActionId === row.applicationId
                              ? "bg-[#0e3d66]"
                              : "bg-[#13538A] hover:bg-[#0e3d66]"
                          }`}
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      </div>

                      {activeActionId === row.applicationId &&
                        createPortal(
                          <div
                            ref={dropdownRef}
                            style={{
                              position: "fixed",
                              top: dropdownPos.top,
                              left: dropdownPos.left,
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="z-[9999] w-48 overflow-hidden rounded-xl bg-[#13538A] shadow-xl"
                          >
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveActionId(null);
                                openRowPreview(row.applicationId);
                              }}
                              className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-white hover:bg-[#0e3d66]"
                            >
                              <Eye size={14} />
                              View Details
                            </button>
                          </div>,
                          document.body,
                        )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={TABLE_COLUMNS} className="px-6 py-16 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#13538A]/10 text-[#13538A] dark:bg-[#13538A]/20">
                        <SearchX className="h-6 w-6" />
                      </div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                        {hasActiveFilters
                          ? "No matching applications"
                          : "No loan applications yet"}
                      </h3>
                      <p className="mt-2 text-sm text-slate-500">
                        {hasActiveFilters
                          ? "Try a different search or clear your filters."
                          : "Applications will appear here once brokers submit them."}
                      </p>
                      {hasActiveFilters ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchTerm("");
                            setStatusFilter("");
                          }}
                          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#13538A] px-4 py-2 text-sm font-medium text-white hover:bg-[#0e3d66]"
                        >
                          Clear filters
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!loading && total > 0 ? (
          <div className="flex flex-col gap-3 border-t border-[#13538A]/10 bg-[#13538A]/[0.03] px-5 py-3.5 dark:border-[#13538A]/20 dark:bg-[#13538A]/10 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <p className="text-sm text-[#13538A]/80 dark:text-[#9fd0f0]/80">
              Showing{" "}
              <span className="font-semibold text-[#13538A] dark:text-[#9fd0f0]">
                {showingFrom}–{showingTo}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-[#13538A] dark:text-[#9fd0f0]">
                {total}
              </span>{" "}
              application{total === 1 ? "" : "s"}
            </p>

            {totalPages > 1 ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage === 1 || loading}
                  onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#13538A]/20 bg-white px-2.5 text-xs font-semibold text-[#13538A] transition hover:bg-[#13538A]/5 disabled:opacity-40 dark:border-[#13538A]/40 dark:bg-gray-950 dark:text-[#9fd0f0]"
                >
                  <ChevronLeft size={16} />
                  Prev
                </button>
                {getVisiblePageNumbers(currentPage, totalPages).map(
                  (page, index) =>
                    page === "ellipsis" ? (
                      <span
                        key={`ellipsis-${index}`}
                        className="px-1 text-sm text-slate-400"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={page}
                        type="button"
                        disabled={loading}
                        onClick={() => setCurrentPage(page)}
                        className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2.5 text-xs font-semibold transition ${
                          currentPage === page
                            ? "bg-[#13538A] text-white shadow-sm"
                            : "border border-[#13538A]/20 text-[#13538A] hover:bg-[#13538A]/5 dark:border-[#13538A]/40 dark:text-[#9fd0f0] dark:hover:bg-[#13538A]/15"
                        }`}
                      >
                        {page}
                      </button>
                    ),
                )}
                <button
                  type="button"
                  disabled={currentPage === totalPages || loading}
                  onClick={() =>
                    setCurrentPage((page) => Math.min(page + 1, totalPages))
                  }
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#13538A]/20 bg-white px-2.5 text-xs font-semibold text-[#13538A] transition hover:bg-[#13538A]/5 disabled:opacity-40 dark:border-[#13538A]/40 dark:bg-gray-950 dark:text-[#9fd0f0]"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Lenders modal */}
      {viewLenders &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm dark:bg-black/70">
            <div className="flex max-h-[min(85vh,640px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-[#0f172a]">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:px-5">
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                    Lenders
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {viewLenders.length} lender
                    {viewLenders.length === 1 ? "" : "s"} on this application
                    {lenderModalQuery.trim()
                      ? ` · ${filteredViewLenders.length} shown`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLenderModalQuery("");
                    setViewLenders(null);
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  aria-label="Close"
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>

              {viewLenders.length > 4 ? (
                <div className="shrink-0 border-b border-slate-100 px-4 py-2.5 dark:border-slate-800 sm:px-5">
                  <div className="relative">
                    <Search
                      size={14}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="search"
                      value={lenderModalQuery}
                      onChange={(e) => setLenderModalQuery(e.target.value)}
                      placeholder="Search lender, product, or status…"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-800 outline-none ring-[#13538A]/30 placeholder:text-slate-400 focus:border-[#13538A]/40 focus:bg-white focus:ring-2 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100"
                    />
                  </div>
                </div>
              ) : null}

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
                {viewLenders.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">
                    No lenders assigned.
                  </p>
                ) : filteredViewLenders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                    <SearchX size={22} className="text-slate-400" />
                    <p className="text-sm text-slate-500">
                      No lenders match “{lenderModalQuery.trim()}”.
                    </p>
                    <button
                      type="button"
                      onClick={() => setLenderModalQuery("")}
                      className="text-xs font-semibold text-[#13538A] hover:underline dark:text-blue-400"
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {filteredViewLenders.map((lender) => (
                      <div
                        key={lender.lenderOrgId}
                        className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#13538A]/10 text-[#13538A] dark:bg-[#13538A]/20 dark:text-[#5ba8d4]">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p
                              className="truncate font-semibold text-slate-900 dark:text-slate-100"
                              title={lender.lenderName}
                            >
                              {lender.lenderName || "Lender"}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-slate-500">
                              {formatLoanType(lender.lenderProduct)}
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${getApplicationStatusColor(lender.lenderStatus)}`}
                              >
                                {formatStatusLabel(lender.lenderStatus)}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                Sent {formatShortDate(lender.sentAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
