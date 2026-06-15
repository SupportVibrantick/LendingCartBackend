import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  UserCog,
  X,
} from "lucide-react";
import {
  fetchBrokerLoanOfficerActivity,
  type LoanOfficerActivityItem,
  type LoanOfficerActivitySummary,
} from "../../lib/brokerDetailApi";

type Props = {
  brokerId: string;
  onClose: () => void;
  initialOfficerId?: string;
  initialOfficerName?: string;
};

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
  return formatDateTime(value);
}

function actionTone(action: string) {
  const upper = action.toUpperCase();
  if (upper.includes("DELETE")) return "bg-rose-50 text-rose-700 border-rose-200";
  if (upper.includes("CREATE") || upper.includes("SUBMIT"))
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (upper.includes("UPDATE") || upper.includes("EDIT"))
    return "bg-blue-50 text-blue-700 border-blue-200";
  if (upper.includes("MESSAGE")) return "bg-cyan-50 text-cyan-700 border-cyan-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export default function LoanOfficerActivityModal({
  brokerId,
  onClose,
  initialOfficerId,
  initialOfficerName,
}: Props) {
  const [officers, setOfficers] = useState<LoanOfficerActivitySummary[]>([]);
  const [activity, setActivity] = useState<LoanOfficerActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedOfficerId, setSelectedOfficerId] = useState(initialOfficerId || "");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const loadActivity = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const json = await fetchBrokerLoanOfficerActivity(brokerId, {
        officerId: selectedOfficerId || undefined,
        page,
        limit: 20,
      });
      setOfficers(json.data?.officers || []);
      setActivity(json.data?.activity || []);
      setTotal(json.total ?? 0);
      setTotalPages(json.totalPages ?? 1);
    } catch (err: any) {
      setError(err.message || "Failed to load activity");
      setOfficers([]);
      setActivity([]);
    } finally {
      setLoading(false);
    }
  }, [brokerId, page, selectedOfficerId]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  useEffect(() => {
    setPage(1);
  }, [selectedOfficerId]);

  const selectedOfficer = useMemo(
    () => officers.find((o) => o.id === selectedOfficerId) || null,
    [officers, selectedOfficerId],
  );

  const titleName =
    selectedOfficer?.name || initialOfficerName || (selectedOfficerId ? "Loan Officer" : "All Officers");

  const totals = useMemo(
    () => ({
      officers: officers.length,
      applications: officers.reduce((sum, o) => sum + o.assignedApplications, 0),
      contacts: officers.reduce((sum, o) => sum + o.contactsCreated, 0),
    }),
    [officers],
  );

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="h-1 bg-gradient-to-r from-[#13538A] via-[#18B6B4] to-emerald-400 opacity-80" />

        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#13538A]/10 text-[#13538A]">
              <Activity size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Loan Officer Activity</h3>
              <p className="text-[11px] text-slate-500">
                {selectedOfficerId ? `${titleName}'s audit trail` : "All loan officers for this broker"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadActivity()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <div className="mb-3 flex flex-wrap gap-2">
            {[
              { label: "Officers", value: totals.officers },
              { label: "Assigned apps", value: totals.applications },
              { label: "Contacts", value: totals.contacts },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800/60"
              >
                <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">{stat.label}</p>
                <p className="text-sm font-bold text-[#13538A]">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedOfficerId("")}
              className={`rounded-full px-3 py-1 text-[10px] font-semibold transition ${
                !selectedOfficerId
                  ? "bg-[#13538A] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              All officers
            </button>
            {officers.map((officer) => (
              <button
                key={officer.id}
                type="button"
                onClick={() => setSelectedOfficerId(officer.id)}
                className={`rounded-full px-3 py-1 text-[10px] font-semibold transition ${
                  selectedOfficerId === officer.id
                    ? "bg-[#13538A] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {officer.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid flex-1 gap-4 overflow-hidden p-5 lg:grid-cols-[280px_1fr]">
          <div className="hidden max-h-[50vh] space-y-2 overflow-y-auto lg:block">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Officer overview</p>
            {officers.map((officer) => (
              <button
                key={officer.id}
                type="button"
                onClick={() => setSelectedOfficerId(officer.id)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selectedOfficerId === officer.id
                    ? "border-[#13538A]/30 bg-[#13538A]/5 ring-1 ring-[#13538A]/20"
                    : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-slate-900 dark:text-white">
                      {officer.name}
                    </p>
                    <p className="truncate text-[10px] text-slate-500">{officer.email}</p>
                  </div>
                  <UserCog size={14} className="shrink-0 text-slate-400" />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-slate-500">
                  <span>{officer.assignedApplications} apps</span>
                  <span>{officer.contactsCreated} contacts</span>
                  <span className="col-span-2">Active {formatRelative(officer.lastActivityAt)}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                {selectedOfficerId ? `${titleName}'s activity` : "Recent activity"}
              </h4>
              <p className="text-[10px] text-slate-500">
                {total} recorded event{total === 1 ? "" : "s"}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-16 text-xs text-slate-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#13538A]" />
                  Loading activity...
                </div>
              ) : error ? (
                <div className="px-4 py-12 text-center text-[11px] font-medium text-red-600">{error}</div>
              ) : !activity.length ? (
                <div className="px-4 py-12 text-center text-xs text-slate-500">
                  No loan officer activity recorded yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activity.map((item) => (
                    <div key={item.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${actionTone(item.action)}`}
                            >
                              {item.action.replace(/_/g, " ")}
                            </span>
                            <span className="text-[10px] text-slate-400">{item.category}</span>
                          </div>
                          <p className="mt-1.5 text-[11px] font-medium text-slate-800 dark:text-slate-100">
                            {item.entityType} · {item.entityId.slice(0, 8)}…
                          </p>
                          {item.officer ? (
                            <p className="mt-0.5 text-[10px] text-slate-500">
                              by {item.officer.name} ({item.officer.email})
                            </p>
                          ) : null}
                        </div>
                        <div className="text-right text-[10px] text-slate-500">
                          <p>{formatDateTime(item.createdAt)}</p>
                          <p className="mt-0.5">{formatRelative(item.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-slate-600 disabled:opacity-40"
                >
                  <ChevronLeft size={14} />
                  Previous
                </button>
                <span className="text-[10px] text-slate-500">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-slate-600 disabled:opacity-40"
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-100 px-5 py-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-4 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
