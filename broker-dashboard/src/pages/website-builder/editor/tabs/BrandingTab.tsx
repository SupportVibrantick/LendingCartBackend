import { SiteConfig } from "../../../../types/siteBuilder";

export default function BrandingTab({
  config,
  setConfig,
}: {
  config: SiteConfig;
  setConfig: (c: SiteConfig) => void;
}) {
  const handleLogoUpload = (file: File) => {
    const reader = new FileReader();

    reader.onload = () => {
      setConfig({
        ...config,
        branding: {
          ...config.branding,
          logoUrl: reader.result as string, // base64 preview
        },
      });
    };

    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">

      {/* LOGO CARD */}
      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
        <label className="text-sm font-medium">Logo</label>

        <div className="mt-2 flex items-center gap-4">
          {config.branding.logoUrl ? (
            <img
              src={config.branding.logoUrl}
              alt="Logo"
              className="h-16 object-contain border rounded p-2 bg-white"
            />
          ) : (
            <div className="h-16 w-32 flex items-center justify-center border rounded text-xs text-slate-400 bg-white">
              No Logo
            </div>
          )}

          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleLogoUpload(e.target.files[0]);
                }
              }}
            />
            <div className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">
              Upload Logo
            </div>
          </label>
        </div>
      </div>

      {/* BRAND NAME CARD (OPTIONAL BUT NICE UX) */}
      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
        <label className="text-sm font-medium">Brand Name</label>
        <input
          className="mt-1 w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-900"
          value={config.branding.brandName}
          onChange={(e) =>
            setConfig({
              ...config,
              branding: { ...config.branding, brandName: e.target.value },
            })
          }
        />
      </div>

      {/* PRIMARY COLOR CARD */}
      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
        <label className="text-sm font-medium">Primary Color</label>
        <input
          type="color"
          className="mt-2 w-full h-10 rounded"
          value={config.branding.primaryColor}
          onChange={(e) =>
            setConfig({
              ...config,
              branding: { ...config.branding, primaryColor: e.target.value },
            })
          }
        />
      </div>

    </div>
  );
}
