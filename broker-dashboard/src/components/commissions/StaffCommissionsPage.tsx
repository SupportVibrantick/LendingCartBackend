import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import CommissionSummaryChart from "./CommissionSummaryChart";
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
  pageTitle: string;
  pageDescription: string;
  invoicesHref: string;
  dashboardHref: string;
};

export default function StaffCommissionsPage({
  apiBase,
  summaryPath,
  listPath,
  getHeaders,
  portal,
  pageTitle,
  pageDescription,
  invoicesHref,
  dashboardHref,
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
    load();
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
    } catch (error: any) {
      toast.error(error.message || "Failed to download invoice");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            {pageTitle}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{pageDescription}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={invoicesHref}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            View Invoices
          </Link>
          <Link
            to={dashboardHref}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            Dashboard
          </Link>
        </div>
      </div>

      <CommissionSummaryChart
        summary={summary}
        loading={loading}
        title="Commission Earnings"
      />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4 dark:border-gray-800">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">
              All Commissions
            </h2>
            <p className="text-sm text-slate-500">
              Earned on funded deals assigned to you
            </p>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#13538A]/40 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending payout</option>
            <option value="PAID">Paid</option>
          </select>
        </div>

        {loading ? (
          <div className="px-6 py-10 text-sm text-slate-500">Loading...</div>
        ) : filteredRows.length === 0 ? (
          <div className="px-6 py-10 text-sm text-slate-500">
            {rows.length === 0
              ? "Commissions appear here after your assigned deals are marked funded."
              : "No commissions match the selected filter."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500 dark:bg-gray-950">
                <tr>
                  <th className="px-6 py-3 font-medium">Deal</th>
                  <th className="px-6 py-3 font-medium">Role</th>
                  <th className="px-6 py-3 font-medium">Amount</th>
                  <th className="px-6 py-3 font-medium">Funded</th>
                  <th className="px-6 py-3 font-medium">Invoice</th>
                  <th className="px-6 py-3 font-medium">Payout</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const payoutStatus = row.payoutStatus || row.status;
                  const isFullyPaid = payoutStatus === "PAID";
                  const canGenerateInvoice = !row.latestInvoice;

                  return (
                    <tr
                      key={row.id}
                      className="border-t border-slate-100 dark:border-gray-800"
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {row.applicationNumber || row.loanApplicationId}
                        </div>
                        <div className="text-xs text-slate-500">
                          {row.clientName || "—"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {formatCommissionRole(row.recipientRole)}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                        {formatCommissionCurrency(row.commissionAmount)}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {row.fundedAt
                          ? new Date(row.fundedAt).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {row.latestInvoice?.invoiceNumber || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            isFullyPaid
                              ? "bg-emerald-50 text-emerald-700"
                              : payoutStatus === "PARTIAL"
                                ? "bg-sky-50 text-sky-700"
                                : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {formatPayoutStatus(payoutStatus)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {canGenerateInvoice ? (
                            <button
                              type="button"
                              onClick={() => handleGenerateInvoice(row)}
                              disabled={invoiceLoadingId === row.id}
                              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200"
                            >
                              {invoiceLoadingId === row.id ? "..." : "Invoice"}
                            </button>
                          ) : null}
                          {row.latestInvoice?.id ? (
                            <button
                              type="button"
                              onClick={() => handleDownloadInvoice(row)}
                              disabled={downloadingId === row.latestInvoice.id}
                              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200"
                            >
                              {downloadingId === row.latestInvoice.id
                                ? "..."
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
