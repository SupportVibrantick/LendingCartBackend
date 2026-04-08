import { useEffect, useState } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { socket } from "../../lib/socket";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5173";

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);

  const [reading, setReading] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const notifying = unreadCount > 0;

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  function toggleDropdown() {
    setIsOpen(!isOpen);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  async function markAsRead(id: string) {
    try {
      const token = sessionStorage.getItem("broker_token");

      await fetch(`${API_BASE}/broker/notifications/${id}/read`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );

      setUnreadCount((prev) => Math.max(prev - 1, 0));
    } catch (err) {
      console.error("Mark read error", err);
    }
  }

  async function deleteAllNotifications() {
    try {
      const token = sessionStorage.getItem("broker_token");

      const res = await fetch(`${API_BASE}/broker/notifications/delete-all`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error("Failed to delete all notifications");
      }

      // ✅ clear UI instantly
      setNotifications([]);
      setUnreadCount(0);
      setHasMore(false);
    } catch (err) {
      console.error("Delete all error", err);
    }
  }

  async function markAllAsRead() {
    try {
      setReading(true);

      const token = sessionStorage.getItem("broker_token");

      await fetch(`${API_BASE}/broker/notifications/read-all`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } finally {
      setReading(false);
    }
  }

  async function deleteNotification(id: string) {
    try {
      const token = sessionStorage.getItem("broker_token");

      await fetch(`${API_BASE}/broker/notifications/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setNotifications((prev) => prev.filter((n) => n.id !== id));

      // unread count update
      const deleted = notifications.find((n) => n.id === id);
      if (deleted && !deleted.isRead) {
        setUnreadCount((prev) => Math.max(prev - 1, 0));
      }
    } catch (err) {
      console.error("Delete notification error", err);
    }
  }

  async function fetchNotifications(pageNumber = 1) {
    try {
      if (pageNumber === 1) setLoading(true);
      else setLoadingMore(true);

      const token = sessionStorage.getItem("broker_token");

      const res = await fetch(
        `${API_BASE}/broker/notifications?page=${pageNumber}&limit=10`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await res.json();

      const newNotifications = data?.data?.notifications || [];

      if (pageNumber === 1) {
        setNotifications(newNotifications);
      } else {
        setNotifications((prev) => [...prev, ...newNotifications]);
      }

      setUnreadCount(data?.data?.unreadCount || 0);

      if (newNotifications.length < 10) {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Notification API error", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  const handleClick = () => {
    toggleDropdown();
  };

  useEffect(() => {
    fetchNotifications(1);
  }, []);

  function handleScroll(e: any) {
    const { scrollTop, scrollHeight, clientHeight } = e.target;

    if (scrollHeight - scrollTop <= clientHeight + 50) {
      if (hasMore && !loadingMore) {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchNotifications(nextPage);
      }
    }
  }

  function groupNotifications(notifications: any[]) {
    const today: any[] = [];
    const yesterday: any[] = [];
    const thisWeek: any[] = [];
    const earlier: any[] = [];

    const now = new Date();

    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday start

    notifications.forEach((n) => {
      const date = new Date(n.createdAt);

      if (date >= startOfToday) {
        today.push(n);
      } else if (date >= startOfYesterday) {
        yesterday.push(n);
      } else if (date >= startOfWeek) {
        thisWeek.push(n);
      } else {
        earlier.push(n);
      }
    });

    return { today, yesterday, thisWeek, earlier };
  }

  // const orderedNotifications = useMemo(() => {
  //   const { today, yesterday, thisWeek, earlier } =
  //     groupNotifications(notifications);

  //   return [...today, ...yesterday, ...thisWeek, ...earlier];
  // }, [notifications]);

  const renderDropdownItem = (n: any) => (
    <DropdownItem
      onItemClick={() => {
        if (!n.isRead) {
          markAsRead(n.id);
        }
        closeDropdown();
      }}
      className={`
      flex justify-between items-start gap-3 
      rounded-lg border-b 
      px-4 py-3
      border-slate-200 dark:border-slate-800
      transition-all duration-200
      hover:bg-slate-100 dark:hover:bg-slate-800

      ${
        !n.isRead
          ? "bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20"
          : ""
      }
    `}
    >
      {/* LEFT CONTENT */}
      <div className="flex gap-3">
        {/* Avatar */}
        <span
          className="
          relative flex items-center justify-center 
          w-10 h-10 rounded-full 
          text-sm font-semibold
           text-indigo-600
           dark:text-indigo-400
        "
        >
          {n.metadata?.lenderName
            ?.trim()
            .split(" ")
            .map((w: string) => w[0])
            .slice(0, 2)
            .join("")
            .toUpperCase() || "NA"}
        </span>

        {/* Text */}
        <span className="block">
          {/* Main Text */}
          <span className="mb-1 block text-sm text-slate-700 dark:text-slate-200">
            {n.body}
          </span>

          {/* Meta Info */}
          <span className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{(n.metadata?.lenderName || "Lender").slice(0, 12)}...</span>

            <span className="w-1 h-1 bg-slate-400 rounded-full"></span>

            <span>{new Date(n.createdAt).toLocaleString()}</span>
          </span>
        </span>
      </div>

      {/* DELETE BUTTON */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          deleteNotification(n.id);
        }}
        className="
        text-slate-400 
        hover:text-red-500 
        dark:hover:text-red-400
        transition
      "
      >
        ✕
      </button>
    </DropdownItem>
  );

  useEffect(() => {
    const brokerUser = sessionStorage.getItem("broker_user");

    if (!brokerUser) return;

    const parsedUser = JSON.parse(brokerUser);
    const brokerOrgId = parsedUser.organizationId;

    if (!brokerOrgId) return;

    // 🔌 Socket connected check
    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);

      // room join after connection
      socket.emit("joinBrokerRoom", brokerOrgId);
      console.log("📡 Joined broker room:", brokerOrgId);
    });

    // ❌ Connection error
    socket.on("connect_error", (err) => {
      console.error("❌ Socket connection error:", err.message);
    });

    // 🔌 Disconnect
    socket.on("disconnect", (reason) => {
      console.log("⚠️ Socket disconnected:", reason);
    });

    // 🎉 Notification event
    socket.on("LOI_GENERATED", (data) => {
      console.log("📩 LOI_GENERATED event received:", data);

      const notification = {
        id: data.applicationLenderId,
        body: `LOI generated by ${data.lenderName} for application ${data.applicationNumber}`,
        createdAt: new Date(),
        isRead: false,
        metadata: {
          lenderName: data.lenderName,
          loiPath: data.loiPath,
        },
      };

      setNotifications((prev) => [notification, ...prev]);

      setPage(1);
      setHasMore(true);
      setUnreadCount((prev) => prev + 1);

      toast.success(notification.body);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("LOI_GENERATED");
    };
  }, []);

  return (
    <div className="relative">
      <button
        className="relative flex items-center justify-center text-gray-500 transition-colors bg-white border border-gray-200 rounded-full dropdown-toggle hover:text-gray-700 h-11 w-11  dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        onClick={handleClick}
      >
        <span
          className={`absolute right-0 top-0.5 z-10 h-2 w-2 rounded-full bg-orange-400 ${
            !notifying ? "hidden" : "flex"
          }`}
        >
          <span className="absolute inline-flex w-full h-full bg-orange-400 rounded-full opacity-75 animate-ping"></span>
        </span>
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
        className="absolute -right-[240px] mt-[17px] flex h-[480px] w-[350px] flex-col rounded-2xl border border-gray-200  bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-slate-900 sm:w-[361px] lg:right-0"
      >
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-700">
          <h5 className="text-lg font-semibold text-gray-800 dark:text-slate-100">
            Notification
          </h5>
          <button
            onClick={toggleDropdown}
            className="text-gray-500 transition dark:text-gray-400 hover:text-red-500"
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
        <ul
          onScroll={handleScroll}
          className="flex flex-col h-auto overflow-y-auto custom-scrollbar"
        >
          {loading && (
            <li className="p-4 text-sm text-gray-500">
              Loading notifications...
            </li>
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
            const { today, yesterday, thisWeek, earlier } =
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
                      <li key={n.id}>{renderDropdownItem(n)}</li>
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
                      <li key={n.id}>{renderDropdownItem(n)}</li>
                    ))}
                  </>
                )}

                {thisWeek.length > 0 && (
                  <>
                    <li className="flex items-center justify-between px-3 py-1">
                      <span className="text-xs font-semibold text-gray-500">
                        This Week
                      </span>

                      {thisWeek.length > 0 && (
                        <button
                          onClick={deleteAllNotifications}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Delete All
                        </button>
                      )}
                    </li>
                    {thisWeek.map((n) => (
                      <li key={n.id}>{renderDropdownItem(n)}</li>
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
                      <li key={n.id}>{renderDropdownItem(n)}</li>
                    ))}
                  </>
                )}
              </>
            );
          })()}
        </ul>
        {loadingMore && (
          <li className="text-center py-3 text-xs text-gray-400">
            Loading more...
          </li>
        )}
        {notifications.length > 0 && (
          <button
            onClick={() => {
              setIsModalOpen(true);
              closeDropdown();
            }}
            className="block w-full px-4 py-2 mt-3 text-sm font-medium text-center text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            View All Notifications
          </button>
        )}
      </Dropdown>

      {isModalOpen && (
        <div className="fixed inset-0 z-[9999999999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                All Notifications
              </h2>

              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    disabled={unreadCount === 0 || reading}
                    className="px-3 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-indigo-500/10 dark:text-indigo-400"
                  >
                    {reading ? "Reading..." : "Read All"}
                  </button>
                )}

                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-500 hover:text-red-500 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content */}
            <div
              onScroll={handleScroll}
              className="max-h-[500px] overflow-y-auto p-4 space-y-3"
            >
              {(() => {
                const { today, yesterday, thisWeek, earlier } =
                  groupNotifications(notifications);

                const renderItem = (n: any) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (!n.isRead) {
                        markAsRead(n.id);
                      }
                    }}
                    className={`flex items-start justify-between gap-3 p-4 rounded-xl border transition cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800
      ${
        !n.isRead
          ? "bg-orange-50 dark:bg-orange-500/10 border-orange-200"
          : "border-gray-200 dark:border-gray-700"
      }`}
                  >
                    <div className="flex gap-3">
                      <span className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-500 text-white text-sm font-semibold">
                        {n.metadata?.lenderName
                          ?.trim()
                          .split(" ")
                          .map((w: string) => w[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase() || "NA"}
                      </span>

                      <div className="flex flex-col">
                        <span className="text-sm text-gray-800 dark:text-slate-100">
                          {n.body}
                        </span>

                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {n.metadata?.lenderName} •{" "}
                          {new Date(n.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(n.id);
                      }}
                      className="text-gray-400 hover:text-red-500 text-sm"
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
                        <div className="flex items-center justify-between px-1 mt-4">
                          <p className="text-xs font-semibold text-gray-500">
                            Yesterday
                          </p>

                          {yesterday.length > 0 && (
                            <button
                              onClick={deleteAllNotifications}
                              className="text-xs text-red-500 hover:underline"
                            >
                              Delete All
                            </button>
                          )}
                        </div>
                        {yesterday.map(renderItem)}
                      </>
                    )}

                    {thisWeek.length > 0 && (
                      <>
                        <div className="flex items-center justify-between px-1 mt-4">
                          <p className="text-xs font-semibold text-gray-500">
                            This Week
                          </p>

                          {thisWeek.length > 0 && (
                            <button
                              onClick={deleteAllNotifications}
                              className="text-xs text-red-500 hover:underline"
                            >
                              Delete All
                            </button>
                          )}
                        </div>
                        {thisWeek.map(renderItem)}
                      </>
                    )}

                    {earlier.length > 0 && (
                      <>
                        <div className="flex items-center justify-between px-1 mt-4">
                          <p className="text-xs font-semibold text-gray-500">
                            Earlier
                          </p>

                          {earlier.length > 0 && (
                            <button
                              onClick={deleteAllNotifications}
                              className="text-xs text-red-500 hover:underline"
                            >
                              Delete All
                            </button>
                          )}
                        </div>
                        {earlier.map(renderItem)}
                      </>
                    )}

                    {loadingMore && (
                      <div className="text-center py-3 text-xs text-gray-400">
                        Loading more...
                      </div>
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
