import { SiteConfig } from "../../../../types/siteBuilder";

export default function FooterTab({
  config,
  setConfig,
}: {
  config: SiteConfig;
  setConfig: (c: SiteConfig) => void;
}) {
  return (
    <div className="space-y-4">

      {/* BG COLOR */}
      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
        <label className="text-sm font-medium">Footer Background Color</label>

        <div className="flex gap-3 items-center mt-2">
          <input
            type="color"
            value={config.footer.bgColor}
            onChange={(e) =>
              setConfig({
                ...config,
                footer: { ...config.footer, bgColor: e.target.value },
              })
            }
            className="h-7 w-14 rounded border"
          />

          <input
            value={config.footer.bgColor}
            onChange={(e) =>
              setConfig({
                ...config,
                footer: { ...config.footer, bgColor: e.target.value },
              })
            }
            className="text-xs text-gray-800 flex-1 border rounded-lg px-3 py-2"
          />
        </div>
      </div>

      {/* TEXT */}
      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
        <label className="text-sm font-medium">Footer Text</label>

        <textarea
          value={config.footer.text}
          onChange={(e) =>
            setConfig({
              ...config,
              footer: { ...config.footer, text: e.target.value },
            })
          }
          rows={3}
          className="mt-2 w-full border rounded-lg px-3 py-2 text-sm text-gray-800"
        />
      </div>
    </div>
  );
}
