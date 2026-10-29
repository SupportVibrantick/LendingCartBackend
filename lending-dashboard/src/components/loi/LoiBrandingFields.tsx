import { Building2, ImageIcon, Upload } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import type { LoiBrandingValues } from "../../lib/loiBranding";

type Props = {
  value: LoiBrandingValues;
  onChange: (value: LoiBrandingValues) => void;
  disabled?: boolean;
  title?: string;
  description?: string;
};

export default function LoiBrandingFields({
  value,
  onChange,
  disabled = false,
  title = "PDF Branding",
  description = "This logo and brand name appear in the term sheet header. Changes here are saved for future LOIs too.",
}: Props) {
  const [fileInputKey, setFileInputKey] = useState(0);

  const handleLogoUpload = (file?: File) => {
    if (!file || disabled) return;

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
      onChange({
        ...value,
        logoUrl: reader.result as string,
      });
    };
    reader.onerror = () => {
      toast.error(
        "We couldn’t read that image. Please try a PNG or JPG file instead.",
      );
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-[#183b57] dark:bg-brand-500/10 dark:text-brand-300">
          <ImageIcon size={18} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {title}
          </h3>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[140px_minmax(0,1fr)]">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Logo
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                value.logoUrl
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
              }`}
            >
              {value.logoUrl ? "Added" : "Required"}
            </span>
          </div>
          <label
            className={`group relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-3 py-4 transition ${
              value.logoUrl
                ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-500/30 dark:bg-emerald-500/5"
                : "border-amber-300 bg-amber-50/40 hover:border-amber-500 hover:bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/5"
            } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
          >
            <input
              key={fileInputKey}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
              className="hidden"
              disabled={disabled}
              required={!value.logoUrl}
              aria-required="true"
              onChange={(e) => handleLogoUpload(e.target.files?.[0])}
            />

            {value.logoUrl ? (
              <img
                src={value.logoUrl}
                alt="Logo preview"
                className="max-h-16 max-w-full object-contain"
              />
            ) : (
              <>
                <Upload className="mb-2 h-5 w-5 text-amber-500" />
                <span className="text-center text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  Upload logo
                </span>
                <span className="mt-1 text-center text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                  Required for term sheet
                </span>
              </>
            )}
          </label>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>
                Brand Name
                <span className="ml-1 text-amber-600" aria-hidden="true">
                  *
                </span>
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal ${
                  value.brandName.trim()
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                }`}
              >
                {value.brandName.trim() ? "Added" : "Required"}
              </span>
            </span>
            <input
              value={value.brandName}
              disabled={disabled}
              required
              aria-required="true"
              onChange={(e) =>
                onChange({ ...value, brandName: e.target.value })
              }
              placeholder="e.g. Acme Capital Lending"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#183b57] focus:ring-2 focus:ring-[#183b57]/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>

          <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
            {value.logoUrl ? (
              <img
                src={value.logoUrl}
                alt="Header preview logo"
                className="h-8 w-auto max-w-[96px] object-contain"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-[#183b57] dark:bg-brand-500/20">
                <Building2 size={14} />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Header preview
              </p>
              <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                {value.brandName.trim() || "Your brand name"}
              </p>
            </div>
          </div>

          {value.logoUrl && !disabled && (
            <button
              type="button"
              onClick={() => {
                onChange({ ...value, logoUrl: "" });
                setFileInputKey((key) => key + 1);
              }}
              className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400"
            >
              Remove logo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
