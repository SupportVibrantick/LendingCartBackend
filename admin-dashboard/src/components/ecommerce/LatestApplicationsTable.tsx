import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Search,
  SearchX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { adminFetch } from "../../lib/adminApi";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { openLoanPipelineDetail } from "../../lib/loanPipelineNavigation";

type LatestApplication = {
  id: string;
  applicationNumber?: string;
  brokerName?: string | null;
  clientName?: string | null;
  product?: string | null;
  status?: string;
  amount?: number | string | null;
  createdAt?: string;
  lenderCount?: number;
  lenderNames?: string[];
};

type LatestApplicationsResponse = {
  success: boolean;
  data: LatestApplication[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

const ROWS_PER_PAGE = 5;
const TABLE_COLUMNS = 8;

const PRODUCT_LABELS: Record<string, string> = {
  FIX_AND_FLIP_LOAN_1_TO_4_UNITS: "Fix & Flip (1–4 Units)",
  FIX_AND_FLIP: "Fix & Flip",
  DSCR_LOAN_1_TO_4_UNITS: "DSCR (1–4 Units)",
  DSCR_LOAN: "DSCR",
  CONSTRUCTION_LOAN_1_TO_4_UNITS: "Construction (1–4 Units)",
  CONSTRUCTION_LOAN: "Construction",
  BRIDGE_LOAN_1_TO_4_UNITS: "Bridge (1–4 Units)",
  BRIDGE_LOAN: "Bridge",
  EQUIPMENT_FINANCE: "Equipment Finance",
  SBA_EXPRESS: "SBA Express",
};

function getInitials(name?: string | null) {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function LatestApplicationsTable() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<LatestApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 350);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const loadApplications = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: String(currentPage),
          limit: String(ROWS_PER_PAGE),
        });
        if (debouncedSearch) params.set("search", debouncedSearch);

        const json = await adminFetch<LatestApplicationsResponse>(
          `/admin/stats/latest-applications?${params.toString()}`,
          { signal },
        );

        setApplications(Array.isArray(json.data) ? json.data : []);
        setTotal(Number(json.pagination?.total ?? 0));
        setTotalPages(Math.max(1, Number(json.pagination?.totalPages) || 1));
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (
          err &&
          typeof err === "object" &&
          "name" in err &&
          (err as { name?: string }).name === "AbortError"
        ) {
          return;
        }
        console.error(err);
        setApplications([]);
        setTotal(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    },
    [currentPage, debouncedSearch],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    const controller = new AbortController();
    loadApplications(controller.signal);
    return () => controller.abort();
  }, [loadApplications]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const showingFrom = total === 0 ? 0 : (currentPage - 1) * ROWS_PER_PAGE + 1;
  const showingTo = Math.min(currentPage * ROWS_PER_PAGE, total);
  const hasSearch = Boolean(debouncedSearch);

  const getStatusStyle = (status?: string) => {
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
  };

  const formatDate = (date: string) => {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return "—";
    return parsed.toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatProduct = (product?: string | null) => {
    if (!product) return "—";
    if (PRODUCT_LABELS[product]) return PRODUCT_LABELS[product];
    return product
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (character) => character.toUpperCase());
  };

  const formatStatus = (status?: string | null) => {
    if (!status) return "Unknown";
    return status
      .replace(/^LENDER_/, "")
      .replace(/^AUTO_/, "")
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (character) => character.toUpperCase());
  };

  const formatAmount = (amount?: number | string | null) => {
    if (amount == null || amount === "") return "—";
    const value = Number(amount);
    if (Number.isNaN(value) || value <= 0) return "—";
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatLenders = (app: LatestApplication) => {
    const count = app.lenderCount ?? 0;
    const names = app.lenderNames;

    if (count > 0 && names?.length) {
      return names.length === 1 ? names[0] : `${count} lenders`;
    }

    return count > 0 ? String(count) : "—";
  };

  const visiblePages = (() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
    return Array.from({ length: 5 }, (_, i) => start + i);
  })();

  return (
    <div className="overflow-hidden rounded-2xl border border-[#13538A]/15 bg-white shadow-sm dark:border-[#13538A]/30 dark:bg-gray-900">
      <div className="flex flex-col gap-3 border-b border-[#13538A]/10 bg-[#13538A]/[0.04] px-5 py-3.5 dark:border-[#13538A]/20 dark:bg-[#13538A]/10 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#13538A] text-white shadow-sm">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-[#13538A] dark:text-[#9fd0f0]">
                Latest Applications
              </h3>
              <span className="inline-flex items-center rounded-full bg-[#13538A] px-2.5 py-1 text-[11px] font-semibold text-white">
                {loading && applications.length === 0 ? "…" : total}
              </span>
            </div>
            <p className="text-xs text-[#13538A]/70 dark:text-[#9fd0f0]/80">
              {loading
                ? "Loading recent applications…"
                : hasSearch
                  ? `${total} matching “${debouncedSearch}”`
                  : "Recently submitted loan requests"}
            </p>
          </div>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#13538A]/50" />
          <input
            type="text"
            placeholder="Search applications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-[#13538A]/20 bg-white py-2 pl-9 pr-9 text-sm outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/15 dark:border-[#13538A]/40 dark:bg-gray-950 dark:text-white"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-[#13538A]/10 hover:text-[#13538A]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-w-0 overflow-hidden">
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[20%]" />
            <col className="w-[13%]" />
            <col className="w-[14%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
            <col className="w-[11%]" />
            <col className="w-[12%]" />
            <col className="w-[8%]" />
          </colgroup>
          <thead className="sticky top-0 z-[1] bg-[#13538A] text-white">
            <tr>
              {[
                "Client",
                "Broker",
                "Product",
                "Lenders",
                "Amount",
                "Date",
                "Status",
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
            {loading && applications.length === 0 ? (
              Array.from({ length: ROWS_PER_PAGE }).map((_, index) => (
                <tr key={index}>
                  {Array.from({ length: TABLE_COLUMNS }).map((__, cell) => (
                    <td key={cell} className="px-4 py-4">
                      <div className="h-8 animate-pulse rounded-lg bg-[#13538A]/10 dark:bg-[#13538A]/20" />
                    </td>
                  ))}
                </tr>
              ))
            ) : applications.length === 0 ? (
              <tr>
                <td colSpan={TABLE_COLUMNS} className="px-6 py-16 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#13538A]/10 text-[#13538A] dark:bg-[#13538A]/20">
                      <SearchX className="h-6 w-6" />
                    </div>
                    <h4 className="text-base font-semibold text-slate-900 dark:text-white">
                      {hasSearch
                        ? "No matching applications"
                        : "No applications yet"}
                    </h4>
                    <p className="mt-2 text-sm text-slate-500">
                      {hasSearch
                        ? "Try a different search term."
                        : "Recent loan requests will show up here."}
                    </p>
                    {hasSearch ? (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#13538A] px-4 py-2 text-sm font-medium text-white hover:bg-[#0e3d66]"
                      >
                        Clear search
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigate("/loan-pipeline")}
                        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#13538A] px-4 py-2 text-sm font-medium text-white hover:bg-[#0e3d66]"
                      >
                        Open pipeline
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              applications.map((app) => (
                <tr
                  key={app.id}
                  className="group cursor-pointer border-l-2 border-transparent transition hover:border-l-[#13538A] hover:bg-[#13538A]/[0.045] dark:hover:bg-[#13538A]/15"
                  onClick={() => openLoanPipelineDetail(navigate, app.id)}
                >
                  <td
                    className="px-3 py-3.5 align-middle first:pl-5 lg:first:pl-6"
                    title={`${app.clientName || "—"} · ${app.applicationNumber || ""}`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#13538A] text-[11px] font-semibold text-white shadow-sm">
                        {getInitials(app.clientName)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                          {app.clientName || "Untitled"}
                        </p>
                        <span className="mt-0.5 inline-flex max-w-full truncate rounded-md bg-[#13538A]/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-[#13538A] dark:bg-[#13538A]/20 dark:text-[#9fd0f0]">
                          {app.applicationNumber || "—"}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td
                    className="px-3 py-3.5 align-middle text-sm text-slate-600 dark:text-slate-300"
                    title={app.brokerName || undefined}
                  >
                    <span className="block truncate">
                      {app.brokerName || "—"}
                    </span>
                  </td>

                  <td
                    className="px-3 py-3.5 align-middle"
                    title={formatProduct(app.product)}
                  >
                    <span className="inline-flex max-w-full truncate rounded-full bg-[#13538A]/10 px-2 py-0.5 text-xs font-medium text-[#13538A] dark:bg-[#13538A]/20 dark:text-[#9fd0f0]">
                      {formatProduct(app.product)}
                    </span>
                  </td>

                  <td
                    className="px-3 py-3.5 align-middle"
                    title={
                      app.lenderNames?.length
                        ? app.lenderNames.join(", ")
                        : undefined
                    }
                  >
                    <span className="inline-flex max-w-full truncate rounded-md bg-[#13538A]/[0.07] px-2 py-0.5 text-xs font-medium text-[#0e3d66] dark:bg-[#13538A]/15 dark:text-[#c5e4f6]">
                      {formatLenders(app)}
                    </span>
                  </td>

                  <td className="px-3 py-3.5 align-middle text-right">
                    <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                      {formatAmount(app.amount)}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-3 py-3.5 align-middle text-sm text-slate-500 dark:text-slate-400">
                    {app.createdAt ? formatDate(app.createdAt) : "—"}
                  </td>

                  <td className="px-3 py-3.5 align-middle">
                    <span
                      className={`inline-flex max-w-full items-center truncate rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${getStatusStyle(
                        app.status || "",
                      )}`}
                    >
                      {formatStatus(app.status)}
                    </span>
                  </td>

                  <td
                    className="overflow-visible px-2 py-3.5 pr-5 text-right align-middle lg:pr-6"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      title="View details"
                      aria-label={`View ${app.applicationNumber || "application"}`}
                      onClick={() => openLoanPipelineDetail(navigate, app.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#13538A] text-white shadow-sm transition hover:bg-[#0e3d66]"
                    >
                      <Eye size={15} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 0 ? (
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
            results
          </p>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1 || loading}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#13538A]/20 bg-white px-2.5 text-xs font-semibold text-[#13538A] transition hover:bg-[#13538A]/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#13538A]/40 dark:bg-gray-950 dark:text-[#9fd0f0]"
            >
              <ChevronLeft size={16} />
              Prev
            </button>

            {visiblePages.map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                disabled={loading}
                className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2.5 text-xs font-semibold transition ${
                  currentPage === page
                    ? "bg-[#13538A] text-white shadow-sm"
                    : "border border-[#13538A]/20 text-[#13538A] hover:bg-[#13538A]/5 dark:border-[#13538A]/40 dark:text-[#9fd0f0] dark:hover:bg-[#13538A]/15"
                }`}
              >
                {page}
              </button>
            ))}

            <button
              type="button"
              onClick={() =>
                setCurrentPage((p) => Math.min(p + 1, totalPages))
              }
              disabled={currentPage >= totalPages || loading}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#13538A]/20 bg-white px-2.5 text-xs font-semibold text-[#13538A] transition hover:bg-[#13538A]/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#13538A]/40 dark:bg-gray-950 dark:text-[#9fd0f0]"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
