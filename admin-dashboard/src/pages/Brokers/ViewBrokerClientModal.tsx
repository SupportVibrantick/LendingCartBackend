import { useEffect, useState } from "react";
import { Loader2, User, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  fetchBrokerClientDetail,
  type BrokerClientRow,
} from "../../lib/brokerDetailApi";
import { formatContactPhoneValue } from "../../lib/brokerContactForm";

type Props = {
  brokerId: string;
  client: BrokerClientRow;
  onClose: () => void;
  formatDate: (value?: string | null) => string;
};

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  const display =
    value === undefined || value === null || value === "" ? "—" : value;

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2 dark:border-slate-800 dark:bg-slate-800/40">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 break-words text-[11px] font-medium text-slate-800 dark:text-slate-100">
        {display}
      </p>
    </div>
  );
}

function formatIndustry(value?: string | null) {
  if (!value?.trim()) return undefined;
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatEntityType(value?: string | null) {
  if (!value) return "—";
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function clientDisplayName(row: BrokerClientRow) {
  return row.displayName || row.legalName || row.primaryContact?.email || "Client";
}

export default function ViewBrokerClientModal({ brokerId, client, onClose, formatDate }: Props) {
  const [detail, setDetail] = useState<BrokerClientRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const json = await fetchBrokerClientDetail(brokerId, client.id);
        if (!cancelled) setDetail(json.data);
      } catch (err: any) {
        if (!cancelled) {
          toast.error(err.message || "Failed to load client details");
          onClose();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [brokerId, client.id, onClose]);

  const data = detail || client;
  const name = clientDisplayName(data);

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Client Details</h3>
            <p className="text-[10px] text-slate-500">{name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-xs text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading details...
          </div>
        ) : (
          <div className="overflow-y-auto p-4">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-cyan-200 bg-cyan-50 dark:border-cyan-900 dark:bg-cyan-950/40">
                <User className="h-7 w-7 text-cyan-600" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Field label="Display name" value={data.displayName || data.legalName} />
              <Field label="Legal name" value={data.legalName} />
              <Field label="Entity" value={data.entityLabel || "—"} />
              <Field label="Entity type" value={formatEntityType(data.entityType)} />
              <Field label="Industry" value={formatIndustry(data.industry)} />
              <Field label="Email" value={data.primaryContact?.email} />
              <Field
                label="Phone"
                value={
                  data.primaryContact?.phone
                    ? formatContactPhoneValue(data.primaryContact.phone)
                    : undefined
                }
              />
              <Field
                label="Contact name"
                value={[data.primaryContact?.firstName, data.primaryContact?.lastName]
                  .filter(Boolean)
                  .join(" ")}
              />
              <Field label="Status" value={data.isActive ? "ACTIVE" : "INACTIVE"} />
              <Field label="Applications" value={data.applicationsCount ?? 0} />
              <Field label="Portal users" value={data.portalUsersCount ?? 0} />
              <Field label="Joined" value={formatDate(data.createdAt)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
