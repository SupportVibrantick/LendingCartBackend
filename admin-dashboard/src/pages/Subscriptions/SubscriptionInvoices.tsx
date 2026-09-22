import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import { FiAlertCircle, FiCheckCircle, FiDollarSign, FiRefreshCw, FiSearch } from "react-icons/fi";
import { useAdminPermissions } from "../../context/AdminPermissionsContext";
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
  fetchInvoices,
  formatPrice,
  markInvoicePaid,
  type InvoiceStatus,
  type SubscriptionInvoice,
} from "../../lib/subscriptionApi";
import { openSubscriberDetail } from "../../lib/subscriberNavigation";

function isOverdue(inv: SubscriptionInvoice) {
  if (inv.status !== "PENDING") return false;
  return new Date(inv.dueDate).getTime() < Date.now();
}

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
  const [markingId, setMarkingId] = useState<string | null>(null);
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

  const pageStats = useMemo(() => {
    const pending = invoices.filter((i) => i.status === "PENDING");
    const paid = invoices.filter((i) => i.status === "PAID");
    const overdue = pending.filter(isOverdue);
    const pendingAmount = pending.reduce((sum, i) => sum + Number(i.amount || 0), 0);
    return {
      pending: pending.length,
      paid: paid.length,
      overdue: overdue.length,
      pendingAmount,
    };
  }, [invoices]);

  const handleMarkPaid = async (id: string, invoiceNumber: string) => {
    const result = await Swal.fire({
      title: "Mark invoice as paid?",
      text: `${invoiceNumber} will be marked PAID.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#059669",
      confirmButtonText: "Mark Paid",
    });
    if (!result.isConfirmed) return;

    try {
      setMarkingId(id);
      const json = await markInvoicePaid(id);
      if (!json.success) {
        toast.error(json.message || "Failed to mark paid");
        return;
      }
      toast.success("Invoice marked as paid");
      fetchRows();
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <SubscriptionPageShell>
      <SubscriptionPageHeader
        title="Subscription Invoices"
        description="View and manage broker subscription invoices."
      />

      <SubscriptionNav />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <FiAlertCircle size={16} />
            </span>
            <div>
              <p className="text-xs text-slate-500">Pending (page)</p>
              <p className="text-lg font-bold">
                {pageStats.pending}
                {pageStats.overdue > 0 ? (
                  <span className="ml-1 text-xs font-semibold text-rose-600">
                    · {pageStats.overdue} overdue
                  </span>
                ) : null}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#13538A]/10 text-[#13538A]">
              <FiDollarSign size={16} />
            </span>
            <div>
              <p className="text-xs text-slate-500">Pending amount</p>
              <p className="text-lg font-bold">{formatPrice(pageStats.pendingAmount)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <FiCheckCircle size={16} />
            </span>
            <div>
              <p className="text-xs text-slate-500">Paid (page)</p>
              <p className="text-lg font-bold">{pageStats.paid}</p>
            </div>
          </div>
        </div>
      </div>

      <FilterBar>
        <div className="relative flex-1">
          <FiSearch className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice #, broker, email, or plan..."
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
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | "")}
          className={filterControlClass}
        >
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
          <option value="DRAFT">Draft</option>
          <option value="FAILED">Failed</option>
          <option value="VOID">Void</option>
        </select>
        <button type="button" onClick={() => fetchRows()} className={secondaryBtnClass}>
          <FiRefreshCw size={14} />
          Refresh
        </button>
      </FilterBar>

      {debouncedSearch && (
        <p className="mb-4 text-xs text-slate-500">
          Showing results for &ldquo;{debouncedSearch}&rdquo;
          {loading ? " — searching..." : ` — ${total} found`}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
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
                <TableSkeleton columns={8} />
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    {debouncedSearch ? "No invoices match your search" : "No invoices found"}
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const overdue = isOverdue(inv);
                  return (
                    <tr
                      key={inv.id}
                      className={`border-t border-slate-100 transition hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/30 ${
                        overdue ? "bg-rose-50/40 dark:bg-rose-500/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3">
                        {inv.organization ? (
                          <button
                            type="button"
                            onClick={() =>
                              openSubscriberDetail(navigate, inv.organization!.id)
                            }
                            className="text-left font-medium text-[#13538A] hover:underline dark:text-indigo-400"
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
                      <td className="px-4 py-3">
                        {inv.billingCycle === "YEARLY" ? "Yearly" : "Monthly"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={inv.status} />
                        {overdue ? (
                          <p className="mt-1 text-[11px] font-semibold text-rose-600">
                            Overdue
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div>{new Date(inv.dueDate).toLocaleDateString()}</div>
                        {inv.paidAt ? (
                          <div className="text-[11px] text-emerald-600">
                            Paid {new Date(inv.paidAt).toLocaleDateString()}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canManage && inv.status === "PENDING" && (
                          <button
                            type="button"
                            disabled={markingId === inv.id}
                            onClick={() => handleMarkPaid(inv.id, inv.invoiceNumber)}
                            className="text-xs font-semibold text-emerald-600 hover:underline disabled:opacity-50"
                          >
                            {markingId === inv.id ? "Saving..." : "Mark Paid"}
                          </button>
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
        noun="invoices"
        onPageChange={setPage}
      />
    </SubscriptionPageShell>
  );
}
