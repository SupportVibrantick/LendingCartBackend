import { ImagePlus, Sparkles, Trash2 } from "lucide-react";
import { SiteConfig } from "../../../../types/siteBuilder";

type Props = {
  config: SiteConfig;
  setConfig: (c: SiteConfig) => void;
};

const DEFAULT_HOME = {
  heroHeading: "",
  heroSubheading: "",
  ctaText: "",
  heroImageUrl: "",
};

export default function HomeTab({ config, setConfig }: Props) {
  const home = {
    ...DEFAULT_HOME,
    ...config.home,
  };

  const updateHome = (
    key: keyof SiteConfig["home"],
    value: string | undefined,
  ) => {
    setConfig({
      ...config,
      home: {
        ...home,
        [key]: value,
      },
    });
  };

  const handleHeroImageUpload = (file?: File) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      updateHome("heroImageUrl", reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const fields = [
    {
      label: "Hero Heading",
      hint: "Main statement users notice first",
      value: home.heroHeading,
      key: "heroHeading" as const,
      rows: 3,
      placeholder: "Get Your Loan Fast & Easy",
    },
    {
      label: "Subheading",
      hint: "Support the heading with a short value proposition",
      value: home.heroSubheading,
      key: "heroSubheading" as const,
      rows: 4,
      placeholder: "Home Loans, Business Loans & More",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 text-white shadow-sm dark:border-slate-700">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">
              <Sparkles size={12} />
              Home Section
            </div>
            <h3 className="text-lg font-semibold">Shape the first impression</h3>
            <p className="max-w-lg text-sm leading-6 text-slate-300">
              Update your hero copy, CTA, and banner image. These fields feed
              the live website preview on the right.
            </p>
          </div>

          <div
            className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-100 sm:flex"
            style={{ boxShadow: `0 0 0 1px ${config.branding.primaryColor}33 inset` }}
          >
            <ImagePlus size={18} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between gap-3">
          <div>
            <label className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Hero Banner Image
            </label>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Upload a strong background visual for the homepage hero section.
            </p>
          </div>

          {home.heroImageUrl ? (
            <button
              type="button"
              onClick={() => updateHome("heroImageUrl", "")}
              className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
            >
              <Trash2 size={13} />
              Remove
            </button>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[160px_minmax(0,1fr)]">
          {home.heroImageUrl ? (
            <div className="h-28 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
              <img
                src={home.heroImageUrl}
                alt="Hero preview"
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-28 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-xs font-medium text-slate-400 dark:border-slate-600 dark:bg-slate-900">
              No image selected
            </div>
          )}

          <div className="space-y-3">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700">
              <ImagePlus size={16} />
              Upload Image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleHeroImageUpload(e.target.files?.[0])}
              />
            </label>

            <input
              value={home.heroImageUrl || ""}
              onChange={(e) => updateHome("heroImageUrl", e.target.value)}
              placeholder="Or paste image URL"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
      </div>

      {fields.map((field) => (
        <div
          key={field.key}
          className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <label className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {field.label}
              </label>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {field.hint}
              </p>
            </div>

            <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              {field.value.length} chars
            </span>
          </div>

          <textarea
            rows={field.rows}
            value={field.value}
            placeholder={field.placeholder}
            onChange={(e) => updateHome(field.key, e.target.value)}
            className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
      ))}

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
        <label className="text-sm font-medium text-slate-800 dark:text-slate-200">
          CTA Button Text
        </label>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Keep it short and action-oriented for stronger conversions.
        </p>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            value={home.ctaText}
            onChange={(e) => updateHome("ctaText", e.target.value)}
            placeholder="Apply Now"
            className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Quick Content Preview
          </h4>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Snapshot of how your hero copy reads before checking full preview.
          </p>
        </div>

        <div className="space-y-4 p-4">
          <div className="rounded-2xl bg-slate-950 p-5 text-white">
            <div
              className="mb-4 h-1 w-14 rounded-full"
              style={{ backgroundColor: config.branding.primaryColor }}
            />
            <h3 className="text-2xl font-black uppercase leading-tight tracking-tight">
              {home.heroHeading || "Get Your Loan Fast & Easy"}
            </h3>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-300">
              {home.heroSubheading || "Home Loans, Business Loans & More"}
            </p>
            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                type="button"
                className="rounded-xl border-2 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em]"
                style={{
                  borderColor: config.branding.primaryColor,
                  color: config.branding.primaryColor,
                }}
              >
                {home.ctaText || "Apply Now"}
              </button>
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                {config.contact.address || "Business Location"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
