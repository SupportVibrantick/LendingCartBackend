import { useEffect, useState } from "react";
import { RefreshCcw, Mail, Ban, Trash2, RotateCcw } from "lucide-react";
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

type Props = {
  apiBase: string;
  getAuthHeaders: () => Record<string, string>;
};

/** Auth headers without Content-Type — safe for empty-body POST/DELETE */
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

export default function LenderInvitesPanel({ apiBase, getAuthHeaders }: Props) {
  const [invites, setInvites] = useState<LenderInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const fetchInvites = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }
      if (search.trim()) params.set("search", search.trim());

      const qs = params.toString();
      const res = await fetch(
        `${apiBase}/admin/invite-lenders${qs ? `?${qs}` : ""}`,
        { headers: getAuthHeaders() },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load invitations");
      }
      setInvites(json.data || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load invitations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

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
      const res = await fetch(
        `${apiBase}/admin/invite-lenders/${invite.id}`,
        {
          method: "DELETE",
          headers: authHeadersOnly(getAuthHeaders),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to delete");
      }
      toast.success("Invitation deleted");
      fetchInvites();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            Lender Invitations
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track pending, accepted, expired, and declined invites.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="DECLINED">Declined</option>
            <option value="EXPIRED">Expired</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") fetchInvites();
              }}
              placeholder="Search company / email"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs w-48"
            />
            <button
              type="button"
              onClick={fetchInvites}
              disabled={loading}
              className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700"
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
          <thead className="bg-slate-50 dark:bg-slate-950/50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-semibold">Company</th>
              <th className="px-5 py-3 font-semibold">Email</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Sent</th>
              <th className="px-5 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invites.map((invite) => (
              <tr
                key={invite.id}
                className="border-t border-slate-100 dark:border-slate-800"
              >
                <td className="px-5 py-3">
                  <div className="font-medium text-slate-800 dark:text-slate-100">
                    {invite.companyName}
                  </div>
                  <div className="text-xs text-slate-500">{invite.fullName}</div>
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
                  No invitations found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
