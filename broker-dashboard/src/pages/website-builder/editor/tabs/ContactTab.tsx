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
      {/* PHONE */}
      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
        <label className="text-sm font-medium">Phone</label>
        <input
          className="text-sm text-gray-800 mt-1 w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-900"
          type="number"
          value={config.contact.phone}
          onChange={(e) =>
            setConfig({
              ...config,
              contact: { ...config.contact, phone: e.target.value },
            })
          }
        />
      </div>

      {/* WHATSAPP */}
      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
        <label className="text-sm font-medium">WhatsApp</label>
        <input
          type="number"
          className="text-sm text-gray-800 mt-1 w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-900"
          value={config.contact.whatsapp}
          onChange={(e) =>
            setConfig({
              ...config,
              contact: { ...config.contact, whatsapp: e.target.value },
            })
          }
        />
      </div>

      {/* ADDRESS */}
      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
        <label className="text-sm font-medium">Address</label>
        <textarea
          rows={3}
          className="text-sm text-gray-800 mt-1 w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-900"
          value={config.contact.address}
          onChange={(e) =>
            setConfig({
              ...config,
              contact: { ...config.contact, address: e.target.value },
            })
          }
        />
      </div>

      {/* WORKING HOURS */}
      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
        <label className="text-sm font-medium">Working Hours</label>
        <input
          className="text-sm text-gray-800 mt-1 w-full border rounded-lg px-3 py-2 bg-white dark:bg-slate-900"
          placeholder="Mon - Sat, 10:00 AM - 7:00 PM"
          value={config.contact.workingHours}
          onChange={(e) =>
            setConfig({
              ...config,
              contact: { ...config.contact, workingHours: e.target.value },
            })
          }
        />
      </div>
    </div>
  );
}
