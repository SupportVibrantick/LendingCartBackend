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
    onError: (message) => {
      toast.error(message, { id: "chat-socket-error" });
    },
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white lg:flex-row">
      {/* Broker team info panel */}
      <aside className="flex h-auto shrink-0 flex-col border-b border-[#E2E8F0] bg-[#F7F9FC] lg:h-full lg:w-[280px] lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 px-4 py-3 lg:px-5 lg:pt-5">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[#4C78F5] transition hover:bg-[#4C78F5]/5"
          >
            <FiArrowLeft size={14} />
            Back
          </button>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
              isConnected
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isConnected ? "animate-pulse bg-emerald-500" : "bg-amber-500"
              }`}
            />
            {isConnected ? "Live" : "Connecting"}
          </span>
        </div>

        <div className="px-5 pb-4 pt-1 text-center lg:pt-3 lg:text-left">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-[10px] bg-[#4C78F5] text-[16px] font-bold text-white shadow-sm shadow-[#4C78F5]/25 lg:mx-0">
            {getInitials(orgName)}
          </div>
          <h2 className="text-[16px] font-semibold leading-snug text-[#111827]">
            {orgName}
          </h2>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
            Your Broker Team
          </p>
          {applicationNumber ? (
            <p className="mt-2 inline-flex rounded-md bg-white px-2 py-1 font-mono text-[11px] font-semibold text-[#4C78F5] ring-1 ring-[#E2E8F0]">
              #{applicationNumber}
            </p>
          ) : null}
        </div>

        <div className="mx-4 mb-4 rounded-[10px] border border-[#E2E8F0] bg-white p-4 lg:mx-5">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-[#4C78F5]/10 p-2 text-[#4C78F5]">
              <FiUsers size={16} />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[#111827]">
                Team channel
              </p>
              <p className="mt-1 text-[12px] leading-5 text-[#64748B]">
                Principal broker, loan officer, and co-brokers on your file can
                read and reply here.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-auto hidden border-t border-[#E2E8F0] px-5 py-4 text-[12px] text-[#64748B] lg:block">
          <div className="flex items-center gap-2">
            <FiLock size={12} className="text-[#4C78F5]" />
            <span>Secure messaging with your broker</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <FiShield size={12} className="text-[#4C78F5]" />
            <span>Lenders are not in this chat</span>
          </div>
        </div>
      </aside>

      {/* Chat thread */}
      <section className="flex min-h-0 flex-1 flex-col bg-white">
        <div className="flex shrink-0 items-center gap-3 border-b border-[#E2E8F0] bg-white px-4 py-3 sm:px-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-[#4C78F5] text-sm font-semibold text-white">
            {getInitials(orgName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-[#111827]">
              {orgName}
            </p>
            <p className="text-[12px] text-[#64748B]">
              {isConnected ? "Real-time team chat" : "Reconnecting…"}
            </p>
          </div>
          <span className="hidden rounded-full bg-[#4C78F5]/10 px-2.5 py-1 text-[10px] font-semibold text-[#4C78F5] ring-1 ring-[#4C78F5]/20 sm:inline-flex">
            Broker Team
          </span>
        </div>

        <div
          ref={containerRef}
          className="chat-panel-scrollbar relative min-h-0 flex-1 overflow-y-auto bg-[#F7F9FC] px-3 py-4 sm:px-6 sm:py-5"
        >
          {chatLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#4C78F5]" />
            </div>
          ) : !conversation ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="rounded-[10px] border border-[#E2E8F0] bg-white p-4 text-[#4C78F5] shadow-sm">
                <FiMessageCircle size={24} />
              </div>
              <p className="mt-4 text-[14px] font-semibold text-[#111827]">
                Broker team chat unavailable
              </p>
              <p className="mt-2 max-w-sm text-[13px] leading-6 text-[#64748B]">
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
                      ? "ml-auto w-44 bg-[#4C78F5]/15"
                      : "w-56 bg-white"
                  }`}
                />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="max-w-sm rounded-[10px] border border-[#E2E8F0] bg-white px-8 py-10 text-center shadow-sm">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#4C78F5]/10 text-[#4C78F5]">
                  <FiMessageCircle size={22} />
                </div>
                <p className="mt-4 text-[15px] font-semibold text-[#111827]">
                  Start your conversation
                </p>
                <p className="mt-2 text-[13px] leading-6 text-[#64748B]">
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
                        <div className="my-5 flex items-center gap-3 text-[11px] font-medium text-[#94A3B8]">
                          <div className="h-px flex-1 bg-[#E2E8F0]" />
                          <span className="rounded-full bg-white px-3 py-1 ring-1 ring-[#E2E8F0]">
                            {formatDayLabel(msg.createdAt)}
                          </span>
                          <div className="h-px flex-1 bg-[#E2E8F0]" />
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
                                className={`font-semibold ${!isTeam ? "text-[#4C78F5]" : "text-[#64748B]"}`}
                              >
                                {isTeam
                                  ? msg.senderName || "Broker Team"
                                  : "You"}
                              </span>
                              {isTeam && roleLabel ? (
                                <span className="rounded-md bg-white px-1.5 py-0.5 text-[9px] font-medium text-[#64748B] ring-1 ring-[#E2E8F0]">
                                  {roleLabel}
                                </span>
                              ) : null}
                              <span className="text-[#94A3B8]">
                                {formatTime(msg.createdAt)}
                              </span>
                            </div>
                          ) : null}

                          <div
                            className={`rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed shadow-sm ${
                              !isTeam
                                ? "rounded-br-md bg-[#4C78F5] text-white"
                                : "rounded-bl-md border border-[#E2E8F0] bg-white text-[#111827]"
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
          <div className="relative shrink-0 border-t border-[#E2E8F0] bg-white px-3 py-3 sm:px-6">
            {showEmojiPicker ? (
              <div
                ref={emojiPickerRef}
                className="absolute bottom-full left-3 z-50 mb-3 overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white shadow-xl sm:left-6"
              >
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  height={360}
                  width={320}
                />
              </div>
            ) : null}

            <div className="mx-auto flex max-w-2xl items-end gap-2 rounded-[10px] border border-[#E2E8F0] bg-[#F7F9FC] px-2 py-2 transition-all focus-within:border-[#4C78F5] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#4C78F5]/15">
              <button
                type="button"
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                className={`rounded-lg p-2.5 transition ${
                  showEmojiPicker
                    ? "bg-[#4C78F5]/10 text-[#4C78F5]"
                    : "text-[#94A3B8] hover:bg-white hover:text-[#4C78F5]"
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
                className="min-w-0 flex-1 border-none bg-transparent px-1 py-2.5 text-[14px] text-[#111827] outline-none placeholder:text-[#94A3B8]"
              />
              <button
                type="button"
                onClick={() => void handleSendMessage()}
                disabled={!canSend}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-all ${
                  canSend
                    ? "bg-[#4C78F5] text-white hover:bg-[#3B66E0] active:scale-95"
                    : "cursor-not-allowed bg-[#E2E8F0] text-[#94A3B8]"
                }`}
                title="Send message"
              >
                {sendingMessage ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <FiSend size={16} />
                )}
                <span className="hidden sm:inline">Send</span>
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default ClientChatPanel;
