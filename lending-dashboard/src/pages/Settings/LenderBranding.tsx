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
import { patchLenderSessionUser } from "../../lib/lenderSession";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

function getAuthHeaders(): HeadersInit {
  const token = sessionStorage.getItem("lender_token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
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

export default function LenderBranding() {
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

  const canSave = isFormComplete && hasChanges && !saving;

  useEffect(() => {
    fetchBranding();
  }, []);

  const fetchBranding = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/lender/branding/`, {
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
    if (!isFormComplete) {
      toast.error("Please upload a logo and enter your brand name");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        brandName: form.brandName.trim(),
        logoUrl: form.logoUrl,
      };

      const res = await fetch(`${API_BASE}/lender/branding/`, {
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
        patchLenderSessionUser({ organizationName: next.brandName });
      }
      toast.success("Branding saved. New LOI / term sheets will use this logo.");
    } catch (error: any) {
      toast.error(error.message || "Failed to save branding settings");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveLogo = () => {
    setForm((prev) => ({ ...prev, logoUrl: "" }));
    setFileInputKey((key) => key + 1);
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#0F766E]" />
          <p className="mt-3 text-sm text-slate-500">Loading branding settings...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title="Lender Branding"
        description="Manage lender logo and brand name for LOI / term sheets"
      />
      <PageBreadcrumb pageTitle="Branding" />

      <div className="mx-auto max-w-6xl space-y-6">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-[#134E4A] via-[#0F766E] to-[#14B8A6] p-6 text-white shadow-lg dark:border-slate-800 sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                <Palette className="h-3.5 w-3.5" />
                LOI / Term Sheet Branding
              </div>
              <h1 className="text-2xl font-bold sm:text-3xl">Lender Branding</h1>
              <p className="mt-2 text-sm leading-relaxed text-teal-50/90 sm:text-base">
                Set your company identity once. Generated LOI and term sheet
                documents will show your logo and brand name in the header.
              </p>
            </div>

            <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-100">
                Setup progress
              </p>
              <div className="mt-3 space-y-2">
                <RequirementItem done={hasLogo} label="Company logo uploaded" />
                <RequirementItem done={hasBrandName} label="Brand name added" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-5 lg:col-span-3">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Company Logo
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Appears at the top of every LOI / term sheet PDF.
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
                className={`group relative flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 transition ${
                  hasLogo
                    ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-500/30 dark:bg-emerald-500/5"
                    : "border-slate-300 bg-slate-50 hover:border-[#0F766E] hover:bg-teal-50/60 dark:border-slate-700 dark:bg-slate-900/40"
                }`}
              >
                <input
                  key={fileInputKey}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => handleLogoUpload(e.target.files?.[0])}
                />

                {hasLogo ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex h-28 w-56 items-center justify-center rounded-xl border border-white bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <img
                        src={form.logoUrl}
                        alt="Lender logo preview"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      Click to replace logo
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0F766E]/10 text-[#0F766E] dark:bg-teal-500/15 dark:text-teal-300">
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

              {hasLogo && (
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

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Brand Name
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Your lending company name shown on term sheets and in the
                    Parties section.
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
                    ? "border-emerald-200 focus:border-emerald-400 focus:ring-emerald-100 dark:border-emerald-500/30"
                    : "border-slate-300 focus:border-[#0F766E] focus:ring-teal-100 dark:border-slate-600"
                }`}
                value={form.brandName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, brandName: e.target.value }))
                }
                placeholder="e.g. Acme Capital Lending"
              />
            </section>

            <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-white p-5 dark:border-teal-900/30 dark:from-teal-950/20 dark:to-slate-950">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    How branding works
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
                    <li>• New LOI / term sheets use your saved branding.</li>
                    <li>• Logo and brand name appear in the PDF header.</li>
                    <li>• Brand name is also used in the Lender field.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="sticky top-24 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="mb-4 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#0F766E]" />
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Term Sheet Preview
                  </h3>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
                  <div className="border-b border-[#0F766E] bg-[#134E4A] px-4 py-5 text-center text-white">
                    <div className="flex justify-center">
                      {hasLogo ? (
                        <img
                          src={form.logoUrl}
                          alt="Preview logo"
                          className="max-h-16 max-w-[160px] object-contain"
                        />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-white/40 bg-white/10 text-white/60">
                          <ImageIcon className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <p className="mt-3 text-sm font-bold">
                      {hasBrandName ? form.brandName.trim() : "Your brand name"}
                    </p>
                    <p className="mt-1 text-[11px] text-teal-100/80">
                      Commercial Lending Term Sheet
                    </p>
                  </div>

                  <div className="space-y-3 p-5 text-left">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Document header preview
                    </p>
                    <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-[11px] leading-relaxed text-slate-500 dark:border-slate-700 dark:bg-slate-950">
                      This preview shows how your logo and brand name will appear
                      at the top of generated LOI / term sheet PDFs.
                    </div>
                  </div>
                </div>
              </div>

              {!isFormComplete && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  Upload a logo and enter your brand name to enable saving.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="sticky bottom-4 z-20 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-500">
              {canSave ? (
                <span className="text-emerald-600 dark:text-emerald-400">
                  Ready to save your branding settings.
                </span>
              ) : !isFormComplete ? (
                <span>Complete logo and brand name to save.</span>
              ) : (
                <span>No changes to save.</span>
              )}
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F766E] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0d655e] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
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
      </div>
    </>
  );
}
