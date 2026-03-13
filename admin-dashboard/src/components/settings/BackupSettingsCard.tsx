import { Database } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

type BackupSettings = {
  frequency: string;
  time: string;
  retention: number;
  storage: string;
  autoBackup: boolean;
};

const defaultSettings: BackupSettings = {
  frequency: "daily",
  time: "02:00",
  retention: 30,
  storage: "local",
  autoBackup: true,
};

const BackupSettingsCard = () => {
  const [settings, setSettings] = useState<BackupSettings>(defaultSettings);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setSettings({
      ...settings,
      [e.target.name]:
        e.target.type === "number"
          ? Number(e.target.value)
          : e.target.value,
    });
  };

  const toggle = () => {
    setSettings((prev) => ({
      ...prev,
      autoBackup: !prev.autoBackup,
    }));
  };

  const saveSettings = () => {
    localStorage.setItem("backup_settings", JSON.stringify(settings));
    toast.success("Backup settings saved");
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    toast.success("Backup settings reset");
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-md p-8">

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">

        <div className="w-11 h-11 rounded-xl bg-[#13538A]/10 flex items-center justify-center">
          <Database className="w-5 h-5 text-[#13538A]" />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[#13538A]">
            Backup Settings
          </h2>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            Configure automatic data backups and storage preferences.
          </p>
        </div>

      </div>

      {/* Form */}
      <div className="grid grid-cols-2 gap-4">

        <Select
          label="Backup Frequency"
          name="frequency"
          value={settings.frequency}
          onChange={handleChange}
          options={["hourly", "daily", "weekly", "monthly"]}
          desc="How often backups should run"
        />

        <Input
          label="Backup Time"
          name="time"
          type="time"
          value={settings.time}
          onChange={handleChange}
          desc="Scheduled time (24h)"
        />

        <Input
          label="Retention (days)"
          name="retention"
          type="number"
          value={settings.retention}
          onChange={handleChange}
          desc="How long backups are kept"
        />

        <Select
          label="Storage Location"
          name="storage"
          value={settings.storage}
          onChange={handleChange}
          options={["local", "s3", "gcs", "azure"]}
          desc="Where backups will be stored"
        />

      </div>

      {/* Toggle */}
      <div className="mt-6 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex items-center justify-between">

        <div>
          <p className="text-sm font-medium dark:text-white">
            Auto Backup
          </p>

          <p className="text-xs text-gray-500">
            Enable scheduled automatic backups
          </p>
        </div>

        <button
          onClick={toggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition
          ${settings.autoBackup ? "bg-[#13538A]" : "bg-gray-300 dark:bg-gray-600"}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition
            ${settings.autoBackup ? "translate-x-6" : "translate-x-1"}`}
          />
        </button>

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

const Input = ({ label, desc, ...props }: any) => (
  <div>

    <label className="text-xs text-gray-600 dark:text-gray-400">
      {label}
    </label>

    <input
      {...props}
      className="w-full mt-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#13538A]"
    />

    {desc && (
      <p className="text-xs text-gray-400 mt-1">
        {desc}
      </p>
    )}

  </div>
);

const Select = ({ label, options, desc, ...props }: any) => (
  <div>

    <label className="text-xs text-gray-600 dark:text-gray-400">
      {label}
    </label>

    <select
      {...props}
      className="w-full mt-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#13538A]"
    >
      {options.map((o: string) => (
        <option key={o}>{o}</option>
      ))}
    </select>

    {desc && (
      <p className="text-xs text-gray-400 mt-1">
        {desc}
      </p>
    )}

  </div>
);

export default BackupSettingsCard;