import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Plus, Search, X } from "lucide-react";
import { MdModeEdit, MdOutlineRemoveRedEye } from "react-icons/md";
import { BsThreeDotsVertical } from "react-icons/bs";
import toast from "react-hot-toast";
import EditLoanProductModal from "./EditLoanProductModal";
import {
  buildLenderProductCriteriaPayload,
  mapApiProductToCriteriaForm,
  productUsesAcceptedPropertyTypes,
  productUsesBusinessTypes,
} from "../../lib/loanProductCriteriaFields";
import { resolveLenderOfferedProductCode } from "../../lib/lenderLoanProducts";
import {
  buildLoanProductDetailFields,
  formatListKeyCriteria,
  formatLoanProductCode,
  formatLoanProductName,
  formatPercentValue,
  resolveProductCode,
} from "../../lib/loanProductListDisplay";
import { canManageLoanProducts } from "../../lib/lenderPermissions";
import { API_BASE, getLenderAuthHeaders } from "../../lib/lenderApi";

// Coalesce identical list GETs across React Strict Mode remounts.
const inflightLoanProductLists = new Map<string, Promise<any>>();

async function fetchLoanProductsList(params: URLSearchParams) {
  const key = params.toString();
  const existing = inflightLoanProductLists.get(key);
  if (existing) return existing;

  const request = (async () => {
    const res = await fetch(
      `${API_BASE}/lender/loan-products/list?${key}`,
      {
        method: "GET",
        headers: getLenderAuthHeaders(),
      },
    );

    if (!res.ok) {
      throw new Error(`Failed to fetch loan products: ${res.status}`);
    }

    return res.json();
  })().finally(() => {
    inflightLoanProductLists.delete(key);
  });

  inflightLoanProductLists.set(key, request);
  return request;
}

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
      return "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30";
    case "INACTIVE":
      return "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30";
    default:
      return "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-600/30 dark:text-slate-100 dark:ring-slate-500";
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
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [viewDetails, setViewDetails] = useState<any | null>(null);
  const filtersRef = useRef({
    query: "",
    pageSize: 10,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const filtersChanged =
      filtersRef.current.query !== debouncedQuery ||
      filtersRef.current.pageSize !== pageSize;

    if (filtersChanged) {
      filtersRef.current = {
        query: debouncedQuery,
        pageSize,
      };
      // Avoid fetching with a stale page after search/pageSize changes.
      if (currentPage !== 1) {
        setCurrentPage(1);
        return;
      }
    }

    let active = true;
    void fetchLoanProducts(() => active);
    return () => {
      active = false;
    };
  }, [currentPage, pageSize, debouncedQuery]);

  function normalizeLoanProduct(product: any): LoanProductList {
    return {
      ...product,
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
      statesSupported: Array.isArray(product.statesSupported)
        ? product.statesSupported
        : [],
      documents: Array.isArray(product.documents) ? product.documents : [],
      businessTypes:
        typeof product.businessTypes === "object" ? product.businessTypes : {},
      propertyTypes:
        typeof product.propertyTypes === "object" ? product.propertyTypes : {},
      maxArvPercent: product.maxArvPercent ?? null,
      maxLtcPercent: product.maxLtcPercent ?? null,
      maxLtvPercent: product.maxLtvPercent ?? null,
      minMezzLtvPercent: product.minMezzLtvPercent ?? null,
      maxMezzLtvPercent: product.maxMezzLtvPercent ?? null,
      minExperience: product.minExperience ?? "",
      industriesSupported: safeParseArray(product.industriesSupported),
      regionsSupported: safeParseArray(product.regionsSupported),
    };
  }

  async function fetchLoanProducts(isActive?: () => boolean) {
    if (!isActive || isActive()) setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
        includeDocuments: "false",
      });
      if (debouncedQuery.trim()) {
        params.set("search", debouncedQuery.trim());
      }

      const json = await fetchLoanProductsList(params);
      if (isActive && !isActive()) return;

      const list = Array.isArray(json.data) ? json.data : [];

      setPagination({
        page: json.meta?.page || 1,
        limit: json.meta?.limit || 10,
        total: json.meta?.total || 0,
        totalPages: json.meta?.totalPages || 1,
      });
      setLenders(
        (list as LoanProductList[]).map((product: any) =>
          normalizeLoanProduct(product),
        ),
      );
    } catch (err) {
      if (isActive && !isActive()) return;
      console.error(err);
      toast.error("Failed to load loan programs");
    } finally {
      if (!isActive || isActive()) {
        setLoading(false);
      }
    }
  }

  async function openProductDetails(productId: string) {
    try {
      setOpenMenuId(null);
      const res = await fetch(`${API_BASE}/lender/loan-products/${productId}`, {
        headers: getLenderAuthHeaders(),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load product details");
      }
      setViewDetails(normalizeLoanProduct(json.data));
    } catch (error: any) {
      toast.error(error.message || "Failed to load product details");
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
          headers: getLenderAuthHeaders(true),
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
      const res = await fetch(
        `${API_BASE}/lender/loan-products/status/${loan.id}`,
        {
          method: "PATCH",
          headers: getLenderAuthHeaders(true),
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

  const openRowMenu = (
    productId: string,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 176;
    const estimatedHeight = canManageProducts ? 96 : 52;
    const gap = 6;

    let left = rect.right - menuWidth;
    let top = rect.bottom + gap;

    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
    if (top + estimatedHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - estimatedHeight - gap);
    }

    setMenuPos({ top, left });
    setOpenMenuId((prev) => (prev === productId ? null : productId));
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current?.contains(target) ||
        (target instanceof Element && target.closest("[data-menu-id]"))
      ) {
        return;
      }
      setOpenMenuId(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenuId(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!openMenuId) return;

    const reposition = () => {
      const trigger = document.querySelector(
        `[data-menu-id="${openMenuId}"]`,
      ) as HTMLElement | null;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const menuWidth = 176;
      const estimatedHeight = menuRef.current?.offsetHeight || 96;
      const gap = 6;
      let left = rect.right - menuWidth;
      let top = rect.bottom + gap;
      left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
      if (top + estimatedHeight > window.innerHeight - 8) {
        top = Math.max(8, rect.top - estimatedHeight - gap);
      }
      setMenuPos({ top, left });
    };

    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [openMenuId]);

  const openMenuItem = openMenuId
    ? lenders.find((item) => item.id === openMenuId) || null
    : null;

  return (
    <div className="space-y-5 text-text-primary dark:text-gray-100">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="ds-page-title">Loan Programs</h1>
          <p className="ds-page-subtitle">
            Manage loan programs available for your lender organization.
          </p>
        </div>

        {canManageProducts && (
          <button
            onClick={() => navigate("/add-loan-product")}
            className="ds-btn-primary shrink-0 whitespace-nowrap"
            type="button"
            aria-label="Add Loan"
          >
            <Plus size={16} />
            Add Loan Program
          </button>
        )}
      </div>

      <div className="ds-table-wrap dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 z-10 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <input
              placeholder="Search programs..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-white py-2 pr-3.5 pl-10 text-sm text-text-primary placeholder:text-text-secondary/70 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
              aria-label="Search loan programs"
            />
          </div>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="h-10 rounded-xl border border-border bg-white px-3 text-sm text-text-primary focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
            aria-label="Page size"
          >
            <option value={5}>5 / page</option>
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
          </select>
        </div>

        {loading ? (
          <div className="px-4 py-16 text-center text-sm text-text-secondary">
            Loading loan programs...
          </div>
        ) : pagination.total === 0 ? (
          <div className="px-4 py-16 text-center text-sm text-text-secondary">
            No loan programs found.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="ds-table min-w-full">
                <thead>
                  <tr>
                    <th>Loan Program</th>
                    <th>Key Criteria</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lenders.map((item) => {
                    const isLoading = rowLoadingId === item.id;

                    return (
                      <tr
                        key={item.id}
                        className="transition hover:bg-surface/80 dark:hover:bg-slate-800/60"
                      >
                        <td className="whitespace-nowrap">
                          <span className="ds-table-title">
                            {formatLoanProductName(item)}
                          </span>
                        </td>
                        <td className="max-w-xl ds-table-muted">
                          {formatListKeyCriteria(item, formatAmount)}
                        </td>
                        <td className="whitespace-nowrap">
                          {canManageProducts ? (
                            <button
                              onClick={() => !isLoading && changeStatusFor(item)}
                              disabled={isLoading}
                              className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(
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
                              <span>{item.isActive ? "Active" : "Inactive"}</span>
                            </button>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(
                                item.isActive ? "ACTIVE" : "INACTIVE",
                              )}`}
                            >
                              <span>{item.isActive ? "Active" : "Inactive"}</span>
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center justify-end">
                            <button
                              type="button"
                              data-menu-id={item.id}
                              onClick={(event) => openRowMenu(item.id, event)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-text-secondary transition hover:bg-surface hover:text-text-primary dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                              aria-label="Open actions"
                              aria-expanded={openMenuId === item.id}
                            >
                              <BsThreeDotsVertical size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3.5 sm:flex-row dark:border-slate-800">
              <div className="text-[13px] text-text-secondary">
                Showing{" "}
                <span className="font-semibold text-text-primary">
                  {(currentPage - 1) * pageSize + 1}
                </span>{" "}
                -{" "}
                <span className="font-semibold text-text-primary">
                  {Math.min(currentPage * pagination.limit, pagination.total)}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-text-primary">
                  {pagination.total}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => gotoPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="h-9 rounded-xl border border-border bg-white px-3 text-sm font-medium text-text-primary transition hover:bg-surface disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
                        className={`inline-flex h-9 min-w-9 items-center justify-center rounded-xl px-3 text-sm font-semibold transition ${
                          page === currentPage
                            ? "bg-brand-500 text-white"
                            : "border border-border bg-white text-text-primary hover:bg-surface dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
                  className="h-9 rounded-xl border border-border bg-white px-3 text-sm font-medium text-text-primary transition hover:bg-surface disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {openMenuItem
        ? createPortal(
            <div
              ref={menuRef}
              style={{ top: menuPos.top, left: menuPos.left }}
              className="fixed z-[9999] w-44 overflow-hidden rounded-xl border border-border bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
            >
              <button
                type="button"
                onClick={() => {
                  void openProductDetails(openMenuItem.id);
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-text-primary transition hover:bg-surface dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <MdOutlineRemoveRedEye size={16} className="text-brand-500" />
                View Details
              </button>

              {canManageProducts && (
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenuId(null);
                    navigate("/update-loan-product", {
                      state: { loanProduct: openMenuItem },
                    });
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-text-primary transition hover:bg-surface dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <MdModeEdit size={16} className="text-brand-500" />
                  Update
                </button>
              )}
            </div>,
            document.body,
          )
        : null}

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
                  {productUsesAcceptedPropertyTypes(resolveProductCode(viewDetails))
                    ? "States Available"
                    : "States Supported"}
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
              {productUsesBusinessTypes(resolveProductCode(viewDetails)) && (
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
              )}

              {/* PROPERTY TYPES — CRE / SBA-style programs only; residential uses SFR/Condo/Town Home toggles */}
              {productUsesAcceptedPropertyTypes(
                resolveProductCode(viewDetails),
              ) && (
                <div className="col-span-2">
                  <p className="font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Property Types Accepted
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
              )}

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
