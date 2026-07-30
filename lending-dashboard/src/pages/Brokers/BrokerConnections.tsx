import {
  Check,
  Clock,
  Handshake,
  RefreshCcw,
  Search,
  Send,
  UserX,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
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

type ConnectedBroker = {
  id: string;
  name: string;
  email: string;
  phone: string;
  brokerStatus: "ACTIVE" | "INACTIVE";
  connectionStatus: "CONNECTED" | "PENDING" | "DISABLED";
  source: string;
  assignedAt: string;
};

type Stats = {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
};

type MainTab = "requests" | "sent" | "connected";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const BRAND = "#18B6B4";

function getAuthHeaders(): HeadersInit {
  const token = sessionStorage.getItem("lender_token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
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

export default function BrokerConnections() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as MainTab) || "requests";
  const [mainTab, setMainTab] = useState<MainTab>(
    initialTab === "sent" || initialTab === "connected" ? initialTab : "requests",
  );

  const [invites, setInvites] = useState<Invite[]>([]);
  const [connected, setConnected] = useState<ConnectedBroker[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    pending: 0,
    accepted: 0,
    rejected: 0,
  });
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [loadingConnected, setLoadingConnected] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setSearchParams({ tab: mainTab }, { replace: true });
  }, [mainTab, setSearchParams]);

  const fetchInvites = useCallback(async () => {
    setLoadingInvites(true);
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
      setLoadingInvites(false);
    }
  }, []);

  const fetchConnected = useCallback(async () => {
    setLoadingConnected(true);
    try {
      const res = await fetch(`${API_BASE}/lender/brokers/list`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.message || "Failed to load connected brokers");
      }
      setConnected(Array.isArray(json.data) ? json.data : []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load connected brokers");
    } finally {
      setLoadingConnected(false);
    }
  }, []);

  useEffect(() => {
    fetchInvites();
    fetchConnected();
  }, [fetchInvites, fetchConnected]);

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

  const filteredConnected = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return connected;
    return connected.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.email.toLowerCase().includes(q) ||
        b.phone.includes(q),
    );
  }, [connected, search]);

  async function acceptInvite(inviteId: string) {
    setActionId(inviteId);
    try {
      const res = await fetch(`${API_BASE}/lender/brokers/accept/${inviteId}`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || json.success !== true) {
        throw new Error(json.message || "Failed to accept");
      }
      toast.success("Broker connected");
      await Promise.all([fetchInvites(), fetchConnected()]);
      setMainTab("connected");
    } catch (err: any) {
      toast.error(err.message || "Failed to accept invite");
    } finally {
      setActionId(null);
    }
  }

  async function rejectInvite(inviteId: string) {
    setActionId(inviteId);
    try {
      const res = await fetch(`${API_BASE}/lender/brokers/reject/${inviteId}`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({}),
      });
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

  async function handleConnectionToggle(broker: ConnectedBroker) {
    const isActive = broker.connectionStatus === "DISABLED";
    setUpdatingId(broker.id);
    try {
      const res = await fetch(`${API_BASE}/lender/brokers/${broker.id}/status`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ isActive }),
      });
      const json = await res.json();
      if (!res.ok || json.success !== true) {
        throw new Error(json.message || "Update failed");
      }
      setConnected((prev) =>
        prev.map((b) =>
          b.id === broker.id
            ? {
                ...b,
                connectionStatus: isActive ? "CONNECTED" : "DISABLED",
              }
            : b,
        ),
      );
      toast.success(isActive ? "Broker reconnected" : "Broker disconnected");
    } catch (err: any) {
      toast.error(err.message || "Failed to update connection");
      fetchConnected();
    } finally {
      setUpdatingId(null);
    }
  }

  const loading =
    mainTab === "connected" ? loadingConnected : loadingInvites;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-6 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">
            Partnerships
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Broker{" "}
            <span style={{ color: BRAND }}>Connections</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
            Review broker requests, track sent invites, and manage your
            connected brokerage partners — all in one place.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatPill
            icon={<Handshake size={16} />}
            label="Total invites"
            value={stats.total}
            color="blue"
          />
          <StatPill
            icon={<Clock size={16} />}
            label="Pending"
            value={stats.pending}
            color="amber"
            pulse={stats.pending > 0}
          />
          <StatPill
            icon={<Check size={16} />}
            label="Accepted"
            value={stats.accepted}
            color="emerald"
          />
          <StatPill
            icon={<Users size={16} />}
            label="Connected"
            value={connected.filter((b) => b.connectionStatus === "CONNECTED").length}
            color="emerald"
          />
        </div>

        {/* Main tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="inline-flex p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <MainTabButton
              active={mainTab === "requests"}
              onClick={() => setMainTab("requests")}
              label="Requests"
              icon={<Handshake size={14} />}
              badge={pendingIncoming.length}
            />
            <MainTabButton
              active={mainTab === "sent"}
              onClick={() => setMainTab("sent")}
              label="Sent Invites"
              icon={<Send size={14} />}
            />
            <MainTabButton
              active={mainTab === "connected"}
              onClick={() => setMainTab("connected")}
              label="Connected"
              icon={<Users size={14} />}
              badge={connected.filter((b) => b.connectionStatus === "CONNECTED").length}
            />
          </div>

          {mainTab === "connected" && (
            <div className="relative w-full sm:w-72">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search connected brokers..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#18B6B4]/30"
              />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          {loading ? (
            <TableSkeleton rows={5} />
          ) : mainTab === "requests" ? (
            <InviteTable
              rows={incoming}
              showActions
              emptyTitle="No broker requests yet"
              emptySubtitle="When brokers invite you to connect, their requests will appear here."
              actionId={actionId}
              onAccept={acceptInvite}
              onReject={rejectInvite}
            />
          ) : mainTab === "sent" ? (
            <InviteTable
              rows={outgoing}
              showActions={false}
              emptyTitle="No invites sent yet"
              emptySubtitle="Use Find Brokers to invite brokerage partners to your network."
            />
          ) : filteredConnected.length === 0 ? (
            <EmptyState
              title={
                connected.length === 0
                  ? "No connected brokers yet"
                  : "No brokers match your search"
              }
              subtitle={
                connected.length === 0
                  ? "Accept broker requests to build your partnership network."
                  : "Try a different search term."
              }
            />
          ) : (
            <ConnectedTable
              brokers={filteredConnected}
              updatingId={updatingId}
              onToggle={handleConnectionToggle}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function MainTabButton({
  active,
  onClick,
  label,
  icon,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
        active
          ? "text-white shadow-sm"
          : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
      }`}
      style={active ? { backgroundColor: BRAND } : undefined}
    >
      {icon}
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

function StatPill({
  icon,
  label,
  value,
  color,
  pulse,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "emerald" | "amber" | "blue";
  pulse?: boolean;
}) {
  const colors = {
    emerald:
      "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20",
    amber:
      "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/20",
    blue: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/20",
  };

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${colors[color]} ${pulse ? "ring-2 ring-amber-400/30" : ""}`}
    >
      {icon}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
          {label}
        </p>
        <p className="text-xl font-bold leading-tight">{value}</p>
      </div>
    </div>
  );
}

function InviteTable({
  rows,
  showActions,
  emptyTitle,
  emptySubtitle,
  actionId,
  onAccept,
  onReject,
}: {
  rows: Invite[];
  showActions: boolean;
  emptyTitle: string;
  emptySubtitle: string;
  actionId?: string | null;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
}) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} subtitle={emptySubtitle} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
            {["Broker", "Email", "Status", "Date", ...(showActions ? ["Actions"] : [])].map(
              (h) => (
                <th
                  key={h}
                  className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((i) => (
            <tr
              key={i.inviteId}
              className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
            >
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: BRAND }}
                  >
                    {i.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {i.name}
                  </span>
                </div>
              </td>
              <td className="px-5 py-4 text-slate-500">{i.email}</td>
              <td className="px-5 py-4">
                <StatusBadge status={i.inviteStatus} />
              </td>
              <td className="px-5 py-4 text-slate-500 text-xs">
                {formatDateTime(i.invitedAt)}
              </td>
              {showActions && (
                <td className="px-5 py-4">
                  {i.inviteStatus === "PENDING" ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={actionId === i.inviteId}
                        onClick={() => onAccept?.(i.inviteId)}
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
                        type="button"
                        disabled={actionId === i.inviteId}
                        onClick={() => onReject?.(i.inviteId)}
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
  );
}

function ConnectedTable({
  brokers,
  updatingId,
  onToggle,
}: {
  brokers: ConnectedBroker[];
  updatingId: string | null;
  onToggle: (broker: ConnectedBroker) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
            {["Broker", "Email", "Phone", "Broker status", "Connection", "Connected since"].map(
              (h) => (
                <th
                  key={h}
                  className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {brokers.map((b) => (
            <tr
              key={b.id}
              className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
            >
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: BRAND }}
                  >
                    {b.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {b.name}
                  </span>
                </div>
              </td>
              <td className="px-5 py-4 text-slate-500">{b.email}</td>
              <td className="px-5 py-4 text-slate-500">{b.phone || "—"}</td>
              <td className="px-5 py-4">
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    b.brokerStatus === "ACTIVE"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {b.brokerStatus}
                </span>
              </td>
              <td className="px-5 py-4">
                <button
                  type="button"
                  disabled={updatingId === b.id}
                  onClick={() => onToggle(b)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition disabled:opacity-50 ${
                    b.connectionStatus === "CONNECTED"
                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300"
                      : "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-500/10 dark:text-red-300"
                  }`}
                  title="Click to toggle connection"
                >
                  {updatingId === b.id ? "Updating..." : b.connectionStatus}
                </button>
              </td>
              <td className="px-5 py-4 text-slate-500 text-xs">
                {formatDateTime(b.assignedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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

function EmptyState({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="py-16 flex flex-col items-center text-center px-6">
      <div
        className="w-14 h-14 flex items-center justify-center rounded-2xl mb-4"
        style={{ backgroundColor: `${BRAND}18`, color: BRAND }}
      >
        <UserX size={26} />
      </div>
      <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
        {title}
      </p>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
        {subtitle}
      </p>
    </div>
  );
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="p-6 space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-12 rounded-lg bg-slate-100 dark:bg-slate-800"
        />
      ))}
    </div>
  );
}
