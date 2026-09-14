import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import {
  Eye,
  Search,
  ChevronLeft,
  ChevronRight,
  Building2,
  MoreVertical,
  TrendingUp,
  RefreshCw,
  SearchX,
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

function formatCompactAmount(value: number) {
  if (!value || Number.isNaN(value)) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}K`;
  return `$${value.toLocaleString()}`;
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

function getApplicationStatusColor(status: string) {
  if (!status) return "bg-slate-100 text-slate-700 border-slate-200";

  const cleaned = status
    .replace(/^LENDER_/, "")
    .replace(/^AUTO_/, "");

  switch (cleaned) {
    case "APPROVED":
    case "FUNDED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";
    case "DECLINED":
    case "REJECTED":
      return "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20";
    case "IN_REVIEW":
      return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20";
    case "SUBMITTED":
    case "SELECTED":
    case "SENT":
      return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20";
    case "CLIENT_PENDING":
      return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20";
    case "DRAFT":
      return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    case "PENDING":
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
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
  const rowsPerPage = 8;

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
    [currentPage, debouncedSearch, statusFilter],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter]);

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

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px] space-y-6 text-slate-900 dark:text-slate-100">
      {/* Hero */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#2C92D5] p-6 text-white shadow-sm dark:border-slate-800 lg:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:gap-10">
          <div className="min-w-0 flex-1">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
              <TrendingUp className="h-3.5 w-3.5" />
              Platform Overview
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Loan Pipeline</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/80">
              {total} application{total === 1 ? "" : "s"}
              {statusFilter ? ` · ${formatStatusLabel(statusFilter)}` : ""}
              {debouncedSearch ? ` · “${debouncedSearch}”` : ""} ·{" "}
              {formatCompactAmount(totalVolume)} total volume
            </p>
          </div>

          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4 xl:w-[min(100%,520px)] xl:shrink-0">
            {[
              { label: "Total Apps", value: countsTotal },
              { label: "In Review", value: inReviewCount },
              { label: "Approved", value: approvedCount },
              { label: "Volume", value: formatCompactAmount(totalVolume) },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/20 backdrop-blur-sm"
              >
                <p className="text-xs text-white/70">{label}</p>
                <p className="mt-1 text-xl font-semibold">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1 lg:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              placeholder="Search borrower, application #, or broker..."
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-[#2C92D5] focus:ring-2 focus:ring-[#2C92D5]/20 dark:border-slate-700 dark:bg-slate-900"
            />
          </div>

          <button
            type="button"
            onClick={() => loadSubmissions()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {STATUS_FILTERS.map(({ value, label }) => {
            const count = value ? statusCounts[value] || 0 : countsTotal;
            const active = statusFilter === value;

            return (
              <button
                key={value || "all"}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "border-[#13538A] bg-[#13538A] text-white"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${
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
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800 lg:px-8">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Applications
            </h2>
            <p className="text-xs text-slate-500">
              {loading
                ? "Loading..."
                : total === 0
                  ? "0 shown"
                  : `Showing ${showingFrom}–${showingTo} of ${total}`}
            </p>
          </div>
        </div>

        <div className="min-w-0">
          <table className="w-full table-fixed text-left">
            <colgroup>
              <col className="w-[17%]" />
              <col className="w-[12%]" />
              <col className="w-[9%]" />
              <col className="w-[14%]" />
              <col className="w-[12%]" />
              <col className="w-[11%]" />
              <col className="w-[8%]" />
              <col className="w-[7%]" />
            </colgroup>
            <thead className="bg-slate-50/80 dark:bg-slate-800/50">
              <tr>
                {[
                  "Borrower",
                  "Loan Type",
                  "Amount",
                  "Broker",
                  "Status",
                  "Created",
                  "Lenders",
                  "",
                ].map((label) => (
                  <th
                    key={label || "actions"}
                    className="overflow-hidden px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 first:pl-6 last:pr-6 lg:first:pl-8 lg:last:pr-8"
                  >
                    <span className="block truncate">{label}</span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading && rows.length === 0 ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={TABLE_COLUMNS} className="px-6 py-4 lg:px-8">
                      <div className="h-10 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                    </td>
                  </tr>
                ))
              ) : rows.length > 0 ? (
                rows.map((row) => (
                  <tr
                    key={row.applicationId}
                    className="group transition hover:bg-[#13538A]/[0.03] dark:hover:bg-slate-800/50"
                  >
                    <td
                      onClick={() => openRowPreview(row.applicationId)}
                      className="cursor-pointer overflow-hidden px-3 py-3 align-middle first:pl-6 lg:first:pl-8"
                      title={`${row.borrowerName} · ${row.applicationNumber}`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#13538A]/10 text-xs font-semibold text-[#13538A]">
                          {getInitials(row.borrowerName)}
                        </div>
                        <div className="min-w-0">
                          <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">
                            {row.borrowerName}
                          </span>
                          <span className="block truncate text-[11px] text-slate-500">
                            {row.applicationNumber}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td
                      onClick={() => openRowPreview(row.applicationId)}
                      className="cursor-pointer overflow-hidden px-3 py-3 align-middle"
                      title={row.loanType}
                    >
                      <span className="inline-flex max-w-full truncate rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {formatLoanType(row.loanType)}
                      </span>
                    </td>

                    <td
                      onClick={() => openRowPreview(row.applicationId)}
                      className="cursor-pointer overflow-hidden px-3 py-3 align-middle font-mono text-sm text-slate-800 dark:text-slate-200"
                    >
                      <span className="block truncate">
                        {row.amount != null ? formatCompactAmount(row.amount) : "—"}
                      </span>
                    </td>

                    <td
                      onClick={() => openRowPreview(row.applicationId)}
                      className="cursor-pointer overflow-hidden px-3 py-3 align-middle text-sm text-slate-600 dark:text-slate-400"
                      title={row.brokerName}
                    >
                      <span className="block truncate">{row.brokerName}</span>
                    </td>

                    <td
                      onClick={() => openRowPreview(row.applicationId)}
                      className="cursor-pointer overflow-hidden px-3 py-3 align-middle"
                    >
                      <span
                        className={`inline-flex max-w-full items-center truncate rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getApplicationStatusColor(row.applicationStatus)}`}
                        title={formatStatusLabel(row.applicationStatus)}
                      >
                        {formatStatusLabel(row.applicationStatus)}
                      </span>
                    </td>

                    <td
                      onClick={() => openRowPreview(row.applicationId)}
                      className="cursor-pointer overflow-hidden px-3 py-3 align-middle text-sm text-slate-500"
                    >
                      <span className="block truncate">{formatShortDate(row.createdAt)}</span>
                    </td>

                    <td className="overflow-hidden px-3 py-3 align-middle text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewLenders(row.lenders);
                        }}
                        className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20"
                        title="View lenders"
                      >
                        <Building2 size={15} />
                        {row.lenders.length > 0 && (
                          <span className="absolute -right-1 -top-1 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] text-white">
                            {row.lenders.length}
                          </span>
                        )}
                      </button>
                    </td>

                    <td
                      className="overflow-hidden px-2 py-3 pr-6 text-right align-middle lg:pr-8"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        data-dropdown-trigger
                        data-id={row.applicationId}
                        title="More actions"
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
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
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <MoreVertical size={16} />
                      </button>

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
                            className="z-[9999] w-48 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
                          >
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveActionId(null);
                                openRowPreview(row.applicationId);
                              }}
                              className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[#13538A] hover:bg-slate-50 dark:hover:bg-slate-800"
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
                  <td colSpan={TABLE_COLUMNS} className="px-6 py-20 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
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
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between lg:px-8">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Showing{" "}
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {showingFrom}–{showingTo}
                </span>{" "}
                of{" "}
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {total}
                </span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1 || loading}
                  onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                  aria-label="Previous page"
                  className="rounded-lg border border-slate-200 p-2 transition hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <ChevronLeft size={16} />
                </button>
                {getVisiblePageNumbers(currentPage, totalPages).map((page, index) =>
                  page === "ellipsis" ? (
                    <span
                      key={`ellipsis-${index}`}
                      className="px-1 text-sm text-slate-400 dark:text-slate-500"
                      aria-hidden
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={page}
                      type="button"
                      disabled={loading}
                      onClick={() => setCurrentPage(page)}
                      aria-current={currentPage === page ? "page" : undefined}
                      className={`min-w-8 rounded-lg px-2.5 py-1.5 text-sm font-medium transition ${
                        currentPage === page
                          ? "bg-[#13538A] text-white dark:bg-indigo-600"
                          : "border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
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
                  aria-label="Next page"
                  className="rounded-lg border border-slate-200 p-2 transition hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lenders modal */}
      {viewLenders &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm dark:bg-black/70">
            <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#0f172a]">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Lenders</h2>
                <button
                  type="button"
                  onClick={() => setViewLenders(null)}
                  className="rounded-lg bg-red-50 px-3 py-1 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400"
                >
                  Close
                </button>
              </div>
              <div className="max-h-[400px] space-y-4 overflow-y-auto p-6">
                {viewLenders.length === 0 ? (
                  <p className="text-center text-sm text-slate-500">No lenders assigned.</p>
                ) : (
                  viewLenders.map((lender) => (
                    <div
                      key={lender.lenderOrgId}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                            {lender.lenderName}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {formatLoanType(lender.lenderProduct)}
                          </p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${getApplicationStatusColor(lender.lenderStatus)}`}
                          >
                            {formatStatusLabel(lender.lenderStatus)}
                          </span>
                          <p className="mt-1 text-xs text-slate-500">
                            {lender.sentAt
                              ? formatShortDate(lender.sentAt)
                              : "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
