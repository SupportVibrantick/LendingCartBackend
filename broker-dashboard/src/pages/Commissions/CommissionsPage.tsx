import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import CommissionSummaryChart from "../../components/commissions/CommissionSummaryChart";
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
  promptRecordCommissionPayout,
  submitCommissionPayout,
} from "../../lib/commissionPayout";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

function getAuthHeaders(): HeadersInit {
  const token = sessionStorage.getItem("broker_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export default function CommissionsPage() {
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [invoiceLoadingId, setInvoiceLoadingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "PAID">(
    "ALL",
  );
  const [rows, setRows] = useState<CommissionRecord[]>([]);
  const [summary, setSummary] = useState<CommissionSummary | null>(null);

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
        limit: "50",
        ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
      });

      const res = await fetch(`${API_BASE}/broker/commissions?${params}`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load commissions");
      }

      setRows(json.data || []);
      setSummary(json.summary || null);
    } catch (error: any) {
      toast.error(error.message || "Failed to load commissions");
    } finally {
      setLoading(false);
    }
  }, [isBrokerAdmin, statusFilter]);

  useEffect(() => {
    loadCommissions();
  }, [loadCommissions]);

  const handleMarkPaid = async (row: CommissionRecord) => {
    const formValues = await promptRecordCommissionPayout(row);
    if (!formValues) return;

    try {
      setMarkingId(row.id);
      await submitCommissionPayout(row.id, formValues, getAuthHeaders, "broker");
      toast.success("Payout recorded");
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

  const handleViewHistory = async (row: CommissionRecord) => {
    try {
      const res = await fetch(`${API_BASE}/broker/commissions/${row.id}/history`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load history");
      }

      const history = json.data as CommissionHistory;
      const auditHtml = history.auditLog
        .map(
          (event) =>
            `<li><strong>${new Date(event.createdAt).toLocaleString()}</strong> — ${event.eventType.replace(/_/g, " ")}${event.actorName ? ` (${event.actorName})` : ""}</li>`,
        )
        .join("");

      const payoutHtml = history.paymentHistory.length
        ? history.paymentHistory
            .map(
              (payout) =>
                `<li>${new Date(payout.paidAt || "").toLocaleDateString()} — ${formatCommissionCurrency(payout.amount)} via ${payout.paymentMethod}${payout.paymentReference ? ` (${payout.paymentReference})` : ""}</li>`,
            )
            .join("")
        : "<li>No payouts recorded yet</li>";

      await Swal.fire({
        title: "Commission History",
        html: `
          <div style="text-align:left;font-size:14px">
            <p><strong>Audit Log</strong></p>
            <ul style="margin:0 0 16px 18px;padding:0">${auditHtml || "<li>No events</li>"}</ul>
            <p><strong>Payment History</strong></p>
            <ul style="margin:0 0 0 18px;padding:0">${payoutHtml}</ul>
          </div>
        `,
        width: 640,
        confirmButtonColor: "#13538A",
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to load history");
    }
  };

  if (!isBrokerAdmin) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Commissions</h1>
        <p className="mt-2 text-sm text-slate-500">
          Only broker admins can manage commission payouts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Commissions</h1>
        <p className="mt-1 text-sm text-slate-500">
          Calculate commissions on funded deals, generate invoices, and record payouts.
        </p>
      </div>

      <CommissionSummaryChart summary={summary} loading={loading} />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">Commission Records</h2>
            <p className="text-sm text-slate-500">
              Broker, loan officer, and co-broker commission lines
            </p>
          </div>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "ALL" | "PENDING" | "PAID")
            }
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#13538A]/40"
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending payout</option>
            <option value="PAID">Paid</option>
          </select>
        </div>

        {loading ? (
          <div className="px-6 py-10 text-sm text-slate-500">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-10 text-sm text-slate-500">
            No commission records yet. Mark a deal as funded to generate
            commissions.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Deal</th>
                  <th className="px-6 py-3 font-medium">Recipient</th>
                  <th className="px-6 py-3 font-medium">Role</th>
                  <th className="px-6 py-3 font-medium">Amount</th>
                  <th className="px-6 py-3 font-medium">Invoice</th>
                  <th className="px-6 py-3 font-medium">Payout</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const payoutStatus = row.payoutStatus || row.status;
                  const isFullyPaid = payoutStatus === "PAID";
                  const remaining = getRemainingPayoutAmount(row);
                  const canPay =
                    row.recipientRole !== "BROKER" && remaining > 0;
                  const canInvoice =
                    row.recipientRole !== "BROKER" && !row.latestInvoice;

                  return (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">
                          {row.applicationNumber || row.loanApplicationId}
                        </div>
                        <div className="text-xs text-slate-500">
                          {row.clientName || "—"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">
                          {row.recipientName || "—"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {row.recipientEmail}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {formatCommissionRole(row.recipientRole)}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {formatCommissionCurrency(row.commissionAmount)}
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
                          {canInvoice ? (
                            <button
                              type="button"
                              onClick={() => handleGenerateInvoice(row)}
                              disabled={invoiceLoadingId === row.id}
                              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            >
                              {invoiceLoadingId === row.id
                                ? "..."
                                : "Invoice"}
                            </button>
                          ) : null}
                          {row.latestInvoice?.id ? (
                            <button
                              type="button"
                              onClick={() => handleDownloadInvoice(row)}
                              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              PDF
                            </button>
                          ) : null}
                          {canPay ? (
                            <button
                              type="button"
                              onClick={() => handleMarkPaid(row)}
                              disabled={markingId === row.id}
                              className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                              {markingId === row.id ? "..." : "Pay"}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => handleViewHistory(row)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            History
                          </button>
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
