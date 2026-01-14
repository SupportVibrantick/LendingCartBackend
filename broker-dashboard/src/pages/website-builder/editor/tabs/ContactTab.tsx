import { SiteConfig } from "../../../../types/siteBuilder";

export default function ContactTab({
  config,
  setConfig,
}: {
  config: SiteConfig;
  setConfig: (c: SiteConfig) => void;
}) {
  return (
    <div className="space-y-4">

      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
        <label className="text-sm">Phone</label>
        <input
          className="mt-1 w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-900"
          value={config.contact.phone}
          onChange={(e) =>
            setConfig({
              ...config,
              contact: { ...config.contact, phone: e.target.value },
            })
          }
        />
      </div>

      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
        <label className="text-sm">WhatsApp</label>
        <input
          className="mt-1 w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-900"
          value={config.contact.whatsapp}
          onChange={(e) =>
            setConfig({
              ...config,
              contact: { ...config.contact, whatsapp: e.target.value },
            })
          }
        />
      </div>

    </div>
  );
}
