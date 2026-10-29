import { useEffect, useState } from "react";
import {
  ArrowRightLeft,
  Banknote,
  Building2,
  Info,
  Landmark,
  Loader2,
  UserRound,
} from "lucide-react";
import { Modal } from "../ui/modal";
import {
  formatCommissionCurrency,
  formatCommissionRole,
  type CommissionRecord,
} from "../../lib/commissionApi";
import {
  getRemainingPayoutAmount,
  PAYMENT_METHODS,
  type PayoutFormValues,
} from "../../lib/commissionPayout";

type Props = {
  row: CommissionRecord | null;
  isOpen: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (values: PayoutFormValues) => Promise<void>;
};

const METHOD_HINTS: Record<string, string> = {
  ACH: "In-app US bank transfer from your firm account to their bank",
  WIRE: "Record a completed bank wire transfer",
  CHECK: "Record a mailed or hand-delivered check",
  CASH: "Record a cash payout",
  MANUAL: "Mark paid for any other outside payment",
};

export default function RecordPayoutModal({
  row,
  isOpen,
  submitting = false,
  onClose,
  onSubmit,
}: Props) {
  const remaining = row ? getRemainingPayoutAmount(row) : 0;

  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("ACH");
  const [paymentReference, setPaymentReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !row) return;
    setAmount(String(getRemainingPayoutAmount(row)));
    setPaymentMethod("ACH");
    setPaymentReference("");
    setNotes("");
    setError(null);
  }, [isOpen, row]);

  if (!row) return null;

  const canSendAch =
    paymentMethod === "ACH" && Boolean(row.bankPayout?.available);
  const parsedAmount = Number(amount);
  const amountPreview =
    Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : remaining;

  const handleSubmit = async (
    event: { preventDefault(): void },
    sendToBank = false,
  ) => {
    event.preventDefault();
    const nextAmount = Number(amount);

    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      setError("Enter a valid payout amount");
      return;
    }
    if (nextAmount > remaining + 0.009) {
      setError(
        `Amount cannot exceed remaining balance (${formatCommissionCurrency(remaining)})`,
      );
      return;
    }

    setError(null);
    await onSubmit({
      amount: Math.round(nextAmount * 100) / 100,
      paymentMethod: sendToBank ? "ACH" : paymentMethod,
      paymentReference: paymentReference.trim(),
      notes: notes.trim(),
      sendToBank,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-3xl p-0 shadow-2xl"
      showCloseButton={!submitting}
    >
      <form
        onSubmit={(event) => handleSubmit(event, canSendAch)}
        className="overflow-hidden rounded-3xl"
      >
        <div className="relative overflow-hidden border-b border-slate-100 bg-[#0f3f6b] px-5 py-4 text-white">
          <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-12 right-20 h-24 w-24 rounded-full bg-emerald-400/20" />

          <div className="relative flex flex-wrap items-center justify-between gap-3 pr-8">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                <Banknote size={18} />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight">
                  {canSendAch ? "Send payout" : "Record payout"}
                </h2>
                <p className="mt-0.5 truncate text-sm text-white/80">
                  {formatCommissionCurrency(amountPreview)} →{" "}
                  <span className="font-semibold text-white">
                    {row.recipientName || "recipient"}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="rounded-xl bg-white/10 px-3 py-1.5 ring-1 ring-white/15">
                <p className="text-[10px] uppercase tracking-wide text-white/65">
                  Total
                </p>
                <p className="text-sm font-semibold">
                  {formatCommissionCurrency(row.commissionAmount)}
                </p>
              </div>
              <div className="rounded-xl bg-emerald-400/15 px-3 py-1.5 ring-1 ring-emerald-300/30">
                <p className="text-[10px] uppercase tracking-wide text-emerald-100/90">
                  Remaining
                </p>
                <p className="text-sm font-semibold text-emerald-100">
                  {formatCommissionCurrency(remaining)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3.5 px-5 py-4">
          <div className="grid gap-3.5 lg:grid-cols-[1.05fr_1fr]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3.5 py-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#13538A] shadow-sm ring-1 ring-slate-200">
                  <UserRound size={16} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {row.recipientName || "Recipient"}
                    </p>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200">
                      {formatCommissionRole(row.recipientRole)}
                    </span>
                  </div>
                  <p className="truncate text-xs text-slate-500">
                    {row.recipientEmail || "No email on file"}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                    {row.applicationNumber ? (
                      <span className="inline-flex items-center gap-1">
                        <Building2 size={11} />
                        {row.applicationNumber}
                      </span>
                    ) : null}
                    {row.clientName ? <span>{row.clientName}</span> : null}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Payout amount
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">
                  $
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={remaining}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError(null);
                  }}
                  disabled={submitting}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-7 pr-24 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#13538A]/50 focus:ring-2 focus:ring-[#13538A]/15 disabled:opacity-60"
                />
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setAmount(String(remaining));
                    setError(null);
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-60"
                >
                  Full amount
                </button>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-end justify-between gap-2">
              <label className="text-xs font-medium text-slate-600">
                Payment method
              </label>
              <p className="text-[11px] text-slate-500">
                {METHOD_HINTS[paymentMethod]}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PAYMENT_METHODS.map((method) => {
                const selected = paymentMethod === method;
                return (
                  <button
                    key={method}
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      setPaymentMethod(method);
                      setError(null);
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
                      selected
                        ? "bg-[#13538A] text-white shadow-sm"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {method}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Payment reference
                <span className="ml-1 font-normal text-slate-400">(optional)</span>
              </label>
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                disabled={submitting}
                placeholder="Check #, wire ref, txn ID"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#13538A]/50 focus:ring-2 focus:ring-[#13538A]/15 disabled:opacity-60"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Notes
                <span className="ml-1 font-normal text-slate-400">(optional)</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={submitting}
                placeholder="Internal note"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#13538A]/50 focus:ring-2 focus:ring-[#13538A]/15 disabled:opacity-60"
              />
            </div>
          </div>

          {canSendAch ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-900">
              <span className="inline-flex items-center gap-1 font-semibold">
                <ArrowRightLeft size={12} />
                ACH
              </span>
              <span className="inline-flex items-center gap-1">
                <Landmark size={12} />
                Firm bank
              </span>
              <span>→</span>
              <span className="inline-flex items-center gap-1 font-medium">
                <Banknote size={12} />
                {row.bankPayout?.bankName || "Recipient bank"}
                {row.bankPayout?.accountLast4
                  ? ` ····${row.bankPayout.accountLast4}`
                  : ""}
              </span>
              <span className="text-emerald-700/80">· 1–3 business days</span>
            </div>
          ) : null}

          {paymentMethod === "ACH" && !row.bankPayout?.available ? (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <Info size={14} className="mt-0.5 shrink-0" />
              <p>
                No bank on file. Record a wire/check payout after paying outside
                the app, or ask them to add banking details.
              </p>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/90 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {canSendAch ? (
              <button
                type="button"
                onClick={(event) => handleSubmit(event, false)}
                disabled={submitting}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Record only
              </button>
            ) : null}
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  {canSendAch ? "Sending..." : "Recording..."}
                </>
              ) : canSendAch ? (
                <>
                  <Landmark size={15} />
                  Send to bank
                </>
              ) : (
                <>
                  <Banknote size={15} />
                  Record payout
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
