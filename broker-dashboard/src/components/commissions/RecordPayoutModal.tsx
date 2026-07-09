import { useEffect, useState, type FormEvent } from "react";
import { Banknote, Loader2 } from "lucide-react";
import { Modal } from "../ui/modal";
import {
  formatCommissionCurrency,
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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid payout amount");
      return;
    }
    if (parsedAmount > remaining + 0.009) {
      setError(
        `Amount cannot exceed remaining balance (${formatCommissionCurrency(remaining)})`,
      );
      return;
    }

    setError(null);
    await onSubmit({
      amount: Math.round(parsedAmount * 100) / 100,
      paymentMethod,
      paymentReference: paymentReference.trim(),
      notes: notes.trim(),
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-lg p-0 shadow-2xl"
      showCloseButton={!submitting}
    >
      <form onSubmit={handleSubmit} className="overflow-hidden rounded-3xl">
        <div className="border-b border-slate-100 bg-gradient-to-br from-emerald-50 to-white px-6 py-5">
          <div className="flex items-start gap-3 pr-8">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
              <Banknote size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Record Payout
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Pay{" "}
                <span className="font-semibold text-emerald-700">
                  {formatCommissionCurrency(remaining)}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-slate-900">
                  {row.recipientName || "recipient"}
                </span>
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2.5">
              <p className="text-xs text-slate-500">Total commission</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">
                {formatCommissionCurrency(row.commissionAmount)}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200/80 bg-white/80 px-3 py-2.5">
              <p className="text-xs text-slate-500">Remaining</p>
              <p className="mt-0.5 text-sm font-semibold text-emerald-700">
                {formatCommissionCurrency(remaining)}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Payout amount
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              max={remaining}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Payment method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>

          <div>
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
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Notes
              <span className="ml-1 font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={submitting}
              rows={3}
              placeholder="Internal notes about this payout"
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
            />
          </div>

          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Recording...
              </>
            ) : (
              "Record Payout"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
