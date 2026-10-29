import {
  Banknote,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  History,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, Fragment } from "react";
import { Link } from "react-router";
import toast from "react-hot-toast";
import CommissionHistoryModal from "../../components/commissions/CommissionHistoryModal";
import CommissionSummaryChart from "../../components/commissions/CommissionSummaryChart";
import RecordPayoutModal from "../../components/commissions/RecordPayoutModal";
import {
  formatCommissionCurrency,
  formatCommissionRole,
  formatPayoutStatus,
  getInvoicePdfUrl,
  type CommissionHistory,
  type CommissionRecord,
  type CommissionSummary,
} from "../../lib/commissionApi";
import {
  getRemainingPayoutAmount,
  submitCommissionAchPayout,
  submitCommissionPayout,
  type PayoutFormValues,
} from "../../lib/commissionPayout";

type CommissionStats = {
  totalCount: number;
  pendingCount: number;
  paidCount: number;
  pendingAmount: number;
  paidAmount: number;
  totalAmount: number;
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

const AVATAR_TONES = [
  "bg-orange-100 text-orange-700",
  "bg-amber-100 text-amber-700",
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
];

type StatusFilter = "ALL" | "PENDING" | "PAID";

function getAuthHeaders(): HeadersInit {
  const token = sessionStorage.getItem("broker_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function getInitials(name?: string | null) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

function getAvatarTone(seed: string) {
  const index = seed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_TONES[index % AVATAR_TONES.length];
}

function roleBadgeClass(role?: string) {
  if (role === "LOAN_OFFICER") return "bg-violet-50 text-violet-700 ring-violet-100";
  if (role === "CO_BROKER") return "bg-amber-50 text-amber-700 ring-amber-100";
  if (role === "BROKER") return "bg-slate-100 text-slate-700 ring-slate-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function payoutBadgeClass(status?: string) {
  if (status === "PAID") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (status === "PARTIAL" || status === "PROCESSING") {
    return "bg-sky-50 text-sky-700 ring-sky-100";
  }
  return "bg-amber-50 text-amber-700 ring-amber-100";
}

function SummaryCard({
  title,
  amount,
  count,
  active,
  onClick,
  tone = "default",
}: {
  title: string;
  amount: number;
  count: number;
  active?: boolean;
  onClick?: () => void;
  tone?: "default" | "success" | "warning";
}) {
  const amountClass =
    tone === "success"
      ? "text-emerald-600"
      : tone === "warning"
        ? "text-amber-600"
        : "text-slate-900";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition-all ${
        active
          ? "border-[#13538A] bg-[#13538A]/5 shadow-sm"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      <p className="text-sm text-slate-500">{title}</p>
      <p className={`mt-2 text-2xl font-semibold ${amountClass}`}>
        {formatCommissionCurrency(amount)}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {count} record{count === 1 ? "" : "s"}
      </p>
    </button>
  );
}

export default function CommissionsPage() {
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [invoiceLoadingId, setInvoiceLoadingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [rows, setRows] = useState<CommissionRecord[]>([]);
  const [summary, setSummary] = useState<CommissionSummary | null>(null);
  const [stats, setStats] = useState<CommissionStats | null>(null);
  const [payoutRow, setPayoutRow] = useState<CommissionRecord | null>(null);
  const [historyRow, setHistoryRow] = useState<CommissionRecord | null>(null);
  const [historyData, setHistoryData] = useState<CommissionHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const isBrokerAdmin = useMemo(() => {
    try {
      const roles = JSON.parse(sessionStorage.getItem("roles") || "[]");
      return roles.includes("BROKER_ADMIN");
    } catch {
      return false;
    }
  }, []);

  const loadCommissions = useCallback(async () => {
    if (!isBrokerAdmin) return;

    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (search) params.set("search", search);

      const res = await fetch(`${API_BASE}/broker/commissions?${params}`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load commissions");
      }

      setRows(json.data || []);
      setSummary(json.summary || null);
      setStats(json.stats || null);
      setTotalPages(json.pagination?.totalPages || 1);
      setTotalRecords(json.pagination?.total || 0);
    } catch (error: any) {
      toast.error(error.message || "Failed to load commissions");
    } finally {
      setLoading(false);
    }
  }, [isBrokerAdmin, limit, page, search, statusFilter]);

  useEffect(() => {
    loadCommissions();
  }, [loadCommissions]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const groupedDeals = useMemo(() => {
    const groups = new Map<string, CommissionRecord[]>();

    for (const row of rows) {
      const key = row.loanApplicationId;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    return Array.from(groups.entries()).map(([loanApplicationId, dealRows]) => {
      const pool =
        dealRows[0]?.commissionPool ??
        dealRows.reduce((sum, row) => sum + Number(row.commissionAmount || 0), 0);
      const pendingAmount = dealRows.reduce((sum, row) => {
        const status = row.payoutStatus || row.status;
        if (status === "PAID") return sum;
        return sum + getRemainingPayoutAmount(row);
      }, 0);

      return {
        loanApplicationId,
        applicationNumber: dealRows[0]?.applicationNumber || loanApplicationId,
        clientName: dealRows[0]?.clientName || "—",
        pool,
        pendingAmount,
        rows: dealRows,
      };
    });
  }, [rows]);

  const tableStats = useMemo<CommissionStats>(() => {
    if (stats) return stats;
    return {
      pendingCount: 0,
      paidCount: 0,
      pendingAmount: 0,
      paidAmount: 0,
      totalAmount: 0,
      totalCount: 0,
    };
  }, [stats]);

  const setStatusAndResetPage = (next: StatusFilter) => {
    setStatusFilter(next);
    setPage(1);
  };

  const handleRecordPayout = async (values: PayoutFormValues) => {
    if (!payoutRow) return;

    try {
      setMarkingId(payoutRow.id);
      if (values.sendToBank) {
        await submitCommissionAchPayout(payoutRow.id, values, getAuthHeaders);
        toast.success(
          "Bank transfer started from your firm account. It shows as paid when ACH settles.",
        );
      } else {
        await submitCommissionPayout(payoutRow.id, values, getAuthHeaders, "broker");
        toast.success("Payout recorded");
      }
      setPayoutRow(null);
      await loadCommissions();
    } catch (error: any) {
      toast.error(error.message || "Failed to record payout");
    } finally {
      setMarkingId(null);
    }
  };

  const handleGenerateInvoice = async (row: CommissionRecord) => {
    try {
      setInvoiceLoadingId(row.id);
      const res = await fetch(`${API_BASE}/broker/commissions/${row.id}/invoices`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to generate invoice");
      }
      toast.success("Invoice generated");
      await loadCommissions();
    } catch (error: any) {
      toast.error(error.message || "Failed to generate invoice");
    } finally {
      setInvoiceLoadingId(null);
    }
  };

  const handleDownloadInvoice = async (row: CommissionRecord) => {
    const invoiceId = row.latestInvoice?.id;
    if (!invoiceId) return;

    try {
      const token = sessionStorage.getItem("broker_token");
      const res = await fetch(getInvoicePdfUrl(invoiceId), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || "Failed to download invoice");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${row.latestInvoice?.invoiceNumber || "invoice"}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error(error.message || "Failed to download invoice");
    }
  };

  const openHistory = async (row: CommissionRecord) => {
    setHistoryRow(row);
    setHistoryData(null);
    setHistoryLoading(true);

    try {
      const res = await fetch(`${API_BASE}/broker/commissions/${row.id}/history`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load history");
      }
      setHistoryData(json.data as CommissionHistory);
    } catch (error: any) {
      toast.error(error.message || "Failed to load history");
      setHistoryRow(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  if (!isBrokerAdmin) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <Wallet size={24} />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-slate-900">Commissions</h2>
        <p className="mt-2 text-sm text-slate-500">
          Only broker admins can manage commission payouts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Commissions</h2>
          <p className="mt-1 text-sm text-slate-500">
            Track funded-deal commissions, then send a US ACH from your{" "}
            <Link
              to="/payments/banking"
              className="font-medium text-[#13538A] underline-offset-2 hover:underline"
            >
              firm bank account
            </Link>{" "}
            to the loan officer / co-broker bank on file, or record wire/check manually.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadCommissions()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total commissions"
          amount={tableStats.totalAmount}
          count={tableStats.totalCount}
          active={statusFilter === "ALL"}
          onClick={() => setStatusAndResetPage("ALL")}
        />
        <SummaryCard
          title="Pending payout"
          amount={tableStats.pendingAmount}
          count={tableStats.pendingCount}
          active={statusFilter === "PENDING"}
          onClick={() => setStatusAndResetPage("PENDING")}
          tone="warning"
        />
        <SummaryCard
          title="Paid out"
          amount={tableStats.paidAmount}
          count={tableStats.paidCount}
          active={statusFilter === "PAID"}
          onClick={() => setStatusAndResetPage("PAID")}
          tone="success"
        />
        <SummaryCard
          title="Chart total"
          amount={summary?.totals.all || 0}
          count={summary?.counts?.total || tableStats.totalCount}
        />
      </div>

      <CommissionSummaryChart summary={summary} loading={loading} />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">Commission Records</h3>
            <p className="text-sm text-slate-500">
              Broker, loan officer, and co-broker commission lines
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
            <div className="relative min-w-[240px] flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search deal, recipient, invoice..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-[#13538A]/40 focus:ring-2 focus:ring-[#13538A]/10"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusAndResetPage(e.target.value as StatusFilter)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#13538A]/40"
            >
              <option value="ALL">All statuses</option>
              <option value="PENDING">Pending payout</option>
              <option value="PAID">Paid</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 px-6 py-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-16 animate-pulse rounded-2xl bg-slate-100"
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Banknote size={24} />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-900">
              No commission records found
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {search
                ? "Try a different search term or clear filters."
                : "Mark a deal as funded to generate commissions."}
            </p>
          </div>
        ) : (
          <div className="max-h-[min(70vh,720px)] overflow-auto">
            <table className="min-w-full table-fixed text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-left text-[11px] font-medium uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_rgb(241,245,249)]">
                <tr>
                  <th className="w-[34%] px-6 py-2.5">Recipient</th>
                  <th className="w-[14%] px-4 py-2.5">Commission</th>
                  <th className="w-[18%] px-4 py-2.5">Invoice</th>
                  <th className="w-[16%] px-4 py-2.5">Payout</th>
                  <th className="w-[18%] px-6 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groupedDeals.map((group) => (
                  <Fragment key={group.loanApplicationId}>
                    <tr className="bg-slate-50/90">
                      <td colSpan={5} className="border-y border-slate-100 px-6 py-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-[#13538A] ring-1 ring-slate-200">
                              {group.applicationNumber}
                            </span>
                            <span className="truncate text-sm font-medium text-slate-800">
                              {group.clientName}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span>
                              Pool{" "}
                              <span className="font-medium text-slate-700">
                                {formatCommissionCurrency(group.pool)}
                              </span>
                            </span>
                            <span>{group.rows.length} recipients</span>
                            {group.pendingAmount > 0 ? (
                              <span className="font-medium text-amber-600">
                                {formatCommissionCurrency(group.pendingAmount)} pending
                              </span>
                            ) : (
                              <span className="font-medium text-emerald-600">Fully paid</span>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>

                    {group.rows.map((row) => {
                      const payoutStatus = row.payoutStatus || row.status;
                      const isFullyPaid = payoutStatus === "PAID";
                      const remaining = getRemainingPayoutAmount(row);
                      const isBroker = row.recipientRole === "BROKER";
                      const canPay = !isBroker && remaining > 0;
                      const canInvoice = !isBroker && !row.latestInvoice;
                      const recipientSeed =
                        row.recipientEmail || row.recipientName || row.id;

                      return (
                        <tr
                          key={row.id}
                          className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50/60"
                        >
                          <td className="px-6 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${getAvatarTone(recipientSeed)}`}
                              >
                                {getInitials(row.recipientName)}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="truncate font-medium text-slate-900">
                                    {row.recipientName || "—"}
                                  </span>
                                  <span
                                    className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${roleBadgeClass(row.recipientRole)}`}
                                  >
                                    {formatCommissionRole(row.recipientRole)}
                                  </span>
                                </div>
                                <div
                                  className="truncate text-xs text-slate-500"
                                  title={row.recipientEmail || undefined}
                                >
                                  {row.recipientEmail || "—"}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-2.5">
                            <div className="font-semibold text-slate-900">
                              {formatCommissionCurrency(row.commissionAmount)}
                            </div>
                            {row.findersFeePercent != null ? (
                              <div className="text-xs text-slate-500">
                                {row.findersFeePercent}% share
                              </div>
                            ) : null}
                          </td>

                          <td className="px-4 py-2.5">
                            {isBroker ? (
                              <span className="text-xs text-slate-400">Firm retained</span>
                            ) : row.latestInvoice?.invoiceNumber ? (
                              <span
                                className="inline-flex max-w-full items-center gap-1 truncate rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                                title={row.latestInvoice.invoiceNumber}
                              >
                                <FileText size={12} className="shrink-0" />
                                <span className="truncate">
                                  {row.latestInvoice.invoiceNumber}
                                </span>
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">Not generated</span>
                            )}
                          </td>

                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${payoutBadgeClass(payoutStatus)}`}
                              >
                                {formatPayoutStatus(payoutStatus)}
                              </span>
                              {!isFullyPaid && remaining > 0 ? (
                                <span className="text-xs text-slate-500">
                                  {formatCommissionCurrency(remaining)} left
                                </span>
                              ) : null}
                            </div>
                          </td>

                          <td className="px-6 py-2.5 text-right">
                            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
                              <button
                                type="button"
                                title="View history"
                                onClick={() => openHistory(row)}
                                className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                              >
                                <History size={15} />
                              </button>

                              {canInvoice ? (
                                <button
                                  type="button"
                                  title="Generate invoice"
                                  onClick={() => handleGenerateInvoice(row)}
                                  disabled={invoiceLoadingId === row.id}
                                  className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                                >
                                  <FileText size={15} />
                                </button>
                              ) : null}

                              {row.latestInvoice?.id ? (
                                <button
                                  type="button"
                                  title="Download PDF"
                                  onClick={() => handleDownloadInvoice(row)}
                                  className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                                >
                                  <Download size={15} />
                                </button>
                              ) : null}

                              {canPay ? (
                                <button
                                  type="button"
                                  title="Pay commission"
                                  onClick={() => setPayoutRow(row)}
                                  disabled={markingId === row.id}
                                  className="rounded-md bg-emerald-600 p-1.5 text-white transition hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  <Banknote size={15} />
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-4 md:px-6">
          <p className="text-sm text-slate-500">
            Page {page} of {totalPages}
            {totalRecords > 0 ? (
              <span className="ml-1 text-slate-400">
                · {totalRecords} record{totalRecords === 1 ? "" : "s"}
              </span>
            ) : null}
          </p>
          <div className="flex items-center gap-2">
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
            </select>
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((current) => current + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <RecordPayoutModal
        row={payoutRow}
        isOpen={Boolean(payoutRow)}
        submitting={Boolean(payoutRow && markingId === payoutRow.id)}
        onClose={() => {
          if (!markingId) setPayoutRow(null);
        }}
        onSubmit={handleRecordPayout}
      />

      <CommissionHistoryModal
        row={historyRow}
        history={historyData}
        loading={historyLoading}
        isOpen={Boolean(historyRow)}
        onClose={() => {
          setHistoryRow(null);
          setHistoryData(null);
        }}
      />
    </div>
  );
}
