type Props = {
  contact: any;
  onClose: () => void;
};

export default function ViewContactModal({ contact, onClose }: Props) {
  const Field = ({ label, value }: { label: string; value?: string }) => (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <span className="rounded-md border border-gray-200 bg-blue-50 p-2 text-xs font-medium text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
        {value || "-"}
      </span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/40 dark:bg-black/60">
      <div className="relative flex max-h-[80vh] w-[650px] flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Contact Details
          </h2>
          <button
            onClick={onClose}
            className="text-lg font-semibold text-red-500 hover:text-red-600 dark:hover:text-red-400"
          >
            ✕
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-12 gap-y-5 overflow-y-auto pr-2">
          <Field label="Contact Type" value={contact.contactType} />
          <Field label="Entity Type" value={contact.entityType} />
          <Field label="First Name" value={contact.firstName} />
          <Field label="Last Name" value={contact.lastName} />
          <Field label="Email" value={contact.email} />
          <Field label="Phone" value={contact.phone} />
          <Field label="Cell Number" value={contact.cellNumber} />
          <Field label="Toll Free" value={contact.tollFree} />
          <Field label="Fax Number" value={contact.faxNumber} />
          <Field label="Company Name" value={contact.companyName} />
          <Field label="Website" value={contact.website} />
          <Field label="City" value={contact.city} />
          <Field label="State" value={contact.state} />
          <Field label="State Of Formation" value={contact.stateOfFormation} />
          <Field label="Zip Code" value={contact.zipCode} />
          <Field label="Address" value={contact.address} />
          <div className="col-span-2">
            <Field label="Description" value={contact.description} />
          </div>
        </div>
      </div>
    </div>
  );
}
