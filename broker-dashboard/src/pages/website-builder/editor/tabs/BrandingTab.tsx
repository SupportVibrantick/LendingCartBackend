import { useState } from "react";
import { SiteConfig } from "../../../../types/siteBuilder";

export default function BrandingTab({
  config,
  setConfig,
}: {
  config: SiteConfig;
  setConfig: (c: SiteConfig) => void;
}) {
  const handleLogoUpload = (file?: File) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setConfig({
        ...config,
        branding: {
          ...config.branding,
          logoUrl: reader.result as string,
        },
      });
    };
    reader.readAsDataURL(file);
  };

  const [fileInputKey, setFileInputKey] = useState(0);

  return (
    <div className="space-y-4">

      {/* LOGO */}
      <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl">
        <label className="text-sm font-medium text-slate-800 dark:text-slate-200">
          Logo
        </label>

        <div className="mt-3 flex items-center gap-4 flex-wrap">
          {/* PREVIEW */}
          {config.branding.logoUrl ? (
            <div className="h-16 w-32 flex items-center justify-center border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 p-2">
              <img
                src={config.branding.logoUrl}
                className="h-full object-contain"
              />
            </div>
          ) : (
            <div className="h-16 w-32 flex items-center justify-center border border-dashed border-slate-300 dark:border-slate-600 rounded text-xs text-slate-400 bg-white dark:bg-slate-900">
              No Logo
            </div>
          )}

          {/* UPLOAD */}
          <label className="cursor-pointer">
            <input
              key={fileInputKey}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleLogoUpload(e.target.files?.[0])}
            />
            <div className="text-xs px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
              Upload
            </div>
          </label>

          {/* REMOVE */}
          {config.branding.logoUrl && (
            <button
              className="text-xs px-3 py-2 bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-500/20"
              onClick={() => {
                setConfig({
                  ...config,
                  branding: {
                    ...config.branding,
                    logoUrl: undefined,
                  },
                });
                setFileInputKey((k) => k + 1);
              }}
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* BRAND NAME */}
      <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl">
        <label className="text-sm font-medium text-slate-800 dark:text-slate-200">
          Brand Name
        </label>
        <input
          className="mt-1 w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
          value={config.branding.brandName}
          onChange={(e) =>
            setConfig({
              ...config,
              branding: { ...config.branding, brandName: e.target.value },
            })
          }
        />
      </div>

      {/* LOGO COLOR */}
      <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl">
        <label className="text-sm font-medium text-slate-800 dark:text-slate-200">
          Logo / Brand Text Color
        </label>

        <div className="flex items-center gap-3 mt-2">
          <input
            type="color"
            value={config.branding.logoColor || "#000000"}
            onChange={(e) =>
              setConfig({
                ...config,
                branding: {
                  ...config.branding,
                  logoColor: e.target.value,
                },
              })
            }
            className="h-10 w-14 rounded border border-slate-300 dark:border-slate-600"
          />

          <input
            value={config.branding.logoColor || "#000000"}
            onChange={(e) =>
              setConfig({
                ...config,
                branding: {
                  ...config.branding,
                  logoColor: e.target.value,
                },
              })
            }
            className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-mono"
          />
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Used when logo is not uploaded (text logo)
        </p>
      </div>

      {/* PRIMARY COLOR */}
      <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl">
        <label className="text-sm font-medium text-slate-800 dark:text-slate-200">
          Primary Color
        </label>

        <div className="mt-3 flex items-center gap-3">
          {/* Color Preview */}
          <label className="relative cursor-pointer">
            <input
              type="color"
              value={config.branding.primaryColor}
              onChange={(e) =>
                setConfig({
                  ...config,
                  branding: {
                    ...config.branding,
                    primaryColor: e.target.value.toUpperCase(),
                  },
                })
              }
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div
              className="h-8 w-16 rounded border border-slate-300 dark:border-slate-600 shadow-sm"
              style={{ backgroundColor: config.branding.primaryColor }}
            />
          </label>

          {/* Hex Input */}
          <input
            type="text"
            value={config.branding.primaryColor}
            onChange={(e) =>
              setConfig({
                ...config,
                branding: {
                  ...config.branding,
                  primaryColor: e.target.value.toUpperCase(),
                },
              })
            }
            className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-mono"
            placeholder="#2563EB"
          />
        </div>
      </div>
    </div>
  );
}
