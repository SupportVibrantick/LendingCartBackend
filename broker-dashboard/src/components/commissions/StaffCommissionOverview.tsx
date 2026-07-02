import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
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

type Props = {
  apiBase: string;
  summaryPath: string;
  listPath: string;
  getHeaders: () => HeadersInit;
  portal: Portal;
  title?: string;
  maxRows?: number;
  invoicesHref?: string;
  commissionsHref?: string;
};

export default function StaffCommissionOverview({
  apiBase,
  summaryPath,
  listPath,
  getHeaders,
  portal,
  title = "My Commissions",
  maxRows = 5,
  invoicesHref,
  commissionsHref,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<CommissionSummary | null>(null);
  const [rows, setRows] = useState<CommissionRecord[]>([]);
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
      }

      if (listRes.ok && listJson.success) {
        setRows((listJson.data || []).slice(0, maxRows));
      }
    } catch {
      setSummary(null);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [apiBase, getHeaders, listPath, maxRows, summaryPath]);

  useEffect(() => {
    load();
  }, [load]);

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
      const headers = getHeaders();
      const res = await fetch(getInvoicePdfUrl(invoiceId, portal), {
        headers,
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
    <div className="space-y-4">
      <CommissionSummaryChart summary={summary} loading={loading} title={title} />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="font-semibold text-slate-900">Recent Commissions</h3>
            <p className="mt-1 text-xs text-slate-500">
              Generate and download invoices for your earned commissions
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {commissionsHref ? (
              <Link
                to={commissionsHref}
                className="text-sm font-medium text-[#13538A] hover:underline"
              >
                View all commissions
              </Link>
            ) : null}
            {invoicesHref ? (
              <Link
                to={invoicesHref}
                className="text-sm font-medium text-[#13538A] hover:underline"
              >
                View all invoices
              </Link>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="px-5 py-8 text-sm text-slate-500">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-8 text-sm text-slate-500">
            Commissions appear here after your assigned deals are marked funded.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Deal</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Invoice</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const payoutStatus = row.payoutStatus || row.status;
                  const isPaid = payoutStatus === "PAID";
                  const canGenerateInvoice = !row.latestInvoice;

                  return (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900">
                          {row.applicationNumber || row.loanApplicationId}
                        </div>
                        <div className="text-xs text-slate-500">
                          {row.clientName || "—"}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {formatCommissionRole(row.recipientRole)}
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-900">
                        {formatCommissionCurrency(row.commissionAmount)}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {row.latestInvoice?.invoiceNumber || "—"}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            isPaid
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {formatPayoutStatus(payoutStatus)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          {canGenerateInvoice ? (
                            <button
                              type="button"
                              onClick={() => handleGenerateInvoice(row)}
                              disabled={invoiceLoadingId === row.id}
                              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            >
                              {invoiceLoadingId === row.id ? "..." : "Invoice"}
                            </button>
                          ) : null}
                          {row.latestInvoice?.id ? (
                            <button
                              type="button"
                              onClick={() => handleDownloadInvoice(row)}
                              disabled={downloadingId === row.latestInvoice.id}
                              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
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
