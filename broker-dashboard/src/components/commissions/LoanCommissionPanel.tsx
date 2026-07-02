import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  formatCommissionCurrency,
  formatCommissionRole,
  formatPayoutStatus,
  getCommissionApiBase,
  getInvoicePdfUrl,
  type LoanCommissionBreakdown,
} from "../../lib/commissionApi";
import {
  getRemainingPayoutAmount,
  promptRecordCommissionPayout,
  submitCommissionPayout,
} from "../../lib/commissionPayout";

type Portal = "broker" | "loanofficer" | "subbroker";

type Props = {
  loanApplicationId?: string | null;
  getAuthHeaders: () => HeadersInit;
  portal?: Portal;
  canMarkPaid?: boolean;
};

export default function LoanCommissionPanel({
  loanApplicationId,
  getAuthHeaders,
  portal = "broker",
  canMarkPaid = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [invoiceLoadingId, setInvoiceLoadingId] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<LoanCommissionBreakdown | null>(null);

  const commissionsBase = getCommissionApiBase(portal);

  const loadBreakdown = useCallback(async () => {
    if (!loanApplicationId) return;

    try {
      setLoading(true);
      const res = await fetch(`${commissionsBase}/loan/${loanApplicationId}`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load commissions");
      }

      setBreakdown(json.data);
    } catch (error: any) {
      toast.error(error.message || "Failed to load commissions");
      setBreakdown(null);
    } finally {
      setLoading(false);
    }
  }, [commissionsBase, getAuthHeaders, loanApplicationId]);

  useEffect(() => {
    loadBreakdown();
  }, [loadBreakdown]);

  const handleMarkPaid = async (
    commissionId: string,
    row: LoanCommissionBreakdown["commissions"][number],
  ) => {
    const formValues = await promptRecordCommissionPayout(row);
    if (!formValues) return;

    try {
      setMarkingId(commissionId);
      await submitCommissionPayout(commissionId, formValues, getAuthHeaders, portal);
      toast.success("Payout recorded");
      await loadBreakdown();
    } catch (error: any) {
      toast.error(error.message || "Failed to record payout");
    } finally {
      setMarkingId(null);
    }
  };

  const handleGenerateInvoice = async (commissionId: string) => {
    try {
      setInvoiceLoadingId(commissionId);
      const res = await fetch(`${commissionsBase}/${commissionId}/invoices`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to generate invoice");
      }
      toast.success("Invoice generated");
      await loadBreakdown();
    } catch (error: any) {
      toast.error(error.message || "Failed to generate invoice");
    } finally {
      setInvoiceLoadingId(null);
    }
  };

  const handleDownloadInvoice = async (invoiceId: string, invoiceNumber?: string) => {
    try {
      const res = await fetch(getInvoicePdfUrl(invoiceId, portal), {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || "Failed to download invoice");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${invoiceNumber || "invoice"}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error(error.message || "Failed to download invoice");
    }
  };

  const staffView = breakdown?.staffView || portal !== "broker";

  const summaryCards = useMemo(() => {
    if (!breakdown) return [];

    if (staffView) {
      return [
        {
          label: "Your Commission",
          value: formatCommissionCurrency(
            breakdown.yourCommission ?? breakdown.commissions[0]?.commissionAmount,
          ),
          hint: "Earned on this funded deal",
        },
        {
          label: "Closing Commission Pool",
          value: formatCommissionCurrency(breakdown.commissionPool),
          hint: "Loan amount × broker points",
        },
        {
          label: "Loan Amount",
          value: formatCommissionCurrency(breakdown.loanAmount),
          hint: "Funded deal amount",
        },
      ];
    }

    return [
      {
        label: "Closing Commission Pool",
        value: formatCommissionCurrency(breakdown.commissionPool),
        hint: "Loan amount × broker points",
      },
      {
        label: "Broker Retains",
        value: formatCommissionCurrency(breakdown.brokerRetained),
        hint: "After LO / Co-Broker splits",
      },
      {
        label: "Upfront Fee",
        value: formatCommissionCurrency(breakdown.upfrontFee),
        hint: "Broker-only (not in staff split)",
      },
    ];
  }, [breakdown, staffView]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-6 w-48 animate-pulse rounded bg-slate-100" />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-xl bg-slate-50" />
          ))}
        </div>
      </div>
    );
  }

  if (!breakdown) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Commissions</h3>
        <p className="mt-2 text-sm text-slate-500">
          Commission breakdown is not available for this deal yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900">
            Commission Breakdown
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {staffView
              ? "Your commission line for this funded deal. Generate invoices and track payout status here."
              : "Commission lines are calculated when the deal is marked funded. Invoices and payouts are tracked separately."}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-slate-100 bg-slate-50 p-4"
            >
              <p className="text-sm text-slate-500">{card.label}</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {card.value}
              </p>
              <p className="mt-1 text-xs text-slate-400">{card.hint}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
          <p>
            <span className="font-medium text-slate-800">Loan Amount:</span>{" "}
            {formatCommissionCurrency(breakdown.loanAmount)}
          </p>
          <p>
            <span className="font-medium text-slate-800">Broker Points:</span>{" "}
            {breakdown.brokerPoints ?? "—"}%
          </p>
          <p>
            <span className="font-medium text-slate-800">Funded At:</span>{" "}
            {breakdown.fundedAt
              ? new Date(breakdown.fundedAt).toLocaleString()
              : "—"}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h4 className="font-semibold text-slate-900">Commission Lines</h4>
        </div>

        {breakdown.commissions.length === 0 ? (
          <div className="px-6 py-8 text-sm text-slate-500">
            {breakdown.status === "FUNDED"
              ? "No commission line was created for you on this deal yet."
              : "Commissions appear after the broker marks this deal as funded."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  {!staffView ? (
                    <th className="px-6 py-3 font-medium">Recipient</th>
                  ) : null}
                  <th className="px-6 py-3 font-medium">Role</th>
                  <th className="px-6 py-3 font-medium">Share %</th>
                  <th className="px-6 py-3 font-medium">Amount</th>
                  <th className="px-6 py-3 font-medium">Invoice</th>
                  <th className="px-6 py-3 font-medium">Payout</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.commissions.map((row) => {
                  const payoutStatus = row.payoutStatus || row.status;
                  const isFullyPaid = payoutStatus === "PAID";
                  const isBroker = row.recipientRole === "BROKER";
                  const remaining = getRemainingPayoutAmount(row);
                  const canPay = canMarkPaid && !isBroker && remaining > 0;
                  const canInvoice = !isBroker && !row.latestInvoice;

                  return (
                    <tr key={row.id} className="border-t border-slate-100">
                      {!staffView ? (
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900">
                            {row.recipientName || "—"}
                          </div>
                          <div className="text-xs text-slate-500">
                            {row.recipientEmail}
                          </div>
                        </td>
                      ) : null}
                      <td className="px-6 py-4">
                        {formatCommissionRole(row.recipientRole)}
                      </td>
                      <td className="px-6 py-4">{row.findersFeePercent}%</td>
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
                              onClick={() => handleGenerateInvoice(row.id)}
                              disabled={invoiceLoadingId === row.id}
                              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            >
                              {invoiceLoadingId === row.id ? "..." : "Invoice"}
                            </button>
                          ) : null}
                          {row.latestInvoice?.id ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleDownloadInvoice(
                                  row.latestInvoice!.id,
                                  row.latestInvoice?.invoiceNumber || undefined,
                                )
                              }
                              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              PDF
                            </button>
                          ) : null}
                          {canPay ? (
                            <button
                              type="button"
                              onClick={() => handleMarkPaid(row.id, row)}
                              disabled={markingId === row.id}
                              className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                              {markingId === row.id ? "..." : "Pay"}
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
