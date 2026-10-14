import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import StepTwo from "./StepTwo";
import StepFive from "./StepFive";
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
  mapToCanonicalCatalogId,
  resolveLenderOfferedProductCode,
} from "../../../lib/canonicalLoanProducts";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";

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

type LenderOption = {
  id: string;
  name: string;
  email: string;
};

type ExistingLenderProduct = {
  id: string;
  loanProductId?: string | null;
  loanProductCode?: string | null;
  code?: string | null;
  propertyTypes?: unknown;
  businessTypes?: unknown;
  equipmentTypes?: string[];
  documents?: any[];
  loanProduct?: { id?: string; code?: string } | null;
  [key: string]: any;
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
  const [lenders, setLenders] = useState<LenderOption[]>([]);
  const [selectedLenderInfo, setSelectedLenderInfo] =
    useState<LenderOption | null>(null);
  const [loadingLenders, setLoadingLenders] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 350);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [lenderTotal, setLenderTotal] = useState(0);
  const [lenderTotalPages, setLenderTotalPages] = useState(1);
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
              item.loanProductCode || item.code || item.loanProduct?.code,
              item.loanProductId || item.loanProduct?.id,
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
        item.loanProductId || item.loanProduct?.id,
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

  const steps = ["Select Lender", "Loan Programs", "Loan Criteria"];

  const loanCriteriaStepIndex = steps.length - 1;
  const isLastStep = step === steps.length - 1;
  const isUpdatingConfigured = selectedProducts.some((p) =>
    Boolean(lenderProductByProgramId[p.id]),
  );

  const validateStep5 = () =>
    validateLoanProductCriteriaStep(selectedProducts, form.loanCriteria);

  const handlePickProduct = (productId: string) => {
    const existing = lenderProductByProgramId[productId];
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
    } else if (productUsesEquipmentTypes(product?.code)) {
      equipmentFinance = [];
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

  const fetchLenders = useCallback(
    async (signal?: AbortSignal) => {
      setLoadingLenders(true);

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(pageSize),
        });
        if (debouncedSearch) params.set("search", debouncedSearch);

        const res = await fetch(
          `${API_BASE}/admin/lenders/read?${params.toString()}`,
          { headers: getAuthHeaders(), signal },
        );
        const json = await res.json();

        if (!res.ok || json?.success === false) {
          throw new Error(json?.message || "Failed to load lenders");
        }

        const list = json?.data?.results || [];
        setLenders(
          list.map((o: any) => ({
            id: o.id,
            name: o.organizationName || "",
            email: o.organizationEmail || "",
          })),
        );
        setLenderTotal(Number(json?.data?.total ?? list.length));
        setLenderTotalPages(
          Math.max(1, Number(json?.data?.totalPages) || 1),
        );
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error(err);
        toast.error("Failed to load lenders");
        setLenders([]);
        setLenderTotal(0);
        setLenderTotalPages(1);
      } finally {
        setLoadingLenders(false);
      }
    },
    [page, pageSize, debouncedSearch],
  );

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
      toast.error("Please select a loan program");
      return;
    }

    setSubmitting(true);

    try {
      const product = selectedProducts[0];
      const criteria = form.loanCriteria?.[product.id] || {};
      const existing = lenderProductByProgramId[product.id];
      const payload = mapToAdminProductPayload(
        product,
        form,
        criteria,
        existing?.id,
      );

      const res = await fetch(
        existing?.id
          ? `${API_BASE}/admin/lender-products/update`
          : `${API_BASE}/admin/lender-products/create`,
        {
          method: existing?.id ? "PATCH" : "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            lenderOrgId: form.lenderId,
            products: [payload],
          }),
        },
      );

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        throw new Error(
          json?.message ||
            (existing?.id
              ? "Failed to update loan product"
              : "Failed to assign products"),
        );
      }

      toast.success(
        existing?.id
          ? "Loan product updated successfully"
          : "Loan product assigned successfully",
      );
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
    if (step === 1 && form.loanPrograms.length === 1) {
      handlePickProduct(form.loanPrograms[0]);
      return;
    }
    setStep((prev) => prev + 1);
  };

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    const controller = new AbortController();
    fetchLenders(controller.signal);
    return () => controller.abort();
  }, [fetchLenders]);

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

  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    if (lenderTotalPages <= 7) {
      for (let i = 1; i <= lenderTotalPages; i += 1) pages.push(i);
      return pages;
    }
    pages.push(1);
    if (page > 3) pages.push("ellipsis");
    const start = Math.max(2, page - 1);
    const end = Math.min(lenderTotalPages - 1, page + 1);
    for (let i = start; i <= end; i += 1) pages.push(i);
    if (page < lenderTotalPages - 2) pages.push("ellipsis");
    pages.push(lenderTotalPages);
    return pages;
  };

  const selectLender = (lender: LenderOption) => {
    setSelectedLenderInfo(lender);
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
    );
  };

  const getStepContent = () => {
    if (step === 0) {
      const selectedLender =
        selectedLenderInfo?.id === form.lenderId
          ? selectedLenderInfo
          : lenders.find((l) => l.id === form.lenderId) || selectedLenderInfo;
      const showingFrom =
        lenderTotal === 0 ? 0 : (page - 1) * pageSize + 1;
      const showingTo = Math.min(page * pageSize, lenderTotal);

      return (
        <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
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

          {selectedLender && form.lenderId ? (
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
          ) : null}

          {loadingLenders && lenders.length === 0 ? (
            <div className="py-14 text-center text-sm text-gray-400">
              Loading lenders...
            </div>
          ) : lenders.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {lenders.map((lender) => {
                  const selected = form.lenderId === lender.id;
                  return (
                    <div
                      key={lender.id}
                      onClick={() => selectLender(lender)}
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

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-gray-500">
                  {loadingLenders
                    ? "Loading..."
                    : `Showing ${showingFrom}–${showingTo} of ${lenderTotal}`}
                </p>
                {lenderTotalPages > 1 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1 || loadingLenders}
                      className="px-2 py-1 border rounded text-xs disabled:opacity-40"
                    >
                      Prev
                    </button>
                    {getPageNumbers().map((p, index) =>
                      p === "ellipsis" ? (
                        <span
                          key={`ellipsis-${index}`}
                          className="px-1 text-xs text-gray-400"
                        >
                          …
                        </span>
                      ) : (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPage(p)}
                          disabled={loadingLenders}
                          className={`px-2 py-1 text-xs rounded ${
                            page === p ? "bg-black text-white" : "border"
                          }`}
                        >
                          {p}
                        </button>
                      ),
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setPage((p) => Math.min(lenderTotalPages, p + 1))
                      }
                      disabled={page === lenderTotalPages || loadingLenders}
                      className="px-2 py-1 border rounded text-xs disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <p className="text-sm font-semibold text-gray-700">
                No lenders found
              </p>
              <p className="text-xs text-gray-500 mt-1 max-w-xs">
                {debouncedSearch
                  ? `No lenders match “${debouncedSearch}”.`
                  : "We couldn’t find any lenders."}
              </p>
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
              loanPrograms: Array.isArray(val) ? val.slice(0, 1) : [],
            }))
          }
          alreadyAddedIds={alreadyAssignedIds}
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
          lenderProductIdByProgramId={Object.fromEntries(
            Object.entries(lenderProductByProgramId).map(
              ([programId, record]) => [programId, record.id],
            ),
          )}
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
                    {selectedLenderInfo?.name
                      ? ` · ${selectedLenderInfo.name}`
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
                    {selectedLenderInfo?.name && step > 0
                      ? ` · ${selectedLenderInfo.name}`
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
            {isLastStep && footerValidationMessage && (
              <p className="mt-1 max-w-xl text-sm text-red-600">
                {footerValidationMessage}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={step === 0 || submitting}
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
