import { useEffect, useState } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { socket } from "../../lib/socket";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE;

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  // const [notifying, setNotifying] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchNotifications = async () => {
    try {
      setLoading(true);

      const token = sessionStorage.getItem("lender_token");

      const res = await fetch(
        `${API_BASE}/lender/notifications?page=1&limit=20`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error("Failed to fetch notifications");
      }

      setNotifications(json.data.notifications || []);
      setUnreadCount(json.data.unreadCount || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const groupNotifications = (notifications: any[]) => {
    const today: any[] = [];
    const yesterday: any[] = [];
    const earlier: any[] = [];

    const now = new Date();

    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    notifications.forEach((n) => {
      const date = new Date(n.createdAt);

      if (date >= startOfToday) {
        today.push(n);
      } else if (date >= startOfYesterday) {
        yesterday.push(n);
      } else {
        earlier.push(n);
      }
    });

    return { today, yesterday, earlier };
  };

  function toggleDropdown() {
    setIsOpen(!isOpen);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  const handleClick = () => {
    toggleDropdown();
    // setNotifying(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const deleteNotification = async (id: string) => {
    try {
      const token = sessionStorage.getItem("lender_token");

      const res = await fetch(`${API_BASE}/lender/notifications/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error("Failed to delete notification");
      }

      // ✅ remove from UI
      setNotifications((prev) => prev.filter((n) => n.id !== id));

      // ✅ update unread count
      const deleted = notifications.find((n) => n.id === id);
      if (deleted && !deleted.isRead) {
        setUnreadCount((prev) => Math.max(prev - 1, 0));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const token = sessionStorage.getItem("lender_token");

      const res = await fetch(`${API_BASE}/lender/notifications/${id}/read`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error("Failed to mark as read");
      }

      // ✅ update UI instantly
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );

      // ✅ update unread count
      setUnreadCount((prev) => Math.max(prev - 1, 0));
    } catch (err) {
      console.error(err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = sessionStorage.getItem("lender_token");

      const res = await fetch(`${API_BASE}/lender/notifications/read-all`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error("Failed to mark all as read");
      }

      // ✅ update UI instantly
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));

      // ✅ reset unread count
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const renderItem = (n: any) => (
    <DropdownItem
      key={n.id}
      onItemClick={() => {
        if (!n.isRead) markAsRead(n.id);
        closeDropdown();
      }}
      className={`flex justify-between items-start p-4 rounded-xl border cursor-pointer
  ${!n.isRead ? "bg-blue-50" : "opacity-70"}`}
    >
      {/* LEFT */}
      <div className="flex gap-3">
        {/* Avatar initials */}
        <div className="w-10 h-10 rounded-full text-[#134E4A] flex items-center justify-center font-semibold text-sm">
          {n.metadata?.lenderName
            ?.split(" ")
            .map((w: string) => w[0])
            .slice(0, 2)
            .join("")
            .toUpperCase() || "NA"}
        </div>

        {/* TEXT */}
        <div className="flex flex-col">
          <span className="text-sm text-gray-800 dark:text-white">
            {n.body}
          </span>

          <span className="text-xs text-gray-500 mt-1 flex items-center gap-2">
            <span>{(n.metadata?.lenderName || "Lender").slice(0, 12)}...</span>

            <span className="w-1 h-1 bg-gray-400 rounded-full"></span>

            <span>{new Date(n.createdAt).toLocaleString()}</span>
          </span>
        </div>
      </div>

      {/* DELETE BUTTON */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          deleteNotification(n.id);
        }}
        className="text-gray-400 hover:text-red-500 transition"
      >
        ✕
      </button>
    </DropdownItem>
  );

  const deleteAllNotifications = async () => {
    try {
      const token = sessionStorage.getItem("lender_token");

      const res = await fetch(`${API_BASE}/lender/notifications/delete-all`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error("Failed to delete all notifications");
      }

      // ✅ clear UI
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const lenderUser = sessionStorage.getItem("lender_user");

    if (!lenderUser) return;

    const parsedUser = JSON.parse(lenderUser);
    const lenderOrgId = parsedUser.organizationId;

    if (!lenderOrgId) return;

    // ✅ Connect
    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);

      socket.emit("joinLenderRoom", lenderOrgId);
      console.log("📡 Joined lender room:", lenderOrgId);
    });

    // ❌ Error
    socket.on("connect_error", (err) => {
      console.error("❌ Socket error:", err.message);
    });

    // 🔌 Disconnect
    socket.on("disconnect", (reason) => {
      console.log("⚠️ Disconnected:", reason);
    });

    // 🎉 NEW NOTIFICATION EVENT (IMPORTANT)
    socket.on("APPLICATION_SENT", (data) => {
      console.log("📩 Notification received:", data);

      const notification = {
        id: data.id || Date.now(),
        body: data.body || "New application received",
        createdAt: new Date(),
        isRead: false,
        metadata: {
          lenderName: data?.lenderName || "Lender",
        },
      };

      setNotifications((prev) => {
        const exists = prev.find((n) => n.id === notification.id);
        if (exists) return prev;
        return [notification, ...prev];
      });

      // ✅ Update unread count
      setUnreadCount((prev) => prev + 1);

      // 🔔 Toast
      toast.success(notification.body);
    });

    // 🧹 Cleanup
    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("APPLICATION_SENT");
    };
  }, []);

  return (
    <div className="relative">
      <button
        className="relative flex items-center justify-center text-gray-500 transition-colors bg-white border border-gray-200 rounded-full dropdown-toggle hover:text-gray-700 h-11 w-11 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        onClick={handleClick}
      >
        {unreadCount > 0 && (
          <span className="absolute right-0 top-0.5 h-2 w-2 rounded-full bg-orange-400 animate-ping"></span>
        )}
        <svg
          className="fill-current"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M10.75 2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H4.37504H15.625H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248ZM14.875 14.4591V9.16748C14.875 6.47509 12.6924 4.29248 10 4.29248C7.30765 4.29248 5.12504 6.47509 5.12504 9.16748V14.4591H14.875ZM8.00004 17.7085C8.00004 18.1228 8.33583 18.4585 8.75004 18.4585H11.25C11.6643 18.4585 12 18.1228 12 17.7085C12 17.2943 11.6643 16.9585 11.25 16.9585H8.75004C8.33583 16.9585 8.00004 17.2943 8.00004 17.7085Z"
            fill="currentColor"
          />
        </svg>
      </button>
      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute -right-[240px] mt-[17px] flex h-[480px] w-[350px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark sm:w-[361px] lg:right-0"
      >
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-700">
          <h5 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Notification
          </h5>
          <button
            onClick={toggleDropdown}
            className="text-gray-500 transition dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <svg
              className="fill-current"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
        <ul className="flex flex-col h-auto overflow-y-auto custom-scrollbar">
          {loading && (
            <li className="text-center py-4 text-gray-500">Loading...</li>
          )}

          {!loading && notifications.length === 0 && (
            <li className="flex flex-col items-center justify-center py-10 text-center">
              {/* Icon */}
              <div className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 mb-3">
                🔔
              </div>

              {/* Title */}
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                No Notifications
              </p>

              {/* Subtitle */}
              <p className="text-xs text-gray-500 mt-1">
                You're all caught up 🎉
              </p>
            </li>
          )}

          {(() => {
            const { today, yesterday, earlier } =
              groupNotifications(notifications);

            return (
              <>
                {today.length > 0 && (
                  <>
                    <li className="flex items-center justify-between px-3 py-1">
                      <span className="text-xs font-semibold text-gray-500">
                        Today
                      </span>

                      {today.length > 0 && (
                        <button
                          onClick={deleteAllNotifications}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Delete All
                        </button>
                      )}
                    </li>
                    {today.map((n) => (
                      <li key={n.id}>{renderItem(n)}</li>
                    ))}
                  </>
                )}

                {yesterday.length > 0 && (
                  <>
                    <li className="flex items-center justify-between px-3 py-1">
                      <span className="text-xs font-semibold text-gray-500">
                        Yesterday
                      </span>

                      {yesterday.length > 0 && (
                        <button
                          onClick={deleteAllNotifications}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Delete All
                        </button>
                      )}
                    </li>
                    {yesterday.map((n) => (
                      <li key={n.id}>{renderItem(n)}</li>
                    ))}
                  </>
                )}

                {earlier.length > 0 && (
                  <>
                    <li className="flex items-center justify-between px-3 py-1">
                      <span className="text-xs font-semibold text-gray-500">
                        Earlier
                      </span>

                      {earlier.length > 0 && (
                        <button
                          onClick={deleteAllNotifications}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Delete All
                        </button>
                      )}
                    </li>
                    {earlier.map((n) => (
                      <li key={n.id}>{renderItem(n)}</li>
                    ))}
                  </>
                )}
              </>
            );
          })()}
        </ul>
        {notifications.length > 0 && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="block w-full px-4 py-2 mt-3 text-sm font-medium text-center border rounded-lg hover:bg-gray-100"
          >
            View All Notifications
          </button>
        )}
      </Dropdown>
      {isModalOpen && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border">
            {/* HEADER */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">All Notifications</h2>

              <div className="flex items-center gap-4">
                {/* ✅ Mark All as Read */}
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-blue-500 hover:underline"
                  >
                    Mark all as read
                  </button>
                )}

                {/* ❌ Close */}
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-500 hover:text-red-500"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* LIST */}
            <div className="max-h-[500px] custom-scrollbar overflow-y-auto p-4 space-y-3">
              {(() => {
                const { today, yesterday, earlier } =
                  groupNotifications(notifications);

                const renderItem = (n: any) => (
                  <div
                    key={n.id}
                    className={`flex justify-between items-start p-4 rounded-xl border transition hover:bg-gray-50
      ${!n.isRead ? "bg-blue-50 border-blue-200" : "border-gray-200"}`}
                  >
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#134E4A] text-white flex items-center justify-center font-semibold">
                        {n.metadata?.lenderName
                          ?.split(" ")
                          .map((w: string) => w[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase() || "NA"}
                      </div>

                      <div>
                        <p className="text-sm">{n.body}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {n.metadata?.lenderName || "Lender"} •{" "}
                          {new Date(n.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(n.id);
                      }}
                      className="text-gray-400 hover:text-red-500"
                    >
                      ✕
                    </button>
                  </div>
                );

                return (
                  <>
                    {today.length > 0 && (
                      <>
                        <div className="flex items-center justify-between px-1">
                          <p className="text-xs font-semibold text-gray-500">
                            Today
                          </p>

                          {today.length > 0 && (
                            <button
                              onClick={deleteAllNotifications}
                              className="text-xs text-red-500 hover:underline"
                            >
                              Delete All
                            </button>
                          )}
                        </div>
                        {today.map(renderItem)}
                      </>
                    )}

                    {yesterday.length > 0 && (
                      <>
                        <p className="text-xs font-semibold text-gray-500 px-1 mt-4">
                          Yesterday
                        </p>
                        {yesterday.map(renderItem)}
                      </>
                    )}

                    {earlier.length > 0 && (
                      <>
                        <p className="text-xs font-semibold text-gray-500 px-1 mt-4">
                          Earlier
                        </p>
                        {earlier.map(renderItem)}
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
