import { useEffect, useMemo, useState } from "react";

/* ================= TYPES ================= */

type Invite = {
  inviteId: string;
  lenderId: string;
  name: string;
  email: string;
  inviteStatus: "PENDING" | "ACCEPTED" | "REJECTED";
  invitedAt: string;
};

type Stats = {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
};

/* ================= DUMMY DATA ================= */

const DUMMY_INVITED_LENDERS: Invite[] = [
  {
    inviteId: "1",
    lenderId: "l1",
    name: "HDFC Bank",
    email: "support@hdfc.com",
    inviteStatus: "PENDING",
    invitedAt: new Date().toISOString(),
  },
  {
    inviteId: "2",
    lenderId: "l2",
    name: "ICICI Bank",
    email: "icici@bank.com",
    inviteStatus: "ACCEPTED",
    invitedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    inviteId: "3",
    lenderId: "l3",
    name: "Axis Finance",
    email: "axis@finance.com",
    inviteStatus: "REJECTED",
    invitedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    inviteId: "4",
    lenderId: "l4",
    name: "Bajaj Finserv",
    email: "bajaj@finserv.com",
    inviteStatus: "PENDING",
    invitedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
];

/* ================= PAGE ================= */

export default function InvitedLenders() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);

  /* ================= LOAD DUMMY DATA ================= */

  useEffect(() => {
    setTimeout(() => {
      setInvites(DUMMY_INVITED_LENDERS);
      setLoading(false);
    }, 600);
  }, []);

  /* ================= STATS ================= */

  const stats: Stats = useMemo(() => {
    const total = invites.length;
    const pending = invites.filter((i) => i.inviteStatus === "PENDING").length;
    const accepted = invites.filter((i) => i.inviteStatus === "ACCEPTED").length;
    const rejected = invites.filter((i) => i.inviteStatus === "REJECTED").length;

    return { total, pending, accepted, rejected };
  }, [invites]);

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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total", value: stats.total },
          { label: "Pending", value: stats.pending },
          { label: "Accepted", value: stats.accepted },
          { label: "Rejected", value: stats.rejected },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border p-4 bg-white
            dark:bg-slate-900 dark:border-slate-700"
          >
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {s.label}
            </p>
            <p className="text-2xl font-semibold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
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
                <th className="p-4 text-left">Lender Name</th>
                <th className="p-4 text-left">Email</th>
                <th className="p-4 text-left">Status</th>
                <th className="p-4 text-left">Invited At</th>
              </tr>
            </thead>

            <tbody>
              {invites.map((i) => (
                <tr
                  key={i.inviteId}
                  className="border-t dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/40 transition"
                >
                  <td className="p-4 font-medium">{i.name}</td>
                  <td className="p-4">{i.email}</td>

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

                  <td className="p-4">
                    {formatDateTime(i.invitedAt)}
                  </td>
                </tr>
              ))}

              {invites.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="p-10 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="text-4xl">🏦</div>
                      <div className="font-medium text-slate-700 dark:text-slate-200">
                        No Lender Invites Found
                      </div>
                      <div className="text-sm text-slate-400">
                        You have not invited any lenders yet.
                      </div>
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
