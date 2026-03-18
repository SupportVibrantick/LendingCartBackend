import { Shield, Lock, Timer, KeyRound } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

type SecuritySettings = {
  sessionTimeout: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
  minPasswordLength: number;
  passwordExpiry: number;
  allowedIPs: string;

  requireUppercase: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
  auditLogging: boolean;
};

const defaultSettings: SecuritySettings = {
  sessionTimeout: 30,
  maxLoginAttempts: 5,
  lockoutDuration: 15,
  minPasswordLength: 8,
  passwordExpiry: 90,
  allowedIPs: "",

  requireUppercase: true,
  requireNumber: true,
  requireSpecial: true,
  auditLogging: true,
};

const SecuritySettingsCard = () => {
  const [settings, setSettings] = useState<SecuritySettings>(defaultSettings);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setSettings({
      ...settings,
      [e.target.name]:
        e.target.type === "number" ? Number(e.target.value) : e.target.value,
    });
  };

  const toggle = (key: keyof SecuritySettings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const saveSettings = () => {
    localStorage.setItem("security_settings", JSON.stringify(settings));
    toast.success("Security settings saved");
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    toast.success("Security settings reset");
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-md p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-11 h-11 rounded-xl bg-[#13538A]/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-[#13538A]" />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[#13538A]">
            Security Settings
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Configure password policies, session control and access security.
          </p>
        </div>
      </div>

      {/* Session Settings */}
      <Section title="Session Control">
        <Input
          icon={<Timer size={14} />}
          label="Session Timeout (minutes)"
          name="sessionTimeout"
          value={settings.sessionTimeout}
          onChange={handleChange}
        />

        <Input
          icon={<Lock size={14} />}
          label="Max Failed Login Attempts"
          name="maxLoginAttempts"
          value={settings.maxLoginAttempts}
          onChange={handleChange}
        />

        <Input
          icon={<Timer size={14} />}
          label="Lockout Duration (minutes)"
          name="lockoutDuration"
          value={settings.lockoutDuration}
          onChange={handleChange}
        />
      </Section>

      {/* Password Policy */}
      <Section title="Password Policy">
        <Input
          icon={<KeyRound size={14} />}
          label="Minimum Password Length"
          name="minPasswordLength"
          value={settings.minPasswordLength}
          onChange={handleChange}
        />

        <Input
          icon={<Timer size={14} />}
          label="Password Expiry (days)"
          name="passwordExpiry"
          value={settings.passwordExpiry}
          onChange={handleChange}
        />
      </Section>

      {/* IP Restriction */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Access Restrictions
        </h3>

        <label className="text-xs text-gray-600 dark:text-gray-400">
          Allowed IP Ranges
        </label>

        <textarea
          name="allowedIPs"
          value={settings.allowedIPs}
          onChange={handleChange}
          placeholder="192.168.1.1"
          className="w-full mt-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2
  bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#13538A]"
        />

        <p className="text-xs text-gray-400 mt-1">
          Restrict access by IP (one per line, leave blank to allow all)
        </p>
      </div>

      {/* Toggles */}
      <div className="space-y-3 mb-8">
        <Toggle
          label="Require Uppercase Letters"
          desc="Password must contain at least one uppercase letter"
          value={settings.requireUppercase}
          onChange={() => toggle("requireUppercase")}
        />

        <Toggle
          label="Require Numbers"
          desc="Password must contain at least one digit"
          value={settings.requireNumber}
          onChange={() => toggle("requireNumber")}
        />

        <Toggle
          label="Require Special Characters"
          desc="Password must include special characters"
          value={settings.requireSpecial}
          onChange={() => toggle("requireSpecial")}
        />

        <Toggle
          label="Enable Audit Logging"
          desc="Track all important user actions"
          value={settings.auditLogging}
          onChange={() => toggle("auditLogging")}
        />
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-3">
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

const Section = ({ title, children }: any) => (
  <div className="mb-8">
    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
      {title}
    </h3>

    <div className="grid grid-cols-2 gap-4">{children}</div>
  </div>
);

const Input = ({ label, name, value, onChange, icon }: any) => (
  <div>
    <label className="text-xs text-gray-600 dark:text-gray-400">{label}</label>

    <div className="relative mt-1">
      {icon && (
        <span className="absolute left-3 top-2.5 text-gray-400">{icon}</span>
      )}

      <input
        type="number"
        name={name}
        value={value}
        onChange={onChange}
        className={`w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2
        bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-[#13538A]
        ${icon ? "pl-9" : ""}`}
      />
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

export default SecuritySettingsCard;
