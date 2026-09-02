import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import EmojiPicker, { type EmojiClickData } from "emoji-picker-react";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import { isTemporaryConversationId } from "../../lib/chatSocket";
import { useChatSocket } from "../../lib/useChatSocket";
import {
  getConversationDisplayName,
  isPrincipalClientBrokerChannel,
  type ChatConversationListItem,
} from "../../lib/chatConversation";
import {
  clientChatPortalConfig,
  conversationMessageUrl,
  conversationMessagesUrl,
  conversationReadUrl,
  loanConversationsUrl,
} from "../../lib/chatPortalConfig";
import {
  FiArrowLeft,
  FiLock,
  FiMessageCircle,
  FiSend,
  FiShield,
  FiSmile,
  FiUsers,
} from "react-icons/fi";
import { Loader2 } from "lucide-react";

type Conversation = ChatConversationListItem & {
  brokerName?: string;
};

type ChatMessage = {
  id: string;
  conversationId?: string;
  senderType?: string;
  senderName?: string;
  senderRoleLabel?: string | null;
  type?: string;
  text?: string;
  createdAt: string;
};

type ClientChatPanelProps = {
  applicationId?: string | null;
  applicationNumber?: string | null;
  onBack: () => void;
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
  if (!value) return "BT";
  return (
    value
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "BT"
  );
};

const roleLabelFor = (msg: ChatMessage) =>
  msg.senderRoleLabel ||
  (msg.senderType === "SUB_BROKER"
    ? "Co-Broker"
    : msg.senderType === "BROKER"
      ? "Broker Team"
      : null);

const ClientChatPanel = ({
  applicationId,
  applicationNumber,
  onBack,
}: ClientChatPanelProps) => {
  const config = clientChatPortalConfig;
  const activeConversationRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const getToken = useCallback(() => config.getToken(), [config]);

  const orgName = conversation
    ? conversation.brokerName || getConversationDisplayName(conversation)
    : "Your Broker Team";

  const handleRealtimeMessage = useCallback((msg: ChatMessage) => {
    if (!msg?.id) return;

    if (msg.conversationId === activeConversationRef.current) {
      setMessages((prev) => {
        if (prev.some((item) => item.id === msg.id)) return prev;
        return [...prev, msg];
      });
    }

    setConversation((prev) =>
      prev && prev.id === msg.conversationId
        ? {
            ...prev,
            lastMessage: msg.text || "New message",
            lastMessageAt: msg.createdAt,
          }
        : prev,
    );
  }, []);

  const { isConnected } = useChatSocket({
    getToken,
    conversationId: conversation?.id,
    conversationIds:
      conversation?.id && !isTemporaryConversationId(conversation.id)
        ? [conversation.id]
        : [],
    onMessage: handleRealtimeMessage,
    onError: (message) => toast.error(message),
  });

  const fetchConversation = useCallback(async () => {
    if (!applicationId) return;

    try {
      setChatLoading(true);
      const token = getToken();
      const res = await fetch(loanConversationsUrl(config, applicationId), {
        method: "GET",
        headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load chat");
      }

      const threads = (json?.data?.conversations || []) as Conversation[];
      const teamThread =
        threads.find(isPrincipalClientBrokerChannel) ||
        threads.find((item) => item.type === "CLIENT_BROKER") ||
        null;

      setConversation(teamThread);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load chat";
      toast.error(message);
    } finally {
      setChatLoading(false);
    }
  }, [applicationId, config, getToken]);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    if (!containerRef.current) return;
    containerRef.current.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior,
    });
  };

  const fetchMessages = async (conversationId: string) => {
    if (!conversationId || isTemporaryConversationId(conversationId)) return;

    try {
      setMessagesLoading(true);
      const token = getToken();
      const res = await fetch(conversationMessagesUrl(config, conversationId), {
        method: "GET",
        headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load messages");
      }

      setMessages(json?.data?.messages || []);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load messages";
      toast.error(message);
    } finally {
      setMessagesLoading(false);
    }
  };

  const markConversationRead = async (conversationId: string) => {
    try {
      const token = getToken();
      await fetch(conversationReadUrl(config, conversationId), {
        method: "PATCH",
        headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      });
    } catch {
      /* non-blocking */
    }
  };

  const handleSendMessage = async () => {
    if (!conversation?.id || !messageText.trim()) return;
    if (isTemporaryConversationId(conversation.id)) {
      toast.error("Chat is not ready yet. Please try again in a moment.");
      return;
    }

    try {
      setSendingMessage(true);
      const token = getToken();
      const response = await fetch(
        conversationMessageUrl(config, conversation.id),
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

      const newMessage = {
        ...(json.data?.message || json.data),
        conversationId: conversation.id,
      };

      setMessages((prev) => {
        if (prev.some((item) => item.id === newMessage.id)) return prev;
        return [...prev, newMessage];
      });

      setMessageText("");
      setShowEmojiPicker(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send";
      toast.error(message);
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

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setMessageText((prev) => prev + emojiData.emoji);
  };

  useEffect(() => {
    setConversation(null);
    setMessageText("");
    setMessages([]);
    setShowEmojiPicker(false);
  }, [applicationId]);

  useEffect(() => {
    if (!applicationId) return;
    void fetchConversation();
  }, [applicationId, fetchConversation]);

  useEffect(() => {
    activeConversationRef.current = conversation?.id || null;
  }, [conversation?.id]);

  useEffect(() => {
    if (!conversation?.id || isTemporaryConversationId(conversation.id)) return;

    void (async () => {
      await fetchMessages(conversation.id);
      await markConversationRead(conversation.id);
    })();
  }, [conversation?.id]);

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
    if (conversation?.id) {
      window.setTimeout(() => scrollToBottom("auto"), 100);
    }
  }, [conversation?.id]);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom("smooth");
  }, [messages]);

  const canSend =
    Boolean(conversation?.id) &&
    Boolean(messageText.trim()) &&
    !sendingMessage &&
    !isTemporaryConversationId(conversation?.id);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(5,150,105,0.07)] ring-1 ring-slate-100 lg:flex-row">
      {/* Organization sidebar */}
      <aside className="flex shrink-0 flex-col border-b border-slate-200/80 bg-gradient-to-b from-emerald-950 via-emerald-900 to-slate-900 lg:w-[300px] lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 px-4 py-3 lg:px-5 lg:pt-5">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-emerald-100/90 transition hover:bg-white/10 hover:text-white"
          >
            <FiArrowLeft size={14} />
            Back
          </button>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
              isConnected
                ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/30"
                : "bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/30"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isConnected ? "animate-pulse bg-emerald-400" : "bg-amber-400"
              }`}
            />
            {isConnected ? "Live" : "Connecting"}
          </span>
        </div>

        <div className="px-5 pb-5 pt-2 text-center lg:pt-4 lg:text-left">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold text-white ring-2 ring-white/20 backdrop-blur-sm lg:mx-0">
            {getInitials(orgName)}
          </div>
          <h2 className="text-lg font-semibold leading-snug text-white">
            {orgName}
          </h2>
          <p className="mt-1 text-xs font-medium uppercase tracking-wider text-emerald-300/80">
            Your Broker Team
          </p>
          {applicationNumber ? (
            <p className="mt-2 text-xs text-emerald-100/70">
              Loan #{applicationNumber}
            </p>
          ) : null}
        </div>

        <div className="mx-4 mb-4 rounded-xl bg-white/10 p-4 ring-1 ring-white/10 lg:mx-5">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-white/10 p-2 text-emerald-200">
              <FiUsers size={16} />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Team channel</p>
              <p className="mt-1 text-xs leading-5 text-emerald-100/75">
                Principal broker, loan officer, and co-brokers on your file can
                read and reply in this thread.
              </p>
            </div>
          </div>
        </div>

        <div className="hidden flex-1 lg:block" />

        <div className="border-t border-white/10 px-5 py-4 text-xs text-emerald-100/60">
          <div className="flex items-center gap-2">
            <FiLock size={12} />
            <span>Secure messaging with your broker</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <FiShield size={12} />
            <span>Lenders are not in this chat</span>
          </div>
        </div>
      </aside>

      {/* Chat thread */}
      <section className="flex min-h-0 flex-1 flex-col bg-[#f4f7f6]">
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-sm font-semibold text-white shadow-sm shadow-emerald-600/25">
            {getInitials(orgName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">
              {orgName}
            </p>
            <p className="text-xs text-slate-500">
              {isConnected ? "Real-time team chat" : "Reconnecting…"}
            </p>
          </div>
          <span className="hidden rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200 sm:inline-flex">
            Broker Team
          </span>
        </div>

        <div
          ref={containerRef}
          className="chat-panel-scrollbar relative min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-5"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgb(203 213 225 / 0.35) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        >
          {chatLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          ) : !conversation ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-emerald-600 shadow-sm">
                <FiMessageCircle size={24} />
              </div>
              <p className="mt-4 text-sm font-medium text-slate-700">
                Broker team chat unavailable
              </p>
              <p className="mt-2 max-w-sm text-xs leading-6 text-slate-400">
                Your broker team channel will appear here once your application
                is linked.
              </p>
            </div>
          ) : messagesLoading ? (
            <div className="mx-auto max-w-2xl space-y-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className={`h-12 animate-pulse rounded-2xl ${
                    item % 2 === 0
                      ? "ml-auto w-44 bg-emerald-500/15"
                      : "w-56 bg-white"
                  }`}
                />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="max-w-sm rounded-2xl border border-dashed border-slate-200 bg-white/90 px-8 py-10 text-center shadow-sm">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <FiMessageCircle size={22} />
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-800">
                  Start your conversation
                </p>
                <p className="mt-2 text-xs leading-6 text-slate-500">
                  Ask questions about your loan — your broker team will respond
                  here.
                </p>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-1">
              <AnimatePresence initial={false}>
                {messages.map((msg, index) => {
                  const isTeam =
                    msg.senderType === "BROKER" ||
                    msg.senderType === "SUB_BROKER";
                  const previous = index > 0 ? messages[index - 1] : null;
                  const showDay =
                    formatDayLabel(msg.createdAt) !==
                    formatDayLabel(previous?.createdAt);
                  const grouped =
                    previous &&
                    previous.senderType === msg.senderType &&
                    previous.senderName === msg.senderName &&
                    formatDayLabel(previous.createdAt) ===
                      formatDayLabel(msg.createdAt);
                  const roleLabel = roleLabelFor(msg);

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      {showDay ? (
                        <div className="my-5 flex items-center gap-3 text-[11px] font-medium text-slate-400">
                          <div className="h-px flex-1 bg-slate-200/80" />
                          <span className="rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-slate-200/80">
                            {formatDayLabel(msg.createdAt)}
                          </span>
                          <div className="h-px flex-1 bg-slate-200/80" />
                        </div>
                      ) : null}

                      <div
                        className={`flex py-0.5 ${!isTeam ? "justify-end" : "justify-start"} ${grouped ? "" : "mt-3"}`}
                      >
                        <div
                          className={`flex max-w-[88%] flex-col ${!isTeam ? "items-end" : "items-start"}`}
                        >
                          {!grouped ? (
                            <div
                              className={`mb-1 flex items-center gap-2 px-1 text-[10px] ${!isTeam ? "flex-row-reverse" : ""}`}
                            >
                              <span
                                className={`font-semibold ${!isTeam ? "text-emerald-700" : "text-slate-600"}`}
                              >
                                {isTeam
                                  ? msg.senderName || "Broker Team"
                                  : "You"}
                              </span>
                              {isTeam && roleLabel ? (
                                <span className="rounded-md bg-white px-1.5 py-0.5 text-[9px] font-medium text-slate-500 shadow-sm ring-1 ring-slate-200/80">
                                  {roleLabel}
                                </span>
                              ) : null}
                              <span className="text-slate-400">
                                {formatTime(msg.createdAt)}
                              </span>
                            </div>
                          ) : null}

                          <div
                            className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                              !isTeam
                                ? "rounded-br-md bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-emerald-600/20"
                                : "rounded-bl-md border border-slate-200/80 bg-white text-slate-700"
                            }`}
                          >
                            {msg.text ? (
                              <p className="whitespace-pre-wrap break-words">
                                {msg.text}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {conversation ? (
          <div className="relative shrink-0 border-t border-slate-200/80 bg-white px-3 py-3 sm:px-6">
            {showEmojiPicker ? (
              <div
                ref={emojiPickerRef}
                className="absolute bottom-full left-3 z-50 mb-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:left-6"
              >
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  height={360}
                  width={320}
                />
              </div>
            ) : null}

            <div className="mx-auto flex max-w-2xl items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-2 py-2 shadow-inner transition-all focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500/15">
              <button
                type="button"
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                className={`rounded-xl p-2.5 transition ${
                  showEmojiPicker
                    ? "bg-emerald-100 text-emerald-700"
                    : "text-slate-400 hover:bg-white hover:text-emerald-600"
                }`}
                title="Add emoji"
              >
                <FiSmile size={18} />
              </button>
              <input
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={handleMessageInputKeyDown}
                placeholder="Message your broker team…"
                className="min-w-0 flex-1 border-none bg-transparent px-1 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => void handleSendMessage()}
                disabled={!canSend}
                className={`rounded-xl p-2.5 transition-all ${
                  canSend
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-700 active:scale-95"
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
        ) : null}
      </section>
    </div>
  );
};

export default ClientChatPanel;
