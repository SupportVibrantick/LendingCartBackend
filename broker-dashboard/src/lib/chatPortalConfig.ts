import { getOrgIdsFromToken } from "./chatSocket";
import {
  CO_BROKER_API_BASE,
  CO_BROKER_USER_KEY,
  getCoBrokerToken,
} from "./coBrokerPortal";
import { getLoanOfficerToken, LO_USER_KEY } from "./loanOfficerApi";
import { getLoanOfficerUserId } from "./useLoanOfficerMessaging";
import {
  isPlaceholderConversation,
  isPrincipalClientBrokerChannel,
  type ChatConversationListItem,
} from "./chatConversation";
import { isTemporaryConversationId } from "./chatSocket";

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

const buildBrokerOrgResolver =
  (storageKey: string, getToken: () => string | null) => () => {
    try {
      const user = JSON.parse(sessionStorage.getItem(storageKey) || "{}");
      if (user.organizationId) return user.organizationId;
    } catch {
      /* ignore */
    }
    return getOrgIdsFromToken(getToken()).brokerOrgId;
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

export const brokerChatPortalConfig: ChatPortalConfig = {
  id: "broker",
  layout: "split",
  apiBase: DEFAULT_API_BASE,
  messagingPrefix: "messaging",
  getToken: () => sessionStorage.getItem("broker_token"),
  getBrokerOrgId: buildBrokerOrgResolver("broker_user", () =>
    sessionStorage.getItem("broker_token"),
  ),
  getCurrentUserId: () => parseUserId("broker_user"),
  encodeConversationId: false,
  serverSideSearch: true,
  ensureConversationMode: "broker-officer",
  needsPlaceholderCheck: (conversation) =>
    isPlaceholderConversation(conversation),
  accent: "sky",
  getOwnSenderLabel: (msg) =>
    msg.senderType === "SUB_BROKER" ? "Sub Broker" : "You",
};

export const loanOfficerChatPortalConfig: ChatPortalConfig = {
  id: "loanOfficer",
  layout: "split",
  apiBase: DEFAULT_API_BASE,
  messagingPrefix: "loanofficer/messaging",
  getToken: getLoanOfficerToken,
  getBrokerOrgId: buildBrokerOrgResolver(LO_USER_KEY, getLoanOfficerToken),
  getCurrentUserId: getLoanOfficerUserId,
  encodeConversationId: false,
  serverSideSearch: true,
  ensureConversationMode: "broker-officer",
  needsPlaceholderCheck: (conversation) =>
    isPlaceholderConversation(conversation),
  accent: "sky",
  getOwnSenderLabel: (msg) =>
    msg.senderType === "SUB_BROKER" ? "Sub Broker" : "You",
};

export const subBrokerChatPortalConfig: ChatPortalConfig = {
  id: "subBroker",
  layout: "split",
  apiBase: CO_BROKER_API_BASE,
  messagingPrefix: "subbroker/messaging",
  getToken: getCoBrokerToken,
  getBrokerOrgId: buildBrokerOrgResolver(CO_BROKER_USER_KEY, getCoBrokerToken),
  getCurrentUserId: () => parseUserId(CO_BROKER_USER_KEY),
  encodeConversationId: true,
  serverSideSearch: false,
  ensureConversationMode: "subbroker-category",
  needsPlaceholderCheck: (conversation) =>
    isTemporaryConversationId(conversation.id),
  accent: "cyan",
  getOwnSenderLabel: () => "You",
};

export const clientChatPortalConfig: ChatPortalConfig = {
  id: "client",
  layout: "single",
  apiBase: DEFAULT_API_BASE,
  messagingPrefix: "messaging",
  getToken: () => sessionStorage.getItem("client_token"),
  getCurrentUserId: () => null,
  encodeConversationId: false,
  serverSideSearch: false,
  ensureConversationMode: "none",
  needsPlaceholderCheck: () => false,
  accent: "emerald",
  hideCallButtons: true,
  filterConversation: isPrincipalClientBrokerChannel,
  pickDefaultConversation: (conversations) =>
    conversations.find(isPrincipalClientBrokerChannel) ?? conversations[0] ?? null,
  emptyStateMessage: {
    title: "Broker team chat unavailable",
    description:
      "Your broker team channel will appear here once your application is linked.",
  },
  emptyThreadMessage: {
    title: "Start the conversation",
    description:
      "Message your broker team — principal broker, loan officer, or co-broker will reply here.",
  },
  getOwnSenderLabel: () => "You",
};
