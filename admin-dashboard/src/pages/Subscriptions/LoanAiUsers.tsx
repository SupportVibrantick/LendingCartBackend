import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { FiRefreshCw, FiSearch, FiUsers } from "react-icons/fi";
import { HiOutlineUserPlus } from "react-icons/hi2";
import SubscriptionNav from "../../components/subscriptions/SubscriptionNav";
import {
  FilterBar,
  PaginationBar,
  StatusBadge,
  SubscriptionPageHeader,
  SubscriptionPageShell,
  TableSkeleton,
  filterControlClass,
  secondaryBtnClass,
} from "../../components/subscriptions/SubscriptionUi";
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
    <SubscriptionPageShell>
      <SubscriptionPageHeader
        title="Loan AI Signups"
        description="Users who registered on the Loan AI marketing site — before and after subscription."
        actions={
          <button type="button" onClick={refreshAll} className={secondaryBtnClass}>
            <FiRefreshCw size={16} />
            Refresh
          </button>
        }
      />

      <SubscriptionNav />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#13538A]/10 text-[#13538A]">
              <FiUsers size={18} />
            </span>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Total signups</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <HiOutlineUserPlus size={18} />
            </span>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Subscribed</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats.subscribed}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <FiUsers size={18} />
            </span>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Registered only</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.pending}</p>
            </div>
          </div>
        </div>
      </div>

      <FilterBar>
        <div className="relative flex-1">
          <FiSearch
            className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className={`w-full py-2.5 pr-10 pl-10 ${filterControlClass}`}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              Clear
            </button>
          )}
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={filterControlClass}
        >
          <option value="">All users</option>
          <option value="true">Subscribed</option>
          <option value="false">Registered only</option>
        </select>
      </FilterBar>

      {debouncedSearch && (
        <p className="mb-4 text-xs text-slate-500">
          Showing results for &ldquo;{debouncedSearch}&rdquo;
          {loading ? " — searching..." : ` — ${total} found`}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60">
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
                <TableSkeleton columns={7} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    {debouncedSearch
                      ? "No users match your search"
                      : "No Loan AI registrations yet."}
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
                      className="border-t border-slate-100 transition hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-800/30"
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
                          <StatusBadge status={row.subscription?.status || "ACTIVE"} />
                        ) : (
                          <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
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
                            onClick={() =>
                              openSubscriberDetail(navigate, row.organization!.id)
                            }
                            className="font-semibold text-[#13538A] hover:underline dark:text-indigo-400"
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
      </div>

      <PaginationBar
        page={page}
        totalPages={totalPages}
        total={total}
        noun="users"
        onPageChange={setPage}
      />
    </SubscriptionPageShell>
  );
}
