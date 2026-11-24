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
import "./clientPortalTheme.css";

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
    signDocument?: boolean;
    brokerLoi?: boolean;
    forwardedDocumentCount?: number;
  };
  createdAt: string;
  isRead: boolean;
};

type ClientNotificationDropdownProps = {
  apiBase: string;
  onNotificationClick?: (notification: ClientNotification) => void;
};

/**
 * Survive ClientPortalChrome remounts when switching portal tabs.
 * Fetch once per portal session (same apiBase + token); socket pushes updates.
 */
type NotificationSessionCache = {
  apiBase: string;
  token: string;
  notifications: ClientNotification[];
  unreadCount: number;
  loaded: boolean;
  inflight: Promise<void> | null;
};

let notificationSessionCache: NotificationSessionCache | null = null;

function getClientToken() {
  return sessionStorage.getItem("client_token");
}

export function resetClientNotificationSessionCache() {
  notificationSessionCache = null;
}

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

/** Single brand accent — icons vary by type, color stays portal primary. */
function getNotificationStyle(eventType?: string) {
  switch (eventType) {
    case "LENDER_APPROVED":
      return { icon: FiCheckCircle };
    case "LENDER_DECLINED":
      return { icon: FiXCircle };
    case "DOCUMENTS_REQUESTED":
    case "LENDER_CONDITIONAL":
      return { icon: FiUpload };
    case "NEW_MESSAGE":
      return { icon: FiMessageSquare };
    default:
      return { icon: FiFileText };
  }
}

export default function ClientNotificationDropdown({
  apiBase,
  onNotificationClick,
}: ClientNotificationDropdownProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<ClientNotification[]>(
    () =>
      notificationSessionCache?.apiBase === apiBase
        ? notificationSessionCache.notifications
        : [],
  );
  const [unreadCount, setUnreadCount] = useState(() =>
    notificationSessionCache?.apiBase === apiBase
      ? notificationSessionCache.unreadCount
      : 0,
  );
  const [loading, setLoading] = useState(
    () =>
      !(
        notificationSessionCache?.apiBase === apiBase &&
        notificationSessionCache.loaded
      ),
  );
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const syncCache = useCallback(
    (next: {
      notifications: ClientNotification[];
      unreadCount: number;
      loaded?: boolean;
    }) => {
      const token = getClientToken() || "";
      notificationSessionCache = {
        apiBase,
        token,
        notifications: next.notifications,
        unreadCount: next.unreadCount,
        loaded: next.loaded ?? true,
        inflight: notificationSessionCache?.inflight ?? null,
      };
    },
    [apiBase],
  );

  const fetchNotifications = useCallback(
    async ({ force = false }: { force?: boolean } = {}) => {
      const clientToken = getClientToken();
      if (!clientToken) {
        resetClientNotificationSessionCache();
        return;
      }

      const cache = notificationSessionCache;
      const cacheValid =
        cache &&
        cache.apiBase === apiBase &&
        cache.token === clientToken &&
        cache.loaded;

      if (!force && cacheValid) {
        setNotifications(cache.notifications);
        setUnreadCount(cache.unreadCount);
        setLoading(false);
        return;
      }

      if (!force && cache?.inflight && cache.apiBase === apiBase) {
        setLoading(true);
        await cache.inflight;
        if (
          notificationSessionCache?.apiBase === apiBase &&
          notificationSessionCache.loaded
        ) {
          setNotifications(notificationSessionCache.notifications);
          setUnreadCount(notificationSessionCache.unreadCount);
        }
        setLoading(false);
        return;
      }

      const headers = { Authorization: `Bearer ${clientToken}` };

      const request = (async () => {
        try {
          setLoading(true);
          const res = await fetch(
            `${apiBase}/client-portal/notifications?limit=15`,
            { headers },
          );
          const json = await res.json();

          if (!json?.success) return;

          const nextNotifications = json.data?.notifications || [];
          const nextUnread = json.data?.unreadCount || 0;
          setNotifications(nextNotifications);
          setUnreadCount(nextUnread);
          notificationSessionCache = {
            apiBase,
            token: clientToken,
            notifications: nextNotifications,
            unreadCount: nextUnread,
            loaded: true,
            inflight: null,
          };
        } catch (err) {
          console.error("Failed to load client notifications", err);
        } finally {
          if (notificationSessionCache?.apiBase === apiBase) {
            notificationSessionCache.inflight = null;
          }
          setLoading(false);
        }
      })();

      notificationSessionCache = {
        apiBase,
        token: clientToken,
        notifications: cache?.notifications || [],
        unreadCount: cache?.unreadCount || 0,
        loaded: Boolean(cacheValid),
        inflight: request,
      };

      await request;
    },
    [apiBase],
  );

  useEffect(() => {
    if (!getClientToken()) return;
    // Portal tab changes remount this component — hydrate from session cache
    // and only hit the API once per login/session.
    void fetchNotifications({ force: false });
  }, [fetchNotifications]);

  useEffect(() => {
    const clientToken = getClientToken();
    if (!clientToken) return;

    ensureChatSocket(clientToken);

    const unsubscribe = subscribeSocketEvent(
      "CLIENT_NOTIFICATION",
      (payload) => {
        const notification = payload as ClientNotification;
        if (!notification?.id) return;

        setNotifications((prev) => {
          if (prev.some((item) => item.id === notification.id)) return prev;
          const next = [{ ...notification, isRead: false }, ...prev].slice(
            0,
            15,
          );
          setUnreadCount((count) => {
            const nextUnread = count + 1;
            syncCache({ notifications: next, unreadCount: nextUnread });
            return nextUnread;
          });
          toast(
            notification.body || notification.subject || "New notification",
          );
          return next;
        });
      },
    );

    return unsubscribe;
  }, [apiBase, syncCache]);

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

      setNotifications((prev) => {
        const wasUnread = prev.some((item) => item.id === id && !item.isRead);
        const next = prev.map((item) =>
          item.id === id ? { ...item, isRead: true } : item,
        );
        setUnreadCount((count) => {
          const nextUnread = wasUnread ? Math.max(0, count - 1) : count;
          syncCache({ notifications: next, unreadCount: nextUnread });
          return nextUnread;
        });
        return next;
      });
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

      setNotifications((prev) => {
        const next = prev.map((item) => ({ ...item, isRead: true }));
        syncCache({ notifications: next, unreadCount: 0 });
        return next;
      });
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
        }}
        className={`relative flex h-8 w-8 items-center justify-center rounded-[8px] border transition ${
          open
            ? "border-[#4C78F5]/35 bg-[#4C78F5]/10 text-[#4C78F5]"
            : "border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#4C78F5]/30 hover:bg-[#4C78F5]/5 hover:text-[#4C78F5]"
        }`}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <FiBell size={15} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#EF4444] px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={panelStyle}
            className="w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-[12px] border border-[#E2E8F0] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.12)]"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold tracking-tight text-[#111827]">
                  Notifications
                </p>
                <p className="mt-0.5 text-[12px] text-[#64748B]">
                  {unreadCount > 0
                    ? `${unreadCount} unread`
                    : "You're all caught up"}
                </p>
              </div>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="shrink-0 rounded-[6px] px-2 py-1 text-[12px] font-semibold text-[#4C78F5] transition hover:bg-[#4C78F5]/8"
                >
                  Mark all read
                </button>
              ) : null}
            </div>

            <div className="cp-scroll max-h-[min(420px,70vh)] overflow-y-auto">
              {loading && notifications.length === 0 ? (
                <div className="space-y-2.5 px-3 py-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-[10px] border border-[#E2E8F0] bg-[#F7F9FC] p-3"
                    >
                      <div className="h-10 w-10 shrink-0 animate-pulse rounded-[10px] bg-[#E2E8F0]" />
                      <div className="min-w-0 flex-1 space-y-2 py-0.5">
                        <div className="h-3 w-3/4 animate-pulse rounded bg-[#E2E8F0]" />
                        <div className="h-2.5 w-full animate-pulse rounded bg-[#E2E8F0]" />
                        <div className="h-2 w-1/3 animate-pulse rounded bg-[#E2E8F0]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-[10px] bg-[#4C78F5]/10 text-[#4C78F5]">
                    <FiBell size={20} />
                  </div>
                  <p className="text-[14px] font-semibold text-[#111827]">
                    No notifications
                  </p>
                  <p className="mt-1 text-[12px] text-[#64748B]">
                    Updates about your loan will show up here
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-[#E2E8F0]">
                  {notifications.map((notification) => {
                    const style = getNotificationStyle(notification.eventType);
                    const Icon = style.icon;
                    const isUnread = !notification.isRead;
                    const appNumber = notification.metadata?.applicationNumber
                      ? `#${String(
                          notification.metadata.applicationNumber,
                        ).replace(/^#/, "")}`
                      : null;
                    const title =
                      notification.subject?.trim() ||
                      notification.body?.trim() ||
                      "Update";
                    const showBody =
                      Boolean(notification.subject?.trim()) &&
                      Boolean(notification.body?.trim()) &&
                      notification.subject?.trim() !==
                        notification.body?.trim();

                    return (
                      <li key={notification.id}>
                        <button
                          type="button"
                          onClick={() => handleItemClick(notification)}
                          className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-[#F7F9FC] ${
                            isUnread ? "bg-[#4C78F5]/[0.04]" : "bg-white"
                          }`}
                        >
                          <div className="relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#4C78F5]/10 text-[#4C78F5]">
                            <Icon size={16} />
                            {isUnread ? (
                              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#4C78F5]" />
                            ) : null}
                          </div>

                          <div className="min-w-0 flex-1">
                            {(appNumber ||
                              notification.eventType === "NEW_MESSAGE") && (
                              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                                {appNumber ? (
                                  <span className="rounded-md bg-[#F7F9FC] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#64748B] ring-1 ring-[#E2E8F0]">
                                    {appNumber}
                                  </span>
                                ) : null}
                                {notification.eventType === "NEW_MESSAGE" ? (
                                  <span className="rounded-md bg-[#4C78F5]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#4C78F5]">
                                    Message
                                  </span>
                                ) : null}
                              </div>
                            )}

                            <div className="flex items-start justify-between gap-2">
                              <p
                                className={`line-clamp-2 text-[13px] leading-snug ${
                                  isUnread
                                    ? "font-semibold text-[#111827]"
                                    : "font-medium text-[#111827]"
                                }`}
                              >
                                {title}
                              </p>
                              {isUnread ? (
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4C78F5]" />
                              ) : null}
                            </div>

                            {showBody ? (
                              <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-[#64748B]">
                                {notification.body}
                              </p>
                            ) : null}

                            <p className="mt-2 text-[11px] text-[#94A3B8]">
                              {[
                                notification.metadata?.senderName
                                  ? `From ${notification.metadata.senderName}`
                                  : null,
                                formatRelativeTime(notification.createdAt),
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
          </div>,
          document.body,
        )}
    </div>
  );
}
