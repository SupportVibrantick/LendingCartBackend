import {
  Activity,
  ArrowLeftRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Database,
  Eye,
  Filter,
  Globe,
  RefreshCw,
  Search,
  SearchX,
  Shield,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
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
  filters?: {
    categories?: string[];
    entityTypes?: string[];
  };
};

const CATEGORY_STYLES: Record<string, string> = {
  APPLICATION:
    "bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20",
  SYSTEM:
    "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
  USER:
    "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20",
  USER_MANAGEMENT:
    "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20",
  SECURITY:
    "bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20",
  MESSAGING:
    "bg-cyan-50 text-cyan-700 ring-cyan-100 dark:bg-cyan-500/10 dark:text-cyan-300 dark:ring-cyan-500/20",
  REVIEW:
    "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20",
  LOI:
    "bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/20",
};

const selectClassName =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";

const AVATAR_TONES = [
  "bg-[#13538A]/10 text-[#13538A]",
  "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
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
  const index = seed
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_TONES[index % AVATAR_TONES.length];
}

function formatDateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
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

function humanizeLabel(value?: string) {
  if (!value) return "—";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
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
    return "bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/20";
  if (upper.includes("MESSAGE") || upper.includes("SENT"))
    return "bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:ring-cyan-500/20";
  if (upper.includes("LOGIN") || upper.includes("AUTH"))
    return "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20";
  return "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700";
}

const SENSITIVE_AUDIT_KEY =
  /password|passwd|passwordhash|hashedpassword|secret|token|bearer|authorization|api[_-]?key|private[_-]?key|refresh|jwt|session|otp|pin|ssn|cvv|cvc/i;

function redactAuditValue(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (depth > 8) return "[TRUNCATED]";
  if (Array.isArray(value)) {
    return value.map((item) => redactAuditValue(item, depth + 1));
  }
  if (typeof value !== "object") return value;

  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_AUDIT_KEY.test(key)
      ? "[REDACTED]"
      : redactAuditValue(nested, depth + 1);
  }
  return out;
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
  return JSON.stringify(redactAuditValue(parsed), null, 2);
}

function getActorName(log: AdminLog) {
  return (
    `${log.actorUser?.firstName || ""} ${log.actorUser?.lastName || ""}`.trim() ||
    "System"
  );
}

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Could not copy");
  }
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-4 px-5 py-4 sm:px-6">
          <div className="h-10 w-28 rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="h-8 w-40 rounded-full bg-slate-100 dark:bg-slate-800" />
          <div className="h-10 flex-1 rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="h-10 w-40 rounded-lg bg-slate-100 dark:bg-slate-800" />
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
  const [categories, setCategories] = useState<string[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedQuery, pageSize, entityFilter, categoryFilter]);

  useEffect(() => {
    if (!selectedLog) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedLog(null);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedLog]);

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
      if (categoryFilter) params.set("category", categoryFilter);

      const json = await adminFetch<LogsResponse>(
        `/admin/logs/?${params.toString()}`,
      );
      setLogs(json.data || []);
      setServerTotal(json.total ?? 0);
      setTotalPages(json.totalPages ?? 1);

      if (Array.isArray(json.filters?.categories)) {
        setCategories(json.filters.categories);
      }
      if (Array.isArray(json.filters?.entityTypes)) {
        setEntityTypes(json.filters.entityTypes);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load logs");
      setLogs([]);
      setServerTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, debouncedQuery, entityFilter, categoryFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const pageStats = useMemo(
    () => ({
      total: serverTotal,
      onPage: logs.length,
      categories: categories.length,
      users: new Set(logs.map((log) => log.actorUserId).filter(Boolean)).size,
    }),
    [serverTotal, logs, categories.length],
  );

  const categoryOptions = useMemo(() => {
    const values = new Set(categories);
    if (categoryFilter) values.add(categoryFilter);
    return [...values].sort();
  }, [categories, categoryFilter]);

  const entityOptions = useMemo(() => {
    const values = new Set(entityTypes);
    if (entityFilter) values.add(entityFilter);
    return [...values].sort();
  }, [entityTypes, entityFilter]);

  const gotoPage = (page: number) => {
    const next = Math.min(Math.max(page, 1), totalPages);
    setCurrentPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const start = logs.length > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const end = Math.min(currentPage * pageSize, serverTotal);
  const hasActiveFilters = Boolean(query || categoryFilter || entityFilter);

  const clearFilters = () => {
    setQuery("");
    setDebouncedQuery("");
    setCategoryFilter("");
    setEntityFilter("");
    setCurrentPage(1);
  };

  return (
    <>
      <PageMeta
        title="Activity Logs"
        description="Platform audit trail and system events"
      />

      <div className="mx-auto w-full max-w-7xl space-y-5">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#13538A] via-[#18B6B4] to-emerald-400" />
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#13538A]/5 blur-2xl dark:bg-[#13538A]/10" />

          <div className="relative flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#13538A]/10 text-[#13538A] ring-1 ring-[#13538A]/15 dark:bg-[#13538A]/20 dark:text-sky-300">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Audit Trail
                </p>
                <h1 className="mt-0.5 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Activity Logs
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                  Review platform events across users, applications, messaging,
                  and security in one place.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                { label: "Total", value: pageStats.total, icon: Activity },
                { label: "On page", value: pageStats.onPage, icon: Database },
                { label: "Categories", value: pageStats.categories, icon: Filter },
                { label: "Actors", value: pageStats.users, icon: UserRound },
              ].map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="min-w-[6.5rem] rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-800/70"
                >
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Icon className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-medium uppercase tracking-wide">
                      {label}
                    </span>
                  </div>
                  <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                    {loading ? "—" : value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Filters + table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-3 border-b border-slate-100 p-4 dark:border-slate-800 sm:p-5">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.85fr))_auto]">
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  placeholder="Search action, entity, user, or ID..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-[#13538A] focus:bg-white focus:ring-2 focus:ring-[#13538A]/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="min-w-0">
                <label className="sr-only" htmlFor="admin-log-category">
                  Category
                </label>
                <select
                  id="admin-log-category"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className={selectClassName}
                >
                  <option value="">All categories</option>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {humanizeLabel(category)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-0">
                <label className="sr-only" htmlFor="admin-log-entity">
                  Entity
                </label>
                <select
                  id="admin-log-entity"
                  value={entityFilter}
                  onChange={(e) => setEntityFilter(e.target.value)}
                  className={selectClassName}
                >
                  <option value="">All entities</option>
                  {entityOptions.map((entity) => (
                    <option key={entity} value={entity}>
                      {humanizeLabel(entity)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-0">
                <label className="sr-only" htmlFor="admin-log-page-size">
                  Rows per page
                </label>
                <select
                  id="admin-log-page-size"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className={selectClassName}
                >
                  <option value={10}>10 / page</option>
                  <option value={20}>20 / page</option>
                  <option value={50}>50 / page</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <X className="h-4 w-4" />
                    Clear
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => fetchLogs()}
                  disabled={loading}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-600 transition hover:border-[#13538A]/40 hover:text-[#13538A] disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </button>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-400">
                  Active
                </span>
                {debouncedQuery && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    Search: “{debouncedQuery}”
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setDebouncedQuery("");
                      }}
                      className="rounded-full p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700"
                      aria-label="Clear search"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {categoryFilter && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#13538A]/10 px-2.5 py-1 text-xs font-medium text-[#13538A] dark:bg-[#13538A]/20 dark:text-sky-300">
                    {humanizeLabel(categoryFilter)}
                    <button
                      type="button"
                      onClick={() => setCategoryFilter("")}
                      className="rounded-full p-0.5 hover:bg-[#13538A]/15"
                      aria-label="Clear category"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {entityFilter && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">
                    {humanizeLabel(entityFilter)}
                    <button
                      type="button"
                      onClick={() => setEntityFilter("")}
                      className="rounded-full p-0.5 hover:bg-teal-100 dark:hover:bg-teal-500/25"
                      aria-label="Clear entity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <TableSkeleton />
          ) : error ? (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 dark:bg-rose-500/10">
                <SearchX className="h-7 w-7" />
              </div>
              <p className="mt-4 text-sm font-semibold text-rose-600 dark:text-rose-400">
                {error}
              </p>
              <button
                type="button"
                onClick={() => fetchLogs()}
                className="mt-4 rounded-xl bg-[#13538A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f4573]"
              >
                Try again
              </button>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                <SearchX className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-800 dark:text-white">
                No activity logs found
              </h3>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                {hasActiveFilters
                  ? "Try adjusting your search or filters."
                  : "Audit records will appear here as platform events occur."}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-3 text-sm font-medium text-[#13538A] hover:underline dark:text-sky-400"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="custom-scrollbar overflow-x-auto">
                <table className="w-full min-w-[980px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                      <th className="px-5 py-3.5 sm:px-6">When</th>
                      <th className="px-5 py-3.5 sm:px-6">Event</th>
                      <th className="px-5 py-3.5 sm:px-6">Entity</th>
                      <th className="px-5 py-3.5 sm:px-6">Actor</th>
                      <th className="px-5 py-3.5 text-right sm:px-6">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {logs.map((log) => {
                      const actorName = getActorName(log);

                      return (
                        <tr
                          key={log.id}
                          onClick={() => setSelectedLog(log)}
                          className="group cursor-pointer transition-colors hover:bg-slate-50/90 dark:hover:bg-slate-800/40"
                        >
                          <td className="px-5 py-4 sm:px-6">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 rounded-lg bg-slate-100 p-2 text-slate-500 dark:bg-slate-800">
                                <Clock3 className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                  {formatRelativeTime(log.createdAt)}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-400">
                                  {formatDateTime(log.createdAt)}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4 sm:px-6">
                            <div className="space-y-2">
                              <span
                                className={`inline-flex max-w-full truncate rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${actionClass(log.action)}`}
                                title={log.action}
                              >
                                {humanizeLabel(log.action)}
                              </span>
                              <div>
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${
                                    CATEGORY_STYLES[log.category] ||
                                    "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300"
                                  }`}
                                >
                                  {humanizeLabel(log.category)}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4 sm:px-6">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                              {humanizeLabel(log.entityType)}
                            </p>
                          </td>

                          <td className="px-5 py-4 sm:px-6">
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${getAvatarTone(actorName)}`}
                              >
                                {getInitials(actorName)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                                  {actorName}
                                </p>
                                <p className="truncate text-xs text-slate-500">
                                  {log.actorOrg?.name ||
                                    log.actorUser?.email ||
                                    "Platform"}
                                </p>
                                {log.ipAddress ? (
                                  <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-slate-400">
                                    <Globe className="h-3 w-3" />
                                    {log.ipAddress}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4 text-right sm:px-6">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedLog(log);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#13538A] transition hover:border-[#13538A]/30 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-sky-300 dark:hover:bg-slate-800"
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

              <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Showing{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {start}
                  </span>
                  –
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {end}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {serverTotal}
                  </span>{" "}
                  events
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => gotoPage(currentPage - 1)}
                    disabled={currentPage === 1 || loading}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 5) }).map(
                      (_, i) => {
                        const half = Math.floor(5 / 2);
                        let startPage = 1;
                        if (totalPages <= 5) startPage = 1;
                        else if (currentPage <= half + 1) startPage = 1;
                        else if (currentPage >= totalPages - half)
                          startPage = totalPages - 4;
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
                      },
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => gotoPage(currentPage + 1)}
                    disabled={currentPage === totalPages || loading}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
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

      {selectedLog &&
        createPortal(
          <div
            className="fixed inset-0 z-[100000] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
            onClick={() => setSelectedLog(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-log-detail-title"
          >
            <div
              className="flex max-h-[100vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl dark:border-slate-700 dark:bg-slate-900"
              onClick={(event) => event.stopPropagation()}
            >
              {/* Sticky header */}
              <div className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 sm:px-6">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Event details
                  </p>
                  <h3
                    id="admin-log-detail-title"
                    className="mt-1 truncate text-xl font-bold tracking-tight text-slate-900 dark:text-white"
                  >
                    {humanizeLabel(selectedLog.action)}
                  </h3>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${actionClass(selectedLog.action)}`}
                    >
                      {humanizeLabel(selectedLog.action)}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${
                        CATEGORY_STYLES[selectedLog.category] ||
                        "bg-slate-100 text-slate-600 ring-slate-200"
                      }`}
                    >
                      {humanizeLabel(selectedLog.category)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                      <Clock3 className="h-3.5 w-3.5" />
                      {formatRelativeTime(selectedLog.createdAt)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="shrink-0 rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:hover:text-white"
                  aria-label="Close details"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Meta */}
              <div className="custom-scrollbar shrink-0 border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:px-6">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    {
                      label: "Entity",
                      value: humanizeLabel(selectedLog.entityType),
                      icon: Database,
                    },
                    {
                      label: "Entity ID",
                      value: selectedLog.entityId,
                      copyable: true,
                    },
                    {
                      label: "User",
                      value: getActorName(selectedLog),
                      icon: UserRound,
                    },
                    {
                      label: "Organization",
                      value: selectedLog.actorOrg?.name || "—",
                      icon: Shield,
                    },
                    {
                      label: "IP Address",
                      value: selectedLog.ipAddress || "—",
                      icon: Globe,
                    },
                    {
                      label: "Timestamp",
                      value: formatDateTime(selectedLog.createdAt),
                      icon: Calendar,
                    },
                  ].map(({ label, value, copyable, icon: Icon }) => (
                    <div
                      key={label}
                      className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-800/40"
                    >
                      <div className="flex items-center gap-1.5 text-slate-400">
                        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                        <p className="text-[11px] font-semibold uppercase tracking-wide">
                          {label}
                        </p>
                      </div>
                      <div className="mt-1.5 flex items-start gap-2">
                        <p className="min-w-0 break-all text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {value}
                        </p>
                        {copyable && value && value !== "—" ? (
                          <button
                            type="button"
                            onClick={() => copyText(String(value), label)}
                            className="shrink-0 rounded-md border border-slate-200 bg-white p-1 text-slate-400 transition hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                            title={`Copy ${label}`}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Values */}
              <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                <div className="mb-3 flex items-center gap-2 text-slate-500">
                  <ArrowLeftRight className="h-4 w-4" />
                  <p className="text-xs font-semibold uppercase tracking-wide">
                    Value changes
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="overflow-hidden rounded-xl border border-rose-200/80 dark:border-rose-500/30">
                    <div className="flex items-center justify-between border-b border-rose-200/80 bg-rose-50 px-3.5 py-2.5 dark:border-rose-500/30 dark:bg-rose-500/10">
                      <p className="text-xs font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300">
                        Old value
                      </p>
                      {selectedLog.oldValueJson ? (
                        <button
                          type="button"
                          onClick={() =>
                            copyText(
                              formatJson(selectedLog.oldValueJson),
                              "Old value",
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-100 dark:text-rose-300 dark:hover:bg-rose-500/20"
                        >
                          <Copy className="h-3 w-3" />
                          Copy
                        </button>
                      ) : null}
                    </div>
                    <pre className="custom-scrollbar max-h-[280px] overflow-auto bg-slate-950 p-4 text-[12px] leading-6 text-slate-200">
                      {formatJson(selectedLog.oldValueJson)}
                    </pre>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-emerald-200/80 dark:border-emerald-500/30">
                    <div className="flex items-center justify-between border-b border-emerald-200/80 bg-emerald-50 px-3.5 py-2.5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                      <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                        New value
                      </p>
                      {selectedLog.newValueJson ? (
                        <button
                          type="button"
                          onClick={() =>
                            copyText(
                              formatJson(selectedLog.newValueJson),
                              "New value",
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
                        >
                          <Copy className="h-3 w-3" />
                          Copy
                        </button>
                      ) : null}
                    </div>
                    <pre className="custom-scrollbar max-h-[280px] overflow-auto bg-slate-950 p-4 text-[12px] leading-6 text-slate-200">
                      {formatJson(selectedLog.newValueJson)}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 z-10 flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-5 py-3.5 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 sm:px-6">
                <p className="hidden text-xs text-slate-400 sm:block">
                  Press Esc to close
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="ml-auto inline-flex h-10 items-center justify-center rounded-xl bg-[#13538A] px-4 text-sm font-semibold text-white transition hover:bg-[#0f4573]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
