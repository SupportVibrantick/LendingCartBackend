import { Eye, EyeOff, Loader2, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import MultiSelect from "../form/MultiSelect";
import {
  buildLoanOfficerFormData,
  FINDERS_FEE_OPTIONS,
  formatPhone,
  INITIAL_LOAN_OFFICER_FORM,
  mapDetailToLoanOfficerForm,
  PERMISSION_LEVEL_OPTIONS,
  PREFERRED_COMMUNICATION,
  STATE_OPTIONS,
  validateLoanOfficerForm,
  type LoanOfficerDetail,
  type LoanOfficerFormErrors,
  type LoanOfficerFormState,
} from "../../lib/loanOfficerForm";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-[#13538A]/40 focus:bg-white focus:ring-2 focus:ring-[#13538A]/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100";

const labelClass = "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

function getAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("broker_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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
  officerId?: string | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

export default function LoanOfficerFormModal({
  isOpen,
  mode,
  officerId,
  onClose,
  onSaved,
}: Props) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState<LoanOfficerFormState>(INITIAL_LOAN_OFFICER_FORM);
  const [errors, setErrors] = useState<LoanOfficerFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);

    if (!isEdit || !officerId) {
      setForm(INITIAL_LOAN_OFFICER_FORM);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/broker/users/${officerId}`, {
          headers: getAuthHeaders(),
        });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || !json.success) {
          toast.error(json.message || "Failed to load loan officer");
          onClose();
          return;
        }

        const detail = json.data as LoanOfficerDetail;
        const mapped = mapDetailToLoanOfficerForm(detail);
        if (mapped.avatarPreview && !mapped.avatarPreview.startsWith("http")) {
          mapped.avatarPreview = `${API_BASE}${mapped.avatarPreview}`;
        }
        setForm(mapped);
      } catch {
        if (!cancelled) {
          toast.error("Failed to load loan officer");
          onClose();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isEdit, isOpen, officerId, onClose]);

  const updateField = <K extends keyof LoanOfficerFormState>(
    key: K,
    value: LoanOfficerFormState[K],
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

    const validationErrors = validateLoanOfficerForm(form, { isEdit });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      toast.error("Please fix the highlighted fields");
      return;
    }

    setSaving(true);
    try {
      const formData = buildLoanOfficerFormData(form);
      const url = isEdit
        ? `${API_BASE}/broker/users/${officerId}`
        : `${API_BASE}/broker/users`;
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: getAuthHeaders(),
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || "Failed to save loan officer");
        return;
      }

      toast.success(
        isEdit ? "Loan officer updated successfully" : "Loan officer created successfully",
      );
      await onSaved();
      onClose();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm dark:bg-black/70">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
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
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
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
                    <FormField label="Confirm Email" required error={errors.confirmEmail}>
                      <input
                        type="email"
                        className={inputClass}
                        value={form.confirmEmail}
                        onChange={(e) => updateField("confirmEmail", e.target.value)}
                        placeholder="officer@company.com"
                      />
                    </FormField>
                  ) : null}

                  <FormField label="First Name" required error={errors.firstName}>
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

                  <FormField label="Company" required error={errors.company} className="sm:col-span-2">
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
                    <p className="mt-1 text-xs text-gray-500">Enable or disable login access</p>
                  </div>

                  <FormField label="Phone Number" required error={errors.phone}>
                    <input
                      className={inputClass}
                      value={formatPhone(form.phone)}
                      onChange={(e) =>
                        updateField("phone", e.target.value.replace(/\D/g, "").slice(0, 10))
                      }
                      placeholder="(555) 123-4567"
                    />
                  </FormField>

                  <FormField label="Address">
                    <input
                      className={inputClass}
                      value={form.address}
                      onChange={(e) => updateField("address", e.target.value)}
                      placeholder="123 Main St, City, State, ZIP"
                    />
                  </FormField>

                  <FormField label="License #">
                    <input
                      className={inputClass}
                      value={form.licenseNumber}
                      onChange={(e) => updateField("licenseNumber", e.target.value)}
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
                      onChange={(e) => updateField("preferredComm", e.target.value)}
                    >
                      <option value="">Please Select Preferred Communication</option>
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
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Uploads</h3>
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
                      {form.avatarFile?.name || (form.avatarPreview ? "Change Avatar" : "Upload Avatar")}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          updateField("avatarFile", file);
                          if (file) {
                            updateField("avatarPreview", URL.createObjectURL(file));
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
                        onChange={(e) => updateField("w9File", e.target.files?.[0] || null)}
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
                      onChange={(e) => updateField("findersFee", e.target.value)}
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
                        onChange={(e) => updateField("companyNmls", e.target.value)}
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
                        onChange={(e) => updateField("personalNmls", e.target.value)}
                        placeholder="Personal NMLS Number"
                      />
                    </FormField>
                  ) : null}

                  <ToggleRow
                    label="Do you have Company State License #?"
                    checked={form.hasCompanyStateLicense}
                    onChange={(value) => updateField("hasCompanyStateLicense", value)}
                  />
                  {form.hasCompanyStateLicense ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <MultiSelect
                        label="Select States"
                        options={STATE_OPTIONS}
                        value={form.companyStateLicenseStates}
                        onChange={(value) => updateField("companyStateLicenseStates", value)}
                        placeholder="Select states"
                      />
                      <FormField label="Company State License #">
                        <input
                          className={inputClass}
                          value={form.companyStateLicense}
                          onChange={(e) => updateField("companyStateLicense", e.target.value)}
                          placeholder="License Number"
                        />
                      </FormField>
                    </div>
                  ) : null}

                  <ToggleRow
                    label="Do you have Personal State License #?"
                    checked={form.hasPersonalStateLicense}
                    onChange={(value) => updateField("hasPersonalStateLicense", value)}
                  />
                  {form.hasPersonalStateLicense ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <MultiSelect
                        label="Select States"
                        options={STATE_OPTIONS}
                        value={form.personalStateLicenseStates}
                        onChange={(value) => updateField("personalStateLicenseStates", value)}
                        placeholder="Select states"
                      />
                      <FormField label="Personal State License #">
                        <input
                          className={inputClass}
                          value={form.personalStateLicense}
                          onChange={(e) => updateField("personalStateLicense", e.target.value)}
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
                          onChange={(e) => updateField("password", e.target.value)}
                          placeholder={isEdit ? "Leave blank to keep current" : "Enter password"}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
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
                          onChange={(e) => updateField("confirmPassword", e.target.value)}
                          placeholder="Confirm password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                        >
                          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
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
                  Assigned to Branch(s): No branches available. Please create a branch first.
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                    You need to link this Loan Officer to at least 1 branch once branches are
                    configured.
                  </p>
                </div>

                <FormField
                  label="User Permission Settings"
                  required
                  error={errors.permissionLevel}
                >
                  <select
                    className={inputClass}
                    value={form.permissionLevel}
                    onChange={(e) =>
                      updateField(
                        "permissionLevel",
                        e.target.value as LoanOfficerFormState["permissionLevel"],
                      )
                    }
                  >
                    <option value="">Select permission level</option>
                    {PERMISSION_LEVEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FormField>
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
