import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { FiRefreshCw, FiSearch, FiUsers } from "react-icons/fi";
import { HiOutlineUserPlus } from "react-icons/hi2";
import SubscriptionNav from "../../components/subscriptions/SubscriptionNav";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import {
  fetchLoanAiUsers,
  fetchLoanAiUserStats,
  formatDate,
  formatUserName,
  type LoanAiUserRow,
  type LoanAiUserStats,
} from "../../lib/loanAiUsersApi";
import { openSubscriberDetail } from "../../lib/subscriberNavigation";
import { STATUS_COLORS } from "../../lib/subscriptionApi";

export default function LoanAiUsers() {
  const navigate = useNavigate();

  const [rows, setRows] = useState<LoanAiUserRow[]>([]);
  const [stats, setStats] = useState<LoanAiUserStats>({ total: 0, subscribed: 0, pending: 0 });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 350);
  const [filterStatus, setFilterStatus] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 15;

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterStatus]);

  const loadStats = useCallback(async () => {
    const json = await fetchLoanAiUserStats();
    if (json.success && json.data) setStats(json.data);
  }, []);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const json = await fetchLoanAiUsers({
        page,
        limit,
        search: debouncedSearch || undefined,
        hasSubscription: filterStatus ? (filterStatus as "true" | "false") : undefined,
      });
      if (!json.success) {
        toast.error(json.message || "Failed to load Loan AI users");
        return;
      }
      setRows(json.data || []);
      setTotal(json.meta?.total || 0);
      if (json.meta?.page) setPage(json.meta.page);
    } catch {
      toast.error("Failed to load Loan AI users");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filterStatus, limit]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    loadStats();
  }, [loadStats, rows.length]);

  const totalPages = Math.ceil(total / limit);

  const refreshAll = async () => {
    await Promise.all([fetchRows(), loadStats()]);
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Loan AI Signups</h1>
          <p className="text-sm text-slate-500 mt-1">
            Users who registered on the Loan AI marketing site — before and after subscription.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshAll}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <FiRefreshCw size={16} />
          Refresh
        </button>
      </div>

      <SubscriptionNav />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center gap-3">
            <span className="h-10 w-10 rounded-xl bg-[#13538A]/10 text-[#13538A] flex items-center justify-center">
              <FiUsers size={18} />
            </span>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Total signups</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center gap-3">
            <span className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <HiOutlineUserPlus size={18} />
            </span>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Subscribed</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.subscribed}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center gap-3">
            <span className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <FiUsers size={18} />
            </span>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Registered only</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.pending}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-[#18B6B4]/25"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
        >
          <option value="">All users</option>
          <option value="true">Subscribed</option>
          <option value="false">Registered only</option>
        </select>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Registered</th>
                <th className="px-4 py-3 font-semibold">Last login</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Add-ons</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    No Loan AI registrations yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const addOnCount = Array.isArray(row.subscription?.purchasedAddOns)
                    ? row.subscription.purchasedAddOns.length
                    : 0;

                  return (
                    <tr
                      key={row.id}
                      className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900 dark:text-white">
                          {formatUserName(row)}
                        </p>
                        <p className="text-xs text-slate-500">{row.email}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {formatDate(row.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {formatDate(row.lastLoginAt)}
                      </td>
                      <td className="px-4 py-3">
                        {row.hasBrokerSubscription ? (
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                              STATUS_COLORS[row.subscription?.status || "ACTIVE"] ||
                              "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {row.subscription?.status || "ACTIVE"}
                          </span>
                        ) : (
                          <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                            Registered
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        {row.subscription?.package
                          ? `${row.subscription.package.name} (${row.subscription.package.code})`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {addOnCount > 0 ? `${addOnCount} selected` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {row.organization?.id ? (
                          <button
                            type="button"
                            onClick={() => openSubscriberDetail(navigate, row.organization!.id)}
                            className="text-[#13538A] dark:text-indigo-400 font-semibold hover:underline"
                          >
                            View subscriber
                          </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800">
            <p className="text-sm text-slate-500">
              Page {page} of {totalPages} · {total} users
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
