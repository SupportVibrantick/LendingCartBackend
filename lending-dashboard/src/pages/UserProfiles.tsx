import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  BookOpen,
  Briefcase,
  Building2,
  Camera,
  CheckCircle2,
  ChevronRight,
  Circle,
  DollarSign,
  ExternalLink,
  FileText,
  Home,
  Layers,
  Loader2,
  MapPin,
  Plus,
  Save,
  Shield,
  Target,
} from "lucide-react";
import toast from "react-hot-toast";
import Select, { MultiValue } from "react-select";
import { Link, useNavigate } from "react-router";
import {
  INDUSTRIES,
  PROFILE_SECTIONS,
  selectClassNames,
  US_STATES,
  type ProfileSectionId,
} from "../lib/lenderProfileConstants";
import { formatCompactAmount } from "../lib/loanPipelineUtils";
import { filterLenderCatalogProducts } from "../lib/lenderLoanProducts";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

type LenderProfileForm = {
  firstName: string;
  lastName: string;
  organizationEmail: string;
  organizationPhone: string;
  summary: string;
  lendingCriteria: string;
  lendingGuidelines: string;
  creditRequirements: string;
  propertyRequirements: string;
  loanTypes: string;
  minFunding: string;
  maxFunding: string;
  statesSupported: string;
  industries: string;
  fundingSpeedDays: string;
  profileImage?: File | null;
};

type LoanProductSummary = {
  id: string;
  code?: string | null;
  name?: string | null;
  minLoanAmount?: number | null;
  maxLoanAmount?: number | null;
  minCreditScore?: number | null;
  isActive?: boolean;
  documents?: { documentName?: string | null }[];
  propertyTypes?: Record<string, string[]>;
};

function getAuthHeaders() {
  const token = sessionStorage.getItem("lender_token");
  return {
    Authorization: `Bearer ${token}`,
  };
}

const DEFAULT_LENDER_IMAGE =
  "https://ui-avatars.com/api/?name=Lender&background=0D8ABC&color=fff&size=256";

const inputClass = (hasError?: boolean) =>
  `h-11 w-full rounded-2xl border bg-slate-50 px-4 text-sm outline-none transition-all focus:border-[#134E4A] dark:bg-slate-800 ${
    hasError
      ? "border-red-500"
      : "border-slate-200 dark:border-slate-700"
  }`;

const textareaClass = (hasError?: boolean) =>
  `w-full rounded-3xl border bg-slate-50 px-4 py-3 text-sm outline-none transition-all focus:border-[#134E4A] dark:bg-slate-800 resize-none ${
    hasError
      ? "border-red-500"
      : "border-slate-200 dark:border-slate-700"
  }`;

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-2 block text-xs font-semibold text-slate-700 dark:text-slate-300">
      {children}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-[11px] text-red-500">{message}</p>;
}

const SECTION_ICONS: Record<ProfileSectionId, LucideIcon> = {
  company: Building2,
  "lending-criteria": Target,
  "lending-guidelines": BookOpen,
  geographic: MapPin,
  "loan-programs": Layers,
  "loan-amounts": DollarSign,
  credit: Shield,
  property: Home,
  industries: Briefcase,
  documents: FileText,
};

function isSectionFilled(
  sectionId: ProfileSectionId,
  form: LenderProfileForm,
  loanProducts: LoanProductSummary[],
) {
  switch (sectionId) {
    case "company":
      return Boolean(
        form.firstName.trim() &&
          form.lastName.trim() &&
          form.summary.trim() &&
          form.fundingSpeedDays,
      );
    case "lending-criteria":
      return Boolean(form.lendingCriteria.trim());
    case "lending-guidelines":
      return Boolean(form.lendingGuidelines.trim());
    case "geographic":
      return Boolean(form.statesSupported.trim());
    case "loan-programs":
      return Boolean(form.loanTypes.trim());
    case "loan-amounts":
      return Boolean(form.minFunding && form.maxFunding);
    case "credit":
      return Boolean(form.creditRequirements.trim());
    case "property":
      return Boolean(form.propertyRequirements.trim());
    case "industries":
      return Boolean(form.industries.trim());
    case "documents":
      return loanProducts.some((product) => (product.documents || []).length > 0);
    default:
      return false;
  }
}

function profileStatusTone(status: string) {
  switch (status) {
    case "COMPLETED":
      return "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30";
    case "INCOMPLETE":
      return "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600";
  }
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-800/40">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        <Icon className="h-5 w-5 text-[#134E4A]" />
      </div>
      <p className="text-sm font-semibold text-slate-900 dark:text-white">
        {title}
      </p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export default function EditLenderProfile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [existingImage, setExistingImage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [profileStatus, setProfileStatus] = useState("DRAFT");
  const [activeSection, setActiveSection] =
    useState<ProfileSectionId>("company");
  const [loanTypeOptions, setLoanTypeOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [loanProducts, setLoanProducts] = useState<LoanProductSummary[]>([]);

  const [form, setForm] = useState<LenderProfileForm>({
    firstName: "",
    lastName: "",
    organizationEmail: "",
    organizationPhone: "",
    summary: "",
    lendingCriteria: "",
    lendingGuidelines: "",
    creditRequirements: "",
    propertyRequirements: "",
    loanTypes: "",
    minFunding: "",
    maxFunding: "",
    statesSupported: "",
    industries: "",
    fundingSpeedDays: "",
    profileImage: null,
  });

  const selectedLoanTypes = useMemo(
    () =>
      loanTypeOptions.filter((option) =>
        form.loanTypes
          .split(",")
          .map((value) => value.trim())
          .includes(option.value),
      ),
    [form.loanTypes, loanTypeOptions],
  );

  const selectedStates = useMemo(
    () =>
      US_STATES.filter((state) =>
        form.statesSupported
          .split(",")
          .map((value) => value.trim())
          .includes(state.value),
      ),
    [form.statesSupported],
  );

  const selectedIndustries = useMemo(
    () =>
      INDUSTRIES.filter((industry) =>
        form.industries
          .split(",")
          .map((value) => value.trim())
          .includes(industry.value),
      ),
    [form.industries],
  );

  const sectionCompletion = useMemo(() => {
    const map = {} as Record<ProfileSectionId, boolean>;
    for (const section of PROFILE_SECTIONS) {
      map[section.id] = isSectionFilled(section.id, form, loanProducts);
    }
    return map;
  }, [form, loanProducts]);

  const completionPercent = useMemo(() => {
    const filled = PROFILE_SECTIONS.filter(
      (section) => sectionCompletion[section.id],
    ).length;
    return Math.round((filled / PROFILE_SECTIONS.length) * 100);
  }, [sectionCompletion]);

  const stateCount = selectedStates.length;
  const programCount = selectedLoanTypes.length;

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!form.firstName.trim()) nextErrors.firstName = "First name is required";
    if (!form.lastName.trim()) nextErrors.lastName = "Last name is required";

    if (!form.summary.trim() || form.summary.length < 10) {
      nextErrors.summary = "Summary must be at least 10 characters";
    }

    if (!form.loanTypes.trim()) {
      nextErrors.loanTypes = "Select at least one loan program";
    }

    if (!form.statesSupported.trim()) {
      nextErrors.statesSupported = "Select at least one state";
    }

    const min = Number(form.minFunding);
    const max = Number(form.maxFunding);

    if (!min || min <= 0) nextErrors.minFunding = "Enter a valid minimum amount";
    if (!max || max <= 0) nextErrors.maxFunding = "Enter a valid maximum amount";
    if (min && max && min > max) {
      nextErrors.maxFunding = "Maximum must be greater than minimum";
    }

    const days = Number(form.fundingSpeedDays);
    if (!days || days < 1 || days > 365) {
      nextErrors.fundingSpeedDays = "Funding speed must be between 1 and 365 days";
    }

    if (form.profileImage) {
      const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
      if (!allowed.includes(form.profileImage.type)) {
        nextErrors.profileImage = "Only JPG, PNG, or WEBP images allowed";
      }
      if (form.profileImage.size > 2 * 1024 * 1024) {
        nextErrors.profileImage = "Image must be under 2MB";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setForm((previous) => ({ ...previous, profileImage: file }));
    setPreviewImage(URL.createObjectURL(file));
  };

  const loadLoanTypes = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/common/loan-products/loan-product-code`,
      );
      const json = await response.json();
      if (!response.ok || !json.success) return;

      setLoanTypeOptions(
        filterLenderCatalogProducts(json.data).map(
          (item: { code: string; name: string }) => ({
            value: item.code,
            label: item.name,
          }),
        ),
      );
    } catch {
      /* ignore */
    }
  };

  const loadLoanProducts = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/lender/loan-products/list?limit=100`,
        { headers: getAuthHeaders() },
      );
      const json = await response.json();
      if (!response.ok || !json.success) return;
      setLoanProducts(json.data || []);
    } catch {
      /* ignore */
    }
  };

  const loadProfile = async () => {
    try {
      const response = await fetch(`${API_BASE}/lender/auth/me`, {
        headers: getAuthHeaders(),
      });
      const json = await response.json();

      if (!response.ok || json.ok !== true) {
        throw new Error("Failed to load profile");
      }

      const { user, lenderProfile, organization } = json.data;

      setOrgName(organization?.name || "Lender");
      setExistingImage(user.profileImage || null);
      setProfileStatus(lenderProfile?.profileStatus || "DRAFT");

      setForm((previous) => ({
        ...previous,
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        organizationEmail: organization?.email || "",
        organizationPhone: organization?.phone || "",
        summary: lenderProfile?.summary || "",
        lendingCriteria: lenderProfile?.lendingCriteria || "",
        lendingGuidelines: lenderProfile?.lendingGuidelines || "",
        creditRequirements: lenderProfile?.creditRequirements || "",
        propertyRequirements: lenderProfile?.propertyRequirements || "",
        loanTypes: (lenderProfile?.loanTypes || []).join(", "),
        minFunding: lenderProfile?.minFunding
          ? String(lenderProfile.minFunding)
          : "",
        maxFunding: lenderProfile?.maxFunding
          ? String(lenderProfile.maxFunding)
          : "",
        statesSupported: lenderProfile?.statesSupported || "",
        industries: lenderProfile?.industries || "",
        fundingSpeedDays: lenderProfile?.fundingSpeedDays
          ? String(lenderProfile.fundingSpeedDays)
          : "",
        profileImage: null,
      }));
    } catch (error: any) {
      toast.error(error.message || "Unable to load profile");
    }
  };

  const handleSubmit = async () => {
    if (!validate()) {
      toast.error("Please fix the highlighted fields before saving.");
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();

      formData.append("firstName", form.firstName);
      formData.append("lastName", form.lastName);
      formData.append("organizationEmail", form.organizationEmail);
      formData.append("organizationPhone", form.organizationPhone);
      formData.append("summary", form.summary);
      formData.append("lendingCriteria", form.lendingCriteria);
      formData.append("lendingGuidelines", form.lendingGuidelines);
      formData.append("creditRequirements", form.creditRequirements);
      formData.append("propertyRequirements", form.propertyRequirements);

      const loanTypesArray = form.loanTypes
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      formData.append("loanTypes", JSON.stringify(loanTypesArray));
      formData.append("minFunding", form.minFunding);
      formData.append("maxFunding", form.maxFunding);
      formData.append("statesSupported", form.statesSupported);
      formData.append("industries", form.industries);
      formData.append("fundingSpeedDays", form.fundingSpeedDays);

      if (form.profileImage) {
        formData.append("profileImage", form.profileImage);
      }

      const response = await fetch(`${API_BASE}/lender/auth/profile`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: formData,
      });

      const json = await response.json();
      if (!response.ok || json.success !== true) {
        throw new Error(json.message || "Update failed");
      }

      toast.success("Profile saved successfully");
      await loadProfile();
      await loadLoanProducts();
    } catch (error: any) {
      toast.error(error.message || "Update failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
    loadLoanTypes();
    loadLoanProducts();
  }, []);

  useEffect(() => {
    return () => {
      if (previewImage) URL.revokeObjectURL(previewImage);
    };
  }, [previewImage]);

  const activeMeta = PROFILE_SECTIONS.find(
    (section) => section.id === activeSection,
  );

  const renderSectionContent = () => {
    switch (activeSection) {
      case "company":
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <FieldLabel>First Name</FieldLabel>
                <input
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  className={inputClass(Boolean(errors.firstName))}
                />
                <FieldError message={errors.firstName} />
              </div>
              <div>
                <FieldLabel>Last Name</FieldLabel>
                <input
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  className={inputClass(Boolean(errors.lastName))}
                />
                <FieldError message={errors.lastName} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <FieldLabel>Company Email</FieldLabel>
                <input
                  name="organizationEmail"
                  type="email"
                  value={form.organizationEmail}
                  onChange={handleChange}
                  className={inputClass()}
                  placeholder="contact@lender.com"
                />
              </div>
              <div>
                <FieldLabel>Company Phone</FieldLabel>
                <input
                  name="organizationPhone"
                  value={form.organizationPhone}
                  onChange={handleChange}
                  className={inputClass()}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>
            <div>
              <FieldLabel>Business Summary</FieldLabel>
              <textarea
                name="summary"
                rows={4}
                value={form.summary}
                onChange={handleChange}
                placeholder="Describe your lending company, focus, and value proposition..."
                className={textareaClass(Boolean(errors.summary))}
              />
              <FieldError message={errors.summary} />
            </div>
            <div>
              <FieldLabel>Typical Funding Speed (days)</FieldLabel>
              <input
                name="fundingSpeedDays"
                type="number"
                min={1}
                max={365}
                value={form.fundingSpeedDays}
                onChange={handleChange}
                className={inputClass(Boolean(errors.fundingSpeedDays))}
              />
              <FieldError message={errors.fundingSpeedDays} />
            </div>
          </div>
        );

      case "lending-criteria":
        return (
          <div className="space-y-4">
            <textarea
              name="lendingCriteria"
              rows={8}
              value={form.lendingCriteria}
              onChange={handleChange}
              placeholder="Example: 1-4 unit investment properties, experienced sponsors, minimum 680 FICO, max 75% LTV..."
              className={textareaClass()}
            />
          </div>
        );

      case "lending-guidelines":
        return (
          <div className="space-y-4">
            <textarea
              name="lendingGuidelines"
              rows={8}
              value={form.lendingGuidelines}
              onChange={handleChange}
              placeholder="Example: Full appraisal required above $1M, liquidity equal to 6 months reserves, no cannabis-related collateral..."
              className={textareaClass()}
            />
          </div>
        );

      case "geographic":
        return (
          <div className="space-y-4">
            <Select
              isMulti
              options={US_STATES}
              placeholder="Select supported states"
              value={selectedStates}
              onChange={(
                selected: MultiValue<{ value: string; label: string }>,
              ) => {
                setForm((previous) => ({
                  ...previous,
                  statesSupported: selected
                    .map((option) => option.value)
                    .join(", "),
                }));
              }}
              className="text-sm"
              classNames={selectClassNames(Boolean(errors.statesSupported))}
            />
            <FieldError message={errors.statesSupported} />
            {stateCount > 0 && (
              <p className="text-xs text-slate-500">
                {stateCount} state{stateCount === 1 ? "" : "s"} selected
              </p>
            )}
          </div>
        );

      case "loan-programs":
        return (
          <div className="space-y-5">
            <Select
              isMulti
              options={loanTypeOptions}
              placeholder="Select loan programs"
              value={selectedLoanTypes}
              onChange={(
                selected: MultiValue<{ value: string; label: string }>,
              ) => {
                setForm((previous) => ({
                  ...previous,
                  loanTypes: selected.map((option) => option.value).join(", "),
                }));
              }}
              className="text-sm"
              classNames={selectClassNames(Boolean(errors.loanTypes))}
            />
            <FieldError message={errors.loanTypes} />

            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Configured Programs
                </p>
                <Link
                  to="/add-loan-product"
                  className="inline-flex items-center gap-1 rounded-xl bg-[#134E4A] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#0f3f3c]"
                >
                  <Plus size={14} />
                  Add program
                </Link>
              </div>
              {loanProducts.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={Layers}
                    title="No programs configured"
                    description="Add a loan program to define criteria, documents, and property rules."
                    action={
                      <Link
                        to="/add-loan-product"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#134E4A] px-4 py-2 text-sm font-semibold text-white"
                      >
                        <Plus size={16} />
                        Add loan program
                      </Link>
                    }
                  />
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loanProducts.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                          {product.name || product.code}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              product.isActive
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {product.isActive ? "Active" : "Inactive"}
                          </span>
                          {product.minCreditScore ? (
                            <span className="text-xs text-slate-500">
                              Min FICO {product.minCreditScore}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          navigate("/update-loan-product", {
                            state: { loanProduct: product },
                          })
                        }
                        className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#134E4A] transition hover:bg-[#134E4A]/5 dark:border-slate-700"
                      >
                        Configure
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case "loan-amounts":
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <FieldLabel>Minimum Loan Amount</FieldLabel>
                <input
                  type="number"
                  name="minFunding"
                  min={0}
                  value={form.minFunding}
                  onChange={handleChange}
                  placeholder="50000"
                  className={inputClass(Boolean(errors.minFunding))}
                />
                <FieldError message={errors.minFunding} />
              </div>
              <div>
                <FieldLabel>Maximum Loan Amount</FieldLabel>
                <input
                  type="number"
                  name="maxFunding"
                  min={0}
                  value={form.maxFunding}
                  onChange={handleChange}
                  placeholder="5000000"
                  className={inputClass(Boolean(errors.maxFunding))}
                />
                <FieldError message={errors.maxFunding} />
              </div>
            </div>
            {form.minFunding && form.maxFunding && (
              <div className="rounded-2xl border border-[#134E4A]/15 bg-[#134E4A]/5 px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                Lending range:{" "}
                <span className="font-semibold text-[#134E4A]">
                  {formatCompactAmount(Number(form.minFunding))} –{" "}
                  {formatCompactAmount(Number(form.maxFunding))}
                </span>
              </div>
            )}
          </div>
        );

      case "credit":
        return (
          <div className="space-y-4">
            <textarea
              name="creditRequirements"
              rows={8}
              value={form.creditRequirements}
              onChange={handleChange}
              placeholder="Example: Minimum 680 FICO, 2+ completed projects for fix-and-flip, no active bankruptcies..."
              className={textareaClass()}
            />
            {loanProducts.some((product) => product.minCreditScore) && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Program-level minimums
                </p>
                <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
                  {loanProducts
                    .filter((product) => product.minCreditScore)
                    .map((product) => (
                      <li key={product.id}>
                        {product.name || product.code}: FICO{" "}
                        {product.minCreditScore}+
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        );

      case "property":
        return (
          <div className="space-y-4">
            <textarea
              name="propertyRequirements"
              rows={8}
              value={form.propertyRequirements}
              onChange={handleChange}
              placeholder="Example: 1-4 residential, non-owner occupied, no environmental contamination, minimum 1,200 sq ft..."
              className={textareaClass()}
            />
            {loanProducts.some(
              (product) =>
                product.propertyTypes &&
                Object.keys(product.propertyTypes).length > 0,
            ) && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Program property selections
                </p>
                <ul className="mt-2 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                  {loanProducts.map((product) => {
                    const groups = product.propertyTypes || {};
                    const labels = Object.keys(groups);
                    if (labels.length === 0) return null;
                    return (
                      <li key={product.id}>
                        <span className="font-medium">
                          {product.name || product.code}:
                        </span>{" "}
                        {labels.join(", ")}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        );

      case "industries":
        return (
          <div className="space-y-4">
            <Select
              isMulti
              options={INDUSTRIES}
              placeholder="Select supported industries"
              value={selectedIndustries}
              onChange={(
                selected: MultiValue<{ value: string; label: string }>,
              ) => {
                setForm((previous) => ({
                  ...previous,
                  industries: selected.map((option) => option.value).join(", "),
                }));
              }}
              className="text-sm"
              classNames={selectClassNames()}
            />
            {selectedIndustries.length > 0 && (
              <p className="text-xs text-slate-500">
                {selectedIndustries.length} industr
                {selectedIndustries.length === 1 ? "y" : "ies"} selected
              </p>
            )}
          </div>
        );

      case "documents":
        return (
          <div className="space-y-4">
            {loanProducts.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No loan programs yet"
                description="Create a loan program first, then configure required documents for each one."
                action={
                  <Link
                    to="/add-loan-product"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#134E4A] px-4 py-2 text-sm font-semibold text-white"
                  >
                    <Plus size={16} />
                    Add loan program
                  </Link>
                }
              />
            ) : (
              <div className="space-y-3">
                {loanProducts.map((product) => {
                  const docCount = (product.documents || []).length;
                  return (
                    <div
                      key={product.id}
                      className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700"
                    >
                      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/40">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {product.name || product.code}
                          </p>
                          <p className="text-xs text-slate-500">
                            {docCount} required document
                            {docCount === 1 ? "" : "s"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            navigate("/update-loan-product", {
                              state: { loanProduct: product },
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-xl bg-[#134E4A] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#0f3f3c]"
                        >
                          Manage
                          <ExternalLink size={12} />
                        </button>
                      </div>
                      <div className="p-4">
                        {docCount > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {(product.documents || []).map((document, index) => (
                              <span
                                key={`${product.id}-${index}`}
                                className="inline-flex items-center gap-1.5 rounded-full bg-[#134E4A]/8 px-3 py-1 text-xs font-medium text-[#134E4A] dark:bg-[#134E4A]/20 dark:text-teal-200"
                              >
                                <FileText size={12} />
                                {document.documentName || "Document"}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 py-6 text-center dark:border-slate-700">
                            <FileText className="mb-2 h-5 w-5 text-slate-400" />
                            <p className="text-sm text-slate-500">
                              No documents configured yet
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                navigate("/update-loan-product", {
                                  state: { loanProduct: product },
                                })
                              }
                              className="mt-3 text-xs font-semibold text-[#134E4A] hover:underline"
                            >
                              Add documents for this program
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const ActiveIcon = activeMeta
    ? SECTION_ICONS[activeMeta.id]
    : Building2;
  const isReadOnlySection = activeSection === "documents";

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900 dark:bg-slate-900 dark:text-slate-100 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="relative bg-gradient-to-r from-[#134E4A] to-[#0f766e] px-6 pb-16 pt-5">
            <div className="mb-4">
              <Link
                to="/profile"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-100/90 hover:text-white"
              >
                <ArrowLeft size={14} />
                Back to profile
              </Link>
            </div>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-teal-100/80">
                  Lending Guidelines
                </p>
                <h1 className="mt-1 text-xl font-semibold text-white">
                  {orgName}
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ring-1 ${profileStatusTone(profileStatus)}`}
                >
                  {profileStatus.replace("_", " ")}
                </span>
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase text-white ring-1 ring-white/20">
                  {completionPercent}% complete
                </span>
              </div>
            </div>
          </div>

          <div className="relative px-6 pb-5">
            <div className="-mt-12 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex items-end gap-4">
                <div className="relative shrink-0">
                  <div className="h-[72px] w-[72px] overflow-hidden rounded-2xl border-4 border-white bg-slate-100 shadow-md ring-1 ring-slate-200 dark:border-slate-900 dark:ring-slate-700">
                    <img
                      src={
                        previewImage
                          ? previewImage
                          : existingImage
                            ? `${API_BASE}${existingImage.startsWith("/") ? existingImage : `/${existingImage}`}`
                            : DEFAULT_LENDER_IMAGE
                      }
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <label className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border-2 border-white bg-[#134E4A] text-white shadow-md transition hover:bg-[#0f3f3c] dark:border-slate-900">
                    <Camera size={14} />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
                <div className="min-w-0 pb-1">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Manage what brokers see when discovering your lending
                    programs
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                    {programCount > 0 && (
                      <span className="rounded-lg bg-slate-100 px-2 py-1 dark:bg-slate-800">
                        {programCount} program{programCount === 1 ? "" : "s"}
                      </span>
                    )}
                    {stateCount > 0 && (
                      <span className="rounded-lg bg-slate-100 px-2 py-1 dark:bg-slate-800">
                        {stateCount} state{stateCount === 1 ? "" : "s"}
                      </span>
                    )}
                    {form.minFunding && form.maxFunding && (
                      <span className="rounded-lg bg-slate-100 px-2 py-1 dark:bg-slate-800">
                        {formatCompactAmount(Number(form.minFunding))} –{" "}
                        {formatCompactAmount(Number(form.maxFunding))}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <FieldError message={errors.profileImage} />

            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
                <span>Profile completion</span>
                <span>{completionPercent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#134E4A] to-[#14b8a6] transition-all duration-500"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          {/* Sidebar */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Sections
                </p>
              </div>
              <nav className="p-2">
                {PROFILE_SECTIONS.map((section) => {
                  const active = activeSection === section.id;
                  const Icon = SECTION_ICONS[section.id];
                  const complete = sectionCompletion[section.id];

                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setActiveSection(section.id)}
                      className={`mb-0.5 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition ${
                        active
                          ? "bg-[#134E4A] text-white shadow-sm"
                          : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                          active
                            ? "bg-white/15"
                            : "bg-slate-100 dark:bg-slate-800"
                        }`}
                      >
                        <Icon size={15} />
                      </span>
                      <span className="min-w-0 flex-1 font-medium leading-tight">
                        {section.label}
                      </span>
                      {complete ? (
                        <CheckCircle2
                          size={15}
                          className={
                            active
                              ? "shrink-0 text-emerald-200"
                              : "shrink-0 text-emerald-500"
                          }
                        />
                      ) : (
                        <Circle
                          size={14}
                          className={
                            active
                              ? "shrink-0 text-white/40"
                              : "shrink-0 text-slate-300 dark:text-slate-600"
                          }
                        />
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-3 border-b border-slate-100 px-6 py-5 dark:border-slate-800">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#134E4A]/10 text-[#134E4A]">
                <ActiveIcon size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  {activeMeta?.label}
                </h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  {activeMeta?.description}
                </p>
              </div>
            </div>

            <div className="p-6">{renderSectionContent()}</div>

            <div className="sticky bottom-0 border-t border-slate-100 bg-white/95 px-6 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  {isReadOnlySection
                    ? "Documents are managed per program in Loan Products."
                    : "Changes apply across all profile sections when you save."}
                </p>
                {!isReadOnlySection && (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#134E4A] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f3f3c] disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Save Profile
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
