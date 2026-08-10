import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import StepTwo from "./LoanCriteria/StepTwo";
import StepFive from "./LoanCriteria/StepFive";
import {
  getLoanCriteriaFooterMessage,
  productUsesEquipmentTypes,
  mapApiProductToCriteriaForm,
  validateLoanProductCriteriaStep,
} from "../../lib/loanProductCriteriaFields";
import {
  mapToLenderProductUpdatePayload,
  normalizeGroupedSelectionFromApi,
} from "../../lib/lenderProductLenderPayload";
import {
  mapToCanonicalCatalogId,
  normalizeLenderProductRecord,
  resolveLenderOfferedProductCode,
} from "../../lib/lenderLoanProducts";

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
  name?: string;
  documents?: any[];
  propertyTypes?: unknown;
  businessTypes?: unknown;
  equipmentTypes?: string[];
  loanProduct?: { id?: string; code?: string };
  [key: string]: any;
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

async function syncDocumentConfigs(
  lenderProductId: string,
  selectedDocuments: any[],
  existingDocuments: any[],
) {
  for (const existingDoc of existingDocuments) {
    const stillSelected = selectedDocuments.some(
      (d: any) =>
        d.id === existingDoc.documentTypeId ||
        d.documentTypeId === existingDoc.documentTypeId,
    );

    if (!stillSelected) {
      try {
        await fetch(
          `${API_BASE}/lender/document-config/delete/${existingDoc.id}`,
          {
            method: "DELETE",
            headers: getAuthHeaders(),
          },
        );
      } catch (err) {
        console.error("Delete document config failed", err);
      }
    }
  }

  for (const doc of selectedDocuments) {
    const existingDoc = existingDocuments.find(
      (d: any) =>
        d.documentTypeId === doc.id || d.documentTypeId === doc.documentTypeId,
    );

    const documentTypeId = doc.documentTypeId || doc.id;

    if (existingDoc?.id) {
      await fetch(
        `${API_BASE}/lender/document-config/update/${existingDoc.id}`,
        {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            lenderProductId,
            documentTypeId,
          }),
        },
      );
    } else {
      await fetch(`${API_BASE}/lender/document-config/create`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          lenderProductId,
          documentTypeId,
        }),
      });
    }
  }
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
          setExistingLenderProducts(
            (json.data || []) as ExistingLenderProduct[],
          );
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

  const lenderProductByProgramId = useMemo(() => {
    const map: Record<string, ExistingLenderProduct> = {};
    existingLenderProducts.forEach((item) => {
      const programId = mapToCanonicalCatalogId(
        products,
        item.loanProductCode || item.code || item.loanProduct?.code,
        getProgramId(item),
      );
      if (programId) {
        map[String(programId)] = item;
      }
    });
    return map;
  }, [existingLenderProducts, products]);

  const selectedProducts = useMemo(
    () => products.filter((p) => form.loanPrograms.includes(p.id)),
    [products, form.loanPrograms],
  );

  const steps = ["Loan Programs", "Loan Criteria"];

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

  const handlePickProduct = (productId: string) => {
    const existing = lenderProductByProgramId[productId];
    const product = products.find((p) => p.id === productId);

    let propertyTypes: Record<string, string[]> = {};
    let businessTypes: Record<string, string[]> = {};
    let equipmentFinance: string[] = [];
    const loanCriteria: Record<string, any> = {};

    if (existing) {
      const normalized = normalizeLenderProductRecord(existing);
      const code = resolveLenderOfferedProductCode(
        normalized.loanProductCode ||
          normalized.code ||
          product?.code ||
          "",
      );

      loanCriteria[productId] = mapApiProductToCriteriaForm({
        ...normalized,
        loanProductCode: code,
        code,
      });

      propertyTypes = normalizeGroupedSelectionFromApi(
        normalized.propertyTypes,
        "type",
      );
      businessTypes = normalizeGroupedSelectionFromApi(
        normalized.businessTypes,
        "name",
      );

      if (productUsesEquipmentTypes(code)) {
        equipmentFinance = Array.isArray(normalized.equipmentTypes)
          ? normalized.equipmentTypes
          : [];
      }
    } else if (productUsesEquipmentTypes(product?.code)) {
      equipmentFinance = [];
    }

    setForm({
      loanPrograms: [productId],
      propertyTypes,
      businessTypes,
      loanCriteria,
      equipmentFinance,
    });
    setHasStep5Errors(false);
    setStep(1);
  };

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
      toast.error("Please select a loan program");
      return;
    }

    setSubmitting(true);

    try {
      const headers = getAuthHeaders();
      const product = selectedProducts[0];
      const criteria = form.loanCriteria?.[String(product.id)] || {};
      const existing = lenderProductByProgramId[product.id];
      const payload = mapToLenderProductUpdatePayload(product, form, criteria);

      if (existing?.id) {
        const res = await fetch(
          `${API_BASE}/lender/loan-products/update/${existing.id}`,
          {
            method: "PUT",
            headers,
            body: JSON.stringify(payload),
          },
        );

        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            json?.message || `Failed to update ${product.name || product.code}`,
          );
        }

        await syncDocumentConfigs(
          existing.id,
          criteria.documents || [],
          existing.documents || [],
        );

        toast.success("Loan product updated successfully");
      } else {
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
        if (lenderProductId) {
          await syncDocumentConfigs(
            lenderProductId,
            criteria.documents || [],
            [],
          );
        }

        toast.success("Loan product created successfully");
      }

      navigate("/all-loan-products");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to save loan product");
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
              loanPrograms: Array.isArray(val) ? val.slice(0, 1) : [],
            }))
          }
          onProductsLoad={setProducts}
          alreadyAddedIds={alreadyAddedIds}
          pickOneMode
          configuredSelectable
          onPickProduct={handlePickProduct}
          description="Select one loan program to continue. Configured programs stay available."
        />
      );
    }

    if (step === loanCriteriaStepIndex) {
      const isUpdatingConfigured = selectedProducts.some(
        (p) => Boolean(lenderProductByProgramId[p.id]),
      );

      return (
        <StepFive
          key={`criteria-${form.loanPrograms.join("-")}`}
          mode={isUpdatingConfigured ? "update" : "create"}
          products={selectedProducts}
          lenderProductIdByProgramId={Object.fromEntries(
            Object.entries(lenderProductByProgramId).map(
              ([programId, record]) => [programId, record.id],
            ),
          )}
          value={form.loanCriteria}
          setValue={(val: Record<string, any>) =>
            setForm((prev) => ({ ...prev, loanCriteria: val }))
          }
          setHasErrors={setHasStep5Errors}
          propertyTypes={form.propertyTypes}
          setPropertyTypes={(val: Record<string, string[]>) =>
            setForm((prev) => ({ ...prev, propertyTypes: val }))
          }
          businessTypes={form.businessTypes}
          setBusinessTypes={(val: Record<string, string[]>) =>
            setForm((prev) => ({ ...prev, businessTypes: val }))
          }
          equipmentTypes={form.equipmentFinance}
          setEquipmentTypes={(val: string[]) =>
            setForm((prev) => ({ ...prev, equipmentFinance: val }))
          }
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
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate("/all-loan-products")}
              className="flex items-center justify-center w-9 h-9 shrink-0 rounded-full border hover:bg-gray-100 transition"
            >
              <ArrowLeft size={18} />
            </button>

            <div className="min-w-0">
              {selectedProducts[0]?.name ? (
                <>
                  <h1 className="text-lg font-semibold leading-tight truncate">
                    {selectedProducts[0].name}
                  </h1>
                  <p className="text-xs text-gray-500 truncate">
                    {steps[step]} · Step {step + 1} of {steps.length}
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-lg font-semibold leading-tight">
                    {steps[step]}
                  </h1>
                  <p className="text-xs text-gray-500">
                    Step {step + 1} of {steps.length}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-screen-2xl mx-auto px-6">
          <div className="w-full h-[3px] bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-black transition-all duration-300"
              style={{ width: `${((step + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center gap-3 flex-wrap">
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
        <div className="max-w-screen-2xl mx-auto p-6">{getStepContent()}</div>
      </div>

      <div className="sticky bottom-0 z-30 bg-white/80 backdrop-blur border-t shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
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
              type="button"
              disabled={step === 0 || submitting}
              onClick={() => setStep((prev) => prev - 1)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-gray-300 bg-white hover:bg-gray-50 transition disabled:opacity-40"
            >
              <ChevronLeft size={16} />
              Previous
            </button>

            <button
              type="button"
              onClick={
                isLastStep ? handleSubmit : () => setStep((prev) => prev + 1)
              }
              disabled={nextDisabled}
              className="flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-black to-gray-800 text-white shadow hover:scale-[1.03] active:scale-[0.98] transition disabled:opacity-40"
            >
              {isLastStep
                ? submitting
                  ? "Submitting..."
                  : selectedProducts.some((p) =>
                        Boolean(lenderProductByProgramId[p.id]),
                      )
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
