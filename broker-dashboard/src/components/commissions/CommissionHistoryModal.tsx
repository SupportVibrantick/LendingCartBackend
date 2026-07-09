import { Clock3, Receipt } from "lucide-react";
import { Modal } from "../ui/modal";
import {
  formatCommissionCurrency,
  formatCommissionRole,
  type CommissionHistory,
  type CommissionRecord,
} from "../../lib/commissionApi";

type Props = {
  row: CommissionRecord | null;
  history: CommissionHistory | null;
  loading?: boolean;
  isOpen: boolean;
  onClose: () => void;
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function CommissionHistoryModal({
  row,
  history,
  loading = false,
  isOpen,
  onClose,
}: Props) {
  if (!row) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-2xl p-0 shadow-2xl">
      <div className="overflow-hidden rounded-3xl">
        <div className="border-b border-slate-100 bg-gradient-to-br from-[#13538A]/10 to-white px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Commission History
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {row.recipientName || "Recipient"} ·{" "}
            {formatCommissionRole(row.recipientRole)} ·{" "}
            {formatCommissionCurrency(row.commissionAmount)}
          </p>
        </div>

        <div className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="space-y-3">
              <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
              <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
            </div>
          ) : (
            <>
              <section>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Clock3 size={16} className="text-[#13538A]" />
                  Audit log
                </div>
                {history?.auditLog?.length ? (
                  <div className="space-y-2">
                    {history.auditLog.map((event) => (
                      <div
                        key={event.id}
                        className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3"
                      >
                        <p className="text-sm font-medium text-slate-900">
                          {event.eventType.replace(/_/g, " ")}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatDateTime(event.createdAt)}
                          {event.actorName ? ` · ${event.actorName}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No audit events yet.</p>
                )}
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Receipt size={16} className="text-emerald-600" />
                  Payment history
                </div>
                {history?.paymentHistory?.length ? (
                  <div className="space-y-2">
                    {history.paymentHistory.map((payout) => (
                      <div
                        key={payout.id}
                        className="rounded-xl border border-emerald-100 bg-emerald-50/40 px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {formatCommissionCurrency(payout.amount)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatDateTime(payout.paidAt)}
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">
                          via {payout.paymentMethod || "MANUAL"}
                          {payout.paymentReference
                            ? ` · ${payout.paymentReference}`
                            : ""}
                        </p>
                        {payout.notes ? (
                          <p className="mt-2 text-xs text-slate-500">
                            {payout.notes}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    No payouts recorded yet.
                  </p>
                )}
              </section>
            </>
          )}
        </div>

        <div className="border-t border-slate-100 bg-slate-50/80 px-6 py-4 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
