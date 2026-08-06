import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router";
import {
  Activity,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Database,
  Eye,
  RefreshCw,
  Search,
  Shield,
  User,
  X,
} from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import { getBrokerAuthHeaders } from "../../lib/brokerApi";

type BrokerLog = {
  id: string;
  category: string;
  action: string;
  entityType: string;
  entityId: string;
  performedBy:
    | string
    | { id?: string; email?: string; name?: string; roles?: string[] }
    | null;
  ipAddress: string;
  createdAt: string;
  oldValue?: unknown;
  newValue?: unknown;
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

const CATEGORY_STYLES: Record<string, string> = {
  APPLICATION: "bg-indigo-50 text-indigo-700 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300",
  SYSTEM: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300",
  USER_MANAGEMENT: "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300",
  SECURITY: "bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-500/10 dark:text-rose-300",
  REVIEW: "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300",
};

const AVATAR_TONES = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
];

function getAuthHeaders(): Record<string, string> {
  return getBrokerAuthHeaders(true);
}

function getInitials(name?: string) {
  if (!name) return "SY";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function getAvatarTone(seed?: string) {
  if (!seed) return AVATAR_TONES[0];
  const index = seed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_TONES[index % AVATAR_TONES.length];
}

function formatDateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelativeTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDateTime(value);
}

function actionClass(action: string) {
  const upper = action?.toUpperCase() || "";
  if (upper.includes("DELETE") || upper.includes("REMOVE"))
    return "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300";
  if (upper.includes("CREATE") || upper.includes("ADD"))
    return "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300";
  if (upper.includes("UPDATE") || upper.includes("EDIT"))
    return "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300";
  if (upper.includes("ASSIGN"))
    return "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300";
  if (upper.includes("MESSAGE") || upper.includes("SENT"))
    return "bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300";
  return "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300";
}

function isLoanOfficerPerformer(log: BrokerLog) {
  return (
    typeof log.performedBy === "object" &&
    log.performedBy?.roles?.includes("BROKER_OFFICER")
  );
}

function getPerformerName(log: BrokerLog) {
  if (typeof log.performedBy === "object" && log.performedBy) {
    return log.performedBy.name || log.performedBy.email || "System";
  }
  return log.performedBy || "System";
}

function formatJson(value: unknown) {
  if (value == null) return "null";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-4 px-6 py-4">
          <div className="h-10 w-28 rounded-lg bg-gray-100 dark:bg-gray-800" />
          <div className="h-8 w-36 rounded-full bg-gray-100 dark:bg-gray-800" />
          <div className="h-10 flex-1 rounded-lg bg-gray-100 dark:bg-gray-800" />
          <div className="h-10 w-32 rounded-lg bg-gray-100 dark:bg-gray-800" />
          <div className="h-8 w-20 rounded-lg bg-gray-100 dark:bg-gray-800" />
        </div>
      ))}
    </div>
  );
}

export default function AdminLogs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialLoanOfficersOnly =
    searchParams.get("loanOfficersOnly") === "1" ||
    searchParams.get("loanOfficersOnly") === "true";
  const [logs, setLogs] = useState<BrokerLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loanOfficersOnly, setLoanOfficersOnly] = useState(initialLoanOfficersOnly);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [serverTotal, setServerTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedLog, setSelectedLog] = useState<BrokerLog | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedQuery, pageSize, categoryFilter, loanOfficersOnly]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (loanOfficersOnly) {
      next.set("loanOfficersOnly", "1");
    } else {
      next.delete("loanOfficersOnly");
    }
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [loanOfficersOnly]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
      });
      if (categoryFilter) params.set("category", categoryFilter);
      if (debouncedQuery) params.set("action", debouncedQuery);
      if (loanOfficersOnly) params.set("loanOfficersOnly", "true");

      const res = await fetch(`${API_BASE}/broker/logs?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);

      const json = await res.json();
      setLogs(json.data || []);
      setServerTotal(json.total ?? 0);
      setTotalPages(json.totalPages ?? 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load logs");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, debouncedQuery, categoryFilter, loanOfficersOnly]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!selectedLog) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedLog(null);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedLog]);

  const categories = useMemo(
    () => [...new Set(logs.map((log) => log.category).filter(Boolean))].sort(),
    [logs]
  );

  const pageStats = useMemo(
    () => ({
      total: serverTotal,
      onPage: logs.length,
      categories: categories.length,
      users: new Set(
        logs.map((log) =>
          typeof log.performedBy === "object" ? log.performedBy?.id : log.performedBy
        ).filter(Boolean)
      ).size,
    }),
    [serverTotal, logs, categories.length]
  );

  const start = logs.length > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const end = Math.min(currentPage * pageSize, serverTotal);

  const gotoPage = (page: number) => {
    setCurrentPage(Math.min(Math.max(page, 1), totalPages));
  };

  return (
    <>
      <PageMeta title="Activity Logs | Broker Dashboard" description="Broker audit trail" />

      <div className="space-y-6">
        {/* Hero */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#2C92D5] p-6 text-white shadow-sm dark:border-gray-800">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                <Shield className="h-3.5 w-3.5" />
                Audit Trail · Broker Portal
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">Activity Logs</h1>
              <p className="mt-1 max-w-2xl text-sm text-white/80">
                Track assignments, messages, application changes, and loan officer
                activity across your brokerage.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Total Events", value: pageStats.total, icon: Activity },
                { label: "This Page", value: pageStats.onPage, icon: Database },
                { label: "Categories", value: pageStats.categories, icon: Shield },
                { label: "Users", value: pageStats.users, icon: User },
              ].map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/20 backdrop-blur-sm"
                >
                  <div className="flex items-center gap-2 text-white/70">
                    <Icon className="h-4 w-4" />
                    <span className="text-xs">{label}</span>
                  </div>
                  <p className="mt-1 text-2xl font-semibold">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                placeholder="Search by action (e.g. ASSIGN, MESSAGE)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 text-sm outline-none focus:border-[#13538A]/40 focus:ring-2 focus:ring-[#13538A]/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#13538A]/40 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>

              <button
                type="button"
                onClick={() => fetchLogs()}
                disabled={loading}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="shrink-0 text-xs font-medium text-gray-500">Category:</span>
            {["", "APPLICATION", "SYSTEM", "USER_MANAGEMENT", "SECURITY", "REVIEW"].map(
              (category) => (
                <button
                  key={category || "all"}
                  type="button"
                  onClick={() => setCategoryFilter(category)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    categoryFilter === category
                      ? "bg-[#13538A] text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                >
                  {category ? category.replace(/_/g, " ") : "All"}
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => setLoanOfficersOnly((v) => !v)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                loanOfficersOnly
                  ? "bg-sky-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
              }`}
            >
              Loan Officers Only
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {loading ? (
            <TableSkeleton />
          ) : error ? (
            <div className="py-16 text-center">
              <p className="font-medium text-red-500">{error}</p>
              <button
                type="button"
                onClick={() => fetchLogs()}
                className="mt-3 text-sm font-medium text-[#13538A] hover:underline"
              >
                Try again
              </button>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#13538A]/10 text-[#13538A]">
                <Database size={24} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                No activity logs found
              </h3>
              <p className="mt-1 max-w-md text-sm text-gray-500">
                {query || categoryFilter
                  ? "Try adjusting your search or category filter."
                  : "Audit records will appear here as your team uses the broker portal."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/80 dark:border-gray-800 dark:bg-gray-800/50">
                      {["Timestamp", "Event", "Entity", "User / IP", ""].map((col) => (
                        <th
                          key={col}
                          className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {logs.map((log) => {
                      const performer = getPerformerName(log);
                      return (
                        <tr
                          key={log.id}
                          className="group transition hover:bg-[#13538A]/[0.03] dark:hover:bg-gray-800/50"
                        >
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <div>
                                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                                  {formatDateTime(log.createdAt)}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {formatRelativeTime(log.createdAt)}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex flex-col gap-1.5">
                              <span
                                className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${actionClass(log.action)}`}
                              >
                                {log.action.replace(/_/g, " ")}
                              </span>
                              <span
                                className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${
                                  CATEGORY_STYLES[log.category] ||
                                  "bg-gray-100 text-gray-600 ring-gray-200"
                                }`}
                              >
                                {log.category.replace(/_/g, " ")}
                              </span>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="rounded-lg bg-gray-100 p-2 dark:bg-gray-800">
                                <Database className="h-4 w-4 text-gray-500" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                                  {log.entityType}
                                </p>
                                <p className="max-w-[140px] truncate text-xs text-gray-400">
                                  {log.entityId}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <span
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${getAvatarTone(performer)}`}
                              >
                                {getInitials(performer)}
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                                    {performer}
                                  </p>
                                  {isLoanOfficerPerformer(log) && (
                                    <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-700">
                                      LO
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-400">{log.ipAddress || "—"}</p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedLog(log)}
                              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-[#13538A] transition hover:bg-[#13538A]/10"
                            >
                              <Eye className="h-4 w-4" />
                              Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
                  <p className="text-sm text-gray-500">
                    Showing <span className="font-semibold text-gray-900 dark:text-white">{start}</span>
                    {" – "}
                    <span className="font-semibold text-gray-900 dark:text-white">{end}</span>
                    {" of "}
                    <span className="font-semibold text-gray-900 dark:text-white">{serverTotal}</span>
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => gotoPage(currentPage - 1)}
                      className="rounded-lg border border-gray-200 p-2 disabled:opacity-40 dark:border-gray-700"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm font-semibold text-[#13538A] dark:border-gray-700">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage === totalPages}
                      onClick={() => gotoPage(currentPage + 1)}
                      className="rounded-lg border border-gray-200 p-2 disabled:opacity-40 dark:border-gray-700"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selectedLog &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={() => setSelectedLog(null)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="flex max-h-[min(80vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between border-b px-6 py-4 dark:border-gray-800">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Change Details
                  </h3>
                  <p className="text-xs text-gray-500">
                    {selectedLog.action.replace(/_/g, " ")} · {selectedLog.entityType}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-800"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-6 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase text-gray-400">
                    Old Value
                  </label>
                  <pre className="max-h-64 overflow-auto rounded-xl border border-gray-800 bg-gray-900 p-4 text-xs text-gray-300">
                    {formatJson(selectedLog.oldValue)}
                  </pre>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase text-gray-400">
                    New Value
                  </label>
                  <pre className="max-h-64 overflow-auto rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
                    {formatJson(selectedLog.newValue)}
                  </pre>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
