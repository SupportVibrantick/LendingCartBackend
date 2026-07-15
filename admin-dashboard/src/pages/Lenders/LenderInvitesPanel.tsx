import { useEffect, useRef, useState } from "react";
import {
  RefreshCcw,
  Mail,
  Ban,
  Trash2,
  RotateCcw,
  Download,
  Upload,
  ChevronLeft,
  ChevronRight,
  Search,
  SearchX,
  Users,
  Clock3,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";
import Swal from "sweetalert2";

type InviteStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "EXPIRED"
  | "CANCELLED";

type LenderInvite = {
  id: string;
  companyName: string;
  fullName: string;
  email: string;
  phone?: string | null;
  status: InviteStatus;
  lastSentAt: string;
  createdAt: string;
  expiresAt: string;
};

type InviteMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
  all?: number;
  pending?: number;
  accepted?: number;
  declined?: number;
  expired?: number;
  cancelled?: number;
};

type Props = {
  apiBase: string;
  getAuthHeaders: () => Record<string, string>;
  onBulkInvite?: () => void;
};

function authHeadersOnly(getAuthHeaders: () => Record<string, string>) {
  const headers = { ...getAuthHeaders() };
  delete headers["Content-Type"];
  return headers;
}

function statusClass(status: InviteStatus) {
  switch (status) {
    case "PENDING":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "ACCEPTED":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "DECLINED":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "EXPIRED":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "CANCELLED":
      return "bg-rose-100 text-rose-800 border-rose-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function formatRelative(dateStr?: string) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default function LenderInvitesPanel({
  apiBase,
  getAuthHeaders,
  onBulkInvite,
}: Props) {
  const [invites, setInvites] = useState<LenderInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [meta, setMeta] = useState<InviteMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
    all: 0,
    pending: 0,
    accepted: 0,
    declined: 0,
    expired: 0,
    cancelled: 0,
  });
  const [exporting, setExporting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const fetchInvites = async (
    overrides?: Partial<{
      page: number;
      limit: number;
      status: string;
      search: string;
    }>,
  ) => {
    const nextPage = overrides?.page ?? page;
    const nextLimit = overrides?.limit ?? limit;
    const nextStatus = overrides?.status ?? statusFilter;
    const nextSearch = (overrides?.search ?? search).trim();
    const requestId = ++requestIdRef.current;

    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("limit", String(nextLimit));
      if (nextStatus && nextStatus !== "ALL") {
        params.set("status", nextStatus);
      }
      if (nextSearch) {
        params.set("search", nextSearch);
      }

      const res = await fetch(
        `${apiBase}/admin/invite-lenders?${params.toString()}`,
        { headers: authHeadersOnly(getAuthHeaders) },
      );
      const json = await res.json().catch(() => ({}));

      // Ignore stale responses
      if (requestId !== requestIdRef.current) return;

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load invitations");
      }

      setInvites(Array.isArray(json.data) ? json.data : []);
      setMeta({
        page: Number(json.meta?.page) || nextPage,
        limit: Number(json.meta?.limit) || nextLimit,
        total: Number(json.meta?.total) || 0,
        totalPages: Number(json.meta?.totalPages) || 1,
        hasNextPage: Boolean(json.meta?.hasNextPage),
        hasPrevPage: Boolean(json.meta?.hasPrevPage),
        all: Number(json.meta?.all ?? json.meta?.total) || 0,
        pending: Number(json.meta?.pending) || 0,
        accepted: Number(json.meta?.accepted) || 0,
        declined: Number(json.meta?.declined) || 0,
        expired: Number(json.meta?.expired) || 0,
        cancelled: Number(json.meta?.cancelled) || 0,
      });
    } catch (err: any) {
      if (requestId !== requestIdRef.current) return;
      toast.error(err.message || "Failed to load invitations");
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchInvites({ page, limit, status: statusFilter, search });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, statusFilter, search]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const next = searchInput.trim();
      setPage(1);
      setSearch(next);
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const applySearch = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const next = searchInput.trim();
    setPage(1);
    setSearch(next);
    fetchInvites({ page: 1, search: next, status: statusFilter, limit });
  };

  const clearSearch = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchInput("");
    setPage(1);
    setSearch("");
    fetchInvites({ page: 1, search: "", status: statusFilter, limit });
  };

  const setStatus = (nextStatus: string) => {
    setPage(1);
    setStatusFilter(nextStatus);
  };

  const exportCsv = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }
      const qs = params.toString();
      const res = await fetch(
        `${apiBase}/admin/invite-lenders/export${qs ? `?${qs}` : ""}`,
        { headers: authHeadersOnly(getAuthHeaders) },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || "Failed to export CSV");
      }
      const text = await res.text();
      const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "lender-invitations.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("CSV exported");
    } catch (err: any) {
      toast.error(err.message || "Failed to export");
    } finally {
      setExporting(false);
    }
  };

  const handleResend = async (invite: LenderInvite) => {
    const confirm = await Swal.fire({
      title: "Resend invitation?",
      text: `Send a new invite email to ${invite.email}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Resend",
    });
    if (!confirm.isConfirmed) return;

    try {
      const res = await fetch(
        `${apiBase}/admin/invite-lenders/${invite.id}/resend`,
        {
          method: "POST",
          headers: {
            ...authHeadersOnly(getAuthHeaders),
            "Content-Type": "application/json",
          },
          body: "{}",
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to resend");
      }
      toast.success("Invitation resent");
      fetchInvites();
    } catch (err: any) {
      toast.error(err.message || "Failed to resend");
    }
  };

  const handleCancel = async (invite: LenderInvite) => {
    const confirm = await Swal.fire({
      title: "Cancel invitation?",
      text: "The invite link will stop working.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Cancel Invite",
      confirmButtonColor: "#dc2626",
    });
    if (!confirm.isConfirmed) return;

    try {
      const res = await fetch(
        `${apiBase}/admin/invite-lenders/${invite.id}/cancel`,
        {
          method: "POST",
          headers: {
            ...authHeadersOnly(getAuthHeaders),
            "Content-Type": "application/json",
          },
          body: "{}",
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to cancel");
      }
      toast.success("Invitation cancelled");
      fetchInvites();
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel");
    }
  };

  const handleDelete = async (invite: LenderInvite) => {
    const confirm = await Swal.fire({
      title: "Delete invitation?",
      text: "This cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      confirmButtonColor: "#dc2626",
    });
    if (!confirm.isConfirmed) return;

    try {
      const res = await fetch(`${apiBase}/admin/invite-lenders/${invite.id}`, {
        method: "DELETE",
        headers: authHeadersOnly(getAuthHeaders),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to delete");
      }
      toast.success("Invitation deleted");
      if (invites.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        fetchInvites();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);

  const stats = [
    {
      key: "ALL",
      label: "Total",
      value: meta.all ?? 0,
      icon: Users,
      tone: "bg-violet-600",
      active: statusFilter === "ALL",
    },
    {
      key: "PENDING",
      label: "Pending",
      value: meta.pending ?? 0,
      icon: Clock3,
      tone: "bg-amber-500",
      active: statusFilter === "PENDING",
    },
    {
      key: "ACCEPTED",
      label: "Accepted",
      value: meta.accepted ?? 0,
      icon: CheckCircle2,
      tone: "bg-emerald-600",
      active: statusFilter === "ACCEPTED",
    },
    {
      key: "DECLINED",
      label: "Declined",
      value: meta.declined ?? 0,
      icon: XCircle,
      tone: "bg-slate-500",
      active: statusFilter === "DECLINED",
    },
    {
      key: "EXPIRED",
      label: "Expired",
      value: meta.expired ?? 0,
      icon: AlertTriangle,
      tone: "bg-orange-500",
      active: statusFilter === "EXPIRED",
    },
    {
      key: "CANCELLED",
      label: "Cancelled",
      value: meta.cancelled ?? 0,
      icon: Ban,
      tone: "bg-rose-600",
      active: statusFilter === "CANCELLED",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <button
              key={stat.key}
              type="button"
              onClick={() => setStatus(stat.key)}
              className={`rounded-2xl border p-4 text-left transition ${
                stat.active
                  ? "border-[#13538A] bg-blue-50 ring-1 ring-[#13538A]/30 dark:bg-slate-800"
                  : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {stat.label}
                  </p>
                  <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
                    {stat.value}
                  </p>
                </div>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-white ${stat.tone}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Lender Invitations
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {search
                ? `Filtered by "${search}"`
                : "Track pending, accepted, expired, and declined invites."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onBulkInvite && (
              <button
                type="button"
                onClick={onBulkInvite}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700"
              >
                <Upload size={13} />
                Bulk Invite
              </button>
            )}
            <button
              type="button"
              onClick={exportCsv}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
            >
              <Download size={13} />
              {exporting ? "Exporting..." : "Export CSV"}
            </button>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search
                  size={13}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applySearch();
                    }
                  }}
                  placeholder="Search company / name / email / phone"
                  className="w-64 rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-8 text-xs dark:border-slate-700 dark:bg-slate-900"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    title="Clear search"
                  >
                    <SearchX size={13} />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={applySearch}
                className="rounded-lg bg-[#13538A] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0f4370]"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() =>
                  fetchInvites({
                    page,
                    limit,
                    status: statusFilter,
                    search,
                  })
                }
                disabled={loading}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700"
                title="Refresh"
              >
                <RefreshCcw
                  size={14}
                  className={loading ? "animate-spin" : ""}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950/50">
              <tr>
                <th className="px-5 py-3 font-semibold">Company</th>
                <th className="px-5 py-3 font-semibold">Email</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Sent</th>
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-10 text-center text-sm text-slate-500"
                  >
                    Loading invitations...
                  </td>
                </tr>
              )}

              {!loading &&
                invites.map((invite) => (
                  <tr
                    key={invite.id}
                    className="border-t border-slate-100 dark:border-slate-800"
                  >
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-800 dark:text-slate-100">
                        {invite.companyName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {invite.fullName}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                      {invite.email}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusClass(invite.status)}`}
                      >
                        {invite.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {formatRelative(invite.lastSentAt || invite.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {(invite.status === "PENDING" ||
                          invite.status === "EXPIRED" ||
                          invite.status === "DECLINED") && (
                          <button
                            type="button"
                            onClick={() => handleResend(invite)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                            title="Resend Invite"
                          >
                            <RotateCcw size={13} />
                            Resend
                          </button>
                        )}

                        {(invite.status === "PENDING" ||
                          invite.status === "EXPIRED") && (
                          <button
                            type="button"
                            onClick={() => handleCancel(invite)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50"
                            title="Cancel Invite"
                          >
                            <Ban size={13} />
                            Cancel
                          </button>
                        )}

                        {invite.status !== "ACCEPTED" && (
                          <button
                            type="button"
                            onClick={() => handleDelete(invite)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                            title="Delete Invite"
                          >
                            <Trash2 size={13} />
                            Delete
                          </button>
                        )}

                        {invite.status === "ACCEPTED" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-400">
                            <Mail size={13} />
                            View in lenders
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

              {!loading && invites.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-10 text-center text-sm text-slate-500"
                  >
                    {search
                      ? `No invitations match "${search}".`
                      : "No invitations found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Showing {from}-{to} of {meta.total}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={limit}
              onChange={(e) => {
                setPage(1);
                setLimit(Number(e.target.value) || 20);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>

            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium disabled:opacity-40 dark:border-slate-700"
            >
              <ChevronLeft size={14} />
              Prev
            </button>

            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Page {meta.page} / {meta.totalPages}
            </span>

            <button
              type="button"
              disabled={page >= meta.totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium disabled:opacity-40 dark:border-slate-700"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
