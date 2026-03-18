import { Bell, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

type Settings = {
  smsProvider: string;
  smsApiKey: string;
  smsSender: string;
  whatsappApiKey: string;

  fromEmail: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;

  smsEnabled: boolean;
  whatsappEnabled: boolean;
  emailEnabled: boolean;

  grievanceFiled: boolean;
  grievanceResolved: boolean;
  birthdayReminder: boolean;
};

const defaultSettings: Settings = {
  smsProvider: "twilio",
  smsApiKey: "",
  smsSender: "CONSTY",
  whatsappApiKey: "",

  fromEmail: "noreply@constituency.gov.in",
  smtpHost: "",
  smtpPort: 587,
  smtpUser: "",
  smtpPassword: "",

  smsEnabled: false,
  whatsappEnabled: false,
  emailEnabled: false,

  grievanceFiled: true,
  grievanceResolved: true,
  birthdayReminder: true,
};

const NotificationsSettingsCard = () => {
  const [settings, setSettings] = useState(defaultSettings);
  const [showKey, setShowKey] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setSettings({
      ...settings,
      [e.target.name]:
        e.target.type === "number" ? Number(e.target.value) : e.target.value,
    });
  };

  const toggle = (key: keyof Settings) => {
    setSettings({
      ...settings,
      [key]: !settings[key],
    });
  };

  const saveSettings = () => {
    localStorage.setItem("notification_settings", JSON.stringify(settings));
    toast.success("Notification settings saved");
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    toast.success("Settings reset");
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-md p-8">

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">

        <div className="w-11 h-11 rounded-xl bg-[#13538A]/10 flex items-center justify-center">
          <Bell className="w-5 h-5 text-[#13538A]" />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[#13538A]">
            Notifications Settings
          </h2>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            Configure SMS, WhatsApp and email notifications.
          </p>
        </div>

      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-4">

        <Select
          label="SMS Provider"
          name="smsProvider"
          value={settings.smsProvider}
          onChange={handleChange}
          options={["twilio", "msg91", "textlocal"]}
        />

        <PasswordInput
          label="SMS API Key"
          name="smsApiKey"
          value={settings.smsApiKey}
          show={showKey}
          toggle={() => setShowKey(!showKey)}
          onChange={handleChange}
        />

        <Input
          label="SMS Sender ID"
          name="smsSender"
          value={settings.smsSender}
          onChange={handleChange}
        />

        <PasswordInput
          label="WhatsApp API Key"
          name="whatsappApiKey"
          value={settings.whatsappApiKey}
          show={showKey}
          toggle={() => setShowKey(!showKey)}
          onChange={handleChange}
        />

        <Input
          label="From Email"
          name="fromEmail"
          value={settings.fromEmail}
          onChange={handleChange}
        />

        <Input
          label="SMTP Host"
          name="smtpHost"
          value={settings.smtpHost}
          onChange={handleChange}
        />

        <Input
          label="SMTP Port"
          name="smtpPort"
          value={settings.smtpPort}
          onChange={handleChange}
        />

        <Input
          label="SMTP Username"
          name="smtpUser"
          value={settings.smtpUser}
          onChange={handleChange}
        />

        <PasswordInput
          label="SMTP Password"
          name="smtpPassword"
          value={settings.smtpPassword}
          show={showKey}
          toggle={() => setShowKey(!showKey)}
          onChange={handleChange}
        />

      </div>

      {/* Toggles */}
      <div className="mt-6 space-y-3">

        <Toggle
          label="SMS Enabled"
          desc="Send SMS notifications"
          value={settings.smsEnabled}
          onChange={() => toggle("smsEnabled")}
        />

        <Toggle
          label="WhatsApp Enabled"
          desc="Send WhatsApp messages"
          value={settings.whatsappEnabled}
          onChange={() => toggle("whatsappEnabled")}
        />

        <Toggle
          label="Email Enabled"
          desc="Send email notifications"
          value={settings.emailEnabled}
          onChange={() => toggle("emailEnabled")}
        />

        <Toggle
          label="Notify on Grievance Filed"
          desc="Send confirmation to citizen"
          value={settings.grievanceFiled}
          onChange={() => toggle("grievanceFiled")}
        />

        <Toggle
          label="Notify on Grievance Resolved"
          desc="Send resolution notice"
          value={settings.grievanceResolved}
          onChange={() => toggle("grievanceResolved")}
        />

        <Toggle
          label="Birthday Reminders"
          desc="Daily birthday alerts"
          value={settings.birthdayReminder}
          onChange={() => toggle("birthdayReminder")}
        />

      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-3 mt-8">

        <button
          onClick={resetSettings}
          className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          Reset
        </button>

        <button
          onClick={saveSettings}
          className="px-6 py-2 text-sm bg-[#13538A] text-white rounded-lg hover:bg-[#0f436e] transition shadow"
        >
          Save Changes
        </button>

      </div>

    </div>
  );
};

const Input = ({ label, ...props }: any) => (
  <div>
    <label className="text-xs text-gray-600 dark:text-gray-400">{label}</label>

    <input
      {...props}
      className="w-full mt-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#13538A]"
    />
  </div>
);

const Select = ({ label, options, ...props }: any) => (
  <div>
    <label className="text-xs text-gray-600 dark:text-gray-400">{label}</label>

    <select
      {...props}
      className="w-full mt-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#13538A]"
    >
      {options.map((o: string) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  </div>
);

const PasswordInput = ({ label, show, toggle, ...props }: any) => (
  <div>
    <label className="text-xs text-gray-600 dark:text-gray-400">{label}</label>

    <div className="relative">

      <input
        type={show ? "text" : "password"}
        {...props}
        className="w-full mt-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 pr-10 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#13538A]"
      />

      <button
        type="button"
        onClick={toggle}
        className="absolute right-3 top-3 text-gray-500"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>

    </div>
  </div>
);

const Toggle = ({ label, desc, value, onChange }: any) => (
  <div className="flex items-center justify-between border border-gray-200 dark:border-gray-700 rounded-lg p-4">

    <div>
      <p className="text-sm font-medium dark:text-white">{label}</p>
      <p className="text-xs text-gray-500">{desc}</p>
    </div>

    <button
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition
      ${value ? "bg-[#13538A]" : "bg-gray-300 dark:bg-gray-600"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition
        ${value ? "translate-x-6" : "translate-x-1"}`}
      />
    </button>

  </div>
);

export default NotificationsSettingsCard;