import { ArrowRight, FileText, Search, X } from "lucide-react";
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
        if (err && typeof err === "object" && "name" in err && (err as { name?: string }).name === "AbortError") {
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

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "APPROVED":
      case "LENDER_APPROVED":
      case "AUTO_APPROVED":
      case "FUNDED":
        return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20";
      case "DECLINED":
      case "LENDER_DECLINED":
      case "AUTO_DECLINED":
        return "bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/20";
      case "IN_REVIEW":
        return "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-500/20";
      case "CLIENT_PENDING":
        return "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20";
      case "SUBMITTED":
        return "bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20";
      default:
        return "bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700";
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
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0F172A]">
      <div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-r from-[#13538A]/5 via-white to-white px-6 py-5 dark:border-slate-800 dark:from-[#13538A]/20 dark:via-[#0F172A] dark:to-[#0F172A] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#13538A] text-white shadow-sm">
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Latest Applications
              </h3>
              {!loading && (
                <span className="rounded-full bg-[#13538A]/10 px-2.5 py-0.5 text-xs font-semibold text-[#13538A] dark:text-blue-300">
                  {total}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">
              Recently submitted loan requests
              {debouncedSearch ? ` · “${debouncedSearch}”` : ""}
            </p>
          </div>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search applications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm shadow-sm focus:border-[#13538A]/50 focus:outline-none focus:ring-4 focus:ring-[#13538A]/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] table-fixed text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
            <tr>
              <th className="w-[175px] px-5 py-3 text-[11px] font-semibold uppercase tracking-wide">Application</th>
              <th className="w-[150px] px-4 py-3 text-[11px] font-semibold uppercase tracking-wide">Broker</th>
              <th className="w-[140px] px-4 py-3 text-[11px] font-semibold uppercase tracking-wide">Client</th>
              <th className="w-[180px] px-4 py-3 text-[11px] font-semibold uppercase tracking-wide">Product</th>
              <th className="w-[115px] px-4 py-3 text-[11px] font-semibold uppercase tracking-wide">Lenders</th>
              <th className="w-[125px] px-4 py-3 text-[11px] font-semibold uppercase tracking-wide">Amount</th>
              <th className="w-[110px] px-4 py-3 text-[11px] font-semibold uppercase tracking-wide">Date</th>
              <th className="w-[125px] px-4 py-3 text-[11px] font-semibold uppercase tracking-wide">Status</th>
              <th className="w-[55px] px-3 py-3"><span className="sr-only">View</span></th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: ROWS_PER_PAGE }, (_, index) => (
                <tr key={index} className="border-b border-slate-100 dark:border-slate-800">
                  <td colSpan={9} className="px-5 py-4">
                    <div className="h-5 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />
                  </td>
                </tr>
              ))
            ) : applications.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <div className="flex flex-col items-center justify-center py-14 text-center">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
                      <Search className="h-6 w-6 text-white" />
                    </div>
                    <h4 className="text-base font-semibold text-slate-900 dark:text-white">
                      No Applications Found
                    </h4>
                    <p className="mt-1 max-w-sm text-sm text-slate-500">
                      We couldn't find any applications matching your search.
                      Try adjusting your filters.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              applications.map((app) => (
                <tr
                  key={app.id}
                  className="group border-b border-slate-100 transition last:border-b-0 hover:bg-[#13538A]/[0.035] dark:border-slate-800 dark:hover:bg-slate-900/60"
                >
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => openLoanPipelineDetail(navigate, app.id)}
                      className="whitespace-nowrap text-left text-xs font-semibold text-[#13538A] hover:underline dark:text-blue-400"
                    >
                      {app.applicationNumber || "—"}
                    </button>
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-600 dark:text-slate-300">
                    <p className="truncate" title={app.brokerName || undefined}>{app.brokerName || "—"}</p>
                  </td>
                  <td className="px-4 py-4 text-xs font-medium text-slate-700 dark:text-slate-200">
                    <p className="truncate" title={app.clientName || undefined}>{app.clientName || "—"}</p>
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-600 dark:text-slate-300">
                    <p className="truncate" title={formatProduct(app.product)}>{formatProduct(app.product)}</p>
                  </td>
                  <td
                    className="px-6 py-4 text-xs text-slate-600 dark:text-slate-300"
                    title={
                      app.lenderNames?.length
                        ? app.lenderNames.join(", ")
                        : undefined
                    }
                  >
                    <span className="inline-flex max-w-full truncate rounded-lg bg-slate-100 px-2 py-1 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {formatLenders(app)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-xs font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                    {formatAmount(app.amount)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500">
                    {app.createdAt ? formatDate(app.createdAt) : "—"}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${getStatusStyle(
                        app.status || "",
                      )}`}
                    >
                      {formatStatus(app.status)}
                    </span>
                  </td>
                  <td className="px-3 py-4">
                    <button
                      type="button"
                      onClick={() => openLoanPipelineDetail(navigate, app.id)}
                      aria-label={`View ${app.applicationNumber || "application"}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition group-hover:bg-[#13538A]/10 group-hover:text-[#13538A] dark:group-hover:text-blue-400"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="flex flex-col gap-4 border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-[#0F172A] sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Showing{" "}
            <span className="font-semibold text-slate-800 dark:text-white">
              {showingFrom}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-slate-800 dark:text-white">
              {showingTo}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-slate-800 dark:text-white">
              {total}
            </span>{" "}
            results
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1 || loading}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Prev
            </button>

            {visiblePages.map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                disabled={loading}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  currentPage === page
                    ? "bg-[#13538A] text-white shadow-md"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() =>
                setCurrentPage((p) => Math.min(p + 1, totalPages))
              }
              disabled={currentPage >= totalPages || loading}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
