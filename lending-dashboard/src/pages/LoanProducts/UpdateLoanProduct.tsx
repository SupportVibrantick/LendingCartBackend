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
  mapApiProductToCriteriaForm,
} from "../../lib/loanProductCriteriaFields";

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

export default function UpdateLoanProduct() {
  const navigate = useNavigate();
  const location = useLocation();
  const updatedLoanProduct = location.state?.loanProduct;
  // const productId = updatedLoanProduct?.id;
  const [step, setStep] = useState(0);
  const [hasStep5Errors, setHasStep5Errors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
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

      // if (!data.documents || data.documents.length === 0) {
      //   return `${product.name}: Select at least one required document`;
      // }
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

    if (!updatedLoanProduct?.id) {
      toast.error("Invalid loan product");
      return;
    }

    setSubmitting(true);

    try {
      const headers = getAuthHeaders();

      const product = selectedProducts[0];

      const criteria = form.loanCriteria?.[product.id] || {};

      /**
       * MAIN LOAN PRODUCT PAYLOAD
       */
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

      /**
       * UPDATE LOAN PRODUCT
       */
      const res = await fetch(
        `${API_BASE}/lender/loan-products/update/${updatedLoanProduct.id}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify(payload),
        },
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.message || "Update failed");
      }

      /**
       * DOCUMENT CONFIG HANDLING
       */
      const selectedDocuments = criteria.documents || [];

      const existingDocuments = updatedLoanProduct.documents || [];

      /**
       * DELETE REMOVED DOCUMENTS
       */
      for (const existingDoc of existingDocuments) {
        const stillSelected = selectedDocuments.some(
          (d: any) =>
            d.id === existingDoc.documentTypeId ||
            d.documentTypeId === existingDoc.documentTypeId,
        );

        /**
         * REMOVE DOCUMENT
         */
        if (!stillSelected) {
          try {
            const deleteRes = await fetch(
              `${API_BASE}/lender/document-config/delete/${existingDoc.id}`,
              {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${sessionStorage.getItem(
                    "lender_token",
                  )}`,
                },
              },
            );

            const deleteJson = await deleteRes.json().catch(() => ({}));

            if (!deleteRes.ok) {
              console.error("Document delete failed", deleteJson);
            }
          } catch (err) {
            console.error("Delete document config failed", err);
          }
        }
      }

      /**
       * UPDATE / CREATE DOCUMENTS
       */
      for (const doc of selectedDocuments) {
        const existingDoc = existingDocuments.find(
          (d: any) =>
            d.documentTypeId === doc.id ||
            d.documentTypeId === doc.documentTypeId,
        );

        /**
         * UPDATE EXISTING
         */
        if (existingDoc?.id) {
          const updatePayload = {
            lenderProductId: updatedLoanProduct.id,
            documentTypeId: doc.documentTypeId || doc.id,
          };

          const updateRes = await fetch(
            `${API_BASE}/lender/document-config/update/${existingDoc.id}`,
            {
              method: "PUT",
              headers: getAuthHeaders(),
              body: JSON.stringify(updatePayload),
            },
          );

          const updateJson = await updateRes.json().catch(() => ({}));

          if (!updateRes.ok) {
            console.error("Document update failed", updateJson);
          }
        } else {
          /**
           * CREATE NEW
           */
          const createPayload = {
            lenderProductId: updatedLoanProduct.id,

            documentTypeId: doc.documentTypeId || doc.id,
          };

          const createRes = await fetch(
            `${API_BASE}/lender/document-config/create`,
            {
              method: "POST",
              headers: getAuthHeaders(),
              body: JSON.stringify(createPayload),
            },
          );

          const createJson = await createRes.json().catch(() => ({}));

          if (!createRes.ok) {
            console.error("Document create failed", createJson);
          }
        }
      }

      toast.success("Loan product updated successfully");

      navigate("/all-loan-products");
    } catch (err: any) {
      console.error(err);

      toast.error(err?.message || "Failed to update loan product");
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
            setForm((prev) => ({ ...prev, loanPrograms: val }))
          }
          onProductsLoad={(data) => {
            setProducts(data);

            // ensure selected product stays selected
            if (updatedLoanProduct) {
              setForm((prev) => ({
                ...prev,
                loanPrograms: [updatedLoanProduct.loanProductId],
              }));
            }
          }}
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
    (step === loanCriteriaStepIndex && hasStep5Errors) ||
    (isLastStep && validateStep5() !== null) ||
    submitting;

  useEffect(() => {
    if (!updatedLoanProduct) return;

    setForm({
      loanPrograms: [updatedLoanProduct.loanProductId],

      propertyTypes: updatedLoanProduct.propertyTypes || {},

      businessTypes: updatedLoanProduct.businessTypes || {},

      equipmentFinance: updatedLoanProduct.equipmentTypes || [],

loanCriteria: {
  [updatedLoanProduct.loanProductId]: mapApiProductToCriteriaForm(
    updatedLoanProduct,
  ),
},
    });
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
