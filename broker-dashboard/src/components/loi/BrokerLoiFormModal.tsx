import { Sparkles, X } from "lucide-react";
import type { BrokerLoiApplicationContext, BrokerLoiTerms } from "../../lib/brokerLoiTerms";
import BrokerLoiEditorPanel from "./BrokerLoiEditorPanel";

type Props = {
  isOpen: boolean;
  sourceLenderName: string;
  terms: BrokerLoiTerms;
  applicationContext?: BrokerLoiApplicationContext;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (terms: BrokerLoiTerms) => void;
};

/** Modal wrapper around {@link BrokerLoiEditorPanel} for optional popup use. */
export default function BrokerLoiFormModal({
  isOpen,
  sourceLenderName,
  terms,
  applicationContext,
  submitting = false,
  onClose,
  onSubmit,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-600" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Create Broker LOI
              </h3>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Based on selected lender LOI from{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {sourceLenderName}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        <BrokerLoiEditorPanel
          sourceLenderName={sourceLenderName}
          terms={terms}
          applicationContext={applicationContext}
          submitting={submitting}
          onCancel={onClose}
          onSubmit={(nextTerms, _branding) => onSubmit(nextTerms)}
        />
      </div>
    </div>
  );
}
