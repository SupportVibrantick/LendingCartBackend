import { useEffect, useState } from "react";
import {
  Pencil,
  X,
  Camera,
  Check,
  User,
  Mail,
  ShieldCheck,
  Briefcase,
} from "lucide-react";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export default function UserProfileCard() {
  const [user, setUser] = useState<any>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function loadUser() {
    try {
      const res = await fetch(`${API_BASE}/broker/auth/me`, {
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem("broker_token")}`,
        },
      });

      const json = await res.json();
      const { user, organization } = json.data;

      setUser({
        ...user,
        organizationName: organization?.name,
      });

      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
    } catch {
      toast.error("Unable to load profile");
    }
  }

  useEffect(() => {
    loadUser();
  }, []);

  if (!user)
    return (
      <div className="w-full max-w-4xl mx-auto mt-10 animate-pulse bg-white dark:bg-gray-900 h-96 rounded-3xl border border-gray-100 dark:border-gray-800" />
    );

  const displayName = `${firstName} ${lastName}`.trim();
  const roleLabel = user.roles?.[0]?.replace(/_/g, " ");
  const isChanged =
    firstName !== user.firstName || lastName !== user.lastName || profileImage;

  const handleSave = async () => {
    if (!firstName.trim()) {
      toast.error("First name is required");
      return;
    }

    const formData = new FormData();
    formData.append("firstName", firstName.trim());
    formData.append("lastName", lastName.trim());

    if (profileImage) {
      formData.append("profileImage", profileImage);
    }

    setSaving(true);

    try {
      const res = await fetch(`${API_BASE}/broker/auth/update/profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem("broker_token")}`,
        },
        body: formData,
      });

      const json = await res.json();

      if (!res.ok || json.success === false) {
        throw new Error(json.message);
      }

      setUser((prev: any) => ({
        ...prev,
        firstName,
        lastName,
        profileImage: json.data?.user?.profileImage || json.data?.profileImage || prev.profileImage,
      }));

      setEditing(false);
      setProfileImage(null);
      await loadUser();
      window.dispatchEvent(
        new CustomEvent("broker-profile-updated", {
          detail: { firstName, lastName, profileImage: json.data?.user?.profileImage },
        })
      );
      toast.success("Profile updated successfully");
    } catch (err: any) {
      toast.error(err.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto p-4 md:p-6">
      <div className="dark:bg-gray-900 rounded-[1rem] overflow-hidden">
        {/* HEADER */}
        <div className="relative h-32 bg-gradient-to-r from-[#13538A] to-[#1a6aad]">
          <div className="absolute -bottom-12 left-8 flex items-end gap-6">
            {/* AVATAR */}
            <div className="relative group">
              <div className="absolute -inset-1.5 bg-white dark:bg-gray-900 rounded-full"></div>

              <div className="relative w-32 h-32 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden border-4 border-white dark:border-gray-900 shadow-lg">
                <img
                  src={
                    profileImage
                      ? URL.createObjectURL(profileImage)
                      : user.profileImage
                        ? `${API_BASE}${user.profileImage}`
                        : `https://ui-avatars.com/api/?name=${displayName}&background=2563eb&color=ffffff`
                  }
                  className="w-full h-full object-cover"
                />

                {editing && (
                  <label className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white cursor-pointer opacity-0 group-hover:opacity-100 transition">
                    <Camera size={22} />
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) =>
                        e.target.files?.[0] &&
                        setProfileImage(e.target.files[0])
                      }
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* HEADER INFO */}
        <div className="pt-16 pb-6 px-8 flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {displayName || "Your Name"}
            </h1>

            <p className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-2">
              <Briefcase size={14} /> {roleLabel}
            </p>
          </div>

          {/* EDIT BUTTON */}
          <button
            onClick={() => {
              setEditing(!editing);
              setProfileImage(null);
            }}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition
              ${
                editing
                  ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
          >
            {editing ? (
              <>
                <X size={16} /> Cancel
              </>
            ) : (
              <>
                <Pencil size={16} /> Edit Profile
              </>
            )}
          </button>
        </div>

        {/* BODY */}
        <div className="grid lg:grid-cols-3 gap-8 p-8">
          {/* LEFT */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid md:grid-cols-2 gap-5">
              <ProfileField
                label="First Name"
                value={firstName}
                editing={editing}
                onChange={setFirstName}
                icon={<User size={14} />}
              />

              <ProfileField
                label="Last Name"
                value={lastName}
                editing={editing}
                onChange={setLastName}
                icon={<User size={14} />}
              />
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 mb-3">
                CONTACT INFO
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                <ReadOnlyField
                  label="Email"
                  value={user.email}
                  icon={<Mail size={16} />}
                />
                <ReadOnlyField
                  label="Organization"
                  value={user.organizationName}
                  icon={<ShieldCheck size={16} />}
                />
              </div>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="bg-gray-50 dark:bg-gray-800/60 rounded-2xl p-5 border border-gray-100 dark:border-gray-700">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
              Profile Status
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Keep your profile updated.
            </p>

            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 p-3 rounded-xl border border-green-100 dark:border-green-800">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Active Account
            </div>
          </div>
        </div>

        {/* FOOTER */}
        {editing && (
          <div className="px-8 py-5 border-t border-gray-100 dark:border-gray-800 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving || !isChanged}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? (
                "Saving..."
              ) : (
                <>
                  <Check size={16} /> Save Changes
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= COMPONENTS ================= */

function ProfileField({ label, value, editing, onChange, icon }: any) {
  return (
    <div className="space-y-2">
      <label className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
        {icon} {label}
      </label>

      {editing ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
        />
      ) : (
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-sm text-gray-800 dark:text-gray-200">
          {value || "—"}
        </div>
      )}
    </div>
  );
}

function ReadOnlyField({ label, value, icon }: any) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl">
      <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-lg">
        {icon}
      </div>

      <div>
        <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
          {value}
        </p>
      </div>
    </div>
  );
}
