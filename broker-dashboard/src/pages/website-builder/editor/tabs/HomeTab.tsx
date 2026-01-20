import { SiteConfig } from "../../../../types/siteBuilder";

export default function HomeTab({
  config,
  setConfig,
}: {
  config: SiteConfig;
  setConfig: (c: SiteConfig) => void;
}) {
  const handleHeroImageUpload = (file?: File) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setConfig({
        ...config,
        home: { ...config.home, heroImageUrl: reader.result as string },
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">

      {/* HERO IMAGE */}
      <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl">
        <label className="text-sm font-medium text-slate-800 dark:text-slate-200">
          Hero Banner Image
        </label>

        <div className="mt-3 flex items-center gap-4 flex-wrap">
          {config.home.heroImageUrl ? (
            <div className="h-20 w-32 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
              <img
                src={config.home.heroImageUrl}
                alt="Hero"
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="h-20 w-32 flex items-center justify-center border border-dashed border-slate-300 dark:border-slate-600 rounded text-xs text-slate-400 bg-white dark:bg-slate-900">
              No Image
            </div>
          )}

          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleHeroImageUpload(e.target.files?.[0])}
            />
            <div className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs">
              Upload Image
            </div>
          </label>
        </div>
      </div>

      {/* HERO HEADING */}
      <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl">
        <label className="text-sm font-medium text-slate-800 dark:text-slate-200">
          Hero Heading
        </label>
        <input
          className="mt-1 w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
          value={config.home.heroHeading}
          onChange={(e) =>
            setConfig({
              ...config,
              home: { ...config.home, heroHeading: e.target.value },
            })
          }
        />
      </div>

      {/* SUBHEADING */}
      <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl">
        <label className="text-sm font-medium text-slate-800 dark:text-slate-200">
          Subheading
        </label>
        <input
          className="mt-1 w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
          value={config.home.heroSubheading}
          onChange={(e) =>
            setConfig({
              ...config,
              home: { ...config.home, heroSubheading: e.target.value },
            })
          }
        />
      </div>

      {/* CTA TEXT */}
      <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl">
        <label className="text-sm font-medium text-slate-800 dark:text-slate-200">
          CTA Button Text
        </label>
        <input
          className="mt-1 w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
          value={config.home.ctaText}
          onChange={(e) =>
            setConfig({
              ...config,
              home: { ...config.home, ctaText: e.target.value },
            })
          }
        />
      </div>

    </div>
  );
}
