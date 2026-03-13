import { useState } from "react";
import SettingsSidebar from "../../components/settings/SettingsSidebar";
import ProfileSettingsCard from "../../components/settings/ProfileSettingsCard";
import LanguageSettingsCard from "../../components/settings/LanguageSettingsCard";
import LocationSettingsCard from "../../components/settings/LocationSettingsCard";
import GeneralSettingsCard from "../../components/settings/GeneralSettingsCard";
import BrandingSettingsCard from "../../components/settings/BrandingSettingsCard";
import SecuritySettingsCard from "../../components/settings/SecuritySettingsCard";
import NotificationsSettingsCard from "../../components/settings/NotificationsSettingsCard";
import BackupSettingsCard from "../../components/settings/BackupSettingsCard";

const SystemSettings = () => {
  const [activeMenu, setActiveMenu] = useState("Profile");

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-white">
          System Settings
        </h1>

        <p className="text-sm text-gray-500 dark:text-gray-400">
          Manage your profile, preferences, security & more
        </p>
      </div>

      <div className="flex gap-6">
        {/* LEFT MENU */}
        <SettingsSidebar
          activeMenu={activeMenu}
          setActiveMenu={setActiveMenu}
        />

        {/* RIGHT CONTENT */}
        <div className="flex-1">
          {activeMenu === "Profile" && <ProfileSettingsCard />}
          {activeMenu === "Language" && <LanguageSettingsCard />}
          {activeMenu === "Location" && <LocationSettingsCard />}
          {activeMenu === "General" && <GeneralSettingsCard />}
          {activeMenu === "Branding" && <BrandingSettingsCard />}
          {activeMenu === "Security" && <SecuritySettingsCard />}
          {activeMenu === "Notifications" && <NotificationsSettingsCard />}
          {activeMenu === "Backup" && <BackupSettingsCard />}
        </div>
      </div>
    </div>
  );
};

export default SystemSettings;
