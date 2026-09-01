import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EmojiPicker, { type EmojiClickData } from "emoji-picker-react";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import { getOrgIdsFromToken, isTemporaryConversationId } from "../../lib/chatSocket";
import { useChatSocket } from "../../lib/useChatSocket";
import {
  getConversationBadge,
  getConversationDisplayName,
  isPlaceholderConversation,
  type ChatConversationListItem,
} from "../../lib/chatConversation";
import { canSendChat } from "../../lib/lenderPermissions";
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

type ConversationParticipant = {
  id: string;
  conversationId: string;
  name: string;
  participantType: "LENDER" | "BROKER" | string;
  participantId: string;
  participantEmail?: string | null;
  lastReadAt?: string | null;
};

type Conversation = ChatConversationListItem & {
  participants?: ConversationParticipant[];
  brokerLabel?: string;
  participantSummary?: string;
  chatCategory?: "PRINCIPAL_BROKER" | "LOAN_OFFICER" | string | null;
  participant?: {
    id?: string;
    role?: string;
    name?: string;
    profileImage?: string | null;
  };
};

type ChatMessage = {
  id: string;
  conversationId?: string;
  senderType?: string;
  type?: string;
  fileUrl?: string;
  fileName?: string;
  senderUserId?: string;
  senderClientUserId?: string;
  senderName?: string;
  mimeType?: string;
  text?: string;
  createdAt: string;
};

type LoanPreviewChatProps = {
  applicationId?: string | null;
};

// const getToken = () => sessionStorage.getItem("lender_token");

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

const getParticipantSummary = (conversation?: Conversation | null) => {
  if (!conversation) return "Conversation";
  if (conversation.participantSummary) return conversation.participantSummary;

  const participants = conversation.participants || [];
  if (participants.length === 0)
    return conversation.type?.replace(/_/g, " ") || "Conversation";

  const brokerCount = participants.filter(
    (item) => item.participantType === "BROKER",
  ).length;
  const lenderCount = participants.filter(
    (item) => item.participantType === "LENDER",
  ).length;

  if (brokerCount && lenderCount) {
    return `${brokerCount} broker${brokerCount > 1 ? "s" : ""} \u00b7 ${lenderCount} lender${lenderCount > 1 ? "s" : ""}`;
  }

  return `${participants.length} participant${participants.length > 1 ? "s" : ""}`;
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

const Chat = ({ applicationId }: LoanPreviewChatProps) => {
  const activeConversationRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
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
  const isReadOnlyChat = !canSendChat();

  const getToken = useCallback(() => sessionStorage.getItem("lender_token"), []);
  const getLenderOrgId = useCallback(() => {
    try {
      const user = JSON.parse(
        sessionStorage.getItem("lender_user") ||
          sessionStorage.getItem("user") ||
          "{}",
      );
      if (user.organizationId) return user.organizationId;
    } catch {
      /* ignore */
    }
    return getOrgIdsFromToken(getToken()).lenderOrgId;
  }, [getToken]);

  const handleRealtimeMessage = useCallback((msg: ChatMessage) => {
    setConversations((prev) =>
      prev.map((item) =>
        item.id === msg.conversationId
          ? {
              ...item,
              lastMessage: msg.text || msg.fileName || "File",
              lastMessageAt: msg.createdAt,
              unread: activeConversationRef.current !== msg.conversationId,
            }
          : item,
      ),
    );

    setMessages((prev) => {
      if (msg.conversationId !== activeConversationRef.current) return prev;
      if (prev.some((m) => m.id === msg.id)) return prev;
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
    getLenderOrgId,
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
            headers: {
              ...(token && { Authorization: `Bearer ${token}` }),
            },
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
            nextConversations.find((item: Conversation) => item.id === prev.id) ||
            null
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

  const ensureConversation = async (conversation: Conversation) => {
    if (!applicationId || !conversation.chatCategory) return null;

    const token = getToken();
    const res = await fetch(`${API_BASE}/messaging/lender/conversation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({
        loanApplicationId: applicationId,
        chatCategory: conversation.chatCategory,
      }),
    });

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
        const created = await ensureConversation(conversation);
        if (!created?.id) {
          throw new Error("Failed to open conversation");
        }

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
            ...(token && {
              Authorization: `Bearer ${token}`,
            }),
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

      const newMessage = json.data;

      setMessages((prev) => {
        const alreadyExists = prev.some((item) => item.id === newMessage.id);

        if (alreadyExists) return prev;

        return [...prev, newMessage];
      });

      setConversations((prev) =>
        prev.map((item) =>
          item.id === selectedConversation.id
            ? {
                ...item,
                lastMessage: json.data.text || json.data.fileName || "File",
                lastMessageAt: json.data.createdAt,
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
      handleSendMessage();
    }
  };

  useEffect(() => {
    if (!applicationId || !conversations.length || selectedConversation) {
      return;
    }

    void handleSelectConversation(conversations[0]);
  }, [applicationId, conversations, selectedConversation]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchTerm]);

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

    const initConversation = async () => {
      let conversationId = selectedConversation.id;
      let placeholderKey = selectedConversation.id;

      if (
        isPlaceholderConversation(selectedConversation) &&
        selectedConversation.chatCategory
      ) {
        try {
          const created = await ensureConversation(selectedConversation);
          if (created?.id) {
            conversationId = created.id;
            setSelectedConversation((prev) =>
              prev ? { ...prev, id: created.id, isPlaceholder: false } : prev,
            );
            setConversations((prev) =>
              prev.map((item) =>
                item.id === placeholderKey
                  ? { ...item, id: created.id, isPlaceholder: false }
                  : item,
              ),
            );
          }
        } catch (err: any) {
          toast.error(err.message || "Failed to open conversation");
          return;
        }
      }

      await fetchMessages(conversationId);

      setConversations((prev) =>
        prev.map((item) =>
          item.id === conversationId || item.id === placeholderKey
            ? { ...item, unread: false, unreadCount: 0 }
            : item,
        ),
      );
    };

    initConversation();
  }, [selectedConversation?.id]);

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
      setTimeout(() => {
        scrollToBottom("auto"); // open chat at bottom
      }, 100);
    }
  }, [selectedConversation?.id]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom("smooth");
    }
  }, [messages]);

  const isChatSelected = Boolean(selectedConversation);

  const lenderUser = JSON.parse(
    sessionStorage.getItem("lender_user") ||
      sessionStorage.getItem("user") ||
      "{}",
  );

  const lenderUserId = lenderUser?.id || lenderUser?.userId || lenderUser?._id;

  const canSend =
    Boolean(selectedConversation) &&
    Boolean(messageText.trim()) &&
    !sendingMessage;

  const selectedDisplayName = selectedConversation
    ? getConversationDisplayName(selectedConversation)
    : "";

  return (
    <div className="grid h-[min(80vh,760px)] min-h-0 overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_18px_50px_rgba(24,59,87,0.08)] lg:grid-cols-[330px_minmax(0,1fr)]">
      <aside
        className={`flex h-full min-h-0 flex-col border-b border-slate-200/80 bg-gradient-to-b from-slate-50 to-white lg:border-b-0 lg:border-r ${
          showMobileThread ? "hidden lg:flex" : "flex"
        }`}
      >
        <div className="shrink-0 border-b border-slate-200/80 px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">Loan chat</p>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                isConnected
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                  : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
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
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#3e86b7]" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search people or messages"
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-[#3e86b7] focus:ring-2 focus:ring-[#3e86b7]/15"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
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

        <div className="flex shrink-0 items-center justify-between border-b border-slate-200/80 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">Messages</p>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
            {conversations.length}
          </span>
        </div>

        <div className="chat-panel-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 py-2 pb-3">
          {chatLoading ? (
            <div className="space-y-2 px-2 py-2">
              {[1, 2, 3, 4, 5].map((item) => (
                <div
                  key={item}
                  className="h-[72px] animate-pulse rounded-2xl bg-slate-100"
                />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-[#3e86b7] shadow-sm">
                <FiMessageCircle size={22} />
              </div>
              <p className="mt-4 text-sm font-medium text-slate-700">
                {debouncedSearch ? "No matching chats" : "No conversations yet"}
              </p>
              <p className="mt-2 max-w-[220px] text-xs leading-6 text-slate-400">
                {debouncedSearch
                  ? "Try another keyword or participant name."
                  : "Broker channels for this loan will appear here."}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map((chat) => {
                const isActive = selectedConversation?.id === chat.id;
                const displayName = getConversationDisplayName(chat);
                const badge = getConversationBadge(chat);
                const avatarTone = getAvatarTone(displayName);

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
                        ? "border-[#3e86b7]/30 bg-[#3e86b7]/8 shadow-sm ring-1 ring-[#3e86b7]/15"
                        : "border-transparent hover:border-slate-200 hover:bg-white hover:shadow-sm"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-full text-xs font-semibold ring-2 ring-white ${avatarTone}`}
                      >
                        {getInitials(displayName)}
                      </div>
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">
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
                        <p className="truncate text-xs text-slate-500">
                          {chat.lastMessage || getParticipantSummary(chat)}
                        </p>
                        {chat.unread ? (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#3e86b7] px-1.5 text-[10px] font-semibold text-white">
                            {chat.unreadCount || 1}
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
        className={`h-full min-h-0 flex-col bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_42%)] ${
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
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[#3e86b7] shadow-sm">
                <FiMessageCircle size={24} />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-slate-900">
                Select a conversation
              </h3>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                Pick a broker channel on the left to view and send messages for
                this loan.
              </p>
            </motion.div>
          </div>
        ) : (
          <>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowMobileThread(false)}
                  className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 lg:hidden"
                  aria-label="Back to conversations"
                >
                  <FiArrowLeft size={16} />
                </button>

                <div className="relative shrink-0">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-full text-xs font-semibold ring-2 ring-white ${getAvatarTone(selectedDisplayName)}`}
                  >
                    {getInitials(selectedDisplayName)}
                  </div>
                  <span
                    className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
                      isConnected ? "bg-emerald-500" : "bg-amber-400"
                    }`}
                  />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-slate-900 sm:text-lg">
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

              {!isReadOnlyChat ? (
                <div className="flex items-center gap-1 text-slate-500">
                  <button
                    type="button"
                    className="rounded-xl p-2 transition hover:bg-slate-100 hover:text-[#3e86b7]"
                    title="Video call (coming soon)"
                  >
                    <FiVideo size={16} />
                  </button>
                  <button
                    type="button"
                    className="rounded-xl p-2 transition hover:bg-slate-100 hover:text-[#3e86b7]"
                    title="Phone call (coming soon)"
                  >
                    <FiPhone size={16} />
                  </button>
                  <button
                    type="button"
                    className="rounded-xl p-2 transition hover:bg-slate-100 hover:text-[#3e86b7]"
                    title="More options"
                  >
                    <FiMoreVertical size={16} />
                  </button>
                </div>
              ) : null}
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
                          ? "ml-auto w-44 bg-[#3e86b7]/15"
                          : "w-56 bg-slate-100"
                      }`}
                    />
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-center">
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-6 py-8">
                    <p className="text-sm font-medium text-slate-700">
                      Start the conversation
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      {isReadOnlyChat
                        ? "Messages from your team will appear here."
                        : "Say hello to the broker team for this loan."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <AnimatePresence initial={false}>
                    {messages.map((msg, index) => {
                      const isOwnMessage =
                        msg.senderType === "LENDER" ||
                        msg.senderUserId === lenderUserId ||
                        msg.senderClientUserId === lenderUserId;

                      const previousMessage =
                        index > 0 ? messages[index - 1] : null;
                      const currentDay = formatDayLabel(msg.createdAt);
                      const previousDay = previousMessage
                        ? formatDayLabel(previousMessage.createdAt)
                        : null;
                      const showDayDivider = currentDay !== previousDay;
                      const grouped = isGroupedWithPrevious(msg, previousMessage);

                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 10, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ duration: 0.18 }}
                        >
                          {showDayDivider ? (
                            <div className="my-4 flex items-center gap-3 text-[11px] font-medium text-slate-400">
                              <div className="h-px flex-1 bg-slate-200" />
                              <span className="rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-slate-200/80">
                                {currentDay}
                              </span>
                              <div className="h-px flex-1 bg-slate-200" />
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
                                  className={`mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ring-2 ring-white ${getAvatarTone(
                                    isOwnMessage
                                      ? "Lender"
                                      : selectedDisplayName,
                                  )}`}
                                >
                                  {getInitials(
                                    isOwnMessage
                                      ? "Lender"
                                      : selectedDisplayName,
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
                                      <span className="font-semibold text-slate-500">
                                        {msg.senderName ||
                                          msg.senderType ||
                                          "User"}
                                      </span>
                                    ) : (
                                      <span className="font-semibold text-[#3e86b7]">
                                        You
                                      </span>
                                    )}
                                    <span>{formatTime(msg.createdAt)}</span>
                                  </div>
                                ) : null}

                                <div
                                  className={`rounded-[20px] px-4 py-2.5 text-sm leading-6 shadow-sm ${
                                    isOwnMessage
                                      ? "rounded-br-md bg-gradient-to-br from-[#3e86b7] to-[#183b57] text-white"
                                      : "rounded-bl-md border border-slate-200/80 bg-white text-slate-700"
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
                                              : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
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

            {isReadOnlyChat ? (
              <div className="shrink-0 border-t border-amber-200/80 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800 sm:px-5">
                Read-only access. You can view chat history but cannot send
                messages.
              </div>
            ) : (
              <div className="relative shrink-0 border-t border-slate-200/80 bg-white/95 px-3 py-3 backdrop-blur sm:px-5">
                {showEmojiPicker ? (
                  <div
                    ref={emojiPickerRef}
                    className="absolute bottom-full left-3 z-50 mb-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:left-4"
                  >
                    <EmojiPicker
                      onEmojiClick={handleEmojiClick}
                      height={380}
                      width={320}
                    />
                  </div>
                ) : null}

                <div className="flex items-end gap-2 rounded-[22px] border border-slate-200 bg-white px-2 py-2 shadow-sm transition-all focus-within:border-[#3e86b7] focus-within:ring-2 focus-within:ring-[#3e86b7]/15">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker((prev) => !prev)}
                    className={`rounded-xl p-2.5 transition ${
                      showEmojiPicker
                        ? "bg-[#3e86b7]/10 text-[#3e86b7]"
                        : "text-slate-500 hover:bg-slate-100 hover:text-[#3e86b7]"
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
                    className="min-w-0 flex-1 border-none bg-transparent px-1 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSendMessage()}
                    disabled={!canSend}
                    className={`rounded-xl p-2.5 transition-all ${
                      canSend
                        ? "bg-[#3e86b7] text-white shadow-md hover:bg-[#3578a5] active:scale-95"
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
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default Chat;
