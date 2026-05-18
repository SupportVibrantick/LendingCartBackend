import type { ChangeEvent, KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import EmojiPicker, { type EmojiClickData } from "emoji-picker-react";
import toast from "react-hot-toast";
import { io, Socket } from "socket.io-client";
import {
  FiMessageCircle,
  FiMoreVertical,
  FiPaperclip,
  FiPhone,
  FiSearch,
  FiSend,
  FiSmile,
  FiVideo,
  FiX,
} from "react-icons/fi";
import { Search } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

type Conversation = {
  id: string;

  title?: string;

  type?: string;

  chatCategory?: "PRINCIPAL_BROKER" | "LOAN_OFFICER";

  lastMessage?: string;

  lastMessageAt?: string;

  unread?: boolean;

  unreadCount?: number;
};

type ChatMessage = {
  id: string;
  conversationId?: string;
  senderType?: string;
  senderName?: string;
  senderUserId?: string | null;
  type?: string;
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
  text?: string;
  createdAt: string;
};

type LoanPreviewChatProps = {
  applicationId?: string | null;
};

const getToken = () => sessionStorage.getItem("sub_broker_token");

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
    "bg-amber-200 text-amber-900",
    "bg-rose-200 text-rose-900",
    "bg-sky-200 text-sky-900",
    "bg-emerald-200 text-emerald-900",
    "bg-violet-200 text-violet-900",
    "bg-orange-200 text-orange-900",
  ];

  const seed = (value || "client")
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return tones[seed % tones.length];
};

const LoanPreviewChat = ({ applicationId }: LoanPreviewChatProps) => {
  const socketRef = useRef<Socket | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredConversations = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return conversations;

    return conversations.filter((chat) => {
      const title = chat.title?.toLowerCase() || "";
      const lastMessage = chat.lastMessage?.toLowerCase() || "";
      const type = chat.type?.toLowerCase() || "";
      return (
        title.includes(query) ||
        lastMessage.includes(query) ||
        type.includes(query)
      );
    });
  }, [conversations, searchTerm]);

  const onlineConversations = useMemo(
    () => conversations.slice(0, 6),
    [conversations],
  );

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    if (!containerRef.current) return;

    containerRef.current.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior,
    });
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const fetchMessages = async (conversationId: string) => {
    if (!conversationId) return;

    try {
      setMessagesLoading(true);
      const token = getToken();
      const res = await fetch(
        `${API_BASE}/subbroker/messaging/conversation/${encodeURIComponent(
          conversationId,
        )}/messages`,
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

  const fetchConversations = async () => {
    if (!applicationId) return;

    try {
      setChatLoading(true);
      const token = getToken();
      const res = await fetch(
        `${API_BASE}/subbroker/messaging/loan/${applicationId}/conversations`,
        {
          method: "GET",
          headers: { ...(token && { Authorization: `Bearer ${token}` }) },
        },
      );
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load chats");
      }

      const nextConversations = json?.data?.conversations || [];

      setConversations(nextConversations);

      setSelectedConversation((prev) => {
        if (!nextConversations.length) return null;

        if (!prev) {
          return null;
        }

        return (
          nextConversations.find((item: Conversation) => item.id === prev.id) ||
          nextConversations[0]
        );
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to load chats");
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
  if (!applicationId) return;

  fetchConversations();
}, [applicationId]);

  const ensureConversation = async (
    chatCategory: "PRINCIPAL_BROKER" | "LOAN_OFFICER",
  ) => {
    if (!applicationId) return;

    const token = getToken();
    const res = await fetch(`${API_BASE}/subbroker/messaging/conversations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({
        loanApplicationId: applicationId,
        chatCategory,
      }),
    });

    const json = await res.json();

    if (!res.ok || !json.success) {
      throw new Error(json.message || "Failed to create conversation");
    }

    return json.data;
  };

  const joinConversation = async (conversationId: string) => {
    await fetchMessages(conversationId);

    setConversations((prev) =>
      prev.map((item) =>
        item.id === conversationId
          ? { ...item, unread: false, unreadCount: 0 }
          : item,
      ),
    );

    try {
      const token = getToken();
      await fetch(
        `${API_BASE}/subbroker/messaging/conversation/${encodeURIComponent(
          conversationId,
        )}/read`,
        {
          method: "PATCH",
          headers: { ...(token && { Authorization: `Bearer ${token}` }) },
        },
      );
    } catch (err) {
      console.error("Failed to mark conversation as read", err);
    }

    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    socket.emit("joinConversation", {
      conversationId: String(conversationId),
    });
    socket.emit("markAsRead", { conversationId });
  };

  const handleSelectConversation = async (conversation: Conversation) => {
    try {
      let finalConversation = conversation;

      const isTemporary =
        conversation.id.startsWith("broker-") ||
        conversation.id.startsWith("officer-");

      if (isTemporary) {
        const created = await ensureConversation(
          conversation.chatCategory === "LOAN_OFFICER"
            ? "LOAN_OFFICER"
            : "PRINCIPAL_BROKER",
        );

        if (created?.id) {
          finalConversation = {
            ...conversation,
            id: created.id,
          };

          setConversations((prev) =>
            prev.map((item) =>
              item.id === conversation.id
                ? {
                    ...item,
                    id: created.id,
                  }
                : item,
            ),
          );
        }
      }

      setSelectedConversation(finalConversation);

      setConversations((prev) =>
        prev.map((item) =>
          item.id === finalConversation.id
            ? {
                ...item,
                unread: false,
                unreadCount: 0,
              }
            : item,
        ),
      );

      await joinConversation(finalConversation.id);
    } catch (err: any) {
      toast.error(err.message || "Failed to open conversation");
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setMessageText((prev) => prev + emojiData.emoji);
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
  };

  const handleSendMessage = async () => {
    if (!selectedConversation?.id) return;

    try {
      setSendingMessage(true);
      let fileUrl: string | null = null;
      let fileName: string | null = null;
      let mimeType: string | null = null;
      let fileSize: number | null = null;

      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);

        const token = getToken();
        const uploadRes = await fetch(`${API_BASE}/upload`, {
          method: "POST",
          headers: { ...(token && { Authorization: `Bearer ${token}` }) },
          body: formData,
        });
        const uploadJson = await uploadRes.json();

        if (!uploadRes.ok) {
          throw new Error(uploadJson.message || "File upload failed");
        }

        fileUrl = uploadJson.url;
        fileName = selectedFile.name;
        mimeType = selectedFile.type;
        fileSize = selectedFile.size;
      }

      const token = getToken();
      const res = await fetch(
        `${API_BASE}/subbroker/messaging/conversation/${encodeURIComponent(
          selectedConversation.id,
        )}/message`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            type: selectedFile ? "FILE" : "TEXT",
            ...(selectedFile
              ? {
                  fileUrl,
                  fileName,
                  mimeType,
                  fileSize,
                }
              : {
                  text: messageText.trim(),
                }),
          }),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to send message");
      }

      const nextMessage: ChatMessage = {
        conversationId: selectedConversation.id,
        ...json.data,
      };

      setMessages((prev) => [...prev, nextMessage]);
      setConversations((prev) =>
        prev.map((item) =>
          item.id === selectedConversation.id
            ? {
                ...item,
                lastMessage: nextMessage.text || nextMessage.fileName || "File",
                lastMessageAt: nextMessage.createdAt,
                unread: false,
                unreadCount: 0,
              }
            : item,
        ),
      );

      setMessageText("");
      removeSelectedFile();
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
    const token = getToken();

    if (!token) {
      console.log("No sub broker token found");
      return;
    }

    const socket = io(API_BASE, {
      transports: ["websocket"],
      auth: {
        token,
      },
      extraHeaders: {
        Authorization: `Bearer ${token}`,
      },
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
    });

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
    });

    socket.on("connect_error", (err) => {
      console.error("Socket connection error:", err.message);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleNewMessage = (msg: ChatMessage) => {
      setConversations((prev) =>
        prev.map((item) =>
          item.id === msg.conversationId
            ? {
                ...item,
                lastMessage: msg.text || msg.fileName || "File",
                lastMessageAt: msg.createdAt,
                unread: selectedConversation?.id !== msg.conversationId,
                unreadCount:
                  selectedConversation?.id !== msg.conversationId
                    ? (item.unreadCount || 0) + 1
                    : 0,
              }
            : item,
        ),
      );

      setMessages((prev) => {
        if (msg.conversationId !== selectedConversation?.id) return prev;
        if (prev.some((item) => item.id === msg.id)) return prev;
        const exists = prev.some((item) => item.id === msg.id);

        if (exists) return prev;

        return [...prev, msg];
      });
    };

    socket.on("newMessage", handleNewMessage);
    return () => {
      socket.off("newMessage", handleNewMessage);
    };
  }, [selectedConversation?.id]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleTyping = ({ userId }: { userId?: string }) =>
      setTypingUser(userId || null);
    const handleStopTyping = () => setTypingUser(null);

    socket.on("typing", handleTyping);
    socket.on("stopTyping", handleStopTyping);
    return () => {
      socket.off("typing", handleTyping);
      socket.off("stopTyping", handleStopTyping);
    };
  }, []);

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
        scrollToBottom("auto");
      }, 100);
    }
  }, [selectedConversation?.id]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom("smooth");
    }
  }, [messages]);

  const isChatSelected = Boolean(selectedConversation);

  return (
    <div
      className="grid h-[80vh] overflow-hidden rounded-[22px] border border-slate-200 
bg-slate-50 dark:bg-slate-950 
dark:border-slate-800 lg:grid-cols-[320px_minmax(0,1fr)]"
    >
      <aside
        className="flex h-full flex-col border-b border-slate-200 
bg-[#fbfbfa] 
dark:bg-slate-900 dark:border-slate-800 
lg:border-b-0 lg:border-r"
      >
        <div className="border-b border-slate-200 dark:border-slate-800 px-5 py-4">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search people or messages"
              className="h-10 w-full rounded-full border border-slate-200 bg-[#f2f2ef] pl-10 pr-10 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:focus:border-slate-600"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-400">
              <Search size={14} />
            </span>
          </div>
        </div>

        <div className="border-b border-slate-200 dark:border-slate-800 px-5 py-5">
          <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-300">
            Online
          </p>
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            {onlineConversations.length === 0 ? (
              <div className="text-xs text-slate-400">No active users</div>
            ) : (
              onlineConversations.map((chat) => (
                <div key={chat.id} className="relative shrink-0">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-full text-xs font-semibold ${getAvatarTone(chat.title)}`}
                  >
                    {getInitials(chat.title)}
                  </div>
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#fbfbfa] bg-lime-500" />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="border-b border-slate-200 dark:border-slate-800 px-5 py-4">
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-300">
            Messages
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {chatLoading ? (
            <div className="space-y-3 px-4 py-4">
              {[1, 2, 3, 4, 5].map((item) => (
                <div
                  key={item}
                  className="h-16 rounded-2xl border border-slate-200 bg-[#f2f2ef]"
                />
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <div className="rounded-full border border-slate-200 bg-white p-4 text-slate-500">
                <FiMessageCircle size={22} />
              </div>
              <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                {conversations.length === 0
                  ? "No conversations yet"
                  : "No matching chats"}
              </p>
              <p className="mt-2 max-w-[220px] text-xs leading-6 text-slate-400">
                {conversations.length === 0
                  ? "Chats will appear here once messaging starts."
                  : "Try another keyword or participant name."}
              </p>
            </div>
          ) : (
            <div className="px-3 py-3">
              {filteredConversations.map((chat) => {
                const isActive = selectedConversation?.id === chat.id;
                const avatarTone = getAvatarTone(chat.title);

                return (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => handleSelectConversation(chat)}
                    className={`mb-1.5 flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                      isActive
                        ? "border-slate-300 bg-[#efefec] dark:bg-slate-800 dark:border-slate-700"
                        : "border-transparent bg-transparent hover:border-slate-200 hover:bg-[#f4f4f1] dark:hover:bg-slate-800 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-full text-xs font-semibold ${avatarTone}`}
                      >
                        {getInitials(chat.title)}
                      </div>
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#fbfbfa] bg-lime-500" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-300">
                          {chat.title || "Conversation"}
                        </p>
                        <span className="text-[10px] text-slate-400">
                          {formatTime(chat.lastMessageAt)}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="truncate text-xs text-slate-500">
                          {chat.lastMessage || "No messages yet"}
                        </p>
                        {(chat.unreadCount || 0) > 0 && (
                          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-lime-500 px-1 text-[10px] font-semibold text-white">
                            {chat.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col bg-[#f8f8f6] dark:bg-slate-950">
        {!isChatSelected ? (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <div className="max-w-md">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
                <FiMessageCircle size={24} />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-slate-900 dark:text-slate-400">
                Select a conversation
              </h3>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                Choose any chat from the left panel to open the thread.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 dark:bg-slate-900 dark:border-slate-800 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative shrink-0">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-full text-xs font-semibold ${getAvatarTone(selectedConversation?.title)}`}
                  >
                    {getInitials(selectedConversation?.title)}
                  </div>
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#fbfbfa] bg-lime-500" />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-slate-900 dark:text-slate-300">
                    {selectedConversation?.title || "Conversation"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {typingUser ? "Typing..." : "Online"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-slate-500">
                <button className="rounded-full p-2 hover:bg-slate-100">
                  <FiVideo size={16} />
                </button>
                <button className="rounded-full p-2 hover:bg-slate-100">
                  <FiPhone size={16} />
                </button>
                <button className="rounded-full p-2 hover:bg-slate-100">
                  <FiMoreVertical size={16} />
                </button>
              </div>
            </div>

            <div
              ref={containerRef}
              className="flex-1 overflow-y-auto 
bg-[#f8f8f6] dark:bg-slate-950 px-4 py-5 sm:px-7"
            >
              {messagesLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className={`h-12 rounded-2xl border border-slate-200 ${
                        item % 2 === 0
                          ? "ml-auto w-44 bg-sky-100"
                          : "w-56 bg-white"
                      }`}
                    />
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-center">
                  <div>
                    <p className="text-sm font-medium text-slate-400">
                      Beginning of your conversation
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Send a message to start chatting.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {messages.map((msg, index) => {
                    const isOwnMessage = msg.senderType === "SUB_BROKER";
                    const previousMessage =
                      index > 0 ? messages[index - 1] : null;
                    const currentDay = formatDayLabel(msg.createdAt);
                    const previousDay = previousMessage
                      ? formatDayLabel(previousMessage.createdAt)
                      : null;
                    const showDayDivider = currentDay !== previousDay;

                    return (
                      <div key={msg.id}>
                        {showDayDivider && (
                          <div className="mb-5 flex items-center gap-3 text-[11px] text-slate-400">
                            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                            <span>{currentDay}</span>
                            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                          </div>
                        )}

                        <div
                          className={`flex ${
                            isOwnMessage ? "justify-end" : "justify-start"
                          }`}
                        >
                          <div
                            className={`flex max-w-[80%] items-end gap-2 ${
                              isOwnMessage ? "flex-row-reverse" : "flex-row"
                            }`}
                          >
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${getAvatarTone(
                                isOwnMessage
                                  ? "Sub Broker"
                                  : msg.senderName ||
                                      selectedConversation?.title,
                              )}`}
                            >
                              {getInitials(
                                isOwnMessage
                                  ? "Sub Broker"
                                  : msg.senderName ||
                                      selectedConversation?.title,
                              )}
                            </div>

                            <div>
                              <div className="mb-1 px-1 text-[10px] text-slate-400">
                                {formatTime(msg.createdAt)}
                              </div>

                              <div
                                className={`rounded-[18px] border px-4 py-2.5 text-sm leading-6 ${
                                  isOwnMessage
                                    ? "border-sky-500 bg-sky-500 text-white"
                                    : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                }`}
                              >
                                {msg.type === "FILE" && msg.fileUrl && (
                                  <div className={msg.text ? "mb-3" : ""}>
                                    {msg.mimeType?.startsWith("image/") ? (
                                      <img
                                        src={msg.fileUrl}
                                        alt={msg.fileName || "file"}
                                        className="max-h-56 rounded-[14px] object-cover"
                                      />
                                    ) : (
                                      <a
                                        href={msg.fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                                          isOwnMessage
                                            ? "border-sky-400 bg-sky-400 text-white"
                                            : "border-slate-200 bg-slate-50 text-slate-700"
                                        }`}
                                      >
                                        <FiPaperclip />
                                        {msg.fileName || "Download file"}
                                      </a>
                                    )}
                                  </div>
                                )}

                                {msg.text && (
                                  <p className="whitespace-pre-wrap break-words">
                                    {msg.text}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 bg-[#fbfbfa] dark:bg-slate-900 dark:border-slate-800 px-4 py-3 sm:px-5">
              {showEmojiPicker && (
                <div
                  ref={emojiPickerRef}
                  className="absolute bottom-24 left-4 z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700 sm:left-5"
                >
                  <EmojiPicker
                    onEmojiClick={handleEmojiClick}
                    height={380}
                    width={320}
                  />
                </div>
              )}

              {selectedFile && (
                <div className="mb-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded-full border border-slate-200 bg-slate-50 p-2 text-slate-500">
                      <FiPaperclip size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-700">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={removeSelectedFile}
                    className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                  >
                    <FiX size={16} />
                  </button>
                </div>
              )}

              <div
                className="flex items-center gap-2 border border-slate-200 bg-white 
  dark:bg-slate-900 dark:border-slate-800
  px-3 py-2.5 rounded-xl shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-full p-2 text-slate-500 
    hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition"
                >
                  <FiPaperclip size={17} />
                </button>

                <button
                  type="button"
                  onClick={() => setShowEmojiPicker((prev) => !prev)}
                  className="rounded-full p-2 text-slate-500 
    hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition"
                >
                  <FiSmile size={17} />
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  onChange={handleFileSelect}
                />

                <input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={handleMessageInputKeyDown}
                  placeholder="Write a message..."
                  className="min-w-0 flex-1 border-none bg-transparent px-2 text-sm 
    text-slate-700 dark:text-slate-200 
    outline-none placeholder:text-slate-400"
                />

                <button
                  onClick={handleSendMessage}
                  disabled={
                    !selectedConversation ||
                    (!messageText.trim() && !selectedFile) ||
                    sendingMessage
                  }
                  className="rounded-full p-2 
    bg-slate-100 text-slate-600 
    hover:bg-slate-200
    dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700
    disabled:cursor-not-allowed disabled:opacity-40
    transition"
                >
                  <FiSend size={17} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default LoanPreviewChat;
