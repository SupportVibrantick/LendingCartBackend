import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Building2,
  Eye,
  FileText,
  Loader2,
  Mail,
  Package,
  Phone,
  Plus,
  SearchX,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  buildLoanProductDetailFields,
  formatListKeyCriteria,
  formatListTenure,
  formatLoanProductCode,
  formatLoanProductName,
} from "../../lib/loanProductListDisplay";
import { resolveLenderOfferedProductCode } from "../../lib/canonicalLoanProducts";
import { toGroupedTypeArray } from "../../lib/lenderProductAdminPayload";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

/* ================= API ================= */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "http://localhost:4000",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("admin_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/* ================= FORMAT HELPERS ================= */
function formatCurrencyAmount(amount?: number | null): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return "-";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCurrency(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "";
  const num = Number(val);
  if (!Number.isFinite(num)) return String(val);
  return formatCurrencyAmount(num);
}

function formatLoanRange(
  min?: string | number | null,
  max?: string | number | null,
): string {
  const minStr = min !== null && min !== undefined && min !== "" ? formatCurrency(min) : "";
  const maxStr = max !== null && max !== undefined && max !== "" ? formatCurrency(max) : "";
  if (minStr && maxStr) return `${minStr} – ${maxStr}`;
  if (minStr) return `${minStr}+`;
  if (maxStr) return `Up to ${maxStr}`;
  return "-";
}

function formatStatesSummary(states?: string[]): { label: string; title: string } {
  if (!states?.length) return { label: "-", title: "" };
  if (states.length >= 50) return { label: "Nationwide", title: states.join(", ") };
  const preview = states.slice(0, 8).join(", ");
  const suffix = states.length > 8 ? ` +${states.length - 8} more` : "";
  return { label: `${states.length}`, title: preview + suffix };
}

function normalizeArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter(Boolean).map(String);
  if (typeof val === "string" && val.trim()) {
    return val.split(",").map((v) => v.trim()).filter(Boolean);
  }
  return [];
}

function productCodeLabel(code?: string): string {
  if (!code) return "-";
  return PRODUCT_LABELS[code] ?? formatLoanProductCode({ loanProductCode: code });
}

function mapDocuments(raw: unknown): ProductDocument[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((doc: Record<string, unknown>) => {
      const documentTypeId =
        (doc.documentTypeId as string) ||
        (doc.documentType as { id?: string } | undefined)?.id ||
        (doc.id as string);
      if (!documentTypeId) return null;

      return {
        id: documentTypeId,
        documentTypeId,
        documentName:
          (doc.documentName as string) ||
          (doc.documentType as { name?: string } | undefined)?.name ||
          (doc.name as string) ||
          null,
        documentCode:
          (doc.documentCode as string) ||
          (doc.documentType as { code?: string } | undefined)?.code ||
          null,
        isRequired: doc.isRequired as boolean | undefined,
        isCustom: doc.isCustom as boolean | undefined,
      };
    })
    .filter(Boolean) as ProductDocument[];
}

/* ================= TYPES ================= */
type ProductDocument = {
  id?: string;
  documentTypeId?: string;
  documentName?: string | null;
  documentCode?: string | null;
  isRequired?: boolean;
  isCustom?: boolean;
};

type AssignedProduct = {
  id: string;
  lenderOrgId?: string;
  lenderName: string;
  productName: string;
  productCode: string;
  isActive: boolean;
  createdAt?: string;

  minLoanAmount?: string;
  maxLoanAmount?: string;
  minTermMonths?: number;
  maxTermMonths?: number;
  maxLtvPercent?: string;
  maxArvPercent?: string;
  maxLtcPercent?: string;
  minCreditScore?: number;
  minExperience?: string;
  interestRateRange?: string;
  originationPointsPercent?: string;
  extensionAvailable?: boolean;
  personalGuaranteeRequired?: boolean;
  firstTimeBorrowersAllowed?: boolean;
  criteriaNotes?: string;
  businessTypes?: Array<{ name?: string; subTypes?: string[] }>;
  propertyTypes?: Array<{ type?: string; subTypes?: string[] }>;
  statesSupported?: string[];
  equipmentTypes?: string[];
  documents?: ProductDocument[];
  raw?: Record<string, unknown>;
};

const PRODUCT_LABELS: Record<string, string> = {
  FIX_AND_FLIP_LOAN_1_TO_4_UNITS: "Fix & Flip",
  FIX_AND_FLIP: "Fix & Flip",
  DSCR_LOAN_1_TO_4_UNITS: "DSCR",
  DSCR_LOAN: "DSCR",
  CONSTRUCTION_LOAN_1_TO_4_UNITS: "Construction",
  CONSTRUCTION_LOAN: "Construction",
  BRIDGE_LOAN_1_TO_4_UNITS: "Bridge",
  BRIDGE_LOAN: "Bridge",
  SBA_504_REAL_ESTATE_AND_EQUIPMENT: "SBA 504",
  SBA_7A_BUSINESS_ACQUISITION: "SBA 7(a) Business Acquisition",
  SBA_EXPRESS: "SBA Express",
  USDA_BI: "USDA B&I",
  AGENCY_LOAN_MULTIFAMILY: "Agency Multifamily",
  CRE_PERMANENT_LOAN: "CRE Permanent",
  RENTAL_PORTFOLIO: "Rental Portfolio",
  PURCHASE_ORDER_FINANCE: "Purchase Order",
  ACCOUNTS_PAYABLE_FINANCE: "AP Supply Chain",
  ACCOUNTS_RECEIVABLE: "Accounts Receivable",
  INVOICE_FACTORING: "AR Factoring",
  EQUIPMENT_FINANCE: "Equipment Finance",
};

const TABLE_COL_COUNT = 10;

type LenderOption = {
  id: string;
  name: string;
};

/* ================= COMPONENT ================= */
const AssignedProducts: React.FC = () => {
  const navigate = useNavigate();
  const tableTopRef = React.useRef<HTMLDivElement | null>(null);
  const [assignments, setAssignments] = useState<AssignedProduct[]>([]);
  const [loading, setLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedLender, setSelectedLender] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery.trim(), 350);
  const [lenders, setLenders] = useState<LenderOption[]>([]);

  const [viewId, setViewId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const mapApiRow = (a: Record<string, unknown>): AssignedProduct => {
    const loanProduct = a.loanProduct as
      | { name?: string; code?: string }
      | undefined;
    const productCode = resolveLenderOfferedProductCode(
      loanProduct?.code || String(a.loanProductCode || ""),
    );

    return {
      id: String(a.id),
      lenderOrgId: a.lenderOrgId ? String(a.lenderOrgId) : undefined,
      lenderName:
        (a.lender as { name?: string } | undefined)?.name ||
        (a.lenderName as string) ||
        "-",
      productName: loanProduct?.name || "-",
      productCode: productCode || "-",

      isActive: Boolean(a.isActive),
      createdAt: a.createdAt as string | undefined,

      minLoanAmount: a.minLoanAmount as string | undefined,
      maxLoanAmount: a.maxLoanAmount as string | undefined,
      minTermMonths: a.minTermMonths as number | undefined,
      maxTermMonths: a.maxTermMonths as number | undefined,
      maxLtvPercent: a.maxLtvPercent as string | undefined,
      maxArvPercent: a.maxArvPercent as string | undefined,
      maxLtcPercent: a.maxLtcPercent as string | undefined,
      minCreditScore: a.minCreditScore as number | undefined,
      minExperience: a.minExperience as string | undefined,
      interestRateRange: a.interestRateRange as string | undefined,
      originationPointsPercent: a.originationPointsPercent as string | undefined,
      extensionAvailable: a.extensionAvailable as boolean | undefined,
      personalGuaranteeRequired: a.personalGuaranteeRequired as boolean | undefined,
      firstTimeBorrowersAllowed: a.firstTimeBorrowersAllowed as boolean | undefined,
      criteriaNotes: a.criteriaNotes as string | undefined,

      businessTypes: toGroupedTypeArray(a.businessTypes, "name"),
      propertyTypes: toGroupedTypeArray(a.propertyTypes, "type"),
      equipmentTypes: normalizeArray(a.equipmentTypes),
      statesSupported: normalizeArray(a.statesSupported),
      documents: mapDocuments(a.documents ?? a.lenderDocumentRequirements),
      raw: a,
    };
  };

  const buildDetailFromRow = (row: Record<string, unknown>) => ({
    ...row,
    loanProductCode: resolveLenderOfferedProductCode(
      (row.loanProduct as { code?: string } | undefined)?.code ||
        String(row.loanProductCode || ""),
    ),
    businessTypes: toGroupedTypeArray(row.businessTypes, "name"),
    propertyTypes: toGroupedTypeArray(row.propertyTypes, "type"),
    statesSupported: normalizeArray(row.statesSupported),
    equipmentTypes: normalizeArray(row.equipmentTypes),
    documents: mapDocuments(row.documents ?? row.lenderDocumentRequirements),
  });

  const fetchLenders = useCallback(async () => {
    try {
      const limit = 100;
      let pageNum = 1;
      let totalPages = 1;
      const list: { id?: string; organizationName?: string }[] = [];

      do {
        const res = await api.get("/admin/lenders/read", {
          params: { page: pageNum, limit },
        });
        const batch = res.data?.data?.results || [];
        list.push(...batch);
        totalPages = Math.max(1, Number(res.data?.data?.totalPages) || 1);
        pageNum += 1;
      } while (pageNum <= totalPages);

      const options: LenderOption[] = list
        .map((o) => ({
          id: String(o.id || ""),
          name: String(o.organizationName || "").trim(),
        }))
        .filter((o: LenderOption) => o.id && o.name)
        .sort((a: LenderOption, b: LenderOption) =>
          a.name.localeCompare(b.name),
        );
      setLenders(options);
    } catch (err) {
      console.error("Failed to fetch lenders", err);
    }
  }, []);

  const fetchAssignments = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setLoading(true);
        const params: Record<string, string | number> = {
          page: currentPage,
          limit: pageSize,
        };
        if (debouncedSearch) params.search = debouncedSearch;
        if (selectedLender) params.lenderOrgId = selectedLender;

        const res = await api.get("/admin/lender-products/read", {
          params,
          signal,
        });
        const list = Array.isArray(res.data?.data)
          ? res.data.data
          : res.data?.data?.results || [];

        setAssignments(
          list.map((row: Record<string, unknown>) => mapApiRow(row)),
        );
        setTotal(Number(res.data?.total ?? list.length));
        setTotalPages(
          Math.max(
            1,
            Number(res.data?.totalPages) ||
              Math.ceil(Number(res.data?.total || list.length) / pageSize) ||
              1,
          ),
        );
      } catch (err: unknown) {
        if (
          axios.isCancel(err) ||
          (err &&
            typeof err === "object" &&
            "code" in err &&
            (err as { code?: string }).code === "ERR_CANCELED")
        ) {
          return;
        }
        console.error("Failed to fetch assignments", err);
      } finally {
        setLoading(false);
      }
    },
    [currentPage, debouncedSearch, pageSize, selectedLender],
  );

  useEffect(() => {
    fetchLenders();
  }, [fetchLenders]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedLender, pageSize]);

  useEffect(() => {
    const controller = new AbortController();
    fetchAssignments(controller.signal);
    return () => controller.abort();
  }, [fetchAssignments]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const openAssignmentDetail = async (assignment: AssignedProduct) => {
    setViewId(assignment.id);
    setDetailLoading(true);
    setDetail(null);

    try {
      let row: Record<string, unknown> = { ...(assignment.raw || {}) };

      if (assignment.lenderOrgId) {
        try {
          const [productsRes, lenderRes] = await Promise.all([
            api.get(`/admin/lender-products/lender/${assignment.lenderOrgId}`),
            api.get("/admin/lenders/read", {
              params: { search: assignment.lenderOrgId, page: 1, limit: 1 },
            }),
          ]);

          const match = (productsRes.data?.data || []).find(
            (item: { id?: string }) => String(item.id) === assignment.id,
          );
          if (match && typeof match === "object") {
            row = {
              ...row,
              ...match,
              lender: (row.lender as object) || undefined,
            };
          }

          const lender = lenderRes.data?.data?.results?.[0];
          if (lender) {
            row = {
              ...row,
              lender: {
                id: lender.id,
                name: lender.organizationName,
                email: lender.organizationEmail,
                phone: lender.organizationPhone,
                status: lender.organizationStatus,
              },
            };
          }
        } catch (enrichErr) {
          console.error("Failed to enrich assignment detail", enrichErr);
        }
      }

      setDetail(buildDetailFromRow(row));
    } finally {
      setDetailLoading(false);
    }
  };

  const showingFrom = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const showingTo = Math.min(currentPage * pageSize, total);

  const scrollToTop = () => {
    tableTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    scrollToTop();
  }, [currentPage]);

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/all-lenders-Organization")}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 shadow-sm transition-all duration-200 hover:bg-blue-100 dark:bg-slate-800 dark:hover:bg-blue-500/20"
            >
              <ArrowLeft className="h-4 w-4 text-slate-700 dark:text-slate-200" />
            </button>

            <div>
              <h2 className="text-md font-semibold tracking-tight text-slate-900 dark:text-white">
                Assigned Lender Products
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {total} assignment{total === 1 ? "" : "s"} with loan criteria
                {debouncedSearch ? ` · “${debouncedSearch}”` : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search lender or product..."
              className="w-full min-w-[180px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-52"
            />

            <div className="relative">
              <select
                value={selectedLender}
                onChange={(e) => setSelectedLender(e.target.value)}
                className="appearance-none rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-8 text-xs text-slate-900 transition-all hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">All Lenders</option>
                {lenders.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <span className="absolute right-2 top-2.5 text-xs text-slate-400">⌄</span>
            </div>

            <button
              onClick={() => navigate("/assigned-products")}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs text-white shadow-sm transition-all hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              Assign New
            </button>

            <button
              onClick={() => fetchAssignments()}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-[#13538A] px-4 py-2 text-xs text-white shadow-sm transition-all hover:bg-blue-700 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Refresh
            </button>

            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                scrollToTop();
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 transition-all hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
        </div>

        <div ref={tableTopRef} className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="whitespace-nowrap border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="py-2 pr-4 text-left">Lender</th>
                <th className="py-2 pr-4 text-left">Product</th>
                <th className="py-2 pr-4 text-left">Loan Amount</th>
                <th className="py-2 pr-4 text-left">Term</th>
                <th className="py-2 pr-4 text-left">Key Criteria</th>
                <th className="py-2 pr-4 text-left">Docs</th>
                <th className="py-2 pr-4 text-left">States</th>
                <th className="py-2 pr-4 text-left">Status</th>
                <th className="py-2 pr-4 text-left">Assigned</th>
                <th className="py-2 pr-2 text-left">View</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={TABLE_COL_COUNT} className="py-8">
                    <div className="flex items-center justify-center gap-3 text-blue-600 dark:text-blue-400">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="font-medium">Loading assignments...</span>
                    </div>
                  </td>
                </tr>
              ) : assignments.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_COL_COUNT} className="py-8">
                    <div className="flex flex-col items-center justify-center gap-2 text-amber-600 dark:text-amber-400">
                      <SearchX className="h-6 w-6" />
                      <span className="font-medium">No assigned products found</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Try changing filters or assign a new product
                      </span>
                      <button
                        onClick={() => navigate("/assigned-products")}
                        className="mt-2 rounded-lg bg-[#13538A] px-4 py-2 text-xs text-white hover:bg-blue-700"
                      >
                        Assign Product
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                assignments.map((a) => {
                  const states = formatStatesSummary(a.statesSupported);
                  const productLike = {
                    ...(a.raw || {}),
                    loanProductCode: a.productCode,
                    minLoanAmount: a.minLoanAmount ? Number(a.minLoanAmount) : null,
                    maxLoanAmount: a.maxLoanAmount ? Number(a.maxLoanAmount) : null,
                    minTermMonths: a.minTermMonths,
                    maxTermMonths: a.maxTermMonths,
                    maxLtvPercent: a.maxLtvPercent ? Number(a.maxLtvPercent) : null,
                    maxLtcPercent: a.maxLtcPercent ? Number(a.maxLtcPercent) : null,
                    maxArvPercent: a.maxArvPercent ? Number(a.maxArvPercent) : null,
                    interestRateRange: a.interestRateRange,
                  };
                  const keyCriteria = formatListKeyCriteria(
                    productLike,
                    formatCurrencyAmount,
                  );
                  return (
                    <tr
                      key={a.id}
                      className="border-b border-slate-100 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                    >
                      <td className="py-3 pr-4 text-xs font-semibold text-slate-900 dark:text-slate-100">
                        <div>{a.lenderName}</div>
                        {a.lenderOrgId && (
                          <button
                            type="button"
                            onClick={() => navigate(`/update-lender/${a.lenderOrgId}`)}
                            className="mt-0.5 text-[10px] font-normal text-blue-600 hover:underline dark:text-blue-400"
                          >
                            Edit lender
                          </button>
                        )}
                      </td>

                      <td className="py-3 pr-4 text-xs dark:text-white">
                        <div className="font-medium">{a.productName}</div>
                        <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {productCodeLabel(a.productCode)}
                        </div>
                      </td>

                      <td className="py-3 pr-4 text-xs dark:text-slate-100">
                        {formatLoanRange(a.minLoanAmount, a.maxLoanAmount)}
                      </td>

                      <td className="py-3 pr-4 text-xs dark:text-slate-100">
                        {formatListTenure(productLike)}
                      </td>

                      <td
                        className="max-w-[220px] py-3 pr-4 text-[11px] leading-relaxed text-slate-700 dark:text-slate-300"
                        title={keyCriteria}
                      >
                        {keyCriteria}
                      </td>

                      <td className="py-3 pr-4 text-xs dark:text-slate-100">
                        {a.documents?.length || 0}
                      </td>

                      <td
                        className="py-3 pr-4 text-xs dark:text-slate-100"
                        title={states.title || undefined}
                      >
                        {states.label}
                      </td>

                      <td className="py-3 pr-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            a.isActive
                              ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400"
                              : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
                          }`}
                        >
                          {a.isActive ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>

                      <td className="py-3 pr-4 text-xs dark:text-white">
                        {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "-"}
                      </td>

                      <td className="py-3 pr-2 text-xs">
                        <button
                          onClick={() => openAssignmentDetail(a)}
                          className="group rounded-lg bg-blue-50 p-2 transition-all duration-200 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20"
                          title="View details"
                        >
                          <Eye className="h-4 w-4 text-blue-600 transition-transform group-hover:scale-110 dark:text-blue-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="mt-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Showing{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {showingFrom}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {showingTo}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {total}
              </span>{" "}
              results
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setCurrentPage((p) => Math.max(p - 1, 1));
                  scrollToTop();
                }}
                disabled={currentPage === 1}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Previous
              </button>

              <span className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => {
                  setCurrentPage((p) => Math.min(p + 1, totalPages));
                  scrollToTop();
                }}
                disabled={currentPage >= totalPages}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {viewId &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm dark:bg-black/70"
            onClick={() => {
              setViewId(null);
              setDetail(null);
            }}
          >
            <div
              className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Assignment Details
                  </h3>
                  {detail ? (
                    <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                      {(detail.lender as { name?: string })?.name || "Lender"} ·{" "}
                      {formatLoanProductName(detail)}
                    </p>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setViewId(null);
                    setDetail(null);
                  }}
                  className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-white"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="overflow-y-auto px-6 py-5 text-sm">
                {detailLoading ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-[#13538A]">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="text-sm text-slate-500">Loading details...</p>
                  </div>
                ) : !detail ? (
                  <div className="flex items-center justify-center py-16 text-amber-600 dark:text-amber-400">
                    No data found
                  </div>
                ) : (
                  <AssignmentDetailBody
                    detail={detail}
                    formatCurrencyAmount={formatCurrencyAmount}
                  />
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

function AssignmentDetailBody({
  detail,
  formatCurrencyAmount,
}: {
  detail: Record<string, unknown>;
  formatCurrencyAmount: (amount?: number | null) => string;
}) {
  const lender = (detail.lender || {}) as {
    name?: string;
    email?: string;
    phone?: string;
    status?: string;
  };
  const loanProduct = (detail.loanProduct || {}) as {
    name?: string;
    code?: string;
    isActive?: boolean;
    description?: string;
  };
  const criteriaFields = buildLoanProductDetailFields(
    detail,
    formatCurrencyAmount,
  );
  const businessTypes = Array.isArray(detail.businessTypes)
    ? (detail.businessTypes as Array<{ name?: string; subTypes?: string[] }>)
    : [];
  const propertyTypes = Array.isArray(detail.propertyTypes)
    ? (detail.propertyTypes as Array<{ type?: string; subTypes?: string[] }>)
    : [];
  const equipmentTypes = normalizeArray(detail.equipmentTypes);
  const states = normalizeArray(detail.statesSupported);
  const documents = Array.isArray(detail.documents)
    ? (detail.documents as ProductDocument[])
    : [];
  const keyCriteria = formatListKeyCriteria(detail, formatCurrencyAmount);
  const tenure = formatListTenure(detail);
  const loanRange = formatLoanRange(
    detail.minLoanAmount as string | number | null | undefined,
    detail.maxLoanAmount as string | number | null | undefined,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
            detail.isActive
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
              : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
          }`}
        >
          {detail.isActive ? "Active Assignment" : "Inactive Assignment"}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {formatLoanProductCode(detail)}
        </span>
        {detail.createdAt ? (
          <span className="text-[11px] text-slate-400">
            Assigned {new Date(String(detail.createdAt)).toLocaleString()}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label="Loan amount" value={loanRange} />
        <SummaryStat label="Term" value={tenure} />
        <SummaryStat
          label="States"
          value={
            states.length >= 50
              ? "Nationwide"
              : states.length
                ? `${states.length}`
                : "—"
          }
        />
        <SummaryStat
          label="Documents"
          value={documents.length ? String(documents.length) : "—"}
        />
      </div>

      {keyCriteria && keyCriteria !== "-" ? (
        <div className="rounded-xl border border-[#13538A]/15 bg-[#13538A]/5 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#13538A]">
            Key criteria
          </p>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
            {keyCriteria}
          </p>
        </div>
      ) : null}

      <DetailSection title="Lender">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoRow
            icon={<Building2 size={14} />}
            label="Name"
            value={lender.name}
          />
          <InfoRow
            icon={<Mail size={14} />}
            label="Email"
            value={lender.email}
          />
          <InfoRow
            icon={<Phone size={14} />}
            label="Phone"
            value={lender.phone}
          />
          <InfoRow
            icon={<Package size={14} />}
            label="Status"
            value={lender.status}
          />
        </div>
      </DetailSection>

      <DetailSection title="Loan product">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoRow
            icon={<Package size={14} />}
            label="Program"
            value={formatLoanProductName(detail)}
          />
          <InfoRow label="Code" value={formatLoanProductCode(detail)} />
          <InfoRow
            label="Catalog name"
            value={loanProduct.name || formatLoanProductName(detail)}
          />
          <InfoRow
            label="Catalog active"
            value={
              loanProduct.isActive === true
                ? "Yes"
                : loanProduct.isActive === false
                  ? "No"
                  : "—"
            }
          />
        </div>
        {loanProduct.description ? (
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            {loanProduct.description}
          </p>
        ) : null}
      </DetailSection>

      <DetailSection
        title="Loan criteria"
        count={criteriaFields.length}
      >
        {criteriaFields.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {criteriaFields.map((field) => (
              <CriteriaFieldCard
                key={field.key}
                label={field.label}
                value={field.value}
                fieldType={field.fieldType}
                fullWidth={field.fullWidth}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            No loan criteria configured for this program.
          </p>
        )}
      </DetailSection>

      <DetailSection title="States supported" count={states.length}>
        {states.length ? (
          <div className="flex flex-wrap gap-1.5">
            {states.map((state) => (
              <span
                key={state}
                className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {state}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No states configured.</p>
        )}
      </DetailSection>

      <DetailSection title="Property types" count={propertyTypes.length}>
        {propertyTypes.length ? (
          <div className="flex flex-wrap gap-2">
            {propertyTypes.map((item, idx) => (
              <div
                key={`${item.type}-${idx}`}
                className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs dark:border-emerald-500/20 dark:bg-emerald-500/10"
              >
                <span className="font-medium text-emerald-700 dark:text-emerald-300">
                  {item.type}
                </span>
                {item.subTypes?.length ? (
                  <span className="ml-1 text-slate-500">
                    ({item.subTypes.join(", ")})
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No property types configured.</p>
        )}
      </DetailSection>

      <DetailSection title="Business types" count={businessTypes.length}>
        {businessTypes.length ? (
          <div className="flex flex-wrap gap-2">
            {businessTypes.map((item, idx) => (
              <div
                key={`${item.name}-${idx}`}
                className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs dark:border-blue-500/20 dark:bg-blue-500/10"
              >
                <span className="font-medium text-blue-700 dark:text-blue-300">
                  {item.name}
                </span>
                {item.subTypes?.length ? (
                  <span className="ml-1 text-slate-500">
                    ({item.subTypes.join(", ")})
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No business types configured.</p>
        )}
      </DetailSection>

      <DetailSection title="Equipment types" count={equipmentTypes.length}>
        {equipmentTypes.length ? (
          <div className="flex flex-wrap gap-1.5">
            {equipmentTypes.map((type) => (
              <span
                key={type}
                className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
              >
                {type}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No equipment types configured.</p>
        )}
      </DetailSection>

      <DetailSection title="Upfront documents" count={documents.length}>
        {documents.length ? (
          <div className="flex flex-wrap gap-2">
            {documents.map((doc) => (
              <span
                key={doc.documentTypeId || doc.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-100 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
              >
                <FileText size={12} className="shrink-0 opacity-70" />
                <span>
                  {doc.documentName || doc.documentCode || "Document"}
                </span>
                <span className="text-[10px] opacity-70">
                  {doc.isRequired === false ? "(optional)" : "(required)"}
                </span>
                {doc.isCustom ? (
                  <span className="rounded bg-white/70 px-1 text-[9px] font-bold uppercase text-amber-700">
                    Custom
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            No documents configured for this assignment.
          </p>
        )}
      </DetailSection>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/50">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
        {value || "—"}
      </p>
    </div>
  );
}

function DetailSection({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
        {typeof count === "number" ? ` (${count})` : ""}
      </h4>
      {children}
    </section>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-800/40">
      {icon ? <div className="mt-0.5 text-slate-400">{icon}</div> : null}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <p className="mt-0.5 break-all text-sm text-slate-800 dark:text-slate-100">
          {value?.trim() || "—"}
        </p>
      </div>
    </div>
  );
}

function CriteriaFieldCard({
  label,
  value,
  fieldType,
  fullWidth,
}: {
  label: string;
  value: string;
  fieldType?: string;
  fullWidth?: boolean;
}) {
  const display = value?.trim() || "—";
  const isYes = fieldType === "toggle" && display === "Yes";
  const isNo = fieldType === "toggle" && display === "No";

  return (
    <div
      className={`space-y-1 ${fullWidth ? "sm:col-span-2 lg:col-span-3" : ""}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <div
        className={`rounded-lg border px-3 py-2 text-xs whitespace-pre-wrap ${
          isYes
            ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
            : isNo
              ? "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              : "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        }`}
      >
        {display}
      </div>
    </div>
  );
}

export default AssignedProducts;
