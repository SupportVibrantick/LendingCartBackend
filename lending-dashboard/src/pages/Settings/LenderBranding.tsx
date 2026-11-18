import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Circle,
  FileText,
  ImageIcon,
  Loader2,
  Palette,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import toast from "react-hot-toast";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { patchLenderSessionUser } from "../../lib/lenderSession";
import { readBrandingApiResponse } from "../../lib/brandingApiErrors";
import { API_BASE, getLenderAuthHeaders } from "../../lib/lenderApi";

type BrandingForm = {
  brandName: string;
  logoUrl: string;
};

type SavedBranding = BrandingForm;

type BrandingPayload = {
  brandName: string;
  logoUrl: string;
};

// Share one in-flight GET across React Strict Mode remounts.
let inflightBrandingGet: Promise<{
  ok: boolean;
  json: any;
  errorMessage?: string | null;
}> | null = null;

async function fetchBrandingSettings() {
  if (!inflightBrandingGet) {
    inflightBrandingGet = (async () => {
      const res = await fetch(`${API_BASE}/lender/branding/`, {
        headers: getLenderAuthHeaders(),
      });
      return readBrandingApiResponse(res, "load");
    })().finally(() => {
      inflightBrandingGet = null;
    });
  }

  return inflightBrandingGet;
}

function RequirementItem({
  done,
  label,
}: {
  done: boolean;
  label: string;
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-sm ${
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
      <span className="truncate">{label}</span>
    </div>
  );
}

export default function LenderBranding() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [saved, setSaved] = useState<SavedBranding>({
    brandName: "",
    logoUrl: "",
  });
  const [form, setForm] = useState<BrandingForm>({
    brandName: "",
    logoUrl: "",
  });
  const savingLockRef = useRef(false);

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
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        const { ok, json, errorMessage } = await fetchBrandingSettings();
        if (!active) return;

        if (!ok) {
          throw new Error(errorMessage || undefined);
        }

        const next = {
          brandName: json?.data?.brandName || "",
          logoUrl: json?.data?.logoUrl || "",
        };

        setForm(next);
        setSaved(next);
      } catch (error: any) {
        if (!active) return;
        toast.error(
          error.message ||
            "We couldn’t load your branding settings. Please refresh the page and try again.",
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const handleLogoUpload = (file?: File) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, or SVG)");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error(
        "This logo is larger than 2 MB. Please compress it or choose a smaller file.",
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({
        ...prev,
        logoUrl: reader.result as string,
      }));
    };
    reader.onerror = () => {
      toast.error(
        "We couldn’t read that image. Please try a PNG or JPG file instead.",
      );
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (savingLockRef.current || saving) return;

    if (!isFormComplete) {
      toast.error("Please upload a logo and enter your brand name");
      return;
    }

    savingLockRef.current = true;

    try {
      setSaving(true);

      const payload: BrandingPayload = {
        brandName: form.brandName.trim(),
        logoUrl: form.logoUrl,
      };

      const res = await fetch(`${API_BASE}/lender/branding/`, {
        method: "PUT",
        headers: getLenderAuthHeaders(true),
        body: JSON.stringify(payload),
      });

      const { ok, json, errorMessage } = await readBrandingApiResponse(
        res,
        "save",
      );

      if (!ok) {
        throw new Error(errorMessage || undefined);
      }

      const next = {
        brandName: json?.data?.brandName || payload.brandName,
        logoUrl: json?.data?.logoUrl || payload.logoUrl,
      };

      setForm(next);
      setSaved(next);
      if (next.brandName) {
        patchLenderSessionUser({ organizationName: next.brandName });
      }
      toast.success("Branding saved. New LOI / term sheets will use this logo.");
    } catch (error: any) {
      toast.error(
        error.message ||
          "We couldn’t save your branding. Please check your logo and brand name, then try again.",
      );
    } finally {
      savingLockRef.current = false;
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
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#183b57]" />
          <p className="mt-3 text-sm text-slate-500">
            Loading branding settings...
          </p>
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

      <div className="mx-auto w-full min-w-0 max-w-5xl space-y-5 pb-6">
        <PageBreadcrumb pageTitle="Branding" />

        {/* Hero */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-gray-900">
          <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 max-w-xl">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#183B57]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#183B57]">
                <Palette className="h-3.5 w-3.5 shrink-0" />
                LOI / Term Sheet Branding
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Lender Branding
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Set your company identity once. Generated LOI and term sheet
                documents will show your logo and brand name in the header.
              </p>
            </div>

            <div className="w-full shrink-0 rounded-xl border border-slate-100 bg-slate-50 p-4 lg:w-64 dark:border-slate-800 dark:bg-slate-800/60">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#183B57]">
                Setup progress
              </p>
              <div className="mt-3 space-y-2">
                <RequirementItem done={hasLogo} label="Company logo uploaded" />
                <RequirementItem done={hasBrandName} label="Brand name added" />
              </div>
            </div>
          </div>
        </section>

        {/* Main grid — min-w-0 prevents column overflow */}
        <div className="grid min-w-0 gap-5 lg:grid-cols-12">
          <div className="min-w-0 space-y-5 lg:col-span-7">
            <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-950">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Company Logo
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Appears at the top of every LOI / term sheet PDF.
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    hasLogo
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                  }`}
                >
                  {hasLogo ? "Added" : "Required"}
                </span>
              </div>

              <label
                className={`group relative flex min-h-[168px] w-full min-w-0 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed px-4 py-6 transition sm:px-6 ${
                  hasLogo
                    ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-500/30 dark:bg-emerald-500/5"
                    : "border-slate-300 bg-slate-50 hover:border-[#183b57] hover:bg-[#183b57]/5 dark:border-slate-700 dark:bg-slate-900/40"
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
                  <div className="flex w-full min-w-0 flex-col items-center gap-3">
                    <div className="flex h-24 w-full max-w-[13rem] items-center justify-center rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
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
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#183b57]/10 text-[#183b57]">
                      <Upload className="h-5 w-5" />
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
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove logo
                  </button>
                </div>
              )}
            </section>

            <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-950">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Brand Name
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Shown on term sheets and in the Parties section.
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    hasBrandName
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                  }`}
                >
                  {hasBrandName ? "Added" : "Required"}
                </span>
              </div>

              <input
                className={`w-full min-w-0 rounded-xl border bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:ring-2 dark:bg-slate-900 dark:text-slate-100 ${
                  hasBrandName
                    ? "border-emerald-200 focus:border-emerald-400 focus:ring-emerald-100 dark:border-emerald-500/30"
                    : "border-slate-300 focus:border-[#183b57] focus:ring-[#183b57]/15 dark:border-slate-600"
                }`}
                value={form.brandName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, brandName: e.target.value }))
                }
                placeholder="e.g. Acme Capital Lending"
              />
            </section>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#183b57]/10 text-[#183b57]">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    How branding works
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
                    <li>New LOI / term sheets use your saved branding.</li>
                    <li>Logo and brand name appear in the PDF header.</li>
                    <li>Brand name is also used in the Lender field.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="min-w-0 lg:col-span-5">
            <div className="space-y-4 lg:sticky lg:top-24">
              <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="border-b border-slate-100 p-5 dark:border-slate-800">
                  <div className="mb-4 flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-[#183b57]" />
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      Term Sheet Preview
                    </h3>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
                    <div className="border-b border-[#183b57] bg-[#183b57] px-4 py-5 text-center text-white">
                      <div className="flex justify-center">
                        {hasLogo ? (
                          <img
                            src={form.logoUrl}
                            alt="Preview logo"
                            className="mx-auto max-h-14 w-auto max-w-[140px] object-contain"
                          />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-white/40 bg-white/10 text-white/60">
                            <ImageIcon className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                      <p className="mt-3 break-words text-sm font-bold">
                        {hasBrandName
                          ? form.brandName.trim()
                          : "Your brand name"}
                      </p>
                      <p className="mt-1 text-[11px] text-white/70">
                        Commercial Lending Term Sheet
                      </p>
                    </div>

                    <div className="space-y-3 p-4 text-left">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Document header preview
                      </p>
                      <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-3 text-[11px] leading-relaxed text-slate-500 dark:border-slate-700 dark:bg-slate-950">
                        This is how your logo and brand name will appear at the
                        top of generated LOI / term sheet PDFs.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 p-5">
                  {!isFormComplete ? (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                      Upload a logo and enter your brand name to enable saving.
                    </p>
                  ) : (
                    <p className="text-sm text-slate-500">
                      {canSave ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          Ready to save your branding settings.
                        </span>
                      ) : (
                        <span>No changes to save.</span>
                      )}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!canSave}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#183b57] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#264863] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
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
          </div>
        </div>
      </div>
    </>
  );
}
