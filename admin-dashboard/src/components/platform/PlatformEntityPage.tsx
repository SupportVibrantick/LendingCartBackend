import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCcw,
  Search,
  Trash2,
} from "lucide-react";
import Swal from "sweetalert2";
import { adminFetch, type PaginatedResponse } from "../../lib/adminApi";

type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
};

type PlatformEntityPageProps<T extends { id: string }> = {
  title: string;
  description: string;
  apiPath: string;
  searchPlaceholder?: string;
  columns: Column<T>[];
  getStatusBadge?: (row: T) => React.ReactNode;
  statusField?: keyof T;
  activeValues?: unknown[];
};

function defaultStatusClass(value: unknown) {
  switch (String(value)) {
    case "ACTIVE":
    case "true":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300";
    case "DISABLED":
    case "false":
    case "INACTIVE":
    case "SUSPENDED":
      return "bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-300";
    default:
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }
}

export default function PlatformEntityPage<T extends { id: string }>({
  title,
  description,
  apiPath,
  searchPlaceholder = "Search...",
  columns,
  getStatusBadge,
  statusField,
  activeValues = ["ACTIVE", true],
}: PlatformEntityPageProps<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [rowLoadingId, setRowLoadingId] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
      });
      if (search.trim()) params.set("search", search.trim());

      const json = await adminFetch<PaginatedResponse<T[]>>(
        `${apiPath}?${params.toString()}`,
      );
      setRows(json.data || []);
      setTotalPages(json.meta?.totalPages || 1);
    } catch (err: any) {
      toast.error(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [apiPath, page, search]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const isActive = useCallback(
    (row: T) => {
      if (!statusField) return true;
      return activeValues.includes(row[statusField]);
    },
    [activeValues, statusField],
  );

  const toggleStatus = async (row: T) => {
    if (!statusField) return;
    const active = isActive(row);
    const nextStatus =
      typeof row[statusField] === "boolean"
        ? !active
        : active
          ? "DISABLED"
          : "ACTIVE";

    setRowLoadingId(row.id);
    try {
      await adminFetch(`${apiPath}/${row.id}/status`, {
        method: "PATCH",
        body: JSON.stringify(
          typeof row[statusField] === "boolean"
            ? { isActive: nextStatus }
            : { status: nextStatus },
        ),
      });
      toast.success(active ? "Suspended successfully" : "Activated successfully");
      fetchRows();
    } catch (err: any) {
      toast.error(err.message || "Status update failed");
    } finally {
      setRowLoadingId(null);
    }
  };

  const removeRow = async (row: T) => {
    const result = await Swal.fire({
      title: "Delete record?",
      text: "This action soft-deletes the record from the platform.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
    });

    if (!result.isConfirmed) return;

    setRowLoadingId(row.id);
    try {
      await adminFetch(`${apiPath}/${row.id}`, { method: "DELETE" });
      toast.success("Removed successfully");
      fetchRows();
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
    } finally {
      setRowLoadingId(null);
    }
  };

  const tableColumns = useMemo(() => columns, [columns]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          {title}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-xl border border-slate-200 py-2 pl-10 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
        <button
          type="button"
          onClick={fetchRows}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium dark:border-slate-700"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950">
              <tr>
                {tableColumns.map((col) => (
                  <th key={col.key} className="px-4 py-3 font-semibold">
                    {col.header}
                  </th>
                ))}
                {statusField && <th className="px-4 py-3 font-semibold">Status</th>}
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={tableColumns.length + (statusField ? 2 : 1)}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={tableColumns.length + (statusField ? 2 : 1)}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No records found
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-slate-100 dark:border-slate-800"
                  >
                    {tableColumns.map((col) => (
                      <td key={col.key} className="px-4 py-3 align-top">
                        {col.render(row)}
                      </td>
                    ))}
                    {statusField && (
                      <td className="px-4 py-3 align-top">
                        {getStatusBadge ? (
                          getStatusBadge(row)
                        ) : (
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${defaultStatusClass(row[statusField])}`}
                          >
                            {String(row[statusField])}
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-2">
                        {statusField && (
                          <button
                            type="button"
                            disabled={rowLoadingId === row.id}
                            onClick={() => toggleStatus(row)}
                            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium dark:border-slate-700"
                          >
                            {isActive(row) ? "Suspend" : "Activate"}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={rowLoadingId === row.id}
                          onClick={() => removeRow(row)}
                          className="rounded-lg border border-red-200 px-2 py-1 text-red-600 dark:border-red-500/30"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 dark:border-slate-800">
          <span className="text-xs text-slate-500">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border px-2 py-1 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border px-2 py-1 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
