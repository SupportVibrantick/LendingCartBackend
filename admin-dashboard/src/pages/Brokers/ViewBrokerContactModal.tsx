import { X } from "lucide-react";
import type { BrokerContact } from "../../lib/brokerDetailApi";

type Props = {
  contact: BrokerContact;
  onClose: () => void;
  formatContactType: (value?: string | null) => string;
  formatDate: (value?: string | null) => string;
};

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <span className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2 text-[11px] font-medium text-slate-800 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-100">
        {value || "—"}
      </span>
    </div>
  );
}

export default function ViewBrokerContactModal({
  contact,
  onClose,
  formatContactType,
  formatDate,
}: Props) {
  return (
    <div className="fixed inset-0 z-[999999999] flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-2xl max-h-[85vh] flex-col rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Contact Details</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {[contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.companyName || "Contact"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto px-5 py-4">
          <Field label="Contact type" value={formatContactType(contact.contactType)} />
          <Field label="Entity type" value={contact.entityType} />
          <Field label="First name" value={contact.firstName} />
          <Field label="Last name" value={contact.lastName} />
          <Field label="Email" value={contact.email} />
          <Field label="Phone" value={contact.phone} />
          <Field label="Cell" value={contact.cellNumber} />
          <Field label="Toll free" value={contact.tollFree} />
          <Field label="Fax" value={contact.faxNumber} />
          <Field label="Company" value={contact.companyName} />
          <Field label="Website" value={contact.website} />
          <Field label="City" value={contact.city} />
          <Field label="State" value={contact.state} />
          <Field label="State of formation" value={contact.stateOfFormation} />
          <Field label="Zip" value={contact.zipCode} />
          <Field label="Added" value={formatDate(contact.createdAt)} />
          <div className="sm:col-span-2">
            <Field label="Address" value={contact.address} />
          </div>
          <div className="sm:col-span-2">
            <Field label="Notes" value={contact.description} />
          </div>
        </div>
      </div>
    </div>
  );
}
