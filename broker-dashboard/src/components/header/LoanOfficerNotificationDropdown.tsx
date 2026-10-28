import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiBell, FiCheck } from "react-icons/fi";
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
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 dark:hover:bg-gray-800"
        aria-label="Notifications"
      >
        <FiBell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        className="right-0 mt-2 w-[min(360px,calc(100vw-1.5rem))] rounded-2xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
          <div>
            <h5 className="font-semibold text-gray-900 dark:text-white">Notifications</h5>
            {unreadCount > 0 && (
              <p className="text-xs text-gray-500">{unreadCount} unread</p>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#13538A] hover:underline"
            >
              <FiCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-[min(400px,60vh)] overflow-y-auto">
          {loading ? (
            <div className="space-y-2 py-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">No notifications yet</p>
          ) : (
            <ul className="space-y-1">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleClick(n)}
                    className={`w-full rounded-xl px-3 py-2.5 text-left transition hover:bg-gray-50 dark:hover:bg-gray-800 ${
                      !n.isRead ? "bg-[#13538A]/5" : ""
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {n.subject || n.eventType?.replace(/_/g, " ") || "Update"}
                    </p>
                    {n.body && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{n.body}</p>
                    )}
                    <p className="mt-1 text-[10px] text-gray-400">
                      {[
                        n.metadata?.applicationNumber
                          ? `#${String(n.metadata.applicationNumber).replace(/^#/, "")}`
                          : null,
                        n.metadata?.senderName,
                        new Date(n.createdAt).toLocaleString(),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Dropdown>
    </div>
  );
}
