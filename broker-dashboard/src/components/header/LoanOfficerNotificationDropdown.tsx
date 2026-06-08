import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiBell, FiCheck } from "react-icons/fi";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { LO_API_BASE, loAuthHeaders } from "../../lib/loanOfficerApi";

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
  };
};

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

  const markRead = async (id: string) => {
    await fetch(`${LO_API_BASE}/loanofficer/notifications/${id}/read`, {
      method: "PATCH",
      headers: loAuthHeaders(),
    });
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

    const appId =
      n.metadata?.applicationId || n.metadata?.loanApplicationId;
    if (appId) {
      navigate("/loan-officer/loan-pipeline");
      return;
    }
    if (n.metadata?.conversationId) {
      navigate("/loan-officer/messages");
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
                      {new Date(n.createdAt).toLocaleString()}
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
