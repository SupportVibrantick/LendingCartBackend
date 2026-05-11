// src/admin/Pages/AdminLogs.tsx
import React, { useEffect, useMemo, useState } from "react";

type ActorUser = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
};

type ActorOrg = {
  id: string;
  name: string;
};

type AdminLog = {
  id: string;
  actorUserId: string;
  actorOrgId: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValueJson?: string | null;
  newValueJson?: string | null;
  createdAt?: string;
  actorUser?: ActorUser | null;
  actorOrg?: ActorOrg | null;
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

function getAuthHeaders(): Record<string, string> {
  try {
    const token = sessionStorage.getItem("admin_token");
    if (token) {
      return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };
    }
  } catch {
    /* ignore */
  }
  return { "Content-Type": "application/json" };
}

// tiny helper for action pill
function actionClass(action: string) {
  const upper = (action || "").toUpperCase();
  if (upper.includes("ACTIVATED")) {
    return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/40";
  }
  if (upper.includes("DEACTIVATED")) {
    return "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/40";
  }
  return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-slate-600/30 dark:text-slate-100 dark:border-slate-500";
}

function safePretty(jsonStr?: string | null): string {
  if (!jsonStr) return "-";
  try {
    const obj = JSON.parse(jsonStr);
    if (!obj || typeof obj !== "object") return jsonStr;
    return Object.entries(obj)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(", ");
  } catch {
    return jsonStr;
  }
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

const AdminLogs: React.FC = () => {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [serverTotal, setServerTotal] = useState<number | null>(null);

  // fetch logs with backend pagination (page + limit)
  async function fetchLogs(page: number, limit: number) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/admin/logs/?page=${page}&limit=${limit}`,
        {
          method: "GET",
          headers: getAuthHeaders(),
        },
      );

      if (!res.ok) {
        throw new Error(`Failed to fetch logs: ${res.status}`);
      }

      const json = await res.json();
      const list: AdminLog[] = json.data || json.logs || [];
      setLogs(list);
      if (typeof json.total === "number") {
        setServerTotal(json.total);
      } else {
        setServerTotal(list.length);
      }
    } catch (err: any) {
      console.error("fetchLogs error:", err);
      setError(err?.message || "Failed to load logs");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs(currentPage, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  // local search on current page logs
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((log) => {
      const actorName = `${log.actorUser?.firstName || ""} ${
        log.actorUser?.lastName || ""
      }`.trim();
      return (
        log.action.toLowerCase().includes(q) ||
        log.entityType.toLowerCase().includes(q) ||
        (log.actorUser?.email || "").toLowerCase().includes(q) ||
        actorName.toLowerCase().includes(q) ||
        (log.actorOrg?.name || "").toLowerCase().includes(q) ||
        (log.oldValueJson || "").toLowerCase().includes(q) ||
        (log.newValueJson || "").toLowerCase().includes(q)
      );
    });
  }, [logs, query]);

  const totalOnPage = filtered.length;
  const totalOverall = serverTotal ?? totalOnPage;
  const totalPagesFromServer =
    serverTotal != null ? Math.max(1, Math.ceil(serverTotal / pageSize)) : 1;
  const totalPages = totalPagesFromServer;

  function gotoPage(page: number) {
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="px-6 py-6 text-gray-900 dark:text-gray-100">
      {/* Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Admin Activity Logs
          </h1>
          <p className="text-sm text-gray-500 mt-1 dark:text-slate-400">
            View audit logs for admin actions across brokers and lenders.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              placeholder="Search by action, user, org, entity..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="px-3 py-2 border rounded-md w-72 focus:outline-none focus:ring-1 focus:ring-blue-500
                         border-gray-300 bg-white text-gray-900
                         dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100
                         placeholder-gray-400 dark:placeholder-slate-400"
              aria-label="Search logs"
            />
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2 py-2 border rounded-md bg-white text-gray-900
                         border-gray-300
                         dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
              aria-label="Page size"
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-700">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-500 dark:text-slate-400">
            Loading logs...
          </div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500 dark:text-slate-400">
            No logs found.
          </div>
        ) : (
          <>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide dark:border-slate-700 dark:text-slate-400">
                    <th className="py-2 pr-4 text-left">Time</th>
                    <th className="py-2 pr-4 text-left">Action</th>
                    <th className="py-2 pr-4 text-left">Entity</th>
                    <th className="py-2 pr-4 text-left">Old Value</th>
                    <th className="py-2 pr-4 text-left">New Value</th>
                    <th className="py-2 pr-4 text-left">Actor</th>
                    <th className="py-2 pr-4 text-left">Actor Org</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((log) => {
                    const actorName = `${log.actorUser?.firstName || ""} ${
                      log.actorUser?.lastName || ""
                    }`.trim();
                    return (
                      <tr
                        key={log.id}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50/40 dark:border-slate-800 dark:hover:bg-slate-800/60"
                      >
                        <td className="py-3 pr-4 text-gray-600 whitespace-nowrap dark:text-slate-300">
                          {formatDateTime(log.createdAt)}
                        </td>

                        <td className="py-3 pr-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-medium ${actionClass(
                              log.action,
                            )}`}
                          >
                            {log.action}
                          </span>
                        </td>

                        <td className="py-3 pr-4 text-gray-600 whitespace-nowrap dark:text-slate-300">
                          <div className="flex flex-col text-xs">
                            <span className="font-medium text-gray-800 dark:text-slate-100">
                              {log.entityType}
                            </span>
                            <span className="text-[11px] text-gray-500 dark:text-slate-400 truncate max-w-xs">
                              {log.entityId}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 pr-4 text-gray-600 align-top text-xs max-w-xs break-words dark:text-slate-300">
                          {safePretty(log.oldValueJson)}
                        </td>

                        <td className="py-3 pr-4 text-gray-600 align-top text-xs max-w-xs break-words dark:text-slate-300">
                          {safePretty(log.newValueJson)}
                        </td>

                        <td className="py-3 pr-4 text-gray-600 text-xs dark:text-slate-300">
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-800 dark:text-slate-100">
                              {actorName || "Admin User"}
                            </span>
                            <span className="text-[11px] text-gray-500 dark:text-slate-400">
                              {log.actorUser?.email || "-"}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 pr-4 text-gray-600 text-xs dark:text-slate-300">
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-800 dark:text-slate-100">
                              {log.actorOrg?.name || "-"}
                            </span>
                            <span className="text-[11px] text-gray-500 dark:text-slate-400">
                              {log.actorOrg?.id || ""}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* pagination footer (same style as others) */}
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-sm text-gray-600 dark:text-slate-300">
                Showing{" "}
                <span className="font-medium">
                  {filtered.length > 0 ? 1 : 0}
                </span>{" "}
                - <span className="font-medium">{filtered.length}</span> of{" "}
                <span className="font-medium">{totalOverall}</span> logs (page{" "}
                {currentPage} of {totalPages})
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => gotoPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border rounded-md disabled:opacity-40
                             border-gray-300 bg-white text-gray-800
                             dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  Prev
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }).map(
                    (_, i) => {
                      const half = Math.floor(5 / 2);
                      let start = 1;
                      if (totalPages <= 5) start = 1;
                      else if (currentPage <= half + 1) start = 1;
                      else if (currentPage >= totalPages - half)
                        start = totalPages - 4;
                      else start = currentPage - half;

                      const page = start + i;
                      if (page > totalPages) return null;
                      return (
                        <button
                          key={page}
                          onClick={() => gotoPage(page)}
                          className={`px-3 py-1 rounded-md ${
                            page === currentPage
                              ? "bg-blue-600 text-white"
                              : "border border-gray-300 bg-white text-gray-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          }`}
                        >
                          {page}
                        </button>
                      );
                    },
                  )}
                </div>

                <button
                  onClick={() => gotoPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border rounded-md disabled:opacity-40
                             border-gray-300 bg-white text-gray-800
                             dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminLogs;
