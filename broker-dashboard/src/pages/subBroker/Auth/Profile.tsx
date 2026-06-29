import { useEffect, useState } from "react";
import {
  Briefcase,
  Building2,
  Camera,
  Check,
  Globe,
  Link2,
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
import {
  CO_BROKER_API_BASE,
  CO_BROKER_ROLE_LABEL,
  CO_BROKER_TOKEN_KEY,
  CO_BROKER_USER_KEY,
  fetchCoBrokerBranding,
  storeCoBrokerBranding,
} from "../../../lib/coBrokerPortal";
import { formatPhone } from "../../../lib/coBrokerForm";

const API_BASE = CO_BROKER_API_BASE;

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#00B8DB]/40 focus:bg-white focus:ring-2 focus:ring-[#00B8DB]/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white";

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

      if (!res.ok || json.ok === false) {
        throw new Error(json.message || "Failed to load profile");
      }

      applyProfileData(json.data);

      if (!json.data?.branding) {
        await fetchCoBrokerBranding();
      }
    } catch {
      toast.error("Unable to load profile");
    }
  }

  useEffect(() => {
    loadUser();
  }, []);

  if (!user) {
    return (
      <div className="mx-auto mt-10 h-96 w-full max-w-5xl animate-pulse rounded-3xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900" />
    );
  }

  const displayName =
    [firstName, lastName].filter(Boolean).join(" ").trim() || "Co-Broker";
  const roleLabel =
    user.roles?.[0]?.replaceAll("_", " ").replace(/SUB BROKER/i, CO_BROKER_ROLE_LABEL) ||
    CO_BROKER_ROLE_LABEL;
  const assignedOfficers = (user.assignedLoanOfficers || []) as AssignedOfficer[];

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

  const avatarSrc = profileImage
    ? URL.createObjectURL(profileImage)
    : user.profileImage
      ? `${API_BASE}${user.profileImage}`
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=00B8DB&color=ffffff`;

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

      if (!res.ok || json.success === false || json.ok === false) {
        throw new Error(json.message || "Update failed");
      }

      applyProfileData(json.data);
      setEditing(false);
      setProfileImage(null);
      toast.success("Profile updated successfully");
    } catch (err: any) {
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

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <div className="overflow-hidden rounded-[1rem] dark:bg-gray-900">
        <div className="relative h-32 bg-[#00B8DB]">
          <div className="absolute right-8 top-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-md">
              <div className="h-2 w-2 rounded-full bg-white" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white">
                {CO_BROKER_ROLE_LABEL}
              </span>
            </div>
          </div>

          <div className="absolute -bottom-12 left-8 flex items-end gap-6">
            <div className="group relative">
              <div className="absolute -inset-1.5 rounded-full bg-black" />
              <div className="relative h-32 w-32 overflow-hidden rounded-full border-4 border-black bg-black shadow-lg">
                <img src={avatarSrc} alt={displayName} className="h-full w-full object-cover" />
                {editing && (
                  <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center bg-black/60 text-white opacity-0 transition group-hover:opacity-100">
                    <Camera size={22} />
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
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 px-8 pb-6 pt-16">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {displayName}
            </h1>
            <p className="flex items-center gap-2 text-sm text-[#345B8B]">
              <Briefcase size={14} /> {roleLabel}
              {profile.company ? (
                <>
                  <span className="text-gray-300">·</span>
                  <Building2 size={14} />
                  {profile.company}
                </>
              ) : null}
            </p>
          </div>

          <button
            onClick={() => (editing ? resetEditing() : setEditing(true))}
            className={`flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-medium transition ${
              editing
                ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                : "bg-[#00B8DB] text-white hover:bg-[#0bd1f9]"
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

        <div className="grid gap-8 p-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Personal Details
              </p>
              <div className="grid gap-5 md:grid-cols-2">
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
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Business Details
              </p>
              <div className="grid gap-5 md:grid-cols-2">
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
                />
              </div>
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Contact Info
              </p>
              <div className="grid gap-4 md:grid-cols-2">
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
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-800/60">
              <h4 className="mb-2 font-semibold text-gray-900 dark:text-white">
                Profile Status
              </h4>
              <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
                Keep your profile updated for smoother collaboration.
              </p>
              <div className="flex items-center gap-2 rounded-xl border border-green-100 bg-green-50 p-3 text-sm text-green-600 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                Active Account
              </div>

              <div className="mt-4 rounded-xl border border-gray-100 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                <p className="text-xs text-gray-400">Assigned Applications</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {user.assignedApplications ?? 0}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
              <div className="mb-3 flex items-center gap-2">
                <Users size={16} className="text-[#00B8DB]" />
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  Assigned Loan Officers
                </h4>
              </div>
              {assignedOfficers.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No loan officers assigned yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {assignedOfficers.map((officer) => (
                    <div
                      key={officer.id}
                      className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800/80"
                    >
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {[officer.firstName, officer.lastName]
                          .filter(Boolean)
                          .join(" ")
                          .trim() || "Loan Officer"}
                      </p>
                      {officer.email ? (
                        <p className="text-xs text-gray-500">{officer.email}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {editing && (
          <div className="flex justify-end border-t border-gray-100 px-8 py-5 dark:border-gray-800">
            <button
              onClick={handleSave}
              disabled={saving || !isChanged}
              className="flex items-center gap-2 rounded-xl bg-[#00B8DB] px-6 py-3 text-white hover:bg-[#0bd1f9] disabled:opacity-50"
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
      <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
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
    <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
      <div className="rounded-lg bg-blue-50 p-2 text-[#345B8B] dark:bg-blue-900/30 dark:text-blue-300">
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
