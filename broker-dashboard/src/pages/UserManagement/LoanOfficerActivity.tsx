import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  Activity,
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
import PageMeta from "../../components/common/PageMeta";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

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
  if (upper.includes("CREATE") || upper.includes("SUBMIT") || upper.includes("ADD"))
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
  const queryId = new URLSearchParams(location.search).get("officer");
  return stateId || queryId || "";
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

export default function LoanOfficerActivityPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [officers, setOfficers] = useState<OfficerSummary[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOfficerId, setSelectedOfficerId] = useState(() =>
    readOfficerIdFromLocation(location),
  );
  const [officerSearch, setOfficerSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (selectedOfficerId) params.set("officerId", selectedOfficerId);

      const res = await fetch(
        `${API_BASE}/broker/loan-officer-activity?${params.toString()}`,
        { headers: getAuthHeaders() },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load loan officer activity");
      }

      setOfficers(json.data?.officers || []);
      setActivity(json.data?.activity || []);
      setTotal(json.total ?? 0);
      setTotalPages(json.totalPages ?? 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load activity");
      setOfficers([]);
      setActivity([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, limit, selectedOfficerId]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  useEffect(() => {
    setPage(1);
  }, [selectedOfficerId]);

  useEffect(() => {
    const hasQuery = new URLSearchParams(location.search).has("officer");
    const hasState = !!(location.state as { officerId?: string } | null)
      ?.officerId;
    if (hasQuery || hasState) {
      navigate("/loan-officer-activity", { replace: true, state: null });
    }
  }, [location.search, location.state, navigate]);

  const selectedOfficer = useMemo(
    () => officers.find((o) => o.id === selectedOfficerId) || null,
    [officers, selectedOfficerId],
  );

  const filteredOfficers = useMemo(() => {
    const q = officerSearch.trim().toLowerCase();
    if (!q) return officers;
    return officers.filter(
      (officer) =>
        officer.name.toLowerCase().includes(q) ||
        officer.email.toLowerCase().includes(q),
    );
  }, [officers, officerSearch]);

  const totals = useMemo(
    () => ({
      officers: officers.length,
      applications: officers.reduce(
        (sum, o) => sum + o.assignedApplications,
        0,
      ),
      contacts: officers.reduce((sum, o) => sum + o.contactsCreated, 0),
      activeToday: officers.filter((o) => {
        if (!o.lastActivityAt) return false;
        return (
          new Date(o.lastActivityAt).toDateString() === new Date().toDateString()
        );
      }).length,
    }),
    [officers],
  );

  const rangeStart = activity.length === 0 ? 0 : (page - 1) * limit + 1;
  const rangeEnd = Math.min(page * limit, total);

  return (
    <>
      <PageMeta
        title="Loan Officer Activity | Broker Dashboard"
        description="Monitor loan officer pipeline, contacts, and audit activity"
      />

      <div className="mx-auto w-full max-w-7xl space-y-5">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#13538A] via-[#18B6B4] to-emerald-400" />
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#13538A]/5 blur-2xl dark:bg-[#13538A]/10" />

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
                  Track applications, contacts, messages, and profile updates
                  across your loan officer team.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                { label: "Officers", value: totals.officers, icon: Users },
                {
                  label: "Assigned",
                  value: totals.applications,
                  icon: FileText,
                },
                { label: "Contacts", value: totals.contacts, icon: Mail },
                { label: "Active today", value: totals.activeToday, icon: Activity },
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
                    {loading && officers.length === 0 ? "—" : value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
          {/* Officer list */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="space-y-3 border-b border-slate-100 p-4 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Officers
                  </h2>
                  <p className="text-xs text-slate-500">
                    {filteredOfficers.length} of {officers.length}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOfficerId("")}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    !selectedOfficerId
                      ? "bg-[#13538A] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  All
                </button>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={officerSearch}
                  onChange={(e) => setOfficerSearch(e.target.value)}
                  placeholder="Search officers..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-[#13538A] focus:bg-white focus:ring-2 focus:ring-[#13538A]/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div className="custom-scrollbar max-h-[640px] space-y-2 overflow-y-auto p-3">
              {filteredOfficers.length === 0 ? (
                <div className="px-3 py-10 text-center text-sm text-slate-500">
                  No officers match your search.
                </div>
              ) : (
                filteredOfficers.map((officer) => {
                  const isSelected = selectedOfficerId === officer.id;
                  return (
                    <button
                      key={officer.id}
                      type="button"
                      onClick={() => setSelectedOfficerId(officer.id)}
                      className={`w-full rounded-xl border p-3.5 text-left transition ${
                        isSelected
                          ? "border-[#13538A]/35 bg-[#13538A]/5 ring-1 ring-[#13538A]/15 dark:bg-[#13538A]/10"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/60"
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
          </div>

          {/* Activity feed */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-slate-900 dark:text-white">
                  {selectedOfficer
                    ? `${selectedOfficer.name}'s activity`
                    : "Recent team activity"}
                </h2>
                <p className="text-sm text-slate-500">
                  {selectedOfficer
                    ? selectedOfficer.email
                    : `${total} recorded event${total === 1 ? "" : "s"}`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedOfficer && (
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/submit-applications?q=${encodeURIComponent(selectedOfficer.name)}`,
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
                  onClick={() => fetchActivity()}
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

            {loading ? (
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
                  {selectedOfficer
                    ? `${selectedOfficer.name} has no recorded actions yet.`
                    : "Loan officer actions will appear here as your team works applications and contacts."}
                </p>
                {selectedOfficerId && (
                  <button
                    type="button"
                    onClick={() => setSelectedOfficerId("")}
                    className="mt-3 text-sm font-medium text-[#13538A] hover:underline dark:text-sky-400"
                  >
                    View all officers
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {activity.map((item) => {
                  const actorName = item.officer?.name || "Loan officer";
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
                          {item.officer && (
                            <p className="mt-1 truncate text-xs text-slate-500">
                              by {item.officer.name}
                              <span className="text-slate-400">
                                {" "}
                                · {item.officer.email}
                              </span>
                            </p>
                          )}
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

            {total > 0 && (
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
                    disabled={page <= 1 || loading}
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
                    disabled={page >= totalPages || loading}
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
    </>
  );
}
