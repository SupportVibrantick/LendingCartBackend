import { isTemporaryConversationId } from "./chatSocket";

export type ChatBadgeTone =
  | "emerald"
  | "amber"
  | "violet"
  | "sky"
  | "indigo"
  | "slate";

export type ChatParticipant = {
  id?: string;
  role?: string;
  name?: string;
  profileImage?: string | null;
};

export type ChatConversationListItem = {
  id: string;
  type?: string;
  chatCategory?: string | null;
  title?: string;
  displayName?: string;
  badgeLabel?: string;
  badgeTone?: ChatBadgeTone;
  clientName?: string;
  brokerName?: string;
  lenderName?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unread?: boolean;
  unreadCount?: number;
  isPlaceholder?: boolean;
  participant?: ChatParticipant;
};

export const BADGE_CLASS_BY_TONE: Record<ChatBadgeTone, string> = {
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

function isLenderLoanOfficerChannel(chat: ChatConversationListItem) {
  return chat.type === "BROKER_LENDER" && chat.chatCategory === "LOAN_OFFICER";
}

function inferBadgeTone(chat: ChatConversationListItem): ChatBadgeTone {
  if (chat.type === "CLIENT_BROKER" || chat.type === "CLIENT_OFFICER") {
    return chat.type === "CLIENT_OFFICER" ? "violet" : "emerald";
  }
  if (chat.type === "BROKER_LENDER") {
    return isLenderLoanOfficerChannel(chat) ? "violet" : "indigo";
  }
  if (chat.type === "BROKER_OFFICER") return "violet";
  if (chat.chatCategory === "LOAN_OFFICER") return "violet";
  if (chat.chatCategory === "PRINCIPAL_BROKER") return "amber";
  return "sky";
}

function inferBadgeLabel(chat: ChatConversationListItem): string {
  if (chat.badgeLabel) return chat.badgeLabel;
  if (chat.type === "BROKER_LENDER" && chat.chatCategory === "PRINCIPAL_BROKER") {
    return "Lender";
  }
  if (chat.type === "CLIENT_BROKER" || chat.type === "CLIENT_OFFICER") {
    return "Client";
  }
  if (chat.type === "BROKER_LENDER") return "Lender";
  if (chat.type === "BROKER_OFFICER") return "Loan Officer";
  if (chat.type === "SUBBROKER_BROKER") return "Co-Broker";
  if (chat.chatCategory === "LOAN_OFFICER") return "Loan Officer";
  if (chat.chatCategory === "PRINCIPAL_BROKER") return "Principal Broker";
  return "Chat";
}

export function getConversationDisplayName(
  chat?: ChatConversationListItem | null,
): string {
  if (!chat) return "Conversation";

  if (chat.displayName) return chat.displayName;

  if (chat.type === "CLIENT_BROKER" || chat.type === "CLIENT_OFFICER") {
    return (
      chat.clientName ||
      chat.title?.replace(/^Client\s[•-]\s/i, "") ||
      chat.participant?.name ||
      "Client"
    );
  }

  return (
    chat.participant?.name ||
    chat.brokerName ||
    chat.lenderName ||
    chat.title?.replace(/^[^•-]+[•-]\s*/, "") ||
    chat.title ||
    "Conversation"
  );
}

export function getConversationBadge(chat: ChatConversationListItem) {
  const tone = chat.badgeTone || inferBadgeTone(chat);

  return {
    label: inferBadgeLabel(chat),
    className: BADGE_CLASS_BY_TONE[tone],
  };
}

export function isPlaceholderConversation(
  chat?: ChatConversationListItem | null,
): boolean {
  if (!chat?.id) return false;
  return Boolean(chat.isPlaceholder || isTemporaryConversationId(chat.id));
}

/** Principal team channel — not legacy per-co-broker lanes (CO_BROKER:*). */
export function isPrincipalClientBrokerChannel(
  chat?: ChatConversationListItem | null,
): boolean {
  if (!chat || chat.type !== "CLIENT_BROKER") return false;
  const category = chat.chatCategory;
  if (!category) return true;
  if (category === "PRINCIPAL" || category === "PRINCIPAL_BROKER") return true;
  if (category.startsWith("CO_BROKER:")) return false;
  return false;
}

export function getMessageSenderLabel(
  msg: { senderType?: string; senderName?: string },
  chat?: ChatConversationListItem | null,
): string {
  if (msg.senderType === "CLIENT") {
    return msg.senderName || chat?.clientName || "Client";
  }
  if (
    msg.senderType === "BROKER" ||
    msg.senderType === "SUB_BROKER" ||
    msg.senderType === "LENDER"
  ) {
    return msg.senderName || getConversationDisplayName(chat);
  }
  return msg.senderName || "User";
}
