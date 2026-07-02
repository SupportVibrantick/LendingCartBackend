import { useEffect, useState } from "react";
import { ExternalLink, Loader2, User, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  formatDisplayValue,
  formatFileUrl,
  formatStateCodes,
  formatYesNo,
} from "../../lib/coBrokerDisplay";
import {
  inferPermissionLevel,
  PERMISSION_LEVEL_OPTIONS,
  type LoanOfficerDetail,
} from "../../lib/loanOfficerForm";
import { formatPhone, getPermissionLabel } from "./loanOfficerShared";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

type Props = {
  officerId: string;
  fallback?: Pick<LoanOfficerDetail, "firstName" | "lastName" | "email" | "status" | "profile">;
  onClose: () => void;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h4 className="border-b border-gray-100 pb-2 text-xs font-semibold uppercase tracking-wider text-[#13538A] dark:border-gray-800">
        {title}
      </h4>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  className = "",
}: {
  label: string;
  value?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-200">
        {value ?? "—"}
      </div>
    </div>
  );
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

function getPermissionLevelLabel(
  level: string | undefined,
  permissions: string[] = [],
) {
  const resolved = level || inferPermissionLevel(permissions);
  if (!resolved) return "—";
  return (
    PERMISSION_LEVEL_OPTIONS.find((option) => option.value === resolved)?.label ||
    resolved.replace(/_/g, " ")
  );
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
          setDetail(json.data as LoanOfficerDetail);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : "Failed to load loan officer details",
          );
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
  const avatarUrl = formatFileUrl(API_BASE, profile?.avatarUrl);
  const w9Url = formatFileUrl(API_BASE, profile?.w9Url);
  const permissions = data?.permissions || [];
  const permissionLevel = getPermissionLevelLabel(
    profile?.permissionLevel,
    permissions,
  );

  return (
    <div
      className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[min(92vh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Loan Officer Details
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Complete read-only view of loan officer profile.
            </p>
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
          <div className="flex items-center justify-center py-20 text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading details...
          </div>
        ) : !data ? (
          <div className="py-20 text-center text-sm text-slate-500">No details found.</div>
        ) : (
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
            <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-8 w-8 text-slate-400" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {[firstName, lastName].filter(Boolean).join(" ") || email}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{email}</p>
                <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      data.status === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {data.status === "ACTIVE" ? "Active" : data.status}
                  </span>
                  {profile?.agentType ? (
                    <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300">
                      {profile.agentType}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <Section title="Basic Information">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="First Name" value={formatDisplayValue(data.firstName)} />
                <Field label="Last Name" value={formatDisplayValue(data.lastName)} />
                <Field label="Email" value={formatDisplayValue(data.email)} />
                <Field
                  label="Phone Number"
                  value={data.phone ? formatPhone(data.phone) : "—"}
                />
                <Field label="License #" value={formatDisplayValue(profile?.licenseNumber)} />
                <Field label="Agent Type" value={formatDisplayValue(profile?.agentType)} />
                <Field label="Status" value={data.status} />
                <Field label="Assigned Deals" value={data.assignedDeals ?? 0} />
                <Field label="Last Login" value={formatLastLogin(data.lastLoginAt)} />
                <Field label="Joined" value={formatDate(data.createdAt)} />
                <Field
                  label="Login Access"
                  value={data.status === "ACTIVE" ? "Allowed" : "Disabled"}
                />
                <Field label="Permission Level" value={permissionLevel} />
              </div>
            </Section>

            <Section title="Company Details">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Company" value={formatDisplayValue(profile?.company)} />
                <Field label="EIN #" value={formatDisplayValue(profile?.ein)} />
                <Field
                  label="Preferred Communication"
                  value={formatDisplayValue(profile?.preferredComm)}
                />
                <Field
                  label="Approved Finders Fee"
                  value={formatDisplayValue(profile?.findersFee)}
                />
                <Field label="DRE #" value={formatDisplayValue(profile?.dre)} />
                <Field
                  label="Service Provider"
                  value={formatDisplayValue(profile?.serviceProvider)}
                />
                <Field
                  label="Toll Free"
                  value={profile?.tollFree ? formatPhone(profile.tollFree) : "—"}
                />
                <Field label="Ext" value={formatDisplayValue(profile?.tollFreeExt)} />
                <Field
                  label="Website"
                  value={
                    profile?.website ? (
                      <a
                        href={profile.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[#13538A] hover:underline"
                      >
                        {profile.website}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      "—"
                    )
                  }
                  className="sm:col-span-2"
                />
                <Field
                  label="Address"
                  value={formatDisplayValue(profile?.address)}
                  className="sm:col-span-2"
                />
                {profile?.suite || profile?.city || profile?.state || profile?.zipCode ? (
                  <>
                    <Field label="Suite" value={formatDisplayValue(profile?.suite)} />
                    <Field label="City" value={formatDisplayValue(profile?.city)} />
                    <Field label="State" value={formatDisplayValue(profile?.state)} />
                    <Field label="Zip Code" value={formatDisplayValue(profile?.zipCode)} />
                  </>
                ) : null}
                <Field
                  label="States Authorized to Originate"
                  value={formatStateCodes(profile?.statesAuthorized)}
                  className="sm:col-span-2"
                />
              </div>
            </Section>

            <Section title="License Information">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  label="Has Company NMLS #"
                  value={formatYesNo(profile?.hasCompanyNmls)}
                />
                <Field
                  label="Company NMLS #"
                  value={
                    profile?.hasCompanyNmls
                      ? formatDisplayValue(profile?.companyNmls)
                      : "—"
                  }
                />
                <Field
                  label="Has Personal NMLS #"
                  value={formatYesNo(profile?.hasPersonalNmls)}
                />
                <Field
                  label="Personal NMLS #"
                  value={
                    profile?.hasPersonalNmls
                      ? formatDisplayValue(profile?.personalNmls)
                      : "—"
                  }
                />
                <Field
                  label="Company State License States"
                  value={
                    profile?.hasCompanyStateLicense
                      ? formatStateCodes(profile?.companyStateLicenseStates)
                      : "—"
                  }
                />
                <Field
                  label="Company State License #"
                  value={
                    profile?.hasCompanyStateLicense
                      ? formatDisplayValue(profile?.companyStateLicense)
                      : "—"
                  }
                />
                <Field
                  label="Personal State License States"
                  value={
                    profile?.hasPersonalStateLicense
                      ? formatStateCodes(profile?.personalStateLicenseStates)
                      : "—"
                  }
                />
                <Field
                  label="Personal State License #"
                  value={
                    profile?.hasPersonalStateLicense
                      ? formatDisplayValue(profile?.personalStateLicense)
                      : "—"
                  }
                />
              </div>
            </Section>

            <Section title="Documents">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  label="Avatar"
                  value={
                    avatarUrl ? (
                      <a
                        href={avatarUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[#13538A] hover:underline"
                      >
                        View avatar <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      "—"
                    )
                  }
                />
                <Field
                  label="W9 Form"
                  value={
                    w9Url ? (
                      <a
                        href={w9Url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[#13538A] hover:underline"
                      >
                        View W9 <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      "—"
                    )
                  }
                />
              </div>
            </Section>

            <Section title="Assignments">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  label="Assigned Co-Broker(s)"
                  value={
                    data?.assignedCoBrokers?.length ? (
                      <ul className="space-y-1">
                        {data.assignedCoBrokers.map((broker) => (
                          <li key={broker.id}>
                            {broker.firstName} {broker.lastName}
                            {broker.email ? ` (${broker.email})` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      "—"
                    )
                  }
                  className="sm:col-span-2"
                />
                <Field
                  label="Assigned to Branch(s)"
                  value={
                    profile?.branchIds?.length
                      ? profile.branchIds.join(", ")
                      : "No branches assigned"
                  }
                  className="sm:col-span-2"
                />
              </div>
            </Section>

            {permissions.length > 0 ? (
              <Section title="User Permissions">
                <div className="flex flex-wrap gap-2">
                  {permissions.map((key) => (
                    <span
                      key={key}
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {getPermissionLabel(key)}
                    </span>
                  ))}
                </div>
              </Section>
            ) : null}

            {profile?.updatedAt ? (
              <p className="text-xs text-slate-400">
                Profile last updated: {formatDate(profile.updatedAt)}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
