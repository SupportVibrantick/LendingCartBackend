import { SiteConfig } from "../../../../types/siteBuilder";

export default function HomeTab({
  config,
  setConfig,
}: {
  config: SiteConfig;
  setConfig: (c: SiteConfig) => void;
}) {
  const handleHeroImageUpload = (file: File) => {
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

      {/* HERO IMAGE UPLOAD */}
      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
        <label className="text-sm font-medium">Hero Banner Image</label>

        <div className="mt-2 flex items-center gap-4">
          {config.home.heroImageUrl ? (
            <img
              src={config.home.heroImageUrl}
              alt="Hero"
              className="h-20 w-32 object-cover rounded border bg-white"
            />
          ) : (
            <div className="h-20 w-32 flex items-center justify-center border rounded text-xs text-slate-400 bg-white">
              No Image
            </div>
          )}

          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleHeroImageUpload(e.target.files[0]);
                }
              }}
            />
            <div className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs">
              Upload Image
            </div>
          </label>
        </div>
      </div>

      {/* HERO HEADING */}
      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
        <label className="text-sm font-medium">Hero Heading</label>
        <input
          className="text-gray-800 text-sm mt-1 w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-900"
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
      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
        <label className="text-sm font-medium">Subheading</label>
        <input
          className="text-gray-800 text-sm mt-1 w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-900"
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
      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
        <label className="text-sm font-medium">CTA Button Text</label>
        <input
          className="text-gray-800 text-sm mt-1 w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-900"
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
