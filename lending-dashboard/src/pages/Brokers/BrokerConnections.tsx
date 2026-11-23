import {
  Check,
  Clock,
  Handshake,
  MessageSquare,
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
import NetworkChatModal, {
  type NetworkChatPeer,
} from "../../components/networkChat/NetworkChatModal";
import { API_BASE, getLenderAuthHeaders } from "../../lib/lenderApi";

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

type InvitesPayload = {
  data: Invite[];
  stats: Stats;
};

type MainTab = "requests" | "sent" | "connected";

const EMPTY_STATS: Stats = {
  total: 0,
  pending: 0,
  accepted: 0,
  rejected: 0,
};

// Share in-flight GETs across React Strict Mode remounts.
let inflightInvites: Promise<InvitesPayload> | null = null;
let inflightConnected: Promise<ConnectedBroker[]> | null = null;

async function fetchInvitesRequest(force = false) {
  if (!force && inflightInvites) return inflightInvites;

  const request = (async () => {
    const res = await fetch(`${API_BASE}/lender/brokers/invites`, {
      headers: getLenderAuthHeaders(),
    });
    const json = await res.json();
    if (!res.ok || json.success === false) {
      throw new Error(json.message || "Failed to load broker requests");
    }
    return {
      data: (json.data || []) as Invite[],
      stats: (json.stats || EMPTY_STATS) as Stats,
    };
  })().finally(() => {
    inflightInvites = null;
  });

  inflightInvites = request;
  return request;
}

async function fetchConnectedRequest(force = false) {
  if (!force && inflightConnected) return inflightConnected;

  const request = (async () => {
    const res = await fetch(`${API_BASE}/lender/brokers/list`, {
      headers: getLenderAuthHeaders(),
    });
    const json = await res.json();
    if (!res.ok || json.success === false) {
      throw new Error(json.message || "Failed to load connected brokers");
    }
    return (Array.isArray(json.data) ? json.data : []) as ConnectedBroker[];
  })().finally(() => {
    inflightConnected = null;
  });

  inflightConnected = request;
  return request;
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
  const [chatPeer, setChatPeer] = useState<NetworkChatPeer | null>(null);

  useEffect(() => {
    setSearchParams({ tab: mainTab }, { replace: true });
  }, [mainTab, setSearchParams]);

  const fetchInvites = useCallback(
    async (options?: { force?: boolean; isActive?: () => boolean }) => {
      if (!options?.isActive || options.isActive()) {
        setLoadingInvites(true);
      }
      try {
        const payload = await fetchInvitesRequest(Boolean(options?.force));
        if (options?.isActive && !options.isActive()) return;
        setInvites(payload.data);
        setStats(payload.stats);
      } catch (err: any) {
        if (options?.isActive && !options.isActive()) return;
        toast.error(err.message || "Failed to load broker requests");
      } finally {
        if (!options?.isActive || options.isActive()) {
          setLoadingInvites(false);
        }
      }
    },
    [],
  );

  const fetchConnected = useCallback(
    async (options?: { force?: boolean; isActive?: () => boolean }) => {
      if (!options?.isActive || options.isActive()) {
        setLoadingConnected(true);
      }
      try {
        const data = await fetchConnectedRequest(Boolean(options?.force));
        if (options?.isActive && !options.isActive()) return;
        setConnected(data);
      } catch (err: any) {
        if (options?.isActive && !options.isActive()) return;
        toast.error(err.message || "Failed to load connected brokers");
      } finally {
        if (!options?.isActive || options.isActive()) {
          setLoadingConnected(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    let active = true;
    // Initial load: invites for Requests/Sent, connected for badge + Connected tab.
    void fetchInvites({ isActive: () => active });
    void fetchConnected({ isActive: () => active });
    return () => {
      active = false;
    };
  }, [fetchInvites, fetchConnected]);

  const selectTab = useCallback(
    (tab: MainTab) => {
      if (tab === mainTab) return;
      setMainTab(tab);
      // Each tab loads its own source (Requests/Sent → invites, Connected → list).
      if (tab === "connected") {
        void fetchConnected({ force: true });
      } else {
        void fetchInvites({ force: true });
      }
    },
    [fetchConnected, fetchInvites, mainTab],
  );

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
        headers: getLenderAuthHeaders(true),
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || json.success !== true) {
        throw new Error(json.message || "Failed to accept");
      }
      toast.success("Broker connected");
      await Promise.all([
        fetchInvites({ force: true }),
        fetchConnected({ force: true }),
      ]);
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
        headers: getLenderAuthHeaders(true),
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
        headers: getLenderAuthHeaders(true),
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
      void fetchConnected({ force: true });
    } finally {
      setUpdatingId(null);
    }
  }

  const loading =
    mainTab === "connected" ? loadingConnected : loadingInvites;

  const connectedCount = connected.filter(
    (b) => b.connectionStatus === "CONNECTED",
  ).length;

  return (
    <div className="space-y-4 text-text-primary dark:text-slate-100">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="ds-page-title">Brokers</h1>
          <p className="ds-page-subtitle">
            Review requests, track invites, and manage connected partners.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <StatPill
          icon={<Handshake size={14} />}
          label="Total invites"
          value={stats.total}
          tone="bg-sky-50 text-sky-600"
        />
        <StatPill
          icon={<Clock size={14} />}
          label="Pending"
          value={stats.pending}
          tone="bg-amber-50 text-amber-600"
          pulse={stats.pending > 0}
        />
        <StatPill
          icon={<Check size={14} />}
          label="Accepted"
          value={stats.accepted}
          tone="bg-brand-50 text-brand-600"
        />
        <StatPill
          icon={<Users size={14} />}
          label="Connected"
          value={connectedCount}
          tone="bg-emerald-50 text-emerald-600"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3.5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="inline-flex w-fit rounded-xl border border-border bg-surface p-1 dark:border-slate-700 dark:bg-slate-950">
            <MainTabButton
              active={mainTab === "requests"}
              onClick={() => selectTab("requests")}
              label="Requests"
              icon={<Handshake size={14} />}
              badge={pendingIncoming.length}
            />
            <MainTabButton
              active={mainTab === "sent"}
              onClick={() => selectTab("sent")}
              label="Sent Invites"
              icon={<Send size={14} />}
            />
            <MainTabButton
              active={mainTab === "connected"}
              onClick={() => selectTab("connected")}
              label="Connected"
              icon={<Users size={14} />}
              badge={connectedCount}
            />
          </div>

          {mainTab === "connected" ? (
            <div className="group relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-secondary transition-colors group-focus-within:text-brand-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search connected brokers..."
                className="h-10 w-full rounded-xl border border-border bg-white py-2 pr-3 pl-10 text-sm text-text-primary outline-none transition placeholder:text-text-secondary/70 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          ) : null}
        </div>

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
            onChat={(broker) =>
              setChatPeer({
                orgId: broker.id,
                name: broker.name,
                email: broker.email,
              })
            }
          />
        )}
      </div>

      <NetworkChatModal
        open={Boolean(chatPeer)}
        peer={chatPeer}
        portal="lender"
        tokenKey="lender_token"
        onClose={() => setChatPeer(null)}
      />
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
      className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition sm:text-sm ${
        active
          ? "bg-brand-500 text-white"
          : "text-text-secondary hover:bg-white hover:text-text-primary dark:hover:bg-slate-800 dark:hover:text-slate-100"
      }`}
    >
      {icon}
      {label}
      {badge != null && badge > 0 ? (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
            active ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"
          }`}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function StatPill({
  icon,
  label,
  value,
  tone,
  pulse,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: string;
  pulse?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-white px-3.5 py-3 dark:border-slate-700 dark:bg-slate-900 ${
        pulse ? "ring-1 ring-amber-300/60" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
            {label}
          </p>
          <p className="mt-1 truncate text-xl font-bold tabular-nums leading-none text-text-primary dark:text-white">
            {value}
          </p>
        </div>
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}
        >
          {icon}
        </span>
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
      <table className="ds-table min-w-full">
        <thead>
          <tr>
            {["Broker", "Email", "Status", "Date", ...(showActions ? ["Actions"] : [])].map(
              (h) => (
                <th key={h}>{h}</th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => (
            <tr key={i.inviteId}>
              <td>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
                    {i.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="ds-table-title">{i.name}</span>
                </div>
              </td>
              <td className="ds-table-muted">{i.email}</td>
              <td>
                <StatusBadge status={i.inviteStatus} />
              </td>
              <td className="ds-table-meta !mt-0">
                {formatDateTime(i.invitedAt)}
              </td>
              {showActions && (
                <td>
                  {i.inviteStatus === "PENDING" ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={actionId === i.inviteId}
                        onClick={() => onAccept?.(i.inviteId)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
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
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface disabled:opacity-50"
                      >
                        <X size={12} />
                        Decline
                      </button>
                    </div>
                  ) : (
                    <span className="ds-table-empty">—</span>
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
  onChat,
}: {
  brokers: ConnectedBroker[];
  updatingId: string | null;
  onToggle: (broker: ConnectedBroker) => void;
  onChat: (broker: ConnectedBroker) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="ds-table min-w-full">
        <thead>
          <tr>
            {[
              "Broker",
              "Email",
              "Phone",
              "Broker status",
              "Connection",
              "Connected since",
              "Actions",
            ].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {brokers.map((b) => (
            <tr key={b.id}>
              <td>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
                    {b.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="ds-table-title">{b.name}</span>
                </div>
              </td>
              <td className="ds-table-muted">{b.email}</td>
              <td className="ds-table-muted">{b.phone || "—"}</td>
              <td>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    b.brokerStatus === "ACTIVE"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {b.brokerStatus}
                </span>
              </td>
              <td>
                <button
                  type="button"
                  disabled={updatingId === b.id}
                  onClick={() => onToggle(b)}
                  className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-50 ${
                    b.connectionStatus === "CONNECTED"
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300"
                      : "bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-red-500/10 dark:text-red-300"
                  }`}
                  title="Click to toggle connection"
                >
                  {updatingId === b.id ? "Updating..." : b.connectionStatus}
                </button>
              </td>
              <td className="ds-table-meta !mt-0">
                {formatDateTime(b.assignedAt)}
              </td>
              <td>
                {b.connectionStatus === "CONNECTED" ? (
                  <button
                    type="button"
                    onClick={() => onChat(b)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-surface"
                  >
                    <MessageSquare size={12} />
                    Chat
                  </button>
                ) : (
                  <span className="ds-table-empty">—</span>
                )}
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
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
        <UserX size={22} />
      </div>
      <p className="text-sm font-semibold text-text-primary dark:text-slate-100">
        {title}
      </p>
      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-text-secondary">
        {subtitle}
      </p>
    </div>
  );
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="animate-pulse space-y-3 p-5">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-11 rounded-lg bg-surface dark:bg-slate-800"
        />
      ))}
    </div>
  );
}
