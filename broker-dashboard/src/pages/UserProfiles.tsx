import { useEffect, useState } from "react";
import {
  Briefcase,
  Building2,
  Camera,
  Check,
  Eye,
  EyeOff,
  Globe,
  LockKeyhole,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  Trash2,
  User,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { BROKER_API_BASE } from "../lib/brokerApi";
import { buildApiPublicFileUrl } from "../lib/publicFileUrl";
import { formatPhone, US_STATES } from "./UserManagement/loanOfficerShared";

const API_BASE = BROKER_API_BASE;
const WEBSITE_PREFIX = "https://";
const US_STATE_CODES = new Set(US_STATES.map((s) => s.code));
const STATE_OPTIONS = US_STATES.map((s) => ({
  value: s.code,
  label: `${s.name} (${s.code})`,
}));

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#13538A]/40 focus:bg-white focus:ring-2 focus:ring-[#13538A]/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white";

const displayClass =
  "truncate rounded-xl border border-gray-100 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-200";

const errorTextClass = "text-xs font-medium text-red-500";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1600;
const JPEG_QUALITY = 0.85;

const NAME_PATTERN = /^[A-Za-z][A-Za-z\s'.-]*$/;
const CITY_PATTERN = /^[A-Za-z][A-Za-z\s'.-]*$/;
const LICENSE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]*$/;
const ZIP_PATTERN = /^\d{5}(-\d{4})?$/;
const WEBSITE_HOST_PATTERN =
  /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(?:\/[\w\-./?#%&=]*)?$/;

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
  firstName: {
    required: true,
    min: 2,
    max: 50,
    pattern: {
      regex: NAME_PATTERN,
      message: "Use letters only (spaces, hyphens, and apostrophes allowed)",
    },
  },
  lastName: {
    max: 50,
    pattern: {
      regex: NAME_PATTERN,
      message: "Use letters only (spaces, hyphens, and apostrophes allowed)",
    },
  },
  phone: { digitMin: 10, digitMax: 10 },
  company: { max: 100 },
  licenseNumber: {
    max: 30,
    pattern: {
      regex: LICENSE_PATTERN,
      message: "Only letters, numbers, and dashes are allowed",
    },
  },
  address: { max: 200 },
  city: {
    max: 50,
    pattern: {
      regex: CITY_PATTERN,
      message: "Use letters only (spaces, hyphens, and apostrophes allowed)",
    },
  },
  state: {
    pattern: {
      regex: /^[A-Z]{2}$/,
      message: "Select a valid US state",
    },
  },
  zipCode: {
    pattern: {
      regex: ZIP_PATTERN,
      message: "Use 5 digits or ZIP+4 (e.g. 12345 or 12345-6789)",
    },
  },
  website: {
    max: 180,
    pattern: {
      regex: WEBSITE_HOST_PATTERN,
      message: "Enter a domain like example.com",
    },
  },
};

function sanitizeZipCode(value: string) {
  const raw = value.replace(/[^\d-]/g, "");
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function sanitizeLicenseNumber(value: string) {
  return value.replace(/[^A-Za-z0-9-]/g, "").slice(0, 30);
}

function sanitizeName(value: string) {
  return value.replace(/[^A-Za-z\s'.-]/g, "").slice(0, 50);
}

function sanitizeCity(value: string) {
  return value.replace(/[^A-Za-z\s'.-]/g, "").slice(0, 50);
}

function normalizeStateCode(value: string): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (US_STATE_CODES.has(upper)) return upper;
  const byName = US_STATES.find(
    (s) => s.name.toLowerCase() === raw.toLowerCase(),
  );
  return byName?.code || "";
}

function stripWebsitePrefix(value: string): string {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^\/+/, "")
    .replace(/\/$/, "");
}

function toWebsiteUrl(host: string): string {
  const cleaned = stripWebsitePrefix(host);
  if (!cleaned) return "";
  return `${WEBSITE_PREFIX}${cleaned}`;
}

function sanitizeWebsiteHost(value: string): string {
  return stripWebsitePrefix(value)
    .replace(/\s+/g, "")
    .slice(0, 180);
}

function getFieldError(key: string, value: string): string | null {
  const rules = FIELD_LIMITS[key];
  if (!rules) return null;
  const trimmed = value ?? "";
  const trimmedStr = trimmed.trim();
  const rawLen = trimmed.length;
  const trimmedLen = trimmedStr.length;

  if (rules.required && trimmedLen === 0) {
    return "This field is required";
  }

  // Optional empty fields are valid
  if (!rules.required && trimmedLen === 0) {
    return null;
  }

  if (rules.min !== undefined && trimmedLen > 0 && trimmedLen < rules.min) {
    return `Minimum ${rules.min} characters (${trimmedLen}/${rules.min})`;
  }

  if (rules.max !== undefined && rawLen > rules.max) {
    return `Maximum ${rules.max} characters (${rawLen}/${rules.max})`;
  }

  if (rules.digitMin !== undefined) {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length < rules.digitMin) {
      return `Enter a valid ${rules.digitMin}-digit phone number (${digits.length}/${rules.digitMin})`;
    }
    if (rules.digitMax !== undefined && digits.length > rules.digitMax) {
      return `Maximum ${rules.digitMax} digits allowed`;
    }
  }

  if (key === "state" && trimmedStr && !US_STATE_CODES.has(trimmedStr)) {
    return "Select a valid US state";
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
    const max = rules.digitMax ?? 15;
    if (rules.digitMin === max) {
      return `${max} digits · ${digits.length}/${max}`;
    }
    return `${rules.digitMin}–${max} digits · ${digits.length}/${max}`;
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

  const pick = (key: keyof typeof fields) => {
    const message = getFieldError(key, fields[key] || "");
    if (message) errors[key] = message;
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
  const [removeProfileImage, setRemoveProfileImage] = useState(false);
  const [originalImageSize, setOriginalImageSize] = useState<number>(0);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

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

  const setFieldError = (key: string, value: string) => {
    const message = getFieldError(key, value);
    setFormErrors((prev) => {
      if (!message) {
        if (!prev[key]) return prev;
        const { [key]: _drop, ...rest } = prev;
        return rest;
      }
      if (prev[key] === message) return prev;
      return { ...prev, [key]: message };
    });
  };

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
      setAvatarLoadFailed(false);
      setUser({
        ...profile.user,
        organization: profile.organization,
        organizationName: profile.organization?.name,
      });
      setFirstName(profile.user.firstName || "");
      setLastName(profile.user.lastName || "");
      setPhone(profile.user.phone ? formatPhone(profile.user.phone) : "");
      const bp = profile.user.brokerProfile || {};
      setCompany(
        profile.organization?.name || profile.user.brokerProfile?.company || "",
      );
      setLicenseNumber(bp.licenseNumber || "");
      setAddress(bp.address || "");
      setCity(bp.city || "");
      setState(normalizeStateCode(bp.state || ""));
      setZipCode(bp.zipCode || "");
      setWebsite(stripWebsitePrefix(bp.website || ""));
    } catch {
      toast.error("Unable to load profile");
    }
  }

  useEffect(() => {
    loadUser();
  }, []);

  // Reset broken-image flag whenever the saved profile path changes so a prior
  // 404 does not keep showing the initials fallback after a successful upload.
  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [user?.profileImage]);

  if (!user) {
    return (
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
        <div className="h-40 animate-pulse rounded-2xl bg-gradient-to-br from-[#13538A]/40 to-[#2C92D5]/30" />
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="h-96 animate-pulse rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 lg:col-span-2" />
          <div className="h-64 animate-pulse rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900" />
        </div>
      </div>
    );
  }

  const displayName =
    [firstName, lastName].filter(Boolean).join(" ").trim() || "Broker";
  const roleLabel = user.roles?.[0]?.replace(/_/g, " ") || "Broker";
  const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    displayName,
  )}&background=13538A&color=ffffff`;
  const remoteAvatarSrc =
    removeProfileImage
      ? null
      : buildApiPublicFileUrl(API_BASE, user.profileImage);
  // Cache-bust so a previously 404'd URL is not reused from browser cache.
  const remoteAvatarSrcFresh = remoteAvatarSrc
    ? `${remoteAvatarSrc}${remoteAvatarSrc.includes("?") ? "&" : "?"}v=${encodeURIComponent(user.profileImage)}`
    : null;
  const avatarSrc = profileImage
    ? URL.createObjectURL(profileImage)
    : !avatarLoadFailed && remoteAvatarSrcFresh
      ? remoteAvatarSrcFresh
      : fallbackAvatar;

  const hasSavedProfileImage = Boolean(user.profileImage) && !removeProfileImage;
  const canRemovePhoto = Boolean(profileImage) || hasSavedProfileImage;

  const isChanged =
    firstName !== user.firstName ||
    lastName !== user.lastName ||
    phone.replace(/\D/g, "") !== String(user.phone || "").replace(/\D/g, "") ||
    company !== resolveSavedCompanyName(user) ||
    licenseNumber !== (user.brokerProfile?.licenseNumber || "") ||
    address !== (user.brokerProfile?.address || "") ||
    city !== (user.brokerProfile?.city || "") ||
    state !== normalizeStateCode(user.brokerProfile?.state || "") ||
    zipCode !== (user.brokerProfile?.zipCode || "") ||
    stripWebsitePrefix(website) !==
      stripWebsitePrefix(user.brokerProfile?.website || "") ||
    Boolean(profileImage) ||
    removeProfileImage;

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
    setPasswordErrors({});
  };

  const handleChangePassword = async () => {
    const nextErrors: Record<string, string> = {};
    if (!currentPassword.trim()) {
      nextErrors.currentPassword = "Current password is required";
    }

    const passwordError = validateNewPassword(newPassword);
    if (passwordError) {
      nextErrors.newPassword = passwordError;
    }

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
    setTouched({
      firstName: true,
      lastName: true,
      phone: true,
      company: true,
      licenseNumber: true,
      address: true,
      city: true,
      state: true,
      zipCode: true,
      website: true,
    });

    if (Object.keys(errors).length > 0) {
      const firstError = Object.values(errors)[0];
      toast.error(firstError);
      return;
    }

    const formData = new FormData();
    formData.append("firstName", firstName.trim());
    formData.append("lastName", lastName.trim());
    formData.append("phone", phone.replace(/\D/g, ""));
    formData.append("company", company.trim());
    formData.append("licenseNumber", licenseNumber.trim());
    formData.append("address", address.trim());
    formData.append("city", city.trim());
    formData.append("state", normalizeStateCode(state));
    formData.append("zipCode", zipCode.trim());
    formData.append("website", toWebsiteUrl(website));
    if (profileImage) {
      formData.append("profileImage", profileImage);
    } else if (removeProfileImage) {
      formData.append("removeProfileImage", "true");
    }

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
      setRemoveProfileImage(false);
      setOriginalImageSize(0);
      setImageError(null);
      setImageProcessing(false);
      setAvatarLoadFailed(false);

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
    setRemoveProfileImage(false);
    setOriginalImageSize(0);
    setImageError(null);
    setImageProcessing(false);
    setAvatarLoadFailed(false);
    setFormErrors({});
    setTouched({});
    setFirstName(user.firstName || "");
    setLastName(user.lastName || "");
    setPhone(user.phone ? formatPhone(user.phone) : "");
    const bp = user.brokerProfile || {};
    setCompany(resolveSavedCompanyName(user));
    setLicenseNumber(bp.licenseNumber || "");
    setAddress(bp.address || "");
    setCity(bp.city || "");
    setState(normalizeStateCode(bp.state || ""));
    setZipCode(bp.zipCode || "");
    setWebsite(stripWebsitePrefix(bp.website || ""));
  };

  const handleAvatarFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarLoadFailed(false);
    setRemoveProfileImage(false);
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
          )}). Please choose one under ${formatBytes(MAX_IMAGE_BYTES)}.`,
        );
        toast.error(
          `Image is ${formatBytes(
            compressed.size,
          )} after compression. Max allowed is ${formatBytes(MAX_IMAGE_BYTES)}.`,
        );
        return;
      }

      setProfileImage(compressed);
      setOriginalImageSize(file.size);
      if (wasOverLimit) {
        toast.success(
          `Image compressed from ${formatBytes(file.size)} to ${formatBytes(
            compressed.size,
          )}`,
        );
      }
    } catch {
      setImageError("Unable to process this image.");
      toast.error("Unable to process this image");
    } finally {
      setImageProcessing(false);
    }
  };

  const companyLabel = editing ? company.trim() : user.organizationName;
  const stateDisplay =
    state ? US_STATES.find((s) => s.code === state)?.name || state : "";

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <section className="relative overflow-hidden rounded-2xl border border-[#13538A]/15 bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#2C92D5] p-5 text-white shadow-sm sm:p-7">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-20 left-1/4 h-40 w-40 rounded-full bg-cyan-300/20 blur-2xl" />
        </div>

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
            <div className="group relative shrink-0">
              <div className="relative h-24 w-24 overflow-hidden rounded-2xl border-4 border-white/30 bg-white/10 shadow-lg sm:h-28 sm:w-28">
                <img
                  key={remoteAvatarSrcFresh || "avatar-fallback"}
                  src={avatarSrc}
                  alt={displayName}
                  className="h-full w-full bg-white/20 object-contain"
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
                  <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center bg-black/55 text-white opacity-0 transition group-hover:opacity-100">
                    <Camera size={20} />
                    <span className="mt-1 text-[10px] font-medium">Change</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarFileChange}
                    />
                  </label>
                )}
              </div>
              {editing && canRemovePhoto && (
                <button
                  type="button"
                  onClick={() => {
                    setProfileImage(null);
                    setOriginalImageSize(0);
                    setImageError(null);
                    setRemoveProfileImage(true);
                    setAvatarLoadFailed(false);
                  }}
                  className="absolute -bottom-1 -right-1 inline-flex items-center justify-center rounded-full border border-white bg-red-500 p-1.5 text-white shadow-md transition hover:bg-red-600"
                  title="Remove photo"
                  aria-label="Remove profile photo"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>

            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
                Broker Profile
              </p>
              <h1
                className="mt-1 truncate text-2xl font-bold tracking-tight sm:text-3xl"
                title={displayName}
              >
                {displayName}
              </h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/85">
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase size={14} />
                  {roleLabel}
                </span>
                {companyLabel ? (
                  <>
                    <span className="text-white/35">·</span>
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <Building2 size={14} className="shrink-0" />
                      <span className="truncate">{companyLabel}</span>
                    </span>
                  </>
                ) : null}
              </p>
              {user.email ? (
                <p className="mt-1.5 flex items-center gap-1.5 truncate text-sm text-white/75">
                  <Mail size={14} className="shrink-0" />
                  <span className="truncate">{user.email}</span>
                </p>
              ) : null}

              {editing &&
                (imageProcessing ||
                  profileImage ||
                  imageError ||
                  removeProfileImage) && (
                  <div className="mt-3 max-w-md space-y-1">
                    {imageProcessing && (
                      <p className="flex items-center gap-2 text-xs text-cyan-100">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-200" />
                        Processing image…
                      </p>
                    )}
                    {!imageProcessing &&
                      removeProfileImage &&
                      !profileImage && (
                        <p className="text-xs font-medium text-amber-200">
                          Photo will be removed when you save.
                        </p>
                      )}
                    {!imageProcessing && profileImage && (
                      <p className="text-xs text-white/80">
                        {formatBytes(profileImage.size)}
                        {originalImageSize > MAX_IMAGE_BYTES
                          ? ` · compressed from ${formatBytes(originalImageSize)}`
                          : ""}
                      </p>
                    )}
                    {!imageProcessing && imageError && (
                      <p className="text-xs font-medium text-amber-200">
                        {imageError}
                      </p>
                    )}
                  </div>
                )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => (editing ? cancelEdit() : setEditing(true))}
            className={`inline-flex items-center gap-2 self-start rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              editing
                ? "border border-white/25 bg-white/10 text-white hover:bg-white/20"
                : "bg-white text-[#13538A] shadow-sm hover:bg-white/90"
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

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <SectionCard
            title="Personal Information"
            description="Your name and phone as shown across the broker portal."
          >
            <div className="grid gap-4 md:grid-cols-2">
                <ProfileField
                  label="First Name"
                  value={firstName}
                  editing={editing}
                  onChange={(v) => {
                    const next = sanitizeName(v);
                    setFirstName(next);
                    setTouched((t) => ({ ...t, firstName: true }));
                    setFieldError("firstName", next);
                  }}
                  onBlur={() => {
                    setTouched((t) => ({ ...t, firstName: true }));
                    setFieldError("firstName", firstName);
                  }}
                  icon={<User size={14} />}
                  error={
                    touched.firstName || formErrors.firstName
                      ? formErrors.firstName || getFieldError("firstName", firstName) || undefined
                      : undefined
                  }
                  maxLength={50}
                  fieldKey="firstName"
                />
                <ProfileField
                  label="Last Name"
                  value={lastName}
                  editing={editing}
                  onChange={(v) => {
                    const next = sanitizeName(v);
                    setLastName(next);
                    setTouched((t) => ({ ...t, lastName: true }));
                    setFieldError("lastName", next);
                  }}
                  onBlur={() => {
                    setTouched((t) => ({ ...t, lastName: true }));
                    setFieldError("lastName", lastName);
                  }}
                  icon={<User size={14} />}
                  error={
                    touched.lastName || formErrors.lastName
                      ? formErrors.lastName || getFieldError("lastName", lastName) || undefined
                      : undefined
                  }
                  maxLength={50}
                  fieldKey="lastName"
                />
                <ProfileField
                  label="Phone"
                  value={phone}
                  editing={editing}
                  onChange={(v) => {
                    const next = formatPhone(v);
                    setPhone(next);
                    setTouched((t) => ({ ...t, phone: true }));
                    setFieldError("phone", next);
                  }}
                  onBlur={() => {
                    setTouched((t) => ({ ...t, phone: true }));
                    setFieldError("phone", phone);
                  }}
                  icon={<Phone size={14} />}
                  error={
                    touched.phone || formErrors.phone
                      ? formErrors.phone || getFieldError("phone", phone) || undefined
                      : undefined
                  }
                  maxLength={12}
                  type="tel"
                  placeholder="888-888-8888"
                  fieldKey="phone"
                />
                <div className="md:col-span-2">
                  <InfoCard
                    label="Email"
                    value={user.email}
                    icon={<Mail size={18} />}
                    hint="Managed by your account — contact support to change."
                  />
                </div>
              </div>
          </SectionCard>

          <SectionCard
            title="Professional Information"
            description="Company, license, and location details used on applications and branding."
          >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <ProfileField
                    label="Company Name"
                    value={company}
                    editing={editing}
                    onChange={(v) => {
                      const next = v.slice(0, 100);
                      setCompany(next);
                      setTouched((t) => ({ ...t, company: true }));
                      setFieldError("company", next);
                    }}
                    onBlur={() => {
                      setTouched((t) => ({ ...t, company: true }));
                      setFieldError("company", company);
                    }}
                    icon={<Building2 size={14} />}
                    error={
                      touched.company || formErrors.company
                        ? formErrors.company || getFieldError("company", company) || undefined
                        : undefined
                    }
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
                    const next = sanitizeLicenseNumber(v);
                    setLicenseNumber(next);
                    setTouched((t) => ({ ...t, licenseNumber: true }));
                    setFieldError("licenseNumber", next);
                  }}
                  onBlur={() => {
                    setTouched((t) => ({ ...t, licenseNumber: true }));
                    setFieldError("licenseNumber", licenseNumber);
                  }}
                  icon={<Briefcase size={14} />}
                  error={
                    touched.licenseNumber || formErrors.licenseNumber
                      ? formErrors.licenseNumber ||
                        getFieldError("licenseNumber", licenseNumber) ||
                        undefined
                      : undefined
                  }
                  maxLength={30}
                  fieldKey="licenseNumber"
                  placeholder="e.g. CA-123456"
                />
                <ProfileField
                  label="Address"
                  value={address}
                  editing={editing}
                  onChange={(v) => {
                    const next = v.slice(0, 200);
                    setAddress(next);
                    setTouched((t) => ({ ...t, address: true }));
                    setFieldError("address", next);
                  }}
                  onBlur={() => {
                    setTouched((t) => ({ ...t, address: true }));
                    setFieldError("address", address);
                  }}
                  icon={<MapPin size={14} />}
                  error={
                    touched.address || formErrors.address
                      ? formErrors.address || getFieldError("address", address) || undefined
                      : undefined
                  }
                  maxLength={200}
                  fieldKey="address"
                />
                <ProfileField
                  label="City"
                  value={city}
                  editing={editing}
                  onChange={(v) => {
                    const next = sanitizeCity(v);
                    setCity(next);
                    setTouched((t) => ({ ...t, city: true }));
                    setFieldError("city", next);
                  }}
                  onBlur={() => {
                    setTouched((t) => ({ ...t, city: true }));
                    setFieldError("city", city);
                  }}
                  icon={<MapPin size={14} />}
                  error={
                    touched.city || formErrors.city
                      ? formErrors.city || getFieldError("city", city) || undefined
                      : undefined
                  }
                  maxLength={50}
                  fieldKey="city"
                />
                <ProfileField
                  label="State"
                  value={state}
                  editing={editing}
                  onChange={(v) => {
                    const next = normalizeStateCode(v);
                    setState(next);
                    setTouched((t) => ({ ...t, state: true }));
                    setFieldError("state", next);
                  }}
                  onBlur={() => {
                    setTouched((t) => ({ ...t, state: true }));
                    setFieldError("state", state);
                  }}
                  icon={<MapPin size={14} />}
                  error={
                    touched.state || formErrors.state
                      ? formErrors.state || getFieldError("state", state) || undefined
                      : undefined
                  }
                  fieldKey="state"
                  placeholder="Select state"
                  options={STATE_OPTIONS}
                  displayValue={stateDisplay}
                />
                <ProfileField
                  label="ZIP Code"
                  value={zipCode}
                  editing={editing}
                  onChange={(v) => {
                    const next = sanitizeZipCode(v);
                    setZipCode(next);
                    setTouched((t) => ({ ...t, zipCode: true }));
                    setFieldError("zipCode", next);
                  }}
                  onBlur={() => {
                    setTouched((t) => ({ ...t, zipCode: true }));
                    setFieldError("zipCode", zipCode);
                  }}
                  icon={<MapPin size={14} />}
                  error={
                    touched.zipCode || formErrors.zipCode
                      ? formErrors.zipCode || getFieldError("zipCode", zipCode) || undefined
                      : undefined
                  }
                  maxLength={10}
                  fieldKey="zipCode"
                  type="tel"
                  placeholder="12345"
                />
                <ProfileField
                  label="Website"
                  value={website}
                  editing={editing}
                  onChange={(v) => {
                    const next = sanitizeWebsiteHost(v);
                    setWebsite(next);
                    setTouched((t) => ({ ...t, website: true }));
                    setFieldError("website", next);
                  }}
                  onBlur={() => {
                    setTouched((t) => ({ ...t, website: true }));
                    setFieldError("website", website);
                  }}
                  icon={<Globe size={14} />}
                  error={
                    touched.website || formErrors.website
                      ? formErrors.website || getFieldError("website", website) || undefined
                      : undefined
                  }
                  maxLength={180}
                  fieldKey="website"
                  placeholder="example.com"
                  prefix={WEBSITE_PREFIX}
                  displayValue={website ? toWebsiteUrl(website) : ""}
                />
              </div>
          </SectionCard>

          <SectionCard
            title="Security"
            description="Keep your broker account secure with a strong password."
          >
              <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 dark:border-gray-800 dark:bg-gray-800/40">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                      <LockKeyhole size={16} />
                      Password
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
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
                    className="rounded-xl border border-[#13538A]/20 bg-[#13538A]/5 px-4 py-2 text-sm font-medium text-[#13538A] transition hover:bg-[#13538A]/10 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300"
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
                          if (
                            confirmPassword &&
                            v !== confirmPassword
                          ) {
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
          </SectionCard>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Account Overview
              </h4>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Your broker portal at a glance.
              </p>
            </div>
            <div className="space-y-4 p-5">
              <div
                className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium ${
                  user.status === "DISABLED"
                    ? "border border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300"
                    : "border border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-400"
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
                {user.status === "DISABLED" ? "Inactive Account" : "Active Account"}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatTile
                  label="Applications"
                  value={String(user.applicationCount ?? 0)}
                />
                <StatTile label="Role" value={roleLabel} compact />
              </div>

              <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3 dark:border-gray-800 dark:bg-gray-800/50">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  <ShieldCheck size={12} />
                  Sign-in email
                </p>
                <p className="mt-1 truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                  {user.email}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#13538A]/15 bg-gradient-to-br from-[#13538A]/8 to-transparent p-5 dark:border-[#13538A]/25 dark:from-[#13538A]/15">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#13538A]">
              Tip
            </p>
            <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              Keep your company name, license, and contact details updated so
              lenders and clients see accurate information across the platform.
            </p>
          </div>
        </aside>
      </div>

      {editing && (
        <div className="sticky bottom-4 z-20 mt-2 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur dark:border-gray-800 dark:bg-gray-950/95">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {isChanged ? "Unsaved changes" : "Editing profile"}
              </p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {isChanged
                  ? "Save to update your broker profile across the portal."
                  : "Make a change to enable Save."}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !isChanged}
                className="inline-flex items-center gap-2 rounded-xl bg-[#13538A] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1a6aad] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-800 dark:disabled:text-gray-500"
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
          </div>
        </div>
      )}
    </div>
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
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {description}
          </p>
        ) : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function ProfileField({
  label,
  value,
  editing,
  onChange,
  onBlur,
  icon,
  error,
  maxLength,
  type = "text",
  placeholder,
  fieldKey,
  options,
  prefix,
  displayValue,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  icon: React.ReactNode;
  error?: string;
  maxLength?: number;
  type?: string;
  placeholder?: string;
  fieldKey?: string;
  options?: { value: string; label: string }[];
  prefix?: string;
  displayValue?: string;
}) {
  const counter = fieldKey ? getFieldCounter(fieldKey, value || "") : null;
  const hasError = Boolean(error);
  const errorBorderClass = hasError
    ? "border-red-400 bg-red-50/60 focus:border-red-500 focus:ring-red-500/10 dark:bg-red-950/20"
    : "";
  const shownValue = displayValue ?? value;

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
        {icon}
        {label}
      </label>
      {editing && onChange ? (
        <>
          {options ? (
            <select
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
              aria-invalid={hasError}
              className={`${inputClass} ${errorBorderClass} ${
                !value ? "text-gray-400" : ""
              }`}
            >
              <option value="">{placeholder || "Select"}</option>
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : prefix ? (
            <div
              className={`flex overflow-hidden rounded-xl border bg-gray-50 transition focus-within:ring-2 dark:bg-gray-800 ${
                hasError
                  ? "border-red-400 focus-within:border-red-500 focus-within:ring-red-500/10"
                  : "border-gray-200 focus-within:border-[#13538A]/40 focus-within:ring-[#13538A]/10 dark:border-gray-700"
              }`}
            >
              <span className="flex shrink-0 items-center border-r border-gray-200 bg-gray-100 px-3 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                {prefix}
              </span>
              <input
                type={type === "url" ? "text" : type}
                value={value}
                maxLength={maxLength}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                aria-invalid={hasError}
                className="w-full bg-transparent px-3 py-2.5 text-sm text-gray-900 outline-none dark:text-white"
              />
            </div>
          ) : (
            <input
              type={type}
              value={value}
              maxLength={maxLength}
              placeholder={placeholder}
              inputMode={type === "tel" ? "numeric" : undefined}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
              aria-invalid={hasError}
              className={`${inputClass} ${errorBorderClass}`}
            />
          )}
          <div className="flex items-start justify-between gap-2">
            <p
              className={`min-h-[1rem] flex-1 ${hasError ? errorTextClass : "text-transparent text-xs"}`}
            >
              {error || "·"}
            </p>
            {counter && !options && (
              <p
                className={`shrink-0 text-xs ${
                  hasError
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
        <div className={displayClass} title={shownValue || undefined}>
          {truncateText(
            shownValue || "",
            maxLength && maxLength < 60 ? maxLength : 60,
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
    <div className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/80 p-4 dark:border-gray-800 dark:bg-gray-800/40">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#13538A]/10 text-[#13538A]">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-400">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-gray-900 dark:text-white">
          {value || "—"}
        </p>
        {hint ? (
          <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
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
      <label className="text-xs text-gray-500 dark:text-gray-400">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={hasError}
          className={`${inputClass} pr-11 ${
            hasError
              ? "border-red-400 bg-red-50/60 focus:border-red-500 focus:ring-red-500/10 dark:bg-red-950/20"
              : ""
          }`}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {hasError ? <p className={errorTextClass}>{error}</p> : null}
    </div>
  );
}
