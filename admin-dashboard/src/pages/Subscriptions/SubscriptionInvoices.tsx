import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiDollarSign,
  FiFileText,
  FiRefreshCw,
  FiSearch,
} from "react-icons/fi";
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
    const pendingAmount = pending.reduce(
      (sum, i) => sum + Number(i.amount || 0),
      0,
    );
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

  const statCards = [
    {
      label: "Pending",
      value: pageStats.pending,
      hint:
        pageStats.overdue > 0
          ? `${pageStats.overdue} overdue`
          : null,
      icon: <FiAlertCircle size={18} />,
      tone: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
      hintTone: "text-rose-600 dark:text-rose-400",
    },
    {
      label: "Pending amount",
      value: formatPrice(pageStats.pendingAmount),
      hint: null,
      icon: <FiDollarSign size={18} />,
      tone: "bg-[#13538A]/10 text-[#13538A] dark:bg-indigo-500/15 dark:text-indigo-300",
      hintTone: "",
    },
    {
      label: "Paid",
      value: pageStats.paid,
      hint: null,
      icon: <FiCheckCircle size={18} />,
      tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
      hintTone: "",
    },
  ];

  return (
    <SubscriptionPageShell>
      <SubscriptionPageHeader
        title="Subscription Invoices"
        description="View and manage broker subscription invoices."
        actions={
          <button
            type="button"
            onClick={() => void fetchRows()}
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
                  {stat.hint ? (
                    <span
                      className={`ml-1 text-xs font-semibold ${stat.hintTone}`}
                    >
                      · {stat.hint}
                    </span>
                  ) : null}
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
            placeholder="Search invoice #, broker, email, or plan..."
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
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as InvoiceStatus | "")
          }
          className={filterControlClass}
        >
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
          <option value="DRAFT">Draft</option>
          <option value="FAILED">Failed</option>
          <option value="VOID">Void</option>
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
                <th className="px-4 py-3">Invoice</th>
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
                  <td
                    colSpan={8}
                    className="px-4 py-14 text-center text-slate-500"
                  >
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                        <FiFileText size={22} />
                      </span>
                      <p className="font-medium text-slate-700 dark:text-slate-200">
                        {debouncedSearch
                          ? "No invoices match your search"
                          : "No invoices found"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {debouncedSearch
                          ? "Try a different invoice number, broker, or plan."
                          : "Invoices appear here when plans are assigned or billed."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const overdue = isOverdue(inv);
                  const brokerName = inv.organization?.name || "";
                  const initial = (brokerName || "?").charAt(0).toUpperCase();

                  return (
                    <tr
                      key={inv.id}
                      className={`border-t border-slate-100 transition hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/40 ${
                        overdue ? "bg-rose-50/50 dark:bg-rose-500/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3.5">
                        <p className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {inv.invoiceNumber}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        {inv.organization ? (
                          <button
                            type="button"
                            onClick={() =>
                              openSubscriberDetail(
                                navigate,
                                inv.organization!.id,
                              )
                            }
                            className="flex items-center gap-3 text-left transition hover:opacity-90"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#13538A]/10 text-xs font-bold text-[#13538A] dark:bg-indigo-500/15 dark:text-indigo-300">
                              {initial}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-[#13538A] dark:text-indigo-300">
                                {inv.organization.name}
                              </span>
                            </span>
                          </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700 dark:text-slate-200">
                        {inv.organizationSubscription?.package?.name || (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-white">
                        {formatPrice(inv.amount)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                        {inv.billingCycle === "YEARLY" ? "Yearly" : "Monthly"}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={inv.status} />
                        {overdue ? (
                          <p className="mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                            Overdue
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-600 dark:text-slate-300">
                        <div>{new Date(inv.dueDate).toLocaleDateString()}</div>
                        {inv.paidAt ? (
                          <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            Paid {new Date(inv.paidAt).toLocaleDateString()}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {canManage && inv.status === "PENDING" ? (
                          <button
                            type="button"
                            disabled={markingId === inv.id}
                            onClick={() =>
                              handleMarkPaid(inv.id, inv.invoiceNumber)
                            }
                            className="inline-flex h-9 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-600 hover:text-white disabled:opacity-50 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-600 dark:hover:text-white"
                          >
                            {markingId === inv.id ? "Saving..." : "Mark Paid"}
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
        noun="invoices"
        onPageChange={setPage}
      />
    </SubscriptionPageShell>
  );
}
