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
      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
        <label className="text-sm font-medium">Logo</label>

        <div className="mt-2 flex items-center gap-4">
          {/* PREVIEW */}
          {config.branding.logoUrl ? (
            <img
              src={config.branding.logoUrl}
              className="h-16 object-contain border rounded p-2 bg-white"
            />
          ) : (
            <div className="h-16 w-32 flex items-center justify-center border rounded text-xs text-slate-400 bg-white">
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
            <div className="text-xs px-4 py-2 bg-blue-600 text-white rounded-lg">
              Upload
            </div>
          </label>

          {/* REMOVE */}
          {config.branding.logoUrl && (
            <button
              className="text-xs px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
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
      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
        <label className="text-sm font-medium">Brand Name</label>
        <input
          className="text-gray-800 text-sm mt-1 w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-900"
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
      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
        <label className="text-sm font-medium">Logo / Brand Text Color</label>

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
            className="h-10 w-14 rounded border"
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
            className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono"
          />
        </div>

        <p className="text-xs text-slate-500 mt-1">
          Used when logo is not uploaded (text logo)
        </p>
      </div>

      {/* PRIMARY COLOR */}
      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
        <label className="text-sm font-medium">Primary Color</label>

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
              className="h-7 w-14 rounded cursor-pointer shadow-sm border"
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
            className="text-gray-800 flex-1 border rounded-lg px-3 py-2 text-xs bg-white dark:bg-slate-900 font-mono"
            placeholder="#2563EB"
          />
        </div>
      </div>
    </div>
  );
}
