import { useEffect, useState } from "react";
import { Loader2, User, X } from "lucide-react";
import toast from "react-hot-toast";
import { ADMIN_API_BASE } from "../../lib/adminApi";
import {
  fetchBrokerLoanOfficerDetail,
  type BrokerLoanOfficerDetail,
  type BrokerTeamMember,
} from "../../lib/brokerDetailApi";
import { formatLoPhone, LO_US_STATES } from "../../lib/brokerLoanOfficerForm";

type Props = {
  brokerId: string;
  officer: BrokerTeamMember;
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

function formatStateName(code?: string | null) {
  if (!code) return "—";
  return LO_US_STATES.find((state) => state.code === code)?.name || code;
}

function formatPreferredComm(value?: string | null) {
  if (value === "EMAIL") return "Email";
  if (value === "PHONE") return "Phone";
  return value || "—";
}

function formatPhoneDisplay(value?: string | null) {
  if (!value) return "—";
  return formatLoPhone(value);
}

function SectionTitle({ label, accent }: { label: string; accent: string }) {
  return (
    <div className="flex items-center gap-2 sm:col-span-2">
      <div className={`h-4 w-1 rounded-full ${accent}`} />
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</h4>
    </div>
  );
}

export default function ViewBrokerLoanOfficerModal({
  brokerId,
  officer,
  onClose,
  formatDate,
  formatLastLogin,
}: Props) {
  const [detail, setDetail] = useState<BrokerLoanOfficerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const json = await fetchBrokerLoanOfficerDetail(brokerId, officer.id);
        if (!cancelled) {
          setDetail(json.data);
        }
      } catch (err: any) {
        if (!cancelled) {
          toast.error(err.message || "Failed to load loan officer details");
          onClose();
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [brokerId, officer.id, onClose]);

  const data = detail || officer;
  const profile = detail?.profile;
  const avatarUrl = profile?.avatarUrl ? `${ADMIN_API_BASE}${profile.avatarUrl}` : "";

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Loan Officer Details</h3>
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
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-8 w-8 text-slate-400" />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <SectionTitle label="Basic information" accent="bg-[#13538A]" />
              <Field label="First name" value={data.firstName} />
              <Field label="Last name" value={data.lastName} />
              <Field label="Email" value={data.email} />
              <Field label="Phone" value={formatPhoneDisplay(data.phone)} />
              <Field label="License number" value={profile?.licenseNumber} />
              <Field label="Agent type" value={profile?.agentType} />
              <Field label="Status" value={data.status} />
              <Field label="Assigned deals" value={data.assignedDeals ?? 0} />
              <Field label="Last login" value={formatLastLogin(data.lastLoginAt)} />
              <Field label="Joined" value={formatDate(data.createdAt)} />
              <Field
                label="Login access"
                value={data.status === "ACTIVE" ? "Allowed" : "Disabled"}
              />

              <SectionTitle label="Company details" accent="bg-emerald-500" />
              <Field label="Company" value={profile?.company} />
              <Field label="Service provider" value={profile?.serviceProvider} />
              <Field label="Toll free" value={formatPhoneDisplay(profile?.tollFree)} />
              <Field label="Ext" value={profile?.tollFreeExt} />
              <Field label="Preferred communication" value={formatPreferredComm(profile?.preferredComm)} />
              <Field
                label="Website"
                value={
                  profile?.website ? (
                    <a
                      href={profile.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#13538A] hover:underline"
                    >
                      {profile.website}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />

              <SectionTitle label="Address" accent="bg-slate-400" />
              <div className="sm:col-span-2">
                <Field label="Street address" value={profile?.address} />
              </div>
              <Field label="Suite" value={profile?.suite} />
              <Field label="City" value={profile?.city} />
              <Field label="State" value={formatStateName(profile?.state)} />
              <Field label="Zip code" value={profile?.zipCode} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
