import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  Building2,
  Filter,
  Loader2,
  MessageSquare,
  MessagesSquare,
  Search,
  Shield,
  User,
  Users,
} from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import { adminFetch, type PaginatedResponse } from "../../lib/adminApi";

type ConversationRow = {
  id: string;
  type: string;
  applicationNumber?: string;
  brokerName?: string;
  clientName?: string;
  messageCount?: number;
  participantCount?: number;
  lastMessageAt?: string;
  lastMessage?: { text?: string; senderName?: string; senderType?: string };
};

type MessageRow = {
  id: string;
  senderName?: string;
  senderType?: string;
  text?: string;
  createdAt: string;
};

const TYPE_LABELS: Record<string, string> = {
  CLIENT_BROKER: "Client ↔ Broker",
  CLIENT_OFFICER: "Client ↔ Loan Officer",
  BROKER_LENDER: "Broker ↔ Lender",
  SUBBROKER_BROKER: "Sub-Broker ↔ Broker",
  BROKER_OFFICER: "Broker ↔ Loan Officer",
};

const TYPE_STYLES: Record<string, { badge: string; dot: string }> = {
  CLIENT_BROKER: {
    badge: "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20",
    dot: "bg-blue-500",
  },
  CLIENT_OFFICER: {
    badge: "bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/20",
    dot: "bg-violet-500",
  },
  BROKER_LENDER: {
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20",
    dot: "bg-emerald-500",
  },
  SUBBROKER_BROKER: {
    badge: "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20",
    dot: "bg-amber-500",
  },
  BROKER_OFFICER: {
    badge: "bg-indigo-50 text-indigo-700 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/20",
    dot: "bg-indigo-500",
  },
};

const SENDER_STYLES: Record<string, string> = {
  BROKER: "bg-[#13538A] text-white",
  CLIENT: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100",
  LENDER: "bg-emerald-600 text-white",
  LOAN_OFFICER: "bg-violet-600 text-white",
  SUB_BROKER: "bg-amber-500 text-white",
  PLATFORM_ADMIN: "bg-slate-700 text-white",
};

const AVATAR_TONES = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
];

function getInitials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function getAvatarTone(seed?: string | null) {
  if (!seed) return AVATAR_TONES[0];
  const index = seed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_TONES[index % AVATAR_TONES.length];
}

function formatRelativeTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDayLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function previewText(row: ConversationRow) {
  const text = row.lastMessage?.text?.trim();
  if (text) {
    const sender = row.lastMessage?.senderName;
    return sender ? `${sender}: ${text}` : text;
  }
  if (row.messageCount && row.messageCount > 0) return "Attachment or system message";
  return "No messages yet";
}

function ConversationSkeleton() {
  return (
    <div className="space-y-2 px-3 py-3">
      {[1, 2, 3, 4, 5].map((item) => (
        <div
          key={item}
          className="flex animate-pulse items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="h-11 w-11 rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-2.5 w-1/2 rounded bg-slate-100 dark:bg-slate-800" />
            <div className="h-2.5 w-full rounded bg-slate-100 dark:bg-slate-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AllCommunications() {
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", limit: "50" });
      if (typeFilter) params.set("type", typeFilter);
      const json = await adminFetch<PaginatedResponse<ConversationRow[]>>(
        `/admin/messaging/conversations?${params.toString()}`,
      );
      setRows(json.data || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  const fetchMessages = useCallback(async (conversationId: string) => {
    setMessagesLoading(true);
    try {
      const json = await adminFetch<{
        data: { messages: MessageRow[] };
      }>(`/admin/messaging/conversations/${conversationId}/messages?limit=100`);
      setMessages(json.data?.messages || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load messages");
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (selectedId) fetchMessages(selectedId);
    else setMessages([]);
  }, [selectedId, fetchMessages]);

  useEffect(() => {
    if (!messagesLoading && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [messages, messagesLoading, selectedId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [
        row.applicationNumber,
        row.brokerName,
        row.clientName,
        row.type,
        TYPE_LABELS[row.type],
        row.lastMessage?.text,
        row.lastMessage?.senderName,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const selected = rows.find((row) => row.id === selectedId) || null;

  const stats = useMemo(
    () => ({
      conversations: rows.length,
      messages: rows.reduce((sum, row) => sum + (row.messageCount || 0), 0),
      withActivity: rows.filter((row) => (row.messageCount || 0) > 0).length,
    }),
    [rows],
  );

  const groupedMessages = useMemo(() => {
    const groups: { label: string; items: MessageRow[] }[] = [];
    messages.forEach((msg) => {
      const label = formatDayLabel(msg.createdAt);
      const last = groups[groups.length - 1];
      if (last?.label === label) {
        last.items.push(msg);
      } else {
        groups.push({ label, items: [msg] });
      }
    });
    return groups;
  }, [messages]);

  return (
    <>
      <PageMeta
        title="All Communications"
        description="Platform-wide read-only view of all conversations"
      />

      <div className="space-y-6">
        {/* Header */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#5D28A8] p-6 text-white shadow-lg dark:border-slate-800">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                <Shield className="h-3.5 w-3.5" />
                Platform Admin · Read Only
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">All Communications</h1>
              <p className="mt-1 max-w-2xl text-sm text-white/80">
                Monitor every conversation across brokers, clients, lenders, loan officers, and sub-brokers.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {[
                { label: "Threads", value: stats.conversations, icon: MessagesSquare },
                { label: "Messages", value: stats.messages, icon: MessageSquare },
                { label: "Active", value: stats.withActivity, icon: Users },
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

        {/* Chat panel */}
        <div className="flex min-h-[560px] flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-[#f5f5f4] shadow-sm dark:border-slate-800 dark:bg-slate-950 lg:h-[calc(100vh-240px)] lg:max-h-[820px] lg:min-h-[480px] lg:flex-row">
          {/* Conversation list */}
          <aside className="flex max-h-[45vh] min-h-0 w-full shrink-0 flex-col border-b border-slate-200 bg-[#fbfbfa] dark:border-slate-800 dark:bg-slate-900 lg:max-h-none lg:w-[360px] lg:border-b-0 lg:border-r">
            <div className="shrink-0 border-b border-slate-200 px-4 py-4 dark:border-slate-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by app, broker, client..."
                  className="h-10 w-full rounded-full border border-slate-200 bg-[#f2f2ef] pl-10 pr-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#13538A]/40 focus:ring-2 focus:ring-[#13538A]/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                />
              </div>

              <div className="custom-scrollbar mt-3 flex items-center gap-2 overflow-x-auto pb-1">
                <Filter className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <button
                  type="button"
                  onClick={() => setTypeFilter("")}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    !typeFilter
                      ? "bg-[#13538A] text-white shadow-sm"
                      : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
                  }`}
                >
                  All
                </button>
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTypeFilter(value)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      typeFilter === value
                        ? "bg-[#13538A] text-white shadow-sm"
                        : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
                    }`}
                  >
                    {label.split(" ↔ ")[0]}
                  </button>
                ))}
              </div>
            </div>

            <div className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Conversations
                <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {filtered.length}
                </span>
              </p>
            </div>

            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <ConversationSkeleton />
              ) : filtered.length === 0 ? (
                <div className="flex h-full min-h-[240px] flex-col items-center justify-center px-6 text-center">
                  <div className="rounded-full border border-slate-200 bg-white p-4 text-slate-400 dark:border-slate-700 dark:bg-slate-900">
                    <MessageSquare className="h-6 w-6" />
                  </div>
                  <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-200">
                    No conversations found
                  </p>
                  <p className="mt-1 max-w-[220px] text-xs text-slate-500">
                    Try adjusting your search or filter to find a thread.
                  </p>
                </div>
              ) : (
                <div className="space-y-1 px-3 py-3">
                  {filtered.map((row) => {
                    const isActive = selectedId === row.id;
                    const typeStyle = TYPE_STYLES[row.type] || {
                      badge: "bg-slate-100 text-slate-600 ring-slate-200",
                      dot: "bg-slate-400",
                    };
                    const displayName = row.clientName || row.brokerName || "Conversation";

                    return (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => setSelectedId(row.id)}
                        className={`flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                          isActive
                            ? "border-[#13538A]/30 bg-white shadow-sm ring-1 ring-[#13538A]/10 dark:border-[#13538A]/40 dark:bg-slate-900"
                            : "border-transparent bg-transparent hover:border-slate-200 hover:bg-white dark:hover:border-slate-700 dark:hover:bg-slate-900/80"
                        }`}
                      >
                        <div className="relative shrink-0">
                          <div
                            className={`flex h-11 w-11 items-center justify-center rounded-full text-xs font-semibold ${getAvatarTone(displayName)}`}
                          >
                            {getInitials(displayName)}
                          </div>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#fbfbfa] dark:border-slate-900 ${typeStyle.dot}`}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                                {row.applicationNumber || "Application"}
                              </p>
                              <p className="truncate text-xs text-slate-500">
                                {row.clientName || "—"} · {row.brokerName || "—"}
                              </p>
                            </div>
                            <span className="shrink-0 text-[10px] text-slate-400">
                              {formatRelativeTime(row.lastMessageAt)}
                            </span>
                          </div>

                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${typeStyle.badge}`}
                            >
                              {TYPE_LABELS[row.type] || row.type}
                            </span>
                            {(row.messageCount || 0) > 0 && (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {row.messageCount} msgs
                              </span>
                            )}
                          </div>

                          <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                            {previewText(row)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          {/* Message panel */}
          <section className="flex min-h-[360px] flex-1 flex-col bg-[#f8f8f6] dark:bg-slate-950 lg:min-h-0">
            {!selected ? (
              <div className="flex flex-1 items-center justify-center px-6 text-center">
                <div className="max-w-sm">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#13538A]/10 to-[#5D28A8]/10 text-[#13538A] ring-1 ring-[#13538A]/10">
                    <MessageSquare className="h-9 w-9" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-slate-900 dark:text-white">
                    Select a conversation
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-slate-500">
                    Choose any thread from the left panel to read the full message history.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${getAvatarTone(selected.clientName || selected.brokerName)}`}
                      >
                        {getInitials(selected.clientName || selected.brokerName)}
                      </div>
                      <div>
                        <p className="text-base font-semibold text-slate-900 dark:text-white">
                          {selected.applicationNumber}
                        </p>
                        <p className="text-sm text-slate-500">
                          {selected.clientName || "Client"} · {selected.brokerName || "Broker"}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${
                              (TYPE_STYLES[selected.type] || TYPE_STYLES.CLIENT_BROKER).badge
                            }`}
                          >
                            {TYPE_LABELS[selected.type] || selected.type}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                            <Building2 className="h-3.5 w-3.5" />
                            {selected.participantCount || 0} participants
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                            <MessageSquare className="h-3.5 w-3.5" />
                            {selected.messageCount || 0} messages
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
                  {messagesLoading ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="text-center">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#13538A]" />
                        <p className="mt-3 text-sm text-slate-500">Loading messages...</p>
                      </div>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-slate-400 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                          <User className="h-6 w-6" />
                        </div>
                        <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-200">
                          No messages yet
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          This conversation has not started yet.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {groupedMessages.map((group) => (
                        <div key={group.label}>
                          <div className="mb-4 flex items-center gap-3">
                            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                              {group.label}
                            </span>
                            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                          </div>

                          <div className="space-y-3">
                            {group.items.map((msg) => {
                              const bubbleStyle =
                                SENDER_STYLES[msg.senderType || ""] ||
                                "bg-white text-slate-800 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-800";

                              return (
                                <div key={msg.id} className="flex items-end gap-2.5">
                                  <div
                                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${getAvatarTone(msg.senderName)}`}
                                  >
                                    {getInitials(msg.senderName)}
                                  </div>
                                  <div className="max-w-[78%]">
                                    <div className="mb-1 flex items-center gap-2 px-1">
                                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                        {msg.senderName || msg.senderType || "Unknown"}
                                      </span>
                                      <span className="text-[10px] text-slate-400">
                                        {formatMessageTime(msg.createdAt)}
                                      </span>
                                    </div>
                                    <div
                                      className={`rounded-2xl rounded-tl-md px-4 py-2.5 text-sm leading-6 shadow-sm ${bubbleStyle}`}
                                    >
                                      {msg.text?.trim() || (
                                        <span className="italic opacity-70">[Attachment]</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 text-center dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs text-slate-500">
                    Read-only platform view — messages cannot be sent from admin dashboard.
                  </p>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
