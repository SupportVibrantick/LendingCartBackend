import { useEffect, useState } from "react";
import { Building2, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  fetchBrokerLenderDetail,
  type BrokerLenderAccessRow,
  type BrokerLenderDetail,
} from "../../lib/brokerDetailApi";
import { formatContactPhoneValue } from "../../lib/brokerContactForm";

type Props = {
  brokerId: string;
  access: BrokerLenderAccessRow;
  onClose: () => void;
  formatDate: (value?: string | null) => string;
  formatSource: (value?: string | null) => string;
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

function SectionTitle({ label, accent }: { label: string; accent: string }) {
  return (
    <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4">
      <div className={`h-4 w-1 rounded-full ${accent}`} />
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</h4>
    </div>
  );
}

function formatPhone(value?: string | null) {
  if (!value?.trim()) return undefined;
  return formatContactPhoneValue(value);
}

function formatCurrency(value?: number | null) {
  if (value == null || Number.isNaN(value)) return undefined;
  return `$${value.toLocaleString()}`;
}

function formatFundingRange(min?: number | null, max?: number | null) {
  const minLabel = formatCurrency(min);
  const maxLabel = formatCurrency(max);
  if (minLabel && maxLabel) return `${minLabel} – ${maxLabel}`;
  return minLabel || maxLabel;
}

function formatLastLogin(value?: string | null, formatDate?: (v?: string | null) => string) {
  if (!value) return "Never";
  return formatDate ? formatDate(value) : value;
}

function adminName(admin?: BrokerLenderDetail["admin"]) {
  if (!admin) return undefined;
  const name = [admin.firstName, admin.lastName].filter(Boolean).join(" ").trim();
  return name || undefined;
}

export default function ViewBrokerLenderModal({
  brokerId,
  access,
  onClose,
  formatDate,
  formatSource,
}: Props) {
  const [detail, setDetail] = useState<BrokerLenderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const json = await fetchBrokerLenderDetail(brokerId, access.id);
        if (!cancelled) {
          setDetail(json.data);
        }
      } catch (err: any) {
        if (!cancelled) {
          toast.error(err.message || "Failed to load lender details");
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
  }, [brokerId, access.id, onClose]);

  const data = detail || access;
  const lender = data.lender;
  const admin = detail?.admin;
  const profile = detail?.profile;
  const counts = detail?.counts;
  const displayPhone = lender?.phone || admin?.phone;

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="h-1 bg-gradient-to-r from-[#13538A] via-cyan-600 to-teal-500 opacity-80" />

        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Lender Details</h3>
            <p className="mt-0.5 text-xs text-slate-500">{lender?.name || "Lender"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-xs text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-[#13538A]" />
            Loading lender details...
          </div>
        ) : (
          <div className="overflow-y-auto p-5">
            <div className="mb-5 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#13538A]/20 bg-[#13538A]/10 text-[#13538A]">
                <Building2 className="h-7 w-7" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <SectionTitle label="Broker connection" accent="bg-[#13538A]" />
              <Field label="Source" value={formatSource(data.source)} />
              <Field label="Connected" value={data.isActive ? "Yes" : "No"} />
              <Field label="Linked on" value={formatDate(data.createdAt)} />
              <Field label="Last updated" value={formatDate(data.updatedAt)} />

              <SectionTitle label="Organization" accent="bg-cyan-600" />
              <Field label="Lender name" value={lender?.name} />
              <Field label="Organization email" value={lender?.email} />
              <Field label="Organization phone" value={formatPhone(displayPhone)} />
              <Field label="Organization status" value={lender?.status} />
              <Field label="Created" value={formatDate(lender?.createdAt)} />

              <SectionTitle label="Administrator" accent="bg-emerald-500" />
              <Field label="Admin name" value={adminName(admin)} />
              <Field label="Admin email" value={admin?.email} />
              <Field label="Admin phone" value={formatPhone(admin?.phone)} />
              <Field label="Admin status" value={admin?.status} />
              <Field
                label="Last login"
                value={formatLastLogin(admin?.lastLoginAt, formatDate)}
              />
              <Field label="Admin since" value={formatDate(admin?.createdAt)} />

              <SectionTitle label="Lender profile" accent="bg-violet-500" />
              <div className="sm:col-span-2 lg:col-span-4">
                <Field label="Summary" value={profile?.summary} />
              </div>
              <Field
                label="Loan products offered"
                value={profile?.loanTypes?.length ? profile.loanTypes.join(", ") : undefined}
              />
              <Field
                label="Funding range"
                value={formatFundingRange(profile?.minFunding, profile?.maxFunding)}
              />
              <Field
                label="Funding speed"
                value={
                  profile?.fundingSpeedDays != null
                    ? `${profile.fundingSpeedDays} day${profile.fundingSpeedDays === 1 ? "" : "s"}`
                    : undefined
                }
              />
              <Field label="States supported" value={profile?.statesSupported} />
              <Field label="Industries" value={profile?.industries} />
              <Field label="Profile status" value={profile?.profileStatus} />
              <Field
                label="Discovery visible"
                value={
                  profile == null
                    ? undefined
                    : profile.isVisible
                      ? "Yes"
                      : "No"
                }
              />

              <SectionTitle label="Platform stats" accent="bg-slate-400" />
              <Field label="Assigned loan products" value={counts?.loanProducts ?? 0} />
              <Field
                label="Active broker connections"
                value={counts?.activeBrokerConnections ?? 0}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
