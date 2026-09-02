import { getOrgIdsFromToken } from "./chatSocket";
import {
  isPlaceholderConversation,
  type ChatConversationListItem,
} from "./chatConversation";
import { canSendChat } from "./lenderPermissions";

const DEFAULT_API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:4000";

export type ChatMessageLike = {
  senderType?: string;
  senderUserId?: string;
  senderClientUserId?: string;
};

export type ChatPortalAccent = "sky" | "cyan" | "emerald" | "brand";

export type ChatLayout = "split" | "single";

export type EnsureConversationMode =
  | "broker-officer"
  | "subbroker-category"
  | "lender-category"
  | "none";

export type ChatPortalConfig = {
  id: "broker" | "loanOfficer" | "subBroker" | "client" | "lender";
  layout: ChatLayout;
  apiBase: string;
  messagingPrefix: string;
  getToken: () => string | null;
  getBrokerOrgId?: () => string | null;
  getLenderOrgId?: () => string | null;
  getCurrentUserId: () => string | null;
  encodeConversationId: boolean;
  serverSideSearch: boolean;
  ensureConversationMode: EnsureConversationMode;
  needsPlaceholderCheck: (
    conversation: { id: string; isPlaceholder?: boolean },
  ) => boolean;
  accent: ChatPortalAccent;
  hideCallButtons?: boolean;
  isReadOnly?: () => boolean;
  filterConversation?: (conversation: ChatConversationListItem) => boolean;
  pickDefaultConversation?: (
    conversations: ChatConversationListItem[],
  ) => ChatConversationListItem | null;
  emptyStateMessage?: { title: string; description: string };
  emptyThreadMessage?: { title: string; description: string };
  getOwnSenderLabel: (msg: ChatMessageLike) => string;
};

const parseUserId = (storageKey: string) => {
  try {
    const user = JSON.parse(sessionStorage.getItem(storageKey) || "{}");
    return user?.id || user?.userId || user?._id || null;
  } catch {
    return null;
  }
};

export const encodeConversationIdForPortal = (
  config: ChatPortalConfig,
  conversationId: string,
) =>
  config.encodeConversationId
    ? encodeURIComponent(conversationId)
    : conversationId;

export const loanConversationsUrl = (
  config: ChatPortalConfig,
  applicationId: string,
  search?: string,
) => {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  const query = params.toString();
  return `${config.apiBase}/${config.messagingPrefix}/loan/${applicationId}/conversations${query ? `?${query}` : ""}`;
};

export const conversationMessagesUrl = (
  config: ChatPortalConfig,
  conversationId: string,
) =>
  `${config.apiBase}/${config.messagingPrefix}/conversation/${encodeConversationIdForPortal(config, conversationId)}/messages`;

export const conversationMessageUrl = (
  config: ChatPortalConfig,
  conversationId: string,
) =>
  `${config.apiBase}/${config.messagingPrefix}/conversation/${encodeConversationIdForPortal(config, conversationId)}/message`;

export const conversationReadUrl = (
  config: ChatPortalConfig,
  conversationId: string,
) =>
  `${config.apiBase}/${config.messagingPrefix}/conversation/${encodeConversationIdForPortal(config, conversationId)}/read`;

export const ensureConversationUrl = (config: ChatPortalConfig) => {
  if (config.ensureConversationMode === "subbroker-category") {
    return `${config.apiBase}/${config.messagingPrefix}/conversations`;
  }
  if (config.ensureConversationMode === "lender-category") {
    return `${config.apiBase}/messaging/lender/conversation`;
  }
  if (config.ensureConversationMode === "none") {
    return null;
  }
  return `${config.apiBase}/${config.messagingPrefix}/conversations/broker-officer`;
};

const buildLenderOrgResolver = (getToken: () => string | null) => () => {
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
};

/** Lender portal — BROKER_LENDER lanes only (principal broker + loan officer). */
export const lenderChatPortalConfig: ChatPortalConfig = {
  id: "lender",
  layout: "split",
  apiBase: DEFAULT_API_BASE,
  messagingPrefix: "messaging",
  getToken: () => sessionStorage.getItem("lender_token"),
  getLenderOrgId: buildLenderOrgResolver(() =>
    sessionStorage.getItem("lender_token"),
  ),
  getCurrentUserId: () =>
    parseUserId("lender_user") || parseUserId("user"),
  encodeConversationId: false,
  serverSideSearch: true,
  ensureConversationMode: "lender-category",
  needsPlaceholderCheck: (conversation) =>
    isPlaceholderConversation(conversation),
  accent: "brand",
  isReadOnly: () => !canSendChat(),
  emptyStateMessage: {
    title: "No conversations yet",
    description: "Broker channels for this loan will appear here.",
  },
  emptyThreadMessage: {
    title: "Start the conversation",
    description: "Say hello to the broker team for this loan.",
  },
  getOwnSenderLabel: () => "You",
};
