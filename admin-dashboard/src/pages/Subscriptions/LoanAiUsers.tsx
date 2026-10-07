import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  FiClock,
  FiExternalLink,
  FiRefreshCw,
  FiSearch,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import SubscriptionNav from "../../components/subscriptions/SubscriptionNav";
import {
  FilterBar,
  PaginationBar,
  StatusBadge,
  SubscriptionPageHeader,
  SubscriptionPageShell,
  TableSkeleton,
  filterControlClass,
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
import { getPackageCodeLabel } from "../../lib/packageDisplay";
import { openSubscriberDetail } from "../../lib/subscriberNavigation";

export default function LoanAiUsers() {
  const navigate = useNavigate();

  const [rows, setRows] = useState<LoanAiUserRow[]>([]);
  const [stats, setStats] = useState<LoanAiUserStats>({
    total: 0,
    subscribed: 0,
    pending: 0,
  });
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
        hasSubscription: filterStatus
          ? (filterStatus as "true" | "false")
          : undefined,
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

  const statCards = [
    {
      label: "Total signups",
      value: stats.total,
      icon: <FiUsers size={18} />,
      tone: "bg-[#13538A]/10 text-[#13538A] dark:bg-indigo-500/15 dark:text-indigo-300",
    },
    {
      label: "Subscribed",
      value: stats.subscribed,
      icon: <FiUserCheck size={18} />,
      tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
    },
    {
      label: "Registered only",
      value: stats.pending,
      icon: <FiClock size={18} />,
      tone: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
    },
  ];

  return (
    <SubscriptionPageShell>
      <SubscriptionPageHeader
        title="Loan AI Signups"
        description="Users who registered on the Loan AI marketing site — before and after subscription."
        actions={
          <button
            type="button"
            onClick={() => void refreshAll()}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <FiRefreshCw
              size={15}
              className={loading ? "animate-spin" : undefined}
            />
            Refresh
          </button>
        }
      />

      <SubscriptionNav />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-3">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.tone}`}
              >
                {stat.icon}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {stat.label}
                </p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">
                  {stat.value}
                </p>
              </div>
            </div>
          </div>
        ))}
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
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              Clear
            </button>
          ) : null}
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

      {debouncedSearch ? (
        <p className="mb-4 text-xs text-slate-500">
          Showing results for &ldquo;{debouncedSearch}&rdquo;
          {loading ? " — searching..." : ` — ${total} found`}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Registered</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Add-ons</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton columns={7} />
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-14 text-center text-slate-500"
                  >
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                        <FiUsers size={22} />
                      </span>
                      <p className="font-medium text-slate-700 dark:text-slate-200">
                        {debouncedSearch
                          ? "No users match your search"
                          : "No Loan AI registrations yet"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {debouncedSearch
                          ? "Try a different name or email."
                          : "New signups from the marketing site will show up here."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const addOnCount = Array.isArray(
                    row.subscription?.purchasedAddOns,
                  )
                    ? row.subscription.purchasedAddOns.length
                    : 0;

                  return (
                    <tr
                      key={row.id}
                      className="border-t border-slate-100 transition hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#13538A]/10 text-xs font-bold text-[#13538A] dark:bg-indigo-500/15 dark:text-indigo-300">
                            {formatUserName(row).charAt(0).toUpperCase() || "U"}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900 dark:text-white">
                              {formatUserName(row)}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {row.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {formatDate(row.createdAt)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {formatDate(row.lastLoginAt)}
                      </td>
                      <td className="px-4 py-3.5">
                        {row.hasBrokerSubscription ? (
                          <StatusBadge
                            status={row.subscription?.status || "ACTIVE"}
                          />
                        ) : (
                          <span className="inline-flex rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30">
                            Registered
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700 dark:text-slate-200">
                        {row.subscription?.package ? (
                          <div>
                            <p className="font-medium">
                              {row.subscription.package.name}
                            </p>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                              {getPackageCodeLabel(
                                row.subscription.package.code,
                              )}
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                        {addOnCount > 0 ? (
                          <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {addOnCount} add-on{addOnCount === 1 ? "" : "s"}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {row.organization?.id ? (
                          <button
                            type="button"
                            onClick={() =>
                              openSubscriberDetail(
                                navigate,
                                row.organization!.id,
                              )
                            }
                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#13538A]/25 bg-[#13538A]/[0.04] px-3 text-xs font-semibold text-[#13538A] transition hover:bg-[#13538A] hover:text-white dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-600 dark:hover:text-white"
                          >
                            View
                            <FiExternalLink size={12} />
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
