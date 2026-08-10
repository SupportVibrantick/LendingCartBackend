import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
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
  mergeGroupedSelections,
  normalizeGroupedSelectionFromApi,
} from "../../lib/lenderProductLenderPayload";
import {
  buildLoanCriteriaFromLenderProducts,
  filterLenderCatalogProducts,
  mapToCanonicalCatalogId,
  mergeCriteriaForms,
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

async function fetchAllLenderProducts(
  headers: Record<string, string>,
): Promise<LenderProductRecord[]> {
  const allItems: LenderProductRecord[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const res = await fetch(
      `${API_BASE}/lender/loan-products/list?page=${page}&limit=100`,
      { headers },
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

    allItems.push(...((json.data || []) as LenderProductRecord[]));
    totalPages = Number((json.meta as { totalPages?: number })?.totalPages) || 1;
    page += 1;
  } while (page <= totalPages);

  return allItems;
}

async function fetchLenderProductById(
  id: string,
  headers: Record<string, string>,
): Promise<LenderProductRecord | null> {
  const res = await fetch(`${API_BASE}/lender/loan-products/${id}`, {
    headers,
  });

  if (!res.ok) {
    return null;
  }

  const json = await res.json().catch(() => ({}));
  return json?.data ? (json.data as LenderProductRecord) : null;
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
  isActive: boolean;
};

export default function UpdateLoanProduct() {
  const navigate = useNavigate();
  const location = useLocation();
  const updatedLoanProduct = location.state?.loanProduct;
  const isSingleProductUpdate = Boolean(updatedLoanProduct?.id);
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
    () =>
      products.filter((p) =>
        form.loanPrograms.includes(String(p.id)),
      ),
    [products, form.loanPrograms],
  );

  const lockedProgramIds = useMemo(() => {
    if (isSingleProductUpdate && updatedLoanProduct) {
      const focusedProgramId = mapToCanonicalCatalogId(
        products,
        updatedLoanProduct.loanProductCode || updatedLoanProduct.code,
        getProgramId(updatedLoanProduct as LenderProductRecord),
      );
      return focusedProgramId ? [focusedProgramId] : [];
    }

    return [
      ...new Set(
        existingLenderProducts
          .map((item) =>
            mapToCanonicalCatalogId(
              products,
              item.loanProductCode || item.code,
              getProgramId(item),
            ),
          )
          .filter(Boolean),
      ),
    ] as string[];
  }, [
    existingLenderProducts,
    isSingleProductUpdate,
    products,
    updatedLoanProduct,
  ]);

  const lenderProductByProgramId = useMemo(() => {
    const map: Record<string, LenderProductRecord> = {};
    existingLenderProducts.forEach((item) => {
      const programId = mapToCanonicalCatalogId(
        products,
        item.loanProductCode || item.code,
        getProgramId(item),
      );
      if (programId) {
        map[programId] = item;
      }
    });
    return map;
  }, [existingLenderProducts, products]);

  const newProgramIds = useMemo(
    () => form.loanPrograms.filter((id) => !lockedProgramIds.includes(id)),
    [form.loanPrograms, lockedProgramIds],
  );

  const steps = ["Update Loan Programs", "Update Loan Criteria"];

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
      let createdCount = 0;
      let updatedCount = 0;

      for (const product of selectedProducts) {
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

          updatedCount += 1;
          continue;
        }

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
          setValue={(val) => {
            if (isSingleProductUpdate) return;

            setForm((prev) => ({
              ...prev,
              loanPrograms: [
                ...new Set([
                  ...lockedProgramIds,
                  ...(Array.isArray(val) ? val : []),
                ]),
              ],
            }));
          }}
          lockedIds={lockedProgramIds}
          restrictToProductIds={
            isSingleProductUpdate ? lockedProgramIds : undefined
          }
          singleProductMode={isSingleProductUpdate}
          prefetchedProducts={isSingleProductUpdate ? products : undefined}
          onProductsLoad={setProducts}
        />
      );
    }

    if (step === loanCriteriaStepIndex) {
      if (loadingExisting) {
        return (
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
            Loading loan criteria...
          </div>
        );
      }

      return (
        <StepFive
          key={`update-criteria-${form.loanPrograms.join("-")}`}
          mode="update"
          products={selectedProducts}
          lenderProductIdByProgramId={Object.fromEntries(
            Object.entries(lenderProductByProgramId).map(([programId, record]) => [
              programId,
              record.id,
            ]),
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
    loadingExisting ||
    (!isLastStep && step === 0 && form.loanPrograms.length === 0) ||
    (step === loanCriteriaStepIndex &&
      (hasStep5Errors || footerValidationMessage !== null)) ||
    submitting;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoadingExisting(true);

        const headers = getAuthHeaders();

        const catalogRes = await fetch(
          `${API_BASE}/common/loan-products/loan-product-code`,
          { headers },
        );

        let items: LenderProductRecord[] = [];

        if (isSingleProductUpdate && updatedLoanProduct?.id) {
          const freshProduct = await fetchLenderProductById(
            String(updatedLoanProduct.id),
            headers,
          );

          items = freshProduct
            ? [freshProduct]
            : [updatedLoanProduct as LenderProductRecord];
        } else {
          items = await fetchAllLenderProducts(headers);

          if (updatedLoanProduct?.id) {
            const freshProduct = await fetchLenderProductById(
              String(updatedLoanProduct.id),
              headers,
            );

            if (freshProduct) {
              items = items.some((item) => item.id === freshProduct.id)
                ? items.map((item) =>
                    item.id === freshProduct.id ? freshProduct : item,
                  )
                : [...items, freshProduct];
            }
          }
        }

        const catalogJson = await catalogRes.json().catch(() => ({}));
        const catalogProducts: Product[] = filterLenderCatalogProducts(
          ((catalogJson.data || []) as Array<{
            id: string | number;
            code: string;
            name: string;
          }>).map((item) => ({
            id: String(item.id),
            code: item.code,
            name: item.name,
            isActive: true,
          })),
        );

        if (cancelled) return;

        const focusedProgramId = updatedLoanProduct
          ? mapToCanonicalCatalogId(
              catalogProducts,
              updatedLoanProduct.loanProductCode || updatedLoanProduct.code,
              getProgramId(updatedLoanProduct as LenderProductRecord),
            )
          : null;

        setExistingLenderProducts(items);
        setProducts(
          isSingleProductUpdate && focusedProgramId
            ? catalogProducts.filter((item) => item.id === focusedProgramId)
            : catalogProducts,
        );

        const programIds = isSingleProductUpdate && focusedProgramId
          ? [focusedProgramId]
          : ([
              ...new Set(
                items
                  .map((item) =>
                    mapToCanonicalCatalogId(
                      catalogProducts,
                      item.loanProductCode || item.code,
                      getProgramId(item),
                    ),
                  )
                  .filter(Boolean)
                  .map(String),
              ),
            ] as string[]);

        let loanCriteria: Record<string, any> = {};
        let propertyTypes: Record<string, string[]> = {};
        let businessTypes: Record<string, string[]> = {};
        let equipmentFinance: string[] = [];

        if (isSingleProductUpdate && focusedProgramId) {
          const focusedRecord = normalizeLenderProductRecord(
            items.find((item) => item.id === updatedLoanProduct.id) ||
              updatedLoanProduct,
          );
          const focusedCode = resolveLenderOfferedProductCode(
            focusedRecord.loanProductCode ||
              focusedRecord.code ||
              updatedLoanProduct.loanProduct?.code ||
              "",
          );

          loanCriteria[String(focusedProgramId)] = mapApiProductToCriteriaForm({
            ...focusedRecord,
            loanProductCode: focusedCode,
            code: focusedCode,
          });

          propertyTypes = normalizeGroupedSelectionFromApi(
            focusedRecord.propertyTypes,
            "type",
          );
          businessTypes = normalizeGroupedSelectionFromApi(
            focusedRecord.businessTypes,
            "name",
          );

          if (productUsesEquipmentTypes(focusedCode)) {
            equipmentFinance = Array.isArray(focusedRecord.equipmentTypes)
              ? focusedRecord.equipmentTypes
              : [];
          }
        } else {
          loanCriteria = buildLoanCriteriaFromLenderProducts(
            items,
            catalogProducts,
            mapApiProductToCriteriaForm,
          );

          if (updatedLoanProduct && focusedProgramId) {
            const focusedCode = resolveLenderOfferedProductCode(
              updatedLoanProduct.loanProductCode ||
                updatedLoanProduct.code ||
                updatedLoanProduct.loanProduct?.code ||
                "",
            );

            const focusedRecord = normalizeLenderProductRecord(
              items.find((item) => item.id === updatedLoanProduct.id) ||
                updatedLoanProduct,
            );

            const focusedCriteria = mapApiProductToCriteriaForm({
              ...focusedRecord,
              loanProductCode: focusedCode,
              code: focusedCode,
            });

            loanCriteria[String(focusedProgramId)] = mergeCriteriaForms(
              loanCriteria[String(focusedProgramId)] || {},
              focusedCriteria,
            );
          }

          items.forEach((item) => {
            const programId = mapToCanonicalCatalogId(
              catalogProducts,
              item.loanProductCode || item.code,
              getProgramId(item),
            );
            if (!programId) return;

            propertyTypes = mergeGroupedSelections(
              propertyTypes,
              normalizeGroupedSelectionFromApi(item.propertyTypes, "type"),
            );

            businessTypes = mergeGroupedSelections(
              businessTypes,
              normalizeGroupedSelectionFromApi(item.businessTypes, "name"),
            );

            const canonicalCode = resolveLenderOfferedProductCode(
              item.loanProductCode || item.code || "",
            );

            if (productUsesEquipmentTypes(canonicalCode)) {
              equipmentFinance = Array.isArray(item.equipmentTypes)
                ? item.equipmentTypes
                : [];
            }
          });
        }

        const seedProduct = updatedLoanProduct || items[0] || null;

        setForm({
          loanPrograms: programIds,
          propertyTypes: Object.keys(propertyTypes).length
            ? propertyTypes
            : seedProduct?.propertyTypes || {},
          businessTypes: Object.keys(businessTypes).length
            ? businessTypes
            : seedProduct?.businessTypes || {},
          equipmentFinance: equipmentFinance.length
            ? equipmentFinance
            : seedProduct?.equipmentTypes || [],
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
  }, [isSingleProductUpdate, updatedLoanProduct]);

  useEffect(() => {
    if (!products.length || loadingExisting) return;

    setForm((prev) => {
      let changed = false;
      const nextCriteria = { ...prev.loanCriteria };

      prev.loanPrograms.forEach((programId) => {
        const key = String(programId);
        if (nextCriteria[key]) return;

        nextCriteria[key] = {
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
  }, [form.loanPrograms, products, loadingExisting]);

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
              {selectedProducts.length > 0 ? (
                <>
                  <h1 className="text-lg font-semibold leading-tight truncate">
                    {selectedProducts.length === 1
                      ? selectedProducts[0].name
                      : `${selectedProducts[0].name} +${selectedProducts.length - 1} more`}
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

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-screen-2xl mx-auto p-6">{getStepContent()}</div>
      </div>

      <div className="sticky bottom-0 z-30 bg-white/80 backdrop-blur border-t shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
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
