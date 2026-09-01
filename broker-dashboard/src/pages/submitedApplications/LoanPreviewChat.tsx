import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EmojiPicker, { type EmojiClickData } from "emoji-picker-react";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  isTemporaryConversationId,
  getOrgIdsFromToken,
} from "../../lib/chatSocket";
import { useChatSocket } from "../../lib/useChatSocket";
import {
  getConversationBadge,
  getConversationDisplayName,
  isPlaceholderConversation,
  type ChatConversationListItem,
} from "../../lib/chatConversation";
import {
  FiArrowLeft,
  FiMessageCircle,
  FiMoreVertical,
  FiPhone,
  FiSearch,
  FiSend,
  FiSmile,
  FiVideo,
  FiX,
} from "react-icons/fi";
import { Loader2 } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

type Conversation = ChatConversationListItem & {
  chatCategory?: "PRINCIPAL_BROKER" | "LOAN_OFFICER";
  participant?: {
    id?: string;
    role?: string;
    name?: string;
    profileImage?: string | null;
  };
  unreadCount?: number;
};

type ChatMessage = {
  id: string;
  conversationId?: string;
  senderType?: string;
  senderUserId?: string;
  senderClientUserId?: string;
  senderName?: string;
  type?: string;
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
  text?: string;
  createdAt: string;
};

type LoanPreviewChatProps = {
  applicationId?: string | null;
  initialConversationId?: string | null;
};

const formatTime = (value?: string) => {
  if (!value) return "Now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Now";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatDayLabel = (value?: string) => {
  if (!value) return "Today";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Today";

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString([], {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const getInitials = (value?: string) => {
  if (!value) return "C";
  return (
    value
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "C"
  );
};

const getAvatarTone = (value?: string) => {
  const tones = [
    "bg-amber-100 text-amber-800 ring-amber-200/60",
    "bg-rose-100 text-rose-800 ring-rose-200/60",
    "bg-sky-100 text-sky-800 ring-sky-200/60",
    "bg-emerald-100 text-emerald-800 ring-emerald-200/60",
    "bg-violet-100 text-violet-800 ring-violet-200/60",
    "bg-orange-100 text-orange-800 ring-orange-200/60",
  ];

  const seed = (value || "client")
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return tones[seed % tones.length];
};

const isGroupedWithPrevious = (
  current: ChatMessage,
  previous: ChatMessage | null,
) => {
  if (!previous) return false;

  const sameSender =
    current.senderType === previous.senderType &&
    current.senderUserId === previous.senderUserId &&
    current.senderClientUserId === previous.senderClientUserId;

  return (
    sameSender &&
    formatDayLabel(current.createdAt) === formatDayLabel(previous.createdAt)
  );
};

const LoanPreviewChat = ({
  applicationId,
  initialConversationId,
}: LoanPreviewChatProps) => {
  const activeConversationRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showMobileThread, setShowMobileThread] = useState(false);

  const getToken = useCallback(() => sessionStorage.getItem("broker_token"), []);
  const getBrokerOrgId = useCallback(() => {
    try {
      const user = JSON.parse(sessionStorage.getItem("broker_user") || "{}");
      if (user.organizationId) return user.organizationId;
    } catch {
      /* ignore */
    }
    return getOrgIdsFromToken(getToken()).brokerOrgId;
  }, [getToken]);

  const handleRealtimeMessage = useCallback((msg: ChatMessage) => {
    if (!msg?.id) return;

    setConversations((prev) =>
      prev.map((item) =>
        item.id === msg.conversationId
          ? {
              ...item,
              lastMessage: msg.text || msg.fileName || "File",
              lastMessageAt: msg.createdAt,
              unread: activeConversationRef.current !== msg.conversationId,
              unreadCount:
                activeConversationRef.current !== msg.conversationId
                  ? (item.unreadCount || 0) + 1
                  : 0,
            }
          : item,
      ),
    );

    setMessages((prev) => {
      if (msg.conversationId !== activeConversationRef.current) return prev;
      if (prev.some((item) => item.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  const trackedConversationIds = useMemo(
    () =>
      conversations
        .map((conversation) => conversation.id)
        .filter((id) => !isTemporaryConversationId(id)),
    [conversations],
  );

  const { isConnected } = useChatSocket({
    getToken,
    getBrokerOrgId,
    conversationId: selectedConversation?.id,
    conversationIds: trackedConversationIds,
    onMessage: handleRealtimeMessage,
    onError: (message) => toast.error(message),
  });

  const isSearching = searchTerm.trim() !== debouncedSearch;

  const fetchConversations = useCallback(
    async (search = debouncedSearch) => {
      if (!applicationId) return;

      try {
        setChatLoading(true);
        const token = getToken();
        const params = new URLSearchParams();
        if (search) {
          params.set("search", search);
        }

        const query = params.toString();
        const res = await fetch(
          `${API_BASE}/messaging/loan/${applicationId}/conversations${query ? `?${query}` : ""}`,
          {
            method: "GET",
            headers: { ...(token && { Authorization: `Bearer ${token}` }) },
          },
        );
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.message || "Failed to load chats");
        }

        const nextConversations: Conversation[] =
          json?.data?.conversations || [];
        setConversations(nextConversations);
        setSelectedConversation((prev) => {
          if (!prev) return null;
          return (
            nextConversations.find((item) => item.id === prev.id) || null
          );
        });
      } catch (err: any) {
        toast.error(err.message || "Failed to load chats");
      } finally {
        setChatLoading(false);
      }
    },
    [applicationId, debouncedSearch, getToken],
  );

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    if (!containerRef.current) return;

    containerRef.current.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior,
    });
  };

  const fetchMessages = async (conversationId: string) => {
    if (!conversationId) return;

    try {
      setMessagesLoading(true);
      const token = getToken();
      const res = await fetch(
        `${API_BASE}/messaging/conversation/${conversationId}/messages`,
        {
          method: "GET",
          headers: { ...(token && { Authorization: `Bearer ${token}` }) },
        },
      );
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load messages");
      }

      setMessages(json?.data?.messages || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load messages");
    } finally {
      setMessagesLoading(false);
    }
  };

  const ensureConversation = async () => {
    if (!applicationId) return;

    const token = getToken();
    const res = await fetch(
      `${API_BASE}/messaging/conversations/broker-officer`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          loanApplicationId: applicationId,
        }),
      },
    );

    const json = await res.json();

    if (!res.ok || !json.success) {
      throw new Error(json.message || "Failed to create conversation");
    }

    return json.data;
  };

  const handleSelectConversation = async (conversation: Conversation) => {
    try {
      let finalConversation = conversation;

      if (isPlaceholderConversation(conversation)) {
        const created = await ensureConversation();

        if (created?.id) {
          finalConversation = {
            ...conversation,
            id: created.id,
            isPlaceholder: false,
          };

          setConversations((prev) =>
            prev.map((item) =>
              item.id === conversation.id
                ? { ...item, id: created.id, isPlaceholder: false }
                : item,
            ),
          );
        }
      }

      setSelectedConversation(finalConversation);
      setMessages([]);
      setShowMobileThread(true);

      setConversations((prev) =>
        prev.map((item) =>
          item.id === finalConversation.id
            ? { ...item, unread: false, unreadCount: 0 }
            : item,
        ),
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to open conversation");
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setMessageText((prev) => prev + emojiData.emoji);
  };

  const handleSendMessage = async () => {
    if (!selectedConversation?.id || !messageText.trim()) return;

    try {
      setSendingMessage(true);
      const token = getToken();

      const response = await fetch(
        `${API_BASE}/messaging/conversation/${selectedConversation.id}/message`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            type: "TEXT",
            text: messageText.trim(),
          }),
        },
      );

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.message || "Failed to send message");
      }

      const newMessage = json.data?.message || json.data;

      setMessages((prev) => {
        if (prev.some((item) => item.id === newMessage.id)) return prev;
        return [...prev, newMessage];
      });

      setConversations((prev) =>
        prev.map((item) =>
          item.id === selectedConversation.id
            ? {
                ...item,
                lastMessage: newMessage.text || newMessage.fileName || "File",
                lastMessageAt: newMessage.createdAt,
              }
            : item,
        ),
      );

      setMessageText("");
      setShowEmojiPicker(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to send");
    } finally {
      setSendingMessage(false);
    }
  };

  const handleMessageInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (!applicationId || !conversations.length || selectedConversation) {
      return;
    }

    void handleSelectConversation(conversations[0]);
  }, [applicationId, conversations, selectedConversation]);

  useEffect(() => {
    setConversations([]);
    setSelectedConversation(null);
    setMessageText("");
    setMessages([]);
    setShowEmojiPicker(false);
    setTypingUser(null);
    setSearchTerm("");
    setDebouncedSearch("");
    setShowMobileThread(false);
  }, [applicationId]);

  useEffect(() => {
    if (!applicationId) return;
    void fetchConversations(debouncedSearch);
  }, [applicationId, debouncedSearch, fetchConversations]);

  useEffect(() => {
    activeConversationRef.current = selectedConversation?.id || null;
  }, [selectedConversation?.id]);

  useEffect(() => {
    if (!selectedConversation?.id) return;
    if (isTemporaryConversationId(selectedConversation.id)) return;

    const initConversation = async () => {
      await fetchMessages(selectedConversation.id);

      try {
        const token = getToken();
        await fetch(
          `${API_BASE}/messaging/conversation/${selectedConversation.id}/read`,
          {
            method: "PATCH",
            headers: { ...(token && { Authorization: `Bearer ${token}` }) },
          },
        );
      } catch {
        // non-blocking
      }

      setConversations((prev) =>
        prev.map((item) =>
          item.id === selectedConversation.id
            ? { ...item, unread: false, unreadCount: 0 }
            : item,
        ),
      );
    };

    void initConversation();
  }, [selectedConversation?.id, getToken]);

  useEffect(() => {
    if (!initialConversationId || conversations.length === 0) return;

    const match = conversations.find((c) => c.id === initialConversationId);
    if (match && selectedConversation?.id !== match.id) {
      void handleSelectConversation(match);
    }
  }, [conversations, initialConversationId, selectedConversation?.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showEmojiPicker &&
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  useEffect(() => {
    if (selectedConversation?.id) {
      setTimeout(() => scrollToBottom("auto"), 100);
    }
  }, [selectedConversation?.id]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom("smooth");
    }
  }, [messages]);

  const brokerUser = JSON.parse(sessionStorage.getItem("broker_user") || "{}");
  const brokerUserId =
    brokerUser?.id || brokerUser?.userId || brokerUser?._id;

  const isChatSelected = Boolean(selectedConversation);
  const canSend =
    Boolean(selectedConversation) &&
    Boolean(messageText.trim()) &&
    !sendingMessage;

  const selectedDisplayName = selectedConversation
    ? getConversationDisplayName(selectedConversation)
    : "";

  const getOwnSenderLabel = (msg: ChatMessage) =>
    msg.senderType === "SUB_BROKER" ? "Sub Broker" : "You";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="grid h-full min-h-0 flex-1 overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_18px_50px_rgba(14,165,233,0.08)] dark:border-slate-800 dark:bg-slate-950 lg:grid-cols-[330px_minmax(0,1fr)]">
      <aside
        className={`flex h-full min-h-0 flex-col border-b border-slate-200/80 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 lg:border-b-0 lg:border-r dark:border-slate-800 ${
          showMobileThread ? "hidden lg:flex" : "flex"
        }`}
      >
        <div className="shrink-0 border-b border-slate-200/80 px-4 py-4 dark:border-slate-800">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Loan chat
            </p>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                isConnected
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800"
                  : "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isConnected
                    ? "animate-pulse bg-emerald-500"
                    : "bg-amber-500"
                }`}
              />
              {isConnected ? "Live" : "Connecting"}
            </span>
          </div>

          <div className="group relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-sky-500" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search people or messages"
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                aria-label="Clear search"
              >
                <FiX size={14} />
              </button>
            ) : isSearching || chatLoading ? (
              <Loader2
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
              />
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between border-b border-slate-200/80 px-4 py-3 dark:border-slate-800">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">
            Messages
          </p>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {conversations.length}
          </span>
        </div>

        <div className="chat-panel-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 py-2 pb-3">
          {chatLoading ? (
            <div className="space-y-2 px-2 py-2">
              {[1, 2, 3, 4, 5].map((item) => (
                <div
                  key={item}
                  className="h-[72px] animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800"
                />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sky-500 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <FiMessageCircle size={22} />
              </div>
              <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                {debouncedSearch ? "No matching chats" : "No conversations yet"}
              </p>
              <p className="mt-2 max-w-[220px] text-xs leading-6 text-slate-400">
                {debouncedSearch
                  ? "Try another keyword or participant name."
                  : "Client, lender, and team chats for this loan appear here."}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map((chat) => {
                const isActive = selectedConversation?.id === chat.id;
                const displayName = getConversationDisplayName(chat);
                const badge = getConversationBadge(chat);
                const avatarTone = getAvatarTone(displayName);
                const unreadCount = chat.unreadCount || (chat.unread ? 1 : 0);

                return (
                  <motion.button
                    key={chat.id}
                    type="button"
                    layout
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => void handleSelectConversation(chat)}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all ${
                      isActive
                        ? "border-sky-500/30 bg-sky-500/8 shadow-sm ring-1 ring-sky-500/15 dark:bg-sky-500/10"
                        : "border-transparent hover:border-slate-200 hover:bg-white hover:shadow-sm dark:hover:border-slate-700 dark:hover:bg-slate-900"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-full text-xs font-semibold ring-2 ring-white dark:ring-slate-900 ${avatarTone}`}
                      >
                        {getInitials(displayName)}
                      </div>
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-200">
                          {displayName}
                        </p>
                        <span className="shrink-0 text-[10px] text-slate-400">
                          {formatTime(chat.lastMessageAt)}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {chat.lastMessage || "No messages yet"}
                        </p>
                        {unreadCount > 0 ? (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-sky-500 px-1.5 text-[10px] font-semibold text-white">
                            {unreadCount}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      <section
        className={`flex h-full min-h-0 flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_42%)] dark:from-slate-950 dark:to-slate-900 ${
          showMobileThread || selectedConversation
            ? "flex"
            : "hidden lg:flex"
        }`}
      >
        {!isChatSelected ? (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sky-500 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <FiMessageCircle size={24} />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-slate-900 dark:text-slate-200">
                Select a conversation
              </h3>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                Open any client, lender, or team chat from the left panel.
              </p>
            </motion.div>
          </div>
        ) : (
          <>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowMobileThread(false)}
                  className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 lg:hidden dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  aria-label="Back to conversations"
                >
                  <FiArrowLeft size={16} />
                </button>

                <div className="relative shrink-0">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-full text-xs font-semibold ring-2 ring-white dark:ring-slate-900 ${getAvatarTone(selectedDisplayName)}`}
                  >
                    {getInitials(selectedDisplayName)}
                  </div>
                  <span
                    className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 ${
                      isConnected ? "bg-emerald-500" : "bg-amber-400"
                    }`}
                  />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-slate-900 dark:text-slate-200 sm:text-lg">
                    {selectedDisplayName}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs text-slate-500">
                      {typingUser
                        ? "Typing..."
                        : isConnected
                          ? `Connected \u00b7 real-time`
                          : "Reconnecting..."}
                    </p>
                    {selectedConversation ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getConversationBadge(selectedConversation).className}`}
                      >
                        {getConversationBadge(selectedConversation).label}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 text-slate-500">
                <button
                  type="button"
                  className="rounded-xl p-2 transition hover:bg-slate-100 hover:text-sky-500 dark:hover:bg-slate-800"
                  title="Video call (coming soon)"
                >
                  <FiVideo size={16} />
                </button>
                <button
                  type="button"
                  className="rounded-xl p-2 transition hover:bg-slate-100 hover:text-sky-500 dark:hover:bg-slate-800"
                  title="Phone call (coming soon)"
                >
                  <FiPhone size={16} />
                </button>
                <button
                  type="button"
                  className="rounded-xl p-2 transition hover:bg-slate-100 hover:text-sky-500 dark:hover:bg-slate-800"
                  title="More options"
                >
                  <FiMoreVertical size={16} />
                </button>
              </div>
            </div>

            <div
              ref={containerRef}
              className="chat-panel-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-4 sm:px-6 sm:py-5"
            >
              {messagesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className={`h-12 animate-pulse rounded-2xl ${
                        item % 2 === 0
                          ? "ml-auto w-44 bg-sky-500/15"
                          : "w-56 bg-slate-100 dark:bg-slate-800"
                      }`}
                    />
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-center">
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-6 py-8 dark:border-slate-700 dark:bg-slate-900/80">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Start the conversation
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      Send a message to begin chatting with this contact.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <AnimatePresence initial={false}>
                    {messages.map((msg, index) => {
                      const isOwnMessage =
                        msg.senderUserId === brokerUserId ||
                        msg.senderClientUserId === brokerUserId;

                      const previousMessage =
                        index > 0 ? messages[index - 1] : null;
                      const currentDay = formatDayLabel(msg.createdAt);
                      const previousDay = previousMessage
                        ? formatDayLabel(previousMessage.createdAt)
                        : null;
                      const showDayDivider = currentDay !== previousDay;
                      const grouped = isGroupedWithPrevious(
                        msg,
                        previousMessage,
                      );

                      const peerLabel = selectedDisplayName;
                      const ownLabel =
                        msg.senderType === "SUB_BROKER"
                          ? "Sub Broker"
                          : "Broker";

                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 10, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ duration: 0.18 }}
                        >
                          {showDayDivider ? (
                            <div className="my-4 flex items-center gap-3 text-[11px] font-medium text-slate-400">
                              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                              <span className="rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-700">
                                {currentDay}
                              </span>
                              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                            </div>
                          ) : null}

                          <div
                            className={`flex py-1 ${isOwnMessage ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-3"}`}
                          >
                            <div
                              className={`flex max-w-[min(88%,520px)] items-end gap-2 ${
                                isOwnMessage ? "flex-row-reverse" : "flex-row"
                              }`}
                            >
                              {!grouped ? (
                                <div
                                  className={`mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ring-2 ring-white dark:ring-slate-900 ${getAvatarTone(
                                    isOwnMessage ? ownLabel : peerLabel,
                                  )}`}
                                >
                                  {getInitials(
                                    isOwnMessage ? ownLabel : peerLabel,
                                  )}
                                </div>
                              ) : (
                                <div className="w-8 shrink-0" />
                              )}

                              <div className="min-w-0">
                                {!grouped ? (
                                  <div
                                    className={`mb-1 flex items-center gap-2 px-1 text-[10px] text-slate-400 ${
                                      isOwnMessage ? "justify-end" : ""
                                    }`}
                                  >
                                    {!isOwnMessage ? (
                                      <span className="font-semibold text-slate-500 dark:text-slate-400">
                                        {msg.senderName ||
                                          msg.senderType ||
                                          "User"}
                                      </span>
                                    ) : (
                                      <span className="font-semibold text-sky-600 dark:text-sky-400">
                                        {getOwnSenderLabel(msg)}
                                      </span>
                                    )}
                                    <span>{formatTime(msg.createdAt)}</span>
                                  </div>
                                ) : null}

                                <div
                                  className={`rounded-[20px] px-4 py-2.5 text-sm leading-6 shadow-sm ${
                                    isOwnMessage
                                      ? "rounded-br-md bg-gradient-to-br from-sky-500 to-sky-700 text-white"
                                      : "rounded-bl-md border border-slate-200/80 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                  }`}
                                >
                                  {msg.type === "FILE" && msg.fileUrl ? (
                                    <div className={msg.text ? "mb-2" : ""}>
                                      {msg.mimeType?.startsWith("image/") ? (
                                        <a
                                          href={msg.fileUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="block overflow-hidden rounded-xl"
                                        >
                                          <img
                                            src={msg.fileUrl}
                                            alt={msg.fileName || "file"}
                                            className="max-h-56 w-full object-cover transition hover:scale-[1.02]"
                                          />
                                        </a>
                                      ) : (
                                        <a
                                          href={msg.fileUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className={`block rounded-xl border px-3 py-2 text-sm transition hover:opacity-90 ${
                                            isOwnMessage
                                              ? "border-white/20 bg-white/10 text-white"
                                              : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                                          }`}
                                        >
                                          {msg.fileName || "Download file"}
                                        </a>
                                      )}
                                    </div>
                                  ) : null}

                                  {msg.text ? (
                                    <p className="whitespace-pre-wrap break-words">
                                      {msg.text}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div className="relative shrink-0 border-t border-slate-200/80 bg-white/95 px-3 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:px-5">
              {showEmojiPicker ? (
                <div
                  ref={emojiPickerRef}
                  className="absolute bottom-full left-3 z-50 mb-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:left-4"
                >
                  <EmojiPicker
                    onEmojiClick={handleEmojiClick}
                    height={380}
                    width={320}
                  />
                </div>
              ) : null}

              <div className="flex items-end gap-2 rounded-[22px] border border-slate-200 bg-white px-2 py-2 shadow-sm transition-all focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/15 dark:border-slate-700 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker((prev) => !prev)}
                  className={`rounded-xl p-2.5 transition ${
                    showEmojiPicker
                      ? "bg-sky-500/10 text-sky-600"
                      : "text-slate-500 hover:bg-slate-100 hover:text-sky-500 dark:hover:bg-slate-800"
                  }`}
                  title="Add emoji"
                >
                  <FiSmile size={18} />
                </button>
                <input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={handleMessageInputKeyDown}
                  placeholder="Write a message..."
                  className="min-w-0 flex-1 border-none bg-transparent px-1 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200"
                />
                <button
                  type="button"
                  onClick={() => void handleSendMessage()}
                  disabled={!canSend}
                  className={`rounded-xl p-2.5 transition-all ${
                    canSend
                      ? "bg-sky-500 text-white shadow-md hover:bg-sky-600 active:scale-95"
                      : "cursor-not-allowed text-slate-300"
                  }`}
                  title="Send message"
                >
                  {sendingMessage ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <FiSend size={18} />
                  )}
                </button>
              </div>
            </div>
          </>
        )}
        </section>
      </div>
    </div>
  );
};

export default LoanPreviewChat;
