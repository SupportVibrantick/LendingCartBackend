import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  buildBrokerSubBrokerPayload,
  formatSbPhone,
  INITIAL_BROKER_SUB_BROKER_FORM,
  validateBrokerSubBrokerForm,
  type BrokerSubBrokerFormErrors,
  type BrokerSubBrokerFormState,
} from "../../lib/brokerSubBrokerForm";
import {
  createBrokerSubBroker,
  fetchBrokerSubBrokerDetail,
  updateBrokerSubBroker,
} from "../../lib/brokerDetailApi";

type Props = {
  isOpen: boolean;
  mode: "create" | "edit";
  brokerId: string;
  subBrokerId?: string | null;
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

export default function BrokerSubBrokerModal({
  isOpen,
  mode,
  brokerId,
  subBrokerId,
  onClose,
  onSaved,
}: Props) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState<BrokerSubBrokerFormState>(INITIAL_BROKER_SUB_BROKER_FORM);
  const [errors, setErrors] = useState<BrokerSubBrokerFormErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setErrors({});
    setFormError("");
    setShowPassword(false);

    if (!isEdit || !subBrokerId) {
      setForm(INITIAL_BROKER_SUB_BROKER_FORM);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const json = await fetchBrokerSubBrokerDetail(brokerId, subBrokerId);
        if (cancelled) return;

        const sb = json.data;
        setForm({
          firstName: sb.firstName || "",
          lastName: sb.lastName || "",
          email: sb.email || "",
          password: "",
          phone: sb.phone ? formatSbPhone(sb.phone) : "",
        });
      } catch (err: any) {
        if (!cancelled) {
          toast.error(err.message || "Failed to load sub-broker");
          onClose();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [brokerId, isEdit, isOpen, subBrokerId, onClose]);

  const updateField = (key: keyof BrokerSubBrokerFormState, value: string) => {
    const nextValue = key === "phone" ? formatSbPhone(value) : value;
    setForm((prev) => ({ ...prev, [key]: nextValue }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setFormError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validateBrokerSubBrokerForm(form, { isEdit });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    try {
      setSaving(true);
      setFormError("");
      const payload = buildBrokerSubBrokerPayload(form, { isEdit });

      if (isEdit && subBrokerId) {
        await updateBrokerSubBroker(brokerId, subBrokerId, {
          firstName: payload.firstName,
          lastName: payload.lastName,
          phone: payload.phone,
        });
        toast.success("Sub-broker updated");
      } else {
        await createBrokerSubBroker(brokerId, payload);
        toast.success("Sub-broker created");
      }

      await onSaved();
      onClose();
    } catch (err: any) {
      const message = err.message || "Failed to save sub-broker";
      setFormError(message);
      if (message.toLowerCase().includes("email")) {
        setErrors((prev) => ({ ...prev, email: message }));
      }
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {isEdit ? "Edit Sub-Broker" : "Add Sub-Broker"}
            </h3>
            <p className="text-[10px] text-slate-500">
              {isEdit ? "Update sub-broker profile" : "Create a new sub-broker for this broker"}
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
          <div className="flex items-center justify-center py-16 text-xs text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
            <div className="grid grid-cols-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2">
              <FormField label="First name" required error={errors.firstName}>
                <input
                  value={form.firstName}
                  onChange={(e) => updateField("firstName", e.target.value)}
                  className={fieldClass(!!errors.firstName)}
                />
              </FormField>
              <FormField label="Last name" required error={errors.lastName}>
                <input
                  value={form.lastName}
                  onChange={(e) => updateField("lastName", e.target.value)}
                  className={fieldClass(!!errors.lastName)}
                />
              </FormField>
              <div className="sm:col-span-2">
                <FormField label="Email" required error={errors.email}>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    disabled={isEdit}
                    className={`${fieldClass(!!errors.email)} ${isEdit ? "cursor-not-allowed opacity-70" : ""}`}
                  />
                </FormField>
              </div>
              {!isEdit ? (
                <div className="sm:col-span-2">
                  <FormField label="Password" required error={errors.password}>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={form.password}
                        onChange={(e) => updateField("password", e.target.value)}
                        className={fieldClass(!!errors.password)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </FormField>
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <FormField label="Phone" required error={errors.phone}>
                  <input
                    value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    placeholder="123-456-7890"
                    className={fieldClass(!!errors.phone)}
                  />
                </FormField>
              </div>
            </div>

            <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
              {formError ? (
                <p className="mb-2 text-[11px] font-medium text-red-600">{formError}</p>
              ) : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#13538A] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#0f426d] disabled:opacity-60"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : null}
                  {isEdit ? "Save changes" : "Create sub-broker"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
