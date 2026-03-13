import {
  Settings,
  Building,
  User,
  Phone,
  Mail,
  Globe,
  Clock,
} from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

const GeneralSettingsCard = () => {
  const [form, setForm] = useState({
    organizationName: "MP/MLA Constituency Office",
    shortName: "CMP",
    constituencyName: "Chandni Chowk",
    constituencyType: "Parliamentary",
    state: "Delhi",
    district: "Central Delhi",
    representativeName: "Shri Example Singh",
    representativeTitle: "Member of Parliament",
    officeAddress: "Constituency Office, Main Road",
    officePhone: "+91 11 1234 5678",
    officeEmail: "office@constituency.gov.in",
    website: "",
    timezone: "Asia/Kolkata",
    defaultLanguage: "en",
    financialYear: "April",
    dateFormat: "dd/MM/yyyy",
    currency: "₹",
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const saveSettings = () => {
    localStorage.setItem("general_settings", JSON.stringify(form));
    toast.success("Settings saved successfully");
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-md p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-11 h-11 rounded-xl bg-[#13538A]/10 flex items-center justify-center">
          <Settings className="w-5 h-5 text-[#13538A]" />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[#13538A]">
            General Settings
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Configure organization information, office details and system
            preferences.
          </p>
        </div>
      </div>

      {/* Organization */}
      <Section title="Organization Information">
        <Input
          icon={<Building size={14} />}
          label="Organization Name"
          name="organizationName"
          value={form.organizationName}
          onChange={handleChange}
        />

        <Input
          label="Short Name"
          name="shortName"
          value={form.shortName}
          onChange={handleChange}
        />

        <Input
          label="Constituency Name"
          name="constituencyName"
          value={form.constituencyName}
          onChange={handleChange}
        />

        <Select
          label="Constituency Type"
          name="constituencyType"
          value={form.constituencyType}
          options={["Parliamentary", "Assembly"]}
          onChange={handleChange}
        />

        <Input
          label="State"
          name="state"
          value={form.state}
          onChange={handleChange}
        />
        <Input
          label="District"
          name="district"
          value={form.district}
          onChange={handleChange}
        />
      </Section>

      {/* Representative */}
      <Section title="Representative Details">
        <Input
          icon={<User size={14} />}
          label="Representative Name"
          name="representativeName"
          value={form.representativeName}
          onChange={handleChange}
        />

        <Select
          label="Representative Title"
          name="representativeTitle"
          value={form.representativeTitle}
          options={["Member of Parliament", "MLA", "Minister"]}
          onChange={handleChange}
        />
      </Section>

      {/* Office */}
      <Section title="Office Contact">
        <div className="col-span-2">
          <label className="text-xs text-gray-600 dark:text-gray-400">
            Office Address
          </label>

          <textarea
            name="officeAddress"
            value={form.officeAddress}
            onChange={handleChange}
            className="w-full mt-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#13538A]"
          />
        </div>

        <Input
          icon={<Phone size={14} />}
          label="Office Phone"
          name="officePhone"
          value={form.officePhone}
          onChange={handleChange}
        />

        <Input
          icon={<Mail size={14} />}
          label="Office Email"
          name="officeEmail"
          value={form.officeEmail}
          onChange={handleChange}
        />

        <Input
          icon={<Globe size={14} />}
          label="Website"
          name="website"
          value={form.website}
          onChange={handleChange}
        />
      </Section>

      {/* Locale */}
      <Section title="Regional Preferences">
        <Select
          icon={<Clock size={14} />}
          label="Timezone"
          name="timezone"
          value={form.timezone}
          options={["Asia/Kolkata", "UTC", "Europe/London", "America/New_York"]}
          onChange={handleChange}
        />

        <Select
          label="Default Language"
          name="defaultLanguage"
          value={form.defaultLanguage}
          options={["en", "hi", "fr", "es"]}
          onChange={handleChange}
        />

        <Select
          label="Financial Year"
          name="financialYear"
          value={form.financialYear}
          options={["January", "April", "July"]}
          onChange={handleChange}
        />

        <Select
          label="Date Format"
          name="dateFormat"
          value={form.dateFormat}
          options={["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"]}
          onChange={handleChange}
        />

        <Input
          label="Currency Symbol"
          name="currency"
          value={form.currency}
          onChange={handleChange}
        />
      </Section>

      {/* Save */}
      <div className="flex justify-end mt-8">
        <button
          onClick={saveSettings}
          className="px-6 py-2.5 text-sm bg-[#13538A] text-white rounded-lg hover:bg-[#0f436e] transition shadow font-medium"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

const Section = ({ title, children }: any) => (
  <div className="mb-8">
    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
      {title}
    </h3>

    <div className="grid grid-cols-2 gap-4">{children}</div>
  </div>
);

const Input = ({ label, icon, ...props }: any) => (
  <div>
    <label className="text-xs text-gray-600 dark:text-gray-400">{label}</label>

    <div className="relative mt-1">
      {icon && (
        <span className="absolute left-3 top-2.5 text-gray-400">{icon}</span>
      )}

      <input
        {...props}
        className={`w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2
        bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-[#13538A]
        ${icon ? "pl-9" : ""}`}
      />
    </div>
  </div>
);

const Select = ({ label, icon, options, ...props }: any) => (
  <div>
    <label className="text-xs text-gray-600 dark:text-gray-400">{label}</label>

    <div className="relative mt-1">
      {icon && (
        <span className="absolute left-3 top-2.5 text-gray-400">{icon}</span>
      )}

      <select
        {...props}
        className={`w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2
        bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-[#13538A]
        ${icon ? "pl-9" : ""}`}
      >
        {options.map((o: string) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  </div>
);

export default GeneralSettingsCard;
