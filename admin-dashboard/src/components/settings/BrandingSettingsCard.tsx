import { Palette } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

type Colors = {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  danger: string;
};

const defaultColors: Colors = {
  primary: "#13538A",
  secondary: "#7c3aed",
  success: "#16a34a",
  warning: "#d97706",
  danger: "#dc2626",
};

const BrandingSettingsCard = () => {
  const [colors, setColors] = useState<Colors>(defaultColors);

  const handleChange = (key: keyof Colors, value: string) => {
    setColors((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const saveColors = () => {
    localStorage.setItem("branding_colors", JSON.stringify(colors));
    toast.success("Branding settings saved");
  };

  const resetColors = () => {
    setColors(defaultColors);
    toast.success("Colors reset to default");
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-md p-8">

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">

        <div className="w-11 h-11 rounded-xl bg-[#13538A]/10 flex items-center justify-center">
          <Palette className="w-5 h-5 text-[#13538A]" />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[#13538A]">
            Branding Settings
          </h2>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            Customize your application theme colors and brand appearance.
          </p>
        </div>

      </div>

      {/* Color Fields */}
      <div className="space-y-5">

        <ColorField
          label="Primary Color"
          description="Main brand color used for buttons and highlights."
          value={colors.primary}
          onChange={(v) => handleChange("primary", v)}
        />

        <ColorField
          label="Secondary Color"
          description="Accent color used across UI elements."
          value={colors.secondary}
          onChange={(v) => handleChange("secondary", v)}
        />

        <ColorField
          label="Success Color"
          description="Used for success alerts and confirmations."
          value={colors.success}
          onChange={(v) => handleChange("success", v)}
        />

        <ColorField
          label="Warning Color"
          description="Used for warning messages."
          value={colors.warning}
          onChange={(v) => handleChange("warning", v)}
        />

        <ColorField
          label="Danger Color"
          description="Used for error messages and destructive actions."
          value={colors.danger}
          onChange={(v) => handleChange("danger", v)}
        />

      </div>

      {/* Preview */}
      <div className="mt-8">

        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Theme Preview
        </h3>

        <div className="grid grid-cols-5 gap-3">

          {Object.entries(colors).map(([key, color]) => (
            <div
              key={key}
              className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center"
            >
              <div
                className="h-10 rounded-md mb-2"
                style={{ background: color }}
              />

              <span className="text-xs text-gray-500 dark:text-gray-400">
                {key}
              </span>
            </div>
          ))}

        </div>

      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-3 mt-8">

        <button
          onClick={resetColors}
          className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        >
          Reset
        </button>

        <button
          onClick={saveColors}
          className="px-6 py-2.5 text-sm bg-[#13538A] text-white rounded-lg hover:bg-[#0f436e] transition shadow font-medium"
        >
          Save Changes
        </button>

      </div>

    </div>
  );
};

type ColorFieldProps = {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
};

const ColorField = ({ label, description, value, onChange }: ColorFieldProps) => (
  <div>

    <div className="flex justify-between items-center mb-1">

      <div>
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>

        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {description}
          </p>
        )}
      </div>

    </div>

    <div className="grid grid-cols-[50px_1fr_60px] gap-3 items-center">

      {/* Picker */}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-11 h-9 rounded-md border cursor-pointer"
      />

      {/* Hex Input */}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2
        bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-[#13538A]"
      />

      {/* Preview */}
      <div
        className="h-9 rounded-md border"
        style={{ background: value }}
      />

    </div>

  </div>
);

export default BrandingSettingsCard;