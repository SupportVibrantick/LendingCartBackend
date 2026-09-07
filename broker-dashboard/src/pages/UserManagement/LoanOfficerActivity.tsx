import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router";
import {
  Activity,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Mail,
  RefreshCw,
  Search,
  SearchX,
  UserCog,
  Users,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const SEARCH_DEBOUNCE_MS = 400;
const OFFICER_PAGE_SIZE = 12;
const ACTIVITY_PAGE_SIZE = 25;

type OfficerSummary = {
  id: string;
  name: string;
  email: string;
  status: string;
  lastLoginAt: string | null;
  assignedApplications: number;
  contactsCreated: number;
  lastActivityAt: string | null;
};

type ActivityItem = {
  id: string;
  category: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  ipAddress?: string | null;
  officer: { id: string; name: string; email: string } | null;
  newValue?: unknown;
  oldValue?: unknown;
};

export type LoanOfficerActivityPanelProps = {
  /** When true, omit the standalone page hero (used inside Loan Officers tabs). */
  embedded?: boolean;
  /** Prefill officer filter (from parent state / row menu — not URL). */
  initialOfficerId?: string;
};

function getAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("broker_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelative(value?: string | null) {
  if (!value) return "No activity yet";
  const diff = Date.now() - new Date(value).getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 86_400_000 * 7) return `${Math.floor(diff / 86_400_000)}d ago`;
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

function shortId(value?: string) {
  if (!value) return "—";
  return value.length > 10 ? `${value.slice(0, 8)}…` : value;
}

function getInitials(name?: string) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function actionTone(action: string) {
  const upper = action.toUpperCase();
  if (upper.includes("DELETE") || upper.includes("REMOVE"))
    return "bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20";
  if (
    upper.includes("CREATE") ||
    upper.includes("SUBMIT") ||
    upper.includes("ADD")
  )
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20";
  if (upper.includes("UPDATE") || upper.includes("EDIT"))
    return "bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20";
  if (upper.includes("MESSAGE") || upper.includes("SENT"))
    return "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:ring-cyan-500/20";
  if (upper.includes("LOGIN") || upper.includes("AUTH"))
    return "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20";
  return "bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700";
}

function avatarTone(seed?: string) {
  const tones = [
    "bg-[#13538A]/10 text-[#13538A]",
    "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  ];
  if (!seed) return tones[0];
  const index = seed
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return tones[index % tones.length];
}

function readOfficerIdFromLocation(location: ReturnType<typeof useLocation>) {
  const stateId = (location.state as { officerId?: string } | null)?.officerId;
  return stateId || "";
}

function summarizeValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return `${value.length} item${value.length === 1 ? "" : "s"}`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const preferredKeys = [
      "message",
      "subject",
      "title",
      "name",
      "email",
      "status",
      "loanNumber",
      "applicationId",
      "summary",
      "description",
      "note",
    ];
    for (const key of preferredKeys) {
      const raw = record[key];
      if (typeof raw === "string" && raw.trim()) return raw.trim();
      if (typeof raw === "number" || typeof raw === "boolean") {
        return String(raw);
      }
    }
    const keys = Object.keys(record);
    if (!keys.length) return null;
    return keys
      .slice(0, 4)
      .map((key) => {
        const raw = record[key];
        if (raw == null || typeof raw === "object") return `${key}: …`;
        return `${key}: ${String(raw)}`;
      })
      .join(" · ");
  }
  return null;
}

function ActivityDetail({ item }: { item: ActivityItem }) {
  const [open, setOpen] = useState(false);
  const preview =
    summarizeValue(item.newValue) || summarizeValue(item.oldValue);
  const hasRaw =
    (item.newValue != null && item.newValue !== "") ||
    (item.oldValue != null && item.oldValue !== "");

  if (!preview && !hasRaw) return null;

  return (
    <div className="mt-2">
      {preview ? (
        <p className="line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
          {preview}
        </p>
      ) : null}
      {hasRaw ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#13538A] hover:underline dark:text-sky-400"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`}
          />
          {open ? "Hide details" : "View details"}
        </button>
      ) : null}
      {open && hasRaw ? (
        <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800/60">
          {item.oldValue != null ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Before
              </p>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px] text-slate-600 dark:text-slate-300">
                {JSON.stringify(item.oldValue, null, 2)}
              </pre>
            </div>
          ) : null}
          {item.newValue != null ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                After
              </p>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px] text-slate-600 dark:text-slate-300">
                {JSON.stringify(item.newValue, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex animate-pulse gap-4 px-5 py-4">
          <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 rounded bg-slate-100 dark:bg-slate-800" />
            <div className="h-3 w-64 rounded bg-slate-100 dark:bg-slate-800" />
          </div>
          <div className="h-8 w-24 rounded bg-slate-100 dark:bg-slate-800" />
        </div>
      ))}
    </div>
  );
}

export function LoanOfficerActivityPanel({
  embedded = false,
  initialOfficerId = "",
}: LoanOfficerActivityPanelProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [officers, setOfficers] = useState<OfficerSummary[]>([]);
  const [selectedOfficer, setSelectedOfficer] = useState<OfficerSummary | null>(
    null,
  );
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loadingOfficers, setLoadingOfficers] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedOfficerId, setSelectedOfficerId] = useState(
    () => initialOfficerId || readOfficerIdFromLocation(location),
  );
  const selectedOfficerIdRef = useRef(selectedOfficerId);
  selectedOfficerIdRef.current = selectedOfficerId;

  const [officerSearch, setOfficerSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [officerPage, setOfficerPage] = useState(1);
  const [officerTotal, setOfficerTotal] = useState(0);
  const [officerTotalPages, setOfficerTotalPages] = useState(1);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(officerSearch.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [officerSearch]);

  useEffect(() => {
    setOfficerPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    if (initialOfficerId && initialOfficerId !== selectedOfficerId) {
      setSelectedOfficerId(initialOfficerId);
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOfficerId]);

  const fetchOfficerRoster = useCallback(async () => {
    setLoadingOfficers(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        officerPage: String(officerPage),
        officerLimit: String(OFFICER_PAGE_SIZE),
        page: "1",
        limit: "1",
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const currentOfficerId = selectedOfficerIdRef.current;
      if (currentOfficerId) params.set("officerId", currentOfficerId);

      const res = await fetch(
        `${API_BASE}/broker/loan-officer-activity?${params.toString()}`,
        { headers: getAuthHeaders() },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load loan officers");
      }

      const list: OfficerSummary[] = json.data?.officers || [];
      const meta = json.data?.officersMeta;
      setOfficers(list);
      setOfficerTotal(meta?.total ?? list.length);

      const fromApi: OfficerSummary | null =
        json.data?.selectedOfficer || null;
      if (fromApi) {
        setSelectedOfficer(fromApi);
      }

      setSelectedOfficerId((prev) => {
        if (prev && (list.some((o) => o.id === prev) || fromApi?.id === prev)) {
          if (!fromApi) {
            const onPage = list.find((o) => o.id === prev);
            if (onPage) setSelectedOfficer(onPage);
          }
          return prev;
        }
        if (
          initialOfficerId &&
          (list.some((o) => o.id === initialOfficerId) ||
            fromApi?.id === initialOfficerId)
        ) {
          if (!fromApi) {
            const onPage = list.find((o) => o.id === initialOfficerId);
            if (onPage) setSelectedOfficer(onPage);
          }
          return initialOfficerId;
        }
        const first = list[0];
        if (first) {
          setSelectedOfficer(first);
          return first.id;
        }
        setSelectedOfficer(null);
        return "";
      });
      setOfficerTotalPages(
        Math.max(1, meta?.totalPages ?? (list.length ? 1 : 1)),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load officers");
      setOfficers([]);
      setOfficerTotal(0);
      setOfficerTotalPages(1);
    } finally {
      setLoadingOfficers(false);
    }
  }, [officerPage, debouncedSearch, initialOfficerId]);

  const fetchActivity = useCallback(async () => {
    if (!selectedOfficerId) {
      setActivity([]);
      setTotal(0);
      setTotalPages(1);
      setSelectedOfficer(null);
      setLoadingActivity(false);
      return;
    }

    setLoadingActivity(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(ACTIVITY_PAGE_SIZE),
        officerId: selectedOfficerId,
        officerPage: "1",
        officerLimit: "1",
      });

      const res = await fetch(
        `${API_BASE}/broker/loan-officer-activity?${params.toString()}`,
        { headers: getAuthHeaders() },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load loan officer activity");
      }

      setActivity(json.data?.activity || []);
      setTotal(json.total ?? 0);
      setTotalPages(json.totalPages ?? 1);

      const refreshed: OfficerSummary | null =
        json.data?.selectedOfficer || null;
      if (refreshed) {
        setSelectedOfficer(refreshed);
        setOfficers((prev) => {
          if (!prev.length) return prev;
          return prev.map((o) => (o.id === refreshed.id ? refreshed : o));
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load activity");
      setActivity([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoadingActivity(false);
    }
  }, [page, selectedOfficerId]);

  useEffect(() => {
    fetchOfficerRoster();
  }, [fetchOfficerRoster]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  useEffect(() => {
    setPage(1);
  }, [selectedOfficerId]);

  // Never put officer ids in the query string (legacy cleanup only).
  useEffect(() => {
    if (!embedded) return;
    if (!searchParams.has("officer")) return;
    const next = new URLSearchParams(searchParams);
    next.set("tab", "activity");
    next.delete("officer");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, searchParams]);

  // Prefill from prop / navigation state without writing id to the URL.
  useEffect(() => {
    const fromState = (location.state as { officerId?: string } | null)?.officerId;
    const prefill = initialOfficerId || fromState || "";
    if (prefill) setSelectedOfficerId(prefill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOfficerId]);

  const displayOfficer = useMemo(() => {
    if (selectedOfficer && selectedOfficer.id === selectedOfficerId) {
      return selectedOfficer;
    }
    return officers.find((o) => o.id === selectedOfficerId) || selectedOfficer;
  }, [officers, selectedOfficer, selectedOfficerId]);

  const headerStats = useMemo(() => {
    type Stat = {
      label: string;
      value: string | number;
      icon: typeof Users;
      text?: boolean;
    };
    if (displayOfficer) {
      return [
        {
          label: "Assigned apps",
          value: displayOfficer.assignedApplications,
          icon: FileText,
        },
        {
          label: "Contacts",
          value: displayOfficer.contactsCreated,
          icon: Mail,
        },
        {
          label: "Events",
          value: total,
          icon: Activity,
        },
        {
          label: "Last active",
          value: formatRelative(displayOfficer.lastActivityAt),
          icon: Clock3,
          text: true,
        },
      ] as Stat[];
    }
    return [
      { label: "Officers", value: officerTotal, icon: Users },
      { label: "Assigned apps", value: "—", icon: FileText },
      { label: "Contacts", value: "—", icon: Mail },
      { label: "Events", value: "—", icon: Activity },
    ] as Stat[];
  }, [displayOfficer, total, officerTotal]);

  const isSearchPending = officerSearch.trim() !== debouncedSearch;
  const rangeStart = activity.length === 0 ? 0 : (page - 1) * ACTIVITY_PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * ACTIVITY_PAGE_SIZE, total);
  const officerRangeStart =
    officers.length === 0 ? 0 : (officerPage - 1) * OFFICER_PAGE_SIZE + 1;
  const officerRangeEnd = Math.min(
    officerPage * OFFICER_PAGE_SIZE,
    officerTotal,
  );
  const loading = loadingOfficers || loadingActivity || isSearchPending;

  return (
    <div
      className={
        embedded ? "space-y-5" : "mx-auto w-full max-w-7xl space-y-5"
      }
    >
      {!embedded && (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#13538A] via-[#18B6B4] to-emerald-400" />
          <div className="relative flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#13538A]/10 text-[#13538A] ring-1 ring-[#13538A]/15 dark:bg-[#13538A]/20 dark:text-sky-300">
                <UserCog className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Team Oversight
                </p>
                <h1 className="mt-0.5 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Loan Officer Activity
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                  Select a loan officer to review their complete activity
                  timeline.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {headerStats.map(({ label, value, icon: Icon, text }) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-center gap-1.5 text-slate-400">
              <Icon className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium uppercase tracking-wide">
                {label}
              </span>
            </div>
            <p
              className={`mt-1 font-bold text-slate-900 dark:text-white ${
                text ? "text-sm" : "text-lg"
              }`}
            >
              {loadingOfficers && !displayOfficer ? "—" : value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        {/* Officer list — select one */}
        <div className="flex max-h-[min(780px,calc(100vh-220px))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="shrink-0 space-y-3 border-b border-slate-100 p-4 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Select loan officer
              </h2>
              <p className="text-xs text-slate-500">
                {officerTotal === 0
                  ? "0 officers"
                  : `${officerRangeStart}–${officerRangeEnd} of ${officerTotal}`}{" "}
                · click to view activity
              </p>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={officerSearch}
                onChange={(e) => setOfficerSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-9 text-sm outline-none transition focus:border-[#13538A] focus:bg-white focus:ring-2 focus:ring-[#13538A]/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              {(isSearchPending || loadingOfficers) && (
                <RefreshCw className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
              )}
            </div>
          </div>

          <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto p-3">
            {loadingOfficers && officers.length === 0 ? (
              <div className="space-y-2 p-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[88px] animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"
                  />
                ))}
              </div>
            ) : officers.length === 0 ? (
              <div className="px-3 py-10 text-center text-sm text-slate-500">
                {debouncedSearch
                  ? "No officers match your search."
                  : "No loan officers found."}
              </div>
            ) : (
              officers.map((officer) => {
                const isSelected = selectedOfficerId === officer.id;
                return (
                  <button
                    key={officer.id}
                    type="button"
                    onClick={() => {
                      setSelectedOfficerId(officer.id);
                      setSelectedOfficer(officer);
                    }}
                    className={`w-full rounded-xl border p-3.5 text-left transition ${
                      isSelected
                        ? "border-[#13538A] bg-[#13538A]/8 ring-2 ring-[#13538A]/20 dark:bg-[#13538A]/15"
                        : "border-slate-200 bg-white hover:border-[#13538A]/40 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarTone(officer.name)}`}
                      >
                        {getInitials(officer.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900 dark:text-white">
                              {officer.name}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {officer.email}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              officer.status === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {officer.status}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-slate-800/70">
                            <p className="text-[10px] uppercase tracking-wide text-slate-400">
                              Apps
                            </p>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                              {officer.assignedApplications}
                            </p>
                          </div>
                          <div className="rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-slate-800/70">
                            <p className="text-[10px] uppercase tracking-wide text-slate-400">
                              Contacts
                            </p>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                              {officer.contactsCreated}
                            </p>
                          </div>
                        </div>

                        <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-400">
                          <Clock3 className="h-3 w-3" />
                          {formatRelative(officer.lastActivityAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {officerTotalPages > 1 && (
            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 px-3 py-3 dark:border-slate-800">
              <button
                type="button"
                disabled={officerPage <= 1 || loadingOfficers}
                onClick={() => setOfficerPage((p) => Math.max(1, p - 1))}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </button>
              <span className="text-xs font-medium text-slate-500">
                {officerPage} / {officerTotalPages}
              </span>
              <button
                type="button"
                disabled={officerPage >= officerTotalPages || loadingOfficers}
                onClick={() =>
                  setOfficerPage((p) => Math.min(officerTotalPages, p + 1))
                }
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Selected officer activity */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-slate-900 dark:text-white">
                {displayOfficer
                  ? `${displayOfficer.name}'s activity`
                  : "Officer activity"}
              </h2>
              <p className="text-sm text-slate-500">
                {displayOfficer
                  ? `${displayOfficer.email} · ${total} recorded event${total === 1 ? "" : "s"}`
                  : "Choose a loan officer from the list to see their full timeline."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {displayOfficer && (
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/submit-applications?q=${encodeURIComponent(displayOfficer.name)}`,
                    )
                  }
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <FileText className="h-4 w-4" />
                  Pipeline
                </button>
              )}
              <Link
                to="/admin-logs?loanOfficersOnly=1"
                className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-[#13538A] transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-sky-300"
              >
                Full audit trail
              </Link>
              <button
                type="button"
                onClick={() => {
                  fetchOfficerRoster();
                  fetchActivity();
                }}
                disabled={loading}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-[#13538A]/40 hover:text-[#13538A] disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>
          </div>

          {!selectedOfficerId ? (
            <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#13538A]/10 text-[#13538A]">
                <Users className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-800 dark:text-white">
                Select a loan officer
              </h3>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                Pick an officer on the left to load their complete activity —
                applications, contacts, messages, and profile updates.
              </p>
            </div>
          ) : loadingActivity ? (
            <ActivitySkeleton />
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
                onClick={() => fetchActivity()}
                className="mt-4 rounded-xl bg-[#13538A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f4573]"
              >
                Try again
              </button>
            </div>
          ) : activity.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                <Activity className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-800 dark:text-white">
                No activity yet
              </h3>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                {displayOfficer
                  ? `${displayOfficer.name} has no recorded actions yet.`
                  : "Loan officer actions will appear here as they work."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {activity.map((item) => {
                const actorName =
                  item.officer?.name || displayOfficer?.name || "Loan officer";
                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 px-5 py-4 transition hover:bg-slate-50/80 sm:flex-row sm:items-start sm:justify-between dark:hover:bg-slate-800/40"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarTone(actorName)}`}
                      >
                        {getInitials(actorName)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${actionTone(item.action)}`}
                          >
                            {humanizeLabel(item.action)}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            {humanizeLabel(item.category)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                          {humanizeLabel(item.entityType)}
                          <span className="ml-1.5 font-mono text-xs font-normal text-slate-400">
                            {shortId(item.entityId)}
                          </span>
                        </p>
                        <ActivityDetail item={item} />
                        {item.ipAddress ? (
                          <p className="mt-1 text-[11px] text-slate-400">
                            IP {item.ipAddress}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="shrink-0 text-left sm:text-right">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {formatRelative(item.createdAt)}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {formatDateTime(item.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {selectedOfficerId && total > 0 && (
            <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Showing{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {rangeStart}
                </span>
                –
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {rangeEnd}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {total}
                </span>
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loadingActivity}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </button>
                <span className="min-w-[5rem] text-center text-sm font-medium text-slate-600 dark:text-slate-300">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages || loadingActivity}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoanOfficerActivityPage() {
  const location = useLocation();
  const fromState = (location.state as { officerId?: string } | null)?.officerId;
  return (
    <Navigate
      to="/loan-officers?tab=activity"
      replace
      state={fromState ? { officerId: fromState } : null}
    />
  );
}
