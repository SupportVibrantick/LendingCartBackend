import {
  User,
  Mail,
  Phone,
  Briefcase,
  Building2,
  FileText,
  Camera,
} from "lucide-react";

const ProfileSettingsCard = () => {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-md p-8">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[#13538A]">
          Profile Settings
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage your personal information, contact details and profile
          preferences.
        </p>
      </div>

      {/* Profile Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-[#13538A]/10 text-[#13538A] flex items-center justify-center font-semibold text-lg">
            SA
          </div>

          <button className="absolute -bottom-1 -right-1 bg-[#13538A] text-white p-1.5 rounded-full shadow">
            <Camera size={14} />
          </button>
        </div>

        <div>
          <h3 className="font-semibold text-lg text-gray-800 dark:text-white">
            System Administrator
          </h3>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            Senior Manager • Human Resources
          </p>
        </div>
      </div>

      {/* FORM */}
      <div className="grid grid-cols-2 gap-5">
        {/* Full Name */}
        <div>
          <label className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
            <User size={14} /> Full Name
          </label>

          <input
            type="text"
            defaultValue="System Administrator"
            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 mt-1 
            bg-white dark:bg-gray-800 text-gray-700 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-[#13538A]"
          />
        </div>

        {/* Email */}
        <div>
          <label className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
            <Mail size={14} /> Email Address
          </label>

          <input
            type="email"
            defaultValue="admin@constituency.gov.in"
            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 mt-1 
            bg-white dark:bg-gray-800 text-gray-700 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-[#13538A]"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
            <Phone size={14} /> Phone Number
          </label>

          <input
            type="text"
            defaultValue="9999900001"
            className="w-full border text-sm border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 mt-1 
            bg-white dark:bg-gray-800 text-gray-700 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-[#13538A]"
          />
        </div>

        {/* Designation */}
        <div>
          <label className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
            <Briefcase size={14} /> Designation
          </label>

          <input
            type="text"
            defaultValue="Senior Manager"
            className="w-full border text-sm border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 mt-1 
            bg-white dark:bg-gray-800 text-gray-700 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-[#13538A]"
          />
        </div>

        {/* Department */}
        <div className="col-span-2">
          <label className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
            <Building2 size={14} /> Department
          </label>

          <input
            type="text"
            defaultValue="Human Resources"
            className="w-full border text-sm border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 mt-1 
            bg-white dark:bg-gray-800 text-gray-700 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-[#13538A]"
          />
        </div>

        {/* Bio */}
        <div className="col-span-2">
          <label className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
            <FileText size={14} /> Bio
          </label>

          <textarea
            rows={3}
            placeholder="A short bio about yourself..."
            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 mt-1 
  bg-white dark:bg-gray-800 text-gray-700 dark:text-white
  focus:outline-none focus:ring-2 focus:ring-[#13538A]"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end mt-8">
        <button className="bg-[#13538A] hover:bg-[#0f436e] text-white px-6 py-2 rounded-lg text-sm font-medium shadow transition">
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default ProfileSettingsCard;
