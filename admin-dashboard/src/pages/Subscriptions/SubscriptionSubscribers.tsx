import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { FiPlus, FiRefreshCw, FiSearch } from "react-icons/fi";
import { useAdminPermissions } from "../../context/AdminPermissionsContext";
import SubscriptionNav from "../../components/subscriptions/SubscriptionNav";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import {
  assignSubscription,
  fetchBrokerOptions,
  fetchPackages,
  fetchSubscribers,
  type BrokerOption,
  formatPrice,
  STATUS_COLORS,
  type BillingCycle,
  type SubscriberRow,
  type SubscriptionPackage,
} from "../../lib/subscriptionApi";
import { openSubscriberDetail } from "../../lib/subscriberNavigation";

export default function SubscriptionSubscribers() {
  const navigate = useNavigate();
  const { can } = useAdminPermissions();
  const canManage = can("MANAGE_SUBSCRIBERS");

  const [rows, setRows] = useState<SubscriberRow[]>([]);
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [brokers, setBrokers] = useState<BrokerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 350);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterHasSub, setFilterHasSub] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 15;

  const [assignOpen, setAssignOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignForm, setAssignForm] = useState({
    organizationId: "",
    packageId: "",
    billingCycle: "MONTHLY" as BillingCycle,
    trialDays: "0",
    notes: "",
  });

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterStatus, filterHasSub]);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const json = await fetchSubscribers({
        page,
        limit,
        search: debouncedSearch || undefined,
        status: filterStatus || undefined,
        hasSubscription: filterHasSub ? (filterHasSub as "true" | "false") : undefined,
      });
      if (!json.success) {
        toast.error(json.message || "Failed to load subscribers");
        return;
      }
      setRows(json.data || []);
      setTotal(json.meta?.total || 0);
      if (json.meta?.page) setPage(json.meta.page);
    } catch {
      toast.error("Failed to load subscribers");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filterStatus, filterHasSub, limit]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    fetchPackages({ limit: 50, isActive: true }).then((json) => {
      if (json.success) setPackages(json.data || []);
    });
    fetchBrokerOptions(200).then((json) => {
      if (json.success) setBrokers(json.data || []);
    });
  }, []);

  const totalPages = Math.ceil(total / limit);

  const openAssign = (orgId?: string) => {
    setAssignForm({
      organizationId: orgId || "",
      packageId: packages[0]?.id || "",
      billingCycle: "MONTHLY",
      trialDays: "0",
      notes: "",
    });
    setAssignOpen(true);
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.organizationId || !assignForm.packageId) {
      toast.error("Organization and package are required");
      return;
    }
    try {
      setAssigning(true);
      const json = await assignSubscription({
        organizationId: assignForm.organizationId,
        packageId: assignForm.packageId,
        billingCycle: assignForm.billingCycle,
        trialDays: Number(assignForm.trialDays) || 0,
        notes: assignForm.notes || undefined,
      });
      if (!json.success) {
        toast.error(json.message || "Assign failed");
        return;
      }
      toast.success("Subscription assigned");
      setAssignOpen(false);
      fetchRows();
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 py-6 bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 min-h-screen">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#18B6B4] mb-1">
            Billing
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#13538A] dark:text-indigo-400">
            Subscribers
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage broker subscriptions, plans, and billing cycles.
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => openAssign()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#13538A] hover:bg-[#0f4470] text-white text-sm font-semibold"
            >
              <FiPlus size={16} />
              Assign Plan
            </button>
          </div>
        )}
      </div>

      <SubscriptionNav />

      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by broker name, email, phone, or plan..."
            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              Clear
            </button>
          )}
        </div>
        <select
          value={filterHasSub}
          onChange={(e) => setFilterHasSub(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        >
          <option value="">All brokers</option>
          <option value="true">With subscription</option>
          <option value="false">Without subscription</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="TRIAL">Trial</option>
          <option value="PAST_DUE">Past Due</option>
        </select>
        <button
          type="button"
          onClick={() => fetchRows()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        >
          <FiRefreshCw size={14} />
          Refresh
        </button>
      </div>

      {debouncedSearch && (
        <p className="text-xs text-slate-500 mb-4">
          Showing results for &ldquo;{debouncedSearch}&rdquo;
          {loading ? " — searching..." : ` — ${total} found`}
        </p>
      )}

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Broker</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Cycle</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Period End</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    {debouncedSearch ? "No subscribers match your search" : "No subscribers found"}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const sub = row.subscription;
                  const price = sub
                    ? sub.billingCycle === "YEARLY"
                      ? sub.package?.priceYearly
                      : sub.package?.priceMonthly
                    : null;

                  return (
                    <tr
                      key={row.organizationId}
                      className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/80 dark:hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold">{row.organizationName}</div>
                        <div className="text-xs text-slate-500">{row.organizationEmail || "—"}</div>
                      </td>
                      <td className="px-4 py-3">
                        {sub?.package ? (
                          <span className="font-medium">{sub.package.name}</span>
                        ) : (
                          <span className="text-slate-400">No plan</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{sub?.billingCycle || "—"}</td>
                      <td className="px-4 py-3">
                        {sub ? (
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[sub.status] || ""}`}
                          >
                            {sub.status}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {sub?.currentPeriodEnd
                          ? new Date(sub.currentPeriodEnd).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {price != null ? formatPrice(price) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {sub ? (
                            <button
                              type="button"
                              onClick={() => openSubscriberDetail(navigate, row.organizationId)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#13538A]/10 text-[#13538A] dark:text-indigo-300"
                            >
                              Details
                            </button>
                          ) : canManage ? (
                            <button
                              onClick={() => openAssign(row.organizationId)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-700"
                            >
                              Assign
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex justify-between items-center text-sm">
          <span className="text-slate-500">
            Page {page} of {totalPages} ({total} brokers)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-4 py-2 rounded-lg border disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 rounded-lg border disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {assignOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setAssignOpen(false)}
            className="absolute inset-0 bg-slate-900/50"
          />
          <form
            onSubmit={handleAssign}
            className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-6 shadow-2xl space-y-4"
          >
            <h2 className="text-lg font-bold">Assign Subscription</h2>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">
                Broker
              </label>
              <select
                value={assignForm.organizationId}
                onChange={(e) =>
                  setAssignForm((f) => ({ ...f, organizationId: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                required
              >
                <option value="">Select broker...</option>
                {brokers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.email ? `(${b.email})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Package</label>
              <select
                value={assignForm.packageId}
                onChange={(e) => setAssignForm((f) => ({ ...f, packageId: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                required
              >
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Billing</label>
                <select
                  value={assignForm.billingCycle}
                  onChange={(e) =>
                    setAssignForm((f) => ({
                      ...f,
                      billingCycle: e.target.value as BillingCycle,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Trial days</label>
                <input
                  type="number"
                  min="0"
                  value={assignForm.trialDays}
                  onChange={(e) => setAssignForm((f) => ({ ...f, trialDays: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            </div>
            <textarea
              rows={2}
              value={assignForm.notes}
              onChange={(e) => setAssignForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Notes (optional)"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 resize-none"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setAssignOpen(false)}
                className="flex-1 py-2.5 rounded-xl border"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={assigning}
                className="flex-1 py-2.5 rounded-xl bg-[#13538A] text-white font-semibold disabled:opacity-60"
              >
                {assigning ? "Assigning..." : "Assign"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
