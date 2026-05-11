// src/admin/Pages/AdminLogs.tsx
import {
  Calendar,
  Database,
  Info,
  Search,
  ShieldCheck,
  User,
} from "lucide-react";
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
  ipAddress: string;
  category: string;
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

function formatDateTime(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  return isNaN(d.getTime())
    ? "-"
    : d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function actionClass(action: string) {
  const upper = action?.toUpperCase() || "";
  if (upper.includes("DELETE"))
    return "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20";
  if (upper.includes("CREATE"))
    return "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20";
  if (upper.includes("UPDATE"))
    return "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20";
  return "bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-500/10";
}

const AdminLogs: React.FC = () => {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [selectedLog, setSelectedLog] = useState<AdminLog | null>(null);

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
    <div
      className="min-h-screen bg-slate-50 dark:bg-slate-950 
                p-4 md:p-8 font-sans 
                text-slate-900 dark:text-slate-100 
                transition-colors duration-300"
    >
      <div className="max-w-7xl mx-auto">
        {/* Heading */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#13538A] dark:text-indigo-600">
              Activity Logs
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
              <ShieldCheck size={16} />
              Audit trail for all broker-level system events
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
                size={18}
              />
              <input
                placeholder="Search events..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10 pr-4 py-2 
           bg-white dark:bg-slate-900
           border border-slate-200 dark:border-slate-700
           text-slate-900 dark:text-slate-100
           rounded-lg shadow-sm
           focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
           outline-none w-full md:w-80 transition-all"
              />
            </div>
            <select
              value={pageSize}
              onChange={(e) => {
                setCurrentPage(1); // reset immediately
                setPageSize(Number(e.target.value));
              }}
              className="bg-white dark:bg-slate-900
           border border-slate-200 dark:border-slate-700
           text-slate-900 dark:text-slate-100
           rounded-lg px-3 py-2 text-sm shadow-sm
           outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
        </div>

        {/* Table card */}
        <div
          className="bg-white dark:bg-slate-900
                rounded-2xl
                border border-slate-200 dark:border-slate-800
                shadow-xl shadow-slate-200/50 dark:shadow-none
                overflow-hidden transition-colors duration-300"
        >
          {loading ? (
            <div className="py-32 flex flex-col items-center justify-center text-slate-400 space-y-4">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="font-medium">Fetching logs...</p>
            </div>
          ) : error ? (
            <div className="py-16 text-center text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-24 flex flex-col items-center justify-center text-center">
              {/* Icon */}
              <div
                className="w-16 h-16 flex items-center justify-center 
                    rounded-full
                    bg-blue-100 dark:bg-blue-900/30
                    text-blue-600 dark:text-blue-400
                    mb-4"
              >
                <Database size={28} />
              </div>

              {/* Title */}
              <h3
                className="text-lg font-semibold 
                   text-slate-800 dark:text-white"
              >
                No Activity Logs Found
              </h3>

              {/* Description */}
              <p
                className="mt-2 text-sm 
                  text-slate-500 dark:text-slate-400
                  max-w-md"
              >
                {query
                  ? "No logs match your current search criteria."
                  : "There are no audit records available at the moment."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr
                      className="bg-slate-50 dark:bg-slate-800 
               border-b border-slate-100 dark:border-slate-800"
                    >
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Timestamp
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Event
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Entity
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        User / IP
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">
                        Data
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filtered.map((log) => {
                      const actorName =
                        `${log.actorUser?.firstName || ""} ${log.actorUser?.lastName || ""}`.trim();

                      return (
                        <tr
                          key={log.id}
                          className="border-b dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50"
                        >
                          {/* Timestamp */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2 text-slate-600">
                              <Calendar size={14} className="text-slate-400" />
                              <span className="text-sm font-medium dark:text-slate-200">
                                {formatDateTime(log.createdAt)}
                              </span>
                            </div>
                          </td>

                          {/* Event */}
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1.5">
                              <span
                                className={`inline-flex items-center w-fit px-2.5 py-0.5 rounded-full text-xs font-bold ${actionClass(log.action)}`}
                              >
                                {log.action}
                              </span>
                              <span className="text-xs text-slate-400 font-medium uppercase tracking-tight">
                                {log.category}
                              </span>
                            </div>
                          </td>

                          {/* Entity */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div
                                className="p-2 
                bg-slate-100 dark:bg-slate-800
                rounded-lg 
                group-hover:bg-white dark:group-hover:bg-slate-700
                transition-colors"
                              >
                                <Database
                                  size={16}
                                  className="text-slate-500"
                                />
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                  {log.entityType}
                                </div>
                                {/* <div className="text-xs text-slate-400 font-mono tracking-tighter">{log.entityId.slice(0, 12)}...</div> */}
                              </div>
                            </div>
                          </td>

                          {/* User */}
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                                <User size={14} className="text-slate-400" />
                                {actorName || "System"}
                              </span>
                              <span className="text-xs text-slate-400 ml-5">
                                {log.ipAddress}
                              </span>
                            </div>
                          </td>

                          {/* Data Button */}
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => setSelectedLog(log)}
                              className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-semibold text-sm transition-colors"
                            >
                              <Info size={16} />
                              Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {selectedLog && (
                <div
                  className="fixed inset-0 z-[9797979790] flex items-center justify-center p-4 
      bg-black/50 dark:bg-black/70 backdrop-blur-sm"
                >
                  <div
                    className="bg-white dark:bg-slate-900
      rounded-2xl w-full max-w-3xl
      shadow-2xl
      border border-slate-200 dark:border-slate-800
      overflow-hidden"
                  >
                    {/* Header */}
                    <div
                      className="px-6 py-4 
        border-b border-slate-100 dark:border-slate-800
        bg-slate-50 dark:bg-slate-800
        flex items-center justify-between"
                    >
                      <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                        Change Details
                      </h3>

                      <button
                        onClick={() => setSelectedLog(null)}
                        className="p-2 rounded-full
            text-slate-500 dark:text-slate-400
            hover:bg-slate-200 dark:hover:bg-slate-700
            transition-colors hover:text-red-500"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Body */}
                    <div
                      className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 
        max-h-[70vh] overflow-y-auto"
                    >
                      <div>
                        <label
                          className="block text-xs font-bold uppercase 
            text-slate-400 dark:text-slate-500 mb-2"
                        >
                          Old Value
                        </label>

                        <pre
                          className="p-4 
            bg-slate-900 dark:bg-slate-950
            text-slate-300
            rounded-xl text-xs 
            overflow-x-auto
            border border-slate-800"
                        >
                          {selectedLog.oldValueJson
                            ? JSON.stringify(
                                JSON.parse(selectedLog.oldValueJson),
                                null,
                                2,
                              )
                            : "null"}
                        </pre>
                      </div>

                      <div>
                        <label
                          className="block text-xs font-bold uppercase 
            text-slate-400 dark:text-slate-500 mb-2"
                        >
                          New Value
                        </label>

                        <pre
                          className="p-4 
            bg-blue-50 dark:bg-blue-950/40
            text-blue-900 dark:text-blue-300
            rounded-xl text-xs 
            overflow-x-auto
            border border-blue-200 dark:border-blue-900"
                        >
                          {selectedLog.newValueJson
                            ? JSON.stringify(
                                JSON.parse(selectedLog.newValueJson),
                                null,
                                2,
                              )
                            : "null"}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* pagination footer (same style as others) */}
              <div
                className="mt-6 px-6 py-4 
  bg-slate-50 dark:bg-slate-900
  border-t border-slate-200 dark:border-slate-800
  flex flex-col sm:flex-row items-center justify-between gap-4
  rounded-b-2xl transition-colors duration-300"
              >
                {/* Left Info */}
                <div className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                  Showing{" "}
                  <span className="text-slate-900 dark:text-white font-semibold">
                    {filtered.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
                  </span>{" "}
                  –{" "}
                  <span className="text-slate-900 dark:text-white font-semibold">
                    {Math.min(currentPage * pageSize, totalOverall)}
                  </span>{" "}
                  of{" "}
                  <span className="text-slate-900 dark:text-white font-semibold">
                    {totalOverall}
                  </span>{" "}
                  results
                </div>

                {/* Right Controls */}
                <div className="flex items-center gap-2">
                  {/* Prev Button */}
                  <button
                    onClick={() => gotoPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-2 rounded-lg text-sm font-medium
        bg-white dark:bg-slate-800
        border border-slate-200 dark:border-slate-700
        text-slate-700 dark:text-slate-200
        disabled:opacity-40 disabled:cursor-not-allowed
        hover:bg-slate-100 dark:hover:bg-slate-700
        transition-colors shadow-sm"
                  >
                    Prev
                  </button>

                  {/* Page Numbers */}
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
                            className={`min-w-[36px] h-9 rounded-lg text-sm font-semibold transition-all
              ${
                page === currentPage
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
                  : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
                          >
                            {page}
                          </button>
                        );
                      },
                    )}
                  </div>

                  {/* Next Button */}
                  <button
                    onClick={() => gotoPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 rounded-lg text-sm font-medium
        bg-white dark:bg-slate-800
        border border-slate-200 dark:border-slate-700
        text-slate-700 dark:text-slate-200
        disabled:opacity-40 disabled:cursor-not-allowed
        hover:bg-slate-100 dark:hover:bg-slate-700
        transition-colors shadow-sm"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminLogs;
