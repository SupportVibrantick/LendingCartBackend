import { useEffect, useState } from "react";
import {
  Briefcase,
  Building2,
  Camera,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Pencil,
  Phone,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#13538A]/40 focus:bg-white focus:ring-2 focus:ring-[#13538A]/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white";

const displayClass =
  "rounded-xl border border-gray-100 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-200";

function getBrokerToken() {
  return sessionStorage.getItem("broker_token");
}

export default function UserProfileCard() {
  const [user, setUser] = useState<any>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [website, setWebsite] = useState("");
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  async function loadUser() {
    try {
      const res = await fetch(`${API_BASE}/broker/auth/me`, {
        headers: {
          Authorization: `Bearer ${getBrokerToken()}`,
        },
      });

      const json = await res.json();
      if (!res.ok || json.ok !== true) {
        throw new Error(json.message || "Failed to load profile");
      }

      const profile = json.data;
      setUser({
        ...profile.user,
        organization: profile.organization,
        organizationName: profile.organization?.name,
      });
      setFirstName(profile.user.firstName || "");
      setLastName(profile.user.lastName || "");
      setPhone(profile.user.phone || "");
      const bp = profile.user.brokerProfile || {};
      setCompany(bp.company || "");
      setLicenseNumber(bp.licenseNumber || "");
      setAddress(bp.address || "");
      setCity(bp.city || "");
      setState(bp.state || "");
      setZipCode(bp.zipCode || "");
      setWebsite(bp.website || "");
    } catch {
      toast.error("Unable to load profile");
    }
  }

  useEffect(() => {
    loadUser();
  }, []);

  if (!user) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="h-32 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800" />
        <div className="h-96 animate-pulse rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900" />
      </div>
    );
  }

  const displayName =
    [firstName, lastName].filter(Boolean).join(" ").trim() || "Broker";
  const roleLabel = user.roles?.[0]?.replace(/_/g, " ") || "Broker";
  const isChanged =
    firstName !== user.firstName ||
    lastName !== user.lastName ||
    phone !== (user.phone || "") ||
    company !== (user.brokerProfile?.company || "") ||
    licenseNumber !== (user.brokerProfile?.licenseNumber || "") ||
    address !== (user.brokerProfile?.address || "") ||
    city !== (user.brokerProfile?.city || "") ||
    state !== (user.brokerProfile?.state || "") ||
    zipCode !== (user.brokerProfile?.zipCode || "") ||
    website !== (user.brokerProfile?.website || "") ||
    Boolean(profileImage);

  const avatarSrc = profileImage
    ? URL.createObjectURL(profileImage)
    : user.profileImage
      ? `${API_BASE}${user.profileImage}`
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=13538A&color=ffffff`;

  const validateNewPassword = (password: string) => {
    if (password.length < 8) return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(password))
      return "Password must contain at least one uppercase letter";
    if (!/[a-z]/.test(password))
      return "Password must contain at least one lowercase letter";
    if (!/[0-9]/.test(password))
      return "Password must contain at least one number";
    if (!/[^A-Za-z0-9]/.test(password))
      return "Password must contain at least one special character";
    return null;
  };

  const resetPasswordForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
  };

  const handleChangePassword = async () => {
    if (!currentPassword.trim()) {
      toast.error("Current password is required");
      return;
    }

    const passwordError = validateNewPassword(newPassword);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setChangingPassword(true);
    const toastId = toast.loading("Updating password...");

    try {
      const res = await fetch(`${API_BASE}/broker/auth/change-password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getBrokerToken()}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const json = await res.json();

      if (!res.ok || json.success === false) {
        throw new Error(json.message || "Unable to change password");
      }

      resetPasswordForm();
      setShowPasswordSection(false);
      toast.success(json.message || "Password changed successfully", {
        id: toastId,
      });
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Unable to change password",
        { id: toastId },
      );
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSave = async () => {
    if (!firstName.trim()) {
      toast.error("First name is required");
      return;
    }

    const formData = new FormData();
    formData.append("firstName", firstName.trim());
    formData.append("lastName", lastName.trim());
    formData.append("phone", phone.trim());
    formData.append("company", company.trim());
    formData.append("licenseNumber", licenseNumber.trim());
    formData.append("address", address.trim());
    formData.append("city", city.trim());
    formData.append("state", state.trim());
    formData.append("zipCode", zipCode.trim());
    formData.append("website", website.trim());
    if (profileImage) formData.append("profileImage", profileImage);

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/broker/auth/update/profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${getBrokerToken()}`,
        },
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.message || "Update failed");
      }

      const updatedUser = {
        ...user,
        ...(json.data?.user || {}),
        brokerProfile:
          json.data?.user?.brokerProfile || user.brokerProfile,
        organizationName:
          json.data?.organization?.name || user.organizationName,
      };

      setUser(updatedUser);
      setEditing(false);
      setProfileImage(null);

      const stored = JSON.parse(sessionStorage.getItem("broker_user") || "{}");
      const nextOrgName =
        json.data?.organization?.name ||
        company.trim() ||
        updatedUser.organizationName;
      sessionStorage.setItem(
        "broker_user",
        JSON.stringify({
          ...stored,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          name: updatedUser.name,
          profileImage: updatedUser.profileImage,
          organizationName: nextOrgName,
        }),
      );

      window.dispatchEvent(
        new CustomEvent("broker-profile-updated", {
          detail: {
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            profileImage: updatedUser.profileImage,
            organizationName: nextOrgName,
          },
        }),
      );

      await loadUser();
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
    setFirstName(user.firstName || "");
    setLastName(user.lastName || "");
    setPhone(user.phone || "");
    const bp = user.brokerProfile || {};
    setCompany(bp.company || "");
    setLicenseNumber(bp.licenseNumber || "");
    setAddress(bp.address || "");
    setCity(bp.city || "");
    setState(bp.state || "");
    setZipCode(bp.zipCode || "");
    setWebsite(bp.website || "");
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="overflow-hidden rounded-2xl border border-[#13538A]/15 bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#2C92D5] p-6 text-white shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
          Account · Settings
        </p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">My Profile</h1>
        <p className="mt-2 max-w-xl text-sm text-white/80">
          Manage your personal information, professional details, and account
          settings for the broker portal.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="relative h-36 bg-gradient-to-r from-[#13538A] via-[#1a6aad] to-[#2C92D5] sm:h-40">
          <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              {roleLabel}
            </span>
          </div>

          <div className="absolute -bottom-14 left-4 sm:left-8">
            <div className="group relative">
              <div className="absolute -inset-1 rounded-full bg-white/90 dark:bg-gray-900" />
              <div className="relative h-28 w-28 overflow-hidden rounded-full border-4 border-white shadow-lg dark:border-gray-900 sm:h-32 sm:w-32">
                <img
                  src={avatarSrc}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
                {editing && (
                  <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center bg-black/55 text-white opacity-0 transition group-hover:opacity-100">
                    <Camera size={22} />
                    <span className="mt-1 text-[10px] font-medium">Change</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file?.type.startsWith("image/")) {
                          setProfileImage(file);
                        } else {
                          toast.error("Only image files allowed");
                        }
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4 px-4 pb-6 pt-16 sm:px-8 sm:pt-20">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {displayName}
            </h2>
            <p className="mt-1 flex items-center gap-2 text-sm font-medium text-[#13538A] dark:text-[#6ba3d8]">
              <Briefcase size={14} />
              {roleLabel}
            </p>
            {user.organizationName && (
              <p className="mt-1 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Building2 size={14} />
                {user.organizationName}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => (editing ? cancelEdit() : setEditing(true))}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              editing
                ? "border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                : "bg-[#13538A] text-white shadow-sm hover:bg-[#1a6aad]"
            }`}
          >
            {editing ? (
              <>
                <X size={16} />
                Cancel
              </>
            ) : (
              <>
                <Pencil size={16} />
                Edit Profile
              </>
            )}
          </button>
        </div>

        <div className="grid gap-6 border-t border-gray-100 p-4 dark:border-gray-800 sm:p-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <section>
              <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
                Personal Information
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
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
                <ProfileField
                  label="Phone"
                  value={phone}
                  editing={editing}
                  onChange={setPhone}
                  icon={<Phone size={14} />}
                />
              </div>
            </section>

            <section>
              <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
                Professional Information
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <ProfileField
                  label="Company"
                  value={company}
                  editing={editing}
                  onChange={setCompany}
                  icon={<Building2 size={14} />}
                />
                <ProfileField
                  label="License Number"
                  value={licenseNumber}
                  editing={editing}
                  onChange={setLicenseNumber}
                  icon={<Briefcase size={14} />}
                />
                <ProfileField
                  label="Address"
                  value={address}
                  editing={editing}
                  onChange={setAddress}
                  icon={<Building2 size={14} />}
                />
                <ProfileField
                  label="City"
                  value={city}
                  editing={editing}
                  onChange={setCity}
                  icon={<Building2 size={14} />}
                />
                <ProfileField
                  label="State"
                  value={state}
                  editing={editing}
                  onChange={setState}
                  icon={<Building2 size={14} />}
                />
                <ProfileField
                  label="ZIP Code"
                  value={zipCode}
                  editing={editing}
                  onChange={setZipCode}
                  icon={<Building2 size={14} />}
                />
                <ProfileField
                  label="Website"
                  value={website}
                  editing={editing}
                  onChange={setWebsite}
                  icon={<Briefcase size={14} />}
                />
              </div>
            </section>

            <section>
              <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
                Contact & Organization
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <InfoCard
                  label="Email"
                  value={user.email}
                  icon={<Mail size={18} />}
                />
                <InfoCard
                  label="Organization"
                  value={user.organizationName || "—"}
                  icon={<ShieldCheck size={18} />}
                />
              </div>
            </section>

            <section>
              <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
                Security
              </h3>
              <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900/60">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                      <LockKeyhole size={16} />
                      Password
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Update your account password. Use at least 8 characters
                      with upper, lower, number, and special character.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordSection((prev) => !prev);
                      resetPasswordForm();
                    }}
                    className="rounded-xl bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300"
                  >
                    {showPasswordSection ? "Cancel" : "Change Password"}
                  </button>
                </div>

                {showPasswordSection && (
                  <div className="mt-5 grid gap-4 border-t border-gray-100 pt-5 dark:border-gray-800 md:grid-cols-2">
                    <PasswordField
                      label="Current password"
                      value={currentPassword}
                      show={showCurrentPassword}
                      onToggle={() => setShowCurrentPassword((prev) => !prev)}
                      onChange={setCurrentPassword}
                    />
                    <PasswordField
                      label="New password"
                      value={newPassword}
                      show={showNewPassword}
                      onToggle={() => setShowNewPassword((prev) => !prev)}
                      onChange={setNewPassword}
                    />
                    <PasswordField
                      label="Confirm new password"
                      value={confirmPassword}
                      show={showNewPassword}
                      onToggle={() => setShowNewPassword((prev) => !prev)}
                      onChange={setConfirmPassword}
                    />
                    <div className="flex justify-end md:col-span-2">
                      <button
                        type="button"
                        onClick={handleChangePassword}
                        disabled={changingPassword}
                        className="rounded-xl bg-[#13538A] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1a6aad] disabled:opacity-50"
                      >
                        {changingPassword ? "Saving..." : "Update Password"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-800/50">
              <h4 className="font-semibold text-gray-900 dark:text-white">
                Account Overview
              </h4>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Your broker portal activity at a glance.
              </p>

              <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                {user.status === "DISABLED" ? "Inactive Account" : "Active Account"}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <StatTile
                  label="Applications"
                  value={String(user.applicationCount ?? 0)}
                />
                <StatTile label="Role" value={roleLabel} compact />
              </div>
            </div>

            <div className="rounded-2xl border border-[#13538A]/15 bg-[#13538A]/5 p-5 dark:border-[#13538A]/25 dark:bg-[#13538A]/10">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#13538A]">
                Tip
              </p>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                Keep your company, license, and contact details updated so
                lenders and clients see accurate information across the platform.
              </p>
            </div>
          </aside>
        </div>

        {editing && (
          <div className="flex justify-end gap-3 border-t border-gray-100 px-4 py-4 dark:border-gray-800 sm:px-8">
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !isChanged}
              className="inline-flex items-center gap-2 rounded-xl bg-[#13538A] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1a6aad] disabled:opacity-50"
            >
              {saving ? (
                "Saving..."
              ) : (
                <>
                  <Check size={16} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
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
  onChange?: (value: string) => void;
  icon: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
        {icon}
        {label}
      </label>
      {editing && onChange ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      ) : (
        <div className={displayClass}>{value || "—"}</div>
      )}
    </div>
  );
}

function InfoCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/60">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#13538A]/10 text-[#13538A]">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-400">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-gray-900 dark:text-white">
          {value}
        </p>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
        {label}
      </p>
      <p
        className={`mt-1 font-bold text-gray-900 dark:text-white ${
          compact ? "text-sm" : "text-2xl"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function PasswordField({
  label,
  value,
  show,
  onToggle,
  onChange,
}: {
  label: string;
  value: string;
  show: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs text-gray-500 dark:text-gray-400">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} pr-11`}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}
