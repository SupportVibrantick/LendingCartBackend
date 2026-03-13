import {
  User,
  Globe,
  MapPin,
  Settings,
  Palette,
  Shield,
  Bell,
  Database,
} from "lucide-react";

const menuItems = [
  {
    name: "Profile",
    icon: User,
    description: "Manage your personal information and account details.",
  },
  {
    name: "Language",
    icon: Globe,
    description: "Choose your preferred language for the platform.",
  },
  {
    name: "Location",
    icon: MapPin,
    description: "Update your region, timezone and location settings.",
  },
  {
    name: "General",
    icon: Settings,
    description: "Configure general system preferences and defaults.",
  },
  {
    name: "Branding",
    icon: Palette,
    description: "Customize colors, logos and brand appearance.",
  },
  {
    name: "Security",
    icon: Shield,
    description: "Protect your account with password and security options.",
  },
  {
    name: "Notifications",
    icon: Bell,
    description: "Control email, SMS and push notifications.",
  },
  {
    name: "Backup",
    icon: Database,
    description: "Manage system backups and data recovery settings.",
  },
];

interface Props {
  activeMenu: string;
  setActiveMenu: (menu: string) => void;
}

const SettingsSidebar = ({ activeMenu, setActiveMenu }: Props) => {
  return (
    <div className="w-[300px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-md p-5">

      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[#13538A]">
          Settings Panel
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage your account preferences, security options, and platform
          configurations from here.
        </p>
      </div>

      {/* Menu */}
      <div className="space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = activeMenu === item.name;

          return (
            <button
              key={item.name}
              onClick={() => setActiveMenu(item.name)}
              className={`group w-full flex items-start gap-3 p-3 rounded-xl transition-all duration-200 text-left
              
              ${
                active
                  ? "bg-[#13538A] text-white shadow-md"
                  : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
              }
              
              `}
            >
              {/* Icon */}
              <div
                className={`flex items-center justify-center w-9 h-9 rounded-lg transition
                ${
                  active
                    ? "bg-white/20"
                    : "bg-[#13538A]/10 text-[#13538A] group-hover:bg-[#13538A]/20"
                }`}
              >
                <Icon size={18} />
              </div>

              {/* Text */}
              <div>
                <p className="text-sm font-semibold">{item.name}</p>
                <p
                  className={`text-xs mt-0.5 leading-snug
                  ${
                    active
                      ? "text-white/80"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {item.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SettingsSidebar;