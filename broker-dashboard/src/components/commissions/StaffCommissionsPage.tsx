import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Download, FilePlus2, RefreshCw, Wallet } from "lucide-react";
import CommissionSummaryChart from "./CommissionSummaryChart";
import CommissionStatusChart from "./CommissionStatusChart";
import {
  formatCommissionCurrency,
  formatCommissionRole,
  formatPayoutStatus,
  getCommissionApiBase,
  getInvoicePdfUrl,
  type CommissionRecord,
  type CommissionSummary,
} from "../../lib/commissionApi";

type Portal = "loanofficer" | "subbroker";

type StatusFilter = "ALL" | "PENDING" | "PAID";

type Props = {
  apiBase: string;
  summaryPath: string;
  listPath: string;
  getHeaders: () => HeadersInit;
  portal: Portal;
};

function payoutBadgeClass(status?: string) {
  if (status === "PAID") return "bg-emerald-100 text-emerald-700 ring-emerald-200";
  if (status === "PARTIAL" || status === "PROCESSING") {
    return "bg-sky-100 text-sky-700 ring-sky-200";
  }
  return "bg-amber-100 text-amber-700 ring-amber-200";
}

export default function StaffCommissionsPage({
  apiBase,
  summaryPath,
  listPath,
  getHeaders,
  portal,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<CommissionSummary | null>(null);
  const [rows, setRows] = useState<CommissionRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [invoiceLoadingId, setInvoiceLoadingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const commissionsBase = getCommissionApiBase(portal);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [summaryRes, listRes] = await Promise.all([
        fetch(`${apiBase}${summaryPath}?months=6`, { headers: getHeaders() }),
        fetch(`${apiBase}${listPath}`, { headers: getHeaders() }),
      ]);

      const summaryJson = await summaryRes.json();
      const listJson = await listRes.json();

      if (summaryRes.ok && summaryJson.success) {
        setSummary(summaryJson.data);
      } else {
        setSummary(null);
      }

      if (listRes.ok && listJson.success) {
        setRows(listJson.data || []);
      } else {
        setRows([]);
      }
    } catch {
      setSummary(null);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [apiBase, getHeaders, listPath, summaryPath]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    if (statusFilter === "ALL") return rows;
    if (statusFilter === "PAID") {
      return rows.filter((row) => (row.payoutStatus || row.status) === "PAID");
    }
    return rows.filter((row) => {
      const status = row.payoutStatus || row.status;
      return status === "UNPAID" || status === "PARTIAL";
    });
  }, [rows, statusFilter]);

  const handleGenerateInvoice = async (row: CommissionRecord) => {
    try {
      setInvoiceLoadingId(row.id);
      const res = await fetch(`${commissionsBase}/${row.id}/invoices`, {
        method: "POST",
        headers: {
          ...getHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to generate invoice");
      }
      toast.success("Invoice generated");
      await load();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate invoice",
      );
    } finally {
      setInvoiceLoadingId(null);
    }
  };

  const handleDownloadInvoice = async (row: CommissionRecord) => {
    const invoiceId = row.latestInvoice?.id;
    if (!invoiceId) return;

    try {
      setDownloadingId(invoiceId);
      const res = await fetch(getInvoicePdfUrl(invoiceId, portal), {
        headers: getHeaders(),
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
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to download invoice",
      );
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[16px] font-semibold tracking-tight text-text-primary dark:text-white">
            Commissions
          </h2>
          <p className="mt-0.5 text-[13px] text-text-secondary">
            Earnings on funded deals assigned to you.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="ds-btn-secondary h-9 px-3 text-xs disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-4 xl:col-span-3">
          <div className="flex h-full flex-col rounded-2xl border border-border bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-[16px] font-semibold leading-tight text-text-primary dark:text-white">
                  Commission snapshot
                </h3>
                <p className="mt-1 text-[13px] text-text-secondary">This period</p>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Wallet className="h-4 w-4" />
              </span>
            </div>

            {loading ? (
              <div className="mt-5 flex flex-1 animate-pulse rounded-xl bg-surface dark:bg-slate-800" />
            ) : (
              <div className="mt-4 flex flex-1 flex-col">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                  Pending
                </p>
                <p className="mt-2 text-[28px] font-bold leading-none tracking-tight text-text-primary dark:text-white">
                  {formatCommissionCurrency(summary?.totals.pending || 0)}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border bg-emerald-50/70 p-3 dark:border-slate-700 dark:bg-emerald-950/30">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                      Paid
                    </p>
                    <p className="mt-1 text-sm font-bold text-emerald-800 dark:text-emerald-300">
                      {formatCommissionCurrency(summary?.totals.paid || 0)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-surface p-3 dark:border-slate-700 dark:bg-slate-800">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
                      Total
                    </p>
                    <p className="mt-1 text-sm font-bold text-text-primary dark:text-white">
                      {formatCommissionCurrency(summary?.totals.all || 0)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl border border-border py-2 dark:border-slate-700">
                    <p className="font-bold text-text-primary dark:text-white">
                      {summary?.counts?.pending ?? 0}
                    </p>
                    <p className="text-text-secondary">Open</p>
                  </div>
                  <div className="rounded-xl border border-border py-2 dark:border-slate-700">
                    <p className="font-bold text-text-primary dark:text-white">
                      {summary?.counts?.paid ?? 0}
                    </p>
                    <p className="text-text-secondary">Paid</p>
                  </div>
                  <div className="rounded-xl border border-border py-2 dark:border-slate-700">
                    <p className="font-bold text-text-primary dark:text-white">
                      {summary?.counts?.total ?? 0}
                    </p>
                    <p className="text-text-secondary">Deals</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="col-span-12 md:col-span-8 xl:col-span-5">
          <CommissionSummaryChart
            summary={summary}
            loading={loading}
            title="Commission over time"
          />
        </div>
        <div className="col-span-12 xl:col-span-4">
          <CommissionStatusChart summary={summary} loading={loading} />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-2.5 border-b border-border px-4 py-3.5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h3 className="text-sm font-semibold text-text-primary dark:text-white">
              All commissions
            </h3>
            <p className="text-[12px] text-text-secondary">
              Generate invoices and track payout status
            </p>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-text-primary outline-none transition focus:border-[#4C78F5]/50 focus:ring-2 focus:ring-[#4C78F5]/15 sm:w-[180px] dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending payout</option>
            <option value="PAID">Paid</option>
          </select>
        </div>

        {loading ? (
          <div className="px-5 py-12 text-center text-sm text-text-secondary">
            Loading commissions…
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#4C78F5]/10 text-[#4C78F5]">
              <Wallet className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-text-primary">
              {rows.length === 0
                ? "No commissions yet"
                : "No commissions match this filter"}
            </p>
            <p className="mt-1.5 text-xs text-text-secondary">
              {rows.length === 0
                ? "Commissions appear here after your assigned deals are marked funded."
                : "Try another payout status filter."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ds-table min-w-[880px] w-full">
              <thead>
                <tr>
                  {[
                    "Deal",
                    "Role",
                    "Amount",
                    "Funded",
                    "Invoice",
                    "Payout",
                    "Action",
                  ].map((label) => (
                    <th
                      key={label}
                      className={label === "Action" ? "!text-right" : undefined}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const payoutStatus = row.payoutStatus || row.status;
                  const canGenerateInvoice = !row.latestInvoice;

                  return (
                    <tr key={row.id}>
                      <td>
                        <p className="ds-table-title">
                          {row.applicationNumber || row.loanApplicationId}
                        </p>
                        <p className="ds-table-meta">{row.clientName || "—"}</p>
                      </td>
                      <td>
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {formatCommissionRole(row.recipientRole)}
                        </span>
                      </td>
                      <td>
                        <span className="ds-table-amount">
                          {formatCommissionCurrency(row.commissionAmount)}
                        </span>
                      </td>
                      <td className="ds-table-muted whitespace-nowrap">
                        {row.fundedAt
                          ? new Date(row.fundedAt).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="ds-table-muted">
                        {row.latestInvoice?.invoiceNumber || "—"}
                      </td>
                      <td>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${payoutBadgeClass(payoutStatus)}`}
                        >
                          {formatPayoutStatus(payoutStatus)}
                        </span>
                      </td>
                      <td className="!text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          {canGenerateInvoice ? (
                            <button
                              type="button"
                              onClick={() => void handleGenerateInvoice(row)}
                              disabled={invoiceLoadingId === row.id}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
                            >
                              <FilePlus2 className="h-3.5 w-3.5" />
                              {invoiceLoadingId === row.id ? "…" : "Invoice"}
                            </button>
                          ) : null}
                          {row.latestInvoice?.id ? (
                            <button
                              type="button"
                              onClick={() => void handleDownloadInvoice(row)}
                              disabled={downloadingId === row.latestInvoice.id}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#4C78F5] px-3 text-xs font-semibold text-white transition hover:bg-[#3B66E0] disabled:opacity-60"
                            >
                              <Download className="h-3.5 w-3.5" />
                              {downloadingId === row.latestInvoice.id
                                ? "…"
                                : "PDF"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
