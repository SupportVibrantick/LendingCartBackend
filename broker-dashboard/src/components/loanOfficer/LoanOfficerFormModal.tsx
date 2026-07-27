import { Eye, EyeOff, Loader2, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import MultiSelect from "../form/MultiSelect";
import {
  buildLoanOfficerFormData,
  FIELD_CONSTRAINTS,
  FINDERS_FEE_OPTIONS,
  formatPhone,
  INITIAL_LOAN_OFFICER_FORM,
  mapDetailToLoanOfficerForm,
  PERMISSION_LEVEL_OPTIONS,
  PREFERRED_COMMUNICATION,
  STATE_OPTIONS,
  validateField,
  validateLoanOfficerForm,
  fetchLoanOfficerCoBrokers,
  type FieldConstraint,
  type LoanOfficerCoBroker,
  type LoanOfficerDetail,
  type LoanOfficerFormErrors,
  type LoanOfficerFormState,
} from "../../lib/loanOfficerForm";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-[#13538A]/40 focus:bg-white focus:ring-2 focus:ring-[#13538A]/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100";

const inputErrorClass =
  "w-full rounded-xl border border-red-400 bg-red-50 px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-500/10 dark:border-red-500/60 dark:bg-red-950/30 dark:text-gray-100";

const labelClass =
  "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

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

type TextFieldProps = {
  label: string;
  required?: boolean;
  error?: string;
  constraint?: FieldConstraint;
  hint?: string;
  inputProps: React.InputHTMLAttributes<HTMLInputElement> & {
    ref?: React.Ref<HTMLInputElement>;
  };
};

function TextField({
  label,
  required,
  error,
  constraint,
  hint,
  inputProps,
}: TextFieldProps) {
  const { onChange, onBlur, value, className, ...rest } = inputProps;
  const currentLength = typeof value === "string" ? value.length : 0;
  const showCounter = !!constraint;
  const hasError = !!error;

  return (
    <div className="flex flex-col">
      <label className={labelClass}>
        {label}
        {required && <span className="text-red-500"> *</span>}
        {hint ? (
          <span className="ml-1 text-xs font-normal text-gray-500">
            — {hint}
          </span>
        ) : null}
      </label>

      <input
        {...rest}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        minLength={constraint?.minLength}
        maxLength={constraint?.maxLength}
        aria-invalid={hasError || undefined}
        className={`${hasError ? inputErrorClass : inputClass} ${className || ""}`}
      />

      <div className="mt-1 flex items-start justify-between gap-2">
        <div className="flex-1">
          {error && (
            <p role="alert" className="text-xs font-medium text-red-500">
              {error}
            </p>
          )}
        </div>
        {showCounter ? (
          <span
            className={`shrink-0 text-[11px] ${
              hasError
                ? "font-medium text-red-500"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            {currentLength}
            {constraint?.maxLength ? `/${constraint.maxLength}` : ""}
          </span>
        ) : null}
      </div>
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
    <div className={`flex flex-col ${className}`}>
      <label className={labelClass}>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>

      {children}

      {error && (
        <p role="alert" className="mt-1 text-xs font-medium text-red-500">
          {error}
        </p>
      )}
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
  const [form, setForm] = useState<LoanOfficerFormState>(
    INITIAL_LOAN_OFFICER_FORM,
  );
  const [errors, setErrors] = useState<LoanOfficerFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [coBrokers, setCoBrokers] = useState<LoanOfficerCoBroker[]>([]);
  const [loadingCoBrokers, setLoadingCoBrokers] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    (async () => {
      try {
        setLoadingCoBrokers(true);
        const options = await fetchLoanOfficerCoBrokers();
        if (!cancelled) setCoBrokers(options);
      } catch {
        if (!cancelled) setCoBrokers([]);
      } finally {
        if (!cancelled) setLoadingCoBrokers(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

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

  // Validate a single field on blur so the user gets immediate, field-level
  // feedback while filling the form (in addition to the submit-time pass).
  const handleBlur = (key: keyof LoanOfficerFormState) => () => {
    setForm((current) => {
      const error = validateField(key, current, { isEdit });
      setErrors((prev) => {
        const next = { ...prev };
        if (error) next[key] = error;
        else delete next[key];
        return next;
      });
      return current;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const validationErrors = validateLoanOfficerForm(form, { isEdit });
    setErrors(validationErrors);

    const firstError = Object.values(validationErrors)[0];

    if (firstError) {
      toast.error(firstError);
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
        isEdit
          ? "Loan officer updated successfully"
          : "Loan officer created successfully",
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
          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
              <section className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TextField
                    label="Email"
                    required
                    error={errors.email}
                    constraint={FIELD_CONSTRAINTS.email}
                    hint="e.g. officer@company.com"
                    inputProps={{
                      type: "email",
                      value: form.email,
                      onChange: (e) => updateField("email", e.target.value),
                      onBlur: handleBlur("email"),
                      placeholder: "officer@company.com",
                      disabled: isEdit,
                      className: isEdit ? "cursor-not-allowed opacity-70" : "",
                    }}
                  />

                  {!isEdit ? (
                    <TextField
                      label="Confirm Email"
                      required
                      error={errors.confirmEmail}
                      constraint={FIELD_CONSTRAINTS.confirmEmail}
                      hint="must match the email above"
                      inputProps={{
                        type: "email",
                        value: form.confirmEmail,
                        onChange: (e) =>
                          updateField("confirmEmail", e.target.value),
                        onBlur: handleBlur("confirmEmail"),
                        placeholder: "officer@company.com",
                      }}
                    />
                  ) : null}

                  <TextField
                    label="First Name"
                    required
                    error={errors.firstName}
                    constraint={FIELD_CONSTRAINTS.firstName}
                    inputProps={{
                      value: form.firstName,
                      onChange: (e) => updateField("firstName", e.target.value),
                      onBlur: handleBlur("firstName"),
                      placeholder: "John",
                    }}
                  />

                  <TextField
                    label="Last Name"
                    required
                    error={errors.lastName}
                    constraint={FIELD_CONSTRAINTS.lastName}
                    inputProps={{
                      value: form.lastName,
                      onChange: (e) => updateField("lastName", e.target.value),
                      onBlur: handleBlur("lastName"),
                      placeholder: "Doe",
                    }}
                  />

                  <div className="sm:col-span-2">
                    <TextField
                      label="Company"
                      required
                      error={errors.company}
                      constraint={FIELD_CONSTRAINTS.company}
                      inputProps={{
                        value: form.company,
                        onChange: (e) => updateField("company", e.target.value),
                        onBlur: handleBlur("company"),
                        placeholder: "Acme Lending, LLC",
                      }}
                    />
                  </div>

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
                      type="tel"
                      inputMode="numeric"
                      className={errors.phone ? inputErrorClass : inputClass}
                      value={formatPhone(form.phone)}
                      onChange={(e) =>
                        updateField(
                          "phone",
                          e.target.value.replace(/\D/g, "").slice(0, 10),
                        )
                      }
                      onBlur={handleBlur("phone")}
                      placeholder="(555) 123-4567"
                      maxLength={14}
                    />
                    <div className="mt-1 flex justify-end">
                      <span
                        className={`text-[11px] ${
                          errors.phone
                            ? "font-medium text-red-500"
                            : "text-gray-500 dark:text-gray-400"
                        }`}
                      >
                        {form.phone.length}/10
                      </span>
                    </div>
                  </FormField>

                  <TextField
                    label="Address"
                    error={errors.address}
                    constraint={FIELD_CONSTRAINTS.address}
                    inputProps={{
                      value: form.address,
                      onChange: (e) => updateField("address", e.target.value),
                      onBlur: handleBlur("address"),
                      placeholder:
                        "123 Main St, Suite 100, Los Angeles, CA 90001",
                    }}
                  />

                  <TextField
                    label="License #"
                    error={errors.licenseNumber}
                    constraint={FIELD_CONSTRAINTS.licenseNumber}
                    inputProps={{
                      value: form.licenseNumber,
                      onChange: (e) =>
                        updateField("licenseNumber", e.target.value),
                      onBlur: handleBlur("licenseNumber"),
                      placeholder: "e.g. CA-1234567",
                    }}
                  />

                  <TextField
                    label="EIN #"
                    error={errors.ein}
                    constraint={FIELD_CONSTRAINTS.ein}
                    hint="XX-XXXXXXX"
                    inputProps={{
                      value: form.ein,
                      onChange: (e) => updateField("ein", e.target.value),
                      onBlur: handleBlur("ein"),
                      placeholder: "12-3456789",
                    }}
                  />

                  <FormField
                    label="Preferred Communication"
                    error={errors.preferredComm}
                  >
                    <select
                      className={
                        errors.preferredComm ? inputErrorClass : inputClass
                      }
                      value={form.preferredComm}
                      onChange={(e) =>
                        updateField("preferredComm", e.target.value)
                      }
                      onBlur={
                        handleBlur(
                          "preferredComm",
                        ) as unknown as React.FocusEventHandler<HTMLSelectElement>
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

                  <div className="sm:col-span-2">
                    <TextField
                      label="Website"
                      error={errors.website}
                      constraint={FIELD_CONSTRAINTS.website}
                      hint="include https://"
                      inputProps={{
                        type: "url",
                        value: form.website,
                        onChange: (e) => updateField("website", e.target.value),
                        onBlur: handleBlur("website"),
                        placeholder: "https://www.example.com",
                      }}
                    />
                  </div>
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

                  <TextField
                    label="DRE#"
                    error={errors.dre}
                    constraint={FIELD_CONSTRAINTS.dre}
                    inputProps={{
                      value: form.dre,
                      onChange: (e) => updateField("dre", e.target.value),
                      onBlur: handleBlur("dre"),
                      placeholder: "e.g. 02101123",
                    }}
                  />
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
                    <TextField
                      label="Company NMLS #"
                      required
                      error={errors.companyNmls}
                      constraint={FIELD_CONSTRAINTS.companyNmls}
                      hint="digits only"
                      inputProps={{
                        value: form.companyNmls,
                        onChange: (e) =>
                          updateField("companyNmls", e.target.value),
                        onBlur: handleBlur("companyNmls"),
                        placeholder: "e.g. 1234567",
                        inputMode: "numeric",
                      }}
                    />
                  ) : null}

                  <ToggleRow
                    label="Do you have Personal NMLS #?"
                    checked={form.hasPersonalNmls}
                    onChange={(value) => updateField("hasPersonalNmls", value)}
                  />
                  {form.hasPersonalNmls ? (
                    <TextField
                      label="Personal NMLS #"
                      required
                      error={errors.personalNmls}
                      constraint={FIELD_CONSTRAINTS.personalNmls}
                      hint="digits only"
                      inputProps={{
                        value: form.personalNmls,
                        onChange: (e) =>
                          updateField("personalNmls", e.target.value),
                        onBlur: handleBlur("personalNmls"),
                        placeholder: "e.g. 7654321",
                        inputMode: "numeric",
                      }}
                    />
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
                      <TextField
                        label="Company State License #"
                        required
                        error={errors.companyStateLicense}
                        constraint={FIELD_CONSTRAINTS.companyStateLicense}
                        inputProps={{
                          value: form.companyStateLicense,
                          onChange: (e) =>
                            updateField("companyStateLicense", e.target.value),
                          onBlur: handleBlur("companyStateLicense"),
                          placeholder: "e.g. CFL-123456",
                        }}
                      />
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
                      <TextField
                        label="Personal State License #"
                        required
                        error={errors.personalStateLicense}
                        constraint={FIELD_CONSTRAINTS.personalStateLicense}
                        inputProps={{
                          value: form.personalStateLicense,
                          onChange: (e) =>
                            updateField("personalStateLicense", e.target.value),
                          onBlur: handleBlur("personalStateLicense"),
                          placeholder: "e.g. CFL-654321",
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              </section>

              {form.allowedToLogin ? (
                <section className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex flex-col">
                      <label className={labelClass}>
                        {isEdit ? "New Password" : "Password"}
                        {!isEdit && <span className="text-red-500"> *</span>}
                        <span className="ml-1 text-xs font-normal text-gray-500">
                          — 8–64 characters
                        </span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          className={`${errors.password ? inputErrorClass : inputClass} pr-11`}
                          value={form.password}
                          onChange={(e) =>
                            updateField("password", e.target.value)
                          }
                          onBlur={handleBlur("password")}
                          placeholder={
                            isEdit
                              ? "Leave blank to keep current"
                              : "Min. 8 characters"
                          }
                          minLength={isEdit ? undefined : 8}
                          maxLength={64}
                          autoComplete={
                            isEdit ? "new-password" : "new-password"
                          }
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                        >
                          {showPassword ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                      </div>
                      <div className="mt-1 flex items-start justify-between gap-2">
                        <div className="flex-1">
                          {errors.password && (
                            <p
                              role="alert"
                              className="text-xs font-medium text-red-500"
                            >
                              {errors.password}
                            </p>
                          )}
                        </div>
                        <span
                          className={`shrink-0 text-[11px] ${
                            errors.password
                              ? "font-medium text-red-500"
                              : "text-gray-500 dark:text-gray-400"
                          }`}
                        >
                          {form.password.length}/64
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col">
                      <label className={labelClass}>
                        Confirm Password
                        {(!isEdit || !!form.password) && (
                          <span className="text-red-500"> *</span>
                        )}
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          className={`${errors.confirmPassword ? inputErrorClass : inputClass} pr-11`}
                          value={form.confirmPassword}
                          onChange={(e) =>
                            updateField("confirmPassword", e.target.value)
                          }
                          onBlur={handleBlur("confirmPassword")}
                          placeholder="Re-enter password"
                          maxLength={64}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                          aria-label={
                            showConfirmPassword
                              ? "Hide password"
                              : "Show password"
                          }
                        >
                          {showConfirmPassword ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                      </div>
                      <div className="mt-1 flex items-start justify-between gap-2">
                        <div className="flex-1">
                          {errors.confirmPassword && (
                            <p
                              role="alert"
                              className="text-xs font-medium text-red-500"
                            >
                              {errors.confirmPassword}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
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
                      coBrokerOptions.length
                        ? "Select co-brokers"
                        : "No co-brokers found"
                    }
                    loading={loadingCoBrokers}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {coBrokerOptions.length
                      ? "Link co-brokers who work with this loan officer. Applications assigned to those co-brokers can auto-assign this officer."
                      : "Create co-brokers under your broker organization to assign them here."}
                  </p>
                </div>

                <FormField
                  label="User Permission Settings"
                  required
                  error={errors.permissionLevel}
                >
                  <select
                    className={
                      errors.permissionLevel ? inputErrorClass : inputClass
                    }
                    value={form.permissionLevel}
                    onChange={(e) =>
                      updateField(
                        "permissionLevel",
                        e.target
                          .value as LoanOfficerFormState["permissionLevel"],
                      )
                    }
                    onBlur={
                      handleBlur(
                        "permissionLevel",
                      ) as unknown as React.FocusEventHandler<HTMLSelectElement>
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
