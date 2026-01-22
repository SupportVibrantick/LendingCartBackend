import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";

type Broker = {
  id: string;
  profile?: string | null;
  name: string;
  email: string;
  phone: string;
  brokerStatus: "ACTIVE" | "INACTIVE";
  connectionStatus: "CONNECTED" | "PENDING" | "DISABLED";
  source: string;
  assignedAt: string;
};

function getInitialAvatar(name: string) {
  const letter = name?.charAt(0)?.toUpperCase() || "?";

  const colors = [
    "bg-red-500",
    "bg-green-500",
    "bg-blue-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-orange-500",
    "bg-teal-500",
    "bg-indigo-500",
  ];

  const color =
    colors[name.charCodeAt(0) % colors.length];

  return { letter, color };
}


/* ================= DUMMY DATA ================= */

const DUMMY_BROKERS: Broker[] = [
  {
    id: "1",
    profile: null,
    name: "Amit Sharma",
    email: "amit@gmail.com",
    phone: "9876543210",
    brokerStatus: "ACTIVE",
    connectionStatus: "CONNECTED",
    source: "MANUAL",
    assignedAt: "2025-12-01",
  },
  {
    id: "2",
    profile: null,
    name: "Rohit Verma",
    email: "rohit@gmail.com",
    phone: "9988776655",
    brokerStatus: "ACTIVE",
    connectionStatus: "DISABLED",
    source: "MANUAL",
    assignedAt: "2025-11-21",
  },
  {
    id: "3",
    profile: null,
    name: "Neha Gupta",
    email: "neha@gmail.com",
    phone: "9123456789",
    brokerStatus: "INACTIVE",
    connectionStatus: "DISABLED",
    source: "MANUAL",
    assignedAt: "2025-10-10",
  },
  {
    id: "4",
    profile: null,
    name: "Suresh Patel",
    email: "suresh@gmail.com",
    phone: "9000011111",
    brokerStatus: "ACTIVE",
    connectionStatus: "CONNECTED",
    source: "MANUAL",
    assignedAt: "2025-09-15",
  },
];

export default function MyLenders() {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  /* ================= LOAD DUMMY DATA ================= */
  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setBrokers(DUMMY_BROKERS);
      setLoading(false);
    }, 600); // fake loading
  }, []);

  /* ================= SEARCH ================= */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return brokers;
    return brokers.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.email.toLowerCase().includes(q) ||
        b.phone.includes(q)
    );
  }, [brokers, search]);

  /* ================= PAGINATION ================= */
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, pageSize]);

  /* ================= CONNECTION TOGGLE (LOCAL) ================= */
  async function handleConnectionToggle(broker: Broker) {
    const isActive = broker.connectionStatus === "DISABLED";
    const nextStatus = isActive ? "CONNECTED" : "DISABLED";

    const result = await Swal.fire({
      title: "Change connection?",
      text: `Set connection to ${nextStatus}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, update",
      confirmButtonColor: "#2563eb",
    });

    if (!result.isConfirmed) return;

    setUpdatingId(broker.id);

    // Fake delay
    setTimeout(() => {
      setBrokers((prev) =>
        prev.map((b) =>
          b.id === broker.id ? { ...b, connectionStatus: nextStatus } : b
        )
      );

      setUpdatingId(null);

      Swal.fire({
        icon: "success",
        title: "Connection updated",
        timer: 1000,
        showConfirmButton: false,
      });
    }, 500);
  }

  /* ================= UI ================= */
  return (
    <div className="px-6 py-6 text-gray-900 dark:text-gray-100">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">My Lenders</h1>
        </div>

        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search lender..."
            className="px-3 py-2 border rounded-md text-sm
              bg-white border-gray-300
              dark:bg-slate-800 dark:border-slate-600"
          />
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="px-2 py-2 border rounded-md text-sm
              bg-white border-gray-300
              dark:bg-slate-800 dark:border-slate-600"
          >
            <option value={5}>5 / page</option>
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-xl p-4 dark:bg-slate-900 dark:border-slate-700">
        {loading ? (
          <div className="py-10 text-center text-gray-500">
            Loading lenders…
          </div>
        ) : paginated.length === 0 ? (
          <div className="py-14 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/40">

            {/* Icon */}
            <div className="h-16 w-16 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 mb-4 shadow-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.6}
                  d="M12 4c4.418 0 8 1.79 8 4v8c0 2.21-3.582 4-8 4s-8-1.79-8-4V8c0-2.21 3.582-4 8-4z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.6}
                  d="M4 8c0 2.21 3.582 4 8 4s8-1.79 8-4"
                />
              </svg>
            </div>

            {/* Title */}
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              No Lenders Found
            </h3>

            {/* Subtitle */}
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
              You don’t have any lenders assigned yet. Once lenders are connected, they will appear here.
            </p>

          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-gray-500 dark:border-slate-700">
                <th className="py-2 text-left">Profile</th>
                <th className="py-2 text-left">Name</th>
                <th className="py-2 text-left">Email</th>
                <th className="py-2 text-left">Phone</th>
                <th className="py-2 text-left">Status</th>
                <th className="py-2 text-left">Connection</th>
                <th className="py-2 text-left">Assigned At</th>
              </tr>
            </thead>

            <tbody>
              {paginated.map((b) => (
                <tr key={b.id} className="border-b dark:border-slate-800">
                  <td className="py-3">
                    {b.profile ? (
                      <img
                        src={b.profile}
                        className="h-10 w-10 rounded-full border object-cover"
                      />
                    ) : (
                      (() => {
                        const { letter, color } = getInitialAvatar(b.name);
                        return (
                          <div
                            className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold ${color}`}
                          >
                            {letter}
                          </div>
                        );
                      })()
                    )}
                  </td>
                  <td>{b.name}</td>
                  <td>{b.email}</td>
                  <td>{b.phone}</td>

                  <td>
                    <span className="px-3 py-1 rounded-full text-xs font-medium">
                      {b.brokerStatus}
                    </span>
                  </td>

                  <td className="py-3">
                    <button
                      disabled={updatingId === b.id}
                      onClick={() => handleConnectionToggle(b)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition
                        ${b.connectionStatus === "CONNECTED"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                        }
                        ${updatingId === b.id
                          ? "opacity-50 cursor-not-allowed"
                          : "cursor-pointer"
                        }
                      `}
                    >
                      {updatingId === b.id
                        ? "Updating..."
                        : b.connectionStatus}
                    </button>
                  </td>

                  <td>
                    {new Date(b.assignedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            Prev
          </button>
          <button
            onClick={() =>
              setCurrentPage((p) => Math.min(totalPages, p + 1))
            }
            disabled={currentPage === totalPages}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
