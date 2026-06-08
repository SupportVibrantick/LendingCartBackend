import {
  Activity,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Database,
  Eye,
  Filter,
  // Loader2,
  RefreshCw,
  Search,
  Shield,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import { adminFetch } from "../../lib/adminApi";

type ActorUser = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
};

type ActorOrg = {
  id: string;
  name: string;
  type?: string;
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

type LogsResponse = {
  success: boolean;
  data: AdminLog[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
};

const CATEGORY_STYLES: Record<string, string> = {
  APPLICATION: "bg-indigo-50 text-indigo-700 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300",
  SYSTEM: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300",
  USER: "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300",
  SECURITY: "bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-500/10 dark:text-rose-300",
  MESSAGING: "bg-cyan-50 text-cyan-700 ring-cyan-100 dark:bg-cyan-500/10 dark:text-cyan-300",
};

const AVATAR_TONES = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
];

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

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDateTime(value);
}

function actionClass(action: string) {
  const upper = action?.toUpperCase() || "";
  if (upper.includes("DELETE") || upper.includes("REMOVE"))
    return "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20";
  if (upper.includes("CREATE") || upper.includes("ADD"))
    return "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20";
  if (upper.includes("UPDATE") || upper.includes("EDIT"))
    return "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20";
  if (upper.includes("ASSIGN"))
    return "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/20";
  if (upper.includes("MESSAGE") || upper.includes("SENT"))
    return "bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:ring-cyan-500/20";
  if (upper.includes("LOGIN") || upper.includes("AUTH"))
    return "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20";
  return "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700";
}

function parseJsonSafe(value?: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function formatJson(value?: string | null) {
  const parsed = parseJsonSafe(value);
  if (parsed == null) return "null";
  if (typeof parsed === "string") return parsed;
  return JSON.stringify(parsed, null, 2);
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-4 px-6 py-4">
          <div className="h-10 w-28 rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="h-8 w-36 rounded-full bg-slate-100 dark:bg-slate-800" />
          <div className="h-10 flex-1 rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="h-10 w-32 rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="h-8 w-20 rounded-lg bg-slate-100 dark:bg-slate-800" />
        </div>
      ))}
    </div>
  );
}

export default function AdminLogs() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const [serverTotal, setServerTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AdminLog | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedQuery, pageSize, entityFilter]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
      });
      if (debouncedQuery) params.set("search", debouncedQuery);
      if (entityFilter) params.set("entityType", entityFilter);

      const json = await adminFetch<LogsResponse>(`/admin/logs/?${params.toString()}`);
      setLogs(json.data || []);
      setServerTotal(json.total ?? 0);
      setTotalPages(json.totalPages ?? 1);
    } catch (err: any) {
      setError(err.message || "Failed to load logs");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, debouncedQuery, entityFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const categories = useMemo(
    () => [...new Set(logs.map((log) => log.category).filter(Boolean))].sort(),
    [logs],
  );

  const entityTypes = useMemo(
    () => [...new Set(logs.map((log) => log.entityType).filter(Boolean))].sort(),
    [logs],
  );

  const filtered = useMemo(() => {
    if (!categoryFilter) return logs;
    return logs.filter((log) => log.category === categoryFilter);
  }, [logs, categoryFilter]);

  const pageStats = useMemo(
    () => ({
      total: serverTotal,
      onPage: filtered.length,
      categories: categories.length,
      users: new Set(filtered.map((log) => log.actorUserId).filter(Boolean)).size,
    }),
    [serverTotal, filtered, categories.length],
  );

  const gotoPage = (page: number) => {
    const next = Math.min(Math.max(page, 1), totalPages);
    setCurrentPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const start = filtered.length > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const end = Math.min(currentPage * pageSize, serverTotal);

  return (
    <>
      <PageMeta title="Activity Logs" description="Platform audit trail and system events" />

      <div className="space-y-6">
        {/* Header */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#5D28A8] p-6 text-white shadow-lg dark:border-slate-800">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                <Shield className="h-3.5 w-3.5" />
                Audit Trail · Platform Admin
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">Activity Logs</h1>
              <p className="mt-1 max-w-2xl text-sm text-white/80">
                Complete audit history for broker, lender, application, and system-level events.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Total Events", value: pageStats.total, icon: Activity },
                { label: "This Page", value: pageStats.onPage, icon: Database },
                { label: "Categories", value: pageStats.categories, icon: Filter },
                { label: "Users", value: pageStats.users, icon: Shield },
              ].map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm ring-1 ring-white/20"
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
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="Search by action, entity, or ID..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none focus:border-[#13538A]/40 focus:ring-2 focus:ring-[#13538A]/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#13538A]/40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>

              <button
                type="button"
                onClick={() => fetchLogs()}
                disabled={loading}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          <div className="custom-scrollbar mt-4 flex items-center gap-2 overflow-x-auto pb-1">
            <span className="shrink-0 text-xs font-medium text-slate-500">Category:</span>
            <button
              type="button"
              onClick={() => setCategoryFilter("")}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                !categoryFilter
                  ? "bg-[#13538A] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setCategoryFilter(category)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  categoryFilter === category
                    ? "bg-[#13538A] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {entityTypes.length > 0 && (
            <div className="custom-scrollbar mt-2 flex items-center gap-2 overflow-x-auto pb-1">
              <span className="shrink-0 text-xs font-medium text-slate-500">Entity:</span>
              <button
                type="button"
                onClick={() => setEntityFilter("")}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  !entityFilter
                    ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                All
              </button>
              {entityTypes.map((entity) => (
                <button
                  key={entity}
                  type="button"
                  onClick={() => setEntityFilter(entity)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    entityFilter === entity
                      ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {entity}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {loading ? (
            <TableSkeleton />
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>
              <button
                type="button"
                onClick={() => fetchLogs()}
                className="mt-4 rounded-xl bg-[#13538A] px-4 py-2 text-sm font-medium text-white"
              >
                Try again
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="rounded-full bg-slate-100 p-4 text-slate-400 dark:bg-slate-800">
                <Database className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-800 dark:text-white">
                No activity logs found
              </h3>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                {query || categoryFilter || entityFilter
                  ? "Try adjusting your search or filters."
                  : "Audit records will appear here as platform events occur."}
              </p>
            </div>
          ) : (
            <>
              <div className="custom-scrollbar overflow-x-auto">
                <table className="w-full min-w-[920px] text-left">
                  <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur dark:bg-slate-800/95">
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      {["Timestamp", "Event", "Entity", "User", "Details"].map((col) => (
                        <th
                          key={col}
                          className={`px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${
                            col === "Details" ? "text-right" : ""
                          }`}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filtered.map((log) => {
                      const actorName =
                        `${log.actorUser?.firstName || ""} ${log.actorUser?.lastName || ""}`.trim() ||
                        "System";

                      return (
                        <tr
                          key={log.id}
                          className="group transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                        >
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="rounded-lg bg-slate-100 p-2 text-slate-500 dark:bg-slate-800">
                                <Calendar className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                                  {formatDateTime(log.createdAt)}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {formatRelativeTime(log.createdAt)}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="space-y-1.5">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${actionClass(log.action)}`}
                              >
                                {log.action}
                              </span>
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${
                                  CATEGORY_STYLES[log.category] ||
                                  "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300"
                                }`}
                              >
                                {log.category}
                              </span>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="rounded-xl bg-slate-100 p-2.5 text-slate-500 dark:bg-slate-800">
                                <Database className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                  {log.entityType}
                                </p>
                                <p className="font-mono text-[11px] text-slate-400">
                                  {log.entityId.slice(0, 8)}…
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${getAvatarTone(actorName)}`}
                              >
                                {getInitials(actorName)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                                  {actorName}
                                </p>
                                <p className="truncate text-xs text-slate-500">
                                  {log.actorOrg?.name || log.actorUser?.email || "—"}
                                </p>
                                <p className="text-[11px] text-slate-400">{log.ipAddress || "—"}</p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedLog(log)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#13538A] transition hover:bg-slate-50 group-hover:border-[#13538A]/30 dark:border-slate-700 dark:bg-slate-950 dark:text-blue-300 dark:hover:bg-slate-800"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50/80 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/80 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500">
                  Showing{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{start}</span>
                  {" – "}
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{end}</span>
                  {" of "}
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {serverTotal}
                  </span>{" "}
                  events
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => gotoPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                      const half = Math.floor(5 / 2);
                      let startPage = 1;
                      if (totalPages <= 5) startPage = 1;
                      else if (currentPage <= half + 1) startPage = 1;
                      else if (currentPage >= totalPages - half) startPage = totalPages - 4;
                      else startPage = currentPage - half;

                      const page = startPage + i;
                      if (page > totalPages) return null;

                      return (
                        <button
                          key={page}
                          type="button"
                          onClick={() => gotoPage(page)}
                          className={`min-w-9 rounded-lg px-2 py-1.5 text-sm font-semibold transition ${
                            page === currentPage
                              ? "bg-[#13538A] text-white shadow-sm"
                              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => gotoPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Details modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/80">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Event Details
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                  {selectedLog.action}
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${actionClass(selectedLog.action)}`}
                  >
                    {selectedLog.action}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${
                      CATEGORY_STYLES[selectedLog.category] ||
                      "bg-slate-100 text-slate-600 ring-slate-200"
                    }`}
                  >
                    {selectedLog.category}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="custom-scrollbar grid shrink-0 gap-3 border-b border-slate-200 px-6 py-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800">
              {[
                { label: "Entity", value: selectedLog.entityType },
                { label: "Entity ID", value: selectedLog.entityId },
                {
                  label: "User",
                  value:
                    `${selectedLog.actorUser?.firstName || ""} ${selectedLog.actorUser?.lastName || ""}`.trim() ||
                    "System",
                },
                { label: "Organization", value: selectedLog.actorOrg?.name || "—" },
                { label: "IP Address", value: selectedLog.ipAddress || "—" },
                { label: "Timestamp", value: formatDateTime(selectedLog.createdAt) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {label}
                  </p>
                  <p className="mt-1 break-all text-sm font-medium text-slate-800 dark:text-slate-100">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <div className="custom-scrollbar grid min-h-0 flex-1 gap-4 overflow-y-auto p-6 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                  Old Value
                </p>
                <pre className="custom-scrollbar max-h-[320px] overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs leading-6 text-slate-300">
                  {formatJson(selectedLog.oldValueJson)}
                </pre>
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                  New Value
                </p>
                <pre className="custom-scrollbar max-h-[320px] overflow-auto rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-6 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
                  {formatJson(selectedLog.newValueJson)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
