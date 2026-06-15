import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, User, X } from "lucide-react";
import toast from "react-hot-toast";
import { ADMIN_API_BASE } from "../../lib/adminApi";
import {
  buildBrokerLoanOfficerFormData,
  formatLoPhone,
  formatLoZip,
  INITIAL_BROKER_LOAN_OFFICER_FORM,
  isLoDigitField,
  LO_AGENT_TYPES,
  LO_PREFERRED_COMM_OPTIONS,
  LO_SERVICE_PROVIDERS,
  LO_US_STATES,
  stripLoWebsitePrefix,
  validateBrokerLoanOfficerForm,
  type BrokerLoanOfficerFormErrors,
  type BrokerLoanOfficerFormState,
} from "../../lib/brokerLoanOfficerForm";
import {
  createBrokerLoanOfficer,
  fetchBrokerLoanOfficerDetail,
  updateBrokerLoanOfficer,
} from "../../lib/brokerDetailApi";

type Props = {
  isOpen: boolean;
  mode: "create" | "edit";
  brokerId: string;
  officerId?: string | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

function fieldClass(hasError?: boolean) {
  return `w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none dark:bg-slate-900 ${
    hasError
      ? "border-red-400 focus:border-red-500 dark:border-red-500"
      : "border-slate-200 focus:border-[#13538A] dark:border-slate-700"
  }`;
}

function FormField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {children}
      {error ? <p className="mt-1 text-[10px] font-medium text-red-600">{error}</p> : null}
    </label>
  );
}

function SectionTitle({ label, accent }: { label: string; accent: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <div className={`h-5 w-1 rounded-full ${accent}`} />
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</h4>
    </div>
  );
}

export default function BrokerLoanOfficerModal({
  isOpen,
  mode,
  brokerId,
  officerId,
  onClose,
  onSaved,
}: Props) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState<BrokerLoanOfficerFormState>(INITIAL_BROKER_LOAN_OFFICER_FORM);
  const [errors, setErrors] = useState<BrokerLoanOfficerFormErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isOpen) return;

    setErrors({});
    setFormError("");
    setShowPassword({});

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

        const officer = json.data;
        const profile = officer.profile;

        setForm({
          ...INITIAL_BROKER_LOAN_OFFICER_FORM,
          firstName: officer.firstName || "",
          lastName: officer.lastName || "",
          email: officer.email || "",
          confirmEmail: officer.email || "",
          phone: officer.phone || "",
          licenseNumber: profile?.licenseNumber || "",
          agentType: profile?.agentType || "Loan Officer",
          company: profile?.company || "",
          serviceProvider: profile?.serviceProvider || "Internal",
          tollFree: profile?.tollFree || "",
          tollFreeExt: profile?.tollFreeExt || "",
          address: profile?.address || "",
          suite: profile?.suite || "",
          city: profile?.city || "",
          state: profile?.state || "",
          zipCode: profile?.zipCode || "",
          preferredComm: profile?.preferredComm || "EMAIL",
          website: stripLoWebsitePrefix(profile?.website),
          allowedToLogin: officer.status === "ACTIVE",
          avatarPreview: profile?.avatarUrl ? `${ADMIN_API_BASE}${profile.avatarUrl}` : "",
        });
      } catch (err: any) {
        if (!cancelled) {
          toast.error(err.message || "Failed to load loan officer");
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
    let nextValue = value;

    if (typeof value === "string" && isLoDigitField(key)) {
      nextValue = value.replace(/\D/g, "") as BrokerLoanOfficerFormState[K];
    }

    setForm((prev) => ({ ...prev, [key]: nextValue }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setFormError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validateBrokerLoanOfficerForm(form, isEdit);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setFormError("Please fix the highlighted fields.");
      return;
    }

    try {
      setSaving(true);
      setFormError("");

      const formData = buildBrokerLoanOfficerFormData(form, isEdit);

      if (isEdit && officerId) {
        await updateBrokerLoanOfficer(brokerId, officerId, formData);
        toast.success("Loan officer updated");
      } else {
        await createBrokerLoanOfficer(brokerId, formData);
        toast.success("Loan officer created");
      }

      onClose();
      await onSaved();
    } catch (err: any) {
      setFormError(err.message || "Failed to save loan officer");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="h-1 bg-gradient-to-r from-[#13538A] via-[#18B6B4] to-emerald-400 opacity-80" />
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {isEdit ? "Edit Loan Officer" : "Create Loan Officer"}
            </h3>
            <p className="text-[10px] text-slate-500">
              Fill in the details to register a new officer in the system.
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
          <div className="flex flex-1 items-center justify-center py-16 text-xs text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading loan officer...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
              <div className="text-center">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Profile picture
                </p>
                <div className="mx-auto mb-2 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                  {form.avatarPreview ? (
                    <img src={form.avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-8 w-8 text-slate-400" />
                  )}
                </div>
                <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">
                  Change photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 2 * 1024 * 1024) {
                        setFormError("Image must be under 2MB");
                        return;
                      }
                      if (!file.type.startsWith("image/")) {
                        setFormError("Only image files allowed");
                        return;
                      }
                      updateField("avatarFile", file);
                      updateField("avatarPreview", URL.createObjectURL(file));
                    }}
                  />
                </label>
                <p className="mt-1 text-[9px] text-slate-400">JPG, GIF or PNG. Max size 2MB.</p>
              </div>

              <SectionTitle label="Basic information" accent="bg-[#13538A]" />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField label="First name" required error={errors.firstName}>
                  <input
                    value={form.firstName}
                    onChange={(e) => updateField("firstName", e.target.value)}
                    placeholder="Jane"
                    className={fieldClass(Boolean(errors.firstName))}
                  />
                </FormField>
                <FormField label="Last name" required error={errors.lastName}>
                  <input
                    value={form.lastName}
                    onChange={(e) => updateField("lastName", e.target.value)}
                    placeholder="Doe"
                    className={fieldClass(Boolean(errors.lastName))}
                  />
                </FormField>
                <FormField label="Email" required error={errors.email}>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    disabled={isEdit}
                    className={`${fieldClass(Boolean(errors.email))} ${isEdit ? "opacity-60" : ""}`}
                  />
                </FormField>
                <FormField label="Confirm email" required error={errors.confirmEmail}>
                  <input
                    type="email"
                    value={form.confirmEmail}
                    onChange={(e) => updateField("confirmEmail", e.target.value)}
                    disabled={isEdit}
                    className={`${fieldClass(Boolean(errors.confirmEmail))} ${isEdit ? "opacity-60" : ""}`}
                  />
                </FormField>

                {!isEdit ? (
                  <>
                    <FormField label="Password" required error={errors.password}>
                      <div className="relative">
                        <input
                          type={showPassword.password ? "text" : "password"}
                          value={form.password}
                          onChange={(e) => updateField("password", e.target.value)}
                          className={`${fieldClass(Boolean(errors.password))} pr-9`}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowPassword((prev) => ({ ...prev, password: !prev.password }))
                          }
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
                        >
                          {showPassword.password ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </FormField>
                    <FormField label="Confirm password" required error={errors.confirmPassword}>
                      <div className="relative">
                        <input
                          type={showPassword.confirmPassword ? "text" : "password"}
                          value={form.confirmPassword}
                          onChange={(e) => updateField("confirmPassword", e.target.value)}
                          className={`${fieldClass(Boolean(errors.confirmPassword))} pr-9`}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowPassword((prev) => ({
                              ...prev,
                              confirmPassword: !prev.confirmPassword,
                            }))
                          }
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
                        >
                          {showPassword.confirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </FormField>
                  </>
                ) : null}

                <FormField label="Phone" required error={errors.phone}>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={formatLoPhone(form.phone)}
                    onChange={(e) => updateField("phone", e.target.value)}
                    placeholder="123-456-7890"
                    className={fieldClass(Boolean(errors.phone))}
                  />
                </FormField>
                <FormField label="License number" required error={errors.licenseNumber}>
                  <input
                    value={form.licenseNumber}
                    onChange={(e) => updateField("licenseNumber", e.target.value)}
                    className={fieldClass(Boolean(errors.licenseNumber))}
                  />
                </FormField>
                <FormField label="Agent type" required error={errors.agentType}>
                  <select
                    value={form.agentType}
                    disabled
                    className={`${fieldClass(Boolean(errors.agentType))} cursor-not-allowed opacity-70`}
                  >
                    {LO_AGENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              <SectionTitle label="Company details" accent="bg-emerald-500" />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <FormField label="Company" required error={errors.company}>
                    <input
                      value={form.company}
                      onChange={(e) => updateField("company", e.target.value)}
                      className={fieldClass(Boolean(errors.company))}
                    />
                  </FormField>
                </div>
                <FormField label="Service provider" required error={errors.serviceProvider}>
                  <select
                    value={form.serviceProvider}
                    onChange={(e) => updateField("serviceProvider", e.target.value)}
                    className={fieldClass(Boolean(errors.serviceProvider))}
                  >
                    <option value="">Select</option>
                    {LO_SERVICE_PROVIDERS.map((provider) => (
                      <option key={provider} value={provider}>
                        {provider}
                      </option>
                    ))}
                  </select>
                </FormField>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <FormField label="Toll free" required error={errors.tollFree}>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={formatLoPhone(form.tollFree)}
                        onChange={(e) => updateField("tollFree", e.target.value)}
                        className={fieldClass(Boolean(errors.tollFree))}
                      />
                    </FormField>
                  </div>
                  <FormField label="Ext" required error={errors.tollFreeExt}>
                    <input
                      inputMode="numeric"
                      value={form.tollFreeExt}
                      onChange={(e) => updateField("tollFreeExt", e.target.value)}
                      className={fieldClass(Boolean(errors.tollFreeExt))}
                    />
                  </FormField>
                </div>
                <div className="sm:col-span-2">
                  <FormField label="Address" required error={errors.address}>
                    <input
                      value={form.address}
                      onChange={(e) => updateField("address", e.target.value)}
                      className={fieldClass(Boolean(errors.address))}
                    />
                  </FormField>
                </div>
                <FormField label="Suite" required error={errors.suite}>
                  <input
                    value={form.suite}
                    onChange={(e) => updateField("suite", e.target.value)}
                    className={fieldClass(Boolean(errors.suite))}
                  />
                </FormField>
                <FormField label="City" required error={errors.city}>
                  <input
                    value={form.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    className={fieldClass(Boolean(errors.city))}
                  />
                </FormField>
                <FormField label="State" required error={errors.state}>
                  <select
                    value={form.state}
                    onChange={(e) => updateField("state", e.target.value)}
                    className={fieldClass(Boolean(errors.state))}
                  >
                    <option value="">Select state</option>
                    {LO_US_STATES.map((state) => (
                      <option key={state.code} value={state.code}>
                        {state.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Zip code" required error={errors.zipCode}>
                  <input
                    inputMode="numeric"
                    value={formatLoZip(form.zipCode)}
                    onChange={(e) => updateField("zipCode", e.target.value)}
                    className={fieldClass(Boolean(errors.zipCode))}
                  />
                </FormField>
                <FormField label="Preferred communication" required error={errors.preferredComm}>
                  <select
                    value={form.preferredComm}
                    onChange={(e) => updateField("preferredComm", e.target.value)}
                    className={fieldClass(Boolean(errors.preferredComm))}
                  >
                    {LO_PREFERRED_COMM_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FormField>
                <div className="sm:col-span-2">
                  <FormField label="Website" required error={errors.website}>
                    <div className="flex">
                      <span className="inline-flex items-center rounded-l-lg border border-r-0 border-slate-200 bg-slate-100 px-2.5 text-[10px] text-slate-500 dark:border-slate-700 dark:bg-slate-800">
                        https://www.
                      </span>
                      <input
                        value={form.website}
                        onChange={(e) => updateField("website", e.target.value)}
                        placeholder="example.com"
                        className={`${fieldClass(Boolean(errors.website))} rounded-l-none`}
                      />
                    </div>
                  </FormField>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center gap-2 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.allowedToLogin}
                    onChange={(e) => updateField("allowedToLogin", e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#13538A] focus:ring-[#13538A]"
                  />
                  Allow user to login
                </label>
                <div className="flex flex-col items-stretch gap-2 sm:items-end">
                  {formError ? (
                    <p className="text-right text-[11px] font-medium text-red-600 dark:text-red-400">
                      {formError}
                    </p>
                  ) : null}
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-lg bg-[#13538A] px-4 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60"
                    >
                      {saving ? "Saving..." : isEdit ? "Save changes" : "Create officer"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
