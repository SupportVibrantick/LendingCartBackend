import { useCallback, useEffect, useState } from "react";
import {
  Camera,
  Check,
  Mail,
  Pencil,
  Phone,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import { useAdminPermissions } from "../context/AdminPermissionsContext";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

type AdminProfile = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  profileImage?: string | null;
  status?: string;
  dbRoles?: string[];
  lastLoginAt?: string | null;
  createdAt?: string;
  hasFullAccess?: boolean;
};

function formatRole(role?: string) {
  if (!role) return "Admin";
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function syncAdminSession(user: Partial<AdminProfile>) {
  try {
    const raw = sessionStorage.getItem("admin_user");
    const existing = raw ? JSON.parse(raw) : {};
    sessionStorage.setItem("admin_user", JSON.stringify({ ...existing, ...user }));
    window.dispatchEvent(new CustomEvent("admin-profile-updated", { detail: user }));
  } catch {
    /* ignore */
  }
}

export default function UserProfiles() {
  const { hasFullAccess } = useAdminPermissions();
  const [user, setUser] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileImage, setProfileImage] = useState<File | null>(null);

  const loadProfile = useCallback(async () => {
    const token = sessionStorage.getItem("admin_token");
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/admin/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.user) {
        throw new Error(json.message || "Failed to load profile");
      }

      setUser(json.user);
      setFirstName(json.user.firstName || "");
      setLastName(json.user.lastName || "");
      setPhone(json.user.phone || "");
      syncAdminSession(json.user);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Unable to load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const displayName = `${firstName || user?.firstName || ""} ${lastName || user?.lastName || ""}`.trim();
  const roleLabel = formatRole(user?.dbRoles?.[0]);
  const accessLabel = user?.hasFullAccess ?? hasFullAccess ? "Full Access" : "Custom Access";

  const isChanged =
    firstName !== (user?.firstName || "") ||
    lastName !== (user?.lastName || "") ||
    phone !== (user?.phone || "") ||
    Boolean(profileImage);

  const avatarSrc = profileImage
    ? URL.createObjectURL(profileImage)
    : user?.profileImage
      ? `${API_BASE}${user.profileImage}`
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || "Admin")}&background=13538A&color=ffffff`;

  const handleSave = async () => {
    if (!firstName.trim()) {
      toast.error("First name is required");
      return;
    }

    const formData = new FormData();
    formData.append("firstName", firstName.trim());
    formData.append("lastName", lastName.trim());
    formData.append("phone", phone.trim());
    if (profileImage) formData.append("profileImage", profileImage);

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/admin/auth/update/profile`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${sessionStorage.getItem("admin_token")}` },
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        throw new Error(json.message || "Update failed");
      }

      const updated = { ...user, ...json.user, hasFullAccess: user?.hasFullAccess };
      setUser(updated);
      syncAdminSession(updated);
      setEditing(false);
      setProfileImage(null);
      toast.success("Profile updated successfully");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditing(false);
    setProfileImage(null);
    setFirstName(user?.firstName || "");
    setLastName(user?.lastName || "");
    setPhone(user?.phone || "");
  };

  if (loading) {
    return (
      <>
        <PageMeta title="Profile | Loan Automation Admin" description="Admin profile" />
        <PageBreadcrumb pageTitle="Profile" />
        <div className="h-80 animate-pulse rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]" />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <PageMeta title="Profile | Loan Automation Admin" description="Admin profile" />
        <PageBreadcrumb pageTitle="Profile" />
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-500">Unable to load profile. Please sign in again.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageMeta title="Profile | Loan Automation Admin" description="Admin profile" />
      <PageBreadcrumb pageTitle="Profile" />

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Profile</h3>
          <button
            type="button"
            onClick={() => (editing ? cancelEdit() : setEditing(true))}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition ${
              editing
                ? "border-gray-300 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                : "border-[#13538A] bg-[#13538A] text-white hover:bg-[#1a6aad]"
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

        <div className="space-y-6">
          {/* Meta card */}
          <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6">
            <div className="flex flex-col items-center gap-6 xl:flex-row">
              <div className="relative group">
                <div className="h-20 w-20 overflow-hidden rounded-full border border-gray-200 dark:border-gray-700">
                  <img src={avatarSrc} alt={displayName || "Admin"} className="h-full w-full object-cover" />
                </div>
                {editing && (
                  <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center rounded-full bg-black/50 text-xs text-white opacity-0 transition group-hover:opacity-100">
                    <Camera size={18} />
                    <span className="mt-1">Change</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && setProfileImage(e.target.files[0])}
                    />
                  </label>
                )}
              </div>

              <div className="text-center xl:text-left">
                <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                  {displayName || "Admin User"}
                </h4>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {roleLabel} · {accessLabel}
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
              </div>

              <div className="xl:ml-auto">
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                    user.status === "ACTIVE"
                      ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-current" />
                  {user.status === "ACTIVE" ? "Active Account" : user.status || "Unknown"}
                </span>
              </div>
            </div>
          </div>

          {/* Personal info */}
          <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6">
            <h4 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">
              Personal Information
            </h4>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
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
              <ReadOnlyField label="Email address" value={user.email} icon={<Mail size={16} />} />
              <ProfileField
                label="Phone"
                value={phone}
                editing={editing}
                onChange={setPhone}
                icon={<Phone size={14} />}
              />
            </div>
          </div>

          {/* Account details */}
          <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6">
            <h4 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">
              Account Details
            </h4>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <ReadOnlyField label="Role" value={roleLabel} icon={<ShieldCheck size={16} />} />
              <ReadOnlyField label="Access Level" value={accessLabel} icon={<ShieldCheck size={16} />} />
              <ReadOnlyField label="Last Login" value={formatDate(user.lastLoginAt)} icon={<User size={16} />} />
              <ReadOnlyField label="Member Since" value={formatDate(user.createdAt)} icon={<User size={16} />} />
            </div>
          </div>
        </div>

        {editing && (
          <div className="mt-6 flex justify-end border-t border-gray-100 pt-5 dark:border-gray-800">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !isChanged}
              className="inline-flex items-center gap-2 rounded-xl bg-[#13538A] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#1a6aad] disabled:opacity-50"
            >
              {saving ? "Saving..." : (
                <>
                  <Check size={16} /> Save Changes
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function ProfileField({
  label,
  value,
  editing,
  onChange,
  icon,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  icon: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        {icon} {label}
      </p>
      {editing ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#13538A]/30 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
      ) : (
        <p className="text-sm font-medium text-gray-800 dark:text-white/90">{value || "—"}</p>
      )}
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        {icon} {label}
      </p>
      <p className="text-sm font-medium text-gray-800 dark:text-white/90">{value || "—"}</p>
    </div>
  );
}
