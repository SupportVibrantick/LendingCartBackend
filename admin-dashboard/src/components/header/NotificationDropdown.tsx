import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { ADMIN_API_BASE } from "../../lib/adminApi";
import {
  ensureAdminSocket,
  subscribeAdminSocketEvent,
} from "../../lib/adminSocket";
import toast from "react-hot-toast";
import {
  FiBell,
  FiBriefcase,
  FiMail,
  FiUserPlus,
  FiX,
  FiUsers,
} from "react-icons/fi";

type NotificationMetadata = {
  organizationId?: string;
  organizationName?: string;
  adminEmail?: string;
  leadId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  applicationId?: string;
  applicationNumber?: string;
};

type AdminNotification = {
  id: string;
  eventType?: string;
  category?: string;
  body?: string;
  subject?: string;
  metadata?: NotificationMetadata;
  createdAt: string | Date;
  isRead: boolean;
};

function getAdminToken() {
  return sessionStorage.getItem("admin_token");
}

function formatRelativeTime(value?: string | Date) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

function getNotificationStyle(eventType?: string) {
  switch (eventType) {
    case "BROKER_REGISTERED":
      return {
        icon: FiUsers,
        label: "Broker",
        tone: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
      };
    case "LENDER_REGISTERED":
      return {
        icon: FiBriefcase,
        label: "Lender",
        tone: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
      };
    case "LANDING_PAGE_LEAD":
      return {
        icon: FiMail,
        label: "Lead",
        tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
      };
    case "ADMIN_USER_CREATED":
      return {
        icon: FiUserPlus,
        label: "Admin",
        tone: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
      };
    case "APPLICATION_SUBMITTED":
      return {
        icon: FiBriefcase,
        label: "Application",
        tone: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
      };
    default:
      return {
        icon: FiBell,
        label: "Alert",
        tone: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
      };
  }
}

function getNotificationMetaLabel(notification: AdminNotification) {
  const meta = notification.metadata || {};
  return (
    meta.organizationName ||
    meta.email ||
    meta.applicationNumber ||
    notification.category ||
    "Platform"
  );
}

function normalizeNotification(payload: Record<string, unknown>): AdminNotification {
  const metadata = (payload.metadata as NotificationMetadata | undefined) || {};
  const createdAt =
    (payload.createdAt as string | Date | undefined) || new Date().toISOString();

  return {
    id: String(payload.id || `notif-${Date.now()}`),
    eventType: (payload.eventType as string | undefined) || "SYSTEM_ALERT",
    category: payload.category as string | undefined,
    body:
      (payload.body as string | undefined) ||
      (payload.subject as string | undefined) ||
      "New notification",
    subject: payload.subject as string | undefined,
    metadata,
    createdAt,
    isRead: Boolean(payload.isRead),
  };
}

function prependNotification(prev: AdminNotification[], incoming: AdminNotification) {
  if (prev.some((item) => item.id === incoming.id)) return prev;
  return [incoming, ...prev];
}

function groupNotifications(notifications: AdminNotification[]) {
  const today: AdminNotification[] = [];
  const yesterday: AdminNotification[] = [];
  const thisWeek: AdminNotification[] = [];
  const earlier: AdminNotification[] = [];

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  notifications.forEach((notification) => {
    const date = new Date(notification.createdAt);
    if (date >= startOfToday) today.push(notification);
    else if (date >= startOfYesterday) yesterday.push(notification);
    else if (date >= startOfWeek) thisWeek.push(notification);
    else earlier.push(notification);
  });

  return { today, yesterday, thisWeek, earlier };
}

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const seenRealtimeIds = useRef(new Set<string>());

  const pushRealtimeNotification = useCallback((incoming: AdminNotification) => {
    if (seenRealtimeIds.current.has(incoming.id)) return;
    seenRealtimeIds.current.add(incoming.id);

    setNotifications((prev) => prependNotification(prev, incoming));
    setUnreadCount((prev) => prev + 1);

    const style = getNotificationStyle(incoming.eventType);
    const Icon = style.icon;

    toast.custom(
      (t) => (
        <div
          className={`${
            t.visible ? "opacity-100" : "opacity-0"
          } pointer-events-auto flex w-[min(360px,calc(100vw-2rem))] items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-900`}
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${style.tone}`}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              {style.label}
            </p>
            <p className="mt-0.5 text-sm text-gray-800 dark:text-gray-100">{incoming.body}</p>
          </div>
          <button
            type="button"
            onClick={() => toast.dismiss(t.id)}
            className="shrink-0 text-gray-400 hover:text-gray-600"
            aria-label="Dismiss"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>
      ),
      { id: incoming.id, duration: 4500, position: "top-right" },
    );
  }, []);

  const fetchNotifications = useCallback(async (pageNumber = 1) => {
    try {
      if (pageNumber === 1) setLoading(true);
      else setLoadingMore(true);

      const token = getAdminToken();
      if (!token) return;

      const res = await fetch(
        `${ADMIN_API_BASE}/admin/notifications?page=${pageNumber}&limit=10`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const data = await res.json();
      const newNotifications = (data?.data?.notifications || []) as AdminNotification[];

      if (pageNumber === 1) {
        setNotifications(newNotifications);
        setPage(1);
        setHasMore(newNotifications.length >= 10);
      } else {
        setNotifications((prev) => {
          const existingIds = new Set(prev.map((item) => item.id));
          const merged = newNotifications.filter((item) => !existingIds.has(item.id));
          return [...prev, ...merged];
        });
        setHasMore(newNotifications.length >= 10);
      }

      setUnreadCount(data?.data?.unreadCount || 0);
    } catch (err) {
      console.error("Notification API error", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    try {
      const token = getAdminToken();
      await fetch(`${ADMIN_API_BASE}/admin/notifications/${id}/read`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
      );
      setUnreadCount((prev) => Math.max(prev - 1, 0));
    } catch (err) {
      console.error("Mark read error", err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      setReading(true);
      const token = getAdminToken();

      await fetch(`${ADMIN_API_BASE}/admin/notifications/read-all`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } finally {
      setReading(false);
    }
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    try {
      const token = getAdminToken();
      await fetch(`${ADMIN_API_BASE}/admin/notifications/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      setNotifications((prev) => {
        const deleted = prev.find((item) => item.id === id);
        if (deleted && !deleted.isRead) {
          setUnreadCount((count) => Math.max(count - 1, 0));
        }
        return prev.filter((item) => item.id !== id);
      });
    } catch (err) {
      console.error("Delete notification error", err);
    }
  }, []);

  const deleteAllNotifications = useCallback(async () => {
    try {
      const token = getAdminToken();
      const res = await fetch(`${ADMIN_API_BASE}/admin/notifications/delete-all`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error("Failed to delete all notifications");
      }

      setNotifications([]);
      setUnreadCount(0);
      setHasMore(false);
    } catch (err) {
      console.error("Delete all error", err);
      toast.error("Could not delete notifications");
    }
  }, []);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLElement>) => {
      const target = e.currentTarget;
      const { scrollTop, scrollHeight, clientHeight } = target;

      if (scrollHeight - scrollTop <= clientHeight + 50 && hasMore && !loadingMore) {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchNotifications(nextPage);
      }
    },
    [fetchNotifications, hasMore, loadingMore, page],
  );

  const toggleDropdown = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) fetchNotifications(1);
      return next;
    });
  }, [fetchNotifications]);

  const closeDropdown = useCallback(() => setIsOpen(false), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  useEffect(() => {
    if (!isModalOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeModal();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isModalOpen, closeModal]);

  useEffect(() => {
    fetchNotifications(1);
  }, [fetchNotifications]);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) return;

    ensureAdminSocket(token);

    const unsubscribe = subscribeAdminSocketEvent("NOTIFICATION", (payload) => {
      if (!payload || typeof payload !== "object") return;
      pushRealtimeNotification(normalizeNotification(payload as Record<string, unknown>));
    });

    return () => {
      unsubscribe();
    };
  }, [pushRealtimeNotification]);

  const grouped = useMemo(() => groupNotifications(notifications), [notifications]);
  const badgeLabel = unreadCount > 9 ? "9+" : String(unreadCount);

  const renderNotificationItem = (
    notification: AdminNotification,
    variant: "dropdown" | "modal" = "dropdown",
  ) => {
    const style = getNotificationStyle(notification.eventType);
    const Icon = style.icon;
    const isUnread = !notification.isRead;

    const content = (
      <>
        <div className="flex min-w-0 flex-1 gap-3">
          <span
            className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${style.tone}`}
          >
            <Icon className="h-4 w-4" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {style.label}
              </span>
              {isUnread && <span className="h-2 w-2 rounded-full bg-orange-500" />}
            </div>

            <p className="text-sm text-slate-700 dark:text-slate-200">{notification.body}</p>

            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {getNotificationMetaLabel(notification)} ·{" "}
              {formatRelativeTime(notification.createdAt)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            deleteNotification(notification.id);
          }}
          className="shrink-0 text-slate-400 transition hover:text-red-500 dark:hover:text-red-400"
          aria-label="Delete notification"
        >
          <FiX className="h-4 w-4" />
        </button>
      </>
    );

    if (variant === "modal") {
      return (
        <div
          key={notification.id}
          onClick={() => {
            if (!notification.isRead) markAsRead(notification.id);
          }}
          className={`flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-4 transition hover:bg-gray-50 dark:hover:bg-gray-800 ${
            isUnread
              ? "border-orange-200 bg-orange-50 dark:border-orange-500/20 dark:bg-orange-500/10"
              : "border-gray-200 dark:border-gray-700"
          }`}
        >
          {content}
        </div>
      );
    }

    return (
      <DropdownItem
        onItemClick={() => {
          if (!notification.isRead) markAsRead(notification.id);
          closeDropdown();
        }}
        className={`flex items-start justify-between gap-3 rounded-lg border-b px-4 py-3 transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800 ${
          isUnread
            ? "border-orange-200 bg-orange-50 dark:border-orange-500/20 dark:bg-orange-500/10"
            : "border-slate-200 dark:border-slate-800"
        }`}
      >
        {content}
      </DropdownItem>
    );
  };

  const renderSection = (
    title: string,
    items: AdminNotification[],
    variant: "dropdown" | "modal",
  ) => {
    if (items.length === 0) return null;

    const Wrapper = variant === "dropdown" ? "li" : "div";

    return (
      <>
        <Wrapper className={variant === "dropdown" ? "px-3 py-2" : "px-1"}>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {title}
          </span>
        </Wrapper>
        {items.map((notification) =>
          variant === "dropdown" ? (
            <li key={notification.id}>
              {renderNotificationItem(notification, "dropdown")}
            </li>
          ) : (
            renderNotificationItem(notification, "modal")
          ),
        )}
      </>
    );
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="dropdown-toggle relative flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        onClick={toggleDropdown}
        aria-label="Notifications"
      >
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 z-10 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
            {badgeLabel}
          </span>
        )}
        <FiBell className="h-5 w-5" />
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute -right-[240px] mt-[17px] flex h-[min(480px,calc(100vh-6rem))] w-[min(361px,calc(100vw-1.5rem))] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-slate-900 sm:w-[361px] lg:right-0"
      >
        <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-700">
          <div>
            <h5 className="text-lg font-semibold text-gray-800 dark:text-slate-100">
              Notifications
            </h5>
            {unreadCount > 0 && (
              <p className="text-xs text-slate-500">{unreadCount} unread</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                disabled={reading}
                className="text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50 dark:text-indigo-400"
              >
                {reading ? "..." : "Mark all read"}
              </button>
            )}
            <button
              type="button"
              onClick={closeDropdown}
              className="text-gray-500 transition hover:text-red-500 dark:text-gray-400"
              aria-label="Close notifications"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>
        </div>

        <ul
          onScroll={handleScroll}
          className="custom-scrollbar flex h-auto flex-col overflow-y-auto"
        >
          {loading && (
            <li className="p-4 text-sm text-gray-500">Loading notifications...</li>
          )}

          {!loading && notifications.length === 0 && (
            <li className="flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                <FiBell className="h-5 w-5 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                No notifications
              </p>
              <p className="mt-1 text-xs text-gray-500">You&apos;re all caught up</p>
            </li>
          )}

          {renderSection("Today", grouped.today, "dropdown")}
          {renderSection("Yesterday", grouped.yesterday, "dropdown")}
          {renderSection("This week", grouped.thisWeek, "dropdown")}
          {renderSection("Earlier", grouped.earlier, "dropdown")}

          {loadingMore && (
            <li className="py-3 text-center text-xs text-gray-400">Loading more...</li>
          )}
        </ul>

        {notifications.length > 0 && (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(true);
                closeDropdown();
              }}
              className="block flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              View all
            </button>
            <button
              type="button"
              onClick={deleteAllNotifications}
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              Clear all
            </button>
          </div>
        )}
      </Dropdown>

      {isModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={closeModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="all-notifications-title"
          >
            <div
              className="flex max-h-[min(640px,calc(100vh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between border-b px-6 py-4 dark:border-gray-700">
                <div>
                  <h2
                    id="all-notifications-title"
                    className="text-lg font-semibold text-gray-800 dark:text-white"
                  >
                    All notifications
                  </h2>
                  {unreadCount > 0 && (
                    <p className="text-xs text-slate-500">{unreadCount} unread</p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      disabled={reading}
                      className="rounded-lg bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500/10 dark:text-indigo-400"
                    >
                      {reading ? "Reading..." : "Read all"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                    aria-label="Close modal"
                  >
                    <FiX className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div
                onScroll={handleScroll}
                className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
              >
                {renderSection("Today", grouped.today, "modal")}
                {renderSection("Yesterday", grouped.yesterday, "modal")}
                {renderSection("This week", grouped.thisWeek, "modal")}
                {renderSection("Earlier", grouped.earlier, "modal")}

                {loadingMore && (
                  <div className="py-3 text-center text-xs text-gray-400">
                    Loading more...
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
