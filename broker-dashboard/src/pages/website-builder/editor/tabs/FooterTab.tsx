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
      <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Footer Background Color
        </label>

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
            className="h-8 w-16 rounded border border-slate-300 dark:border-slate-600 bg-transparent"
          />

          <input
            value={config.footer.bgColor}
            onChange={(e) =>
              setConfig({
                ...config,
                footer: { ...config.footer, bgColor: e.target.value },
              })
            }
            className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-mono bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
          />
        </div>
      </div>

      {/* TEXT */}
      <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Footer Text
        </label>

        <textarea
          value={config.footer.text}
          onChange={(e) =>
            setConfig({
              ...config,
              footer: { ...config.footer, text: e.target.value },
            })
          }
          rows={3}
          className="mt-2 w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
          placeholder="© 2026 Your Company. All rights reserved."
        />
      </div>

    </div>
  );
}
