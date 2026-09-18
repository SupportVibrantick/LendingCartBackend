import {
  Activity,
  ArrowLeftRight,
  ArrowRight,
  Box,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Database,
  Eye,
  FileText,
  Filter,
  Globe,
  MessageSquare,
  RefreshCw,
  Search,
  SearchX,
  Shield,
  UserRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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

function actionAccent(action: string) {
  const upper = action?.toUpperCase() || "";
  if (upper.includes("DELETE") || upper.includes("REMOVE")) return "bg-rose-500";
  if (upper.includes("CREATE") || upper.includes("ADD")) return "bg-emerald-500";
  if (upper.includes("UPDATE") || upper.includes("EDIT")) return "bg-blue-500";
  if (upper.includes("ASSIGN")) return "bg-teal-500";
  if (upper.includes("MESSAGE") || upper.includes("SENT")) return "bg-cyan-500";
  if (upper.includes("LOGIN") || upper.includes("AUTH")) return "bg-amber-500";
  return "bg-[#13538A]";
}

function entityIcon(entityType?: string): LucideIcon {
  const key = (entityType || "").toUpperCase();
  if (key.includes("USER") || key.includes("ADMIN")) return UserRound;
  if (key.includes("APPLICATION") || key.includes("LOAN")) return FileText;
  if (key.includes("MESSAGE") || key.includes("CHAT")) return MessageSquare;
  if (key.includes("ORG") || key.includes("BROKER") || key.includes("LENDER"))
    return Shield;
  if (key.includes("PRODUCT")) return Box;
  return Database;
}

function shortId(value?: string) {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function hasValueChange(log: AdminLog) {
  return Boolean(log.oldValueJson || log.newValueJson);
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
    <div className="space-y-3 p-4 sm:p-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse items-center gap-4 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-4 dark:border-slate-800 dark:bg-slate-800/40"
        >
          <div className="h-10 w-10 rounded-xl bg-gray-200 dark:bg-slate-700" />
          <div className="h-8 w-32 rounded-full bg-gray-200 dark:bg-slate-700" />
          <div className="h-10 flex-1 rounded-lg bg-gray-200 dark:bg-slate-700" />
          <div className="h-10 w-44 rounded-lg bg-gray-200 dark:bg-slate-700" />
          <div className="h-9 w-20 rounded-lg bg-gray-200 dark:bg-slate-700" />
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

      <div className="w-full space-y-4 text-gray-900 dark:text-gray-100">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#5D28A8] px-5 py-5 text-white sm:px-6 sm:py-6">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 left-1/3 h-36 w-36 rounded-full bg-fuchsia-300/20 blur-2xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 ring-1 ring-white/20">
                <Shield className="h-3.5 w-3.5" />
                Audit trail
              </div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Activity Logs
              </h1>
              <p className="mt-1 max-w-xl text-sm text-white/80">
                Review platform events across users, applications, messaging,
                and security in one place.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fetchLogs()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#13538A] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: "Total events",
              value: pageStats.total,
              icon: Activity,
              iconWrap:
                "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
            },
            {
              label: "On this page",
              value: pageStats.onPage,
              icon: Database,
              iconWrap:
                "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
            },
            {
              label: "Categories",
              value: pageStats.categories,
              icon: Filter,
              iconWrap:
                "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
            },
            {
              label: "Actors on page",
              value: pageStats.users,
              icon: UserRound,
              iconWrap:
                "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
            },
          ].map(({ label, value, icon: Icon, iconWrap }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3.5 dark:border-slate-700 dark:bg-slate-900"
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconWrap}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 dark:text-slate-400">
                  {label}
                </p>
                <p className="text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
                  {loading ? "—" : value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters + table */}
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="space-y-3 border-b border-gray-100 p-4 dark:border-slate-800 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Event history
                </h2>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">
                  {serverTotal} event{serverTotal === 1 ? "" : "s"}
                  {hasActiveFilters ? " matching filters" : " recorded"}
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    placeholder="Search action, entity, user..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="h-10 w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm text-gray-900 outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/15 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
                  />
                  {query ? (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setDebouncedQuery("");
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                <select
                  id="admin-log-category"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/15 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="">All categories</option>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {humanizeLabel(category)}
                    </option>
                  ))}
                </select>

                <select
                  id="admin-log-entity"
                  value={entityFilter}
                  onChange={(e) => setEntityFilter(e.target.value)}
                  className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/15 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="">All entities</option>
                  {entityOptions.map((entity) => (
                    <option key={entity} value={entity}>
                      {humanizeLabel(entity)}
                    </option>
                  ))}
                </select>

                <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
                  Per page
                  <select
                    id="admin-log-page-size"
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="h-10 rounded-xl border border-gray-200 bg-white px-2.5 text-sm font-medium text-gray-700 outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/15 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <option value={8}>8</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </label>

                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <X className="h-4 w-4" />
                    Clear
                  </button>
                ) : null}
              </div>
            </div>

            {hasActiveFilters ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-gray-400">Active</span>
                {debouncedQuery ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-slate-800 dark:text-slate-200">
                    Search: “{debouncedQuery}”
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setDebouncedQuery("");
                      }}
                      className="rounded-full p-0.5 hover:bg-gray-200 dark:hover:bg-slate-700"
                      aria-label="Clear search"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ) : null}
                {categoryFilter ? (
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
                ) : null}
                {entityFilter ? (
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
                ) : null}
              </div>
            ) : null}
          </div>

          {loading ? (
            <TableSkeleton />
          ) : error ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 dark:bg-rose-500/10">
                <SearchX className="h-6 w-6" />
              </div>
              <p className="mt-4 text-sm font-medium text-rose-600 dark:text-rose-400">
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
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 dark:bg-slate-800 dark:text-slate-500">
                <SearchX className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-gray-800 dark:text-slate-200">
                {hasActiveFilters ? "No results found" : "No activity logs yet"}
              </p>
              <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-slate-400">
                {hasActiveFilters
                  ? "Try adjusting your search or filters."
                  : "Audit records will appear here as platform events occur."}
              </p>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-3 text-sm font-medium text-[#13538A] hover:underline dark:text-sky-400"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="custom-scrollbar overflow-x-auto">
                <table className="w-full min-w-[1040px] text-left text-sm">
                  <thead className="sticky top-0 z-[1] bg-slate-50/95 backdrop-blur dark:bg-slate-800/90">
                    <tr className="border-b border-gray-200 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:border-slate-700 dark:text-slate-400">
                      <th className="px-5 py-3.5 sm:px-6">When</th>
                      <th className="px-5 py-3.5 sm:px-6">Event</th>
                      <th className="px-5 py-3.5 sm:px-6">Entity</th>
                      <th className="px-5 py-3.5 sm:px-6">Actor</th>
                      <th className="w-[120px] px-5 py-3.5 text-right sm:px-6">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {logs.map((log) => {
                      const actorName = getActorName(log);
                      const EntityIcon = entityIcon(log.entityType);
                      const changed = hasValueChange(log);

                      return (
                        <tr
                          key={log.id}
                          onClick={() => setSelectedLog(log)}
                          className="group relative cursor-pointer transition-colors hover:bg-[#13538A]/[0.03] dark:hover:bg-slate-800/50"
                        >
                          <td className="relative px-5 py-4 sm:px-6">
                            <span
                              className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${actionAccent(log.action)} opacity-70 group-hover:opacity-100`}
                              aria-hidden
                            />
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#13538A]/10 text-[#13538A] ring-1 ring-[#13538A]/15 dark:bg-[#13538A]/20 dark:text-sky-300 dark:ring-[#13538A]/30">
                                <Clock3 className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-gray-900 dark:text-white">
                                  {formatRelativeTime(log.createdAt)}
                                </p>
                                <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-slate-400">
                                  {formatDateTime(log.createdAt)}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4 sm:px-6">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`inline-flex max-w-[200px] truncate rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${actionClass(log.action)}`}
                                title={log.action}
                              >
                                {humanizeLabel(log.action)}
                              </span>
                              <span
                                className={`inline-flex rounded-full px-2 py-1 text-[10px] font-medium ring-1 ${
                                  CATEGORY_STYLES[log.category] ||
                                  "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300"
                                }`}
                              >
                                {humanizeLabel(log.category)}
                              </span>
                              {changed ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-1 text-[10px] font-medium text-violet-700 ring-1 ring-violet-100 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/20">
                                  <ArrowLeftRight className="h-3 w-3" />
                                  Diff
                                </span>
                              ) : null}
                            </div>
                          </td>

                          <td className="px-5 py-4 sm:px-6">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                <EntityIcon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-gray-900 dark:text-white">
                                  {humanizeLabel(log.entityType)}
                                </p>
                                <button
                                  type="button"
                                  title={log.entityId}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (log.entityId) {
                                      copyText(log.entityId, "Entity ID");
                                    }
                                  }}
                                  className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate font-mono text-[11px] text-gray-400 transition hover:text-[#13538A] dark:hover:text-sky-300"
                                >
                                  {shortId(log.entityId)}
                                  {log.entityId ? (
                                    <Copy className="h-3 w-3 shrink-0 opacity-0 transition group-hover:opacity-100" />
                                  ) : null}
                                </button>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4 sm:px-6">
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-2 ring-white dark:ring-slate-900 ${getAvatarTone(actorName)}`}
                              >
                                {getInitials(actorName)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-gray-900 dark:text-white">
                                  {actorName}
                                </p>
                                <p className="truncate text-xs text-gray-500 dark:text-slate-400">
                                  {log.actorOrg?.name ||
                                    log.actorUser?.email ||
                                    "Platform"}
                                </p>
                                {log.ipAddress ? (
                                  <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                    <Globe className="h-3 w-3" />
                                    {log.ipAddress}
                                  </span>
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
                              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-[#13538A] transition hover:border-[#13538A]/35 hover:bg-[#13538A]/5 group-hover:border-[#13538A]/40 dark:border-slate-700 dark:bg-slate-900 dark:text-sky-300 dark:hover:bg-slate-800"
                              title="View details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">View</span>
                              <ArrowRight className="hidden h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100 sm:inline" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Showing{" "}
                  <span className="font-medium text-gray-700 dark:text-slate-200">
                    {start}–{end}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-gray-700 dark:text-slate-200">
                    {serverTotal}
                  </span>
                </p>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => gotoPage(currentPage - 1)}
                    disabled={currentPage === 1 || loading}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <span className="inline-flex items-center gap-1">
                      <ChevronLeft className="h-4 w-4" />
                      Prev
                    </span>
                  </button>

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
                          className={`min-w-8 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition ${
                            page === currentPage
                              ? "border-[#13538A] bg-[#13538A] text-white"
                              : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                          }`}
                        >
                          {page}
                        </button>
                      );
                    },
                  )}

                  <button
                    type="button"
                    onClick={() => gotoPage(currentPage + 1)}
                    disabled={currentPage === totalPages || loading}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <span className="inline-flex items-center gap-1">
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </span>
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
              className="flex max-h-[100vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white sm:max-h-[90vh] sm:rounded-2xl dark:border-slate-700 dark:bg-slate-900"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-4 border-b border-gray-100 bg-white/95 px-5 py-4 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 sm:px-6">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                    Event details
                  </p>
                  <h3
                    id="admin-log-detail-title"
                    className="mt-1 truncate text-xl font-semibold tracking-tight text-gray-900 dark:text-white"
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
                    <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                      <Clock3 className="h-3.5 w-3.5" />
                      {formatRelativeTime(selectedLog.createdAt)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="shrink-0 rounded-xl border border-gray-200 bg-white p-2.5 text-gray-500 transition hover:bg-gray-50 hover:text-gray-800 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:hover:text-white"
                  aria-label="Close details"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="custom-scrollbar shrink-0 border-b border-gray-100 px-5 py-4 dark:border-slate-800 sm:px-6">
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
                      className="rounded-xl border border-gray-100 bg-gray-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-800/40"
                    >
                      <div className="flex items-center gap-1.5 text-gray-400">
                        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                        <p className="text-[11px] font-semibold uppercase tracking-wide">
                          {label}
                        </p>
                      </div>
                      <div className="mt-1.5 flex items-start gap-2">
                        <p className="min-w-0 break-all text-sm font-semibold text-gray-800 dark:text-slate-100">
                          {value}
                        </p>
                        {copyable && value && value !== "—" ? (
                          <button
                            type="button"
                            onClick={() => copyText(String(value), label)}
                            className="shrink-0 rounded-md border border-gray-200 bg-white p-1 text-gray-400 transition hover:border-gray-300 hover:text-gray-700 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
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

              <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                <div className="mb-3 flex items-center gap-2 text-gray-500">
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

              <div className="sticky bottom-0 z-10 flex shrink-0 items-center justify-between gap-3 border-t border-gray-100 bg-white/95 px-5 py-3.5 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 sm:px-6">
                <p className="hidden text-xs text-gray-400 sm:block">
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
