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
  ACH: "US bank transfer from your firm account",
  ZELLE: "Record after sending in your bank/Zelle app",
  WIRE: "Record a completed wire transfer",
  CHECK: "Record a mailed or hand-delivered check",
  CASH: "Record a cash payout",
  MANUAL: "Mark paid for any outside payment",
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
  const amountPreview = Number.isFinite(parsedAmount) && parsedAmount > 0
    ? parsedAmount
    : remaining;

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
      className="max-w-xl p-0 shadow-2xl"
      showCloseButton={!submitting}
    >
      <form
        onSubmit={(event) => handleSubmit(event, canSendAch)}
        className="overflow-hidden rounded-3xl"
      >
        <div className="relative overflow-hidden border-b border-slate-100 bg-[#0f3f6b] px-6 py-5 text-white">
          <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-16 right-16 h-36 w-36 rounded-full bg-emerald-400/20" />

          <div className="relative flex items-start gap-3 pr-8">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur">
              <Banknote size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/70">
                {canSendAch ? "Bank transfer" : "Payout record"}
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">
                {canSendAch ? "Send payout" : "Record payout"}
              </h2>
              <p className="mt-1.5 text-sm text-white/80">
                {formatCommissionCurrency(amountPreview)} to{" "}
                <span className="font-semibold text-white">
                  {row.recipientName || "recipient"}
                </span>
              </p>
            </div>
          </div>

          <div className="relative mt-4 grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-white/10 px-3.5 py-2.5 ring-1 ring-white/15">
              <p className="text-[11px] uppercase tracking-wide text-white/65">
                Total commission
              </p>
              <p className="mt-1 text-base font-semibold">
                {formatCommissionCurrency(row.commissionAmount)}
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-400/15 px-3.5 py-2.5 ring-1 ring-emerald-300/30">
              <p className="text-[11px] uppercase tracking-wide text-emerald-100/90">
                Remaining
              </p>
              <p className="mt-1 text-base font-semibold text-emerald-100">
                {formatCommissionCurrency(remaining)}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#13538A] shadow-sm ring-1 ring-slate-200">
                <UserRound size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {row.recipientName || "Recipient"}
                  </p>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200">
                    {formatCommissionRole(row.recipientRole)}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {row.recipientEmail || "No email on file"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  {row.applicationNumber ? (
                    <span className="inline-flex items-center gap-1">
                      <Building2 size={12} />
                      {row.applicationNumber}
                    </span>
                  ) : null}
                  {row.clientName ? <span>{row.clientName}</span> : null}
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Payout amount
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">
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
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-8 pr-24 text-base font-semibold text-slate-900 outline-none transition focus:border-[#13538A]/50 focus:ring-2 focus:ring-[#13538A]/15 disabled:opacity-60"
              />
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setAmount(String(remaining));
                  setError(null);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-60"
              >
                Full amount
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Payment method
            </label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
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
                    className={`rounded-xl px-2 py-2 text-xs font-semibold transition disabled:opacity-60 ${
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
            <p className="mt-2 text-xs text-slate-500">
              {METHOD_HINTS[paymentMethod] || "Choose how this payout was made"}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Payment reference
                <span className="ml-1 font-normal text-slate-400">(optional)</span>
              </label>
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                disabled={submitting}
                placeholder="Check #, wire ref, transaction ID"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#13538A]/50 focus:ring-2 focus:ring-[#13538A]/15 disabled:opacity-60"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Notes
                <span className="ml-1 font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={submitting}
                rows={2}
                placeholder="Internal notes about this payout"
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#13538A]/50 focus:ring-2 focus:ring-[#13538A]/15 disabled:opacity-60"
              />
            </div>
          </div>

          {canSendAch ? (
            <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
              <div className="flex items-center gap-2 border-b border-emerald-100 px-3.5 py-2.5">
                <ArrowRightLeft size={14} className="text-emerald-700" />
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                  ACH transfer path
                </p>
              </div>
              <div className="grid gap-0 sm:grid-cols-[1fr_auto_1fr]">
                <div className="px-3.5 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    From
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Landmark size={16} className="text-[#13538A]" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Firm bank account
                      </p>
                      <p className="text-xs text-slate-500">Payments → Banking</p>
                    </div>
                  </div>
                </div>
                <div className="hidden items-center justify-center sm:flex">
                  <div className="rounded-full bg-emerald-100 p-1.5 text-emerald-700">
                    <ArrowRightLeft size={14} />
                  </div>
                </div>
                <div className="border-t border-emerald-100 px-3.5 py-3 sm:border-t-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    To
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Banknote size={16} className="text-emerald-700" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {row.bankPayout?.bankName || "Recipient bank"}
                        {row.bankPayout?.accountLast4
                          ? ` ····${row.bankPayout.accountLast4}`
                          : ""}
                      </p>
                      <p className="text-xs text-slate-500">
                        Settles in 1–3 business days
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {paymentMethod === "ACH" && !row.bankPayout?.available ? (
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
              <Info size={16} className="mt-0.5 shrink-0" />
              <p>
                No bank account is on file for this person. Record a Zelle/wire
                payout after you pay outside the app, or ask them to add banking
                details.
              </p>
            </div>
          ) : null}

          {paymentMethod === "ZELLE" ? (
            <div className="flex items-start gap-2.5 rounded-2xl border border-sky-200 bg-sky-50 px-3.5 py-3 text-sm text-sky-950">
              <Info size={16} className="mt-0.5 shrink-0" />
              <p>
                Zelle is recorded here after you send it from your bank app.
                Automatic Zelle is not available — use ACH Send to bank for
                in-app transfers.
              </p>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/90 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {canSendAch ? (
              <button
                type="button"
                onClick={(event) => handleSubmit(event, false)}
                disabled={submitting}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Record only
              </button>
            ) : null}
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {canSendAch ? "Sending..." : "Recording..."}
                </>
              ) : canSendAch ? (
                <>
                  <Landmark size={16} />
                  Send to bank
                </>
              ) : (
                <>
                  <Banknote size={16} />
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
