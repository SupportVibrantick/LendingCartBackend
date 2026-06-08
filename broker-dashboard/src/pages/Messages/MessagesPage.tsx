import type { ChangeEvent, KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  ExternalLink,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import PageMeta from "../../components/common/PageMeta";
import {
  getConversationBadge,
  getConversationDisplayName,
  getMessageSenderLabel,
  // type ChatConversationListItem,
} from "../../lib/chatConversation";
import { useChatSocket } from "../../lib/useChatSocket";
import {
  fetchInbox,
  fetchUnreadTotal,
  useConversationHistory,
  type InboxConversation,
} from "../../lib/useConversationHistory";

const TYPE_FILTERS = [
  { value: "ALL", label: "All" },
  { value: "CLIENT_BROKER", label: "Clients" },
  { value: "BROKER_LENDER", label: "Lenders" },
  { value: "BROKER_OFFICER", label: "Officers" },
  { value: "SUBBROKER_BROKER", label: "Sub Brokers" },
] as const;

function formatTime(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDayLabel(value?: string) {
  if (!value) return "Today";
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelative(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getBrokerUserId() {
  try {
    const user = JSON.parse(sessionStorage.getItem("broker_user") || "{}");
    return user?.id || user?.userId || null;
  } catch {
    return null;
  }
}

export default function MessagesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const initialConversationId = searchParams.get("conversation");
  const brokerUserId = getBrokerUserId();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeConversationRef = useRef<string | null>(null);

  const [inbox, setInbox] = useState<InboxConversation[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxPage, setInboxPage] = useState(1);
  const [inboxTotalPages, setInboxTotalPages] = useState(1);
  const [search, setSearch] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [typeFilter, setTypeFilter] =
    useState<(typeof TYPE_FILTERS)[number]["value"]>("ALL");
  const [selected, setSelected] = useState<InboxConversation | null>(null);
  const [messageText, setMessageText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);

  const {
    messages,
    messagesLoading,
    loadingOlder,
    hasMoreMessages,
    resetMessages,
    fetchMessages,
    loadOlderMessages,
    markAsRead,
    sendMessage,
    appendRealtimeMessage,
  } = useConversationHistory();

  const loadInbox = useCallback(async (page = 1) => {
    try {
      setInboxLoading(true);
      const data = await fetchInbox({
        page,
        limit: 30,
        search: debouncedSearch,
        type: typeFilter,
      });
      setInbox(data.conversations);
      setInboxPage(data.page);
      setInboxTotalPages(data.totalPages);
      const unread = await fetchUnreadTotal();
      setTotalUnread(unread);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setInboxLoading(false);
    }
  }, [debouncedSearch, typeFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const q = search.trim();
    const next = new URLSearchParams(searchParams);
    if (q) {
      next.set("q", q);
    } else {
      next.delete("q");
    }
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [search]);

  useEffect(() => {
    loadInbox(1);
  }, [loadInbox]);

  const handleSelect = async (conversation: InboxConversation) => {
    setSelected(conversation);
    resetMessages();
    activeConversationRef.current = conversation.id;

    setInbox((prev) =>
      prev.map((item) =>
        item.id === conversation.id
          ? { ...item, unread: false, unreadCount: 0 }
          : item,
      ),
    );

    await fetchMessages(conversation.id, 1, false);
    await markAsRead(conversation.id);
  };

  useEffect(() => {
    if (!initialConversationId || inboxLoading || !inbox.length) return;
    if (selected?.id === initialConversationId) return;
    const match = inbox.find((item) => item.id === initialConversationId);
    if (match) {
      void handleSelect(match);
    }
  }, [inbox, inboxLoading, initialConversationId, selected?.id]);

  const handleSend = async () => {
    if (!selected?.id) return;
    if (!messageText.trim() && !selectedFile) return;

    try {
      setSending(true);
      await sendMessage(selected.id, { text: messageText, file: selectedFile });
      setMessageText("");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadInbox(inboxPage);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const openInPipeline = (conversation: InboxConversation) => {
    if (conversation.submissionId) {
      navigate("/loan-preview", {
        state: {
          submissionId: conversation.submissionId,
          activeTab: "chat",
          conversationId: conversation.id,
        },
      });
      return;
    }
    navigate("/submit-applications");
  };

  useChatSocket({
    getToken: () => sessionStorage.getItem("broker_token"),
    conversationId: selected?.id,
    onMessage: (msg) => {
      if (msg.conversationId !== activeConversationRef.current) {
        setInbox((prev) =>
          prev.map((item) =>
            item.id === msg.conversationId
              ? {
                  ...item,
                  lastMessage: msg.text || msg.fileName || "New message",
                  lastMessageAt: msg.createdAt,
                  unread: true,
                  unreadCount: (item.unreadCount || 0) + 1,
                }
              : item,
          ),
        );
        return;
      }
      appendRealtimeMessage(msg as Parameters<typeof appendRealtimeMessage>[0]);
    },
  });

  useEffect(() => {
    activeConversationRef.current = selected?.id || null;
  }, [selected?.id]);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const filteredCount = useMemo(() => inbox.length, [inbox]);

  return (
    <>
      <PageMeta title="Messages | Broker Dashboard" description="Conversation history" />

      <div className="space-y-4">
        {/* Hero */}
        <div className="overflow-hidden rounded-2xl border border-[#13538A]/15 bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#2C92D5] p-5 text-white sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
                Communications
              </p>
              <h1 className="mt-1 text-2xl font-bold">Messages</h1>
              <p className="mt-1 text-sm text-white/80">
                All client, lender, and team conversations in one place.
              </p>
            </div>
            {totalUnread > 0 && (
              <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                <p className="text-xs text-white/70">Unread</p>
                <p className="text-2xl font-bold">{totalUnread}</p>
              </div>
            )}
          </div>
        </div>

        {/* Main panel */}
        <div className="flex h-[calc(100vh-14rem)] min-h-[520px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {/* Inbox list */}
          <div className="flex w-full max-w-sm flex-col border-r border-gray-200 dark:border-gray-800">
            <div className="space-y-3 border-b border-gray-100 p-4 dark:border-gray-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search deals or contacts..."
                  className="w-full rounded-xl border border-gray-200 py-2 pl-10 pr-9 text-sm outline-none focus:border-[#13538A]/40 focus:ring-2 focus:ring-[#13538A]/10 dark:border-gray-700 dark:bg-gray-950"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {TYPE_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setTypeFilter(f.value)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                      typeFilter === f.value
                        ? "bg-[#13538A] text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{filteredCount} conversation(s)</span>
                <button
                  type="button"
                  onClick={() => loadInbox(inboxPage)}
                  disabled={inboxLoading}
                  className="inline-flex items-center gap-1 text-[#13538A] hover:underline disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${inboxLoading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {inboxLoading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
                  ))}
                </div>
              ) : inbox.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-16 text-center">
                  <MessageSquare className="mb-3 h-10 w-10 text-gray-300" />
                  <p className="font-medium text-gray-700 dark:text-gray-200">No conversations</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Messages from loan deals will appear here.
                  </p>
                </div>
              ) : (
                inbox.map((item) => {
                  const badge = getConversationBadge(item);
                  const isActive = selected?.id === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item)}
                      className={`w-full border-b border-gray-50 px-4 py-3 text-left transition dark:border-gray-800 ${
                        isActive
                          ? "bg-[#13538A]/10"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {getConversationDisplayName(item)}
                            </p>
                            {(item.unreadCount || 0) > 0 && (
                              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#13538A] px-1.5 text-[10px] font-bold text-white">
                                {item.unreadCount}
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-gray-500">
                            {item.applicationNumber || "Deal"} · {badge.label}
                          </p>
                          <p className="mt-1 truncate text-xs text-gray-400">
                            {item.lastMessage || "No messages yet"}
                          </p>
                        </div>
                        <span className="shrink-0 text-[10px] text-gray-400">
                          {formatRelative(item.lastMessageAt)}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {inboxTotalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2 dark:border-gray-800">
                <button
                  type="button"
                  disabled={inboxPage <= 1 || inboxLoading}
                  onClick={() => loadInbox(inboxPage - 1)}
                  className="text-xs text-[#13538A] disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="text-xs text-gray-500">
                  {inboxPage} / {inboxTotalPages}
                </span>
                <button
                  type="button"
                  disabled={inboxPage >= inboxTotalPages || inboxLoading}
                  onClick={() => loadInbox(inboxPage + 1)}
                  className="text-xs text-[#13538A] disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {/* Thread */}
          <div className="flex min-w-0 flex-1 flex-col">
            {!selected ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center text-gray-500">
                <MessageSquare className="mb-3 h-12 w-12 text-gray-300" />
                <p className="font-medium text-gray-700 dark:text-gray-200">
                  Select a conversation
                </p>
                <p className="mt-1 max-w-sm text-sm">
                  Choose a thread from the left to view full message history.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {getConversationDisplayName(selected)}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium ${getConversationBadge(selected).className}`}
                      >
                        {getConversationBadge(selected).label}
                      </span>
                      {selected.applicationNumber && (
                        <span>{selected.applicationNumber}</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openInPipeline(selected)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-[#13538A] transition hover:bg-[#13538A]/10 dark:border-gray-700"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open deal
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto bg-gray-50/80 px-5 py-4 dark:bg-gray-950/40">
                  {hasMoreMessages && (
                    <div className="mb-4 flex justify-center">
                      <button
                        type="button"
                        disabled={loadingOlder}
                        onClick={() => loadOlderMessages(selected.id)}
                        className="rounded-full border border-gray-200 bg-white px-4 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900"
                      >
                        {loadingOlder ? "Loading..." : "Load older messages"}
                      </button>
                    </div>
                  )}

                  {messagesLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-10 w-2/3 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800 ${i % 2 ? "ml-auto" : ""}`}
                        />
                      ))}
                    </div>
                  ) : messages.length === 0 ? (
                    <p className="py-12 text-center text-sm text-gray-400">
                      No messages yet. Start the conversation below.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((msg, index) => {
                        const isOwn = msg.senderUserId === brokerUserId;
                        const prev = index > 0 ? messages[index - 1] : null;
                        const showDay =
                          formatDayLabel(msg.createdAt) !==
                          formatDayLabel(prev?.createdAt);

                        return (
                          <div key={msg.id}>
                            {showDay && (
                              <div className="my-4 flex items-center gap-3 text-[11px] text-gray-400">
                                <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                                <span>{formatDayLabel(msg.createdAt)}</span>
                                <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                              </div>
                            )}
                            <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                              <div
                                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                                  isOwn
                                    ? "bg-[#13538A] text-white"
                                    : "border border-gray-200 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                                }`}
                              >
                                {!isOwn && (
                                  <p className="mb-1 text-[10px] font-semibold opacity-70">
                                    {getMessageSenderLabel(msg, selected)}
                                  </p>
                                )}
                                {msg.type === "FILE" && msg.fileUrl ? (
                                  <a
                                    href={msg.fileUrl.startsWith("http") ? msg.fileUrl : `${import.meta.env.VITE_API_BASE || "http://localhost:4000"}${msg.fileUrl}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline"
                                  >
                                    {msg.fileName || "Attachment"}
                                  </a>
                                ) : (
                                  <p className="whitespace-pre-wrap break-words">
                                    {msg.text}
                                  </p>
                                )}
                                <p
                                  className={`mt-1 text-[10px] ${isOwn ? "text-white/70" : "text-gray-400"}`}
                                >
                                  {formatTime(msg.createdAt)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-100 p-4 dark:border-gray-800">
                  {selectedFile && (
                    <div className="mb-2 flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-xs dark:bg-gray-800">
                      <Paperclip className="h-3.5 w-3.5" />
                      <span className="flex-1 truncate">{selectedFile.name}</span>
                      <button type="button" onClick={() => setSelectedFile(null)}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-xl border border-gray-200 p-2.5 text-gray-500 hover:bg-gray-50 dark:border-gray-700"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        const file = e.target.files?.[0];
                        if (file) setSelectedFile(file);
                      }}
                    />
                    <input
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Type a message..."
                      className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[#13538A]/40 focus:ring-2 focus:ring-[#13538A]/10 dark:border-gray-700 dark:bg-gray-950"
                    />
                    <button
                      type="button"
                      disabled={sending || (!messageText.trim() && !selectedFile)}
                      onClick={handleSend}
                      className="rounded-xl bg-[#13538A] p-2.5 text-white transition hover:bg-[#1a6aad] disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
