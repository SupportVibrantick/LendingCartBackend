import { useEffect, useState } from "react";
import toast from "react-hot-toast";

const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:4000";

/* ================= TYPES ================= */

type LenderProfile = {
  firstName: string;
  lastName: string;
  summary: string;
  loanTypes: string;
  minFunding: string;
  maxFunding: string;
  statesSupported: string;
  industries: string;
  fundingSpeedDays: string;
  profileImage?: File | null;
};

/* ================= HELPERS ================= */

function getAuthHeaders() {
  const token = sessionStorage.getItem("lender_token");
  return {
    Authorization: `Bearer ${token}`,
  };
}

/* ================= PAGE ================= */

export default function EditLenderProfile() {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [existingImage, setExistingImage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");

  const [form, setForm] = useState<LenderProfile>({
    firstName: "",
    lastName: "",
    summary: "",
    loanTypes: "",
    minFunding: "",
    maxFunding: "",
    statesSupported: "",
    industries: "",
    fundingSpeedDays: "",
    profileImage: null,
  });

  const validate = () => {
    const e: Record<string, string> = {};

    if (!form.firstName.trim()) e.firstName = "First name is required";
    if (!form.lastName.trim()) e.lastName = "Last name is required";

    if (!form.summary.trim() || form.summary.length < 10) {
      e.summary = "Summary must be at least 10 characters";
    }

    if (!form.loanTypes.trim()) {
      e.loanTypes = "Please enter at least one loan type";
    }

    if (!form.statesSupported.trim()) {
      e.statesSupported = "Please enter supported states";
    }

    const min = Number(form.minFunding);
    const max = Number(form.maxFunding);

    if (!min || min <= 0) e.minFunding = "Enter valid minimum funding";
    if (!max || max <= 0) e.maxFunding = "Enter valid maximum funding";

    if (min && max && min > max) {
      e.maxFunding = "Max funding must be greater than Min funding";
    }

    const days = Number(form.fundingSpeedDays);
    if (!days || days < 1 || days > 365) {
      e.fundingSpeedDays = "Funding speed must be between 1–365 days";
    }

    if (form.profileImage) {
      const allowed = ["image/png", "image/jpeg", "image/jpg"];
      if (!allowed.includes(form.profileImage.type)) {
        e.profileImage = "Only JPG / PNG images allowed";
      }
      if (form.profileImage.size > 2 * 1024 * 1024) {
        e.profileImage = "Image size must be under 2MB";
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ================= HANDLERS ================= */

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    // validation already aapke code me hai (type / size)

    setForm((p) => ({
      ...p,
      profileImage: file,
    }));

    // instant preview
    const localUrl = URL.createObjectURL(file);
    setPreviewImage(localUrl);
  };

  /* ================= SUBMIT ================= */
  const loadProfile = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/lender/auth/me`,
        {
          headers: getAuthHeaders(),
        }
      );

      const json = await res.json();

      if (!res.ok || json.ok !== true) {
        throw new Error("Failed to load profile");
      }

      const { user, lenderProfile } = json.data;

      setOrgName(json.data.organization?.name || "Lender");
      setExistingImage(user.profileImage || null);

      setForm((p) => ({
        ...p,
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        summary: lenderProfile?.summary || "",
        loanTypes: (lenderProfile?.loanTypes || []).join(", "),
        minFunding: lenderProfile?.minFunding || "",
        maxFunding: lenderProfile?.maxFunding || "",
        statesSupported: lenderProfile?.statesSupported || "",
        industries: lenderProfile?.industries || "",
        fundingSpeedDays: lenderProfile?.fundingSpeedDays
          ? String(lenderProfile.fundingSpeedDays)
          : "",
        profileImage: null, // file user manually change karega
      }));

    } catch (err: any) {
      toast.error(err.message || "Unable to load profile");
    }
  };

  const handleSubmit = async () => {
    if (!validate()) {
      // toast.error("Please fix the highlighted errors");
      return;
    }

    try {
      setLoading(true);
      const fd = new FormData();

      fd.append("firstName", form.firstName);
      fd.append("lastName", form.lastName);
      fd.append("summary", form.summary);

      const loanTypesArray = form.loanTypes
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      fd.append("loanTypes", JSON.stringify(loanTypesArray));

      fd.append("minFunding", form.minFunding);
      fd.append("maxFunding", form.maxFunding);
      fd.append("statesSupported", form.statesSupported);
      fd.append("industries", form.industries);
      fd.append("fundingSpeedDays", form.fundingSpeedDays);

      if (form.profileImage) {
        fd.append("profileImage", form.profileImage);
      }

      const res = await fetch(`${API_BASE}/lender/auth/profile`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: fd,
      });

      const json = await res.json();
      if (!res.ok || json.success !== true) {
        throw new Error(json.message);
      }

      toast.success("Profile updated successfully");
      loadProfile();
    } catch (err: any) {
      toast.error(err.message || "Update failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    return () => {
      if (previewImage) {
        URL.revokeObjectURL(previewImage);
      }
    };
  }, [previewImage]);

  const DEFAULT_LENDER_IMAGE =
    "https://ui-avatars.com/api/?name=Lender&background=0D8ABC&color=fff&size=256";

  /* ================= UI ================= */

  return (
    <div className="min-h-screen p-6 bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-xl font-semibold mb-6">
          Edit Lender Profile
        </h1>

        {/* ===== PROFILE HEADER (TOP CENTER) ===== */}
        <div className="flex flex-col items-center text-center mb-10">

          {/* Profile Image */}
          <img
            src={
              previewImage
                ? previewImage
                : existingImage
                  ? `${API_BASE}/public/${existingImage}`
                  : DEFAULT_LENDER_IMAGE
            }
            alt="Profile"
            className="h-28 w-28 rounded-full object-cover border-2
               border-slate-300 dark:border-slate-600 shadow-sm"
          />

          {/* ORGANIZATION NAME ONLY */}
          <h2 className="mt-4 text-lg font-semibold tracking-wide
                 text-slate-900 dark:text-slate-100">
            {orgName}
          </h2>

          {/* CHOOSE PROFILE IMAGE */}
          <label className="mt-4 inline-flex items-center gap-2 cursor-pointer">
            <span className="px-4 py-2 rounded-lg text-sm font-medium
                     bg-blue-600 text-white hover:bg-blue-700 transition">
              Choose Profile Image
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          {errors.profileImage && (
            <p className="text-xs text-red-500 mt-2">
              {errors.profileImage}
            </p>
          )}
        </div>


        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-6">

          {/* NAME */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* First Name */}
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-300">
                First Name *
              </label>
              <input
                name="firstName"
                placeholder="First Name"
                value={form.firstName}
                onChange={handleChange}
                className={`w-full rounded-lg border px-3 py-2 text-sm
                ${errors.firstName ? "border-red-500" : "border-slate-300"}
                bg-white dark:bg-slate-800 dark:border-slate-600`}
              />
              {errors.firstName && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.firstName}
                </p>
              )}
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-300">
                Last Name *
              </label>
              <input
                name="lastName"
                placeholder="Last Name"
                value={form.lastName}
                onChange={handleChange}
                className={`w-full rounded-lg border px-3 py-2 text-sm
                ${errors.lastName ? "border-red-500" : "border-slate-300"}
                bg-white dark:bg-slate-800 dark:border-slate-600`}
              />
              {errors.lastName && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.lastName}
                </p>
              )}
            </div>


          </div>

          {/* SUMMARY */}
          <div>
            <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-300">
              Business Summary *
            </label>
            <textarea
              name="summary"
              rows={6}
              placeholder="Short summary about your lending business"
              value={form.summary}
              onChange={handleChange}
              className={`w-full rounded-lg border px-3 py-2 text-sm resize-none
              ${errors.summary ? "border-red-500" : "border-slate-300"}
              bg-white dark:bg-slate-800 dark:border-slate-600`}
            />
            {errors.summary && (
              <p className="text-xs text-red-500 mt-1">
                {errors.summary}
              </p>
            )}
          </div>

          {/* LOAN TYPES */}
          <div>
            <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-300">
              Loan Types (comma separated) *
            </label>
            <input
              name="loanTypes"
              placeholder="Loan Types (e.g. SBA, DSCR)"
              value={form.loanTypes}
              onChange={handleChange}
              className={`w-full rounded-lg border px-3 py-2 text-sm
              ${errors.loanTypes ? "border-red-500" : "border-slate-300"}
              bg-white dark:bg-slate-800 dark:border-slate-600`}
            />
            {errors.loanTypes && (
              <p className="text-xs text-red-500 mt-1">
                {errors.loanTypes}
              </p>
            )}
          </div>

          {/* FUNDING RANGE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-300">
                Min Funding *
              </label>
              <input
                type="number"
                name="minFunding"
                placeholder="Minimum Funding Amount"
                min={0}
                value={form.minFunding}
                onChange={handleChange}
                className={`w-full rounded-lg border px-3 py-2 text-sm
                ${errors.minFunding ? "border-red-500" : "border-slate-300"}
                bg-white dark:bg-slate-800 dark:border-slate-600`}
              />
              {errors.minFunding && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.minFunding}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-300">
                Max Funding *
              </label>
              <input
                type="number"
                name="maxFunding"
                placeholder="Maximum Funding Amount"
                min={0}
                value={form.maxFunding}
                onChange={handleChange}
                className={`w-full rounded-lg border px-3 py-2 text-sm
                ${errors.maxFunding ? "border-red-500" : "border-slate-300"}
                bg-white dark:bg-slate-800 dark:border-slate-600`}
              />
              {errors.maxFunding && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.maxFunding}
                </p>
              )}
            </div>
          </div>

          {/* STATES + INDUSTRIES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-300">
                States Supported *
              </label>
              <input
                name="statesSupported"
                placeholder="States Supported (CA, TX, NY)"
                value={form.statesSupported}
                onChange={handleChange}
                className={`w-full rounded-lg border px-3 py-2 text-sm
                ${errors.statesSupported ? "border-red-500" : "border-slate-300"}
                bg-white dark:bg-slate-800 dark:border-slate-600`}
              />
              {errors.statesSupported && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.statesSupported}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-300">
                Industries
              </label>
              <input
                name="industries"
                placeholder="Industries (Real Estate, Hospitality)"
                value={form.industries}
                onChange={handleChange}
                className="w-full rounded-lg border px-3 py-2 text-sm
                bg-white dark:bg-slate-800 dark:border-slate-600"
              />
            </div>
          </div>

          {/* FUNDING SPEED */}
          <div>
            <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-300">
              Funding Speed (days) *
            </label>
            <input
              name="fundingSpeedDays"
              placeholder="Funding Speed (days)"
              value={form.fundingSpeedDays}
              onChange={handleChange}
              className={`w-full rounded-lg border px-3 py-2 text-sm
              ${errors.fundingSpeedDays ? "border-red-500" : "border-slate-300"}
              bg-white dark:bg-slate-800 dark:border-slate-600`}
            />
            {errors.fundingSpeedDays && (
              <p className="text-xs text-red-500 mt-1">
                {errors.fundingSpeedDays}
              </p>
            )}
          </div>

          {/* ACTION */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60
            text-white px-6 py-2 rounded-lg text-sm"
          >
            {loading ? "Saving..." : "Save Profile"}
          </button>

        </div>
      </div>
    </div>
  );
}
