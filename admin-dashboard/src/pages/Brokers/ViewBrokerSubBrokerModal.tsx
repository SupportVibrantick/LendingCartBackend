import { useEffect, useState } from "react";
import { ExternalLink, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import { ADMIN_API_BASE } from "../../lib/adminApi";
import {
  fetchBrokerSubBrokerDetail,
  type BrokerSubBrokerDetail,
  type BrokerTeamMember,
} from "../../lib/brokerDetailApi";
import {
  formatDisplayValue,
  formatFileUrl,
  formatList,
  formatStateCodes,
  formatYesNo,
} from "../../lib/loanOfficer/coBrokerDisplay";
import { formatPhone } from "../../lib/loanOfficer/loanOfficerShared";

type Props = {
  brokerId: string;
  subBroker: BrokerTeamMember;
  onClose: () => void;
  formatDate: (value?: string | null) => string;
  formatLastLogin: (value?: string | null) => string;
};

type SubBrokerProfile = NonNullable<BrokerSubBrokerDetail["profile"]> & {
  tollFree?: string | null;
  address?: string | null;
  linkedinUrl?: string | null;
  ssn?: string | null;
  useSameContact?: boolean | null;
  contactFirstName?: string | null;
  contactLastName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  businessContact?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  hasCompanyNmls?: boolean | null;
  companyNmls?: string | null;
  hasPersonalNmls?: boolean | null;
  personalNmls?: string | null;
  hasCompanyStateLicense?: boolean | null;
  companyStateLicenseStates?: string[] | null;
  companyStateLicense?: string | null;
  hasPersonalStateLicense?: boolean | null;
  personalStateLicenseStates?: string[] | null;
  personalStateLicense?: string | null;
  loanTypesOffered?: string[] | null;
  findersFee?: string | null;
  ein?: string | null;
  preferredComm?: string | null;
  employeeCount?: string | number | null;
  website?: string | null;
  statesAuthorized?: string[] | null;
  brokerStates?: string[] | null;
  experience?: string | null;
  branchIds?: string[] | null;
  updatedAt?: string | null;
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

function maskSsn(ssn?: string | null) {
  if (!ssn) return "—";
  const digits = String(ssn).replace(/\D/g, "");
  if (digits.length >= 4) return `***-**-${digits.slice(-4)}`;
  return "***-**-****";
}

export default function ViewBrokerSubBrokerModal({
  brokerId,
  subBroker,
  onClose,
  formatDate,
  formatLastLogin,
}: Props) {
  const [detail, setDetail] = useState<BrokerSubBrokerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const json = await fetchBrokerSubBrokerDetail(brokerId, subBroker.id);
        if (!cancelled) setDetail(json.data);
      } catch (err: unknown) {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : "Failed to load sub-broker details",
          );
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

  const data = detail;
  const profile = (data?.profile ?? {}) as SubBrokerProfile;
  const firstName = data?.firstName ?? subBroker.firstName ?? "";
  const lastName = data?.lastName ?? subBroker.lastName ?? "";
  const email = data?.email ?? subBroker.email ?? "";
  const status = data?.status ?? subBroker.status ?? "";
  const phone = data?.phone ?? subBroker.phone ?? null;
  const lastLoginAt = data?.lastLoginAt ?? subBroker.lastLoginAt;
  const createdAt = data?.createdAt ?? subBroker.createdAt;
  const assignedApplications =
    data?.assignedApplications ?? subBroker.assignedApplications ?? 0;
  const logoUrl = formatFileUrl(ADMIN_API_BASE, profile.logoUrl);
  const w9Url = formatFileUrl(ADMIN_API_BASE, profile.w9Url);
  const useSameContact = profile.useSameContact ?? true;
  const businessContact = profile.businessContact;
  const assignedLoanOfficers = data?.assignedLoanOfficers ?? [];

  return (
    <div
      className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[min(92vh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Sub-Broker Details
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Complete read-only view of sub-broker details.
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

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading full profile...
            </div>
          ) : null}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${firstName} logo`}
                className="h-20 w-20 rounded-xl border border-slate-200 object-cover dark:border-slate-700"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-[#13538A]/10 text-xl font-bold text-[#13538A]">
                {firstName?.charAt(0)}
                {lastName?.charAt(0)}
              </div>
            )}
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                {[firstName, lastName].filter(Boolean).join(" ") || email}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{email}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    status === "ACTIVE"
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300"
                      : "bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {status === "ACTIVE" ? "Active" : status || "Disabled"}
                </span>
                {profile.agentType ? (
                  <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300">
                    {formatDisplayValue(profile.agentType)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <Section title="Basic Information">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Broker/Partner Type" value={formatDisplayValue(profile.partnerType)} />
              <Field label="Company" value={formatDisplayValue(profile.company)} />
              <Field label="Agent Type" value={formatDisplayValue(profile.agentType)} />
              <Field label="Allowed to Login" value={formatYesNo(profile.allowedToLogin)} />
              <Field
                label="Phone Number"
                value={phone ? formatPhone(phone) : "—"}
              />
              <Field
                label="Toll Free"
                value={profile.tollFree ? formatPhone(profile.tollFree) : "—"}
              />
              <Field
                label="Address"
                value={formatDisplayValue(profile.address)}
                className="sm:col-span-2"
              />
              <Field
                label="LinkedIn URL"
                value={formatDisplayValue(profile.linkedinUrl)}
                className="sm:col-span-2"
              />
              <Field label="SSN" value={maskSsn(profile.ssn)} />
              <Field label="Status" value={status || "—"} />
              <Field label="Assigned Apps" value={assignedApplications} />
              <Field label="Last Login" value={formatLastLogin(lastLoginAt)} />
              <Field label="Created" value={formatDate(createdAt)} />
              <Field
                label="Last Updated"
                value={formatDate(profile.updatedAt ?? null)}
              />
            </div>
          </Section>

          <Section title="Primary Contact">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                label="Use Same Contact Info"
                value={formatYesNo(useSameContact)}
                className="sm:col-span-2"
              />
              <Field
                label="Contact First Name"
                value={formatDisplayValue(profile.contactFirstName || firstName)}
              />
              <Field
                label="Contact Last Name"
                value={formatDisplayValue(profile.contactLastName || lastName)}
              />
              <Field
                label="Contact Phone"
                value={
                  profile.contactPhone || phone
                    ? formatPhone(profile.contactPhone || phone || "")
                    : "—"
                }
              />
              <Field
                label="Contact Email"
                value={formatDisplayValue(profile.contactEmail || email)}
              />
            </div>

            {!useSameContact && businessContact ? (
              <div className="mt-3 rounded-xl border border-dashed border-slate-200 p-4 dark:border-slate-700">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Business Contact
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field
                    label="First Name"
                    value={formatDisplayValue(businessContact.firstName)}
                  />
                  <Field
                    label="Last Name"
                    value={formatDisplayValue(businessContact.lastName)}
                  />
                  <Field
                    label="Email"
                    value={formatDisplayValue(businessContact.email)}
                  />
                  <Field
                    label="Phone"
                    value={
                      businessContact.phone
                        ? formatPhone(businessContact.phone)
                        : "—"
                    }
                  />
                </div>
              </div>
            ) : null}
          </Section>

          <Section title="License Information">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                label="Company NMLS"
                value={
                  profile.hasCompanyNmls
                    ? formatDisplayValue(profile.companyNmls)
                    : "—"
                }
              />
              <Field
                label="Personal NMLS"
                value={
                  profile.hasPersonalNmls
                    ? formatDisplayValue(profile.personalNmls)
                    : "—"
                }
              />
              <Field
                label="Company State License States"
                value={
                  profile.hasCompanyStateLicense
                    ? formatStateCodes(profile.companyStateLicenseStates)
                    : "—"
                }
              />
              <Field
                label="Company State License #"
                value={
                  profile.hasCompanyStateLicense
                    ? formatDisplayValue(profile.companyStateLicense)
                    : "—"
                }
              />
              <Field
                label="Personal State License States"
                value={
                  profile.hasPersonalStateLicense
                    ? formatStateCodes(profile.personalStateLicenseStates)
                    : "—"
                }
              />
              <Field
                label="Personal State License #"
                value={
                  profile.hasPersonalStateLicense
                    ? formatDisplayValue(profile.personalStateLicense)
                    : "—"
                }
              />
            </div>
          </Section>

          <Section title="Business Details">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                label="Type Of Loans Offered"
                value={formatList(profile.loanTypesOffered)}
                className="sm:col-span-2"
              />
              <Field
                label="Approved Finders Fee"
                value={formatDisplayValue(profile.findersFee)}
              />
              <Field label="EIN#" value={formatDisplayValue(profile.ein)} />
              <Field
                label="Preferred Communication"
                value={formatDisplayValue(profile.preferredComm)}
              />
              <Field
                label="# of Employees"
                value={formatDisplayValue(profile.employeeCount)}
              />
              <Field
                label="Website"
                value={
                  profile.website ? (
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
                label="States Authorized to Originate"
                value={formatStateCodes(profile.statesAuthorized)}
              />
              <Field
                label="States Broker Loans In"
                value={formatStateCodes(profile.brokerStates)}
              />
              <Field
                label="Experience"
                value={formatDisplayValue(profile.experience)}
                className="sm:col-span-2"
              />
            </div>
          </Section>

          <Section title="Documents">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                label="Logo"
                value={
                  logoUrl ? (
                    <a
                      href={logoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[#13538A] hover:underline"
                    >
                      View logo <ExternalLink className="h-3.5 w-3.5" />
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
            <div className="grid grid-cols-1 gap-3">
              <Field
                label="Assigned Loan Officer(s)"
                value={
                  assignedLoanOfficers.length ? (
                    <ul className="space-y-1">
                      {assignedLoanOfficers.map((officer) => (
                        <li key={officer.id}>
                          {officer.firstName} {officer.lastName}
                          {officer.email ? ` (${officer.email})` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    "—"
                  )
                }
              />
              <Field
                label="Assigned Branch(s)"
                value={
                  profile.branchIds?.length
                    ? formatList(profile.branchIds)
                    : "No branches assigned"
                }
              />
            </div>
          </Section>
        </div>

        <div className="flex shrink-0 justify-end border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
