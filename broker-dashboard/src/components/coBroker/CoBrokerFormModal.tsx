import { Eye, EyeOff, Loader2, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import MultiSelect from "../form/MultiSelect";
import {
  AGENT_TYPES,
  buildCoBrokerFormData,
  FINDERS_FEE_OPTIONS,
  formatPhone,
  INITIAL_CO_BROKER_FORM,
  mapDetailToForm,
  PARTNER_TYPES,
  PREFERRED_COMMUNICATION,
  STATE_OPTIONS,
  syncPrimaryContactFromBasic,
  validateCoBrokerForm,
  type CoBrokerDetail,
  type CoBrokerFormErrors,
  type CoBrokerFormState,
} from "../../lib/coBrokerForm";
import {
  fetchCoBrokerLoanOfficers,
  fetchCoBrokerLoanTypes,
  type CoBrokerLoanOfficerOption,
  type LoanTypeOption,
} from "../../lib/coBrokerApi";
import { isLoanOfficerPortalPath } from "../../lib/portalAuth";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-[#13538A]/40 focus:bg-white focus:ring-2 focus:ring-[#13538A]/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100";

const labelClass =
  "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

// function getAuthHeaders(): Record<string, string> {
//   const token = sessionStorage.getItem("broker_token");
//   return token ? { Authorization: `Bearer ${token}` } : {};
// }

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-950">
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${
          checked ? "bg-[#13538A]" : "bg-gray-300 dark:bg-gray-700"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function FormField({
  label,
  required,
  error,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className={labelClass}>
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-500">{error}</p> : null}
    </div>
  );
}

type Props = {
  isOpen: boolean;
  mode: "create" | "edit";
  subBrokerId?: string | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

export default function CoBrokerFormModal({
  isOpen,
  mode,
  subBrokerId,
  onClose,
  onSaved,
}: Props) {
  const isLoPortal = isLoanOfficerPortalPath();
  const isEdit = mode === "edit";
  const [form, setForm] = useState<CoBrokerFormState>(INITIAL_CO_BROKER_FORM);
  const [errors, setErrors] = useState<CoBrokerFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loanOfficers, setLoanOfficers] = useState<CoBrokerLoanOfficerOption[]>(
    [],
  );
  const [loanTypeOptions, setLoanTypeOptions] = useState<LoanTypeOption[]>([]);
  const [loadingLoanOfficers, setLoadingLoanOfficers] = useState(false);
  const [loadingLoanTypes, setLoadingLoanTypes] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);

    let cancelled = false;

    (async () => {
      try {
        setLoadingLoanOfficers(true);
        setLoadingLoanTypes(true);
        const [officers, loanTypes] = await Promise.all([
          isLoPortal ? Promise.resolve([]) : fetchCoBrokerLoanOfficers(),
          fetchCoBrokerLoanTypes(),
        ]);
        if (cancelled) return;
        setLoanOfficers(officers);
        setLoanTypeOptions(loanTypes);
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : "Failed to load form options",
          );
          setLoanOfficers([]);
          setLoanTypeOptions([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingLoanOfficers(false);
          setLoadingLoanTypes(false);
        }
      }
    })();

    if (!isEdit || !subBrokerId) {
      setForm(INITIAL_CO_BROKER_FORM);
    } else {
      (async () => {
        try {
          setLoading(true);

          const token =
            sessionStorage.getItem("loan_officer_token") ??
            sessionStorage.getItem("broker_token");
          if (!token) {
            toast.error("Unauthorized!");
            return;
          }

          const res = await fetch(
            `${API_BASE}/broker/sub-broker/${subBrokerId}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            },
          );
          const json = await res.json();
          if (cancelled) return;
          if (!res.ok || !json.success) {
            toast.error(json.message || "Failed to load co-broker");
            onClose();
            return;
          }
          setForm(mapDetailToForm(json.data as CoBrokerDetail));
        } catch {
          if (!cancelled) {
            toast.error("Failed to load co-broker");
            onClose();
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [isEdit, isLoPortal, isOpen, onClose, subBrokerId]);

  useEffect(() => {
    if (!isOpen || !form.useSameContact) return;

    setForm((prev) => {
      if (!prev.useSameContact) return prev;
      const synced = syncPrimaryContactFromBasic(prev);
      if (
        prev.contactFirstName === synced.contactFirstName &&
        prev.contactLastName === synced.contactLastName &&
        prev.contactPhone === synced.contactPhone &&
        prev.contactEmail === synced.contactEmail
      ) {
        return prev;
      }
      return { ...prev, ...synced };
    });
  }, [
    form.useSameContact,
    form.firstName,
    form.lastName,
    form.phone,
    form.email,
    isOpen,
  ]);

  const handleAllowedToLoginChange = (enabled: boolean) => {
    setForm((prev) => ({
      ...prev,
      allowedToLogin: enabled,
      ...(enabled
        ? {}
        : {
            password: "",
            confirmPassword: "",
          }),
    }));
    setShowPassword(false);
    setShowConfirmPassword(false);
    setErrors((prev) => ({
      ...prev,
      password: undefined,
      confirmPassword: undefined,
    }));
  };

  const handleUseSameContactChange = (checked: boolean) => {
    setForm((prev) => {
      const next = { ...prev, useSameContact: checked };
      if (checked) {
        return { ...next, ...syncPrimaryContactFromBasic(prev) };
      }
      return next;
    });
    setErrors((prev) => ({
      ...prev,
      contactFirstName: undefined,
      contactLastName: undefined,
      contactPhone: undefined,
      contactEmail: undefined,
    }));
  };

  const updateField = <K extends keyof CoBrokerFormState>(
    key: K,
    value: CoBrokerFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validateCoBrokerForm(form, { isEdit });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      const firstKey = (
        Object.keys(validationErrors) as (keyof typeof validationErrors)[]
      )[0];
      toast.error(`${validationErrors[firstKey]}`);
      return;
    }

    try {
      setSaving(true);
      const { body, files } = buildCoBrokerFormData(form, {
        includeLoanOfficerAssignment: !isLoPortal,
      });
      const url = isEdit
        ? `${API_BASE}/broker/sub-broker/${subBrokerId}/update`
        : `${API_BASE}/broker/sub-broker/create`;

      const token =
        sessionStorage.getItem("loan_officer_token") ??
        sessionStorage.getItem("broker_token");
      if (!token) {
        toast.error("Unauthorized!");
        return null;
      }

      const hasFiles = Boolean(files.logo || files.w9);
      let requestBody: BodyInit;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };

      if (hasFiles) {
        const formData = new FormData();
        for (const [key, value] of Object.entries(body)) {
          formData.append(key, String(value));
        }
        if (files.logo) formData.append("logo", files.logo);
        if (files.w9) formData.append("w9", files.w9);
        requestBody = formData;
      } else {
        headers["Content-Type"] = "application/json";
        requestBody = JSON.stringify(body);
      }

      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers,
        body: requestBody,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        if (json.message?.toLowerCase().includes("email")) {
          setErrors((prev) => ({ ...prev, email: json.message }));
        }
        toast.error(json.message || "Failed to save co-broker");
        return;
      }

      toast.success(isEdit ? "Co-Broker updated" : "Co-Broker created");
      await onSaved();
      onClose();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const loanOfficerOptions = loanOfficers.map((officer) => ({
    value: officer.id,
    text:
      `${officer.firstName || ""} ${officer.lastName || ""}`.trim() ||
      officer.email ||
      "Loan Officer",
  }));

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
              {isEdit ? "Edit CO-Broker" : "Create CO-Broker"}
            </h2>
            <p className="text-sm text-gray-500">
              {isEdit
                ? isLoPortal
                  ? "Update co-broker profile."
                  : "Update co-broker profile and assigned loan officers."
                : "Add a new co-broker with full profile details."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-gray-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="space-y-6 overflow-y-auto p-6">
              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Basic Information
                </h3>
                {!form.useSameContact ? (
                  <p className="text-xs text-gray-500">
                    These fields represent the business contact shown above the
                    login contact in Primary Contact.
                  </p>
                ) : null}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    label="Broker/Partner Type"
                    required
                    error={errors.partnerType}
                  >
                    <select
                      className={inputClass}
                      value={form.partnerType}
                      onChange={(e) =>
                        updateField("partnerType", e.target.value)
                      }
                    >
                      <option value="">Select partner type</option>
                      {PARTNER_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Company" required error={errors.company}>
                    <input
                      className={inputClass}
                      value={form.company}
                      onChange={(e) => updateField("company", e.target.value)}
                      placeholder="Company Name"
                    />
                  </FormField>

                  <FormField
                    label="First Name"
                    required
                    error={errors.firstName}
                  >
                    <input
                      className={inputClass}
                      value={form.firstName}
                      onChange={(e) => updateField("firstName", e.target.value)}
                    />
                  </FormField>

                  <FormField label="Last Name" required error={errors.lastName}>
                    <input
                      className={inputClass}
                      value={form.lastName}
                      onChange={(e) => updateField("lastName", e.target.value)}
                    />
                  </FormField>

                  <FormField
                    label="Email"
                    required
                    error={errors.email}
                    className="sm:col-span-2"
                  >
                    <input
                      type="email"
                      className={`${inputClass} ${isEdit ? "cursor-not-allowed opacity-70" : ""}`}
                      value={form.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      disabled={isEdit}
                    />
                  </FormField>

                  <ToggleRow
                    label="Allowed to login?"
                    checked={form.allowedToLogin}
                    onChange={handleAllowedToLoginChange}
                  />

                  <div className="sm:col-span-2" />

                  <FormField label="Phone Number" required error={errors.phone}>
                    <input
                      className={inputClass}
                      value={formatPhone(form.phone)}
                      onChange={(e) =>
                        updateField(
                          "phone",
                          e.target.value.replace(/\D/g, "").slice(0, 10),
                        )
                      }
                      placeholder="(555) 123-4567"
                    />
                  </FormField>

                  <FormField label="Toll Free">
                    <input
                      className={inputClass}
                      value={formatPhone(form.tollFree)}
                      onChange={(e) =>
                        updateField(
                          "tollFree",
                          e.target.value.replace(/\D/g, "").slice(0, 10),
                        )
                      }
                      placeholder="(555) 123-4567"
                    />
                  </FormField>

                  <FormField label="Address" className="sm:col-span-2">
                    <input
                      className={inputClass}
                      value={form.address}
                      onChange={(e) => updateField("address", e.target.value)}
                      placeholder="123 Main St, City, State, ZIP"
                    />
                  </FormField>

                  <FormField
                    label="Agent Type"
                    required
                    error={errors.agentType}
                  >
                    <select
                      className={inputClass}
                      value={form.agentType}
                      onChange={(e) => updateField("agentType", e.target.value)}
                    >
                      <option value="">Select agent type</option>
                      {AGENT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Social Security Number">
                    <input
                      className={inputClass}
                      value={form.ssn}
                      onChange={(e) => updateField("ssn", e.target.value)}
                      placeholder="XXX-XX-XXXX"
                    />
                  </FormField>

                  <FormField label="LinkedIn URL" className="sm:col-span-2">
                    <input
                      className={inputClass}
                      value={form.linkedinUrl}
                      onChange={(e) =>
                        updateField("linkedinUrl", e.target.value)
                      }
                      placeholder="https://linkedin.com/in/..."
                    />
                  </FormField>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  License Information
                </h3>
                <div className="space-y-3">
                  <ToggleRow
                    label="Do you have a Company NMLS #?"
                    checked={form.hasCompanyNmls}
                    onChange={(value) => updateField("hasCompanyNmls", value)}
                  />
                  {form.hasCompanyNmls ? (
                    <FormField label="Company NMLS #">
                      <input
                        className={inputClass}
                        value={form.companyNmls}
                        onChange={(e) =>
                          updateField("companyNmls", e.target.value)
                        }
                      />
                    </FormField>
                  ) : null}

                  <ToggleRow
                    label="Do you have a Personal NMLS #?"
                    checked={form.hasPersonalNmls}
                    onChange={(value) => updateField("hasPersonalNmls", value)}
                  />
                  {form.hasPersonalNmls ? (
                    <FormField label="Personal NMLS #">
                      <input
                        className={inputClass}
                        value={form.personalNmls}
                        onChange={(e) =>
                          updateField("personalNmls", e.target.value)
                        }
                      />
                    </FormField>
                  ) : null}

                  <ToggleRow
                    label="Do you have a Company State License #?"
                    checked={form.hasCompanyStateLicense}
                    onChange={(value) =>
                      updateField("hasCompanyStateLicense", value)
                    }
                  />
                  {form.hasCompanyStateLicense ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <MultiSelect
                        label="Select States"
                        options={STATE_OPTIONS}
                        value={form.companyStateLicenseStates}
                        onChange={(value) =>
                          updateField("companyStateLicenseStates", value)
                        }
                        placeholder="Select states"
                      />
                      <FormField label="Company State License #">
                        <input
                          className={inputClass}
                          value={form.companyStateLicense}
                          onChange={(e) =>
                            updateField("companyStateLicense", e.target.value)
                          }
                        />
                      </FormField>
                    </div>
                  ) : null}

                  <ToggleRow
                    label="Do you have a Personal State License #?"
                    checked={form.hasPersonalStateLicense}
                    onChange={(value) =>
                      updateField("hasPersonalStateLicense", value)
                    }
                  />
                  {form.hasPersonalStateLicense ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <MultiSelect
                        label="Select States"
                        options={STATE_OPTIONS}
                        value={form.personalStateLicenseStates}
                        onChange={(value) =>
                          updateField("personalStateLicenseStates", value)
                        }
                        placeholder="Select states"
                      />
                      <FormField label="Personal State License #">
                        <input
                          className={inputClass}
                          value={form.personalStateLicense}
                          onChange={(e) =>
                            updateField("personalStateLicense", e.target.value)
                          }
                        />
                      </FormField>
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Business Details
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <MultiSelect
                    label="Type Of Loans Offered"
                    options={loanTypeOptions}
                    value={form.loanTypesOffered}
                    onChange={(value) => updateField("loanTypesOffered", value)}
                    placeholder="Select loan types"
                    loading={loadingLoanTypes}
                  />

                  <FormField label="Approved Finders Fee">
                    <select
                      className={inputClass}
                      value={form.findersFee}
                      onChange={(e) =>
                        updateField("findersFee", e.target.value)
                      }
                    >
                      <option value="">Select finders fee</option>
                      {FINDERS_FEE_OPTIONS.map((fee) => (
                        <option key={fee} value={fee}>
                          {fee}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="EIN#">
                    <input
                      className={inputClass}
                      value={form.ein}
                      onChange={(e) => updateField("ein", e.target.value)}
                      placeholder="XX-XXXXXXX"
                    />
                  </FormField>

                  <FormField label="Preferred Communication">
                    <select
                      className={inputClass}
                      value={form.preferredComm}
                      onChange={(e) =>
                        updateField("preferredComm", e.target.value)
                      }
                    >
                      <option value="">
                        Please Select Preferred Communication
                      </option>
                      {PREFERRED_COMMUNICATION.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Website" className="sm:col-span-2">
                    <input
                      className={inputClass}
                      value={form.website}
                      onChange={(e) => updateField("website", e.target.value)}
                      placeholder="https://www.example.com"
                    />
                  </FormField>

                  <MultiSelect
                    label="States Authorized to Originate"
                    options={STATE_OPTIONS}
                    value={form.statesAuthorized}
                    onChange={(value) => updateField("statesAuthorized", value)}
                    placeholder="Select states"
                  />

                  <FormField label="# of employees">
                    <input
                      className={inputClass}
                      value={form.employeeCount}
                      onChange={(e) =>
                        updateField("employeeCount", e.target.value)
                      }
                      placeholder="Number of employees"
                    />
                  </FormField>

                  <MultiSelect
                    label="States that you broker loans in?"
                    options={STATE_OPTIONS}
                    value={form.brokerStates}
                    onChange={(value) => updateField("brokerStates", value)}
                    placeholder="Select states"
                  />

                  <FormField
                    label="Share your lending experience..."
                    className="sm:col-span-2"
                  >
                    <textarea
                      className={`${inputClass} min-h-[100px] resize-y`}
                      value={form.experience}
                      onChange={(e) =>
                        updateField("experience", e.target.value)
                      }
                      placeholder="Describe your experience..."
                    />
                  </FormField>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Uploads
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Logo">
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-950">
                      <Upload className="h-4 w-4" />
                      {form.logoFile?.name ||
                        (form.logoPreview ? "Change logo" : "Upload Logo")}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          updateField("logoFile", file);
                          if (file) {
                            updateField(
                              "logoPreview",
                              URL.createObjectURL(file),
                            );
                          }
                        }}
                      />
                    </label>
                  </FormField>

                  <FormField label="Upload - W9 Form">
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-950">
                      <Upload className="h-4 w-4" />
                      {form.w9File?.name || "Upload W9 Form"}
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        className="hidden"
                        onChange={(e) =>
                          updateField("w9File", e.target.files?.[0] || null)
                        }
                      />
                    </label>
                  </FormField>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Primary Contact
                </h3>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={form.useSameContact}
                    onChange={(e) =>
                      handleUseSameContactChange(e.target.checked)
                    }
                  />
                  Use the same contact info as above
                </label>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    label="Contact First Name"
                    required
                    error={errors.contactFirstName}
                  >
                    <input
                      className={`${inputClass} ${form.useSameContact ? "cursor-not-allowed bg-gray-100 opacity-80 dark:bg-gray-900" : ""}`}
                      value={form.contactFirstName}
                      onChange={(e) =>
                        updateField("contactFirstName", e.target.value)
                      }
                      placeholder="First Name"
                      disabled={form.useSameContact}
                    />
                  </FormField>
                  <FormField
                    label="Contact Last Name"
                    required
                    error={errors.contactLastName}
                  >
                    <input
                      className={`${inputClass} ${form.useSameContact ? "cursor-not-allowed bg-gray-100 opacity-80 dark:bg-gray-900" : ""}`}
                      value={form.contactLastName}
                      onChange={(e) =>
                        updateField("contactLastName", e.target.value)
                      }
                      placeholder="Last Name"
                      disabled={form.useSameContact}
                    />
                  </FormField>
                  <FormField
                    label="Contact Phone"
                    required
                    error={errors.contactPhone}
                  >
                    <input
                      className={`${inputClass} ${form.useSameContact ? "cursor-not-allowed bg-gray-100 opacity-80 dark:bg-gray-900" : ""}`}
                      value={formatPhone(form.contactPhone)}
                      onChange={(e) =>
                        updateField(
                          "contactPhone",
                          e.target.value.replace(/\D/g, "").slice(0, 10),
                        )
                      }
                      placeholder="(555) 123-4567"
                      disabled={form.useSameContact}
                    />
                  </FormField>
                  <FormField
                    label="Contact Email"
                    required
                    error={errors.contactEmail}
                  >
                    <input
                      type="email"
                      className={`${inputClass} ${form.useSameContact ? "cursor-not-allowed bg-gray-100 opacity-80 dark:bg-gray-900" : ""}`}
                      value={form.contactEmail}
                      onChange={(e) =>
                        updateField("contactEmail", e.target.value)
                      }
                      placeholder="contact@company.com"
                      disabled={form.useSameContact}
                    />
                  </FormField>
                </div>

                {form.allowedToLogin ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      label={isEdit ? "New Password" : "Password"}
                      required={!isEdit}
                      error={errors.password}
                    >
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          className={`${inputClass} pr-11`}
                          value={form.password}
                          autoComplete="new-password"
                          data-lpignore="true"
                          data-1p-ignore="true"
                          spellCheck={false}
                          onChange={(e) =>
                            updateField("password", e.target.value)
                          }
                          placeholder={
                            isEdit
                              ? "Leave blank to keep current"
                              : "Enter password"
                          }
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                        >
                          {showPassword ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                      </div>
                    </FormField>

                    <FormField
                      label="Confirm Password"
                      required={!isEdit || !!form.password}
                      error={errors.confirmPassword}
                    >
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          className={`${inputClass} pr-11`}
                          value={form.confirmPassword}
                          autoComplete="new-password"
                          data-lpignore="true"
                          data-1p-ignore="true"
                          spellCheck={false}
                          onChange={(e) =>
                            updateField("confirmPassword", e.target.value)
                          }
                          placeholder="Confirm password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                        >
                          {showConfirmPassword ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                      </div>
                    </FormField>
                  </div>
                ) : null}
              </section>

              {!isLoPortal ? (
                <section className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Assignments
                  </h3>

                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                    Assigned to Branch(s): No branches available. Please create
                    a branch first.
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      Branch linking will be available once branches are
                      configured.
                    </p>
                  </div>

                  <div>
                    <MultiSelect
                      label="Assigned Loan Officer(s)"
                      options={loanOfficerOptions}
                      value={form.assignedLoanOfficerIds}
                      onChange={(value) =>
                        updateField("assignedLoanOfficerIds", value)
                      }
                      placeholder={
                        loanOfficerOptions.length
                          ? "Select loan officers"
                          : "No loan officers found"
                      }
                      loading={loadingLoanOfficers}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {loanOfficerOptions.length
                        ? "Select employees within the broker company. Applications assigned to this co-broker will auto-assign these loan officers."
                        : "Create loan officers under your broker organization to assign them here."}
                    </p>
                  </div>
                </section>
              ) : null}
            </div>

            <div className="flex shrink-0 justify-end gap-3 border-t px-6 py-4 dark:border-gray-800">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-[#13538A] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1a6aad] disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isEdit ? "Save CO-Broker" : "Create CO-Broker"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
