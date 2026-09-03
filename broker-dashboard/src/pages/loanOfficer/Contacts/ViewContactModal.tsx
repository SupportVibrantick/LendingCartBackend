import { Building2, Mail, MapPin, Pencil, Phone, X } from "lucide-react";

type Props = {
  contact: any;
  onClose: () => void;
  onEdit?: () => void;
};

function formatLabel(value?: string) {
  if (!value) return "—";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function Field({
  label,
  value,
  href,
}: {
  label: string;
  value?: string | null;
  href?: string;
}) {
  const display = value?.trim() || "—";
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3 dark:border-gray-800 dark:bg-gray-800/40">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </p>
      {href && value?.trim() ? (
        <a
          href={href}
          className="mt-1 block truncate text-sm font-medium text-[#13538A] hover:underline"
        >
          {display}
        </a>
      ) : (
        <p className="mt-1 truncate text-sm font-medium text-gray-800 dark:text-gray-100">
          {display}
        </p>
      )}
    </div>
  );
}

export default function ViewContactModal({ contact, onClose, onEdit }: Props) {
  const fullName =
    `${contact.firstName || ""} ${contact.lastName || ""}`.trim() ||
    "Unnamed contact";
  const location = [contact.city, contact.state, contact.zipCode]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm dark:bg-black/60">
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 bg-gradient-to-r from-[#13538A] to-[#1a6aad] px-6 py-5 text-white dark:border-gray-800">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">
                {formatLabel(contact.contactType)}
              </p>
              <h2 className="mt-1 truncate text-xl font-bold">{fullName}</h2>
              {contact.companyName ? (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-white/80">
                  <Building2 className="h-3.5 w-3.5" />
                  {contact.companyName}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {contact.email ? (
              <a
                href={`mailto:${contact.email}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium backdrop-blur-sm hover:bg-white/20"
              >
                <Mail className="h-3.5 w-3.5" />
                Email
              </a>
            ) : null}
            {contact.phone ? (
              <a
                href={`tel:${contact.phone}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium backdrop-blur-sm hover:bg-white/20"
              >
                <Phone className="h-3.5 w-3.5" />
                Call
              </a>
            ) : null}
            {location ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
                <MapPin className="h-3.5 w-3.5" />
                {location}
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 overflow-y-auto p-5 sm:grid-cols-2">
          <Field label="Contact Type" value={formatLabel(contact.contactType)} />
          <Field label="Entity Type" value={formatLabel(contact.entityType)} />
          <Field label="First Name" value={contact.firstName} />
          <Field label="Last Name" value={contact.lastName} />
          <Field
            label="Email"
            value={contact.email}
            href={contact.email ? `mailto:${contact.email}` : undefined}
          />
          <Field
            label="Phone"
            value={contact.phone}
            href={contact.phone ? `tel:${contact.phone}` : undefined}
          />
          <Field label="Cell Number" value={contact.cellNumber} />
          <Field label="Toll Free" value={contact.tollFree} />
          <Field label="Fax Number" value={contact.faxNumber} />
          <Field label="Company Name" value={contact.companyName} />
          <Field
            label="Website"
            value={contact.website}
            href={
              contact.website
                ? contact.website.startsWith("http")
                  ? contact.website
                  : `https://${contact.website}`
                : undefined
            }
          />
          <Field label="City" value={contact.city} />
          <Field label="State" value={contact.state} />
          <Field label="State Of Formation" value={contact.stateOfFormation} />
          <Field label="Zip Code" value={contact.zipCode} />
          <Field label="Address" value={contact.address} />
          <div className="sm:col-span-2">
            <Field label="Description" value={contact.description} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Close
          </button>
          {onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-2 rounded-xl bg-[#13538A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1a6aad]"
            >
              <Pencil className="h-4 w-4" />
              Edit Contact
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
