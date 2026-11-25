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
  APPLICATION:
    "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-300",
  SYSTEM:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
  USER_MANAGEMENT:
    "border-[#4C78F5]/25 bg-[#4C78F5]/8 text-[#3B66E0] dark:border-[#4C78F5]/40 dark:bg-[#4C78F5]/15 dark:text-sky-300",
  SECURITY:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-500/10 dark:text-rose-300",
  REVIEW:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
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
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatEntityId(id?: string) {
  const value = String(id || "").trim();
  if (!value) return null;
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
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
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-500/10 dark:text-rose-300";
  if (upper.includes("CREATE") || upper.includes("ADD"))
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300";
  if (upper.includes("UPDATE") || upper.includes("EDIT"))
    return "border-[#4C78F5]/25 bg-[#4C78F5]/8 text-[#3B66E0] dark:border-[#4C78F5]/40 dark:bg-[#4C78F5]/15 dark:text-sky-300";
  if (upper.includes("ASSIGN"))
    return "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-500/10 dark:text-violet-300";
  if (upper.includes("MESSAGE") || upper.includes("SENT"))
    return "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-300";
  return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
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
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-4 px-4 py-3.5 sm:px-5">
          <div className="h-10 w-28 rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="h-8 w-36 rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="h-10 flex-1 rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="h-10 w-32 rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="h-8 w-20 rounded-lg bg-slate-100 dark:bg-slate-800" />
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

      <div className="w-full space-y-4">
        {/* Hero */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-none dark:border-slate-800 dark:bg-slate-950 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4C78F5]">
                <Shield className="h-3.5 w-3.5" />
                Audit Trail
              </p>
              <h1 className="mt-1 text-lg font-semibold tracking-tight text-slate-900 dark:text-white sm:text-xl">
                Activity Logs
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Track assignments, messages, application changes, and loan officer
                activity across your brokerage.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                { label: "Total Events", value: pageStats.total, icon: Activity },
                { label: "This Page", value: pageStats.onPage, icon: Database },
                { label: "Categories", value: pageStats.categories, icon: Shield },
                { label: "Users", value: pageStats.users, icon: User },
              ].map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3 dark:border-slate-700 dark:bg-slate-900/40"
                >
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Icon className="h-3.5 w-3.5" />
                    <span className="text-xs font-semibold uppercase tracking-wide">
                      {label}
                    </span>
                  </div>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900 dark:text-white">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-none dark:border-slate-800 dark:bg-slate-950 sm:p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="Search by action (e.g. ASSIGN, MESSAGE)…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-[#4C78F5]/50 focus:ring-2 focus:ring-[#4C78F5]/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[#4C78F5]/50 focus:ring-2 focus:ring-[#4C78F5]/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>

              <button
                type="button"
                onClick={() => fetchLogs()}
                disabled={loading}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 shrink-0 text-sm font-semibold text-slate-500">
              Category
            </span>
            {["", "APPLICATION", "SYSTEM", "USER_MANAGEMENT", "SECURITY", "REVIEW"].map(
              (category) => (
                <button
                  key={category || "all"}
                  type="button"
                  onClick={() => setCategoryFilter(category)}
                  className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                    categoryFilter === category
                      ? "border-[#4C78F5] bg-[#4C78F5] text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                  }`}
                >
                  {category ? category.replace(/_/g, " ") : "All"}
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => setLoanOfficersOnly((v) => !v)}
              className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                loanOfficersOnly
                  ? "border-[#4C78F5] bg-[#4C78F5]/10 text-[#4C78F5]"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
              }`}
            >
              Loan Officers Only
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-none dark:border-slate-800 dark:bg-slate-950">
          {loading ? (
            <TableSkeleton />
          ) : error ? (
            <div className="py-14 text-center">
              <p className="text-sm font-semibold text-rose-600">{error}</p>
              <button
                type="button"
                onClick={() => fetchLogs()}
                className="mt-3 text-sm font-semibold text-[#4C78F5] hover:underline"
              >
                Try again
              </button>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-14 text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <Database className="h-5 w-5 text-slate-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                No activity logs found
              </h3>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                {query || categoryFilter
                  ? "Try adjusting your search or category filter."
                  : "Audit records will appear here as your team uses the broker portal."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/40">
                      {["Timestamp", "Event", "Entity", "User / IP", "Actions"].map(
                        (col) => (
                          <th
                            key={col}
                            className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:px-5"
                          >
                            {col}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {logs.map((log) => {
                      const performer = getPerformerName(log);
                      const entityIdShort = formatEntityId(log.entityId);
                      return (
                        <tr
                          key={log.id}
                          className="transition hover:bg-[#4C78F5]/[0.03] dark:hover:bg-slate-900/50"
                        >
                          <td className="whitespace-nowrap px-4 py-3.5 sm:px-5">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-slate-400" />
                              <div>
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                  {formatDateTime(log.createdAt)}
                                </p>
                                <p className="text-sm text-slate-400">
                                  {formatRelativeTime(log.createdAt) || "Just now"}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 sm:px-5">
                            <div className="flex flex-col gap-1.5">
                              <span
                                className={`inline-flex w-fit rounded-full border px-2.5 py-0.5 text-xs font-semibold ${actionClass(log.action)}`}
                              >
                                {log.action.replace(/_/g, " ")}
                              </span>
                              <span
                                className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                  CATEGORY_STYLES[log.category] ||
                                  "border-slate-200 bg-slate-50 text-slate-600"
                                }`}
                              >
                                {log.category.replace(/_/g, " ")}
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 sm:px-5">
                            <div className="flex items-center gap-3">
                              <div className="rounded-lg bg-[#4C78F5]/10 p-2 text-[#4C78F5]">
                                <Database className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                  {log.entityType || (
                                    <span className="font-normal text-slate-400">
                                      Not provided
                                    </span>
                                  )}
                                </p>
                                {entityIdShort ? (
                                  <p
                                    className="font-mono text-sm text-slate-400"
                                    title={log.entityId}
                                  >
                                    {entityIdShort}
                                  </p>
                                ) : (
                                  <p className="text-sm text-slate-400">
                                    Not provided
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 sm:px-5">
                            <div className="flex items-center gap-3">
                              <span
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${getAvatarTone(performer)}`}
                              >
                                {getInitials(performer)}
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                                    {performer}
                                  </p>
                                  {isLoanOfficerPerformer(log) && (
                                    <span className="rounded-full border border-[#4C78F5]/25 bg-[#4C78F5]/8 px-2 py-0.5 text-[10px] font-semibold uppercase text-[#4C78F5]">
                                      LO
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-slate-400">
                                  {log.ipAddress?.trim() ? (
                                    log.ipAddress
                                  ) : (
                                    <span>IP not available</span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-right sm:px-5">
                            <button
                              type="button"
                              onClick={() => setSelectedLog(log)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-[#4C78F5] transition hover:bg-[#4C78F5]/[0.06] dark:border-slate-700"
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
                <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-slate-800">
                  <p className="text-sm text-slate-500">
                    Showing{" "}
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {start}
                    </span>
                    {" – "}
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {end}
                    </span>
                    {" of "}
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {serverTotal}
                    </span>
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => gotoPage(currentPage - 1)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40 dark:border-slate-700"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="rounded-lg border border-slate-200 px-3 py-1 text-sm font-semibold text-[#4C78F5] dark:border-slate-700">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage === totalPages}
                      onClick={() => gotoPage(currentPage + 1)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40 dark:border-slate-700"
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
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/40 p-4"
            onClick={() => setSelectedLog(null)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="flex max-h-[min(80vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-none dark:border-slate-700 dark:bg-slate-950"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3.5 sm:px-5 dark:border-slate-800">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    Change Details
                  </h3>
                  <p className="mt-0.5 truncate text-sm text-slate-500">
                    {selectedLog.action.replace(/_/g, " ")} · {selectedLog.entityType}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-slate-800"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-4 sm:p-5 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Old Value
                  </label>
                  <pre className="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    {formatJson(selectedLog.oldValue)}
                  </pre>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    New Value
                  </label>
                  <pre className="max-h-64 overflow-auto rounded-lg border border-[#4C78F5]/20 bg-[#4C78F5]/[0.06] p-3 text-sm text-slate-800 dark:border-[#4C78F5]/30 dark:bg-[#4C78F5]/10 dark:text-sky-100">
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
