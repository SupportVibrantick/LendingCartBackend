import { useEffect, useState } from "react";
import { FileText, Clock, CheckCircle, XCircle } from "lucide-react";

/* ================= TYPES ================= */

type Invite = {
  inviteId: string;
  lenderId: string;
  name: string;
  email: string;
  phone: string;
  profileImage?: string | null;
  lenderStatus: "ACTIVE" | "INACTIVE";
  inviteStatus: "PENDING" | "ACCEPTED" | "REJECTED";
  invitedAt: string;
};

type Stats = {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
const FALLBACK_AVATAR = "/broker-icon.jpg"; // public folder image

function getAuthHeaders(): HeadersInit {
  const token = sessionStorage.getItem("broker_token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

/* ================= PAGE ================= */

export default function InvitedLenders() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    pending: 0,
    accepted: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(true);

  /* ================= FETCH ================= */

  useEffect(() => {
    fetchInvites();
  }, []);

  async function fetchInvites() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/broker/lenders/invites/list`, {
        headers: getAuthHeaders(),
      });

      const json = await res.json();

      if (!res.ok || json.success !== true) {
        throw new Error(json.message || "Failed to load invites");
      }

      setInvites(Array.isArray(json.data) ? json.data : []);
      setStats(
        json.stats || { total: 0, pending: 0, accepted: 0, rejected: 0 },
      );
    } catch (err) {
      console.error("Fetch invites failed:", err);
    } finally {
      setLoading(false);
    }
  }

  function formatDateTime(date: string) {
    return new Date(date).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  /* ================= UI ================= */

  return (
    <div className="px-6 py-6 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Invited Lenders</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Manage lender invite requests
        </p>
      </div>

      {/* ================= STATS ================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
        <StatBox label="Total" value={stats.total} variant="blue" />
        <StatBox label="Pending" value={stats.pending} variant="yellow" />
        <StatBox label="Accepted" value={stats.accepted} variant="green" />
        <StatBox label="Rejected" value={stats.rejected} variant="red" />
      </div>

      {/* ================= TABLE ================= */}
      <div className="rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 overflow-hidden">
        {/* Loading Skeleton */}
        {loading ? (
          <div className="p-8 space-y-3 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-4 rounded bg-gray-200 dark:bg-slate-700"
              />
            ))}
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 dark:bg-slate-800">
              <tr className="text-xs uppercase text-gray-500 dark:text-slate-400">
                <th className="p-4 text-left">Profile</th>
                <th className="p-4 text-left">Lender Name</th>
                <th className="p-4 text-left">Email</th>
                <th className="p-4 text-left">Phone</th>
                <th className="p-4 text-left">Lender Status</th>
                <th className="p-4 text-left">Invite Status</th>
                <th className="p-4 text-left">Invited At</th>
              </tr>
            </thead>

            <tbody>
              {invites.map((i) => (
                <tr
                  key={i.inviteId}
                  className="border-t dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/40 transition"
                >
                  {/* PROFILE */}
                  <td className="p-4">
                    <img
                      src={
                        i.profileImage
                          ? `${API_BASE}/public${i.profileImage}`
                          : FALLBACK_AVATAR
                      }
                      onError={(e: any) => {
                        e.currentTarget.src = FALLBACK_AVATAR;
                      }}
                      className="h-10 w-10 rounded-full object-cover border"
                    />
                  </td>

                  <td className="p-4 font-medium">{i.name}</td>
                  <td className="p-4">{i.email}</td>
                  <td className="p-4">{i.phone}</td>

                  {/* Lender Status */}
                  <td className="p-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium
                        ${
                          i.lenderStatus === "ACTIVE"
                            ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-300"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-500/10 dark:text-gray-300"
                        }`}
                    >
                      {i.lenderStatus}
                    </span>
                  </td>

                  {/* Invite Status */}
                  <td className="p-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium
                        ${
                          i.inviteStatus === "PENDING"
                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-300"
                            : i.inviteStatus === "ACCEPTED"
                              ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-300"
                              : "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300"
                        }`}
                    >
                      {i.inviteStatus}
                    </span>
                  </td>

                  <td className="p-4">{formatDateTime(i.invitedAt)}</td>
                </tr>
              ))}

              {invites.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      {/* Icon */}
                      <div className="h-16 w-16 rounded-2xl bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4 shadow-sm">
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
                            d="M3 7h18M3 12h18M3 17h18"
                          />
                        </svg>
                      </div>

                      {/* Title */}
                      <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                        No Lender Invites Found
                      </h3>

                      {/* Subtitle */}
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                        You haven’t invited any lenders yet. Once you send
                        invites, they will appear here for tracking.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ================= STAT BOX ================= */

function StatBox({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: "blue" | "yellow" | "green" | "red";
}) {
  const iconMap = {
    blue: <FileText className="w-5 h-5 text-white" />,
    yellow: <Clock className="w-5 h-5 text-white" />,
    green: <CheckCircle className="w-5 h-5 text-white" />,
    red: <XCircle className="w-5 h-5 text-white" />,
  };

  const colorMap = {
    blue: "bg-blue-600",
    yellow: "bg-yellow-500",
    green: "bg-emerald-600",
    red: "bg-red-600",
  };

  return (
    <div
      className="
        bg-white dark:bg-slate-900
        border border-slate-200 dark:border-slate-800
        rounded-2xl
        p-5
        shadow-sm hover:shadow-md
        transition-all duration-200
        flex items-center justify-between
      "
    >
      {/* Left Content */}
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-2xl font-semibold text-slate-900 dark:text-white mt-1">
          {value}
        </p>
      </div>

      {/* Icon */}
      <div
        className={`h-10 w-10 flex items-center justify-center rounded-full ${colorMap[variant]}`}
      >
        {iconMap[variant]}
      </div>
    </div>
  );
}
