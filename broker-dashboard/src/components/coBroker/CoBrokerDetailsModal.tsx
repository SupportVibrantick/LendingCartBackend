import { ExternalLink, Loader2, Pencil, X } from "lucide-react";
import type { CoBrokerDetail } from "../../lib/coBrokerForm";
import { formatPhone } from "../../lib/coBrokerForm";
import {
  formatDisplayValue,
  formatFileUrl,
  formatList,
  formatStateCodes,
  formatYesNo,
} from "../../lib/coBrokerDisplay";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

type Props = {
  isOpen: boolean;
  coBroker: CoBrokerDetail | null;
  loading?: boolean;
  onClose: () => void;
  onEdit: (id: string) => void;
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

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function CoBrokerDetailsModal({
  isOpen,
  coBroker,
  loading = false,
  onClose,
  onEdit,
}: Props) {
  if (!isOpen) return null;

  const profile = coBroker?.profile || {};
  const logoUrl = formatFileUrl(API_BASE, profile.logoUrl);
  const w9Url = formatFileUrl(API_BASE, profile.w9Url);
  const useSameContact = profile.useSameContact ?? true;
  const businessContact = profile.businessContact;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[min(92vh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between border-b px-6 py-4 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              CO-Broker Profile
            </h2>
            <p className="text-sm text-gray-500">Complete read-only view of co-broker details.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading || !coBroker ? (
          <div className="flex items-center justify-center py-24 text-sm text-gray-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading profile...
          </div>
        ) : (
          <>
            <div className="space-y-6 overflow-y-auto p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={`${coBroker.firstName} logo`}
                    className="h-20 w-20 rounded-xl border border-gray-200 object-cover dark:border-gray-700"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-[#13538A]/10 text-xl font-bold text-[#13538A]">
                    {coBroker.firstName?.charAt(0)}
                    {coBroker.lastName?.charAt(0)}
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {coBroker.firstName} {coBroker.lastName}
                  </h3>
                  <p className="text-sm text-gray-500">{coBroker.email}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        coBroker.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300"
                          : "bg-gray-100 text-gray-600 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-300"
                      }`}
                    >
                      {coBroker.status === "ACTIVE" ? "Active" : "Disabled"}
                    </span>
                    <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300">
                      {formatDisplayValue(profile.agentType)}
                    </span>
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
                    value={coBroker.phone ? formatPhone(coBroker.phone) : "—"}
                  />
                  <Field
                    label="Toll Free"
                    value={profile.tollFree ? formatPhone(profile.tollFree) : "—"}
                  />
                  <Field label="Address" value={formatDisplayValue(profile.address)} className="sm:col-span-2" />
                  <Field label="LinkedIn URL" value={formatDisplayValue(profile.linkedinUrl)} className="sm:col-span-2" />
                  <Field label="SSN" value={profile.ssn ? "•••-••-****" : "—"} />
                  <Field label="Status" value={coBroker.status} />
                  <Field label="Created" value={formatDate(coBroker.createdAt)} />
                  <Field label="Last Updated" value={formatDate(coBroker.updatedAt)} />
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
                    value={formatDisplayValue(profile.contactFirstName || coBroker.firstName)}
                  />
                  <Field
                    label="Contact Last Name"
                    value={formatDisplayValue(profile.contactLastName || coBroker.lastName)}
                  />
                  <Field
                    label="Contact Phone"
                    value={
                      profile.contactPhone || coBroker.phone
                        ? formatPhone(profile.contactPhone || coBroker.phone || "")
                        : "—"
                    }
                  />
                  <Field
                    label="Contact Email"
                    value={formatDisplayValue(profile.contactEmail || coBroker.email)}
                  />
                </div>

                {!useSameContact && businessContact ? (
                  <div className="mt-3 rounded-xl border border-dashed border-gray-200 p-4 dark:border-gray-700">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Business Contact
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="First Name" value={formatDisplayValue(businessContact.firstName)} />
                      <Field label="Last Name" value={formatDisplayValue(businessContact.lastName)} />
                      <Field label="Email" value={formatDisplayValue(businessContact.email)} />
                      <Field
                        label="Phone"
                        value={
                          businessContact.phone ? formatPhone(businessContact.phone) : "—"
                        }
                      />
                    </div>
                  </div>
                ) : null}
              </Section>

              <Section title="License Information">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Company NMLS" value={profile.hasCompanyNmls ? formatDisplayValue(profile.companyNmls) : "—"} />
                  <Field label="Personal NMLS" value={profile.hasPersonalNmls ? formatDisplayValue(profile.personalNmls) : "—"} />
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
                  <Field label="Approved Finders Fee" value={formatDisplayValue(profile.findersFee)} />
                  <Field label="EIN#" value={formatDisplayValue(profile.ein)} />
                  <Field label="Preferred Communication" value={formatDisplayValue(profile.preferredComm)} />
                  <Field label="# of Employees" value={formatDisplayValue(profile.employeeCount)} />
                  <Field label="Website" value={formatDisplayValue(profile.website)} className="sm:col-span-2" />
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
                      coBroker.assignedLoanOfficers?.length ? (
                        <ul className="space-y-1">
                          {coBroker.assignedLoanOfficers.map((officer) => (
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

            <div className="flex shrink-0 justify-end gap-3 border-t px-6 py-4 dark:border-gray-800">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => onEdit(coBroker.id)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#13538A] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1a6aad]"
              >
                <Pencil className="h-4 w-4" />
                Edit CO-Broker
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
