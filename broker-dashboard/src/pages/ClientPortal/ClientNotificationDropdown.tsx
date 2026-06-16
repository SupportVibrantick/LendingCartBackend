import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  FiBell,
  FiCheckCircle,
  FiFileText,
  FiMessageSquare,
  FiUpload,
  FiXCircle,
} from "react-icons/fi";
import toast from "react-hot-toast";
import {
  ensureChatSocket,
  subscribeSocketEvent,
} from "../../lib/chatSocketManager";

export type ClientNotification = {
  id: string;
  eventType?: string;
  category?: string;
  subject?: string;
  body?: string;
  metadata?: {
    applicationId?: string;
    applicationNumber?: string;
    conversationId?: string;
    lenderName?: string;
    decision?: string;
    senderName?: string;
  };
  createdAt: string;
  isRead: boolean;
};

type ClientNotificationDropdownProps = {
  apiBase: string;
  onNotificationClick?: (notification: ClientNotification) => void;
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
    case "LENDER_APPROVED":
      return {
        icon: FiCheckCircle,
        tone: "bg-emerald-100 text-emerald-700",
      };
    case "LENDER_DECLINED":
      return {
        icon: FiXCircle,
        tone: "bg-red-100 text-red-700",
      };
    case "DOCUMENTS_REQUESTED":
    case "LENDER_CONDITIONAL":
      return {
        icon: FiUpload,
        tone: "bg-sky-100 text-sky-700",
      };
    case "NEW_MESSAGE":
      return {
        icon: FiMessageSquare,
        tone: "bg-violet-100 text-violet-700",
      };
    default:
      return {
        icon: FiFileText,
        tone: "bg-gray-100 text-gray-700",
      };
  }
}

export default function ClientNotificationDropdown({
  apiBase,
  onNotificationClick,
}: ClientNotificationDropdownProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<ClientNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const getClientToken = () => sessionStorage.getItem("client_token");

  const fetchNotifications = useCallback(async () => {
    const clientToken = getClientToken();
    if (!clientToken) return;

    const headers = { Authorization: `Bearer ${clientToken}` };

    try {
      setLoading(true);
      const res = await fetch(
        `${apiBase}/client-portal/notifications?limit=15`,
        { headers },
      );
      const json = await res.json();

      if (!json?.success) return;

      setNotifications(json.data?.notifications || []);
      setUnreadCount(json.data?.unreadCount || 0);
    } catch (err) {
      console.error("Failed to load client notifications", err);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    if (!getClientToken()) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    const clientToken = sessionStorage.getItem("client_token");
    if (!clientToken) return;

    ensureChatSocket(clientToken);

    const unsubscribe = subscribeSocketEvent(
      "CLIENT_NOTIFICATION",
      (payload) => {
        const notification = payload as ClientNotification;
        if (!notification?.id) return;

        setNotifications((prev) => {
          const exists = prev.some((item) => item.id === notification.id);
          if (exists) return prev;
          return [{ ...notification, isRead: false }, ...prev].slice(0, 15);
        });
        setUnreadCount((count) => count + 1);
        toast(notification.body || notification.subject || "New notification");
      },
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      if (!buttonRef.current) return;

      const rect = buttonRef.current.getBoundingClientRect();
      setPanelStyle({
        position: "fixed",
        top: rect.bottom + 8,
        right: Math.max(16, window.innerWidth - rect.right),
        zIndex: 9999,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        buttonRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }

      setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsRead = async (id: string) => {
    const clientToken = getClientToken();
    if (!clientToken) return;

    try {
      await fetch(`${apiBase}/client-portal/notifications/${id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${clientToken}` },
      });

      setNotifications((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, isRead: true } : item,
        ),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (err) {
      console.error("Failed to mark notification read", err);
    }
  };

  const markAllRead = async () => {
    const clientToken = getClientToken();
    if (!clientToken) return;

    try {
      await fetch(`${apiBase}/client-portal/notifications/read-all`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${clientToken}` },
      });

      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      toast.error("Could not mark notifications as read");
    }
  };

  const handleItemClick = (notification: ClientNotification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    onNotificationClick?.(notification);
    setOpen(false);
  };

  if (!getClientToken()) {
    return null;
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) fetchNotifications();
        }}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
        aria-label="Notifications"
      >
        <FiBell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={panelStyle}
            className="w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-200 bg-white"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">Notifications</p>
                <p className="text-xs text-gray-500">
                  {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
                </p>
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              {loading && notifications.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">Loading...</p>
              ) : notifications.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">
                  No notifications yet
                </p>
              ) : (
                notifications.map((notification) => {
                  const style = getNotificationStyle(notification.eventType);
                  const Icon = style.icon;

                  return (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => handleItemClick(notification)}
                      className={`flex w-full items-start gap-3 border-b border-gray-50 px-4 py-3 text-left transition hover:bg-gray-50 ${
                        !notification.isRead ? "bg-blue-50/40" : ""
                      }`}
                    >
                      <div
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${style.tone}`}
                      >
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {notification.subject || "Update"}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs text-gray-600">
                          {notification.body}
                        </p>
                        <p className="mt-2 text-[11px] text-gray-400">
                          {formatRelativeTime(notification.createdAt)}
                        </p>
                      </div>
                      {!notification.isRead && (
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
