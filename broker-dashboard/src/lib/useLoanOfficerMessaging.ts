import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import type { ChatConversationListItem } from "./chatConversation";
import { isTemporaryConversationId } from "./chatSocket";
import { LO_USER_KEY, getLoanOfficerToken } from "./loanOfficerApi";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export type InboxConversation = ChatConversationListItem & {
  loanApplicationId?: string;
  submissionId?: string | null;
  applicationNumber?: string;
  clientLegalName?: string | null;
};

export type ChatMessage = {
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

function getAuthHeaders(json = false): Record<string, string> {
  const token = getLoanOfficerToken();
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function useLoanOfficerMessaging() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [messagePage, setMessagePage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);

  const resetMessages = useCallback(() => {
    setMessages([]);
    setMessagePage(1);
    setHasMoreMessages(false);
  }, []);

  const fetchMessages = useCallback(
    async (conversationId: string, page = 1, append = false) => {
      if (!conversationId) return;

      try {
        if (append) setLoadingOlder(true);
        else setMessagesLoading(true);

        const params = new URLSearchParams({
          page: String(page),
          limit: "50",
        });

        const res = await fetch(
          `${API_BASE}/messaging/conversation/${conversationId}/messages?${params}`,
          { headers: getAuthHeaders() },
        );
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.message || "Failed to load messages");
        }

        const batch: ChatMessage[] = json?.data?.messages || [];
        const total = json?.data?.total ?? batch.length;

        setMessagePage(page);
        setHasMoreMessages(page * 50 < total);

        setMessages((prev) => {
          if (!append) return batch;
          const existing = new Set(prev.map((m) => m.id));
          return [...batch.filter((m) => !existing.has(m.id)), ...prev].sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
        });
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to load messages");
      } finally {
        setMessagesLoading(false);
        setLoadingOlder(false);
      }
    },
    [],
  );

  const loadOlderMessages = useCallback(
    async (conversationId: string) => {
      if (!hasMoreMessages || loadingOlder) return;
      await fetchMessages(conversationId, messagePage + 1, true);
    },
    [fetchMessages, hasMoreMessages, loadingOlder, messagePage],
  );

  const markAsRead = useCallback(async (conversationId: string) => {
    try {
      await fetch(`${API_BASE}/messaging/conversation/${conversationId}/read`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
    } catch {
      /* non-blocking */
    }
  }, []);

  const sendMessage = useCallback(
    async (
      conversationId: string,
      payload: { text?: string; file?: File | null },
    ) => {
      let fileUrl: string | null = null;
      let fileName: string | null = null;
      let mimeType: string | undefined;

      if (payload.file) {
        const formData = new FormData();
        formData.append("file", payload.file);

        const uploadRes = await fetch(`${API_BASE}/upload`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: formData,
        });
        const uploadJson = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadJson.message || "File upload failed");
        }
        fileUrl = uploadJson.url;
        fileName = payload.file.name;
        mimeType = payload.file.type;
      }

      const res = await fetch(
        `${API_BASE}/messaging/conversation/${conversationId}/message`,
        {
          method: "POST",
          headers: getAuthHeaders(true),
          body: JSON.stringify({
            type: payload.file ? "FILE" : "TEXT",
            text: payload.text?.trim() || "",
            fileUrl,
            fileName,
            mimeType,
            fileSize: payload.file?.size,
          }),
        },
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to send message");
      }

      const newMessage = json.data?.message || json.data;
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMessage.id)) return prev;
        return [...prev, newMessage];
      });

      return newMessage as ChatMessage;
    },
    [],
  );

  const appendRealtimeMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  return {
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
  };
}

export async function fetchLoanOfficerInbox(params: {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
}) {
  const qs = new URLSearchParams();
  qs.set("page", String(params.page || 1));
  qs.set("limit", String(params.limit || 30));
  if (params.search) qs.set("search", params.search);
  if (params.type && params.type !== "ALL") qs.set("type", params.type);

  const res = await fetch(`${API_BASE}/messaging/inbox?${qs}`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.message || "Failed to load inbox");
  }

  return json.data as {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    conversations: InboxConversation[];
  };
}

export async function fetchLoanOfficerUnreadTotal() {
  const res = await fetch(`${API_BASE}/messaging/unread-count`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  if (!res.ok || !json.success) return 0;
  return json.data?.totalUnread || 0;
}

export function getLoanOfficerUserId() {
  try {
    const user = JSON.parse(sessionStorage.getItem(LO_USER_KEY) || "{}");
    return user?.id || user?.userId || null;
  } catch {
    return null;
  }
}

export function isLoanOfficerPlaceholderConversation(
  conversation?: Pick<InboxConversation, "id" | "isPlaceholder"> | null,
) {
  if (!conversation?.id) return false;
  return Boolean(
    conversation.isPlaceholder || isTemporaryConversationId(conversation.id),
  );
}

export async function ensureLoanOfficerConversation(
  conversation: InboxConversation,
): Promise<InboxConversation> {
  if (!isLoanOfficerPlaceholderConversation(conversation)) {
    return conversation;
  }

  const loanApplicationId = conversation.loanApplicationId;
  if (!loanApplicationId) {
    throw new Error("Missing loan application for this conversation");
  }

  let endpoint = "";
  let body: Record<string, string> = { loanApplicationId };

  if (conversation.type === "BROKER_OFFICER") {
    endpoint = `${API_BASE}/loanofficer/messaging/conversations/broker-officer`;
  } else if (conversation.type === "CLIENT_OFFICER") {
    endpoint = `${API_BASE}/messaging/conversations/client-officer`;
  } else if (conversation.type === "CLIENT_BROKER") {
    endpoint = `${API_BASE}/messaging/conversation`;
    body = { loanApplicationId, type: "CLIENT_BROKER" };
  } else {
    throw new Error("Unsupported conversation type");
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: getAuthHeaders(true),
    body: JSON.stringify(body),
  });
  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.message || "Failed to start conversation");
  }

  const createdId = json.data?.id;
  if (!createdId) {
    throw new Error("Conversation could not be created");
  }

  return {
    ...conversation,
    id: createdId,
    isPlaceholder: false,
  };
}
