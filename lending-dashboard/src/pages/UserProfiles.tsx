import { useEffect, useState } from "react";
import { Camera, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import Select, { MultiValue } from "react-select";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

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

const US_STATES = [
  { value: "Alabama", label: "Alabama" },
  { value: "Alaska", label: "Alaska" },
  { value: "Arizona", label: "Arizona" },
  { value: "Arkansas", label: "Arkansas" },
  { value: "California", label: "California" },
  { value: "Colorado", label: "Colorado" },
  { value: "Connecticut", label: "Connecticut" },
  { value: "Delaware", label: "Delaware" },
  { value: "Florida", label: "Florida" },
  { value: "Georgia", label: "Georgia" },
  { value: "Hawaii", label: "Hawaii" },
  { value: "Idaho", label: "Idaho" },
  { value: "Illinois", label: "Illinois" },
  { value: "Indiana", label: "Indiana" },
  { value: "Iowa", label: "Iowa" },
  { value: "Kansas", label: "Kansas" },
  { value: "Kentucky", label: "Kentucky" },
  { value: "Louisiana", label: "Louisiana" },
  { value: "Maine", label: "Maine" },
  { value: "Maryland", label: "Maryland" },
  { value: "Massachusetts", label: "Massachusetts" },
  { value: "Michigan", label: "Michigan" },
  { value: "Minnesota", label: "Minnesota" },
  { value: "Mississippi", label: "Mississippi" },
  { value: "Missouri", label: "Missouri" },
  { value: "Montana", label: "Montana" },
  { value: "Nebraska", label: "Nebraska" },
  { value: "Nevada", label: "Nevada" },
  { value: "New Hampshire", label: "New Hampshire" },
  { value: "New Jersey", label: "New Jersey" },
  { value: "New Mexico", label: "New Mexico" },
  { value: "New York", label: "New York" },
  { value: "North Carolina", label: "North Carolina" },
  { value: "North Dakota", label: "North Dakota" },
  { value: "Ohio", label: "Ohio" },
  { value: "Oklahoma", label: "Oklahoma" },
  { value: "Oregon", label: "Oregon" },
  { value: "Pennsylvania", label: "Pennsylvania" },
  { value: "Rhode Island", label: "Rhode Island" },
  { value: "South Carolina", label: "South Carolina" },
  { value: "South Dakota", label: "South Dakota" },
  { value: "Tennessee", label: "Tennessee" },
  { value: "Texas", label: "Texas" },
  { value: "Utah", label: "Utah" },
  { value: "Vermont", label: "Vermont" },
  { value: "Virginia", label: "Virginia" },
  { value: "Washington", label: "Washington" },
  { value: "West Virginia", label: "West Virginia" },
  { value: "Wisconsin", label: "Wisconsin" },
  { value: "Wyoming", label: "Wyoming" },
];

const INDUSTRIES = [
  { value: "Real Estate", label: "Real Estate" },
  { value: "Hospitality", label: "Hospitality" },
  { value: "Healthcare", label: "Healthcare" },
  { value: "Construction", label: "Construction" },
  { value: "Retail", label: "Retail" },
  { value: "Restaurants", label: "Restaurants" },
  { value: "Manufacturing", label: "Manufacturing" },
  { value: "Transportation", label: "Transportation" },
  { value: "Logistics", label: "Logistics" },
  { value: "Technology", label: "Technology" },
  { value: "Education", label: "Education" },
  { value: "Automotive", label: "Automotive" },
  { value: "E-Commerce", label: "E-Commerce" },
  { value: "Finance", label: "Finance" },
  { value: "Insurance", label: "Insurance" },
  { value: "Energy", label: "Energy" },
  { value: "Agriculture", label: "Agriculture" },
  { value: "Entertainment", label: "Entertainment" },
  { value: "Fitness", label: "Fitness" },
  { value: "Beauty", label: "Beauty" },
];

/* ================= PAGE ================= */

export default function EditLenderProfile() {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [existingImage, setExistingImage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loanTypeOptions, setLoanTypeOptions] = useState<
  { value: string; label: string }[]
>([]);
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
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
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
  const loadLoanTypes = async () => {
  try {
    const res = await fetch(
      `${API_BASE}/common/loan-products/loan-product-code`
    );

    const json = await res.json();

    if (!res.ok || !json.success) return;

    setLoanTypeOptions(
      json.data.map((item: any) => ({
        value: item.code,
        label: item.name,
      }))
    );
  } catch (err) {
    console.error("Failed to load loan types", err);
  }
};

  const loadProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/lender/auth/me`, {
        headers: getAuthHeaders(),
      });

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
    loadLoanTypes();
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
      <div className="max-w-8xl mx-auto">
        {/* ================= HEADER ================= */}
        <div
          className="relative overflow-hidden rounded-[28px]
  bg-white dark:bg-slate-900
  border border-slate-200 dark:border-slate-800
  mb-8"
        >
          {/* TOP BAR */}
          <div className="h-28 bg-[#134E4A]" />

          <div className="px-6 pb-6">
            {/* PROFILE */}
            <div
              className="-mt-10 flex flex-col lg:flex-row
      lg:items-end lg:justify-between gap-5"
            >
              {/* LEFT */}
              <div className="flex items-end gap-4">
                {/* IMAGE */}
                <div
                  className="relative h-20 w-20 rounded-full
          border-4 border-white dark:border-slate-900
          overflow-hidden bg-slate-100"
                >
                  <img
                    src={
                      previewImage
                        ? previewImage
                        : existingImage
                          ? `${API_BASE}/public/${existingImage}`
                          : DEFAULT_LENDER_IMAGE
                    }
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />

                  {/* ACTIVE DOT */}
                  {/* <div
                    className="absolute bottom-1 right-1
            h-3 w-3 rounded-full
            bg-emerald-500 border-2 border-white"
                  /> */}
                </div>

                {/* TEXT */}
                <div className="pb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1
                      className="text-lg font-semibold
              text-white"
                    >
                      {orgName}
                    </h1>

                    <div
                      className="inline-flex items-center gap-1
              px-2 py-0.5 rounded-full
              bg-emerald-50 text-emerald-600"
                    >
                      <ShieldCheck size={11} />

                      <span className="text-[10px] font-semibold">ACTIVE</span>
                    </div>
                  </div>

                  <p
                    className="mt-1 text-sm font-medium
            text-slate-600 dark:text-slate-400"
                  >
                    {orgName}
                  </p>

                  <p
                    className="text-xs text-slate-500
            dark:text-slate-500"
                  >
                    Manage lender profile details
                  </p>
                </div>
              </div>

              {/* BUTTON */}
              <label
                className="cursor-pointer inline-flex items-center
        gap-3 rounded-2xl px-4 py-2.5
        border border-slate-200 dark:border-slate-700
        bg-slate-50 dark:bg-slate-800
        transition-all hover:bg-slate-100
        dark:hover:bg-slate-700"
              >
                {/* ICON */}
                <div
                  className="h-8 w-8 rounded-xl
          bg-cyan-500 text-white
          flex items-center justify-center"
                >
                  <Camera size={14} />
                </div>

                <div>
                  <p
                    className="text-xs font-semibold
            text-slate-900 dark:text-white"
                  >
                    Upload Photo
                  </p>

                  <p className="text-[10px] text-slate-500">JPG / PNG</p>
                </div>

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {/* ERROR */}
            {errors.profileImage && (
              <p className="mt-3 text-xs text-red-500">{errors.profileImage}</p>
            )}
          </div>
        </div>

        <div
          className="rounded-[30px]
  border border-slate-200 dark:border-slate-800
  bg-white dark:bg-slate-900 overflow-hidden"
        >
          {/* TOP BAR */}
          <div
            className="flex items-center justify-between
    border-b border-slate-200 dark:border-slate-800
    px-6 py-4"
          >
            <div>
              <h2
                className="text-sm font-semibold
        text-slate-900 dark:text-white"
              >
                Lender Information
              </h2>

              <p
                className="mt-0.5 text-xs
        text-slate-500"
              >
                Update business and funding details
              </p>
            </div>

            <div
              className="rounded-xl bg-[#134E4A]/10
      px-3 py-1.5"
            >
              <p
                className="text-[10px] font-semibold
        tracking-wide text-[#134E4A]"
              >
                PROFILE SETTINGS
              </p>
            </div>
          </div>

          {/* BODY */}
          <div className="p-6 space-y-6">
            {/* ================= NAME ================= */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* FIRST NAME */}
              <div>
                <label
                  className="mb-2 block text-xs font-semibold
          text-slate-700 dark:text-slate-300"
                >
                  First Name
                </label>

                <input
                  name="firstName"
                  placeholder="Enter first name"
                  value={form.firstName}
                  onChange={handleChange}
                  className={`h-11 w-full rounded-2xl border
          bg-slate-50 dark:bg-slate-800
          px-4 text-sm outline-none transition-all
          focus:border-[#134E4A]
          ${
            errors.firstName
              ? "border-red-500"
              : "border-slate-200 dark:border-slate-700"
          }`}
                />

                {errors.firstName && (
                  <p className="mt-1 text-[11px] text-red-500">
                    {errors.firstName}
                  </p>
                )}
              </div>

              {/* LAST NAME */}
              <div>
                <label
                  className="mb-2 block text-xs font-semibold
          text-slate-700 dark:text-slate-300"
                >
                  Last Name
                </label>

                <input
                  name="lastName"
                  placeholder="Enter last name"
                  value={form.lastName}
                  onChange={handleChange}
                  className={`h-11 w-full rounded-2xl border
          bg-slate-50 dark:bg-slate-800
          px-4 text-sm outline-none transition-all
          focus:border-[#134E4A]
          ${
            errors.lastName
              ? "border-red-500"
              : "border-slate-200 dark:border-slate-700"
          }`}
                />

                {errors.lastName && (
                  <p className="mt-1 text-[11px] text-red-500">
                    {errors.lastName}
                  </p>
                )}
              </div>
            </div>

            {/* ================= SUMMARY ================= */}
            <div>
              <label
                className="mb-2 block text-xs font-semibold
        text-slate-700 dark:text-slate-300"
              >
                Business Summary
              </label>

              <textarea
                name="summary"
                rows={5}
                placeholder="Write a short summary about your lending business..."
                value={form.summary}
                onChange={handleChange}
                className={`w-full rounded-3xl border
        bg-slate-50 dark:bg-slate-800
        px-4 py-3 text-sm resize-none
        outline-none transition-all
        focus:border-[#134E4A]
        ${
          errors.summary
            ? "border-red-500"
            : "border-slate-200 dark:border-slate-700"
        }`}
              />

              {errors.summary && (
                <p className="mt-1 text-[11px] text-red-500">
                  {errors.summary}
                </p>
              )}
            </div>

            {/* ================= LOAN TYPES ================= */}
            <div>
              <label
                className="mb-2 block text-xs font-semibold
        text-slate-700 dark:text-slate-300"
              >
                Loan Types
              </label>

   <Select
  isMulti
  options={loanTypeOptions}
  placeholder="Select loan types"
  value={loanTypeOptions.filter((option) =>
    form.loanTypes
      ?.split(",")
      .map((s) => s.trim())
      .includes(option.value)
  )}
  onChange={(selectedOptions) => {
    const values = selectedOptions.map(
      (option: { value: string; label: string }) => option.value
    );

    setForm((prev) => ({
      ...prev,
      loanTypes: values.join(", "),
    }));
  }}
  className="text-sm"
  classNames={{
    control: ({ isFocused }) =>
      `!min-h-[44px] !rounded-2xl !border
      !bg-slate-50 dark:!bg-slate-800
      ${
        errors.loanTypes
          ? "!border-red-500"
          : isFocused
          ? "!border-[#134E4A]"
          : "!border-slate-200 dark:!border-slate-700"
      }`,

    menu: () =>
      `!rounded-2xl !overflow-hidden
      !border !border-slate-200
      dark:!border-slate-700
      !bg-white dark:!bg-slate-800`,

    option: ({ isFocused, isSelected }) =>
      `
      !text-sm
      ${
        isSelected
          ? "!bg-[#134E4A] !text-white"
          : isFocused
          ? "!bg-slate-100 dark:!bg-slate-700"
          : "!bg-white dark:!bg-slate-800"
      }
    `,

    multiValue: () => `!bg-[#134E4A]/10 !rounded-xl`,
    multiValueLabel: () =>
      `!text-[#134E4A] !text-xs !font-medium`,
    multiValueRemove: () =>
      `hover:!bg-red-500 hover:!text-white !rounded-r-xl`,
    placeholder: () => `!text-slate-400 !text-sm`,
    input: () => `dark:!text-white`,
    menuList: () => `dark:!bg-slate-800`,
  }}
/>

              {errors.loanTypes && (
                <p className="mt-1 text-[11px] text-red-500">
                  {errors.loanTypes}
                </p>
              )}
            </div>

            {/* ================= FUNDING ================= */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* MIN */}
              <div>
                <label
                  className="mb-2 block text-xs font-semibold
          text-slate-700 dark:text-slate-300"
                >
                  Minimum Funding
                </label>

                <input
                  type="number"
                  name="minFunding"
                  min={0}
                  placeholder="$50,000"
                  value={form.minFunding}
                  onChange={handleChange}
                  className={`h-11 w-full rounded-2xl border
          bg-slate-50 dark:bg-slate-800
          px-4 text-sm outline-none transition-all
          focus:border-[#134E4A]
          ${
            errors.minFunding
              ? "border-red-500"
              : "border-slate-200 dark:border-slate-700"
          }`}
                />

                {errors.minFunding && (
                  <p className="mt-1 text-[11px] text-red-500">
                    {errors.minFunding}
                  </p>
                )}
              </div>

              {/* MAX */}
              <div>
                <label
                  className="mb-2 block text-xs font-semibold
          text-slate-700 dark:text-slate-300"
                >
                  Maximum Funding
                </label>

                <input
                  type="number"
                  name="maxFunding"
                  min={0}
                  placeholder="$5,000,000"
                  value={form.maxFunding}
                  onChange={handleChange}
                  className={`h-11 w-full rounded-2xl border
          bg-slate-50 dark:bg-slate-800
          px-4 text-sm outline-none transition-all
          focus:border-[#134E4A]
          ${
            errors.maxFunding
              ? "border-red-500"
              : "border-slate-200 dark:border-slate-700"
          }`}
                />

                {errors.maxFunding && (
                  <p className="mt-1 text-[11px] text-red-500">
                    {errors.maxFunding}
                  </p>
                )}
              </div>
            </div>

            {/* ================= STATES + INDUSTRIES ================= */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* STATES */}
              <div>
                <label
                  className="mb-2 block text-xs font-semibold
    text-slate-700 dark:text-slate-300"
                >
                  States Supported
                </label>

                <Select
                  isMulti
                  options={US_STATES}
                  placeholder="Select supported states"
                  value={US_STATES.filter((state) =>
                    form.statesSupported
                      ?.split(",")
                      .map((s) => s.trim())
                      .includes(state.value),
                  )}
                  onChange={(
                    selectedOptions: MultiValue<{
                      value: string;
                      label: string;
                    }>,
                  ) => {
                    const values = selectedOptions.map(
                      (option: { value: string; label: string }) =>
                        option.value,
                    );

                    setForm((prev) => ({
                      ...prev,
                      statesSupported: values.join(", "),
                    }));
                  }}
                  className="text-sm"
                  classNames={{
                    control: ({
  isFocused,
}: {
  isFocused: boolean;
}) =>
                      `!min-h-[44px] !rounded-2xl !border
        !bg-slate-50 dark:!bg-slate-800
        ${
          errors.statesSupported
            ? "!border-red-500"
            : isFocused
              ? "!border-[#134E4A]"
              : "!border-slate-200 dark:!border-slate-700"
        }`,

                    menu: () =>
                      `!rounded-2xl !overflow-hidden
        !border !border-slate-200
        dark:!border-slate-700
        !bg-white dark:!bg-slate-800`,

                  option: ({
  isFocused,
  isSelected,
}: {
  isFocused: boolean;
  isSelected: boolean;
}) =>

  
                      `
        !text-sm
        ${
          isSelected
            ? "!bg-[#134E4A] !text-white"
            : isFocused
              ? "!bg-slate-100 dark:!bg-slate-700"
              : "!bg-white dark:!bg-slate-800"
        }
      `,

                    multiValue: () => `!bg-[#134E4A]/10 !rounded-xl`,

                    multiValueLabel: () =>
                      `!text-[#134E4A] !text-xs !font-medium`,

                    multiValueRemove: () =>
                      `hover:!bg-red-500 hover:!text-white
        !rounded-r-xl`,

                    placeholder: () => `!text-slate-400 !text-sm`,

                    input: () => `dark:!text-white`,

                    singleValue: () => `dark:!text-white`,

                    menuList: () => `dark:!bg-slate-800`,
                  }}
                />

                {errors.statesSupported && (
                  <p className="mt-1 text-[11px] text-red-500">
                    {errors.statesSupported}
                  </p>
                )}
              </div>

              {/* INDUSTRIES */}
              <div>
                <label
                  className="mb-2 block text-xs font-semibold
    text-slate-700 dark:text-slate-300"
                >
                  Industries
                </label>

                <Select
                  isMulti
                  options={INDUSTRIES}
                  placeholder="Select industries"
                  value={INDUSTRIES.filter((industry) =>
                    form.industries
                      ?.split(",")
                      .map((s) => s.trim())
                      .includes(industry.value),
                  )}
                  onChange={(
                    selectedOptions: MultiValue<{
                      value: string;
                      label: string;
                    }>,
                  ) => {
                    const values = selectedOptions.map(
                      (option: { value: string; label: string }) =>
                        option.value,
                    );

                    setForm((prev) => ({
                      ...prev,
                      industries: values.join(", "),
                    }));
                  }}
                  className="text-sm"
                  classNames={{
                  control: ({
  isFocused,
}: {
  isFocused: boolean;
}) =>
                      `!min-h-[44px] !rounded-2xl !border
        !bg-slate-50 dark:!bg-slate-800
        ${
          isFocused
            ? "!border-[#134E4A]"
            : "!border-slate-200 dark:!border-slate-700"
        }`,

                    menu: () =>
                      `!rounded-2xl !overflow-hidden
        !border !border-slate-200
        dark:!border-slate-700
        !bg-white dark:!bg-slate-800`,

                 option: ({
  isFocused,
  isSelected,
}: {
  isFocused: boolean;
  isSelected: boolean;
}) =>
                      `
        !text-sm
        ${
          isSelected
            ? "!bg-[#134E4A] !text-white"
            : isFocused
              ? "!bg-slate-100 dark:!bg-slate-700"
              : "!bg-white dark:!bg-slate-800"
        }
      `,

                    multiValue: () => `!bg-[#134E4A]/10 !rounded-xl`,

                    multiValueLabel: () =>
                      `!text-[#134E4A] !text-xs !font-medium`,

                    multiValueRemove: () =>
                      `hover:!bg-red-500 hover:!text-white
        !rounded-r-xl`,

                    placeholder: () => `!text-slate-400 !text-sm`,

                    input: () => `dark:!text-white`,

                    singleValue: () => `dark:!text-white`,

                    menuList: () => `dark:!bg-slate-800`,
                  }}
                />
              </div>
            </div>

            {/* ================= SPEED ================= */}
            <div>
              <label
                className="mb-2 block text-xs font-semibold
        text-slate-700 dark:text-slate-300"
              >
                Funding Speed
              </label>

              <input
                name="fundingSpeedDays"
                placeholder="Funding speed in days"
                value={form.fundingSpeedDays}
                onChange={handleChange}
                className={`h-11 w-full rounded-2xl border
        bg-slate-50 dark:bg-slate-800
        px-4 text-sm outline-none transition-all
        focus:border-[#134E4A]
        ${
          errors.fundingSpeedDays
            ? "border-red-500"
            : "border-slate-200 dark:border-slate-700"
        }`}
              />

              {errors.fundingSpeedDays && (
                <p className="mt-1 text-[11px] text-red-500">
                  {errors.fundingSpeedDays}
                </p>
              )}
            </div>

            {/* ================= ACTION ================= */}
            <div
              className="flex items-center justify-between
      border-t border-slate-200 dark:border-slate-800
      pt-5"
            >
              <p
                className="text-[11px]
        text-slate-500"
              >
                Keep your lender profile updated regularly.
              </p>

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="inline-flex items-center
        rounded-2xl bg-[#134E4A]
        px-5 py-2.5 text-xs font-semibold
        text-white transition-all
        hover:bg-[#0f3f3c]
        disabled:opacity-60"
              >
                {loading ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
