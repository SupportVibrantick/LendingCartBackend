import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { MdModeEdit, MdOutlineRemoveRedEye } from "react-icons/md";
import { TiPlus } from "react-icons/ti";
import { BsThreeDotsVertical } from "react-icons/bs";
import toast from "react-hot-toast";
import EditLoanProductModal from "./EditLoanProductModal";
import { buildLenderProductCriteriaPayload, mapApiProductToCriteriaForm } from "../../lib/loanProductCriteriaFields";
import { resolveLenderOfferedProductCode } from "../../lib/lenderLoanProducts";
import {
  buildLoanProductDetailFields,
  formatListKeyCriteria,
  formatLoanProductCode,
  formatLoanProductName,
  formatPercentValue,
} from "../../lib/loanProductListDisplay";
import { canManageLoanProducts } from "../../lib/lenderPermissions";

type LoanProductList = {
  id: string;
  lenderOrgId: string;
  loanProductId: string;
  loanProductCode?: string;
  loanProduct?: {
    id?: string;
    name?: string;
    code?: string;
  };
  loanProductName: string;
  minLoanAmount: number | null;
  maxLoanAmount: number | null;
  minTermMonths: number | null;
  maxTermMonths: number | null;
  maxLtvPercent?: number | null;
  minMezzLtvPercent?: number | null;
  maxMezzLtvPercent?: number | null;
  exitFeePercent?: number | null;
  preferredReturnPercent?: number | null;
  maxRateSpreadPercent?: number | null;
  avgTurnaroundDays?: number | null;
  preferredLenderPlp?: boolean | null;
  maxArvPercent?: number | null;
  maxLtcPercent?: number | null;
  minCreditScore?: number | null;
  minExperience?: string | null;
  minDscr?: number | null;
  minDebtYieldPercent?: number | null;
  amortizationYears?: number | null;
  minUnits?: number | null;
  prepaymentStructure?: string | null;
  minPropertiesInPortfolio?: number | null;
  maxPropertiesInPortfolio?: number | null;
  originationPointsPercent?: number | null;
  interestOnlyAvailable?: boolean | null;
  shortTermRentalsOk?: boolean | null;
  foreignNationalsAllowed?: boolean | null;
  gcRequired?: boolean | null;
  completionGuaranteeRequired?: boolean | null;
  criteriaNotes?: string | null;
  interestRateRange?: string | null;
  advanceRatePercent?: number | null;
  transactionFeePercent?: number | null;
  minGrossMarginPercent?: number | null;
  internationalPosAllowed?: boolean | null;
  discountFeePercent?: number | null;
  maxInvoiceAgeDays?: number | null;
  nonRecourseAvailable?: boolean | null;
  governmentInvoicesOk?: boolean | null;
  earlyPaymentDiscountPercent?: number | null;
  paymentTermsExtensionDays?: number | null;
  dynamicDiscountingAvailable?: boolean | null;
  reverseFactoringAvailable?: boolean | null;
  usedEquipmentAllowed?: boolean | null;
  saleLeasebackAvailable?: boolean | null;
  requiredInjectionPercent?: number | null;
  goodwillFinancingAllowed?: boolean | null;
  sellerFinancingAllowed?: boolean | null;
  minTimeInBusinessMonths?: number | null;
  lineOfCreditAvailable?: boolean | null;
  ownerOccupiedRequired?: boolean | null;
  maxTotalProjectAmount?: number | null;
  maxSba504DebentureAmount?: number | null;
  jobCreationRequired?: boolean | null;
  maxUsdaGuaranteeAmount?: number | null;
  usdaGuaranteePercent?: number | null;
  ruralAreaRequired?: boolean | null;
  statesSupported?: string[];
  documents?: Array<{
    id: string;
    documentTypeId?: string;
    documentName?: string | null;
  }>;
  businessTypes?: Record<string, string[]> | Array<any> | null;
  propertyTypes?: Record<string, string[]> | Array<any> | null;
  equipmentTypes?: string[];
  industriesSupported: string[];
  regionsSupported: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const safeParseArray = (value: any): string[] => {
  if (Array.isArray(value)) return value;

  if (typeof value !== "string") return [];

  try {
    let parsed = JSON.parse(value);

    if (typeof parsed === "string") {
      parsed = JSON.parse(parsed);
    }

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const safeGroupedEntries = (
  value: unknown,
  keyField?: "name" | "type",
): Array<[string, string[]]> => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!item || typeof item !== "object") return null;

        const label =
          typeof item[keyField || "name"] === "string"
            ? item[keyField || "name"]
            : typeof item.name === "string"
              ? item.name
              : typeof item.type === "string"
                ? item.type
                : "";

        const list = Array.isArray(item.subTypes)
          ? item.subTypes.filter(
              (subType: unknown): subType is string =>
                typeof subType === "string" && subType.trim().length > 0,
            )
          : [];

        return label ? ([label, list] as [string, string[]]) : null;
      })
      .filter(Boolean) as Array<[string, string[]]>;
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(
      ([key, list]) => [
        key,
        Array.isArray(list)
          ? list.filter((item): item is string => typeof item === "string")
          : [],
      ],
    );
  }

  return [];
};

function statusClass(status?: string) {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/40";
    case "INACTIVE":
      return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-300 dark:border-yellow-500/40";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-slate-600/30 dark:text-slate-100 dark:border-slate-500";
  }
}

export default function AlloanProducts() {
  const navigate = useNavigate();
  const canManageProducts = canManageLoanProducts();
  const [lenders, setLenders] = useState<LoanProductList[]>([]);
  const [loading, setLoading] = useState(false);
  const [rowLoadingId, setRowLoadingId] = useState<string | null>(null);
  const [editingLender, setEditingLender] = useState<LoanProductList | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [viewDetails, setViewDetails] = useState<any | null>(null);

  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

  useEffect(() => {
    const controller = new AbortController();

    fetchLoanProducts(controller.signal);

    return () => {
      controller.abort();
    };
  }, [currentPage, pageSize, debouncedQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedQuery, pageSize]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

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

  async function fetchLoanProducts(signal?: AbortSignal) {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(
        `${API_BASE}/lender/loan-products/list?page=${currentPage}&limit=${pageSize}&search=${encodeURIComponent(debouncedQuery)}`,
        {
          method: "GET",
          headers,
          signal,
        },
      );

      if (!res.ok) {
        throw new Error(`Failed to fetch loan products: ${res.status}`);
      }

      const json = await res.json();
      const list = Array.isArray(json.data) ? json.data : [];

      setPagination({
        page: json.meta?.page || 1,
        limit: json.meta?.limit || 10,
        total: json.meta?.total || 0,
        totalPages: json.meta?.totalPages || 1,
      });
      const normalized = (list as LoanProductList[]).map((product: any) => ({
        ...product,

        // âœ… PRODUCT DETAILS
        loanProductName: product.loanProduct?.name || product.name || "-",

        loanProductCode:
          product.loanProductCode ||
          product.loanProduct?.code ||
          product.code ||
          "-",

        advanceRatePercent: formatPercentValue(product.advanceRatePercent),
        transactionFeePercent: formatPercentValue(product.transactionFeePercent),
        minGrossMarginPercent: formatPercentValue(product.minGrossMarginPercent),
        discountFeePercent: formatPercentValue(product.discountFeePercent),
        earlyPaymentDiscountPercent: formatPercentValue(
          product.earlyPaymentDiscountPercent,
        ),

        // âœ… STATES
        statesSupported: Array.isArray(product.statesSupported)
          ? product.statesSupported
          : [],

        // âœ… DOCUMENTS
        documents: Array.isArray(product.documents) ? product.documents : [],

        // âœ… BUSINESS / PROPERTY TYPES
        businessTypes:
          typeof product.businessTypes === "object"
            ? product.businessTypes
            : {},

        propertyTypes:
          typeof product.propertyTypes === "object"
            ? product.propertyTypes
            : {},

        // âœ… NEW FIELDS
        maxArvPercent: product.maxArvPercent ?? null,
        maxLtcPercent: product.maxLtcPercent ?? null,
        maxLtvPercent: product.maxLtvPercent ?? null,
        minMezzLtvPercent: product.minMezzLtvPercent ?? null,
        maxMezzLtvPercent: product.maxMezzLtvPercent ?? null,

        minExperience: product.minExperience ?? "",

        // OLD SAFE PARSE
        industriesSupported: safeParseArray(product.industriesSupported),

        regionsSupported: safeParseArray(product.regionsSupported),
      }));

      setLenders(normalized);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function gotoPage(page: number) {
    if (page < 1) page = 1;
    if (page > pagination.totalPages) page = pagination.totalPages;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const handleEditSave = async (updated: LoanProductList) => {
    const normalizedUpdated = {
      ...updated,
      regionsSupported: safeParseArray(updated.regionsSupported),
      industriesSupported: safeParseArray(updated.industriesSupported),
    };

    setLenders((prev) =>
      prev.map((item) => (item.id === updated.id ? normalizedUpdated : item)),
    );
    setEditingLender(null);

    try {
      const token = sessionStorage.getItem("lender_token");
      const productCode = resolveLenderOfferedProductCode(
        updated.loanProductCode ||
          updated.loanProduct?.code ||
          "",
      );

      const criteriaForm = mapApiProductToCriteriaForm({
        ...updated,
        loanProductCode: productCode,
        code: productCode,
      });

      criteriaForm.minLoan = String(updated.minLoanAmount ?? criteriaForm.minLoan ?? "");
      criteriaForm.maxLoan = String(updated.maxLoanAmount ?? criteriaForm.maxLoan ?? "");
      criteriaForm.minTerm = String(updated.minTermMonths ?? criteriaForm.minTerm ?? "");
      criteriaForm.maxTerm = String(updated.maxTermMonths ?? criteriaForm.maxTerm ?? "");

      const payload = {
        loanProductCode: productCode,
        ...buildLenderProductCriteriaPayload(criteriaForm, productCode),
        businessTypes: updated.businessTypes,
        propertyTypes: updated.propertyTypes,
        isActive: updated.isActive,
      };

      const res = await fetch(
        `${API_BASE}/lender/loan-products/update/${updated.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        },
      );

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message || "Update failed");
        return;
      }

      toast.success("Loan product updated");
      await fetchLoanProducts();
    } catch (err) {
      console.error("Failed to persist loan product update:", err);
      toast.error("Failed to update loan product");
    }
  };

  const changeStatusFor = async (loan: LoanProductList) => {
    if (!loan?.id) return;

    const prevStatus = loan.isActive;
    const nextStatus = !loan.isActive;

    setLenders((prev) =>
      prev.map((item) =>
        item.id === loan.id ? { ...item, isActive: nextStatus } : item,
      ),
    );

    setRowLoadingId(loan.id);

    try {
      const token = sessionStorage.getItem("lender_token");
      const res = await fetch(
        `${API_BASE}/lender/loan-products/status/${loan.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ isActive: nextStatus }),
        },
      );

      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || "Status update failed");
      }

      toast.success(`Loan product ${nextStatus ? "activated" : "deactivated"}`);
    } catch (err: any) {
      console.error(err);

      setLenders((prev) =>
        prev.map((item) =>
          item.id === loan.id ? { ...item, isActive: prevStatus } : item,
        ),
      );

      toast.error(err?.message || "Failed to update status");
    } finally {
      setRowLoadingId(null);
    }
  };

  const formatAmount = (amount?: number | null) => {
    if (amount === null || amount === undefined) {
      return "-";
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return "-";
    }

    if (numericAmount >= 1000000000) {
      return `$${(numericAmount / 1000000000).toFixed(1)}B`;
    }

    if (numericAmount >= 1000000) {
      return `$${(numericAmount / 1000000).toFixed(1)}M`;
    }

    if (numericAmount >= 1000) {
      return `$${(numericAmount / 1000).toFixed(1)}K`;
    }

    return `$${numericAmount}`;
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    }

    document.addEventListener("click", handleClickOutside);

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  return (
    <div className="px-6 py-6 text-gray-900 dark:text-gray-100">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            <span className="text-[#18B6B4]">Loan</span> Programs
          </h1>
          <p className="text-sm text-gray-500 mt-1 dark:text-slate-400">
            Manage global loan programs available on the platform.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              placeholder="Search by loan program name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="px-3 py-2 border rounded-md w-64 focus:outline-none focus:ring-1 focus:ring-blue-500
                         border-gray-300 bg-white text-gray-900
                         dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100
                         placeholder-gray-400 dark:placeholder-slate-400"
              aria-label="Search lenders"
            />
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2 py-2 border rounded-md bg-white text-gray-900
                         border-gray-300
                         dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
              aria-label="Page size"
            >
              <option value={5}>5 / page</option>
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
            </select>
          </div>

          {canManageProducts && (
            <button
              onClick={() => navigate("/add-loan-product")}
              className="inline-flex items-center whitespace-nowrap px-4 py-2 bg-[#18B6B4] text-white rounded-md hover:bg-[#159e9c] transition"
              type="button"
              aria-label="Add Loan"
            >
              <TiPlus className="mr-2" />
              Add Loan Programs
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-700">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-500 dark:text-slate-400">
            Loading loan programs...
          </div>
        ) : pagination.total === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500 dark:text-slate-400">
            No Loan programs found.
          </div>
        ) : (
          <>
            <div>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide dark:border-slate-700 dark:text-slate-400">
                    <th className="py-2 pr-4 text-left">Loan Program</th>
                    <th className="py-2 pr-4 text-left">Key Criteria</th>
                    <th className="py-2 pr-4 text-left">Status</th>
                    <th className="py-2 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lenders.map((item) => {
                    const isLoading = rowLoadingId === item.id;

                    return (
                      <tr
                        key={item.id}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50/40 dark:border-slate-800 dark:hover:bg-slate-800/60"
                      >
                        <td className="py-3 pr-4 text-gray-900 whitespace-nowrap dark:text-gray-100">
                          {formatLoanProductName(item)}
                        </td>
                        <td className="py-3 pr-4 text-gray-600 dark:text-slate-300">
                          {formatListKeyCriteria(item, formatAmount)}
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap">
                          {canManageProducts ? (
                            <button
                              onClick={() => !isLoading && changeStatusFor(item)}
                              disabled={isLoading}
                              className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-full border ${statusClass(
                                item.isActive ? "ACTIVE" : "INACTIVE",
                              )} disabled:opacity-60`}
                              title="Click to change status"
                              aria-label={`Change status for ${item.isActive}`}
                            >
                              {isLoading ? (
                                <svg
                                  className="h-3 w-3 animate-spin"
                                  viewBox="0 0 24 24"
                                >
                                  <circle
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                    fill="none"
                                    className="opacity-25"
                                  />
                                  <path
                                    fill="currentColor"
                                    className="opacity-75"
                                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                  />
                                </svg>
                              ) : null}
                              <span>{item.isActive ? "ACTIVE" : "INACTIVE"}</span>
                            </button>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-full border ${statusClass(
                                item.isActive ? "ACTIVE" : "INACTIVE",
                              )}`}
                            >
                              <span>{item.isActive ? "ACTIVE" : "INACTIVE"}</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4 relative overflow-visible">
                          <div
                            ref={openMenuId === item.id ? menuRef : null}
                            className="flex items-center justify-end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* THREE DOT BUTTON */}
                            <button
                              onClick={() =>
                                setOpenMenuId(
                                  openMenuId === item.id ? null : item.id,
                                )
                              }
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 
                 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition
                 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                            >
                              <BsThreeDotsVertical size={16} />
                            </button>

                            {/* DROPDOWN */}
                            {openMenuId === item.id && (
                              <div
                                className="absolute right-2 top-11 z-50 w-44 bg-white border rounded-lg shadow-lg overflow-hidden
                      dark:bg-slate-900 dark:border-slate-700 animate-in fade-in zoom-in-95"
                              >
                                {/* VIEW DETAILS */}
                                <button
                                  onClick={() => {
                                    setViewDetails(item);
                                    setOpenMenuId(null);
                                  }}
                                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-emerald-600
                     hover:bg-emerald-50 hover:text-emerald-600 transition
                     dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-emerald-400"
                                >
                                  <MdOutlineRemoveRedEye size={16} />
                                  View Details
                                </button>

                                {/* UPDATE */}
                                {canManageProducts && (
                                  <button
                                    onClick={() =>
                                      navigate("/update-loan-product", {
                                        state: { loanProduct: item },
                                      })
                                    }
                                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-blue-600 
                     hover:bg-blue-50 hover:text-blue-600 transition
                     dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                                  >
                                    <MdModeEdit size={16} />
                                    Update
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-sm text-gray-600 dark:text-slate-300">
                Showing{" "}
                <span className="font-medium">
                  {(currentPage - 1) * pageSize + 1}
                </span>{" "}
                -{" "}
                <span className="font-medium">
                  {Math.min(currentPage * pagination.limit, pagination.total)}
                </span>{" "}
                of <span className="font-medium">{pagination.total}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => gotoPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border rounded-md disabled:opacity-40
                             border-gray-300 bg-white text-gray-800
                             dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  Prev
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({
                    length: Math.min(pagination.totalPages, 5),
                  }).map((_, i) => {
                    const half = Math.floor(5 / 2);
                    let start = 1;
                    if (pagination.totalPages <= 5) start = 1;
                    else if (currentPage <= half + 1) start = 1;
                    else if (currentPage >= pagination.totalPages - half)
                      start = pagination.totalPages - 4;
                    else start = currentPage - half;

                    const page = start + i;
                    if (page > pagination.totalPages) return null;

                    return (
                      <button
                        key={page}
                        onClick={() => gotoPage(page)}
                        className={`px-3 py-1 rounded-md ${
                          page === currentPage
                            ? "bg-[#18B6B4] text-white"
                            : "border border-gray-300 bg-white text-gray-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => gotoPage(currentPage + 1)}
                  disabled={currentPage === pagination.totalPages}
                  className="px-3 py-1 border rounded-md disabled:opacity-40
                             border-gray-300 bg-white text-gray-800
                             dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {editingLender && (
        <EditLoanProductModal
          isOpen={Boolean(editingLender)}
          loanProduct={editingLender as any}
          onClose={() => setEditingLender(null)}
          onSave={handleEditSave as any}
        />
      )}

      {/* View details Modal */}
      {viewDetails && (
        <div
          className="fixed inset-0 z-999999 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setViewDetails(null)}
        >
          <div
            className="w-[95%] max-w-3xl bg-white rounded-xl shadow-xl p-6 overflow-y-auto max-h-[90vh]
                    dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="loan-product-details-title"
          >
            {/* HEADER */}
            <div className="flex justify-between items-center mb-4">
              <h2
                id="loan-product-details-title"
                className="text-lg font-semibold text-gray-800 dark:text-white"
              >
                Loan Program Details
              </h2>
              <button
                type="button"
                onClick={() => setViewDetails(null)}
                aria-label="Close loan product details"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* CONTENT */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Detail
                label="Program Code"
                value={formatLoanProductCode(viewDetails)}
              />
              <Detail
                label="Program Name"
                value={formatLoanProductName(viewDetails)}
              />

              {buildLoanProductDetailFields(viewDetails, formatAmount).map(
                (field, index) => (
                  <div
                    key={`${field.label}-${index}`}
                    className={field.fullWidth ? "col-span-2" : undefined}
                  >
                    <Detail label={field.label} value={field.value} />
                  </div>
                ),
              )}

              {/* DOCUMENTS */}
              <div className="col-span-2">
                <p className="font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Documents
                </p>

                {viewDetails.documents?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {viewDetails.documents.map((doc: any) => (
                      <div
                        key={doc.id}
                        className="group flex items-center gap-2 rounded-full border border-indigo-200
          bg-indigo-50 px-3 py-1.5 text-xs text-indigo-700
          dark:bg-indigo-500/10 dark:border-indigo-500/20 dark:text-indigo-300"
                      >
                        {/* DOT */}
                        <span className="w-2 h-2 rounded-full bg-indigo-500" />

                        {/* NAME */}
                        <span className="font-medium">{doc.documentName}</span>

                        {/* CODE */}
                        {/* {doc.documentCode && (
                          <span className="opacity-70 text-[10px]">
                            ({doc.documentCode})
                          </span>
                        )} */}

                        {/* REQUIRED BADGE */}
                        {/* {doc.isRequired && (
                          <span
                            className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full text-[10px]
            dark:bg-emerald-500/10 dark:text-emerald-300"
                          >
                            Required
                          </span>
                        )} */}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400">
                    No documents configured
                  </div>
                )}
              </div>

              {/* STATES */}
              <div className="col-span-2">
                <p className="font-medium text-gray-700 dark:text-slate-300 mb-1">
                  States Supported
                </p>
                {viewDetails.statesSupported?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {viewDetails.statesSupported.map((s: string) => (
                      <span
                        key={s}
                        className="px-2 py-1 text-xs rounded-full bg-emerald-100 text-emerald-700
                           dark:bg-emerald-500/10 dark:text-emerald-300"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400">
                    No states configured
                  </div>
                )}
              </div>

              {/* BUSINESS TYPES */}
              <div className="col-span-2">
                <p className="font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Business Types
                </p>
                {safeGroupedEntries(viewDetails.businessTypes, "name")
                  .length ? (
                  safeGroupedEntries(viewDetails.businessTypes, "name").map(
                    ([category, list]) => (
                      <div key={category} className="mb-2">
                        <p className="text-xs font-semibold text-gray-500">
                          {category}
                        </p>
                        <ul className="list-disc ml-5 text-gray-700 dark:text-slate-300">
                          {list.length ? (
                            list.map((item: string) => (
                              <li key={item}>{item}</li>
                            ))
                          ) : (
                            <li>No sub-types configured</li>
                          )}
                        </ul>
                      </div>
                    ),
                  )
                ) : (
                  <div className="text-xs text-gray-400">
                    No business types configured
                  </div>
                )}
              </div>

              {/* PROPERTY TYPES */}
              <div className="col-span-2">
                <p className="font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Property Types
                </p>
                {safeGroupedEntries(viewDetails.propertyTypes, "type")
                  .length ? (
                  safeGroupedEntries(viewDetails.propertyTypes, "type").map(
                    ([category, list]) => (
                      <div key={category} className="mb-2">
                        <p className="text-xs font-semibold text-gray-500">
                          {category}
                        </p>
                        <ul className="list-disc ml-5 text-gray-700 dark:text-slate-300">
                          {list.length ? (
                            list.map((item: string) => (
                              <li key={item}>{item}</li>
                            ))
                          ) : (
                            <li>No sub-types configured</li>
                          )}
                        </ul>
                      </div>
                    ),
                  )
                ) : (
                  <div className="text-xs text-gray-400">
                    No property types configured
                  </div>
                )}
              </div>

              {viewDetails.equipmentTypes?.length ? (
                <div className="col-span-2">
                  <p className="font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Equipment Types
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {viewDetails.equipmentTypes.map((type: string) => (
                      <span
                        key={type}
                        className="px-2 py-1 text-xs rounded-full bg-sky-100 text-sky-700
                           dark:bg-sky-500/10 dark:text-sky-300"
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const Detail = ({ label, value }: any) => (
  <div>
    <p className="text-gray-500 text-xs">{label}</p>
    <p className="font-medium text-gray-800 dark:text-white rounded-md bg-blue-100 px-2 py-2 text-xs mt-1">
      {value === null || value === undefined || value === "" ? "-" : value}
    </p>
  </div>
);
