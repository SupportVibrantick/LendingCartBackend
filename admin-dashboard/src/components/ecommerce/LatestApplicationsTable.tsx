import { Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "../../lib/adminApi";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

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

export default function LatestApplicationsTable() {
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
      case "LENDER_APPROVED":
        return "bg-emerald-100 text-emerald-700";
      case "LENDER_DECLINED":
        return "bg-rose-100 text-rose-700";
      case "IN_REVIEW":
        return "bg-indigo-100 text-indigo-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const formatProduct = (product?: string | null) =>
    (product || "—").replace(/_/g, " ");

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
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0F172A]">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Latest Applications
          </h3>
          <p className="text-sm text-slate-500">
            Recently submitted loan requests
            {debouncedSearch ? ` · “${debouncedSearch}”` : ""}
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search applications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400">
            <tr>
              <th className="px-6 py-3 font-medium">Application</th>
              <th className="px-6 py-3 font-medium">Broker</th>
              <th className="px-6 py-3 font-medium">Client</th>
              <th className="px-6 py-3 font-medium">Product</th>
              <th className="px-6 py-3 font-medium">Lenders</th>
              <th className="px-6 py-3 font-medium">Amount</th>
              <th className="px-6 py-3 font-medium">Date</th>
              <th className="px-6 py-3 font-medium">Status</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-6 py-14 text-center text-sm text-slate-500">
                  Loading applications...
                </td>
              </tr>
            ) : applications.length === 0 ? (
              <tr>
                <td colSpan={8}>
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
                  className="border-b border-slate-100 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/40"
                >
                  <td className="px-6 py-4 text-xs font-medium text-slate-900 dark:text-white">
                    {app.applicationNumber}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-300">
                    {app.brokerName || "—"}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-300">
                    {app.clientName || "—"}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-300">
                    {formatProduct(app.product)}
                  </td>
                  <td
                    className="px-6 py-4 text-xs text-slate-600 dark:text-slate-300"
                    title={
                      app.lenderNames?.length
                        ? app.lenderNames.join(", ")
                        : undefined
                    }
                  >
                    {formatLenders(app)}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-300">
                    {formatAmount(app.amount)}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {app.createdAt ? formatDate(app.createdAt) : "—"}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusStyle(
                        app.status || "",
                      )}`}
                    >
                      {formatProduct(app.status)}
                    </span>
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
                    ? "bg-indigo-600 text-white shadow-md dark:bg-indigo-500"
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
