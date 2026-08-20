import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import toast from "react-hot-toast";
import { MessageSquare, Send, X } from "lucide-react";
import { getOrgIdsFromToken } from "../../lib/chatSocket";
import { useChatSocket } from "../../lib/useChatSocket";
import { trackConversationRoom } from "../../lib/chatSocketManager";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const BRAND = "#3e86b7";

export type NetworkChatPeer = {
  /** Counterpart organization id (lenderId or brokerId). */
  orgId: string;
  name: string;
  email?: string;
};

type ChatMessage = {
  id: string;
  conversationId?: string;
  senderType?: string;
  senderUserId?: string;
  senderName?: string;
  type?: string;
  text?: string;
  createdAt: string;
};

type NetworkChatModalProps = {
  open: boolean;
  onClose: () => void;
  peer: NetworkChatPeer | null;
  /** `broker` opens chat with lenderOrgId; `lender` opens with brokerOrgId. */
  portal: "broker" | "lender";
  /** Optional override; defaults to sessionStorage tokenKey. */
  getToken?: () => string | null;
  tokenKey?: string;
};

function formatTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDayLabel(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year:
      date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

function initialsFromName(name?: string) {
  const parts = (name || "?").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

export default function NetworkChatModal({
  open,
  onClose,
  peer,
  portal,
  getToken: getTokenProp,
  tokenKey = "lender_token",
}: NetworkChatModalProps) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [counterpartName, setCounterpartName] = useState(peer?.name || "");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const activeConversationRef = useRef<string | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const getToken = useCallback(() => {
    if (getTokenProp) return getTokenProp();
    return sessionStorage.getItem(tokenKey);
  }, [getTokenProp, tokenKey]);

  const authHeaders = useCallback(
    (json = false): Record<string, string> => {
      const token = getToken();
      return {
        ...(json ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
    },
    [getToken],
  );
  const authHeadersRef = useRef(authHeaders);
  authHeadersRef.current = authHeaders;

  const mySenderType = portal === "broker" ? "BROKER" : "LENDER";

  const getBrokerOrgId = useCallback(() => {
    if (portal !== "broker") return null;
    return getOrgIdsFromToken(getToken()).brokerOrgId;
  }, [getToken, portal]);

  const getLenderOrgId = useCallback(() => {
    if (portal !== "lender") return null;
    return getOrgIdsFromToken(getToken()).lenderOrgId;
  }, [getToken, portal]);

  const isNearBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  const scrollToBottom = useCallback((force = false) => {
    if (!force && !stickToBottomRef.current) return;
    const run = () => {
      const el = messagesContainerRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
        return;
      }
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(run);
    });
  }, []);

  const onMessagesScroll = useCallback(() => {
    stickToBottomRef.current = isNearBottom();
  }, [isNearBottom]);

  const appendMessage = useCallback(
    (msg: ChatMessage, opts?: { forceScroll?: boolean }) => {
      if (!msg?.id) return;
      const forceScroll = opts?.forceScroll === true;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      if (forceScroll) {
        stickToBottomRef.current = true;
        scrollToBottom(true);
      } else {
        scrollToBottom();
      }
    },
    [scrollToBottom],
  );

  const loadMessages = useCallback(async (id: string) => {
    const res = await fetch(
      `${API_BASE}/messaging/conversation/${id}/messages?page=1&limit=50`,
      { headers: authHeadersRef.current() },
    );
    const json = await res.json();
    if (!res.ok || json.success === false) {
      throw new Error(json.message || "Failed to load messages");
    }
    const rows = Array.isArray(json.data?.messages)
      ? json.data.messages
      : Array.isArray(json.data)
        ? json.data
        : [];
    stickToBottomRef.current = true;
    setMessages(rows);
  }, []);
  const loadMessagesRef = useRef(loadMessages);
  loadMessagesRef.current = loadMessages;

  // After open + messages paint, always land at the latest message.
  useEffect(() => {
    if (!open || loading || !conversationId) return;
    stickToBottomRef.current = true;
    scrollToBottom(true);
    const t = window.setTimeout(() => {
      stickToBottomRef.current = true;
      scrollToBottom(true);
    }, 80);
    return () => window.clearTimeout(t);
  }, [open, loading, conversationId, scrollToBottom]);

  // Keep ref in sync so realtime handlers never drop messages after re-renders.
  useEffect(() => {
    activeConversationRef.current = conversationId;
    if (conversationId) {
      trackConversationRoom(conversationId);
    }
  }, [conversationId]);

  useEffect(() => {
    if (!open || !peer?.orgId) return;

    let cancelled = false;
    const peerOrgId = peer.orgId;
    const peerName = peer.name;

    const openConversation = async () => {
      setLoading(true);
      setMessages([]);
      setConversationId(null);
      activeConversationRef.current = null;
      stickToBottomRef.current = true;
      setCounterpartName(peerName);

      try {
        const body =
          portal === "broker"
            ? { lenderOrgId: peerOrgId }
            : { brokerOrgId: peerOrgId };

        const res = await fetch(`${API_BASE}/messaging/network-conversation`, {
          method: "POST",
          headers: authHeadersRef.current(true),
          body: JSON.stringify(body),
        });
        const json = await res.json();

        if (!res.ok || json.success === false) {
          throw new Error(json.message || "Failed to open chat");
        }

        const id = json.data?.id as string;
        if (!id) {
          throw new Error("Conversation id missing");
        }

        if (cancelled) return;

        if (json.data?.counterpart?.name) {
          setCounterpartName(json.data.counterpart.name);
        }

        activeConversationRef.current = id;
        setConversationId(id);
        trackConversationRoom(id);
        await loadMessagesRef.current(id);

        await fetch(`${API_BASE}/messaging/conversation/${id}/read`, {
          method: "PATCH",
          headers: authHeadersRef.current(),
        }).catch(() => undefined);
      } catch (error: any) {
        if (!cancelled) {
          toast.error(error?.message || "Failed to open chat");
          onCloseRef.current();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void openConversation();

    return () => {
      cancelled = true;
    };
  }, [open, peer?.orgId, peer?.name, portal]);

  useEffect(() => {
    if (!open) {
      setText("");
      setMessages([]);
      setConversationId(null);
      activeConversationRef.current = null;
    }
  }, [open]);

  useChatSocket({
    getToken,
    getBrokerOrgId: portal === "broker" ? getBrokerOrgId : undefined,
    getLenderOrgId: portal === "lender" ? getLenderOrgId : undefined,
    conversationId,
    onMessage: (msg) => {
      const activeId = activeConversationRef.current;
      if (!msg?.id || !activeId) return;
      if (msg.conversationId && msg.conversationId !== activeId) return;

      appendMessage({
        id: msg.id,
        conversationId: msg.conversationId || activeId,
        senderType: msg.senderType,
        senderName: msg.senderName,
        type: msg.type,
        text: msg.text,
        createdAt:
          typeof msg.createdAt === "string"
            ? msg.createdAt
            : new Date(msg.createdAt || Date.now()).toISOString(),
      });
    },
  });

  // Force-sync from API while open. Socket can miss events; this keeps both sides current.
  useEffect(() => {
    if (!open || !conversationId) return;

    let cancelled = false;
    let inFlight = false;

    const sync = async () => {
      if (inFlight || cancelled) return;
      inFlight = true;
      try {
        const res = await fetch(
          `${API_BASE}/messaging/conversation/${conversationId}/messages?page=1&limit=50`,
          { headers: authHeadersRef.current() },
        );
        const json = await res.json();
        if (cancelled || !res.ok || json.success === false) return;

        const rows = Array.isArray(json.data?.messages)
          ? json.data.messages
          : Array.isArray(json.data)
            ? json.data
            : [];

        let changed = false;
        setMessages((prev) => {
          const prevLast = prev[prev.length - 1]?.id;
          const nextLast = rows[rows.length - 1]?.id;
          if (
            prev.length === rows.length &&
            prevLast &&
            prevLast === nextLast &&
            prev[0]?.id === rows[0]?.id
          ) {
            return prev;
          }
          changed = true;
          return rows;
        });
        if (changed && stickToBottomRef.current) {
          scrollToBottom();
        }
      } catch {
        /* ignore poll errors */
      } finally {
        inFlight = false;
      }
    };

    void sync();
    const timer = window.setInterval(sync, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [open, conversationId, scrollToBottom]);

  const handleSend = async (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !conversationId || sending) return;

    setSending(true);
    try {
      const res = await fetch(
        `${API_BASE}/messaging/conversation/${conversationId}/message`,
        {
          method: "POST",
          headers: authHeaders(true),
          body: JSON.stringify({ type: "TEXT", text: trimmed }),
        },
      );
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.message || "Failed to send message");
      }

      const created = json.data as ChatMessage | undefined;
      if (created?.id) {
        appendMessage(
          {
            ...created,
            conversationId: created.conversationId || conversationId,
          },
          { forceScroll: true },
        );
      }
      setText("");
    } catch (error: any) {
      toast.error(error?.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const title = useMemo(
    () => counterpartName || peer?.name || "Chat",
    [counterpartName, peer?.name],
  );

  const messageItems = useMemo(() => {
    const items: Array<
      | { kind: "day"; id: string; label: string }
      | {
          kind: "message";
          msg: ChatMessage;
          mine: boolean;
          showName: boolean;
          showAvatar: boolean;
        }
    > = [];

    let lastDay = "";
    let lastSenderKey = "";

    messages.forEach((msg) => {
      const day = formatDayLabel(msg.createdAt);
      if (day && day !== lastDay) {
        items.push({ kind: "day", id: `day-${day}-${msg.id}`, label: day });
        lastDay = day;
        lastSenderKey = "";
      }

      const mine =
        msg.senderType === mySenderType ||
        (portal === "broker" && msg.senderType === "SUB_BROKER");
      const senderKey = mine
        ? "__me__"
        : `${msg.senderType || ""}:${msg.senderName || msg.senderUserId || "other"}`;
      const showName = !mine && senderKey !== lastSenderKey;
      const showAvatar = !mine && senderKey !== lastSenderKey;
      lastSenderKey = senderKey;

      items.push({ kind: "message", msg, mine, showName, showAvatar });
    });

    return items;
  }, [messages, mySenderType, portal]);

  if (!open || !peer) return null;

  const avatarLabel = initialsFromName(title);

  return (
    <div className="fixed inset-0 z-[100000] flex items-end sm:items-center justify-center p-0 sm:p-6">
      <button
        type="button"
        aria-label="Close chat overlay"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="relative z-10 flex h-[min(720px,100dvh)] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-slate-200/80 bg-white shadow-[0_25px_80px_-20px_rgba(15,23,42,0.5)] sm:rounded-3xl dark:border-slate-700 dark:bg-slate-900">
        {/* Header */}
        <div
          className="relative overflow-hidden px-5 pb-4 pt-4 text-white"
          style={{
            background: `linear-gradient(135deg, ${BRAND} 0%, #183b57 100%)`,
          }}
        >
          <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-12 left-10 h-28 w-28 rounded-full bg-white/5" />

          <div className="relative flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-sm font-bold ring-2 ring-white/30">
                  {avatarLabel}
                </div>
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-brand-600 bg-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold tracking-tight">
                  {title}
                </p>
                <p className="truncate text-xs text-white/80">
                  {peer.email || "Network conversation"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-white/90 transition hover:bg-white/15"
              aria-label="Close chat"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          onScroll={onMessagesScroll}
          className="flex-1 space-y-1 overflow-y-auto bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] px-4 py-4 dark:bg-none dark:bg-slate-950"
        >
          {loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-slate-500">
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-500"
                style={{ borderTopColor: BRAND }}
              />
              <p className="text-sm">Opening conversation…</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center">
              <div
                className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg"
                style={{ backgroundColor: BRAND }}
              >
                <MessageSquare size={24} />
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Start the conversation
              </p>
              <p className="mt-1 max-w-[240px] text-xs leading-relaxed text-slate-500">
                Messages appear here instantly once either side sends a note.
              </p>
            </div>
          ) : (
            messageItems.map((item) => {
              if (item.kind === "day") {
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-center py-3"
                  >
                    <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-slate-500 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                      {item.label}
                    </span>
                  </div>
                );
              }

              const { msg, mine, showName, showAvatar } = item;
              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"} ${showAvatar || mine ? "mt-3" : "mt-0.5"}`}
                >
                  {!mine ? (
                    showAvatar ? (
                      <div
                        className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ backgroundColor: BRAND }}
                      >
                        {initialsFromName(msg.senderName || title)}
                      </div>
                    ) : (
                      <div className="h-7 w-7 shrink-0" />
                    )
                  ) : null}

                  <div
                    className={`max-w-[75%] px-3.5 py-2 text-[13px] leading-relaxed shadow-sm ${
                      mine
                        ? "rounded-2xl rounded-br-md text-white"
                        : "rounded-2xl rounded-bl-md bg-white text-slate-800 ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700"
                    }`}
                    style={mine ? { backgroundColor: BRAND } : undefined}
                  >
                    {showName && msg.senderName ? (
                      <p
                        className="mb-1 text-[11px] font-semibold"
                        style={{ color: BRAND }}
                      >
                        {msg.senderName}
                      </p>
                    ) : null}
                    <p className="whitespace-pre-wrap break-words">
                      {msg.text || (msg.type === "FILE" ? "Attachment" : "")}
                    </p>
                    <p
                      className={`mt-1 text-right text-[10px] ${
                        mine ? "text-white/70" : "text-slate-400"
                      }`}
                    >
                      {formatTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Composer */}
        <form
          onSubmit={handleSend}
          className="border-t border-slate-200/80 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
        >
          <div
            className="flex items-end gap-2 rounded-2xl bg-slate-100 p-1.5 ring-1 ring-slate-200/80 focus-within:ring-2 dark:bg-slate-800 dark:ring-slate-700"
            style={{ ["--tw-ring-color" as string]: `${BRAND}55` }}
          >
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Type a message…"
              disabled={!conversationId || loading}
              className="max-h-28 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={!text.trim() || !conversationId || sending || loading}
              className="mb-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: BRAND }}
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </div>
          <p className="mt-2 px-1 text-[10px] text-slate-400">
            Enter to send · Shift+Enter for new line
          </p>
        </form>
      </div>
    </div>
  );
}
