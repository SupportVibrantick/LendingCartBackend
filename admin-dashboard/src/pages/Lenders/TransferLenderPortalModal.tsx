import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowRightLeft, Loader2, Mail, Phone, User, X } from "lucide-react";
import toast from "react-hot-toast";

type LenderContact = {
  id: string;
  name: string;
  adminFirstName?: string | null;
  adminLastName?: string | null;
  adminEmail?: string | null;
  adminPhone?: string | null;
};

type TransferLenderPortalModalProps = {
  lender: LenderContact | null;
  apiBase: string;
  onClose: () => void;
  onTransferred: () => void;
};

type TransferForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

const EMPTY_FORM: TransferForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
};

const CONFIRMATION_MESSAGE =
  "Are you sure you want to transfer this lender portal to the new contact? Existing lender data, applications, products, criteria, documents, and history will remain unchanged. The current contact will lose portal access.";

function getAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("admin_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatAdminName(lender: LenderContact) {
  const name = [lender.adminFirstName, lender.adminLastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || "No primary contact";
}

export default function TransferLenderPortalModal({
  lender,
  apiBase,
  onClose,
  onTransferred,
}: TransferLenderPortalModalProps) {
  const [form, setForm] = useState<TransferForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setForm(EMPTY_FORM);
    setErrors({});
    setApiError(null);
    setConfirming(false);
    setSubmitting(false);
  }, [lender?.id]);

  if (!lender) return null;

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const usPhoneRegex = /^(?:\+1\s?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}$/;
    const nameRegex = /^[A-Za-z\s'-]+$/;

    if (!form.firstName.trim()) nextErrors.firstName = "First name is required.";
    else if (!nameRegex.test(form.firstName.trim())) {
      nextErrors.firstName = "Only letters allowed.";
    }

    if (!form.lastName.trim()) nextErrors.lastName = "Last name is required.";
    else if (!nameRegex.test(form.lastName.trim())) {
      nextErrors.lastName = "Only letters allowed.";
    }

    if (!emailRegex.test(form.email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!usPhoneRegex.test(form.phone.trim())) {
      nextErrors.phone = "Enter a valid US phone number (e.g., 123-456-7890).";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleContinue = (event: FormEvent) => {
    event.preventDefault();
    setApiError(null);
    if (!validate()) return;
    setConfirming(true);
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setApiError(null);

    try {
      const res = await fetch(
        `${apiBase}/admin/lenders/transfer-portal/${lender.id}`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
          }),
        },
      );

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || "Transfer failed.");
      }

      toast.success("Lender portal transferred. Invitation sent to the new contact.");
      onTransferred();
      onClose();
    } catch (error) {
      setConfirming(false);
      setApiError(
        error instanceof Error ? error.message : "Transfer failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[600000] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#13538A]/10 text-[#13538A] dark:bg-blue-500/10 dark:text-blue-300">
              <ArrowRightLeft size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Transfer Lender Portal
              </h2>
              <p className="text-sm text-slate-500">{lender.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        {confirming ? (
          <div className="space-y-5 px-6 py-5">
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
              {CONFIRMATION_MESSAGE}
            </p>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-800/60">
              <p className="font-medium text-slate-800 dark:text-slate-100">
                New contact
              </p>
              <p className="mt-1 text-slate-600 dark:text-slate-300">
                {form.firstName} {form.lastName}
              </p>
              <p className="text-slate-500">{form.email}</p>
              <p className="text-slate-500">{form.phone}</p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirming(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Back
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirm}
                className="inline-flex items-center gap-2 rounded-lg bg-[#13538A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0e4069] disabled:opacity-60"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                Confirm transfer
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleContinue} className="px-6 py-5">
            <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Current lender contact
              </p>
              <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <User size={14} />
                  {formatAdminName(lender)}
                </div>
                <div className="flex items-center gap-2">
                  <Mail size={14} />
                  {lender.adminEmail || "—"}
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={14} />
                  {lender.adminPhone || "—"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(
                [
                  ["firstName", "First Name"],
                  ["lastName", "Last Name"],
                  ["email", "Email"],
                  ["phone", "Phone"],
                ] as Array<[keyof TransferForm, string]>
              ).map(([field, label]) => (
                <label key={field} className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">
                    {label}
                  </span>
                  <input
                    value={form[field]}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        [field]: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#13538A] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    placeholder={field === "phone" ? "123-456-7890" : label}
                  />
                  {errors[field] && (
                    <span className="mt-1 block text-xs text-red-600">
                      {errors[field]}
                    </span>
                  )}
                </label>
              ))}
            </div>

            {apiError && (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
                {apiError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[#13538A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0e4069]"
              >
                Continue
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
