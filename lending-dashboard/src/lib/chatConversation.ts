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
  participantType?: string;
  participantId?: string;
  participantEmail?: string | null;
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
  participants?: ChatParticipant[];
  brokerLabel?: string;
};

export const BADGE_CLASS_BY_TONE: Record<ChatBadgeTone, string> = {
  emerald: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  violet: "bg-violet-100 text-violet-700",
  sky: "bg-sky-100 text-sky-700",
  indigo: "bg-indigo-100 text-indigo-700",
  slate: "bg-slate-100 text-slate-700",
};

function inferBadgeTone(chat: ChatConversationListItem): ChatBadgeTone {
  if (chat.badgeTone) return chat.badgeTone;
  if (chat.type === "BROKER_LENDER") return "amber";
  return "slate";
}

function inferBadgeLabel(chat: ChatConversationListItem): string {
  return chat.badgeLabel || (chat.type === "BROKER_LENDER" ? "Broker" : "Chat");
}

export function getConversationDisplayName(
  chat?: ChatConversationListItem | null,
): string {
  if (!chat) return "Broker";
  if (chat.displayName) return chat.displayName;
  if (chat.brokerName) return chat.brokerName;
  if (chat.brokerLabel) return chat.brokerLabel;

const broker = (chat.participants || []).find(
  (p) =>
    p.role === "BROKER" ||
    p.participantType === "BROKER",
);

  return broker?.name || chat.title?.replace(/^Lender\s-\s*/i, "") || "Broker";
}

export function getConversationBadge(chat: ChatConversationListItem) {
  const tone = inferBadgeTone(chat);
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
