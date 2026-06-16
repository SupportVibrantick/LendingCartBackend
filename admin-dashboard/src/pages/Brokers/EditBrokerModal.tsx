import React, { useEffect, useState } from "react";
import { Building2, Briefcase, Pencil, X } from "lucide-react";
import {
  LO_US_STATES,
  formatLoPhone,
  formatLoZip,
  normalizeLoWebsiteUrl,
  stripLoWebsitePrefix,
} from "../../lib/brokerLoanOfficerForm";
import type { BrokerAdminProfile } from "../../lib/brokerDetailApi";

export type Broker = {
  id: string;
  name: string;
  email: string;
  phone: string;

  adminId?: string;
  adminFirstName?: string;
  adminLastName?: string;
  adminEmail?: string;
  adminPhone?: string;
  adminPassword?: string;
  adminStatus?: string;
  adminProfile?: BrokerAdminProfile | null;

  status?: string;
  createdAt?: string;
};

type Props = {
  isOpen: boolean;
  broker: Broker | null;
  onClose: () => void;
  onSave: (updated: Broker) => void;
};

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none transition-colors focus:border-[#13538A] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function formatUSPhone(value: string) {
  const numbers = value.replace(/\D/g, "").slice(0, 10);
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 6) {
    return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
  }
  return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6)}`;
}

export default function EditBrokerModal({ isOpen, broker, onClose, onSave }: Props) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    adminId: "",
    adminStatus: "",
    adminFirstName: "",
    adminLastName: "",
    adminEmail: "",
    adminPhone: "",
    adminPassword: "",
    company: "",
    licenseNumber: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    website: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (broker) {
      const profile = broker.adminProfile;
      setForm({
        name: broker.name || "",
        email: broker.email || "",
        phone: broker.phone || "",
        adminId: broker.adminId || "",
        adminStatus: broker.adminStatus || "",
        adminFirstName: broker.adminFirstName || "",
        adminLastName: broker.adminLastName || "",
        adminEmail: broker.adminEmail || "",
        adminPhone: broker.adminPhone ? formatLoPhone(broker.adminPhone) : "",
        adminPassword: "",
        company: profile?.company || "",
        licenseNumber: profile?.licenseNumber || "",
        address: profile?.address || "",
        city: profile?.city || "",
        state: profile?.state || "",
        zipCode: profile?.zipCode || "",
        website: stripLoWebsitePrefix(profile?.website),
      });
      setErrors({});
      setError(null);
    }
  }, [broker]);

  if (!isOpen) return null;

  const clearError = (key: string) => {
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const usPhoneRegex = /^(?:\+1\s?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}$/;
    const nameRegex = /^[A-Za-z\s'-]+$/;
    const licenseRegex = /^[A-Za-z0-9-]{4,20}$/;
    const zipRegex = /^\d{5}(-\d{4})?$/;

    if (!form.name.trim()) {
      newErrors.name = "Organization name is required.";
    } else if (form.name.trim().length < 2) {
      newErrors.name = "Minimum 2 characters required.";
    }

    if (!form.email.trim()) {
      newErrors.email = "Organization email is required.";
    } else if (!emailRegex.test(form.email.trim())) {
      newErrors.email = "Enter a valid email address.";
    }

    if (!form.phone.trim()) {
      newErrors.phone = "Organization phone is required.";
    } else if (!usPhoneRegex.test(form.phone.trim())) {
      newErrors.phone = "Enter valid US phone number.";
    }

    if (!form.adminFirstName.trim()) {
      newErrors.adminFirstName = "First name is required.";
    } else if (!nameRegex.test(form.adminFirstName.trim())) {
      newErrors.adminFirstName = "Only letters allowed.";
    }

    if (!form.adminLastName.trim()) {
      newErrors.adminLastName = "Last name is required.";
    } else if (!nameRegex.test(form.adminLastName.trim())) {
      newErrors.adminLastName = "Only letters allowed.";
    }

    if (!form.adminEmail.trim()) {
      newErrors.adminEmail = "Admin email is required.";
    } else if (!emailRegex.test(form.adminEmail.trim())) {
      newErrors.adminEmail = "Enter a valid email address.";
    }

    if (form.adminPhone.trim() && !usPhoneRegex.test(form.adminPhone.trim())) {
      newErrors.adminPhone = "Enter valid US phone number.";
    }

    if (form.licenseNumber.trim() && !licenseRegex.test(form.licenseNumber.trim())) {
      newErrors.licenseNumber = "License must be 4–20 alphanumeric characters.";
    }

    if (form.zipCode.trim() && !zipRegex.test(form.zipCode.trim())) {
      newErrors.zipCode = "Enter valid US ZIP.";
    }

    if (form.website.trim() && !normalizeLoWebsiteUrl(form.website)) {
      newErrors.website = "Enter a valid website URL.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);

    if (!validateForm()) return;

    setSaving(true);

    try {
      const normalizedWebsite = form.website.trim()
        ? normalizeLoWebsiteUrl(form.website)
        : "";

      const updated: Broker = {
        id: broker!.id,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.replace(/\D/g, ""),
        adminId: form.adminId,
        adminStatus: form.adminStatus,
        adminFirstName: form.adminFirstName.trim(),
        adminLastName: form.adminLastName.trim(),
        adminEmail: form.adminEmail.trim(),
        adminPhone: form.adminPhone.replace(/\D/g, ""),
        adminPassword: form.adminPassword.trim(),
        adminProfile: {
          company: form.company.trim() || null,
          licenseNumber: form.licenseNumber.trim() || null,
          address: form.address.trim() || null,
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          zipCode: form.zipCode.trim() || null,
          website: normalizedWebsite || null,
        },
        status: broker?.status,
        createdAt: broker!.createdAt,
      };

      await onSave(updated);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const fieldErrorClass = (key: string) =>
    errors[key] ? "border-red-500 focus:border-red-500" : "";

  return (
    <div className="fixed inset-0 z-[99999999] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="h-1 bg-gradient-to-r from-[#13538A] via-[#18B6B4] to-emerald-400 opacity-80" />

        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#13538A]/10 text-[#13538A]">
              <Pencil size={13} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Edit Broker</h2>
              <p className="text-[10px] text-slate-500">
                Organization, admin, and optional professional details
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSave} className="overflow-y-auto px-4 py-3 space-y-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/30">
            <div className="mb-2.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <Building2 size={12} className="text-[#13538A]" />
              Organization
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <Field label="Name" required>
                <input
                  value={form.name}
                  onChange={(e) => {
                    setForm({ ...form, name: e.target.value });
                    clearError("name");
                  }}
                  className={`${inputClass} ${fieldErrorClass("name")}`}
                  autoFocus
                />
                {errors.name ? (
                  <p className="mt-1 text-[10px] text-red-600">{errors.name}</p>
                ) : null}
              </Field>
              <Field label="Email" required>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => {
                    setForm({ ...form, email: e.target.value });
                    clearError("email");
                  }}
                  className={`${inputClass} ${fieldErrorClass("email")}`}
                />
                {errors.email ? (
                  <p className="mt-1 text-[10px] text-red-600">{errors.email}</p>
                ) : null}
              </Field>
              <Field label="Phone" required>
                <input
                  value={form.phone}
                  onChange={(e) => {
                    setForm({ ...form, phone: formatUSPhone(e.target.value) });
                    clearError("phone");
                  }}
                  placeholder="(123) 456-7890"
                  className={`${inputClass} sm:col-span-2 ${fieldErrorClass("phone")}`}
                />
                {errors.phone ? (
                  <p className="mt-1 text-[10px] text-red-600 sm:col-span-2">{errors.phone}</p>
                ) : null}
              </Field>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/30">
            <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Primary admin
            </p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <Field label="First name" required>
                <input
                  value={form.adminFirstName}
                  onChange={(e) => {
                    setForm({ ...form, adminFirstName: e.target.value });
                    clearError("adminFirstName");
                  }}
                  className={`${inputClass} ${fieldErrorClass("adminFirstName")}`}
                />
                {errors.adminFirstName ? (
                  <p className="mt-1 text-[10px] text-red-600">{errors.adminFirstName}</p>
                ) : null}
              </Field>
              <Field label="Last name" required>
                <input
                  value={form.adminLastName}
                  onChange={(e) => {
                    setForm({ ...form, adminLastName: e.target.value });
                    clearError("adminLastName");
                  }}
                  className={`${inputClass} ${fieldErrorClass("adminLastName")}`}
                />
                {errors.adminLastName ? (
                  <p className="mt-1 text-[10px] text-red-600">{errors.adminLastName}</p>
                ) : null}
              </Field>
              <Field label="Email" required>
                <input
                  type="email"
                  value={form.adminEmail}
                  onChange={(e) => {
                    setForm({ ...form, adminEmail: e.target.value });
                    clearError("adminEmail");
                  }}
                  className={`${inputClass} ${fieldErrorClass("adminEmail")}`}
                />
                {errors.adminEmail ? (
                  <p className="mt-1 text-[10px] text-red-600">{errors.adminEmail}</p>
                ) : null}
              </Field>
              <Field label="Phone">
                <input
                  type="tel"
                  value={form.adminPhone}
                  onChange={(e) => {
                    setForm({ ...form, adminPhone: formatLoPhone(e.target.value) });
                    clearError("adminPhone");
                  }}
                  placeholder="123-456-7890"
                  className={`${inputClass} ${fieldErrorClass("adminPhone")}`}
                />
                {errors.adminPhone ? (
                  <p className="mt-1 text-[10px] text-red-600">{errors.adminPhone}</p>
                ) : null}
              </Field>
              <Field label="Password (optional)">
                <input
                  type="password"
                  value={form.adminPassword}
                  onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                  className={inputClass}
                  placeholder="Keep blank to retain"
                />
              </Field>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/30">
            <div className="mb-2.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <Briefcase size={12} className="text-emerald-600" />
              Professional information
              <span className="font-normal normal-case text-slate-400">(optional)</span>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Company">
                  <input
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="License number">
                <input
                  value={form.licenseNumber}
                  onChange={(e) => {
                    setForm({ ...form, licenseNumber: e.target.value });
                    clearError("licenseNumber");
                  }}
                  className={`${inputClass} ${fieldErrorClass("licenseNumber")}`}
                />
                {errors.licenseNumber ? (
                  <p className="mt-1 text-[10px] text-red-600">{errors.licenseNumber}</p>
                ) : null}
              </Field>
              <Field label="Website">
                <input
                  value={form.website}
                  onChange={(e) => {
                    setForm({ ...form, website: e.target.value });
                    clearError("website");
                  }}
                  placeholder="example.com"
                  className={`${inputClass} ${fieldErrorClass("website")}`}
                />
                {errors.website ? (
                  <p className="mt-1 text-[10px] text-red-600">{errors.website}</p>
                ) : null}
              </Field>
              <div className="sm:col-span-2">
                <Field label="Address">
                  <input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="City">
                <input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="State">
                <select
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Select state</option>
                  {LO_US_STATES.map((state) => (
                    <option key={state.code} value={state.code}>
                      {state.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="ZIP code">
                <input
                  value={form.zipCode}
                  onChange={(e) => {
                    setForm({ ...form, zipCode: formatLoZip(e.target.value) });
                    clearError("zipCode");
                  }}
                  placeholder="12345"
                  className={`${inputClass} ${fieldErrorClass("zipCode")}`}
                />
                {errors.zipCode ? (
                  <p className="mt-1 text-[10px] text-red-600">{errors.zipCode}</p>
                ) : null}
              </Field>
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-red-100 bg-red-50 px-2.5 py-2 text-[11px] text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#13538A] px-3.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#0f426d] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
