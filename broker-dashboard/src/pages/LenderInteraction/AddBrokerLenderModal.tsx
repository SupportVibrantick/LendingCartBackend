import {
  Building2,
  Globe,
  Handshake,
  Loader2,
  Mail,
  Phone,
  StickyNote,
  User,
  X,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import {
  checkBrokerLenderDuplicate,
  inviteLender,
  submitBrokerLender,
  type DuplicateLenderMatch,
  type SubmitBrokerLenderPayload,
} from "../../lib/lenderMarketplaceApi";

const BRAND = "#2C92D5";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

type FormState = {
  companyName: string;
  businessEmail: string;
  contactPerson: string;
  phone: string;
  website: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  companyName: "",
  businessEmail: "",
  contactPerson: "",
  phone: "",
  website: "",
  notes: "",
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
};

export default function AddBrokerLenderModal({
  open,
  onClose,
  onSubmitted,
}: Props) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>(
    {},
  );
  const [submitting, setSubmitting] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [duplicate, setDuplicate] = useState<DuplicateLenderMatch | null>(null);
  const [connecting, setConnecting] = useState(false);

  if (!open) return null;

  function resetAndClose() {
    setForm(EMPTY_FORM);
    setErrors({});
    setDuplicate(null);
    onClose();
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.companyName.trim()) next.companyName = "Company name is required";
    if (!form.businessEmail.trim()) {
      next.businessEmail = "Business email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.businessEmail.trim())) {
      next.businessEmail = "Enter a valid email";
    }
    if (!form.contactPerson.trim()) {
      next.contactPerson = "Contact person is required";
    }
    const digits = form.phone.replace(/\D/g, "");
    if (!digits) next.phone = "Phone is required";
    else if (digits.length < 10) next.phone = "Enter at least 10 digits";

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function toPayload(): SubmitBrokerLenderPayload {
    return {
      companyName: form.companyName.trim(),
      businessEmail: form.businessEmail.trim(),
      contactPerson: form.contactPerson.trim(),
      phone: form.phone.trim(),
      ...(form.website.trim() ? { website: form.website.trim() } : {}),
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    };
  }

  async function runDuplicateCheck(payload: SubmitBrokerLenderPayload) {
    setCheckingDuplicate(true);
    try {
      const result = await checkBrokerLenderDuplicate(payload);
      if (result.duplicate && result.lender) {
        setDuplicate(result.lender);
        return true;
      }
      setDuplicate(null);
      return false;
    } catch (err: any) {
      toast.error(err.message || "Duplicate check failed");
      return null;
    } finally {
      setCheckingDuplicate(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const payload = toPayload();
    setSubmitting(true);
    try {
      const isDuplicate = await runDuplicateCheck(payload);
      if (isDuplicate === null) return;
      if (isDuplicate) return;

      await submitBrokerLender(payload);
      toast.success("Invitation sent to lender");
      onSubmitted();
      resetAndClose();
    } catch (err: any) {
      if (err.code === "DUPLICATE" && err.duplicate?.lender) {
        setDuplicate(err.duplicate.lender);
        return;
      }
      toast.error(err.message || "Failed to submit lender");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConnectExisting() {
    if (!duplicate?.id) return;
    setConnecting(true);
    try {
      await inviteLender(duplicate.id);
      toast.success(
        duplicate.isConnected
          ? "Already connected to this lender"
          : "Connection request sent",
      );
      onSubmitted();
      resetAndClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to connect");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={resetAndClose}
      />
      <div className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header — solid bg so dashboard header never bleeds through */}
        <div className="relative shrink-0 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={resetAndClose}
            className="absolute right-3 top-3 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-3 pr-10">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
              style={{ backgroundColor: BRAND }}
            >
              <Building2 size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Add Your Own Lender
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Submit basic details — we&apos;ll invite them to complete their
                profile.
              </p>
            </div>
          </div>
        </div>

        {/* Body — no scroll; compact spacing keeps everything visible */}
        <div className="overflow-hidden">
          {duplicate ? (
            <div className="space-y-4 px-5 py-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 dark:border-amber-500/30 dark:bg-amber-500/10">
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  This lender already exists.
                </p>
                <p className="mt-1 text-sm text-amber-800/80 dark:text-amber-300/80">
                  No new organization will be created. Connect to this lender
                  instead.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DuplicateDetail
                  icon={<Building2 size={15} />}
                  label="Company"
                  value={duplicate.name}
                />
                <DuplicateDetail
                  icon={<span className="h-2 w-2 rounded-full bg-emerald-500" />}
                  label="Status"
                  value={duplicate.status?.toLowerCase() || "active"}
                  capitalize
                />
                {duplicate.email && (
                  <DuplicateDetail
                    icon={<Mail size={15} />}
                    label="Email"
                    value={duplicate.email}
                  />
                )}
                {duplicate.phone && (
                  <DuplicateDetail
                    icon={<Phone size={15} />}
                    label="Phone"
                    value={duplicate.phone}
                  />
                )}
                {duplicate.website && (
                  <DuplicateDetail
                    icon={<Globe size={15} />}
                    label="Website"
                    value={duplicate.website}
                    className="sm:col-span-2"
                  />
                )}
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 dark:border-slate-800 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setDuplicate(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Back to form
                </button>
                <button
                  type="button"
                  onClick={handleConnectExisting}
                  disabled={connecting || duplicate.isConnected}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: BRAND }}
                >
                  {connecting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Handshake size={16} />
                  )}
                  {duplicate.isConnected ? "Already Connected" : "Connect"}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 px-5 py-4">
                <FormSection title="Company Information" icon={<Building2 size={14} />}>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field
                    label="Company Name"
                    required
                    error={errors.companyName}
                    className="sm:col-span-2"
                  >
                    <input
                      className={inputClass}
                      value={form.companyName}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, companyName: e.target.value }))
                      }
                      placeholder="Acme Capital LLC"
                    />
                  </Field>

                  <Field
                    label="Business Email"
                    required
                    error={errors.businessEmail}
                  >
                    <div className="relative">
                      <Mail
                        size={16}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="email"
                        className={`${inputClass} pl-10`}
                        value={form.businessEmail}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            businessEmail: e.target.value,
                          }))
                        }
                        placeholder="lending@acmecapital.com"
                      />
                    </div>
                  </Field>

                  <Field label="Website" hint="Optional">
                    <div className="relative">
                      <Globe
                        size={16}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        className={`${inputClass} pl-10`}
                        value={form.website}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, website: e.target.value }))
                        }
                        placeholder="acmecapital.com"
                      />
                    </div>
                  </Field>
                </div>
              </FormSection>

              <FormSection title="Primary Contact" icon={<User size={14} />}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field
                    label="Contact Person"
                    required
                    error={errors.contactPerson}
                  >
                    <div className="relative">
                      <User
                        size={16}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        className={`${inputClass} pl-10`}
                        value={form.contactPerson}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            contactPerson: e.target.value,
                          }))
                        }
                        placeholder="Jane Smith"
                      />
                    </div>
                  </Field>

                  <Field label="Phone" required error={errors.phone}>
                    <div className="relative">
                      <Phone
                        size={16}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="tel"
                        className={`${inputClass} pl-10`}
                        value={form.phone}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, phone: e.target.value }))
                        }
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </Field>
                </div>
              </FormSection>

              <FormSection title="Additional Notes" icon={<StickyNote size={14} />}>
                <Field label="Notes" hint="Optional">
                  <textarea
                    className={`${inputClass} min-h-[56px] resize-none`}
                    value={form.notes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, notes: e.target.value }))
                    }
                    placeholder="Any context for the lender..."
                    rows={2}
                  />
                </Field>
              </FormSection>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/80 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-900/80 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={resetAndClose}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || checkingDuplicate}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60 hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: BRAND }}
                >
                  {submitting || checkingDuplicate ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Mail size={16} />
                  )}
                  {submitting
                    ? "Sending invite..."
                    : checkingDuplicate
                      ? "Checking..."
                      : "Submit & Send Invite"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function FormSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2">
        <span className="text-slate-400">{icon}</span>
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </h3>
        <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
      </div>
      {children}
    </section>
  );
}

function DuplicateDetail({
  icon,
  label,
  value,
  capitalize,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  capitalize?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60 ${className}`}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {icon}
        {label}
      </div>
      <p
        className={`mt-1 text-sm font-semibold text-slate-900 dark:text-white break-words ${capitalize ? "capitalize" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
        {required && <span className="text-red-500">*</span>}
        {hint && !required && (
          <span className="text-xs font-normal text-slate-400">({hint})</span>
        )}
      </span>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </label>
  );
}
