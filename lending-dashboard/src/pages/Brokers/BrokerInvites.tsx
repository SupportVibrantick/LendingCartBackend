import {
  Check,
  Clock,
  Handshake,
  RefreshCcw,
  Send,
  UserX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

type Invite = {
  inviteId: string;
  brokerId: string;
  name: string;
  email: string;
  inviteStatus: "PENDING" | "ACCEPTED" | "REJECTED";
  initiatedBy?: "BROKER" | "LENDER" | null;
  direction?: "incoming" | "outgoing";
  invitedAt: string;
};

type Stats = {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
};

type Tab = "requests" | "sent";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const BRAND = "#18B6B4";

export default function BrokerInvites() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    pending: 0,
    accepted: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("requests");

  function getAuthHeaders(): HeadersInit {
    const token = sessionStorage.getItem("lender_token");
    return {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  const fetchInvites = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/lender/brokers/invites`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json();

      if (!res.ok || json.success === false) {
        throw new Error(json.message || "Failed to load broker requests");
      }

      setInvites(json.data || []);
      setStats(json.stats || { total: 0, pending: 0, accepted: 0, rejected: 0 });
    } catch (err: any) {
      toast.error(err.message || "Failed to load broker requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const incoming = useMemo(
    () =>
      invites.filter(
        (i) =>
          i.direction === "incoming" ||
          i.initiatedBy === "BROKER" ||
          (!i.initiatedBy && i.inviteStatus === "PENDING"),
      ),
    [invites],
  );

  const outgoing = useMemo(
    () =>
      invites.filter(
        (i) => i.direction === "outgoing" || i.initiatedBy === "LENDER",
      ),
    [invites],
  );

  const pendingIncoming = incoming.filter((i) => i.inviteStatus === "PENDING");

  const displayed =
    tab === "requests"
      ? incoming
      : outgoing;

  async function acceptInvite(inviteId: string) {
    setActionId(inviteId);
    try {
      const res = await fetch(
        `${API_BASE}/lender/brokers/accept/${inviteId}`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({}),
        },
      );
      const json = await res.json();
      if (!res.ok || json.success !== true) {
        throw new Error(json.message || "Failed to accept");
      }
      toast.success("Broker connected");
      await fetchInvites();
    } catch (err: any) {
      toast.error(err.message || "Failed to accept invite");
    } finally {
      setActionId(null);
    }
  }

  async function rejectInvite(inviteId: string) {
    setActionId(inviteId);
    try {
      const res = await fetch(
        `${API_BASE}/lender/brokers/reject/${inviteId}`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({}),
        },
      );
      const json = await res.json();
      if (!res.ok || json.success !== true) {
        throw new Error(json.message || "Failed to decline");
      }
      toast.success("Invite declined");
      setInvites((prev) =>
        prev.map((i) =>
          i.inviteId === inviteId ? { ...i, inviteStatus: "REJECTED" } : i,
        ),
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to decline invite");
    } finally {
      setActionId(null);
    }
  }

  function formatDateTime(date: string) {
    return new Date(date).toLocaleString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="px-4 sm:px-6 py-6 text-gray-900 dark:text-gray-100 max-w-6xl mx-auto">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">
          Partnerships
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          Broker{" "}
          <span style={{ color: BRAND }}>Connections</span>
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Review broker requests and manage your outreach.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total" value={stats.total} icon={<Handshake size={18} />} />
        <StatCard
          label="Pending"
          value={stats.pending}
          icon={<Clock size={18} />}
          highlight={stats.pending > 0}
        />
        <StatCard label="Accepted" value={stats.accepted} icon={<Check size={18} />} />
        <StatCard label="Declined" value={stats.rejected} icon={<X size={18} />} />
      </div>

      <div className="flex gap-1 p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-fit mb-5 shadow-sm">
        <TabButton
          active={tab === "requests"}
          onClick={() => setTab("requests")}
          label="Requests"
          badge={pendingIncoming.length}
        />
        <TabButton
          active={tab === "sent"}
          onClick={() => setTab("sent")}
          label="Sent Invites"
        />
      </div>

      <div className="rounded-2xl border bg-white dark:bg-slate-900 dark:border-slate-700 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 space-y-4 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-12 rounded-lg bg-gray-200 dark:bg-slate-700"
              />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 dark:bg-slate-800/80 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3.5 text-left font-semibold">Broker</th>
                  <th className="px-5 py-3.5 text-left font-semibold">Email</th>
                  <th className="px-5 py-3.5 text-left font-semibold">Status</th>
                  <th className="px-5 py-3.5 text-left font-semibold">Date</th>
                  {tab === "requests" && (
                    <th className="px-5 py-3.5 text-left font-semibold">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {displayed.map((i) => (
                  <tr
                    key={i.inviteId}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-5 py-4 font-medium">{i.name}</td>
                    <td className="px-5 py-4 text-slate-500">{i.email}</td>
                    <td className="px-5 py-4">
                      <StatusBadge status={i.inviteStatus} />
                    </td>
                    <td className="px-5 py-4 text-slate-500 text-xs">
                      {formatDateTime(i.invitedAt)}
                    </td>
                    {tab === "requests" && (
                      <td className="px-5 py-4">
                        {i.inviteStatus === "PENDING" ? (
                          <div className="flex items-center gap-2">
                            <button
                              disabled={actionId === i.inviteId}
                              onClick={() => acceptInvite(i.inviteId)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                              style={{ backgroundColor: BRAND }}
                            >
                              {actionId === i.inviteId ? (
                                <RefreshCcw size={12} className="animate-spin" />
                              ) : (
                                <Check size={12} />
                              )}
                              Accept
                            </button>
                            <button
                              disabled={actionId === i.inviteId}
                              onClick={() => rejectInvite(i.inviteId)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                            >
                              <X size={12} />
                              Decline
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 bg-white dark:bg-slate-900 dark:border-slate-700 flex items-center justify-between ${
        highlight ? "ring-2 ring-amber-400/40" : ""
      }`}
    >
      <div>
        <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-2xl font-bold mt-0.5">{value}</p>
      </div>
      <div
        className="h-9 w-9 rounded-full flex items-center justify-center text-white"
        style={{ backgroundColor: BRAND }}
      >
        {icon}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
        active
          ? "text-white shadow-sm"
          : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
      }`}
      style={active ? { backgroundColor: BRAND } : undefined}
    >
      {label === "Sent Invites" ? <Send size={14} /> : <Handshake size={14} />}
      {label}
      {badge != null && badge > 0 && (
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
            active ? "bg-white/25 text-white" : "bg-amber-100 text-amber-700"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function StatusBadge({
  status,
}: {
  status: "PENDING" | "ACCEPTED" | "REJECTED";
}) {
  const styles = {
    PENDING:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
    ACCEPTED:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
    REJECTED:
      "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300",
  };

  return (
    <span
      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${styles[status]}`}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  return (
    <div className="py-16 flex flex-col items-center text-center px-6">
      <div
        className="w-14 h-14 flex items-center justify-center rounded-2xl mb-4"
        style={{ backgroundColor: `${BRAND}18`, color: BRAND }}
      >
        <UserX size={26} />
      </div>
      <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
        {tab === "requests"
          ? "No broker requests yet"
          : "No invites sent yet"}
      </p>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
        {tab === "requests"
          ? "When brokers invite you to connect, their requests will appear here."
          : "Use Find Brokers to invite brokerage partners to your network."}
      </p>
    </div>
  );
}
