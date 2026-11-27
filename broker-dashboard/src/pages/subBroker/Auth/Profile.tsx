import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
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
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import PageMeta from "../../../components/common/PageMeta";
import {
  checkCoBrokerResponse,
  CO_BROKER_API_BASE,
  CO_BROKER_PROFILE_UPDATED_EVENT,
  CO_BROKER_ROLE_LABEL,
  CO_BROKER_TOKEN_KEY,
  CO_BROKER_USER_KEY,
  fetchCoBrokerBranding,
  getCoBrokerAuthHeaders,
  storeCoBrokerBranding,
} from "../../../lib/coBrokerPortal";
import { formatPhone } from "../../../lib/coBrokerForm";
import { buildApiPublicFileUrl } from "../../../lib/publicFileUrl";
import { isSessionExpiredError } from "../../../lib/sessionExpiry";
import SelfBankingPanel from "../../../components/banking/SelfBankingPanel";

const API_BASE = CO_BROKER_API_BASE;

const inputClass =
  "h-10 min-w-0 w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#4C78F5]/50 focus:ring-2 focus:ring-[#4C78F5]/15 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

const displayClass =
  "flex h-10 min-w-0 w-full items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";

const errorTextClass = "text-sm font-medium text-rose-500";

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
  const location = useLocation();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<CoBrokerProfileData>({});
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [preferredComm, setPreferredComm] = useState("");
  const [tollFree, setTollFree] = useState("");
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [removeProfileImage, setRemoveProfileImage] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>(
    {},
  );

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
    setCompany(nextProfile.company || "");
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
        profileImage: nextUser?.profileImage ?? null,
        roles: nextUser?.roles,
        organizationName: data.organization?.name,
      }),
    );

    window.dispatchEvent(
      new CustomEvent(CO_BROKER_PROFILE_UPDATED_EVENT, {
        detail: {
          firstName: nextUser?.firstName,
          lastName: nextUser?.lastName,
          profileImage: nextUser?.profileImage ?? null,
        },
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
    void loadUser();
  }, []);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [user?.profileImage]);

  useEffect(() => {
    if (!user) return;

    const hash = (location.hash || "").replace(/^#/, "").toLowerCase();
    const fromState = Boolean(
      (location.state as { focusPassword?: boolean } | null)?.focusPassword,
    );
    const wantsPassword =
      fromState ||
      hash === "password" ||
      hash === "security" ||
      hash === "change-password";
    if (!wantsPassword) return;

    setShowPasswordSection(true);

    let cancelled = false;
    let attempts = 0;

    const scrollToPassword = () => {
      if (cancelled) return;
      const el = document.getElementById("profile-password");
      if (!el) {
        attempts += 1;
        if (attempts < 20) window.setTimeout(scrollToPassword, 50);
        return;
      }
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      const scrollParent = el.closest("main");
      if (scrollParent instanceof HTMLElement) {
        const parentRect = scrollParent.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const top =
          elRect.top - parentRect.top + scrollParent.scrollTop - 24;
        scrollParent.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      }
    };

    const timer = window.setTimeout(scrollToPassword, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [user, location.hash, location.pathname, location.state]);

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
      <div className="w-full space-y-4">
        <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-96 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 lg:col-span-2" />
          <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950" />
        </div>
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

  const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    displayName,
  )}&background=13538A&color=ffffff`;
  const remoteAvatarSrc = removeProfileImage
    ? null
    : buildApiPublicFileUrl(API_BASE, user.profileImage);
  const remoteAvatarSrcFresh = remoteAvatarSrc
    ? `${remoteAvatarSrc}${remoteAvatarSrc.includes("?") ? "&" : "?"}v=${encodeURIComponent(user.profileImage)}`
    : null;

  const isChanged =
    firstName !== (user.firstName || "") ||
    lastName !== (user.lastName || "") ||
    phone !== (user.phone ? formatPhone(user.phone) : "") ||
    company !== (profile.company || "") ||
    address !== (profile.address || "") ||
    website !== (profile.website || "") ||
    linkedinUrl !== (profile.linkedinUrl || "") ||
    preferredComm !== (profile.preferredComm || "") ||
    tollFree !== (profile.tollFree ? formatPhone(profile.tollFree) : "") ||
    Boolean(profileImage) ||
    removeProfileImage;

  const avatarSrc =
    avatarObjectUrl ||
    (!avatarLoadFailed && remoteAvatarSrcFresh
      ? remoteAvatarSrcFresh
      : fallbackAvatar);

  const hasSavedProfileImage = Boolean(user.profileImage) && !removeProfileImage;
  const canRemovePhoto = Boolean(profileImage) || hasSavedProfileImage;

  const handleSave = async () => {
    if (!firstName.trim()) {
      toast.error("First name is required");
      return;
    }

    const formData = new FormData();
    formData.append("firstName", firstName.trim());
    formData.append("lastName", lastName.trim());
    formData.append("phone", phone.replace(/\D/g, ""));
    formData.append("company", company.trim());
    formData.append("address", address.trim());
    formData.append("website", website.trim());
    formData.append("linkedinUrl", linkedinUrl.trim());
    formData.append("preferredComm", preferredComm.trim());
    formData.append("tollFree", tollFree.replace(/\D/g, ""));

    if (profileImage) {
      formData.append("profileImage", profileImage);
    } else if (removeProfileImage) {
      formData.append("removeProfileImage", "true");
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
      setRemoveProfileImage(false);
      setAvatarLoadFailed(false);
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
    setRemoveProfileImage(false);
    setAvatarLoadFailed(false);
    setFirstName(user.firstName || "");
    setLastName(user.lastName || "");
    setPhone(user.phone ? formatPhone(user.phone) : "");
    setCompany(profile.company || "");
    setAddress(profile.address || "");
    setWebsite(profile.website || "");
    setLinkedinUrl(profile.linkedinUrl || "");
    setPreferredComm(profile.preferredComm || "");
    setTollFree(profile.tollFree ? formatPhone(profile.tollFree) : "");
  };

  const companyLabel = editing
    ? company.trim()
    : company || profile.company || "";

  const resetPasswordForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setPasswordErrors({});
  };

  const handleChangePassword = async () => {
    const nextErrors: Record<string, string> = {};
    if (!currentPassword.trim()) {
      nextErrors.currentPassword = "Current password is required";
    }
    const passwordError = validateNewPassword(newPassword);
    if (passwordError) nextErrors.newPassword = passwordError;
    if (!confirmPassword.trim()) {
      nextErrors.confirmPassword = "Please confirm your new password";
    } else if (newPassword !== confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match";
    }
    setPasswordErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error(Object.values(nextErrors)[0]);
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

      <div className="w-full space-y-4">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-none dark:border-slate-800 dark:bg-slate-950 sm:p-5">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-center">
              <div className="group relative shrink-0">
                <div className="relative h-20 w-20 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900 sm:h-24 sm:w-24">
                  <img
                    key={remoteAvatarSrcFresh || "avatar-fallback"}
                    src={avatarSrc}
                    alt={displayName}
                    className="h-full w-full bg-slate-50 object-contain dark:bg-slate-900"
                    onError={(e) => {
                      const src =
                        e.currentTarget.currentSrc || e.currentTarget.src;
                      if (!src || src.includes("ui-avatars.com")) return;
                      if (
                        remoteAvatarSrcFresh &&
                        src.startsWith(remoteAvatarSrc!)
                      ) {
                        setAvatarLoadFailed(true);
                      }
                    }}
                  />
                  {editing && (
                    <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center bg-slate-900/55 text-white opacity-0 transition group-hover:opacity-100">
                      <Camera size={18} />
                      <span className="mt-1 text-[10px] font-medium">
                        Change
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          if (!file.type.startsWith("image/")) {
                            toast.error("Only image files allowed");
                            return;
                          }
                          setRemoveProfileImage(false);
                          setAvatarLoadFailed(false);
                          setProfileImage(file);
                        }}
                      />
                    </label>
                  )}
                </div>
                {editing && canRemovePhoto && (
                  <button
                    type="button"
                    onClick={() => {
                      setProfileImage(null);
                      setRemoveProfileImage(true);
                      setAvatarLoadFailed(false);
                    }}
                    className="absolute -bottom-1 -right-1 inline-flex items-center justify-center rounded-full border border-white bg-rose-500 p-1.5 text-white transition hover:bg-rose-600"
                    title="Remove photo"
                    aria-label="Remove profile photo"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>

              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4C78F5]">
                  Co-Broker Profile
                </p>
                <h1
                  className="mt-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-lg font-semibold tracking-tight text-slate-900 dark:text-white sm:text-xl"
                  title={displayName}
                >
                  {displayName}
                </h1>
                <div className="mt-2 space-y-1 text-sm text-slate-500">
                  <p className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                    <Briefcase size={14} className="shrink-0 text-slate-400" />
                    <span className="truncate" title={roleLabel}>
                      {roleLabel}
                    </span>
                  </p>
                  {companyLabel ? (
                    <p className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                      <Building2 size={14} className="shrink-0 text-slate-400" />
                      <span className="truncate" title={companyLabel}>
                        {companyLabel}
                      </span>
                    </p>
                  ) : null}
                  {user.email ? (
                    <p className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                      <Mail size={14} className="shrink-0 text-slate-400" />
                      <span className="truncate" title={user.email}>
                        {user.email}
                      </span>
                    </p>
                  ) : null}
                </div>
                {editing && removeProfileImage && !profileImage ? (
                  <p className="mt-3 text-sm font-medium text-amber-700 dark:text-amber-300">
                    Photo will be removed when you save.
                  </p>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              onClick={() => (editing ? resetEditing() : setEditing(true))}
              className={`inline-flex h-10 shrink-0 items-center gap-2 self-start rounded-lg px-3.5 text-sm font-semibold transition ${
                editing
                  ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  : "bg-[#4C78F5] text-white hover:bg-[#3B66E0]"
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
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <SectionCard
              title="Personal Information"
              description="Your name and phone as shown to your broker team."
            >
              <div className="grid min-w-0 gap-4 md:grid-cols-2">
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
                  onChange={(value) => setPhone(formatPhone(value))}
                  icon={<Phone size={14} />}
                  type="tel"
                  placeholder="888-888-8888"
                />
                <ProfileField
                  label="Toll Free"
                  value={tollFree}
                  editing={editing}
                  onChange={(value) => setTollFree(formatPhone(value))}
                  icon={<Phone size={14} />}
                  type="tel"
                  placeholder="888-888-8888"
                />
                <div className="md:col-span-2">
                  <InfoCard
                    label="Email"
                    value={user.email || ""}
                    icon={<Mail size={18} />}
                    hint="Managed by your account — contact your broker admin to change."
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Business Details"
              description="Edit your company and contact details. Partner type, agent type, and finder's fee stay set by your principal broker."
            >
              <div className="grid min-w-0 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <ProfileField
                    label="Company Name"
                    value={company}
                    editing={editing}
                    onChange={(v) => setCompany(v.slice(0, 100))}
                    icon={<Building2 size={14} />}
                    placeholder="Your company name"
                  />
                </div>
                <InfoCard
                  label="Partner Type"
                  value={profile.partnerType || ""}
                  icon={<Briefcase size={18} />}
                />
                <InfoCard
                  label="Agent Type"
                  value={profile.agentType || ""}
                  icon={<ShieldCheck size={18} />}
                />
                <div className="md:col-span-2">
                  <InfoCard
                    label="Finder's Fee"
                    value={profile.findersFee || ""}
                    icon={<ShieldCheck size={18} />}
                  />
                </div>
                <div className="md:col-span-2">
                  <ProfileField
                    label="Address"
                    value={address}
                    editing={editing}
                    onChange={setAddress}
                    icon={<MapPin size={14} />}
                  />
                </div>
                <ProfileField
                  label="Website"
                  value={website}
                  editing={editing}
                  onChange={setWebsite}
                  icon={<Globe size={14} />}
                  placeholder="https://example.com"
                />
                <ProfileField
                  label="LinkedIn"
                  value={linkedinUrl}
                  editing={editing}
                  onChange={setLinkedinUrl}
                  icon={<Link2 size={14} />}
                  placeholder="https://linkedin.com/in/..."
                />
                <div className="md:col-span-2">
                  <ProfileField
                    label="Preferred Communication"
                    value={preferredComm}
                    editing={editing}
                    onChange={setPreferredComm}
                    icon={<Mail size={14} />}
                    placeholder="Email, phone, text…"
                  />
                </div>
              </div>
            </SectionCard>

            <SelfBankingPanel
              portal="coBroker"
              apiBase={API_BASE}
              getAuthHeaders={() => getCoBrokerAuthHeaders("application/json")}
              checkResponse={checkCoBrokerResponse}
              title="Payout bank account"
              description="US bank account used to receive commission ACH from your principal broker."
            />

            <SectionCard
              title="Security"
              description="Keep your co-broker account secure with a strong password."
            >
              <div
                id="profile-password"
                className="scroll-mt-24 rounded-xl border border-slate-200 p-3.5 dark:border-slate-700"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                      <LockKeyhole size={16} />
                      Password
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
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
                    className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-[#4C78F5] transition hover:bg-[#4C78F5]/[0.06] dark:border-slate-700 dark:bg-slate-950 dark:text-sky-300"
                  >
                    {showPasswordSection ? "Cancel" : "Change Password"}
                  </button>
                </div>

                {showPasswordSection ? (
                  <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 dark:border-slate-700 md:grid-cols-2">
                    <PasswordField
                      label="Current password"
                      value={currentPassword}
                      show={showCurrentPassword}
                      onToggle={() => setShowCurrentPassword((prev) => !prev)}
                      onChange={(v) => {
                        setCurrentPassword(v);
                        setPasswordErrors((prev) => {
                          const { currentPassword: _drop, ...rest } = prev;
                          return rest;
                        });
                      }}
                      error={passwordErrors.currentPassword}
                    />
                    <PasswordField
                      label="New password"
                      value={newPassword}
                      show={showNewPassword}
                      onToggle={() => setShowNewPassword((prev) => !prev)}
                      onChange={(v) => {
                        setNewPassword(v);
                        const message = validateNewPassword(v);
                        setPasswordErrors((prev) => {
                          const next = { ...prev };
                          if (message) next.newPassword = message;
                          else delete next.newPassword;
                          if (confirmPassword && v !== confirmPassword) {
                            next.confirmPassword = "Passwords do not match";
                          } else if (confirmPassword) {
                            delete next.confirmPassword;
                          }
                          return next;
                        });
                      }}
                      error={passwordErrors.newPassword}
                    />
                    <PasswordField
                      label="Confirm new password"
                      value={confirmPassword}
                      show={showNewPassword}
                      onToggle={() => setShowNewPassword((prev) => !prev)}
                      onChange={(v) => {
                        setConfirmPassword(v);
                        setPasswordErrors((prev) => {
                          const next = { ...prev };
                          if (!v.trim()) {
                            next.confirmPassword =
                              "Please confirm your new password";
                          } else if (v !== newPassword) {
                            next.confirmPassword = "Passwords do not match";
                          } else {
                            delete next.confirmPassword;
                          }
                          return next;
                        });
                      }}
                      error={passwordErrors.confirmPassword}
                    />
                    <div className="flex justify-end md:col-span-2">
                      <button
                        type="button"
                        onClick={() => void handleChangePassword()}
                        disabled={changingPassword}
                        className="inline-flex h-10 items-center rounded-lg bg-[#4C78F5] px-4 text-sm font-semibold text-white transition hover:bg-[#3B66E0] disabled:opacity-50"
                      >
                        {changingPassword ? "Saving…" : "Update Password"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </SectionCard>

            {editing ? (
              <div className="flex justify-end rounded-xl border border-slate-200 bg-white px-4 py-3.5 dark:border-slate-800 dark:bg-slate-950">
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving || !isChanged}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#4C78F5] px-5 text-sm font-semibold text-white transition hover:bg-[#3B66E0] disabled:opacity-50"
                >
                  {saving ? (
                    "Saving…"
                  ) : (
                    <>
                      <Check size={16} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            ) : null}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-none dark:border-slate-800 dark:bg-slate-950">
              <div className="border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Account Overview
                </h4>
                <p className="mt-0.5 text-sm text-slate-500">
                  Your co-broker portal at a glance.
                </p>
              </div>
              <div className="space-y-3 p-4">
                <div
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold ${
                    user.status === "DISABLED"
                      ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300"
                      : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-300"
                  }`}
                >
                  <span className="relative flex h-2 w-2">
                    {user.status !== "DISABLED" && (
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                    )}
                    <span
                      className={`relative inline-flex h-2 w-2 rounded-full ${
                        user.status === "DISABLED"
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                    />
                  </span>
                  {user.status === "DISABLED"
                    ? "Inactive Account"
                    : "Active Account"}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <StatTile
                    label="Applications"
                    value={String(
                      user.assignedApplications ?? user.applicationCount ?? 0,
                    )}
                  />
                  <StatTile label="Role" value={roleLabel} compact />
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-900">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <ShieldCheck size={12} />
                    Principal broker
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white">
                    {user.organizationName || "—"}
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-none dark:border-slate-800 dark:bg-slate-950">
              <div className="border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-[#4C78F5]" />
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Assigned Loan Officers
                  </h4>
                </div>
              </div>
              <div className="p-4">
                {assignedOfficers.length === 0 ? (
                  <p className="text-sm text-slate-500">
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
                          className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#4C78F5]/10 text-xs font-bold text-[#4C78F5]">
                            {name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                              {name}
                            </p>
                            {officer.email ? (
                              <p className="truncate text-xs text-slate-500">
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
          </aside>
        </div>
      </div>
    </>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-none dark:border-slate-800 dark:bg-slate-950">
      <div className="border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function ProfileField({
  label,
  value,
  editing,
  onChange,
  icon,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (value: string) => void;
  icon: React.ReactNode;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
        <span className="shrink-0 text-slate-400">{icon}</span>
        <span className="truncate">{label}</span>
      </label>
      {editing ? (
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          title={value || undefined}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      ) : (
        <div className={displayClass} title={value?.trim() || undefined}>
          {value?.trim() ? (
            value
          ) : (
            <span className="font-normal text-slate-400">Not provided</span>
          )}
        </div>
      )}
    </div>
  );
}

function InfoCard({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 p-3.5 dark:border-slate-700">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#4C78F5]/10 text-[#4C78F5]">
        {icon}
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="text-sm font-semibold text-slate-500">{label}</p>
        <p
          className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold text-slate-900 dark:text-white"
          title={value?.trim() || undefined}
        >
          {value?.trim() ? (
            value
          ) : (
            <span className="font-normal text-slate-400">Not provided</span>
          )}
        </p>
        {hint ? (
          <p className="mt-1 text-sm leading-snug text-slate-400 dark:text-slate-500">
            {hint}
          </p>
        ) : null}
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
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={`mt-1 overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-slate-900 dark:text-white ${
          compact ? "text-sm" : "text-xl"
        }`}
        title={value}
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
  error,
}: {
  label: string;
  value: string;
  show: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
  error?: string;
}) {
  const hasError = Boolean(error);
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="new-password"
          aria-invalid={hasError}
          className={`${inputClass} pr-11 ${
            hasError
              ? "border-rose-400 bg-rose-50/60 focus:border-rose-500 focus:ring-rose-500/10 dark:bg-rose-950/20"
              : ""
          }`}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {hasError ? <p className={errorTextClass}>{error}</p> : null}
    </div>
  );
}
