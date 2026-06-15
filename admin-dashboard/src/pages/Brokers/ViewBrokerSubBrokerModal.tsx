import { useEffect, useState } from "react";
import { Loader2, User, X } from "lucide-react";
import toast from "react-hot-toast";
import { formatSbPhone } from "../../lib/brokerSubBrokerForm";
import {
  fetchBrokerSubBrokerDetail,
  type BrokerTeamMember,
} from "../../lib/brokerDetailApi";

type Props = {
  brokerId: string;
  subBroker: BrokerTeamMember;
  onClose: () => void;
  formatDate: (value?: string | null) => string;
  formatLastLogin: (value?: string | null) => string;
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

export default function ViewBrokerSubBrokerModal({
  brokerId,
  subBroker,
  onClose,
  formatDate,
  formatLastLogin,
}: Props) {
  const [detail, setDetail] = useState<BrokerTeamMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const json = await fetchBrokerSubBrokerDetail(brokerId, subBroker.id);
        if (!cancelled) setDetail(json.data);
      } catch (err: any) {
        if (!cancelled) {
          toast.error(err.message || "Failed to load sub-broker details");
          onClose();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [brokerId, subBroker.id, onClose]);

  const data = detail || subBroker;

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Sub-Broker Details</h3>
            <p className="text-[10px] text-slate-500">
              {[data.firstName, data.lastName].filter(Boolean).join(" ") || data.email}
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

        {loading ? (
          <div className="flex items-center justify-center py-16 text-xs text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading details...
          </div>
        ) : (
          <div className="overflow-y-auto p-4">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                <User className="h-7 w-7 text-slate-400" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Field label="First name" value={data.firstName} />
              <Field label="Last name" value={data.lastName} />
              <Field label="Email" value={data.email} />
              <Field
                label="Phone"
                value={data.phone ? formatSbPhone(data.phone) : "—"}
              />
              <Field label="Status" value={data.status} />
              <Field label="Assigned apps" value={data.assignedApplications ?? 0} />
              <Field label="Last login" value={formatLastLogin(data.lastLoginAt)} />
              <Field label="Joined" value={formatDate(data.createdAt)} />
              <Field
                label="Login access"
                value={data.status === "ACTIVE" ? "Allowed" : "Disabled"}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
