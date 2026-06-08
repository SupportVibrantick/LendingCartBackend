import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import {
  Briefcase,
  Building2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import { adminFetch, type PaginatedResponse } from "../../lib/adminApi";

type LoanOfficerRow = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  brokerName?: string;
  assignedDeals?: number;
  lastLoginAt?: string;
  createdAt?: string;
  status?: string;
};

const AVATAR_TONES = [
  "bg-violet-100 text-violet-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
];

function getInitials(first?: string, last?: string, email?: string) {
  const name = [first, last].filter(Boolean).join(" ");
  if (name) {
    return name
      .split(" ")
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");
  }
  return email?.[0]?.toUpperCase() || "?";
}

function getAvatarTone(seed?: string) {
  if (!seed) return AVATAR_TONES[0];
  const index = seed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_TONES[index % AVATAR_TONES.length];
}

function formatRelativeTime(value?: string) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-4 px-5 py-4">
          <div className="h-11 w-11 rounded-full bg-slate-100 dark:bg-slate-800" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-40 rounded bg-slate-100 dark:bg-slate-800" />
            <div className="h-2.5 w-56 rounded bg-slate-100 dark:bg-slate-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AllLoanOfficers() {
  const [rows, setRows] = useState<LoanOfficerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [rowLoadingId, setRowLoadingId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter) params.set("status", statusFilter);

      const json = await adminFetch<PaginatedResponse<LoanOfficerRow[]>>(
        `/admin/loan-officers?${params.toString()}`,
      );
      setRows(json.data || []);
      setTotalPages(json.meta?.totalPages || 1);
      setTotal(json.meta?.total ?? json.data?.length ?? 0);
    } catch (err: any) {
      toast.error(err.message || "Failed to load loan officers");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const stats = useMemo(() => {
    const active = rows.filter((row) => row.status === "ACTIVE").length;
    const deals = rows.reduce((sum, row) => sum + (row.assignedDeals || 0), 0);
    const loggedIn = rows.filter((row) => row.lastLoginAt).length;
    return { active, deals, loggedIn };
  }, [rows]);

  const toggleStatus = async (row: LoanOfficerRow) => {
    const active = row.status === "ACTIVE";
    setRowLoadingId(row.id);
    try {
      await adminFetch(`/admin/loan-officers/${row.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: active ? "DISABLED" : "ACTIVE" }),
      });
      toast.success(active ? "Loan officer suspended" : "Loan officer activated");
      fetchRows();
    } catch (err: any) {
      toast.error(err.message || "Status update failed");
    } finally {
      setRowLoadingId(null);
    }
  };

  const removeRow = async (row: LoanOfficerRow) => {
    const name = [row.firstName, row.lastName].filter(Boolean).join(" ") || row.email;
    const result = await Swal.fire({
      title: "Remove loan officer?",
      text: `${name} will be soft-deleted from the platform.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
    });

    if (!result.isConfirmed) return;

    setRowLoadingId(row.id);
    try {
      await adminFetch(`/admin/loan-officers/${row.id}`, { method: "DELETE" });
      toast.success("Loan officer removed");
      fetchRows();
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
    } finally {
      setRowLoadingId(null);
    }
  };

  return (
    <>
      <PageMeta
        title="Loan Officers"
        description="Platform-wide loan officer accounts across all broker organizations"
      />

      <div className="space-y-6">
        {/* Header */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#5D28A8] p-6 text-white shadow-lg dark:border-slate-800">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                <UserCog className="h-3.5 w-3.5" />
                Platform Admin · Loan Officers
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">Loan Officers</h1>
              <p className="mt-1 max-w-2xl text-sm text-white/80">
                Manage loan officer accounts across all broker organizations — view assignments,
                activity, and account status.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Total", value: total, icon: Users },
                { label: "Active", value: stats.active, icon: Shield },
                { label: "Assigned Deals", value: stats.deals, icon: Briefcase },
                { label: "Logged In", value: stats.loggedIn, icon: UserCog },
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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none focus:border-[#13538A]/40 focus:ring-2 focus:ring-[#13538A]/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[
                { label: "All", value: "" },
                { label: "Active", value: "ACTIVE" },
                { label: "Suspended", value: "DISABLED" },
              ].map(({ label, value }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    statusFilter === value
                      ? "bg-[#13538A] text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}

              <button
                type="button"
                onClick={() => fetchRows()}
                disabled={loading}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {loading ? (
            <TableSkeleton />
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="rounded-full bg-violet-100 p-4 text-violet-600 dark:bg-violet-500/10">
                <UserCog className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
                No loan officers found
              </h3>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                {search || statusFilter
                  ? "Try adjusting your search or status filter."
                  : "Loan officers will appear here once brokers create them."}
              </p>
            </div>
          ) : (
            <>
              <div className="custom-scrollbar overflow-x-auto">
                <table className="min-w-[920px] w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50/95 text-left text-xs uppercase tracking-wider text-slate-500 backdrop-blur dark:bg-slate-950/95">
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="px-5 py-3.5 font-semibold">Loan Officer</th>
                      <th className="px-5 py-3.5 font-semibold">Broker</th>
                      <th className="px-5 py-3.5 font-semibold">Assigned Deals</th>
                      <th className="px-5 py-3.5 font-semibold">Last Login</th>
                      <th className="px-5 py-3.5 font-semibold">Status</th>
                      <th className="px-5 py-3.5 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {rows.map((row) => {
                      const fullName =
                        [row.firstName, row.lastName].filter(Boolean).join(" ") || "—";
                      const isActive = row.status === "ACTIVE";
                      const busy = rowLoadingId === row.id;

                      return (
                        <tr
                          key={row.id}
                          className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${getAvatarTone(row.email)}`}
                              >
                                {getInitials(row.firstName, row.lastName, row.email)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 dark:text-white">
                                  {fullName}
                                </p>
                                <p className="flex items-center gap-1 truncate text-xs text-slate-500">
                                  <Mail className="h-3 w-3 shrink-0" />
                                  {row.email}
                                </p>
                                {row.phone && (
                                  <p className="text-[11px] text-slate-400">{row.phone}</p>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
                              <Building2 className="h-4 w-4 text-slate-400" />
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                {row.brokerName || "—"}
                              </span>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex min-w-[2rem] items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                                (row.assignedDeals || 0) > 0
                                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                              }`}
                            >
                              {row.assignedDeals ?? 0}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                              {formatRelativeTime(row.lastLoginAt)}
                            </p>
                            {row.lastLoginAt && (
                              <p className="text-[11px] text-slate-400">
                                {new Date(row.lastLoginAt).toLocaleString()}
                              </p>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                                isActive
                                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300"
                                  : "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300"
                              }`}
                            >
                              {isActive ? "Active" : row.status || "Inactive"}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => toggleStatus(row)}
                                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                                  isActive
                                    ? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                                    : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                                }`}
                              >
                                {busy ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : isActive ? (
                                  "Suspend"
                                ) : (
                                  "Activate"
                                )}
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => removeRow(row)}
                                className="rounded-xl border border-red-200 bg-red-50 p-2 text-red-600 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/80 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/80 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500">
                  Page{" "}
                  <span className="font-semibold text-slate-800 dark:text-white">{page}</span> of{" "}
                  <span className="font-semibold text-slate-800 dark:text-white">
                    {totalPages}
                  </span>
                  {" · "}
                  <span className="font-semibold text-slate-800 dark:text-white">{total}</span>{" "}
                  loan officers
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950"
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
    </>
  );
}
