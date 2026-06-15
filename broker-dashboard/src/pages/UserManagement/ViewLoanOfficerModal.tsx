import { useEffect, useState } from "react";
import { Loader2, User, X } from "lucide-react";
import toast from "react-hot-toast";
import { US_STATES, formatPhone } from "./loanOfficerShared";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export type LoanOfficerDetail = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
  assignedDeals?: number;
  roles: string[];
  permissions?: string[];
  profile: {
    company: string | null;
    tollFree: string | null;
    tollFreeExt: string | null;
    serviceProvider: string | null;
    address: string | null;
    suite: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    agentType: string | null;
    licenseNumber: string | null;
    preferredComm: string | null;
    website: string | null;
    avatarUrl: string | null;
  } | null;
};

type Props = {
  officerId: string;
  fallback?: Pick<LoanOfficerDetail, "firstName" | "lastName" | "email" | "status" | "profile">;
  onClose: () => void;
};

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  const display =
    value === undefined || value === null || value === "" ? "—" : value;

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800/50">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-[11px] font-medium text-slate-800 dark:text-slate-100">
        {display}
      </p>
    </div>
  );
}

function SectionTitle({ label, accent }: { label: string; accent: string }) {
  return (
    <div className="flex items-center gap-2 sm:col-span-2">
      <div className={`h-4 w-1 rounded-full ${accent}`} />
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </h4>
    </div>
  );
}

function formatStateName(code?: string | null) {
  if (!code) return "—";
  return US_STATES.find((state) => state.code === code)?.name || code;
}

function formatPreferredComm(value?: string | null) {
  if (value === "EMAIL") return "Email";
  if (value === "PHONE") return "Phone";
  return value || "—";
}

function formatLastLogin(value?: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleString();
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getAuthHeaders() {
  const token = sessionStorage.getItem("broker_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export default function ViewLoanOfficerModal({
  officerId,
  fallback,
  onClose,
}: Props) {
  const [detail, setDetail] = useState<LoanOfficerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/broker/users/${officerId}`, {
          headers: getAuthHeaders(),
        });
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.message || "Failed to load loan officer details");
        }

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
  }, [officerId, onClose]);

  const data = detail;
  const profile = data?.profile ?? fallback?.profile ?? null;
  const firstName = data?.firstName ?? fallback?.firstName ?? "";
  const lastName = data?.lastName ?? fallback?.lastName ?? "";
  const email = data?.email ?? fallback?.email ?? "";
  const avatarUrl = profile?.avatarUrl ? `${API_BASE}${profile.avatarUrl}` : "";

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Loan Officer Details
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {[firstName, lastName].filter(Boolean).join(" ") || email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-xs text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading details...
          </div>
        ) : !data ? (
          <div className="py-16 text-center text-xs text-slate-500">No details found.</div>
        ) : (
          <div className="overflow-y-auto p-4">
            <div className="mb-4 flex flex-col items-center text-center">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-8 w-8 text-slate-400" />
                )}
              </div>
              <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
                {[data.firstName, data.lastName].filter(Boolean).join(" ") || data.email}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{data.email}</p>
              <span
                className={`mt-2 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
                  data.status === "ACTIVE"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {data.status}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <SectionTitle label="Basic information" accent="bg-[#13538A]" />
              <Field label="First name" value={data.firstName} />
              <Field label="Last name" value={data.lastName} />
              <Field label="Email" value={data.email} />
              <Field
                label="Phone"
                value={data.phone ? formatPhone(data.phone) : "—"}
              />
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
              <Field
                label="Toll free"
                value={profile?.tollFree ? formatPhone(profile.tollFree) : "—"}
              />
              <Field label="Ext" value={profile?.tollFreeExt} />
              <Field
                label="Preferred communication"
                value={formatPreferredComm(profile?.preferredComm)}
              />
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
