import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { FiRefreshCw, FiSearch } from "react-icons/fi";
import { useAdminPermissions } from "../../context/AdminPermissionsContext";
import SubscriptionNav from "../../components/subscriptions/SubscriptionNav";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import {
  fetchInvoices,
  formatPrice,
  markInvoicePaid,
  STATUS_COLORS,
  type InvoiceStatus,
  type SubscriptionInvoice,
} from "../../lib/subscriptionApi";
import { openSubscriberDetail } from "../../lib/subscriberNavigation";

export default function SubscriptionInvoices() {
  const navigate = useNavigate();
  const { can } = useAdminPermissions();
  const canManage = can("MANAGE_SUBSCRIPTION_INVOICES");

  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 350);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "">("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const json = await fetchInvoices({
        page,
        limit,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
      });
      if (!json.success) {
        toast.error(json.message || "Failed to load invoices");
        return;
      }
      setInvoices(json.data || []);
      setTotal(json.meta?.total || 0);
      if (json.meta?.page) setPage(json.meta.page);
    } catch {
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, limit]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const totalPages = Math.ceil(total / limit);

  const handleMarkPaid = async (id: string) => {
    const json = await markInvoicePaid(id);
    if (!json.success) {
      toast.error(json.message || "Failed to mark paid");
      return;
    }
    toast.success("Invoice marked as paid");
    fetchRows();
  };

  return (
    <div className="px-4 sm:px-6 py-6 bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 min-h-screen">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#18B6B4] mb-1">
          Billing
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#13538A] dark:text-indigo-400">
          Subscription Invoices
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          View and manage broker subscription invoices.
        </p>
      </div>

      <SubscriptionNav />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice #, broker, email, or plan..."
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
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | "")}
          className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        >
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
          <option value="DRAFT">Draft</option>
          <option value="FAILED">Failed</option>
          <option value="VOID">Void</option>
        </select>
        <button
          type="button"
          onClick={() => fetchRows()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border bg-white dark:bg-slate-900"
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
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Broker</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Cycle</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    {debouncedSearch ? "No invoices match your search" : "No invoices found"}
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/80 dark:hover:bg-slate-800/30"
                  >
                    <td className="px-4 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3">
                      {inv.organization ? (
                        <button
                          type="button"
                          onClick={() =>
                            openSubscriberDetail(navigate, inv.organization!.id)
                          }
                          className="font-medium text-[#13538A] hover:underline text-left"
                        >
                          {inv.organization.name}
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {inv.organizationSubscription?.package?.name || "—"}
                    </td>
                    <td className="px-4 py-3 font-semibold">{formatPrice(inv.amount)}</td>
                    <td className="px-4 py-3">{inv.billingCycle}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[inv.status]}`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {new Date(inv.dueDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canManage && inv.status === "PENDING" && (
                        <button
                          type="button"
                          onClick={() => handleMarkPaid(inv.id)}
                          className="text-xs font-semibold text-emerald-600 hover:underline"
                        >
                          Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex justify-between items-center text-sm">
          <span className="text-slate-500">
            Page {page} of {totalPages} ({total} invoices)
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
    </div>
  );
}
