import { Eye, EyeOff, Loader2, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import MultiSelect from "../../components/form/MultiSelect";
import LoanOfficerPermissionsPanel from "../../components/loanOfficer/LoanOfficerPermissionsPanel";
import { ADMIN_API_BASE } from "../../lib/adminApi";
import {
  buildBrokerLoanOfficerFormData,
  FINDERS_FEE_OPTIONS,
  formatPhone,
  INITIAL_BROKER_LOAN_OFFICER_FORM,
  LO_SERVICE_PROVIDERS,
  mapDetailToBrokerLoanOfficerForm,
  PREFERRED_COMMUNICATION,
  STATE_OPTIONS,
  validateBrokerLoanOfficerForm,
  type BrokerLoanOfficerDetail,
  type BrokerLoanOfficerFormErrors,
  type BrokerLoanOfficerFormState,
} from "../../lib/brokerLoanOfficerForm";
import {
  createBrokerLoanOfficer,
  fetchBrokerLoanOfficerDetail,
  fetchBrokerSubBrokers,
  updateBrokerLoanOfficer,
  type BrokerTeamMember,
} from "../../lib/brokerDetailApi";

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-[#13538A]/40 focus:bg-white focus:ring-2 focus:ring-[#13538A]/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100";

const labelClass =
  "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

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
  brokerId: string;
  officerId?: string | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

export default function BrokerLoanOfficerModal({
  isOpen,
  mode,
  brokerId,
  officerId,
  onClose,
  onSaved,
}: Props) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState<BrokerLoanOfficerFormState>(
    INITIAL_BROKER_LOAN_OFFICER_FORM,
  );
  const [errors, setErrors] = useState<BrokerLoanOfficerFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [coBrokers, setCoBrokers] = useState<BrokerTeamMember[]>([]);
  const [loadingCoBrokers, setLoadingCoBrokers] = useState(false);

  useEffect(() => {
    if (!isOpen || !brokerId) return;

    let cancelled = false;

    (async () => {
      try {
        setLoadingCoBrokers(true);
        const json = await fetchBrokerSubBrokers(brokerId, 1, "", 100);
        if (!cancelled) setCoBrokers(json.data || []);
      } catch {
        if (!cancelled) setCoBrokers([]);
      } finally {
        if (!cancelled) setLoadingCoBrokers(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [brokerId, isOpen]);

  const coBrokerOptions = coBrokers.map((broker) => ({
    value: broker.id,
    text:
      `${broker.firstName || ""} ${broker.lastName || ""}`.trim() ||
      broker.email ||
      broker.id,
  }));

  useEffect(() => {
    if (!isOpen) return;

    setErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);

    if (!isEdit || !officerId) {
      setForm(INITIAL_BROKER_LOAN_OFFICER_FORM);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const json = await fetchBrokerLoanOfficerDetail(brokerId, officerId);
        if (cancelled) return;

        const mapped = mapDetailToBrokerLoanOfficerForm(
          json.data as BrokerLoanOfficerDetail,
        );
        if (mapped.avatarPreview && !mapped.avatarPreview.startsWith("http")) {
          mapped.avatarPreview = `${ADMIN_API_BASE}${mapped.avatarPreview}`;
        }
        setForm(mapped);
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : "Failed to load loan officer",
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
  }, [brokerId, isEdit, isOpen, officerId, onClose]);

  const updateField = <K extends keyof BrokerLoanOfficerFormState>(
    key: K,
    value: BrokerLoanOfficerFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const validationErrors = validateBrokerLoanOfficerForm(form, { isEdit });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      const firstKey = (
        Object.keys(validationErrors) as (keyof typeof validationErrors)[]
      )[0];
      toast.error(`${validationErrors[firstKey]}`);
      return;
    }

    setSaving(true);
    try {
      const formData = buildBrokerLoanOfficerFormData(form);

      if (isEdit) {
        if (!officerId) throw new Error("Missing loan officer id");
        await updateBrokerLoanOfficer(brokerId, officerId, formData);
      } else {
        await createBrokerLoanOfficer(brokerId, formData);
      }

      toast.success(
        isEdit
          ? "Loan officer updated successfully"
          : "Loan officer created successfully",
      );
      await onSaved();
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Something went wrong",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm dark:bg-black/70">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-4 dark:border-gray-800">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {isEdit ? "Edit Loan Officer" : "Create Loan Officer"}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Loan Officer Info
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#13538A]" />
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
              <section className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Email" required error={errors.email}>
                    <input
                      type="email"
                      className={`${inputClass} ${isEdit ? "cursor-not-allowed opacity-70" : ""}`}
                      value={form.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      placeholder="officer@company.com"
                      disabled={isEdit}
                    />
                  </FormField>

                  {!isEdit ? (
                    <FormField
                      label="Confirm Email"
                      required
                      error={errors.confirmEmail}
                    >
                      <input
                        type="email"
                        className={inputClass}
                        value={form.confirmEmail}
                        onChange={(e) =>
                          updateField("confirmEmail", e.target.value)
                        }
                        placeholder="officer@company.com"
                      />
                    </FormField>
                  ) : null}

                  <FormField
                    label="First Name"
                    required
                    error={errors.firstName}
                  >
                    <input
                      className={inputClass}
                      value={form.firstName}
                      onChange={(e) => updateField("firstName", e.target.value)}
                      placeholder="John"
                    />
                  </FormField>

                  <FormField label="Last Name" required error={errors.lastName}>
                    <input
                      className={inputClass}
                      value={form.lastName}
                      onChange={(e) => updateField("lastName", e.target.value)}
                      placeholder="Doe"
                    />
                  </FormField>

                  <FormField
                    label="Company"
                    required
                    error={errors.company}
                    className="sm:col-span-2"
                  >
                    <input
                      className={inputClass}
                      value={form.company}
                      onChange={(e) => updateField("company", e.target.value)}
                      placeholder="Company Name"
                    />
                  </FormField>

                  <div className="sm:col-span-2">
                    <ToggleRow
                      label="Allowed to log in?"
                      checked={form.allowedToLogin}
                      onChange={(value) => updateField("allowedToLogin", value)}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Enable or disable login access
                    </p>
                  </div>

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

                  <FormField label="Address">
                    <input
                      className={inputClass}
                      value={form.address}
                      onChange={(e) => updateField("address", e.target.value)}
                      placeholder="123 Main St"
                    />
                  </FormField>

                  <FormField label="Suite">
                    <input
                      className={inputClass}
                      value={form.suite}
                      onChange={(e) => updateField("suite", e.target.value)}
                      placeholder="Suite / Unit"
                    />
                  </FormField>

                  <FormField label="City">
                    <input
                      className={inputClass}
                      value={form.city}
                      onChange={(e) => updateField("city", e.target.value)}
                      placeholder="City"
                    />
                  </FormField>

                  <FormField label="State">
                    <select
                      className={inputClass}
                      value={form.state}
                      onChange={(e) => updateField("state", e.target.value)}
                    >
                      <option value="">Select state</option>
                      {STATE_OPTIONS.map((state) => (
                        <option key={state.value} value={state.value}>
                          {state.text}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="ZIP Code">
                    <input
                      className={inputClass}
                      value={form.zipCode}
                      onChange={(e) =>
                        updateField(
                          "zipCode",
                          e.target.value.replace(/\D/g, "").slice(0, 9),
                        )
                      }
                      placeholder="12345"
                    />
                  </FormField>

                  <FormField label="Service Provider">
                    <select
                      className={inputClass}
                      value={form.serviceProvider}
                      onChange={(e) =>
                        updateField("serviceProvider", e.target.value)
                      }
                    >
                      {LO_SERVICE_PROVIDERS.map((provider) => (
                        <option key={provider} value={provider}>
                          {provider}
                        </option>
                      ))}
                    </select>
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
                      placeholder="(800) 123-4567"
                    />
                  </FormField>

                  <FormField label="Toll Free Ext">
                    <input
                      className={inputClass}
                      value={form.tollFreeExt}
                      onChange={(e) =>
                        updateField(
                          "tollFreeExt",
                          e.target.value.replace(/\D/g, "").slice(0, 10),
                        )
                      }
                      placeholder="Ext"
                    />
                  </FormField>

                  <FormField label="License #">
                    <input
                      className={inputClass}
                      value={form.licenseNumber}
                      onChange={(e) =>
                        updateField("licenseNumber", e.target.value)
                      }
                      placeholder="License Number"
                    />
                  </FormField>

                  <FormField label="EIN #">
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
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Uploads
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Avatar">
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-950">
                      {form.avatarPreview ? (
                        <img
                          src={form.avatarPreview}
                          alt="Avatar preview"
                          className="h-16 w-16 rounded-full object-cover"
                        />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {form.avatarFile?.name ||
                        (form.avatarPreview
                          ? "Change Avatar"
                          : "Upload Avatar")}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          updateField("avatarFile", file);
                          if (file) {
                            updateField(
                              "avatarPreview",
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
                  Business Details
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Approved Finders Fee (Percentage of the Total Commission)">
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

                  <MultiSelect
                    label="States Authorized to Originate"
                    options={STATE_OPTIONS}
                    value={form.statesAuthorized}
                    onChange={(value) => updateField("statesAuthorized", value)}
                    placeholder="Select states"
                  />

                  <FormField label="DRE#">
                    <input
                      className={inputClass}
                      value={form.dre}
                      onChange={(e) => updateField("dre", e.target.value)}
                      placeholder="DRE Number"
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
                        placeholder="Company NMLS Number"
                      />
                    </FormField>
                  ) : null}

                  <ToggleRow
                    label="Do you have Personal NMLS #?"
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
                        placeholder="Personal NMLS Number"
                      />
                    </FormField>
                  ) : null}

                  <ToggleRow
                    label="Do you have Company State License #?"
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
                          placeholder="License Number"
                        />
                      </FormField>
                    </div>
                  ) : null}

                  <ToggleRow
                    label="Do you have Personal State License #?"
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
                          placeholder="License Number"
                        />
                      </FormField>
                    </div>
                  ) : null}
                </div>
              </section>

              {form.allowedToLogin ? (
                <section className="space-y-4">
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
                </section>
              ) : null}

              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Assignments
                </h3>

                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  Assigned to Branch(s): No branches available. Please create a
                  branch first.
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                    You need to link this Loan Officer to at least 1 branch once
                    branches are configured.
                  </p>
                </div>

                <div>
                  <MultiSelect
                    label="Assigned Co-Broker(s)"
                    options={coBrokerOptions}
                    value={form.assignedCoBrokerIds}
                    onChange={(value) =>
                      updateField("assignedCoBrokerIds", value)
                    }
                    placeholder={
                      loadingCoBrokers
                        ? "Loading co-brokers..."
                        : coBrokerOptions.length
                          ? "Select co-brokers"
                          : "No co-brokers found"
                    }
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {coBrokerOptions.length
                      ? "Link co-brokers who work with this loan officer. Applications assigned to those co-brokers can auto-assign this officer."
                      : "Create co-brokers under this broker organization to assign them here."}
                  </p>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  User Permissions
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Choose exactly what this loan officer can access. Permissions
                  are grouped by category so you can grant the smallest level of
                  access needed.
                </p>
                <LoanOfficerPermissionsPanel
                  value={form.permissions}
                  onChange={(permissions) =>
                    updateField("permissions", permissions)
                  }
                  error={errors.permissions}
                  disabled={saving}
                />
              </section>
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
                {isEdit ? "Update Loan Officer" : "Create Loan Officer"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
