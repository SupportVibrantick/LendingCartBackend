import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Circle,
  FileText,
  ImageIcon,
  Loader2,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import toast from "react-hot-toast";
import PageMeta from "../../components/common/PageMeta";
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
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        done
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "bg-surface text-text-secondary dark:bg-slate-800"
      }`}
    >
      {done ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <Circle className="h-3.5 w-3.5 shrink-0" />
      )}
      <span>{label}</span>
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
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 text-text-secondary">
        <Loader2 className="h-7 w-7 animate-spin text-brand-500" />
        <p className="text-xs">Loading branding settings…</p>
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title="Lender Branding"
        description="Manage lender logo and brand name for LOI / term sheets"
      />

      <div className="space-y-4 text-text-primary dark:text-slate-100">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="ds-page-title">Branding</h1>
            <p className="ds-page-subtitle">
              Set your company identity for LOI and term sheet documents.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RequirementItem done={hasLogo} label="Logo" />
            <RequirementItem done={hasBrandName} label="Brand name" />
          </div>
        </div>

        <div className="grid min-w-0 gap-4 lg:grid-cols-12">
          <div className="min-w-0 space-y-4 lg:col-span-7">
            <section className="overflow-hidden rounded-2xl border border-border bg-white dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5 dark:border-slate-800">
                <div className="min-w-0">
                  <h2 className="text-[16px] font-semibold text-text-primary dark:text-white">
                    Company Logo
                  </h2>
                  <p className="text-[13px] text-text-secondary">
                    Appears at the top of every LOI / term sheet PDF.
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    hasLogo
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                  }`}
                >
                  {hasLogo ? "Added" : "Required"}
                </span>
              </div>

              <div className="space-y-3 p-4 sm:p-5">
                <label
                  className={`group relative flex min-h-[160px] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed px-4 py-6 transition ${
                    hasLogo
                      ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-500/30 dark:bg-emerald-500/5"
                      : "border-border bg-surface hover:border-brand-400 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-950"
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
                      <div className="flex h-24 w-full max-w-[13rem] items-center justify-center rounded-xl border border-border bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
                        <img
                          src={form.logoUrl}
                          alt="Lender logo preview"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <p className="text-sm font-medium text-text-secondary">
                        Click to replace logo
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                        <Upload className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-primary dark:text-slate-100">
                          Drag & drop or click to upload
                        </p>
                        <p className="mt-1 text-xs text-text-secondary">
                          PNG, JPG, WEBP or SVG · Max 2MB
                        </p>
                      </div>
                    </div>
                  )}
                </label>

                {hasLogo ? (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove logo
                    </button>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-border bg-white dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5 dark:border-slate-800">
                <div className="min-w-0">
                  <h2 className="text-[16px] font-semibold text-text-primary dark:text-white">
                    Brand Name
                  </h2>
                  <p className="text-[13px] text-text-secondary">
                    Shown on term sheets and in the Parties section.
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    hasBrandName
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                  }`}
                >
                  {hasBrandName ? "Added" : "Required"}
                </span>
              </div>

              <div className="p-4 sm:p-5">
                <input
                  className="h-11 w-full rounded-xl border border-border bg-white px-3.5 text-sm text-text-primary outline-none transition placeholder:text-text-secondary/70 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  value={form.brandName}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, brandName: e.target.value }))
                  }
                  placeholder="e.g. Acme Capital Lending"
                />
              </div>
            </section>

            <div className="rounded-2xl border border-border bg-white px-4 py-4 sm:px-5 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary dark:text-slate-100">
                    How branding works
                  </p>
                  <ul className="mt-1.5 space-y-1 text-[13px] text-text-secondary">
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
              <div className="overflow-hidden rounded-2xl border border-border bg-white dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center gap-2 border-b border-border px-4 py-3.5 sm:px-5 dark:border-slate-800">
                  <FileText className="h-4 w-4 shrink-0 text-brand-500" />
                  <h3 className="text-[15px] font-semibold text-text-primary dark:text-white">
                    Term Sheet Preview
                  </h3>
                </div>

                <div className="space-y-4 p-4 sm:p-5">
                  <div className="overflow-hidden rounded-xl border border-border dark:border-slate-700">
                    <div className="bg-brand-500 px-4 py-5 text-center text-white">
                      <div className="flex justify-center">
                        {hasLogo ? (
                          <img
                            src={form.logoUrl}
                            alt="Preview logo"
                            className="mx-auto max-h-14 w-auto max-w-[140px] object-contain"
                          />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-white/40 bg-white/10 text-white/70">
                            <ImageIcon className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                      <p className="mt-3 break-words text-sm font-bold">
                        {hasBrandName
                          ? form.brandName.trim()
                          : "Your brand name"}
                      </p>
                      <p className="mt-1 text-[11px] text-white/75">
                        Commercial Lending Term Sheet
                      </p>
                    </div>

                    <div className="space-y-2 bg-surface px-4 py-3.5 dark:bg-slate-950">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                        Document header preview
                      </p>
                      <p className="text-[12px] leading-relaxed text-text-secondary">
                        This is how your logo and brand name will appear at the
                        top of generated LOI / term sheet PDFs.
                      </p>
                    </div>
                  </div>

                  {!isFormComplete ? (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                      Upload a logo and enter your brand name to enable saving.
                    </p>
                  ) : (
                    <p className="text-[13px] text-text-secondary">
                      {canSave ? (
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
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
                    className="ds-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
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
