import { Banknote, Download, FileText, History } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import CommissionHistoryModal from "./CommissionHistoryModal";
import RecordPayoutModal from "./RecordPayoutModal";
import {
  formatCommissionCurrency,
  formatCommissionRole,
  formatPayoutStatus,
  getCommissionApiBase,
  getInvoicePdfUrl,
  type CommissionHistory,
  type CommissionRecord,
  type LoanCommissionBreakdown,
} from "../../lib/commissionApi";
import {
  getRemainingPayoutAmount,
  submitCommissionAchPayout,
  submitCommissionPayout,
  type PayoutFormValues,
} from "../../lib/commissionPayout";

type Portal = "broker" | "loanofficer" | "subbroker";

type Props = {
  loanApplicationId?: string | null;
  getAuthHeaders: () => HeadersInit;
  portal?: Portal;
  canMarkPaid?: boolean;
};

function payoutBadgeClass(status?: string) {
  if (status === "PAID") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (status === "PARTIAL" || status === "PROCESSING") {
    return "bg-sky-50 text-sky-700 ring-sky-100";
  }
  return "bg-amber-50 text-amber-700 ring-amber-100";
}

function roleBadgeClass(role?: string) {
  if (role === "LOAN_OFFICER") return "bg-violet-50 text-violet-700 ring-violet-100";
  if (role === "CO_BROKER") return "bg-amber-50 text-amber-700 ring-amber-100";
  if (role === "BROKER") return "bg-slate-100 text-slate-700 ring-slate-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

export default function LoanCommissionPanel({
  loanApplicationId,
  getAuthHeaders,
  portal = "broker",
  canMarkPaid = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [invoiceLoadingId, setInvoiceLoadingId] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<LoanCommissionBreakdown | null>(
    null,
  );
  const [payoutRow, setPayoutRow] = useState<CommissionRecord | null>(null);
  const [historyRow, setHistoryRow] = useState<CommissionRecord | null>(null);
  const [historyData, setHistoryData] = useState<CommissionHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const commissionsBase = getCommissionApiBase(portal);
  const canUseAch = portal === "broker" && canMarkPaid;

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

  const handleRecordPayout = async (values: PayoutFormValues) => {
    if (!payoutRow) return;

    try {
      setMarkingId(payoutRow.id);
      if (values.sendToBank && canUseAch) {
        await submitCommissionAchPayout(payoutRow.id, values, getAuthHeaders);
        toast.success(
          "Bank transfer started from your firm account. It shows as paid when ACH settles.",
        );
      } else {
        await submitCommissionPayout(
          payoutRow.id,
          values,
          getAuthHeaders,
          portal,
        );
        toast.success("Payout recorded");
      }
      setPayoutRow(null);
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

  const handleDownloadInvoice = async (
    invoiceId: string,
    invoiceNumber?: string,
  ) => {
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

  const openHistory = async (row: CommissionRecord) => {
    setHistoryRow(row);
    setHistoryData(null);
    setHistoryLoading(true);

    try {
      const res = await fetch(`${commissionsBase}/${row.id}/history`, {
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
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
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
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${roleBadgeClass(row.recipientRole)}`}
                        >
                          {formatCommissionRole(row.recipientRole)}
                        </span>
                      </td>
                      <td className="px-6 py-4">{row.findersFeePercent}%</td>
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {formatCommissionCurrency(row.commissionAmount)}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {isBroker ? (
                          <span className="text-xs text-slate-400">
                            Firm retained
                          </span>
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
                          <span className="text-xs text-slate-400">
                            Not generated
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
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
                      <td className="px-6 py-4 text-right">
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
                              onClick={() => handleGenerateInvoice(row.id)}
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
                              onClick={() =>
                                handleDownloadInvoice(
                                  row.latestInvoice!.id,
                                  row.latestInvoice?.invoiceNumber || undefined,
                                )
                              }
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
              </tbody>
            </table>
          </div>
        )}
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
