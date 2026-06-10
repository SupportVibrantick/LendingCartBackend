import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  FileText,
  Mail,
  RefreshCw,
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
  return formatDateTime(value);
}

function actionTone(action: string) {
  const upper = action.toUpperCase();
  if (upper.includes("DELETE")) return "bg-rose-50 text-rose-700";
  if (upper.includes("CREATE") || upper.includes("SUBMIT"))
    return "bg-emerald-50 text-emerald-700";
  if (upper.includes("UPDATE") || upper.includes("EDIT"))
    return "bg-blue-50 text-blue-700";
  if (upper.includes("MESSAGE")) return "bg-cyan-50 text-cyan-700";
  return "bg-slate-100 text-slate-700";
}

function readOfficerIdFromLocation(location: ReturnType<typeof useLocation>) {
  const stateId = (location.state as { officerId?: string } | null)?.officerId;
  const queryId = new URLSearchParams(location.search).get("officer");
  return stateId || queryId || "";
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
    const hasState = !!(location.state as { officerId?: string } | null)?.officerId;
    if (hasQuery || hasState) {
      navigate("/loan-officer-activity", { replace: true, state: null });
    }
  }, [location.search, location.state, navigate]);

  const selectedOfficer = useMemo(
    () => officers.find((o) => o.id === selectedOfficerId) || null,
    [officers, selectedOfficerId],
  );

  const totals = useMemo(
    () => ({
      officers: officers.length,
      applications: officers.reduce((sum, o) => sum + o.assignedApplications, 0),
      contacts: officers.reduce((sum, o) => sum + o.contactsCreated, 0),
      activeToday: officers.filter((o) => {
        if (!o.lastActivityAt) return false;
        return new Date(o.lastActivityAt).toDateString() === new Date().toDateString();
      }).length,
    }),
    [officers],
  );

  return (
    <>
      <PageMeta
        title="Loan Officer Activity | Broker Dashboard"
        description="Monitor loan officer pipeline, contacts, and audit activity"
      />

      <div className="space-y-6">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#2C92D5] p-6 text-white shadow-sm dark:border-gray-800">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                <UserCog className="h-3.5 w-3.5" />
                Team Oversight
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Loan Officer Activity
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-white/80">
                View all loan officer actions — applications, contacts, messages,
                and profile updates across your brokerage.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Officers", value: totals.officers, icon: Users },
                { label: "Assigned Apps", value: totals.applications, icon: FileText },
                { label: "Contacts", value: totals.contacts, icon: Mail },
                { label: "Active Today", value: totals.activeToday, icon: Activity },
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

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedOfficerId("")}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  !selectedOfficerId
                    ? "bg-[#13538A] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                }`}
              >
                All Officers
              </button>
              {officers.map((officer) => (
                <button
                  key={officer.id}
                  type="button"
                  onClick={() => setSelectedOfficerId(officer.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    selectedOfficerId === officer.id
                      ? "bg-[#13538A] text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                >
                  {officer.name}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/admin-logs?loanOfficersOnly=1"
                className="text-xs font-medium text-[#13538A] hover:underline"
              >
                Full audit trail
              </Link>
              <button
                type="button"
                onClick={() => fetchActivity()}
                disabled={loading}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-gray-500">
              Officer Overview
            </h2>
            {officers.map((officer) => (
              <button
                key={officer.id}
                type="button"
                onClick={() => setSelectedOfficerId(officer.id)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  selectedOfficerId === officer.id
                    ? "border-[#13538A]/30 bg-[#13538A]/5 ring-2 ring-[#13538A]/10"
                    : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {officer.name}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">{officer.email}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      officer.status === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {officer.status}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <span>{officer.assignedApplications} applications</span>
                  <span>{officer.contactsCreated} contacts</span>
                  <span className="col-span-2">
                    Last active: {formatRelative(officer.lastActivityAt)}
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/submit-applications?q=${encodeURIComponent(officer.name)}`);
                    }}
                    className="text-xs font-medium text-[#13538A] hover:underline"
                  >
                    View pipeline
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedOfficerId(officer.id);
                    }}
                    className="text-xs font-medium text-[#13538A] hover:underline"
                  >
                    Activity
                  </button>
                </div>
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {selectedOfficer
                  ? `${selectedOfficer.name}'s Activity`
                  : "Recent Activity"}
              </h2>
              <p className="text-sm text-gray-500">
                {total} recorded event{total === 1 ? "" : "s"}
              </p>
            </div>

            {loading ? (
              <div className="py-16 text-center text-sm text-gray-500">Loading activity...</div>
            ) : error ? (
              <div className="py-16 text-center">
                <p className="font-medium text-red-500">{error}</p>
              </div>
            ) : activity.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-500">
                No loan officer activity recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {activity.map((item) => (
                  <div key={item.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${actionTone(item.action)}`}
                          >
                            {item.action.replace(/_/g, " ")}
                          </span>
                          <span className="text-xs text-gray-400">{item.category}</span>
                        </div>
                        <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                          {item.entityType} · {item.entityId.slice(0, 8)}...
                        </p>
                        {item.officer && (
                          <p className="mt-1 text-xs text-gray-500">
                            by {item.officer.name} ({item.officer.email})
                          </p>
                        )}
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        <p>{formatDateTime(item.createdAt)}</p>
                        <p className="mt-1">{formatRelative(item.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4 dark:border-gray-800">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-gray-600 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <span className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-gray-600 disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
