import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiBell,
  FiBriefcase,
  FiCheck,
  FiCheckCircle,
  FiFileText,
  FiMessageSquare,
  FiUpload,
  FiUserPlus,
  FiXCircle,
} from "react-icons/fi";
import { Dropdown } from "../ui/dropdown/Dropdown";
import {
  LO_API_BASE,
  LO_USER_KEY,
  getLoanOfficerToken,
  loAuthHeaders,
} from "../../lib/loanOfficerApi";
import { getLoanOfficerUserId } from "../../lib/useLoanOfficerMessaging";
import { getOrgIdsFromToken } from "../../lib/chatSocket";
import {
  ensureChatSocket,
  subscribeSocketEvent,
} from "../../lib/chatSocketManager";

type LoNotification = {
  id: string;
  eventType?: string;
  subject?: string;
  body?: string;
  isRead: boolean;
  createdAt: string;
  metadata?: {
    applicationId?: string;
    applicationNumber?: string;
    loanApplicationId?: string;
    conversationId?: string;
    messageId?: string;
    senderName?: string;
  };
};

function formatRelativeTime(value?: string) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getNotificationStyle(eventType?: string) {
  switch (eventType) {
    case "NEW_MESSAGE":
      return {
        icon: FiMessageSquare,
        label: "Message",
        tone: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
      };
    case "LOI_GENERATED":
      return {
        icon: FiFileText,
        label: "LOI",
        tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
      };
    case "CLIENT_UPLOADED_DOCUMENT":
    case "SUBBROKER_DOCUMENT_SENT":
      return {
        icon: FiUpload,
        label: "Document",
        tone: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
      };
    case "APPLICATION_CREATED":
    case "APPLICATION_SUBMITTED":
    case "APPLICATION_SENT_TO_LENDERS":
      return {
        icon: FiBriefcase,
        label: "Application",
        tone: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
      };
    case "LOAN_OFFICER_ASSIGNED":
    case "SUBBROKER_ASSIGNED":
      return {
        icon: FiUserPlus,
        label: "Assignment",
        tone: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
      };
    case "LENDER_DECISION_APPROVED":
      return {
        icon: FiCheckCircle,
        label: "Approved",
        tone: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
      };
    case "LENDER_DECISION_DECLINED":
      return {
        icon: FiXCircle,
        label: "Declined",
        tone: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
      };
    default:
      return {
        icon: FiBell,
        label: "Alert",
        tone: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
      };
  }
}

function getLoanOfficerBrokerOrgId(): string | null {
  try {
    const raw = sessionStorage.getItem(LO_USER_KEY);
    if (raw) {
      const user = JSON.parse(raw) as { organizationId?: string };
      if (user.organizationId) return user.organizationId;
    }
  } catch {
    /* ignore */
  }
  const token = getLoanOfficerToken();
  return token ? getOrgIdsFromToken(token).brokerOrgId : null;
}

function buildMessageNotification(msg: Record<string, unknown>): LoNotification {
  const preview =
    (msg.text as string | undefined) ||
    ((msg.fileName as string | undefined) ? "Sent a file" : "New message");
  const senderName = (msg.senderName as string | undefined) || "Someone";
  const applicationNumber = msg.applicationNumber as string | undefined;
  const applicationId =
    (msg.applicationId as string | undefined) ||
    (msg.loanApplicationId as string | undefined);
  const appLabel = applicationNumber
    ? String(applicationNumber).startsWith("#")
      ? String(applicationNumber)
      : `#${applicationNumber}`
    : null;

  return {
    id: `msg-${String(msg.id || Date.now())}`,
    eventType: "NEW_MESSAGE",
    subject: appLabel
      ? `New message from ${senderName} · ${appLabel}`
      : `New message from ${senderName}`,
    body: appLabel
      ? `${senderName} on ${appLabel}: ${preview}`
      : `${senderName}: ${preview}`,
    metadata: {
      conversationId: msg.conversationId as string | undefined,
      senderName,
      applicationId,
      applicationNumber,
      loanApplicationId: msg.loanApplicationId as string | undefined,
      messageId: msg.id as string | undefined,
    },
    createdAt: (msg.createdAt as string | undefined) || new Date().toISOString(),
    isRead: false,
  };
}

export default function LoanOfficerNotificationDropdown() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<LoNotification[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${LO_API_BASE}/loanofficer/notifications/?limit=15`, {
        headers: loAuthHeaders(),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setNotifications(json.data.notifications || []);
        setUnreadCount(json.data.unreadCount || 0);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 60_000);
    return () => window.clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const token = getLoanOfficerToken();
    const brokerOrgId = getLoanOfficerBrokerOrgId();
    if (!token || !brokerOrgId) return;

    ensureChatSocket(token, {
      getBrokerOrgId: () => getLoanOfficerBrokerOrgId(),
    });

    const unsubscribeNotification = subscribeSocketEvent(
      "NOTIFICATION",
      (payload) => {
        if (!payload || typeof payload !== "object") return;
        const notification = payload as LoNotification;
        if (!notification.id) return;

        const messageId = notification.metadata?.messageId;
        const syntheticId =
          notification.eventType === "NEW_MESSAGE" && messageId
            ? `msg-${messageId}`
            : null;

        let shouldBumpUnread = false;
        setNotifications((prev) => {
          const hadSynthetic = Boolean(
            syntheticId && prev.some((item) => item.id === syntheticId),
          );
          const withoutSynthetic = syntheticId
            ? prev.filter((item) => item.id !== syntheticId)
            : prev;
          if (withoutSynthetic.some((item) => item.id === notification.id)) {
            return withoutSynthetic;
          }
          shouldBumpUnread = !hadSynthetic;
          return [
            { ...notification, isRead: false },
            ...withoutSynthetic,
          ].slice(0, 20);
        });
        if (shouldBumpUnread) {
          setUnreadCount((count) => count + 1);
        }
      },
    );

    const unsubscribeChat = subscribeSocketEvent("newMessage", (payload) => {
      if (!payload || typeof payload !== "object") return;
      const msg = payload as Record<string, unknown>;
      const currentUserId = getLoanOfficerUserId();
      if (
        currentUserId &&
        (msg.senderUserId === currentUserId ||
          msg.senderClientUserId === currentUserId)
      ) {
        return;
      }
      const incoming = buildMessageNotification(msg);
      setNotifications((prev) => {
        if (prev.some((item) => item.id === incoming.id)) return prev;
        return [incoming, ...prev].slice(0, 20);
      });
      setUnreadCount((count) => count + 1);
    });

    return () => {
      unsubscribeNotification();
      unsubscribeChat();
    };
  }, []);

  const markRead = async (id: string) => {
    if (!id.startsWith("msg-")) {
      await fetch(`${LO_API_BASE}/loanofficer/notifications/${id}/read`, {
        method: "PATCH",
        headers: loAuthHeaders(),
      });
    }
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    await fetch(`${LO_API_BASE}/loanofficer/notifications/read-all`, {
      method: "PATCH",
      headers: loAuthHeaders(),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const handleClick = async (n: LoNotification) => {
    if (!n.isRead) await markRead(n.id);
    setIsOpen(false);

    if (n.eventType === "NEW_MESSAGE" || n.metadata?.conversationId) {
      navigate("/loan-officer/messages");
      return;
    }

    const appId =
      n.metadata?.applicationId || n.metadata?.loanApplicationId;
    if (appId) {
      navigate("/loan-officer/loan-pipeline");
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setIsOpen((v) => !v);
          if (!isOpen) load();
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-gray-500 transition hover:border-gray-200 hover:bg-gray-100 dark:hover:border-gray-700 dark:hover:bg-gray-800"
        aria-label="Notifications"
      >
        <FiBell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        className="right-0 mt-2 w-[min(380px,calc(100vw-1.5rem))] rounded-2xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
          <div>
            <h5 className="font-semibold text-gray-900 dark:text-white">
              Notifications
            </h5>
            <p className="text-xs text-gray-500">
              {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex items-center gap-1 rounded-lg bg-[#13538A]/10 px-2 py-1 text-xs font-medium text-[#13538A] hover:bg-[#13538A]/15"
            >
              <FiCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-[min(420px,60vh)] overflow-y-auto">
          {loading ? (
            <div className="space-y-2 py-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"
                />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                <FiBell className="h-5 w-5 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                No notifications
              </p>
              <p className="mt-1 text-xs text-gray-500">
                New messages and updates will show here
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {notifications.map((n) => {
                const style = getNotificationStyle(n.eventType);
                const Icon = style.icon;
                const isUnread = !n.isRead;
                const appNumber = n.metadata?.applicationNumber
                  ? `#${String(n.metadata.applicationNumber).replace(/^#/, "")}`
                  : null;
                const title =
                  n.subject?.trim() ||
                  n.body?.trim() ||
                  n.eventType?.replace(/_/g, " ") ||
                  "Update";
                const showBody =
                  Boolean(n.subject?.trim()) &&
                  Boolean(n.body?.trim()) &&
                  n.subject?.trim() !== n.body?.trim();

                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleClick(n)}
                      className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-gray-50 dark:hover:bg-gray-800 ${
                        isUnread
                          ? "border-l-[3px] border-l-orange-500 bg-orange-50/50 dark:bg-orange-500/5"
                          : ""
                      }`}
                    >
                      <span
                        className={`relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.tone}`}
                      >
                        <Icon className="h-4 w-4" />
                        {isUnread && (
                          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-orange-500 dark:border-gray-900" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {style.label}
                          </span>
                          {appNumber && (
                            <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
                              {appNumber}
                            </span>
                          )}
                        </div>
                        <p className="line-clamp-2 text-sm font-medium text-gray-900 dark:text-white">
                          {title}
                        </p>
                        {showBody && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
                            {n.body}
                          </p>
                        )}
                        <p className="mt-1.5 text-[11px] text-gray-400">
                          {[
                            n.metadata?.senderName
                              ? `From ${n.metadata.senderName}`
                              : null,
                            formatRelativeTime(n.createdAt),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Dropdown>
    </div>
  );
}
