import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import StepTwo from "../LoanCriteria/StepTwo";
import StepFive from "../LoanCriteria/StepFive";
import { ChevronRight, ChevronLeft, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import {
  getLoanCriteriaFooterMessage,
  mapApiProductToCriteriaForm,
  productUsesEquipmentTypes,
  validateLoanProductCriteriaStep,
} from "../../../lib/loanProductCriteriaFields";
import {
  mapToAdminProductPayload,
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
  const [configuredProgramIds, setConfiguredProgramIds] = useState<string[]>(
    [],
  );
  const [existingByProgramId, setExistingByProgramId] = useState<
    Record<string, any>
  >({});

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

  const steps = ["Update Lender", "Loan Programs", "Loan Criteria"];
  const loanCriteriaStepIndex = steps.length - 1;
  const isLastStep = step === steps.length - 1;
  const isUpdatingConfigured = selectedProducts.some((p) =>
    Boolean(form.productIdMap?.[p.id]),
  );

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

  const handlePickProduct = (productId: string) => {
    const existing = existingByProgramId[productId];
    const product = products.find((p) => p.id === productId);

    let propertyTypes: Record<string, string[]> = {};
    let businessTypes: Record<string, string[]> = {};
    let equipmentFinance: string[] = [];
    const loanCriteria: Record<string, any> = {};

    if (existing) {
      const code = resolveLenderOfferedProductCode(
        existing.loanProductCode ||
          existing.code ||
          existing.loanProduct?.code ||
          product?.code ||
          "",
      );

      loanCriteria[productId] = mapApiProductToCriteriaForm({
        ...existing,
        loanProductCode: code,
        code,
      });

      propertyTypes = normalizeGroupedSelectionFromApi(
        existing.propertyTypes,
        "type",
      );
      businessTypes = normalizeGroupedSelectionFromApi(
        existing.businessTypes,
        "name",
      );

      if (productUsesEquipmentTypes(code)) {
        equipmentFinance = Array.isArray(existing.equipmentTypes)
          ? existing.equipmentTypes
          : [];
      }
    } else {
      const code = resolveLenderOfferedProductCode(product?.code || "");
      loanCriteria[productId] = mapApiProductToCriteriaForm({
        loanProductCode: code,
        code,
      });
    }

    setForm((prev) => ({
      ...prev,
      loanPrograms: [productId],
      propertyTypes,
      businessTypes,
      loanCriteria,
      equipmentFinance,
    }));
    setHasStep5Errors(false);
    setStep(2);
  };

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
      toast.error("Please select a loan program");
      return;
    }

    setSubmitting(true);

    try {
      await updateLender(lenderOrgId);

      const product = selectedProducts[0];
      const existingId = form.productIdMap?.[product.id];
      const payload = mapToAdminProductPayload(
        product,
        form,
        form.loanCriteria?.[product.id] || {},
        existingId,
      );

      const res = await fetch(`${API_BASE}/admin/lender-products/update`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          lenderOrgId,
          products: [payload],
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        throw new Error(json?.message || "Failed to update lender product");
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

      toast.success(
        existingId
          ? "Lender and loan product updated successfully"
          : "Lender updated and loan product assigned successfully",
      );
      navigate("/view-assigned-products");
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

    if (step === 1 && form.loanPrograms.length === 1) {
      handlePickProduct(form.loanPrograms[0]);
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
    const existingMap: Record<string, any> = {};
    const configuredIds: string[] = [];

    data.forEach((item: any) => {
      const canonicalId = mapToCanonicalCatalogId(
        catalogProducts,
        item.loanProductCode,
        item.loanProductId,
      );

      if (!canonicalId) return;

      productIdMap[canonicalId] = item.id;
      existingMap[canonicalId] = item;
      configuredIds.push(canonicalId);
    });

    setExistingByProgramId(existingMap);
    setConfiguredProgramIds([...new Set(configuredIds)]);
    setForm((prev) => ({
      ...prev,
      loanPrograms: [],
      propertyTypes: {},
      businessTypes: {},
      loanCriteria: {},
      equipmentFinance: [],
      productIdMap,
    }));
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
        <div>
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900">
              Update Lender
            </h2>
            <p className="text-sm text-gray-500">
              Update organization and admin details, then configure one loan
              program.
            </p>
          </div>

          <div className="mb-8">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
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

          <div>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
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
              loanPrograms: Array.isArray(val) ? val.slice(0, 1) : [],
            }))
          }
          alreadyAddedIds={configuredProgramIds}
          onProductsLoad={setProducts}
          pickOneMode
          configuredSelectable
          onPickProduct={handlePickProduct}
          description="Select one loan program to continue. Configured programs stay available."
        />
      );
    }

    if (step === loanCriteriaStepIndex) {
      return (
        <StepFive
          key={`criteria-${form.loanPrograms.join("-")}`}
          authMode="admin"
          mode={isUpdatingConfigured ? "update" : "create"}
          products={selectedProducts}
          lenderProductIdByProgramId={form.productIdMap}
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
          equipmentTypes={form.equipmentFinance}
          setEquipmentTypes={(val: string[]) =>
            setForm((p) => ({ ...p, equipmentFinance: val }))
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
    <div className="mx-auto max-w-6xl space-y-4 bg-transparent pb-4">
      <div className="sticky top-16 z-40 rounded-xl border border-slate-200 bg-white/95 px-6 py-4 shadow-sm backdrop-blur lg:top-[4.75rem]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/all-lenders-Organization")}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition hover:bg-gray-100"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              {selectedProducts[0]?.name && step > 0 ? (
                <>
                  <h1 className="truncate text-lg font-semibold leading-tight">
                    {selectedProducts[0].name}
                  </h1>
                  <p className="truncate text-xs text-gray-500">
                    {steps[step]} · Step {step + 1} of {steps.length}
                    {form.organizationName
                      ? ` · ${form.organizationName}`
                      : ""}
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-lg font-semibold leading-tight">
                    {steps[step]}
                  </h1>
                  <p className="text-xs text-gray-500">
                    Step {step + 1} of {steps.length}
                    {form.organizationName && step === 0
                      ? ` · ${form.organizationName}`
                      : ""}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 h-[3px] w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full bg-[#102B40] transition-all duration-300"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {steps.map((label, i) => {
            const isActive = step === i;
            const isCompleted = step > i;

            return (
              <div key={label} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-[#102B40] text-white shadow"
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
                    className={`h-[2px] w-6 transition-all ${
                      step > i ? "bg-green-400" : "bg-gray-300"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        {getStepContent()}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-gray-500">
            Step <span className="font-semibold text-gray-700">{step + 1}</span>{" "}
            of{" "}
            <span className="font-semibold text-gray-700">{steps.length}</span>
            {step === 1 && configuredProgramIds.length > 0 ? (
              <span className="ml-2 text-emerald-600">
                {configuredProgramIds.length} configured
              </span>
            ) : null}
            {isLastStep && step5ValidationMessage && (
              <p className="mt-1 max-w-xl text-sm text-red-600">
                {step5ValidationMessage}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={step === 0 || submitting || loading}
              onClick={() => setStep((p) => p - 1)}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm transition hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronLeft size={16} />
              Previous
            </button>

            <button
              type="button"
              onClick={handleNext}
              disabled={nextDisabled}
              className="flex items-center gap-2 rounded-lg bg-[#102B40] px-6 py-2 text-sm font-medium text-white shadow transition hover:bg-[#163a54] disabled:opacity-40"
            >
              {isLastStep
                ? submitting
                  ? isUpdatingConfigured
                    ? "Updating..."
                    : "Submitting..."
                  : isUpdatingConfigured
                    ? "Update"
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
        className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black ${
          error ? "border-red-500" : "border-gray-300"
        }`}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
};
