import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Building2,
  Camera,
  Check,
  Eye,
  EyeOff,
  Globe,
  Link2,
  LockKeyhole,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  User,
  Users,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import PageMeta from "../../../components/common/PageMeta";
import {
  checkCoBrokerResponse,
  CO_BROKER_API_BASE,
  CO_BROKER_ROLE_LABEL,
  CO_BROKER_TOKEN_KEY,
  CO_BROKER_USER_KEY,
  fetchCoBrokerBranding,
  getCoBrokerAuthHeaders,
  storeCoBrokerBranding,
} from "../../../lib/coBrokerPortal";
import { formatPhone } from "../../../lib/coBrokerForm";
import { isSessionExpiredError } from "../../../lib/sessionExpiry";

const API_BASE = CO_BROKER_API_BASE;

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#13538A]/40 focus:bg-white focus:ring-2 focus:ring-[#13538A]/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white";

const displayClass =
  "rounded-xl border border-gray-100 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-200";

type CoBrokerProfileData = {
  company?: string;
  partnerType?: string;
  agentType?: string;
  findersFee?: string;
  address?: string;
  website?: string;
  linkedinUrl?: string;
  preferredComm?: string;
  tollFree?: string;
};

type AssignedOfficer = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
};

function validateNewPassword(password: string) {
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
}

export default function UserProfileCard() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<CoBrokerProfileData>({});
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [preferredComm, setPreferredComm] = useState("");
  const [tollFree, setTollFree] = useState("");
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

  function applyProfileData(data: any) {
    const nextUser = data.user;
    const nextProfile = (nextUser?.profile || {}) as CoBrokerProfileData;

    setUser({
      ...nextUser,
      organization: data.organization,
      organizationName: data.organization?.name,
    });
    setProfile(nextProfile);
    setFirstName(nextUser?.firstName || "");
    setLastName(nextUser?.lastName || "");
    setPhone(nextUser?.phone ? formatPhone(nextUser.phone) : "");
    setAddress(nextProfile.address || "");
    setWebsite(nextProfile.website || "");
    setLinkedinUrl(nextProfile.linkedinUrl || "");
    setPreferredComm(nextProfile.preferredComm || "");
    setTollFree(nextProfile.tollFree ? formatPhone(nextProfile.tollFree) : "");

    if (data.branding) {
      storeCoBrokerBranding(data.branding);
    }

    sessionStorage.setItem(
      CO_BROKER_USER_KEY,
      JSON.stringify({
        id: nextUser?.id,
        firstName: nextUser?.firstName,
        lastName: nextUser?.lastName,
        email: nextUser?.email,
        profileImage: nextUser?.profileImage,
        roles: nextUser?.roles,
      }),
    );
  }

  async function loadUser() {
    try {
      const res = await fetch(`${API_BASE}/subbroker/auth/me`, {
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem(CO_BROKER_TOKEN_KEY)}`,
        },
      });

      const json = await res.json();
      checkCoBrokerResponse(res, json);

      if (!res.ok || json.ok === false) {
        throw new Error(json.message || "Failed to load profile");
      }

      applyProfileData(json.data);

      if (!json.data?.branding) {
        await fetchCoBrokerBranding();
      }
    } catch (err) {
      if (isSessionExpiredError(err)) return;
      toast.error("Unable to load profile");
    }
  }

  useEffect(() => {
    loadUser();
  }, []);

  const avatarObjectUrl = useMemo(() => {
    if (!profileImage) return null;
    return URL.createObjectURL(profileImage);
  }, [profileImage]);

  useEffect(() => {
    return () => {
      if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
    };
  }, [avatarObjectUrl]);

  if (!user) {
    return (
      <div className="space-y-5">
        <div className="h-36 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800" />
        <div className="h-96 animate-pulse rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900" />
      </div>
    );
  }

  const displayName =
    [firstName, lastName].filter(Boolean).join(" ").trim() || "Co-Broker";
  const roleLabel =
    user.roles?.[0]
      ?.replaceAll("_", " ")
      .replace(/SUB BROKER/i, CO_BROKER_ROLE_LABEL) || CO_BROKER_ROLE_LABEL;
  const assignedOfficers = (user.assignedLoanOfficers ||
    []) as AssignedOfficer[];

  const isChanged =
    firstName !== (user.firstName || "") ||
    lastName !== (user.lastName || "") ||
    phone !== (user.phone ? formatPhone(user.phone) : "") ||
    address !== (profile.address || "") ||
    website !== (profile.website || "") ||
    linkedinUrl !== (profile.linkedinUrl || "") ||
    preferredComm !== (profile.preferredComm || "") ||
    tollFree !== (profile.tollFree ? formatPhone(profile.tollFree) : "") ||
    Boolean(profileImage);

  const avatarSrc =
    avatarObjectUrl ||
    (user.profileImage
      ? `${API_BASE}${user.profileImage}`
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=13538A&color=ffffff`);

  const handleSave = async () => {
    if (!firstName.trim()) {
      toast.error("First name is required");
      return;
    }

    const formData = new FormData();
    formData.append("firstName", firstName.trim());
    formData.append("lastName", lastName.trim());
    formData.append("phone", phone.replace(/\D/g, ""));
    formData.append("address", address.trim());
    formData.append("website", website.trim());
    formData.append("linkedinUrl", linkedinUrl.trim());
    formData.append("preferredComm", preferredComm.trim());
    formData.append("tollFree", tollFree.replace(/\D/g, ""));

    if (profileImage) {
      formData.append("profileImage", profileImage);
    }

    setSaving(true);

    try {
      const res = await fetch(`${API_BASE}/subbroker/auth/me`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem(CO_BROKER_TOKEN_KEY)}`,
        },
        body: formData,
      });

      const json = await res.json();
      checkCoBrokerResponse(res, json);

      if (!res.ok || json.success === false || json.ok === false) {
        throw new Error(json.message || "Update failed");
      }

      applyProfileData(json.data);
      setEditing(false);
      setProfileImage(null);
      toast.success("Profile updated successfully");
    } catch (err: any) {
      if (isSessionExpiredError(err)) return;
      toast.error(err.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const resetEditing = () => {
    setEditing(false);
    setProfileImage(null);
    setFirstName(user.firstName || "");
    setLastName(user.lastName || "");
    setPhone(user.phone ? formatPhone(user.phone) : "");
    setAddress(profile.address || "");
    setWebsite(profile.website || "");
    setLinkedinUrl(profile.linkedinUrl || "");
    setPreferredComm(profile.preferredComm || "");
    setTollFree(profile.tollFree ? formatPhone(profile.tollFree) : "");
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
      const res = await fetch(`${API_BASE}/subbroker/auth/change-password`, {
        method: "PUT",
        headers: getCoBrokerAuthHeaders("application/json"),
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const json = await res.json();
      checkCoBrokerResponse(res, json);

      if (!res.ok || json.success === false) {
        throw new Error(json.message || "Unable to change password");
      }

      resetPasswordForm();
      setShowPasswordSection(false);
      toast.success(json.message || "Password changed successfully", {
        id: toastId,
      });
    } catch (err: unknown) {
      if (isSessionExpiredError(err)) {
        toast.dismiss(toastId);
        return;
      }
      toast.error(
        err instanceof Error ? err.message : "Unable to change password",
        { id: toastId },
      );
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <>
      <PageMeta
        title="Profile | Co-Broker Portal"
        description="Manage your co-broker profile and password"
      />

      <div className="mx-auto max-w-5xl space-y-5">
        <section className="overflow-hidden rounded-2xl border border-[#13538A]/15 bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#2C92D5] p-6 text-white shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
              <div className="group relative">
                <div className="relative h-24 w-24 overflow-hidden rounded-2xl border-4 border-white/30 bg-white/10 shadow-lg sm:h-28 sm:w-28">
                  <img
                    src={avatarSrc}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                  {editing && (
                    <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center bg-black/55 text-white opacity-0 transition group-hover:opacity-100">
                      <Camera size={20} />
                      <span className="mt-1 text-[10px] font-medium">
                        Change
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (!file.type.startsWith("image/")) {
                            toast.error("Only image files allowed");
                            return;
                          }
                          setProfileImage(file);
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
                  {CO_BROKER_ROLE_LABEL} Profile
                </p>
                <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
                  {displayName}
                </h1>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/85">
                  <span className="inline-flex items-center gap-1.5">
                    <Briefcase size={14} /> {roleLabel}
                  </span>
                  {profile.company ? (
                    <>
                      <span className="text-white/40">·</span>
                      <span className="inline-flex items-center gap-1.5">
                        <Building2 size={14} />
                        {profile.company}
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => (editing ? resetEditing() : setEditing(true))}
              className={`inline-flex items-center gap-2 self-start rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                editing
                  ? "border border-white/25 bg-white/10 text-white hover:bg-white/20"
                  : "bg-white text-[#13538A] hover:bg-white/90"
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
        </section>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Personal Details
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  Your name and phone numbers as shown to your broker team.
                </p>
              </div>
              <div className="grid gap-5 p-5 md:grid-cols-2">
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
                  onChange={(value: string) => setPhone(formatPhone(value))}
                  icon={<Phone size={14} />}
                />
                <ProfileField
                  label="Toll Free"
                  value={tollFree}
                  editing={editing}
                  onChange={(value: string) => setTollFree(formatPhone(value))}
                  icon={<Phone size={14} />}
                />
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Business Details
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  Company fields are managed by your principal broker.
                </p>
              </div>
              <div className="grid gap-5 p-5 md:grid-cols-2">
                <ReadOnlyBlock
                  label="Company"
                  value={profile.company}
                  icon={<Building2 size={16} />}
                />
                <ReadOnlyBlock
                  label="Partner Type"
                  value={profile.partnerType}
                  icon={<Briefcase size={16} />}
                />
                <ReadOnlyBlock
                  label="Agent Type"
                  value={profile.agentType}
                  icon={<ShieldCheck size={16} />}
                />
                <ReadOnlyBlock
                  label="Finder's Fee"
                  value={profile.findersFee}
                  icon={<ShieldCheck size={16} />}
                />
                <ProfileField
                  label="Address"
                  value={address}
                  editing={editing}
                  onChange={setAddress}
                  icon={<MapPin size={14} />}
                  className="md:col-span-2"
                />
                <ProfileField
                  label="Website"
                  value={website}
                  editing={editing}
                  onChange={setWebsite}
                  icon={<Globe size={14} />}
                />
                <ProfileField
                  label="LinkedIn"
                  value={linkedinUrl}
                  editing={editing}
                  onChange={setLinkedinUrl}
                  icon={<Link2 size={14} />}
                />
                <ProfileField
                  label="Preferred Communication"
                  value={preferredComm}
                  editing={editing}
                  onChange={setPreferredComm}
                  icon={<Mail size={14} />}
                  className="md:col-span-2"
                />
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Account
                </h2>
              </div>
              <div className="grid gap-4 p-5 md:grid-cols-2">
                <ReadOnlyBlock
                  label="Email"
                  value={user.email}
                  icon={<Mail size={16} />}
                />
                <ReadOnlyBlock
                  label="Principal Broker"
                  value={user.organizationName}
                  icon={<ShieldCheck size={16} />}
                />
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                    <LockKeyhole size={16} className="text-[#13538A]" />
                    Security
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Use at least 8 characters with upper, lower, number, and
                    special character.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordSection((prev) => !prev);
                    resetPasswordForm();
                  }}
                  className="rounded-xl bg-[#13538A]/10 px-4 py-2 text-sm font-medium text-[#13538A] transition hover:bg-[#13538A]/15"
                >
                  {showPasswordSection ? "Cancel" : "Change Password"}
                </button>
              </div>

              {showPasswordSection && (
                <div className="space-y-4 p-5">
                  <div className="grid gap-4 md:grid-cols-2">
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
                      className="md:col-span-2"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleChangePassword}
                      disabled={changingPassword}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#13538A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1a6aad] disabled:opacity-50"
                    >
                      {changingPassword ? "Updating..." : "Update Password"}
                    </button>
                  </div>
                </div>
              )}
            </section>

            {editing && (
              <div className="flex justify-end rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !isChanged}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#13538A] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1a6aad] disabled:opacity-50"
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

          <div className="space-y-5">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Profile Status
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                Keep your profile updated for smoother collaboration.
              </p>
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                Active Account
              </div>
              <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
                <p className="text-xs text-gray-400">Assigned Applications</p>
                <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">
                  {user.assignedApplications ?? 0}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-3 flex items-center gap-2">
                <Users size={16} className="text-[#13538A]" />
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Assigned Loan Officers
                </h3>
              </div>
              {assignedOfficers.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No loan officers assigned yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {assignedOfficers.map((officer) => {
                    const name =
                      [officer.firstName, officer.lastName]
                        .filter(Boolean)
                        .join(" ")
                        .trim() || "Loan Officer";
                    return (
                      <div
                        key={officer.id}
                        className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800/80"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#13538A]/10 text-xs font-bold text-[#13538A]">
                          {name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                            {name}
                          </p>
                          {officer.email ? (
                            <p className="truncate text-xs text-gray-500">
                              {officer.email}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
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
  className = "",
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (value: string) => void;
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      <label className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
        {icon} {label}
      </label>
      {editing ? (
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

function ReadOnlyBlock({
  label,
  value,
  icon,
}: {
  label: string;
  value?: string | null;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/40">
      <div className="rounded-lg bg-[#13538A]/10 p-2 text-[#13538A] dark:bg-[#13538A]/20 dark:text-sky-300">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
        <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

function PasswordField({
  label,
  value,
  show,
  onToggle,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  show: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="new-password"
          className={`${inputClass} pr-11`}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}
