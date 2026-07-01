import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import StepTwo from "./LoanCriteria/StepTwo";
import StepThree from "./LoanCriteria/StepThree";
import StepFour from "./LoanCriteria/StepFour";
import StepFive from "./LoanCriteria/StepFive";
import EquipmentFinancingStep from "./LoanCriteria/EquipmentFinancingStep";
import {
  buildLenderProductCriteriaPayload,
  getRequiredCriteriaKeysForProduct,
  isMezzanineProduct,
  isNoMinLoanCriteriaProduct,
  isSba504Product,
  mapApiProductToCriteriaForm,
} from "../../lib/loanProductCriteriaFields";

type FormType = {
  loanPrograms: string[];
  propertyTypes: Record<string, string[]>;
  businessTypes: Record<string, string[]>;
  loanCriteria: Record<string, any>;
  equipmentFinance: string[];
};

type LenderProductRecord = {
  id: string;
  loanProductId: string;
  loanProductCode?: string;
  code?: string;
  name?: string;
  documents?: any[];
  propertyTypes?: Record<string, string[]>;
  businessTypes?: Record<string, string[]>;
  equipmentTypes?: string[];
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

function getProgramId(record: LenderProductRecord) {
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
        await fetch(`${API_BASE}/lender/document-config/delete/${existingDoc.id}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });
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
      await fetch(`${API_BASE}/lender/document-config/update/${existingDoc.id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          lenderProductId,
          documentTypeId,
        }),
      });
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

type Product = {
  id: string;
  name: string;
  code: string;
};

export default function UpdateLoanProduct() {
  const navigate = useNavigate();
  const location = useLocation();
  const updatedLoanProduct = location.state?.loanProduct;
  // const productId = updatedLoanProduct?.id;
  const [step, setStep] = useState(0);
  const [hasStep5Errors, setHasStep5Errors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [existingLenderProducts, setExistingLenderProducts] = useState<
    LenderProductRecord[]
  >([]);
  const [form, setForm] = useState<FormType>({
    loanPrograms: [],
    propertyTypes: {},
    businessTypes: {},
    loanCriteria: {},
    equipmentFinance: [],
  });

  const selectedProducts = useMemo(
    () => products.filter((p) => form.loanPrograms.includes(p.id)),
    [products, form.loanPrograms],
  );

  const lockedProgramIds = useMemo(
    () =>
      [
        ...new Set(
          existingLenderProducts.map((item) => getProgramId(item)).filter(Boolean),
        ),
      ],
    [existingLenderProducts],
  );

  const lenderProductByProgramId = useMemo(() => {
    const map: Record<string, LenderProductRecord> = {};
    existingLenderProducts.forEach((item) => {
      const programId = getProgramId(item);
      if (programId) {
        map[programId] = item;
      }
    });
    return map;
  }, [existingLenderProducts]);

  const newProgramIds = useMemo(
    () => form.loanPrograms.filter((id) => !lockedProgramIds.includes(id)),
    [form.loanPrograms, lockedProgramIds],
  );

  const isEquipmentSelected = selectedProducts.some(
    (p) => p.code === "EQUIPMENT_FINANCE",
  );

  const steps = [
    "Update Loan Programs",
    "Update Property Types",
    "Update Business Types",
    ...(isEquipmentSelected ? ["Update Equipment Types"] : []),
    "Update Loan Criteria",
  ];

  const loanCriteriaStepIndex = steps.length - 1;
  const isLastStep = step === steps.length - 1;

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

  const handleSubmit = async () => {
    const step5Error = validateStep5();

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
      let createdCount = 0;
      let updatedCount = 0;

      for (const product of selectedProducts) {
        const criteria = form.loanCriteria?.[product.id] || {};
        const existing = lenderProductByProgramId[product.id];

        const payload = {
          businessTypes: form.businessTypes,
          propertyTypes: form.propertyTypes,
          ...buildLenderProductCriteriaPayload(criteria, product.code),
          ...(product.code === "EQUIPMENT_FINANCE" &&
            form.equipmentFinance?.length && {
              equipmentTypes: form.equipmentFinance,
            }),
          isActive: true,
        };

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

          updatedCount += 1;
          continue;
        }

        const res = await fetch(`${API_BASE}/lender/loan-products/create`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            products: [
              {
                loanProductCode: product.code,
                ...payload,
              },
            ],
          }),
        });

        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            json?.message || `Failed to add ${product.name || product.code}`,
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

        createdCount += 1;
      }

      if (createdCount > 0 && updatedCount > 0) {
        toast.success(
          `Updated ${updatedCount} program(s) and added ${createdCount} new program(s)`,
        );
      } else if (createdCount > 0) {
        toast.success(
          createdCount === 1
            ? "New loan program added successfully"
            : `${createdCount} new loan programs added successfully`,
        );
      } else {
        toast.success(
          updatedCount === 1
            ? "Loan product updated successfully"
            : `${updatedCount} loan products updated successfully`,
        );
      }

      navigate("/all-loan-products");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to update loan products");
    } finally {
      setSubmitting(false);
    }
  };

  const getStepContent = () => {
    if (loadingExisting && step === 0) {
      return (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
          Loading your loan programs...
        </div>
      );
    }

    if (step === 0) {
      return (
        <StepTwo
          mode="lender"
          value={form.loanPrograms}
          setValue={(val) =>
            setForm((prev) => ({
              ...prev,
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
    (loadingExisting && step === 0) ||
    (!isLastStep && step === 0 && form.loanPrograms.length === 0) ||
    (step === loanCriteriaStepIndex && hasStep5Errors) ||
    (isLastStep && validateStep5() !== null) ||
    submitting;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoadingExisting(true);

        const res = await fetch(
          `${API_BASE}/lender/loan-products/list?limit=100`,
          {
            headers: getAuthHeaders(),
          },
        );

        const raw = await res.text();
        let json: Record<string, unknown> = {};

        try {
          json = raw ? JSON.parse(raw) : {};
        } catch {
          throw new Error(
            "Could not load your loan programs. Please refresh and try again.",
          );
        }

        if (!res.ok || !json.success) {
          throw new Error(
            (typeof json.message === "string" ? json.message : undefined) ||
              "Failed to load loan products",
          );
        }

        if (cancelled) return;

        const items = (json.data || []) as LenderProductRecord[];
        setExistingLenderProducts(items);

        const programIds = [
          ...new Set(items.map((item) => getProgramId(item)).filter(Boolean)),
        ];

        const loanCriteria: Record<string, any> = {};
        items.forEach((item) => {
          const programId = getProgramId(item);
          if (programId) {
            loanCriteria[programId] = mapApiProductToCriteriaForm(item);
          }
        });

        const seedProduct = updatedLoanProduct || items[0] || null;

        setForm({
          loanPrograms: programIds,
          propertyTypes: seedProduct?.propertyTypes || {},
          businessTypes: seedProduct?.businessTypes || {},
          equipmentFinance: seedProduct?.equipmentTypes || [],
          loanCriteria,
        });
      } catch (err: any) {
        if (!cancelled) {
          toast.error(err?.message || "Failed to load existing loan products");
        }
      } finally {
        if (!cancelled) {
          setLoadingExisting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [updatedLoanProduct]);

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

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-6">{getStepContent()}</div>
      </div>

      <div className="sticky bottom-0 z-30 bg-white/80 backdrop-blur border-t shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Step <span className="font-semibold text-gray-700">{step + 1}</span>{" "}
            of{" "}
            <span className="font-semibold text-gray-700">{steps.length}</span>
            {step === 0 && lockedProgramIds.length > 0 ? (
              <span className="ml-2 text-emerald-600">
                {lockedProgramIds.length} active
                {newProgramIds.length > 0
                  ? `, ${newProgramIds.length} new selected`
                  : ""}
              </span>
            ) : null}
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
