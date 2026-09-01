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
  User,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#13538A]/40 focus:bg-white focus:ring-2 focus:ring-[#13538A]/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white";

const displayClass =
  "truncate rounded-xl border border-gray-100 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-200";

const warningClass = "text-xs font-medium text-amber-500";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1600;
const JPEG_QUALITY = 0.85;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function compressImage(
  file: File,
  maxBytes = MAX_IMAGE_BYTES,
): Promise<File> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return file;
  }

  if (!file.type.startsWith("image/")) return file;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    image.src = url;
  });

  const longest = Math.max(img.width, img.height);
  const scale = longest > MAX_IMAGE_EDGE ? MAX_IMAGE_EDGE / longest : 1;
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, width, height);

  const isPng = file.type === "image/png";
  const mime = isPng ? "image/png" : "image/jpeg";
  const quality = isPng ? undefined : JPEG_QUALITY;

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), mime, quality);
  });
  if (!blob) return file;

  const compressedFile = new File(
    [blob],
    file.name.replace(/\.(png|jpg|jpeg|webp)$/i, "") +
      (mime === "image/png" ? ".png" : ".jpg"),
    { type: mime, lastModified: Date.now() },
  );

  if (compressedFile.size >= file.size) return file;
  if (compressedFile.size > maxBytes) return compressedFile;
  return compressedFile;
}

const truncateText = (value: string, max = 40) => {
  if (!value) return "—";
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
};

const FIELD_LIMITS: Record<
  string,
  {
    min?: number;
    max?: number;
    required?: boolean;
    digitMin?: number;
    digitMax?: number;
    pattern?: { regex: RegExp; message: string };
    url?: boolean;
  }
> = {
  firstName: { required: true, min: 2, max: 50 },
  lastName: { max: 50 },
  phone: { digitMin: 10, digitMax: 15 },
  company: { max: 100 },
  licenseNumber: {
    max: 30,
    pattern: {
      regex: /^[A-Za-z0-9-]+$/,
      message: "Only letters, numbers, and dashes are allowed",
    },
  },
  address: { max: 200 },
  city: { max: 50 },
  state: { max: 50 },
  zipCode: {
    pattern: {
      regex: /^\d{5}(-\d{4})?$/,
      message: "Use 5 digits or ZIP+4 (e.g. 12345 or 12345-6789)",
    },
  },
  website: { url: true },
};

function isValidUrl(value: string) {
  if (!value) return true;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function getFieldWarning(key: string, value: string): string | null {
  const rules = FIELD_LIMITS[key];
  if (!rules) return null;
  const trimmed = value ?? "";
  const trimmedStr = trimmed.trim();
  const rawLen = trimmed.length;
  const trimmedLen = trimmedStr.length;

  if (rules.required && trimmedLen === 0) {
    return "This field is required";
  }

  if (rules.min !== undefined && trimmedLen > 0 && trimmedLen < rules.min) {
    return `Minimum ${rules.min} characters (${trimmedLen}/${rules.min})`;
  }

  if (rules.max !== undefined && rawLen > rules.max) {
    return `Maximum ${rules.max} characters (${rawLen}/${rules.max})`;
  }

  if (rules.digitMin !== undefined) {
    const digits = trimmed.replace(/\D/g, "");
    if (trimmedStr && digits.length < rules.digitMin) {
      return `Needs at least ${rules.digitMin} digits (${digits.length}/${rules.digitMin})`;
    }
    if (rules.digitMax !== undefined && digits.length > rules.digitMax) {
      return `Maximum ${rules.digitMax} digits allowed`;
    }
  }

  if (rules.url && trimmedStr && !isValidUrl(trimmedStr)) {
    return "Enter a valid URL (e.g. https://example.com)";
  }

  if (rules.pattern && trimmedStr && !rules.pattern.regex.test(trimmedStr)) {
    return rules.pattern.message;
  }

  return null;
}

function getFieldCounter(key: string, value: string): string | null {
  const rules = FIELD_LIMITS[key];
  if (!rules) return null;

  if (rules.max !== undefined) {
    const minLabel = rules.min !== undefined ? `${rules.min}–` : "";
    return `${minLabel}${rules.max} chars · ${value.length}/${rules.max}`;
  }

  if (rules.digitMin !== undefined) {
    const digits = (value || "").replace(/\D/g, "");
    return `${rules.digitMin}–${rules.digitMax ?? 15} digits · ${digits.length}/${rules.digitMax ?? 15}`;
  }

  if (rules.pattern) {
    return null;
  }

  return null;
}

function validateProfileForm(fields: {
  firstName: string;
  lastName: string;
  phone: string;
  company: string;
  licenseNumber: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  website: string;
}) {
  const errors: Record<string, string> = {};

  const warn = (key: keyof typeof fields) =>
    getFieldWarning(key, fields[key] || "");
  const pick = (key: keyof typeof fields) => {
    const w = warn(key);
    if (w) errors[key] = w;
  };

  pick("firstName");
  pick("lastName");
  pick("phone");
  pick("company");
  pick("licenseNumber");
  pick("address");
  pick("city");
  pick("state");
  pick("zipCode");
  pick("website");

  return errors;
}

function resolveSavedCompanyName(user: {
  organizationName?: string;
  brokerProfile?: { company?: string };
}): string {
  return user.organizationName || user.brokerProfile?.company || "";
}

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
  const [originalImageSize, setOriginalImageSize] = useState<number>(0);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

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
      setCompany(
        profile.organization?.name || profile.user.brokerProfile?.company || "",
      );
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
    company !== resolveSavedCompanyName(user) ||
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
    const errors = validateProfileForm({
      firstName,
      lastName,
      phone,
      company,
      licenseNumber,
      address,
      city,
      state,
      zipCode,
      website,
    });
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      const firstError = Object.values(errors)[0];
      toast.error(firstError);
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
      setOriginalImageSize(0);
      setImageError(null);
      setImageProcessing(false);

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
    setOriginalImageSize(0);
    setImageError(null);
    setImageProcessing(false);
    setFormErrors({});
    setFirstName(user.firstName || "");
    setLastName(user.lastName || "");
    setPhone(user.phone || "");
    const bp = user.brokerProfile || {};
    setCompany(resolveSavedCompanyName(user));
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
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        if (!file.type.startsWith("image/")) {
                          toast.error("Only image files allowed");
                          return;
                        }

                        setImageError(null);
                        setImageProcessing(true);
                        try {
                          const wasOverLimit = file.size > MAX_IMAGE_BYTES;
                          const compressed = await compressImage(file);

                          if (compressed.size > MAX_IMAGE_BYTES) {
                            setProfileImage(null);
                            setOriginalImageSize(0);
                            setImageError(
                              `Image is too large (${formatBytes(
                                compressed.size,
                              )}). Please choose one under ${formatBytes(
                                MAX_IMAGE_BYTES,
                              )}.`,
                            );
                            toast.error(
                              `Image is ${formatBytes(
                                compressed.size,
                              )} after compression. Max allowed is ${formatBytes(
                                MAX_IMAGE_BYTES,
                              )}.`,
                            );
                            return;
                          }

                          setProfileImage(compressed);
                          setOriginalImageSize(file.size);
                          if (wasOverLimit) {
                            toast.success(
                              `Image compressed from ${formatBytes(
                                file.size,
                              )} to ${formatBytes(compressed.size)}`,
                            );
                          }
                        } catch {
                          setImageError("Unable to process this image.");
                          toast.error("Unable to process this image");
                        } finally {
                          setImageProcessing(false);
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
          <div className="min-w-0 flex-1">
            <h2
              className="truncate text-xl font-bold text-gray-900 dark:text-white"
              title={displayName}
            >
              {displayName}
            </h2>
            <p
              className="mt-1 flex items-center gap-2 truncate text-sm font-medium text-[#13538A] dark:text-[#6ba3d8]"
              title={roleLabel}
            >
              <Briefcase size={14} className="shrink-0" />
              <span className="truncate">{roleLabel}</span>
            </p>
            {(editing ? company.trim() : user.organizationName) && (
              <p
                className="mt-1 flex items-center gap-2 truncate text-sm text-gray-500 dark:text-gray-400"
                title={editing ? company.trim() : user.organizationName}
              >
                <Building2 size={14} className="shrink-0" />
                <span className="truncate">
                  {editing ? company.trim() : user.organizationName}
                </span>
              </p>
            )}

            {editing && (imageProcessing || profileImage || imageError) && (
              <div className="mt-3 max-w-md">
                {imageProcessing && (
                  <p className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                    Processing image…
                  </p>
                )}
                {!imageProcessing && profileImage && (
                  <p
                    className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs ${
                      originalImageSize > MAX_IMAGE_BYTES
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    <span className="font-medium">
                      {formatBytes(profileImage.size)}
                    </span>
                    {originalImageSize > MAX_IMAGE_BYTES && (
                      <>
                        <span>(compressed from {formatBytes(originalImageSize)})</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          Was over {formatBytes(MAX_IMAGE_BYTES)}
                        </span>
                      </>
                    )}
                  </p>
                )}
                {!imageProcessing && imageError && (
                  <p className="mt-1 text-xs font-medium text-red-500">
                    {imageError}
                  </p>
                )}
              </div>
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
                  onChange={(v) => {
                    setFirstName(v);
                    if (formErrors.firstName)
                      setFormErrors((e) => {
                        const { firstName: _drop, ...rest } = e;
                        return rest;
                      });
                  }}
                  icon={<User size={14} />}
                  error={formErrors.firstName}
                  maxLength={50}
                  fieldKey="firstName"
                />
                <ProfileField
                  label="Last Name"
                  value={lastName}
                  editing={editing}
                  onChange={(v) => {
                    setLastName(v);
                    if (formErrors.lastName)
                      setFormErrors((e) => {
                        const { lastName: _drop, ...rest } = e;
                        return rest;
                      });
                  }}
                  icon={<User size={14} />}
                  error={formErrors.lastName}
                  maxLength={50}
                  fieldKey="lastName"
                />
                <ProfileField
                  label="Phone"
                  value={phone}
                  editing={editing}
                  onChange={(v) => {
                    setPhone(v);
                    if (formErrors.phone)
                      setFormErrors((e) => {
                        const { phone: _drop, ...rest } = e;
                        return rest;
                      });
                  }}
                  icon={<Phone size={14} />}
                  error={formErrors.phone}
                  maxLength={20}
                  type="tel"
                  fieldKey="phone"
                />
              </div>
            </section>

            <section>
              <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
                Professional Information
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <ProfileField
                    label="Company Name"
                    value={company}
                    editing={editing}
                    onChange={(v) => {
                      setCompany(v);
                      if (formErrors.company)
                        setFormErrors((e) => {
                          const { company: _drop, ...rest } = e;
                          return rest;
                        });
                    }}
                    icon={<Building2 size={14} />}
                    error={formErrors.company}
                    maxLength={100}
                    fieldKey="company"
                  />
                  {editing ? (
                    <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      Updates your organization name and fee agreement branding
                      across the platform.
                    </p>
                  ) : null}
                </div>
                <ProfileField
                  label="License Number"
                  value={licenseNumber}
                  editing={editing}
                  onChange={(v) => {
                    setLicenseNumber(v);
                    if (formErrors.licenseNumber)
                      setFormErrors((e) => {
                        const { licenseNumber: _drop, ...rest } = e;
                        return rest;
                      });
                  }}
                  icon={<Briefcase size={14} />}
                  error={formErrors.licenseNumber}
                  maxLength={30}
                  fieldKey="licenseNumber"
                />
                <ProfileField
                  label="Address"
                  value={address}
                  editing={editing}
                  onChange={(v) => {
                    setAddress(v);
                    if (formErrors.address)
                      setFormErrors((e) => {
                        const { address: _drop, ...rest } = e;
                        return rest;
                      });
                  }}
                  icon={<Building2 size={14} />}
                  error={formErrors.address}
                  maxLength={200}
                  fieldKey="address"
                />
                <ProfileField
                  label="City"
                  value={city}
                  editing={editing}
                  onChange={(v) => {
                    setCity(v);
                    if (formErrors.city)
                      setFormErrors((e) => {
                        const { city: _drop, ...rest } = e;
                        return rest;
                      });
                  }}
                  icon={<Building2 size={14} />}
                  error={formErrors.city}
                  maxLength={50}
                  fieldKey="city"
                />
                <ProfileField
                  label="State"
                  value={state}
                  editing={editing}
                  onChange={(v) => {
                    setState(v);
                    if (formErrors.state)
                      setFormErrors((e) => {
                        const { state: _drop, ...rest } = e;
                        return rest;
                      });
                  }}
                  icon={<Building2 size={14} />}
                  error={formErrors.state}
                  maxLength={50}
                  fieldKey="state"
                />
                <ProfileField
                  label="ZIP Code"
                  value={zipCode}
                  editing={editing}
                  onChange={(v) => {
                    setZipCode(v);
                    if (formErrors.zipCode)
                      setFormErrors((e) => {
                        const { zipCode: _drop, ...rest } = e;
                        return rest;
                      });
                  }}
                  icon={<Building2 size={14} />}
                  error={formErrors.zipCode}
                  maxLength={10}
                  fieldKey="zipCode"
                />
                <ProfileField
                  label="Website"
                  value={website}
                  editing={editing}
                  onChange={(v) => {
                    setWebsite(v);
                    if (formErrors.website)
                      setFormErrors((e) => {
                        const { website: _drop, ...rest } = e;
                        return rest;
                      });
                  }}
                  icon={<Briefcase size={14} />}
                  error={formErrors.website}
                  maxLength={200}
                  type="url"
                  fieldKey="website"
                />
              </div>
            </section>

            <section>
              <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
                Contact
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <InfoCard
                  label="Email"
                  value={user.email}
                  icon={<Mail size={18} />}
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
                Keep your company name, license, and contact details updated so
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
  error,
  maxLength,
  type = "text",
  fieldKey,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange?: (value: string) => void;
  icon: React.ReactNode;
  error?: string;
  maxLength?: number;
  type?: string;
  fieldKey?: string;
}) {
  const warning = fieldKey ? getFieldWarning(fieldKey, value || "") : null;
  const counter = fieldKey ? getFieldCounter(fieldKey, value || "") : null;

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
        {icon}
        {label}
      </label>
      {editing && onChange ? (
        <>
          <input
            type={type}
            value={value}
            maxLength={maxLength}
            onChange={(e) => onChange(e.target.value)}
            className={`${inputClass} ${
              error
                ? "border-red-400 focus:border-red-500 focus:ring-red-500/10"
                : warning
                  ? "border-amber-400 focus:border-amber-500 focus:ring-amber-500/10"
                  : ""
            }`}
          />
          <div className="flex items-center justify-between gap-2">
            <p
              className={`min-h-[1rem] flex-1 text-xs ${error ? "text-red-500" : warning ? warningClass : "text-transparent"}`}
            >
              {error || warning || "·"}
            </p>
            {counter && (
              <p
                className={`shrink-0 text-xs ${
                  error || warning
                    ? "text-red-400"
                    : value.length === maxLength
                      ? "text-amber-500"
                      : "text-gray-400 dark:text-gray-500"
                }`}
              >
                {counter}
              </p>
            )}
          </div>
        </>
      ) : (
        <div className={displayClass} title={value || undefined}>
          {truncateText(value || "", maxLength && maxLength < 60 ? maxLength : 60)}
        </div>
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
