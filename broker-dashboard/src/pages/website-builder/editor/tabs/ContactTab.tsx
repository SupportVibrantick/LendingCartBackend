import { SiteConfig } from "../../../../types/siteBuilder";

export default function ContactTab({
  config,
  setConfig,
}: {
  config: SiteConfig;
  setConfig: (c: SiteConfig) => void;
}) {
  const social = config.contact.social || {};

  const updateSocial = (key: string, value: string) => {
    setConfig({
      ...config,
      contact: {
        ...config.contact,
        social: {
          ...social,
          [key]: value,
        },
      },
    });
  };

  return (
    <div className="space-y-4">

      {/* PHONE */}
      <Field label="Phone">
        <input
          type="tel"
          className={inputClass}
          value={config.contact.phone}
          onChange={(e) =>
            setConfig({
              ...config,
              contact: { ...config.contact, phone: e.target.value },
            })
          }
        />
      </Field>

      {/* WHATSAPP */}
      <Field label="WhatsApp">
        <input
          type="tel"
          className={inputClass}
          value={config.contact.whatsapp}
          onChange={(e) =>
            setConfig({
              ...config,
              contact: { ...config.contact, whatsapp: e.target.value },
            })
          }
        />
      </Field>

      {/* EMAIL */}
      <Field label="Email">
        <input
          type="email"
          className={inputClass}
          value={config.contact.email}
          onChange={(e) =>
            setConfig({
              ...config,
              contact: { ...config.contact, email: e.target.value },
            })
          }
        />
      </Field>

      {/* ADDRESS */}
      <Field label="Address">
        <textarea
          rows={3}
          className={inputClass}
          value={config.contact.address}
          onChange={(e) =>
            setConfig({
              ...config,
              contact: { ...config.contact, address: e.target.value },
            })
          }
        />
      </Field>

      {/* WORKING HOURS */}
      <Field label="Working Hours">
        <input
          className={inputClass}
          placeholder="Mon - Sat, 10:00 AM - 7:00 PM"
          value={config.contact.workingHours}
          onChange={(e) =>
            setConfig({
              ...config,
              contact: {
                ...config.contact,
                workingHours: e.target.value,
              },
            })
          }
        />
      </Field>

      {/* ================= SOCIAL MEDIA ================= */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
        <div className="font-semibold text-sm text-slate-700 dark:text-slate-200 mb-2">
          Social Media Links
        </div>

        <Field label="Facebook URL">
          <input
            className={inputClass}
            placeholder="https://facebook.com/yourpage"
            value={social.facebook || ""}
            onChange={(e) => updateSocial("facebook", e.target.value)}
          />
        </Field>

        <Field label="Instagram URL">
          <input
            className={inputClass}
            placeholder="https://instagram.com/yourprofile"
            value={social.instagram || ""}
            onChange={(e) => updateSocial("instagram", e.target.value)}
          />
        </Field>

        <Field label="LinkedIn URL">
          <input
            className={inputClass}
            placeholder="https://linkedin.com/company/yourcompany"
            value={social.linkedin || ""}
            onChange={(e) => updateSocial("linkedin", e.target.value)}
          />
        </Field>

        <Field label="Twitter / X URL">
          <input
            className={inputClass}
            placeholder="https://x.com/yourprofile"
            value={social.twitter || ""}
            onChange={(e) => updateSocial("twitter", e.target.value)}
          />
        </Field>
      </div>

    </div>
  );
}

/* ================= UI HELPERS ================= */

const inputClass =
  "mt-1 w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      {children}
    </div>
  );
}
