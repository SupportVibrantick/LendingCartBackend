import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Info,
  Database,
  User,
  ShieldCheck,
  Calendar,
  X,
} from "lucide-react";

type BrokerLog = {
  id: string;
  category: string;
  action: string;
  entityType: string;
  entityId: string;
  performedBy:
  | string
  | {
      id?: string;
      email?: string;
      name?: string;
    }
  | null;
  ipAddress: string;
  createdAt: string;
  oldValue?: any;
  newValue?: any;
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

function getAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("broker_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
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

const AdminLogs: React.FC = () => {
  const [logs, setLogs] = useState<BrokerLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [serverTotal, setServerTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // State for inspecting JSON details
  const [selectedLog, setSelectedLog] = useState<BrokerLog | null>(null);

  async function fetchLogs(page: number, limit: number) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/broker/logs?page=${page}&limit=${limit}`,
        {
          headers: getAuthHeaders(),
        },
      );
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = await res.json();
      setLogs(json.data || []);
      setServerTotal(json.total ?? 0);
      setTotalPages(json.totalPages ?? 1);
      setCurrentPage(json.page ?? page);
    } catch (err: any) {
      setError(err?.message || "Failed to load logs");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize, query]);
  useEffect(() => {
    fetchLogs(currentPage, pageSize);
  }, [currentPage, pageSize]);

  const filtered = useMemo(() => {
    if (!query.trim()) return logs;
    const q = query.toLowerCase();
    return logs.filter((log) =>
      [log.action, log.category, log.entityType, log.entityId, log.ipAddress]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [logs, query]);

  const startItem = serverTotal === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, serverTotal);

  return (
    <div
      className="min-h-screen bg-slate-50 dark:bg-slate-950 
                p-4 md:p-8 font-sans 
                text-slate-900 dark:text-slate-100 
                transition-colors duration-300"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#2C92D5]">
              Activity Logs
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 text-sm">
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

        {/* Table Container */}
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
            <div className="py-20 text-center text-red-500 font-medium">
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
                    {filtered.map((log) => (
                      <tr
                        key={log.id}
                        className="hover:bg-slate-100 dark:hover:bg-slate-800 
               transition-colors group"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-slate-600">
                            <Calendar size={14} className="text-slate-400" />
                            <span className="text-sm font-medium dark:text-slate-200">
                              {formatDateTime(log.createdAt)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1.5">
                            <span
                              className={`inline-flex items-center w-fit px-2.5 py-0.5 rounded-full text-xs font-bold ${actionClass(log.action)}`}
                            >
                          {String(log.action).replace(/_/g, " ")}
                            </span>
                            <span className="text-xs text-slate-400 font-medium uppercase tracking-tight">
                              {String(log.category).replace(/_/g, " ")}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-ce
                          nter gap-3">
                            <div
                              className="p-2 
                bg-slate-100 dark:bg-slate-800
                rounded-lg 
                group-hover:bg-white dark:group-hover:bg-slate-700
                transition-colors"
                            >
                              <Database size={16} className="text-slate-500" />
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                {log.entityType}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                              <User size={14} className="text-slate-400" />
                            {typeof log.performedBy === "object"
  ? log.performedBy?.name ||
    log.performedBy?.email || 
    "System"
  : log.performedBy || "System"}
                            </div>
                            <div className="text-xs text-slate-400 ml-5">
                              {log.ipAddress}
                            </div>
                          </div>
                        </td>
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
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination - Only show if more than one page */}
              {serverTotal > pageSize && (
                <div
                  className="px-6 py-4 
               bg-slate-50 dark:bg-slate-900
               border-t border-slate-100 dark:border-slate-800
               flex items-center justify-between
               transition-colors duration-300"
                >
                  <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                    Showing{" "}
                    <span className="text-slate-900 dark:text-white font-semibold">
                      {startItem}
                    </span>{" "}
                    -{" "}
                    <span className="text-slate-900 dark:text-white font-semibold">
                      {endItem}
                    </span>{" "}
                    of{" "}
                    <span className="text-slate-900 dark:text-white font-semibold">
                      {serverTotal}
                    </span>
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((v) => v - 1)}
                      className="p-2 border border-slate-200 dark:border-slate-700
                   bg-white dark:bg-slate-800
                   rounded-lg disabled:opacity-40
                   hover:bg-slate-50 dark:hover:bg-slate-700
                   transition-colors shadow-sm"
                    >
                      <ChevronLeft size={18} />
                    </button>

                    <span
                      className="px-4 py-1.5 text-sm font-bold
                   bg-white dark:bg-slate-800
                   border border-slate-200 dark:border-slate-700
                   rounded-lg shadow-sm
                   text-blue-600 dark:text-blue-400"
                    >
                      {currentPage} / {totalPages}
                    </span>

                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((v) => v + 1)}
                      className="p-2 border border-slate-200 dark:border-slate-700
                   bg-white dark:bg-slate-800
                   rounded-lg disabled:opacity-40
                   hover:bg-slate-50 dark:hover:bg-slate-700
                   transition-colors shadow-sm"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* JSON Inspection Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-[9797979790] flex items-center justify-center p-4 
                  bg-black/50 dark:bg-black/70 backdrop-blur-sm
                  transition-colors duration-300"
        >
          <div
            className="bg-white dark:bg-slate-900
                    rounded-2xl w-full max-w-3xl
                    shadow-2xl
                    border border-slate-200 dark:border-slate-800
                    overflow-hidden
                    animate-in fade-in zoom-in duration-200
                    transition-colors"
          >
            {/* Header */}
            <div
              className="px-6 py-4 
                      border-b border-slate-100 dark:border-slate-800
                      bg-slate-50 dark:bg-slate-800
                      flex items-center justify-between
                      transition-colors"
            >
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                Change Details
              </h3>

              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 rounded-full
                     text-slate-500 dark:text-slate-400
                     hover:bg-slate-200 dark:hover:bg-slate-700
                     transition-colors hover:text-red-500 dark:hover:text-red-500"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div
              className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 
                      max-h-[70vh] overflow-y-auto"
            >
              {/* Old Value */}
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
                  {selectedLog.oldValue
                    ? JSON.stringify(selectedLog.oldValue, null, 2)
                    : "null"}
                </pre>
              </div>

              {/* New Value */}
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
                  {selectedLog.newValue
                    ? JSON.stringify(selectedLog.newValue, null, 2)
                    : "null"}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLogs;
