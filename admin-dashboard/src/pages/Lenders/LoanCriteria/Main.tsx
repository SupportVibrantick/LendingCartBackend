import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import StepTwo from "./StepTwo";
import StepFive from "./StepFive";
import EquipmentFinancingStep from "./EquipmentFinancingStep";
import { ChevronRight, ChevronLeft, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import {
  getLoanCriteriaFooterMessage,
  validateLoanProductCriteriaStep,
} from "../../../lib/loanProductCriteriaFields";
import { mapToAdminProductPayload } from "../../../lib/lenderProductAdminPayload";
import { mapToCanonicalCatalogId } from "../../../lib/canonicalLoanProducts";

type FormType = {
  lenderId: string;
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
  loanProductId?: string | null;
  loanProductCode?: string | null;
  loanProduct?: { id?: string; code?: string } | null;
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
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [existingLenderProducts, setExistingLenderProducts] = useState<
    ExistingLenderProduct[]
  >([]);
  const [lenders, setLenders] = useState<any[]>([]);
  const [loadingLenders, setLoadingLenders] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [hasStep5Errors, setHasStep5Errors] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<FormType>({
    lenderId: "",
    loanPrograms: [],
    propertyTypes: {},
    businessTypes: {},
    loanCriteria: {},
    equipmentFinance: [],
  });

  const alreadyAssignedIds = useMemo(() => {
    if (!products.length || !existingLenderProducts.length) return [];

    return [
      ...new Set(
        existingLenderProducts
          .map((item) =>
            mapToCanonicalCatalogId(
              products,
              item.loanProductCode || item.loanProduct?.code,
              item.loanProductId || item.loanProduct?.id,
            ),
          )
          .filter(Boolean),
      ),
    ] as string[];
  }, [products, existingLenderProducts]);

  useEffect(() => {
    if (!alreadyAssignedIds.length) return;
    setForm((prev) => {
      const filtered = prev.loanPrograms.filter(
        (id) => !alreadyAssignedIds.includes(id),
      );
      if (filtered.length === prev.loanPrograms.length) return prev;
      return { ...prev, loanPrograms: filtered };
    });
  }, [alreadyAssignedIds]);

  const selectedProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          form.loanPrograms.includes(p.id) &&
          !alreadyAssignedIds.includes(p.id),
      ),
    [products, form.loanPrograms, alreadyAssignedIds],
  );

  const isEquipmentSelected = selectedProducts.some(
    (p) => p.code === "EQUIPMENT_FINANCE",
  );

  const steps = [
    "Select Lender",
    "Loan Programs",
    ...(isEquipmentSelected ? ["Equipment Types"] : []),
    "Loan Criteria",
  ];

  const loanCriteriaStepIndex = steps.length - 1;
  const isLastStep = step === steps.length - 1;

  const validateStep5 = () =>
    validateLoanProductCriteriaStep(selectedProducts, form.loanCriteria);

  const fetchLenders = async (searchValue?: string) => {
    setLoadingLenders(true);

    try {
      const url = searchValue
        ? `${API_BASE}/admin/lenders/read?search=${encodeURIComponent(searchValue)}`
        : `${API_BASE}/admin/lenders/read`;

      const res = await fetch(url, { headers: getAuthHeaders() });
      const json = await res.json();
      const list = json?.data?.results || [];

      setLenders(
        list.map((o: any) => ({
          id: o.id,
          name: o.organizationName,
          email: o.organizationEmail,
        })),
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLenders(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.lenderId) {
      toast.error("Please select a lender");
      return;
    }

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
      const mappedProducts = selectedProducts.map((product) =>
        mapToAdminProductPayload(
          product,
          form,
          form.loanCriteria?.[product.id] || {},
        ),
      );

      const res = await fetch(`${API_BASE}/admin/lender-products/create`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          lenderOrgId: form.lenderId,
          products: mappedProducts,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        throw new Error(json?.message || "Failed to assign products");
      }

      toast.success("Loan products assigned successfully");
      navigate("/view-assigned-products");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to assign products");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (isLastStep) {
      handleSubmit();
      return;
    }
    setStep((prev) => prev + 1);
  };

  useEffect(() => {
    fetchLenders();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (!isEquipmentSelected) {
      setForm((p) => ({ ...p, equipmentFinance: [] }));
    }
  }, [isEquipmentSelected]);

  useEffect(() => {
    if (!form.lenderId) {
      setExistingLenderProducts([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/admin/lender-products/lender/${form.lenderId}`,
          { headers: getAuthHeaders() },
        );
        const json = await res.json().catch(() => ({}));

        if (!res.ok || !json.success) {
          throw new Error(json.message || "Failed to load assigned products");
        }

        if (!cancelled) {
          setExistingLenderProducts(
            (json.data || []) as ExistingLenderProduct[],
          );
        }
      } catch (err: any) {
        console.error(err);
        if (!cancelled) {
          setExistingLenderProducts([]);
          toast.error(err?.message || "Failed to load assigned products");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [form.lenderId]);

  const getStepContent = () => {
    if (step === 0) {
      const filtered = lenders.filter((l) =>
        l.name.toLowerCase().includes(search.toLowerCase()),
      );
      const totalPages = Math.ceil(filtered.length / pageSize) || 1;
      const paginatedData = filtered.slice(
        (page - 1) * pageSize,
        page * pageSize,
      );
      const selectedLender = lenders.find((l) => l.id === form.lenderId);

      return (
        <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-semibold">Select Lender</h2>
              <p className="text-sm text-gray-500">
                Choose a lender to assign loan products
              </p>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lender..."
              className="border rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {selectedLender && (
            <div className="mb-6 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl px-4 py-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-semibold">
                  {selectedLender.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-700">
                    {selectedLender.name}
                  </p>
                  <p className="text-xs text-blue-500">{selectedLender.email}</p>
                </div>
              </div>
              <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded-full">
                Selected
              </span>
            </div>
          )}

          {filtered.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {paginatedData.map((lender) => {
                  const selected = form.lenderId === lender.id;
                  return (
                    <div
                      key={lender.id}
                      onClick={() =>
                        setForm((p) =>
                          p.lenderId === lender.id
                            ? p
                            : {
                                lenderId: lender.id,
                                loanPrograms: [],
                                propertyTypes: {},
                                businessTypes: {},
                                loanCriteria: {},
                                equipmentFinance: [],
                              },
                        )
                      }
                      className={`relative cursor-pointer rounded-lg border px-3 py-2.5 transition-all
                        ${
                          selected
                            ? "border-blue-500 bg-blue-50 shadow scale-[1.02]"
                            : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                        }`}
                    >
                      {selected && (
                        <div className="absolute top-1 right-2 text-blue-600 text-[10px] font-bold">
                          ✓
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 text-white flex items-center justify-center text-[10px] font-semibold">
                          {lender.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">
                            {lender.name}
                          </p>
                          <p className="text-[10px] text-gray-500 truncate">
                            {lender.email}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <p className="text-xs text-gray-500">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => p - 1)}
                      disabled={page === 1}
                      className="px-2 py-1 border rounded text-xs disabled:opacity-40"
                    >
                      Prev
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (p) => (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`px-2 py-1 text-xs rounded ${
                            page === p ? "bg-black text-white" : "border"
                          }`}
                        >
                          {p}
                        </button>
                      ),
                    )}
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page === totalPages}
                      className="px-2 py-1 border rounded text-xs disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <p className="text-sm font-semibold text-gray-700">
                No lenders found
              </p>
              <p className="text-xs text-gray-500 mt-1 max-w-xs">
                We couldn&apos;t find any lenders matching your search.
              </p>
            </div>
          )}

          {loadingLenders && (
            <div className="text-center text-sm text-gray-400 mt-4">
              Loading lenders...
            </div>
          )}
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
              loanPrograms: (Array.isArray(val) ? val : []).filter(
                (id) => !alreadyAssignedIds.includes(id),
              ),
            }))
          }
          alreadyAddedIds={alreadyAssignedIds}
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

  const footerValidationMessage =
    step === loanCriteriaStepIndex
      ? getLoanCriteriaFooterMessage(
          selectedProducts,
          form.loanCriteria,
          hasStep5Errors,
        )
      : null;

  const nextDisabled =
    submitting ||
    (step === 0 && !form.lenderId) ||
    (step === 1 && form.loanPrograms.length === 0) ||
    (step === loanCriteriaStepIndex &&
      (hasStep5Errors || footerValidationMessage !== null));

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
            {isLastStep && footerValidationMessage && (
              <p className="mt-1 max-w-xl text-sm text-red-600">
                {footerValidationMessage}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              disabled={step === 0 || submitting}
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
