import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Save,
} from "lucide-react";
import toast from "react-hot-toast";
import ProfileCompanyStep, {
  type CompanyForm,
} from "./ProfileCompanyStep";
import StepTwo from "../LoanProducts/LoanCriteria/StepTwo";
import StepThree from "../LoanProducts/LoanCriteria/StepThree";
import StepFour from "../LoanProducts/LoanCriteria/StepFour";
import StepFive from "../LoanProducts/LoanCriteria/StepFive";
import EquipmentFinancingStep from "../LoanProducts/LoanCriteria/EquipmentFinancingStep";
import {
  getRequiredCriteriaKeysForProduct,
  isMezzanineProduct,
  isNoMinLoanCriteriaProduct,
  isSba504Product,
  mapApiProductToCriteriaForm,
} from "../../lib/loanProductCriteriaFields";
import {
  mapToLenderProductUpdatePayload,
  mergeGroupedSelections,
  normalizeGroupedSelectionFromApi,
} from "../../lib/lenderProductLenderPayload";
import { API_BASE, getLenderAuthHeaders } from "../../lib/lenderApi";
import {
  buildLoanCriteriaFromLenderProducts,
  filterLenderCatalogProducts,
  mapToCanonicalCatalogId,
  resolveLenderOfferedProductCode,
} from "../../lib/lenderLoanProducts";
import {
  formatUSPhone,
  formatUSZip,
  isValidUSPhone,
  isValidUSState,
  isValidUSZip,
  normalizeUSState,
} from "../../lib/usAddressFormat";

type Product = {
  id: string;
  name: string;
  code: string;
};

type ExistingLenderProduct = {
  id: string;
  loanProductId?: string | null;
  code?: string | null;
  documents?: any[];
  equipmentTypes?: string[];
  propertyTypes?: Record<string, string[]>;
  businessTypes?: Record<string, string[]>;
};

type WizardForm = {
  loanPrograms: string[];
  propertyTypes: Record<string, string[]>;
  businessTypes: Record<string, string[]>;
  loanCriteria: Record<string, any>;
  equipmentFinance: string[];
};

const EMPTY_COMPANY: CompanyForm = {
  companyName: "",
  lenderType: "",
  firstName: "",
  lastName: "",
  organizationEmail: "",
  organizationPhone: "",
  website: "",
  nmls: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  summary: "",
  fundingSpeedDays: "",
};

export default function EditFullProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [hasStep5Errors, setHasStep5Errors] = useState(false);
  const [companyErrors, setCompanyErrors] = useState<Record<string, string>>(
    {},
  );
  const [company, setCompany] = useState<CompanyForm>(EMPTY_COMPANY);
  const [products, setProducts] = useState<Product[]>([]);
  const [existingProducts, setExistingProducts] = useState<
    ExistingLenderProduct[]
  >([]);
  const [form, setForm] = useState<WizardForm>({
    loanPrograms: [],
    propertyTypes: {},
    businessTypes: {},
    loanCriteria: {},
    equipmentFinance: [],
  });

  const selectedProducts = useMemo(
    () => products.filter((product) => form.loanPrograms.includes(product.id)),
    [products, form.loanPrograms],
  );

  const isEquipmentSelected = selectedProducts.some(
    (product) => product.code === "EQUIPMENT_FINANCE",
  );

  const steps = [
    "Company Info",
    "Loan Programs",
    "Property Types",
    "Business Types",
    ...(isEquipmentSelected ? ["Equipment Types"] : []),
    "Loan Criteria",
  ];

  const loanCriteriaStepIndex = steps.length - 1;
  const isLastStep = step === loanCriteriaStepIndex;

  const validateCompany = () => {
    const nextErrors: Record<string, string> = {};

    if (!company.companyName.trim()) {
      nextErrors.companyName = "Company name is required";
    }
    if (!company.firstName.trim()) {
      nextErrors.firstName = "First name is required";
    }
    if (!company.lastName.trim()) {
      nextErrors.lastName = "Last name is required";
    }
    if (!company.organizationEmail.trim()) {
      nextErrors.organizationEmail = "Contact email is required";
    }

    if (
      company.organizationPhone.trim() &&
      !isValidUSPhone(company.organizationPhone)
    ) {
      nextErrors.organizationPhone =
        "Enter a valid US phone number (999-999-9999)";
    }

    if (company.zip.trim() && !isValidUSZip(company.zip)) {
      nextErrors.zip = "Enter a valid US ZIP (12345 or 12345-6789)";
    }

    if (company.state.trim() && !isValidUSState(company.state)) {
      nextErrors.state = "Select a valid US state";
    }

    setCompanyErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validateStep5 = () => {
    for (const product of selectedProducts) {
      const data = form.loanCriteria?.[product.id];

      if (!data) {
        return `Please fill details for ${product.name}`;
      }

      const requiredFields = getRequiredCriteriaKeysForProduct(product.code);

      for (const field of requiredFields) {
        if (!data[field] && data[field] !== 0) {
          return `${product.name}: ${field} is required`;
        }
      }

      if (!data.states || data.states.length === 0) {
        return `${product.name}: Select at least one state`;
      }

      if (isSba504Product(product.code)) {
        const total = Number(data.maxTotalProject);
        const debenture = Number(data.maxSba504Debenture);
        if (
          data.maxTotalProject &&
          data.maxSba504Debenture &&
          debenture > total
        ) {
          return `${product.name}: SBA 504 debenture cannot exceed total project amount`;
        }
      } else if (
        !isNoMinLoanCriteriaProduct(product.code) &&
        !isMezzanineProduct(product.code)
      ) {
        const minAmount = Number(
          data.minFacilitySize ?? data.minProgramSize ?? data.minLoan,
        );
        const maxAmount = Number(
          data.maxFacilitySize ?? data.maxProgramSize ?? data.maxLoan,
        );

        if (
          Number.isFinite(minAmount) &&
          Number.isFinite(maxAmount) &&
          minAmount > maxAmount
        ) {
          return `${product.name}: Minimum amount cannot exceed maximum amount`;
        }
      }
    }

    return null;
  };

  const hydrateFromExisting = (
    lenderProducts: ExistingLenderProduct[],
    catalogProducts: Product[],
  ) => {
    const activeProducts = lenderProducts.filter(
      (product) => product !== null,
    );

    if (!activeProducts.length) {
      return;
    }

    const loanProgramIds = [
      ...new Set(
        activeProducts
          .map((product) =>
            mapToCanonicalCatalogId(
              catalogProducts,
              product.code,
              product.loanProductId,
            ),
          )
          .filter((id): id is string => Boolean(id))
          .map(String),
      ),
    ];

    const loanCriteria = buildLoanCriteriaFromLenderProducts(
      activeProducts,
      catalogProducts,
      mapApiProductToCriteriaForm,
    );
    let propertyTypes: Record<string, string[]> = {};
    let businessTypes: Record<string, string[]> = {};
    let equipmentFinance: string[] = [];

    for (const lenderProduct of activeProducts) {
      const canonicalId = mapToCanonicalCatalogId(
        catalogProducts,
        lenderProduct.code,
        lenderProduct.loanProductId,
      );
      if (!canonicalId) continue;

      propertyTypes = mergeGroupedSelections(
        propertyTypes,
        normalizeGroupedSelectionFromApi(lenderProduct.propertyTypes, "type"),
      );

      businessTypes = mergeGroupedSelections(
        businessTypes,
        normalizeGroupedSelectionFromApi(lenderProduct.businessTypes, "name"),
      );

      const canonicalCode = resolveLenderOfferedProductCode(
        lenderProduct.code || "",
      );

      if (canonicalCode === "EQUIPMENT_FINANCE") {
        equipmentFinance = Array.isArray(lenderProduct.equipmentTypes)
          ? lenderProduct.equipmentTypes
          : [];
      }
    }

    setForm({
      loanPrograms: loanProgramIds,
      propertyTypes,
      businessTypes,
      loanCriteria,
      equipmentFinance,
    });
  };

  const resolveExistingProduct = (catalogProduct: Product) =>
    existingProducts.find((product) => {
      const canonicalId = mapToCanonicalCatalogId(
        products,
        product.code,
        product.loanProductId,
      );

      return (
        canonicalId === catalogProduct.id ||
        product.loanProductId === catalogProduct.id ||
        product.code === catalogProduct.code ||
        resolveLenderOfferedProductCode(product.code || "") ===
          catalogProduct.code
      );
    });

  const loadProfileData = useCallback(async () => {
    const [profileRes, lenderProductsRes, catalogRes] = await Promise.all([
      fetch(`${API_BASE}/lender/auth/me`, {
        headers: getLenderAuthHeaders(),
      }),
      fetch(`${API_BASE}/lender/loan-products/list?limit=100`, {
        headers: getLenderAuthHeaders(),
      }),
      fetch(`${API_BASE}/common/loan-products/loan-product-code`),
    ]);

    const profileJson = await profileRes.json();
    const lenderProductsJson = await lenderProductsRes.json();
    const catalogJson = await catalogRes.json();

    if (!profileRes.ok || profileJson.ok !== true) {
      throw new Error("Failed to load profile");
    }

    const { user, lenderProfile, organization } = profileJson.data;
    const catalogProducts: Product[] = filterLenderCatalogProducts(
      (catalogJson.data || []).map(
        (item: { id: string; code: string; name: string }) => ({
          id: String(item.id),
          code: item.code,
          name: item.name,
        }),
      ),
    );

    setProducts(catalogProducts);
    setCompany({
      companyName: organization?.name || "",
      lenderType: lenderProfile?.lenderType || "",
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      organizationEmail: organization?.email || user.email || "",
      organizationPhone: formatUSPhone(organization?.phone || ""),
      website: lenderProfile?.website || "",
      nmls: lenderProfile?.nmls || "",
      address: lenderProfile?.address || "",
      city: lenderProfile?.city || "",
      state: normalizeUSState(lenderProfile?.state || ""),
      zip: formatUSZip(lenderProfile?.zip || ""),
      summary: lenderProfile?.summary || "",
      fundingSpeedDays: lenderProfile?.fundingSpeedDays
        ? String(lenderProfile.fundingSpeedDays)
        : "",
    });

    const lenderProducts: ExistingLenderProduct[] =
      lenderProductsRes.ok && lenderProductsJson.success
        ? (lenderProductsJson.data || []).map((product: any) => ({
            ...product,
            loanProductId:
              product.loanProductId || product.loanProduct?.id || null,
            code: product.code || product.loanProduct?.code || null,
          }))
        : [];

    setExistingProducts(lenderProducts);
    hydrateFromExisting(lenderProducts, catalogProducts);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        await loadProfileData();
      } catch (error: any) {
        toast.error(error.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [loadProfileData, location.key]);

  useEffect(() => {
    if (!products.length || !form.loanPrograms.length) return;

    setForm((prev) => {
      let changed = false;
      const nextCriteria = { ...prev.loanCriteria };

      form.loanPrograms.forEach((programId) => {
        if (nextCriteria[programId]) return;

        nextCriteria[programId] = {
          states: [],
          documents: [],
        };
        changed = true;
      });

      if (!changed) return prev;

      return {
        ...prev,
        loanCriteria: nextCriteria,
      };
    });
  }, [form.loanPrograms, products]);

  const saveCompanyProfile = async (
    showToast = true,
    markComplete = false,
  ) => {
    if (!validateCompany()) {
      if (showToast) {
        toast.error("Please fix company information before saving.");
      }
      return false;
    }

    setSavingProfile(true);

    try {
      const formData = new FormData();
      formData.append("companyName", company.companyName.trim());
      formData.append("firstName", company.firstName);
      formData.append("lastName", company.lastName);
      formData.append("organizationEmail", company.organizationEmail);
      formData.append("organizationPhone", company.organizationPhone);
      formData.append("summary", company.summary);
      formData.append("website", company.website);
      formData.append("nmls", company.nmls);
      formData.append("address", company.address);
      formData.append("city", company.city);
      formData.append("state", company.state);
      formData.append("zip", company.zip);
      formData.append("lenderType", company.lenderType);

      if (company.fundingSpeedDays) {
        formData.append("fundingSpeedDays", company.fundingSpeedDays);
      }

      const selectedCodes = selectedProducts.map((product) => product.code);
      if (selectedCodes.length) {
        formData.append("loanTypes", JSON.stringify(selectedCodes));
      }

      const minValues = selectedProducts
        .map((product) => Number(form.loanCriteria?.[product.id]?.minLoan))
        .filter((value) => Number.isFinite(value) && value > 0);
      const maxValues = selectedProducts
        .map((product) => Number(form.loanCriteria?.[product.id]?.maxLoan))
        .filter((value) => Number.isFinite(value) && value > 0);

      if (minValues.length) {
        formData.append("minFunding", String(Math.min(...minValues)));
      }
      if (maxValues.length) {
        formData.append("maxFunding", String(Math.max(...maxValues)));
      }

      const allStates = new Set<string>();
      for (const product of selectedProducts) {
        const states = form.loanCriteria?.[product.id]?.states || [];
        for (const state of states) {
          allStates.add(state);
        }
      }
      if (allStates.size) {
        formData.append("statesSupported", Array.from(allStates).join(", "));
      }

      if (markComplete) {
        formData.append("markProfileComplete", "true");
      }

      const response = await fetch(`${API_BASE}/lender/auth/profile`, {
        method: "PUT",
        headers: getLenderAuthHeaders(),
        body: formData,
      });

      const json = await response.json();
      if (!response.ok || json.success !== true) {
        throw new Error(json.message || "Profile update failed");
      }

      if (showToast) {
        toast.success("Profile saved");
      }

      await loadProfileData();
      return true;
    } catch (error: any) {
      toast.error(error.message || "Failed to save profile");
      return false;
    } finally {
      setSavingProfile(false);
    }
  };

  const syncDocuments = async (
    lenderProductId: string,
    selectedDocuments: any[],
    existingDocuments: any[] = [],
  ) => {
    for (const existingDoc of existingDocuments) {
      const stillSelected = selectedDocuments.some(
        (document) =>
          document.id === existingDoc.documentTypeId ||
          document.documentTypeId === existingDoc.documentTypeId,
      );

      if (!stillSelected && existingDoc.id) {
        await fetch(
          `${API_BASE}/lender/document-config/delete/${existingDoc.id}`,
          {
            method: "DELETE",
            headers: getLenderAuthHeaders(),
          },
        );
      }
    }

    for (const document of selectedDocuments) {
      const existingDoc = existingDocuments.find(
        (entry) =>
          entry.documentTypeId === document.id ||
          entry.documentTypeId === document.documentTypeId,
      );

      const payload = {
        lenderProductId,
        documentTypeId: document.documentTypeId || document.id,
      };

      if (existingDoc?.id) {
        await fetch(
          `${API_BASE}/lender/document-config/update/${existingDoc.id}`,
          {
            method: "PUT",
            headers: getLenderAuthHeaders(true),
            body: JSON.stringify(payload),
          },
        );
      } else {
        await fetch(`${API_BASE}/lender/document-config/create`, {
          method: "POST",
          headers: getLenderAuthHeaders(true),
          body: JSON.stringify(payload),
        });
      }
    }
  };

  const handleSubmit = async () => {
    const step5Error = validateStep5();
    if (step5Error) {
      toast.error(step5Error);
      return;
    }

    if (!selectedProducts.length) {
      toast.error("Select at least one loan program");
      return;
    }

    if (!validateCompany()) {
      toast.error("Please complete company information");
      setStep(0);
      return;
    }

    setSubmitting(true);

    try {
      const profileSaved = await saveCompanyProfile(false);
      if (!profileSaved) {
        return;
      }

      for (const product of selectedProducts) {
        const criteria = form.loanCriteria?.[product.id] || {};
        const existing = resolveExistingProduct(product);

        const payload = mapToLenderProductUpdatePayload(product, form, criteria);

        if (existing?.id) {
          const response = await fetch(
            `${API_BASE}/lender/loan-products/update/${existing.id}`,
            {
              method: "PUT",
              headers: getLenderAuthHeaders(true),
              body: JSON.stringify(payload),
            },
          );
          const json = await response.json();
          if (!response.ok) {
            throw new Error(
              json?.message || `Failed to update ${product.name}`,
            );
          }

          await syncDocuments(
            existing.id,
            criteria.documents || [],
            existing.documents || [],
          );
        } else {
          const response = await fetch(
            `${API_BASE}/lender/loan-products/create`,
            {
              method: "POST",
              headers: getLenderAuthHeaders(true),
              body: JSON.stringify({
                products: [payload],
              }),
            },
          );
          const json = await response.json();
          if (!response.ok) {
            throw new Error(
              json?.message || `Failed to create ${product.name}`,
            );
          }

          const lenderProductId = json?.data?.[0]?.id;
          if (lenderProductId) {
            await syncDocuments(
              lenderProductId,
              criteria.documents || [],
            );
          }
        }
      }

      for (const existing of existingProducts) {
        const canonicalId = mapToCanonicalCatalogId(
          products,
          existing.code,
          existing.loanProductId,
        );

        if (
          canonicalId &&
          !form.loanPrograms.includes(canonicalId) &&
          existing.id
        ) {
          await fetch(
            `${API_BASE}/lender/loan-products/update/${existing.id}`,
            {
              method: "PUT",
              headers: getLenderAuthHeaders(true),
              body: JSON.stringify({ isActive: false }),
            },
          );
        }
      }

      const markedComplete = await saveCompanyProfile(false, true);
      if (!markedComplete) {
        throw new Error("Failed to mark profile as complete");
      }

      toast.success("Lender profile saved successfully");
      navigate("/profile");
    } catch (error: any) {
      toast.error(error.message || "Failed to save lender profile");
    } finally {
      setSubmitting(false);
    }
  };

  const getStepContent = () => {
    if (step === 0) {
      return (
        <ProfileCompanyStep
          form={company}
          setForm={setCompany}
          errors={companyErrors}
        />
      );
    }

    const loanProgramsIndex = 1;
    const propertyIndex = 2;
    const businessIndex = 3;
    const equipmentIndex = isEquipmentSelected ? 4 : -1;

    if (step === loanProgramsIndex) {
      return (
        <StepTwo
          mode="lender"
          value={form.loanPrograms}
          setValue={(value) =>
            setForm((previous) => ({ ...previous, loanPrograms: value }))
          }
          onProductsLoad={setProducts}
        />
      );
    }

    if (step === propertyIndex) {
      return (
        <StepThree
          value={form.propertyTypes}
          setValue={(value: Record<string, string[]>) =>
            setForm((previous) => ({ ...previous, propertyTypes: value }))
          }
        />
      );
    }

    if (step === businessIndex) {
      return (
        <StepFour
          value={form.businessTypes}
          setValue={(value: Record<string, string[]>) =>
            setForm((previous) => ({ ...previous, businessTypes: value }))
          }
        />
      );
    }

    if (isEquipmentSelected && step === equipmentIndex) {
      return (
        <EquipmentFinancingStep
          value={form.equipmentFinance}
          setValue={(value: string[]) =>
            setForm((previous) => ({ ...previous, equipmentFinance: value }))
          }
        />
      );
    }

    if (step === loanCriteriaStepIndex) {
      return (
        <StepFive
          mode="update"
          products={selectedProducts}
          value={form.loanCriteria}
          setValue={(value: Record<string, any>) =>
            setForm((previous) => ({ ...previous, loanCriteria: value }))
          }
          setHasErrors={setHasStep5Errors}
        />
      );
    }

    return null;
  };

  const step5ValidationMessage =
    step === loanCriteriaStepIndex ? validateStep5() : null;

  const goNext = () => {
    if (step === 0 && !validateCompany()) {
      toast.error("Please complete required company fields");
      return;
    }

    if (step === 1 && form.loanPrograms.length === 0) {
      toast.error("Select at least one loan program");
      return;
    }

    setStep((previous) => previous + 1);
  };

  const nextDisabled =
    submitting ||
    savingProfile ||
    (step === 1 && form.loanPrograms.length === 0) ||
    (step === loanCriteriaStepIndex && hasStep5Errors) ||
    (isLastStep && step5ValidationMessage !== null);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#134E4A]" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <div className="sticky top-0 z-30 bg-gray-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/profile")}
              className="flex h-9 w-9 items-center justify-center rounded-full border transition hover:bg-gray-100"
            >
              <ArrowLeft size={18} />
            </button>

            <div>
              <h1 className="text-lg font-semibold leading-tight">
                Edit — {company.companyName || "Lender Profile"}
              </h1>
              <p className="text-xs text-gray-500">
                Step {step + 1} of {steps.length} · {steps[step]}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => saveCompanyProfile()}
            disabled={savingProfile || submitting}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-slate-50 disabled:opacity-50"
          >
            {savingProfile ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            Save Profile
          </button>
        </div>

        <div className="mx-auto max-w-6xl px-6">
          <div className="h-[3px] overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full bg-[#134E4A] transition-all duration-300"
              style={{ width: `${((step + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-6 py-4">
          {steps.map((label, index) => {
            const isActive = step === index;
            const isCompleted = step > index;

            return (
              <div key={label} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-[#134E4A] text-white shadow"
                      : isCompleted
                        ? "bg-emerald-500 text-white"
                        : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {isCompleted ? "✓" : index + 1}
                  <span className="ml-1">{label}</span>
                </div>

                {index < steps.length - 1 && (
                  <div
                    className={`h-[2px] w-6 transition-all ${
                      step > index ? "bg-emerald-400" : "bg-gray-300"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl p-6">{getStepContent()}</div>
      </div>

      <div className="sticky bottom-0 z-30 border-t bg-white/80 shadow-[0_-2px_10px_rgba(0,0,0,0.04)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="text-xs text-gray-500">
            Step <span className="font-semibold text-gray-700">{step + 1}</span>{" "}
            of{" "}
            <span className="font-semibold text-gray-700">{steps.length}</span>
            {isLastStep && step5ValidationMessage && (
              <p className="mt-1 text-red-600">{step5ValidationMessage}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={step === 0 || submitting || savingProfile}
              onClick={() => setStep((previous) => previous - 1)}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm transition hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronLeft size={16} />
              Previous
            </button>

            <button
              type="button"
              onClick={isLastStep ? handleSubmit : goNext}
              disabled={nextDisabled}
              className="flex items-center gap-2 rounded-lg bg-[#134E4A] px-6 py-2 text-sm font-medium text-white shadow transition hover:bg-[#0f3f3c] disabled:opacity-40"
            >
              {isLastStep
                ? submitting
                  ? "Saving..."
                  : "Save Lender"
                : "Next Step"}
              {!isLastStep && <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
