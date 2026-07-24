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
  description = "This logo and brand name appear on your broker-branded term sheet. Changes here are saved for future LOIs too.",
}: Props) {
  const [fileInputKey, setFileInputKey] = useState(0);

  const handleLogoUpload = (file?: File) => {
    if (!file || disabled) return;

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
      onChange({
        ...value,
        logoUrl: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
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
        <label
          className={`group relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-3 py-4 transition ${
            value.logoUrl
              ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-500/30 dark:bg-emerald-500/5"
              : "border-slate-300 bg-slate-50 hover:border-violet-400 hover:bg-violet-50/60 dark:border-slate-700 dark:bg-slate-900/40"
          } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
        >
          <input
            key={fileInputKey}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
            className="hidden"
            disabled={disabled}
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
              <Upload className="mb-2 h-5 w-5 text-slate-400" />
              <span className="text-center text-[11px] font-medium text-slate-500">
                Upload logo
              </span>
            </>
          )}
        </label>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Brand Name
            </span>
            <input
              value={value.brandName}
              disabled={disabled}
              onChange={(e) =>
                onChange({ ...value, brandName: e.target.value })
              }
              placeholder="e.g. Your Brokerage Name"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-500/20">
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
