import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  FileText,
  ImageIcon,
  Loader2,
  Palette,
  Save,
  Sparkles,
  Upload,
} from "lucide-react";
import toast from "react-hot-toast";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { getBrokerAuthHeaders } from "../../lib/brokerApi";
import { hasPermission } from "../../lib/brokerPermissions";
import { isLoanOfficerPortalPath } from "../../lib/portalAuth";
import { patchBrokerSessionUser } from "../../lib/brokerSession";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

function getAuthHeaders(): HeadersInit {
  return getBrokerAuthHeaders(true);
}

type BrandingForm = {
  brandName: string;
  logoUrl: string;
};

type SavedBranding = BrandingForm;

function RequirementItem({
  done,
  label,
}: {
  done: boolean;
  label: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
        done
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
      }`}
    >
      {done ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" />
      ) : (
        <Circle className="h-4 w-4 shrink-0" />
      )}
      <span>{label}</span>
    </div>
  );
}

export default function BrokerBranding() {
  const isLoanOfficerPortal = isLoanOfficerPortalPath();
  const canManageBranding =
    !isLoanOfficerPortal ||
    hasPermission("MANAGE_BRANDING", "loanOfficer");
  const readOnly = isLoanOfficerPortal && !canManageBranding;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [saved, setSaved] = useState<SavedBranding>({ brandName: "", logoUrl: "" });
  const [form, setForm] = useState<BrandingForm>({
    brandName: "",
    logoUrl: "",
  });

  const hasLogo = Boolean(form.logoUrl);
  const hasBrandName = Boolean(form.brandName.trim());
  const isFormComplete = hasLogo && hasBrandName;

  const hasChanges = useMemo(
    () =>
      form.brandName.trim() !== saved.brandName.trim() ||
      form.logoUrl !== saved.logoUrl,
    [form, saved],
  );

  const canSave = canManageBranding && isFormComplete && hasChanges && !saving;

  useEffect(() => {
    fetchBranding();
  }, []);

  const fetchBranding = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/broker/white-label/`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load branding settings");
      }

      const next = {
        brandName: json.data?.brandName || "",
        logoUrl: json.data?.logoUrl || "",
      };

      setForm(next);
      setSaved(next);
    } catch (error: any) {
      toast.error(error.message || "Failed to load branding settings");
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = (file?: File) => {
    if (!canManageBranding) return;
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, or SVG)");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be 2MB or smaller");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({
        ...prev,
        logoUrl: reader.result as string,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!canManageBranding) {
      toast.error("You have view-only access to branding settings");
      return;
    }
    if (!isFormComplete) {
      toast.error("Please upload a logo and enter your company name");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        brandName: form.brandName.trim(),
        logoUrl: form.logoUrl,
      };

      const res = await fetch(`${API_BASE}/broker/white-label/`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to save branding settings");
      }

      const next = {
        brandName: json.data?.brandName || payload.brandName,
        logoUrl: json.data?.logoUrl || payload.logoUrl,
      };

      setForm(next);
      setSaved(next);
      if (next.brandName) {
        patchBrokerSessionUser({ organizationName: next.brandName });
        window.dispatchEvent(
          new CustomEvent("broker-profile-updated", {
            detail: { organizationName: next.brandName },
          }),
        );
      }
      toast.success("Branding saved. New fee agreements will use this logo.");
    } catch (error: any) {
      toast.error(error.message || "Failed to save branding settings");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveLogo = () => {
    if (!canManageBranding) return;
    setForm((prev) => ({ ...prev, logoUrl: "" }));
    setFileInputKey((key) => key + 1);
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#13538A]" />
          <p className="mt-3 text-sm text-slate-500">Loading branding settings...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title="Broker Branding"
        description="Manage broker logo for fee agreements"
      />
      <PageBreadcrumb pageTitle="Branding" />

      <div className="mx-auto max-w-6xl space-y-6">
        {/* Hero */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-[#13538A] via-[#1a6cb0] to-[#2C92D5] p-6 text-white shadow-lg dark:border-slate-800 sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                <Palette className="h-3.5 w-3.5" />
                Fee Agreement Branding
              </div>
              <h1 className="text-2xl font-bold sm:text-3xl">Broker Branding</h1>
              <p className="mt-2 text-sm leading-relaxed text-blue-50/90 sm:text-base">
                {readOnly
                  ? "View your company branding used on fee agreements. Contact your broker admin to request changes."
                  : "Set your company name and logo once. New fee agreements will automatically use this branding. Signed agreements keep the identity that was active when the client signed. Changes here sync with your profile company name."}
              </p>
            </div>

            {readOnly ? (
              <div className="rounded-2xl border border-amber-200/40 bg-amber-50/90 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                View-only access — branding updates are disabled.
              </div>
            ) : (
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-100">
                Setup progress
              </p>
              <div className="mt-3 space-y-2">
                <RequirementItem done={hasLogo} label="Company logo uploaded" />
                <RequirementItem done={hasBrandName} label="Company name added" />
              </div>
            </div>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Form */}
          <div className="space-y-5 lg:col-span-3">
            {/* Logo upload */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Company Logo
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Appears at the top of every fee agreement document.
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    hasLogo
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                  }`}
                >
                  {hasLogo ? "Added" : "Required"}
                </span>
              </div>

              <label
                className={`group relative flex min-h-[180px] flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 transition ${
                  readOnly ? "cursor-default" : "cursor-pointer"
                } ${
                  hasLogo
                    ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-500/30 dark:bg-emerald-500/5"
                    : "border-slate-300 bg-slate-50 hover:border-[#2C92D5] hover:bg-sky-50/60 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-sky-500/40"
                }`}
              >
                <input
                  key={fileInputKey}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  className="hidden"
                  disabled={readOnly}
                  onChange={(e) => handleLogoUpload(e.target.files?.[0])}
                />

                {hasLogo ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex h-28 w-56 items-center justify-center rounded-xl border border-white bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <img
                        src={form.logoUrl}
                        alt="Broker logo preview"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      {readOnly ? "Company logo" : "Click to replace logo"}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#13538A]/10 text-[#13538A] dark:bg-sky-500/15 dark:text-sky-300">
                      <Upload className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Drag & drop or click to upload
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        PNG, JPG, WEBP or SVG · Max 2MB
                      </p>
                    </div>
                  </div>
                )}
              </label>

              {hasLogo && canManageBranding && (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400"
                  >
                    Remove logo
                  </button>
                </div>
              )}
            </section>

            {/* Company name */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Company Name
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Your brokerage name on fee agreements, documents, and your
                    broker profile — kept in sync across the platform.
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    hasBrandName
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                  }`}
                >
                  {hasBrandName ? "Added" : "Required"}
                </span>
              </div>

              <input
                className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:ring-2 dark:bg-slate-900 dark:text-slate-100 ${
                  hasBrandName
                    ? "border-emerald-200 focus:border-emerald-400 focus:ring-emerald-100 dark:border-emerald-500/30 dark:focus:ring-emerald-500/20"
                    : "border-slate-300 focus:border-[#2C92D5] focus:ring-sky-100 dark:border-slate-600 dark:focus:ring-sky-500/20"
                } ${readOnly ? "cursor-not-allowed opacity-80" : ""}`}
                value={form.brandName}
                readOnly={readOnly}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, brandName: e.target.value }))
                }
                placeholder="e.g. Acme Lending Group"
              />
            </section>

            {/* Info */}
            <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5 dark:border-sky-900/30 dark:from-sky-950/20 dark:to-slate-950">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    How branding works
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
                    <li>• New fee agreements use your saved company name and logo.</li>
                    <li>• Updates here also update your profile company name.</li>
                    <li>• When a client signs, that branding is locked.</li>
                    <li>• Logo updates apply only to new agreements.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="lg:col-span-2">
            <div className="sticky top-24 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="mb-4 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#13538A]" />
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Fee Agreement Preview
                  </h3>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
                  <div className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Document header
                    </p>
                  </div>

                  <div className="space-y-4 p-5 text-center">
                    <div className="flex justify-center">
                      {hasLogo ? (
                        <img
                          src={form.logoUrl}
                          alt="Preview logo"
                          className="max-h-20 max-w-[180px] object-contain"
                        />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-slate-300 bg-white text-slate-400 dark:border-slate-600 dark:bg-slate-800">
                          <ImageIcon className="h-6 w-6" />
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        FINDER & FINANCIAL AGREEMENT
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {hasBrandName ? form.brandName.trim() : "Your company name"}
                      </p>
                    </div>

                    <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-left text-[11px] leading-relaxed text-slate-500 dark:border-slate-700 dark:bg-slate-950">
                      This preview shows how your logo and company name will appear
                      at the top of client-facing fee agreements.
                    </div>
                  </div>
                </div>
              </div>

              {!isFormComplete && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  Upload a logo and enter your company name to enable saving.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Save bar */}
        {canManageBranding ? (
        <div className="sticky bottom-4 z-20 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-500">
              {canSave ? (
                <span className="text-emerald-600 dark:text-emerald-400">
                  Ready to save your branding settings.
                </span>
              ) : !isFormComplete ? (
                <span>Complete logo and company name to save.</span>
              ) : (
                <span>No changes to save.</span>
              )}
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              title={
                !isFormComplete
                  ? "Upload logo and enter company name first"
                  : !hasChanges
                    ? "No changes to save"
                    : "Save branding"
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#13538A] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f426d] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Branding
            </button>
          </div>
        </div>
        ) : null}
      </div>
    </>
  );
}
