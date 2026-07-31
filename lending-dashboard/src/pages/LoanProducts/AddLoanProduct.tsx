import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import StepTwo from "./LoanCriteria/StepTwo";
import StepThree from "./LoanCriteria/StepThree";
import StepFour from "./LoanCriteria/StepFour";
import StepFive from "./LoanCriteria/StepFive";
import EquipmentFinancingStep from "./LoanCriteria/EquipmentFinancingStep";
import {
  getLoanCriteriaFooterMessage,
  validateLoanProductCriteriaStep,
} from "../../lib/loanProductCriteriaFields";
import { mapToLenderProductUpdatePayload } from "../../lib/lenderProductLenderPayload";
import { mapToCanonicalCatalogId } from "../../lib/lenderLoanProducts";

type FormType = {
  loanPrograms: string[];
  propertyTypes: Record<string, string[]>;
  businessTypes: Record<string, string[]>;
  loanCriteria: Record<string, any>;
  equipmentFinance: string[];
};

type Product = {
  id: string;
  name: string;
  code: string;
};

type ExistingLenderProduct = {
  id: string;
  loanProductId?: string;
  loanProductCode?: string;
  code?: string;
  loanProduct?: { id?: string; code?: string };
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

function getAuthHeaders(): Record<string, string> {
  try {
    const token = sessionStorage.getItem("lender_token");
    if (token) {
      return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };
    }
  } catch {
    // ignore
  }

  return { "Content-Type": "application/json" };
}

function getProgramId(record: ExistingLenderProduct) {
  return String(record.loanProductId || record.loanProduct?.id || "");
}

export default function AddLoanProduct() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [hasStep5Errors, setHasStep5Errors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [existingLenderProducts, setExistingLenderProducts] = useState<
    ExistingLenderProduct[]
  >([]);
  const [form, setForm] = useState<FormType>({
    loanPrograms: [],
    propertyTypes: {},
    businessTypes: {},
    loanCriteria: {},
    equipmentFinance: [],
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/lender/loan-products/list?limit=100`,
          {
            headers: getAuthHeaders(),
          },
        );
        const json = await res.json().catch(() => ({}));

        if (!res.ok || !json.success) {
          throw new Error(json.message || "Failed to load existing products");
        }

        if (!cancelled) {
          setExistingLenderProducts((json.data || []) as ExistingLenderProduct[]);
        }
      } catch (err: any) {
        console.error(err);
        toast.error(err?.message || "Failed to load existing loan products");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const alreadyAddedIds = useMemo(() => {
    if (!products.length || !existingLenderProducts.length) return [];

    return [
      ...new Set(
        existingLenderProducts
          .map((item) =>
            mapToCanonicalCatalogId(
              products,
              item.loanProductCode || item.code || item.loanProduct?.code,
              getProgramId(item),
            ),
          )
          .filter(Boolean),
      ),
    ] as string[];
  }, [products, existingLenderProducts]);

  useEffect(() => {
    if (!alreadyAddedIds.length) return;
    setForm((prev) => {
      const filtered = prev.loanPrograms.filter(
        (id) => !alreadyAddedIds.includes(id),
      );
      if (filtered.length === prev.loanPrograms.length) return prev;
      return { ...prev, loanPrograms: filtered };
    });
  }, [alreadyAddedIds]);

  const selectedProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          form.loanPrograms.includes(p.id) && !alreadyAddedIds.includes(p.id),
      ),
    [products, form.loanPrograms, alreadyAddedIds],
  );

  const isEquipmentSelected = selectedProducts.some(
    (p) => p.code === "EQUIPMENT_FINANCE",
  );

  const steps = [
    "Loan Programs",
    "Property Types",
    "Business Types",
    ...(isEquipmentSelected ? ["Equipment Types"] : []),
    "Loan Criteria",
  ];

  const loanCriteriaStepIndex = steps.length - 1;
  const isLastStep = step === steps.length - 1;

  const footerValidationMessage =
    step === loanCriteriaStepIndex
      ? getLoanCriteriaFooterMessage(
          selectedProducts,
          form.loanCriteria,
          hasStep5Errors,
        )
      : null;

  const handleSubmit = async () => {
    const step5Error = validateLoanProductCriteriaStep(
      selectedProducts,
      form.loanCriteria,
    );
    if (step5Error) {
      toast.error(step5Error);
      return;
    }

    if (!selectedProducts.length) {
      toast.error("Please select at least one loan program");
      return;
    }

    setSubmitting(true);

    try {
      const headers = getAuthHeaders();

      for (const product of selectedProducts) {
        const criteria = form.loanCriteria?.[String(product.id)] || {};

        const payload = mapToLenderProductUpdatePayload(product, form, criteria);

        const res = await fetch(`${API_BASE}/lender/loan-products/create`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            products: [payload],
          }),
        });

        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            json?.message || `Failed to create ${product.name || product.code}`,
          );
        }

        const lenderProductId = json?.data?.[0]?.id;

        const selectedDocuments = criteria.documents || [];

        for (const doc of selectedDocuments) {
          const createPayload = {
            lenderProductId,
            documentTypeId: doc.id,
          };

          const docRes = await fetch(
            `${API_BASE}/lender/document-config/create`,
            {
              method: "POST",
              headers: getAuthHeaders(),
              body: JSON.stringify(createPayload),
            },
          );

          const docJson = await docRes.json().catch(() => ({}));

          if (!docRes.ok) {
            console.error("Failed to create document config", docJson);
          }
        }
      }

      toast.success("Loan product(s) created successfully");
      navigate("/all-loan-products");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to create loan products");
    } finally {
      setSubmitting(false);
    }
  };

  const getStepContent = () => {
    if (step === 0) {
      return (
        <StepTwo
          mode="lender"
          value={form.loanPrograms}
          setValue={(val) =>
            setForm((prev) => ({
              ...prev,
              loanPrograms: val.filter((id) => !alreadyAddedIds.includes(id)),
            }))
          }
          onProductsLoad={setProducts}
          alreadyAddedIds={alreadyAddedIds}
          description="Already added programs are disabled. Select new programs to add."
        />
      );
    }

    const propertyStepIndex = 1;
    const businessStepIndex = 2;
    const equipmentStepIndex = isEquipmentSelected ? 3 : -1;
    const loanCriteriaIndex = steps.length - 1;

    if (step === propertyStepIndex) {
      return (
        <StepThree
          value={form.propertyTypes}
          setValue={(val: Record<string, string[]>) =>
            setForm((prev) => ({ ...prev, propertyTypes: val }))
          }
        />
      );
    }

    if (step === businessStepIndex) {
      return (
        <StepFour
          value={form.businessTypes}
          setValue={(val: Record<string, string[]>) =>
            setForm((prev) => ({ ...prev, businessTypes: val }))
          }
        />
      );
    }

    if (isEquipmentSelected && step === equipmentStepIndex) {
      return (
        <EquipmentFinancingStep
          value={form.equipmentFinance}
          setValue={(val: string[]) =>
            setForm((prev) => ({ ...prev, equipmentFinance: val }))
          }
        />
      );
    }

    if (step === loanCriteriaIndex) {
      return (
        <StepFive
          products={selectedProducts}
          value={form.loanCriteria}
          setValue={(val: Record<string, any>) =>
            setForm((prev) => ({ ...prev, loanCriteria: val }))
          }
          setHasErrors={setHasStep5Errors}
        />
      );
    }

    return null;
  };

  const nextDisabled =
    (!isLastStep && step === 0 && form.loanPrograms.length === 0) ||
    (step === loanCriteriaStepIndex &&
      (hasStep5Errors || footerValidationMessage !== null)) ||
    submitting;

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col bg-gray-50">
      <div className="sticky top-0 z-30 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/all-loan-products")}
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
          {steps.map((label, index) => {
            const isActive = step === index;
            const isCompleted = step > index;

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
                  {isCompleted ? "✓" : index + 1}
                  <span className="ml-1">{label}</span>
                </div>

                {index < steps.length - 1 && (
                  <div
                    className={`w-6 h-[2px] transition-all ${
                      step > index ? "bg-green-400" : "bg-gray-300"
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
            {footerValidationMessage && (
              <p className="mt-1 max-w-xl text-sm text-red-600">
                {footerValidationMessage}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              disabled={step === 0 || submitting}
              onClick={() => setStep((prev) => prev - 1)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-gray-300 bg-white hover:bg-gray-50 transition disabled:opacity-40"
            >
              <ChevronLeft size={16} />
              Previous
            </button>

            <button
              onClick={
                isLastStep ? handleSubmit : () => setStep((prev) => prev + 1)
              }
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
