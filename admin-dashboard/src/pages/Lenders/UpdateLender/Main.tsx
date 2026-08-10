import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import StepTwo from "../AddLender/LoanCriteria/StepTwo";
import StepFive from "../AddLender/LoanCriteria/StepFive";
import EquipmentFinancingStep from "../AddLender/LoanCriteria/EquipmentFinancingStep";
import { ChevronRight, ChevronLeft, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import {
  getDefaultCriteriaValuesForProduct,
  getLoanCriteriaFooterMessage,
  mapApiProductToCriteriaForm,
  validateLoanProductCriteriaStep,
} from "../../../lib/loanProductCriteriaFields";
import {
  mapToAdminProductPayload,
  mergeGroupedSelections,
  normalizeGroupedSelectionFromApi,
} from "../../../lib/lenderProductAdminPayload";
import {
  filterLenderCatalogProducts,
  mapToCanonicalCatalogId,
  resolveLenderOfferedProductCode,
} from "../../../lib/canonicalLoanProducts";

type FormType = {
  lenderId: string;
  loanPrograms: string[];
  organizationName: string;
  organizationEmail: string;
  organizationPhone: string;
  firstName: string;
  lastName: string;
  adminEmail: string;
  brokerId: string;
  propertyTypes: Record<string, string[]>;
  businessTypes: Record<string, string[]>;
  loanCriteria: Record<string, any>;
  equipmentFinance: string[];
  productIdMap: Record<string, string>;
};

type Product = {
  id: string;
  name: string;
  code: string;
};

type InputFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
};

type ApiFieldError = Error & {
  field?: string;
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

function getAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("admin_token");
  return token
    ? {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }
    : { "Content-Type": "application/json" };
}

export default function Main() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [lenderOrgId, setLenderOrgId] = useState<string | null>(null);
  const [hasStep5Errors, setHasStep5Errors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [lockedProgramIds, setLockedProgramIds] = useState<string[]>([]);

  const [form, setForm] = useState<FormType>({
    lenderId: "",
    loanPrograms: [],
    organizationName: "",
    organizationEmail: "",
    organizationPhone: "",
    firstName: "",
    lastName: "",
    adminEmail: "",
    brokerId: "",
    propertyTypes: {},
    businessTypes: {},
    loanCriteria: {},
    equipmentFinance: [],
    productIdMap: {},
  });

  const selectedProducts = useMemo(
    () => products.filter((p) => form.loanPrograms.includes(p.id)),
    [products, form.loanPrograms],
  );

  const newProgramIds = useMemo(
    () => form.loanPrograms.filter((id) => !lockedProgramIds.includes(id)),
    [form.loanPrograms, lockedProgramIds],
  );

  const isEquipmentSelected = selectedProducts.some(
    (p) => p.code === "EQUIPMENT_FINANCE",
  );

  const steps = [
    "Update Lender",
    "Loan Programs",
    ...(isEquipmentSelected ? ["Equipment Types"] : []),
    "Loan Criteria",
  ];

  const loanCriteriaStepIndex = steps.length - 1;
  const isLastStep = step === steps.length - 1;

  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    const parts = [];
    if (digits.length > 0) parts.push(digits.slice(0, 3));
    if (digits.length >= 4) parts.push(digits.slice(3, 6));
    if (digits.length >= 7) parts.push(digits.slice(6, 10));
    return parts.join("-");
  };

  const cleanPhone = (value: string) => value.replace(/\D/g, "");

  const validateStep0 = () => {
    if (!form.organizationName?.trim()) return "Organization name is required";
    if (!form.organizationEmail?.trim())
      return "Organization email is required";
    if (!isValidEmail(form.organizationEmail))
      return "Please enter a valid organization email";
    if (!form.organizationPhone?.trim()) return "Phone number is required";
    if (cleanPhone(form.organizationPhone).length !== 10)
      return "Phone must be 10 digits (USA format)";
    if (!form.firstName?.trim()) return "First name is required";
    if (!form.lastName?.trim()) return "Last name is required";
    if (!form.adminEmail?.trim()) return "Admin email is required";
    if (!isValidEmail(form.adminEmail))
      return "Please enter a valid admin email";
    return null;
  };

  const validateStep5 = () =>
    validateLoanProductCriteriaStep(selectedProducts, form.loanCriteria);

  const updateLender = async (orgId: string) => {
    const payload: Record<string, string> = {
      organizationName: form.organizationName.trim(),
      organizationEmail: form.organizationEmail.trim().toLowerCase(),
      organizationPhone: cleanPhone(form.organizationPhone),
      adminFirstName: form.firstName.trim(),
      adminLastName: form.lastName.trim(),
      adminEmail: form.adminEmail.trim().toLowerCase(),
    };

    if (form.brokerId) {
      payload.brokerOrgId = form.brokerId;
    }

    const res = await fetch(`${API_BASE}/admin/lenders/update/${orgId}`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err = new Error(
        json?.message || "Failed to update lender",
      ) as ApiFieldError;
      err.field = json?.field;
      throw err;
    }
  };

  const handleSubmit = async () => {
    const step5Error = validateStep5();
    if (step5Error) {
      toast.error(step5Error);
      return;
    }

    if (!lenderOrgId) {
      toast.error("Lender not found");
      return;
    }

    if (!selectedProducts.length) {
      toast.error("Please select at least one loan program");
      return;
    }

    setSubmitting(true);

    try {
      await updateLender(lenderOrgId);

      const mappedProducts = selectedProducts.map((product) =>
        mapToAdminProductPayload(
          product,
          form,
          form.loanCriteria?.[product.id] || {},
          form.productIdMap?.[product.id],
        ),
      );

      const res = await fetch(`${API_BASE}/admin/lender-products/update`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          lenderOrgId,
          products: mappedProducts,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        throw new Error(json?.message || "Failed to update lender products");
      }

      if (Array.isArray(json.data)) {
        setForm((prev) => {
          const nextProductIdMap = { ...prev.productIdMap };

          json.data.forEach((item: any) => {
            const canonicalId = mapToCanonicalCatalogId(
              products,
              item.loanProductCode,
              item.loanProductId,
            );

            if (canonicalId && item.id) {
              nextProductIdMap[canonicalId] = item.id;
            }
          });

          return {
            ...prev,
            productIdMap: nextProductIdMap,
          };
        });
      }

      toast.success("Lender updated successfully");
      navigate("/all-lenders-Organization");
    } catch (err: any) {
      console.error(err);

      if (err?.field) {
        setFieldErrors({ [err.field]: err.message });
        setStep(0);
      }

      toast.error(err?.message || "Failed to update");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (step === 0) {
      const error = validateStep0();
      if (error) {
        toast.error(error);
        return;
      }
      setFieldErrors({});
      setStep(1);
      return;
    }

    if (isLastStep) {
      handleSubmit();
      return;
    }

    setStep((prev) => prev + 1);
  };

  const fetchLenderById = async (lenderId: string) => {
    const res = await fetch(
      `${API_BASE}/admin/lenders/read?search=${lenderId}`,
      { headers: getAuthHeaders() },
    );
    const json = await res.json();

    if (!json?.success || !json?.data?.results?.length) {
      throw new Error("Lender not found");
    }

    const lender = json.data.results[0];

    setForm((prev) => ({
      ...prev,
      lenderId: lender.id,
      organizationName: lender.organizationName || "",
      organizationEmail: lender.organizationEmail || "",
      organizationPhone: lender.organizationPhone
        ? formatPhone(lender.organizationPhone)
        : "",
      firstName: lender.adminFirstName || "",
      lastName: lender.adminLastName || "",
      adminEmail: lender.adminEmail || "",
      brokerId: lender.brokerOrgId || "",
    }));

    setLenderOrgId(lender.id);
  };

  const fetchLenderProducts = async (orgId: string) => {
    const [lenderRes, catalogRes] = await Promise.all([
      fetch(`${API_BASE}/admin/lender-products/lender/${orgId}`, {
        headers: getAuthHeaders(),
      }),
      fetch(`${API_BASE}/admin/loan-products/list`, {
        headers: getAuthHeaders(),
      }),
    ]);

    const json = await lenderRes.json();
    const catalogJson = await catalogRes.json();

    if (!json?.success) return;

    const data = json.data || [];
    const catalogProducts: Product[] = filterLenderCatalogProducts(
      ((catalogJson.data || []) as Array<{
        id: string;
        code: string;
        name: string;
      }>).map((item) => ({
        id: String(item.id),
        code: item.code,
        name: item.name,
      })),
    );

    setProducts(catalogProducts);

    const productIdMap: Record<string, string> = {};
    let propertyTypes: Record<string, string[]> = {};
    let businessTypes: Record<string, string[]> = {};
    const loanCriteria: Record<string, any> = {};
    let equipmentFinance: string[] = [];

    data.forEach((item: any) => {
      const canonicalId = mapToCanonicalCatalogId(
        catalogProducts,
        item.loanProductCode,
        item.loanProductId,
      );

      if (!canonicalId) return;

      productIdMap[canonicalId] = item.id;

      propertyTypes = mergeGroupedSelections(
        propertyTypes,
        normalizeGroupedSelectionFromApi(item.propertyTypes, "type"),
      );

      businessTypes = mergeGroupedSelections(
        businessTypes,
        normalizeGroupedSelectionFromApi(item.businessTypes, "name"),
      );

      const canonicalCode = resolveLenderOfferedProductCode(
        item.loanProductCode || "",
      );

      loanCriteria[canonicalId] = mapApiProductToCriteriaForm({
        ...item,
        loanProductCode: canonicalCode,
        code: canonicalCode,
      });

      if (canonicalCode === "EQUIPMENT_FINANCE") {
        equipmentFinance = Array.isArray(item.equipmentTypes)
          ? item.equipmentTypes
          : [];
      }
    });

    const loanPrograms = Array.from(
      new Set<string>(
        data
          .map((item: any) =>
            mapToCanonicalCatalogId(
              catalogProducts,
              item.loanProductCode,
              item.loanProductId,
            ),
          )
          .filter((id: string | null): id is string => Boolean(id)),
      ),
    );

    setForm((prev) => ({
      ...prev,
      loanPrograms,
      propertyTypes,
      businessTypes,
      loanCriteria,
      equipmentFinance,
      productIdMap,
    }));

    setLockedProgramIds(loanPrograms);
  };

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setLoading(true);
      try {
        await fetchLenderById(id);
        await fetchLenderProducts(id);
      } catch (err: any) {
        console.error(err);
        toast.error(err?.message || "Failed to load lender");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  useEffect(() => {
    if (!products.length || !form.loanPrograms.length) return;

    setForm((prev) => {
      let changed = false;
      const nextCriteria = { ...prev.loanCriteria };

      form.loanPrograms.forEach((programId) => {
        if (nextCriteria[programId]) return;

        const product = products.find((p) => p.id === programId);
        if (!product) return;

        const defaults = getDefaultCriteriaValuesForProduct(product.code);
        nextCriteria[programId] = {
          ...defaults,
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

  useEffect(() => {
    if (!isEquipmentSelected) {
      setForm((p) => ({ ...p, equipmentFinance: [] }));
    }
  }, [isEquipmentSelected]);

  const getStepContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-20 text-sm text-gray-500">
          Loading lender details...
        </div>
      );
    }

    if (step === 0) {
      return (
        <div className="max-w-6xl mx-auto">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900">
                Update Lender
              </h2>
              <p className="text-sm text-gray-500">
                Enter organization and admin details
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Organization Details
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label="Organization Name"
                  required
                  value={form.organizationName}
                  error={fieldErrors.organizationName}
                  onChange={(v) => {
                    setFieldErrors((prev) => {
                      if (!prev.organizationName) return prev;
                      const next = { ...prev };
                      delete next.organizationName;
                      return next;
                    });
                    setForm((p) => ({ ...p, organizationName: v }));
                  }}
                />
                <InputField
                  label="Organization Email"
                  required
                  value={form.organizationEmail}
                  error={fieldErrors.organizationEmail}
                  onChange={(v) => {
                    setFieldErrors((prev) => {
                      if (!prev.organizationEmail) return prev;
                      const next = { ...prev };
                      delete next.organizationEmail;
                      return next;
                    });
                    setForm((p) => ({ ...p, organizationEmail: v }));
                  }}
                />
                <div className="col-span-2">
                  <InputField
                    label="Phone Number"
                    required
                    value={form.organizationPhone}
                    error={fieldErrors.organizationPhone}
                    onChange={(v) => {
                      setFieldErrors((prev) => {
                        if (!prev.organizationPhone) return prev;
                        const next = { ...prev };
                        delete next.organizationPhone;
                        return next;
                      });
                      setForm((p) => ({
                        ...p,
                        organizationPhone: formatPhone(v),
                      }));
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Admin Details
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label="First Name"
                  required
                  value={form.firstName}
                  onChange={(v) => setForm((p) => ({ ...p, firstName: v }))}
                />
                <InputField
                  label="Last Name"
                  required
                  value={form.lastName}
                  onChange={(v) => setForm((p) => ({ ...p, lastName: v }))}
                />
                <InputField
                  label="Email Address"
                  required
                  value={form.adminEmail}
                  error={fieldErrors.adminEmail}
                  onChange={(v) => {
                    setFieldErrors((prev) => {
                      if (!prev.adminEmail) return prev;
                      const next = { ...prev };
                      delete next.adminEmail;
                      return next;
                    });
                    setForm((p) => ({ ...p, adminEmail: v }));
                  }}
                />
              </div>
            </div>

            {/* <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Broker (Optional)
              </h3>
              <select
                value={form.brokerId || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, brokerId: e.target.value }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-black focus:border-black outline-none transition"
              >
                <option value="">Select broker</option>
                {brokers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} — {b.email}
                  </option>
                ))}
              </select>
            </div> */}
          </div>
        </div>
      );
    }

    if (step === 1) {
      return (
        <StepTwo
          mode="admin"
          value={form.loanPrograms}
          setValue={(val) =>
            setForm((p) => ({
              ...p,
              loanPrograms: [
                ...new Set([
                  ...lockedProgramIds,
                  ...(Array.isArray(val) ? val : []),
                ]),
              ],
            }))
          }
          lockedIds={lockedProgramIds}
          onProductsLoad={setProducts}
        />
      );
    }

    const equipmentStepIndex = isEquipmentSelected ? 2 : -1;

    if (isEquipmentSelected && step === equipmentStepIndex) {
      return (
        <EquipmentFinancingStep
          value={form.equipmentFinance}
          setValue={(val: string[]) =>
            setForm((p) => ({ ...p, equipmentFinance: val }))
          }
        />
      );
    }

    if (step === loanCriteriaStepIndex) {
      return (
        <StepFive
          authMode="admin"
          mode="update"
          products={selectedProducts}
          value={form.loanCriteria}
          setValue={(val: Record<string, any>) =>
            setForm((p) => ({ ...p, loanCriteria: val }))
          }
          setHasErrors={setHasStep5Errors}
          propertyTypes={form.propertyTypes}
          setPropertyTypes={(val: Record<string, string[]>) =>
            setForm((p) => ({ ...p, propertyTypes: val }))
          }
          businessTypes={form.businessTypes}
          setBusinessTypes={(val: Record<string, string[]>) =>
            setForm((p) => ({ ...p, businessTypes: val }))
          }
        />
      );
    }

    return null;
  };

  const step0Invalid = Boolean(validateStep0());

  const step5ValidationMessage =
    step === loanCriteriaStepIndex
      ? getLoanCriteriaFooterMessage(
          selectedProducts,
          form.loanCriteria,
          hasStep5Errors,
        )
      : null;

  const nextDisabled =
    loading ||
    submitting ||
    (step === 0 && step0Invalid) ||
    (step === 1 && form.loanPrograms.length === 0) ||
    (step === loanCriteriaStepIndex &&
      (hasStep5Errors || step5ValidationMessage !== null));

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/all-lenders-Organization")}
              className="flex items-center justify-center w-9 h-9 rounded-full border hover:bg-gray-100 transition"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-lg font-semibold leading-tight">
                {steps[step]}
              </h1>
              <p className="text-xs text-gray-500">
                Step {step + 1} of {steps.length}
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6">
          <div className="w-full h-[3px] bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-black transition-all duration-300"
              style={{ width: `${((step + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3 flex-wrap">
          {steps.map((label, i) => {
            const isActive = step === i;
            const isCompleted = step > i;

            return (
              <div key={label} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200
                    ${
                      isActive
                        ? "bg-black text-white shadow"
                        : isCompleted
                          ? "bg-green-500 text-white"
                          : "bg-gray-100 text-gray-400"
                    }`}
                >
                  {isCompleted ? "✓" : i + 1}
                  <span className="ml-1">{label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`w-6 h-[2px] transition-all ${
                      step > i ? "bg-green-400" : "bg-gray-300"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-6">{getStepContent()}</div>
      </div>

      <div className="sticky bottom-0 z-30 bg-white/80 backdrop-blur border-t shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Step <span className="font-semibold text-gray-700">{step + 1}</span>{" "}
            of{" "}
            <span className="font-semibold text-gray-700">{steps.length}</span>
            {step === 1 && lockedProgramIds.length > 0 ? (
              <span className="ml-2 text-emerald-600">
                {lockedProgramIds.length} active
                {newProgramIds.length > 0
                  ? `, ${newProgramIds.length} new selected`
                  : ""}
              </span>
            ) : null}
            {isLastStep && step5ValidationMessage && (
              <p className="mt-1 text-red-600">{step5ValidationMessage}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              disabled={step === 0 || submitting || loading}
              onClick={() => setStep((p) => p - 1)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-gray-300 bg-white hover:bg-gray-50 transition disabled:opacity-40"
            >
              <ChevronLeft size={16} />
              Previous
            </button>

            <button
              onClick={handleNext}
              disabled={nextDisabled}
              className="flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-black to-gray-800 text-white shadow hover:scale-[1.03] active:scale-[0.98] transition disabled:opacity-40"
            >
              {isLastStep
                ? submitting
                  ? "Submitting..."
                  : "Submit"
                : "Next Step"}
              {!isLastStep && <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const InputField = ({
  label,
  value,
  onChange,
  required = false,
  error,
}: InputFieldProps) => {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-gray-600">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-black focus:border-black outline-none transition ${
          error ? "border-red-500" : "border-gray-300"
        }`}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
};
