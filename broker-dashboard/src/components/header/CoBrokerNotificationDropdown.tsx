import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiBell, FiCheck } from "react-icons/fi";
import { Dropdown } from "../ui/dropdown/Dropdown";
import {
  CO_BROKER_API_BASE,
  checkCoBrokerResponse,
  getCoBrokerAuthHeaders,
} from "../../lib/coBrokerPortal";
import { isSessionExpiredError } from "../../lib/sessionExpiry";

type CoBrokerNotification = {
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
    submissionId?: string;
    conversationId?: string;
  };
};

export default function CoBrokerNotificationDropdown() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<CoBrokerNotification[]>(
    [],
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `${CO_BROKER_API_BASE}/subbroker/notifications/?limit=15`,
        {
          headers: getCoBrokerAuthHeaders(),
        },
      );
      const json = await res.json();
      checkCoBrokerResponse(res, json);
      if (res.ok && json.success) {
        setNotifications(json.data.notifications || []);
        setUnreadCount(json.data.unreadCount || 0);
      }
    } catch (err) {
      if (isSessionExpiredError(err)) return;
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
    try {
      const res = await fetch(
        `${CO_BROKER_API_BASE}/subbroker/notifications/${id}/read`,
        {
          method: "PATCH",
          headers: getCoBrokerAuthHeaders(),
        },
      );
      const json = await res.json();
      checkCoBrokerResponse(res, json);
      if (!res.ok) return;

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      if (isSessionExpiredError(err)) return;
    }
  };

  const markAllRead = async () => {
    try {
      const res = await fetch(
        `${CO_BROKER_API_BASE}/subbroker/notifications/read-all`,
        {
          method: "PATCH",
          headers: getCoBrokerAuthHeaders(),
        },
      );
      const json = await res.json();
      checkCoBrokerResponse(res, json);
      if (!res.ok) return;

      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      if (isSessionExpiredError(err)) return;
    }
  };

  const handleClick = async (n: CoBrokerNotification) => {
    if (!n.isRead) await markRead(n.id);
    setIsOpen(false);

    const submissionId = n.metadata?.submissionId;
    if (submissionId) {
      navigate("/sub-broker/loan-pipeline-preview", {
        state: { submissionId },
      });
      return;
    }

    if (
      n.metadata?.applicationId ||
      n.metadata?.loanApplicationId ||
      n.eventType?.includes("APPLICATION") ||
      n.eventType?.includes("ASSIGN") ||
      n.eventType?.includes("DOCUMENT") ||
      n.eventType?.includes("LENDER") ||
      n.eventType?.includes("LOI")
    ) {
      navigate("/sub-broker/loan-pipeline");
      return;
    }

    if (n.metadata?.conversationId) {
      navigate("/sub-broker/loan-pipeline");
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
            <h5 className="font-semibold text-gray-900 dark:text-white">
              Notifications
            </h5>
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
                <div
                  key={i}
                  className="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"
                />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              No notifications yet
            </p>
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
                    <div className="flex items-start gap-2">
                      {!n.isRead && (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#13538A]" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {n.subject ||
                            n.eventType?.replace(/_/g, " ") ||
                            "Update"}
                        </p>
                        {n.body && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
                            {n.body}
                          </p>
                        )}
                        <p className="mt-1 text-[10px] text-gray-400">
                          {new Date(n.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
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
