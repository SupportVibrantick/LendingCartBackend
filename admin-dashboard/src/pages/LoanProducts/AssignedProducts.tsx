import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { createPortal } from "react-dom";
import { Eye, Loader2, Plus, SearchX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

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
function formatCurrency(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "";
  const num = Number(val);
  if (!Number.isFinite(num)) return String(val);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(num);
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

function formatTermRange(
  min?: number | null,
  max?: number | null,
): string {
  const hasMin = min !== null && min !== undefined;
  const hasMax = max !== null && max !== undefined;
  if (hasMin && hasMax) return `${min} – ${max} mo`;
  if (hasMin) return `${min}+ mo`;
  if (hasMax) return `Up to ${max} mo`;
  return "-";
}

function formatPercent(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "-";
  const num = Number(val);
  if (!Number.isFinite(num)) return String(val);
  return `${num}%`;
}

function formatBoolean(val: boolean | null | undefined): string {
  if (val === null || val === undefined) return "-";
  return val ? "Yes" : "No";
}

function formatStatesSummary(states?: string[]): { label: string; title: string } {
  if (!states?.length) return { label: "-", title: "" };
  if (states.length >= 50) return { label: "Nationwide", title: states.join(", ") };
  const preview = states.slice(0, 8).join(", ");
  const suffix = states.length > 8 ? ` +${states.length - 8} more` : "";
  return { label: `${states.length}`, title: preview + suffix };
}

function formatMetricsSummary(a: {
  maxLtvPercent?: string;
  maxLtcPercent?: string;
  maxArvPercent?: string;
}): string {
  const parts: string[] = [];
  if (a.maxLtvPercent) parts.push(`LTV ${formatPercent(a.maxLtvPercent)}`);
  if (a.maxLtcPercent) parts.push(`LTC ${formatPercent(a.maxLtcPercent)}`);
  if (a.maxArvPercent) parts.push(`ARV ${formatPercent(a.maxArvPercent)}`);
  return parts.length ? parts.join(" · ") : "-";
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
  return PRODUCT_LABELS[code] ?? code.replace(/_/g, " ");
}

/* ================= TYPES ================= */
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
  businessTypes?: string[];
  propertyTypes?: unknown[];
  statesSupported?: string[];
  equipmentTypes?: string[];
};

const PRODUCT_LABELS: Record<string, string> = {
  FIX_AND_FLIP_LOAN_1_TO_4_UNITS: "Fix & Flip",
  DSCR_LOAN_1_TO_4_UNITS: "DSCR",
  CONSTRUCTION_LOAN_1_TO_4_UNITS: "Construction",
  BRIDGE_LOAN_1_TO_4_UNITS: "Bridge",
  SBA_504_REAL_ESTATE_AND_EQUIPMENT: "SBA 504",
  USDA_BI: "USDA B&I",
  AGENCY_LOAN_MULTIFAMILY: "Agency Multifamily",
  CRE_PERMANENT_LOAN: "CRE Permanent",
  RENTAL_PORTFOLIO: "Rental Portfolio",
  PURCHASE_ORDER_FINANCE: "Purchase Order",
  ACCOUNTS_PAYABLE_FINANCE: "AP Supply Chain",
  ACCOUNTS_RECEIVABLE: "Accounts Receivable",
  INVOICE_FACTORING: "AR Factoring",
};

const TABLE_COL_COUNT = 12;

/* ================= COMPONENT ================= */
const AssignedProducts: React.FC = () => {
  const navigate = useNavigate();
  const tableTopRef = React.useRef<HTMLDivElement | null>(null);
  const [assignments, setAssignments] = useState<AssignedProduct[]>([]);
  const [loading, setLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [selectedLender, setSelectedLender] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [viewId, setViewId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const mapApiRow = (a: Record<string, unknown>): AssignedProduct => ({
    id: String(a.id),
    lenderOrgId: a.lenderOrgId ? String(a.lenderOrgId) : undefined,
    lenderName:
      (a.lender as { name?: string } | undefined)?.name ||
      (a.lenderName as string) ||
      "-",
    productName: (a.loanProduct as { name?: string } | undefined)?.name || "-",
    productCode:
      (a.loanProduct as { code?: string } | undefined)?.code ||
      String(a.loanProductCode || "-"),

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

    businessTypes: Array.isArray(a.businessTypes) ? a.businessTypes : [],
    propertyTypes: Array.isArray(a.propertyTypes) ? a.propertyTypes : [],
    equipmentTypes: normalizeArray(a.equipmentTypes),
    statesSupported: normalizeArray(a.statesSupported),
  });

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/lender-products/read");
      const list = Array.isArray(res.data?.data)
        ? res.data.data
        : res.data?.data?.results || [];

      setAssignments(list.map((row: Record<string, unknown>) => mapApiRow(row)));
    } catch (err) {
      console.error("Failed to fetch assignments", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedLender, searchQuery]);

  const fetchAssignmentDetail = async (id: string) => {
    try {
      setDetailLoading(true);
      setDetail(null);

      const res = await api.get("/admin/lender-products/read");
      const list = Array.isArray(res.data?.data)
        ? res.data.data
        : res.data?.data?.results || [];

      const found = list.find((x: { id: string }) => x.id === id);
      if (!found) {
        setDetail(null);
        return;
      }

      setDetail({
        ...found,
        businessTypes: Array.isArray(found.businessTypes) ? found.businessTypes : [],
        propertyTypes: Array.isArray(found.propertyTypes) ? found.propertyTypes : [],
        statesSupported: normalizeArray(found.statesSupported),
        equipmentTypes: normalizeArray(found.equipmentTypes),
      });
    } catch (err) {
      console.error("Failed to fetch detail", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const lenders = useMemo(
    () =>
      Array.from(new Set(assignments.map((a) => a.lenderName).filter((n) => n && n !== "-"))).sort(),
    [assignments],
  );

  const filteredAssignments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return assignments.filter((a) => {
      if (selectedLender && a.lenderName !== selectedLender) return false;
      if (!q) return true;
      const haystack = [
        a.lenderName,
        a.productName,
        a.productCode,
        productCodeLabel(a.productCode),
        a.interestRateRange,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [assignments, selectedLender, searchQuery]);

  const totalPages = Math.ceil(filteredAssignments.length / pageSize) || 1;

  const paginatedAssignments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAssignments.slice(start, start + pageSize);
  }, [filteredAssignments, currentPage, pageSize]);

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
                {filteredAssignments.length} assignment{filteredAssignments.length === 1 ? "" : "s"} with loan criteria
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
                  <option key={l} value={l}>
                    {l}
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
              onClick={fetchAssignments}
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
                setCurrentPage(1);
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
                <th className="py-2 pr-4 text-left">Rate</th>
                <th className="py-2 pr-4 text-left">LTV / LTC / ARV</th>
                <th className="py-2 pr-4 text-left">FICO</th>
                <th className="py-2 pr-4 text-left">Orig. Pts</th>
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
              ) : filteredAssignments.length === 0 ? (
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
                paginatedAssignments.map((a) => {
                  const states = formatStatesSummary(a.statesSupported);
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
                        {formatTermRange(a.minTermMonths, a.maxTermMonths)}
                      </td>

                      <td className="py-3 pr-4 text-xs dark:text-slate-100">
                        {a.interestRateRange?.trim() || "-"}
                      </td>

                      <td
                        className="max-w-[180px] py-3 pr-4 text-[11px] leading-relaxed text-slate-700 dark:text-slate-300"
                        title={formatMetricsSummary(a)}
                      >
                        {formatMetricsSummary(a)}
                      </td>

                      <td className="py-3 pr-4 text-xs dark:text-slate-100">
                        {a.minCreditScore ?? "-"}
                      </td>

                      <td className="py-3 pr-4 text-xs dark:text-slate-100">
                        {formatPercent(a.originationPointsPercent)}
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
                          onClick={() => {
                            setViewId(a.id);
                            fetchAssignmentDetail(a.id);
                          }}
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

        {filteredAssignments.length > 0 && (
          <div className="mt-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Showing{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {(currentPage - 1) * pageSize + 1}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {Math.min(currentPage * pageSize, filteredAssignments.length)}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {filteredAssignments.length}
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
                disabled={currentPage === totalPages}
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
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm dark:bg-black/70">
            <div
              className="relative flex max-h-[90vh] w-full max-w-5xl flex-col rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-900">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Assignment Details
                  </h3>
                  {detail && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {(detail.lender as { name?: string })?.name} ·{" "}
                      {productCodeLabel((detail.loanProduct as { code?: string })?.code)}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => {
                    setViewId(null);
                    setDetail(null);
                  }}
                  className="text-xl text-slate-500 transition-colors hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400"
                >
                  ✕
                </button>
              </div>

              <div className="overflow-y-auto px-6 py-5 text-sm">
                {detailLoading ? (
                  <div className="flex items-center justify-center py-10 text-blue-600 dark:text-blue-400">
                    Loading details...
                  </div>
                ) : !detail ? (
                  <div className="flex items-center justify-center py-10 text-amber-600 dark:text-amber-400">
                    No data found
                  </div>
                ) : (
                  <div className="space-y-8">
                    <Section title="Basic Info">
                      <FieldCard label="Active" value={detail.isActive ? "Yes" : "No"} />
                      <FieldCard
                        label="Created At"
                        value={
                          detail.createdAt
                            ? new Date(String(detail.createdAt)).toLocaleString()
                            : "-"
                        }
                      />
                    </Section>

                    <Section title="Lender Info">
                      <FieldCard
                        label="Name"
                        value={(detail.lender as { name?: string })?.name}
                      />
                      <FieldCard
                        label="Email"
                        value={(detail.lender as { email?: string })?.email}
                      />
                      <FieldCard
                        label="Phone"
                        value={(detail.lender as { phone?: string })?.phone}
                      />
                      <FieldCard
                        label="Status"
                        value={(detail.lender as { status?: string })?.status}
                      />
                    </Section>

                    <Section title="Loan Product">
                      <FieldCard
                        label="Program"
                        value={productCodeLabel(
                          (detail.loanProduct as { code?: string })?.code,
                        )}
                      />
                      <FieldCard
                        label="Name"
                        value={(detail.loanProduct as { name?: string })?.name}
                      />
                      <FieldCard
                        label="Description"
                        value={(detail.loanProduct as { description?: string })?.description}
                      />
                      <FieldCard
                        label="Product Active"
                        value={
                          (detail.loanProduct as { isActive?: boolean })?.isActive ? "Yes" : "No"
                        }
                      />
                    </Section>

                    <Section title="Financial Criteria">
                      <FieldCard
                        label="Loan Amount"
                        value={formatLoanRange(
                          detail.minLoanAmount as string,
                          detail.maxLoanAmount as string,
                        )}
                      />
                      <FieldCard
                        label="Term"
                        value={formatTermRange(
                          detail.minTermMonths as number,
                          detail.maxTermMonths as number,
                        )}
                      />
                      <FieldCard label="Max LTV" value={formatPercent(detail.maxLtvPercent as string)} />
                      <FieldCard label="Max ARV" value={formatPercent(detail.maxArvPercent as string)} />
                      <FieldCard label="Max LTC" value={formatPercent(detail.maxLtcPercent as string)} />
                      <FieldCard label="Min Credit Score" value={detail.minCreditScore} />
                      <FieldCard label="Experience" value={detail.minExperience} />
                      <FieldCard label="Interest Rate Range" value={detail.interestRateRange} />
                      <FieldCard
                        label="Origination Points"
                        value={formatPercent(detail.originationPointsPercent as string)}
                      />
                    </Section>

                    <Section title="Program Options">
                      <FieldCard
                        label="Extension Available"
                        value={formatBoolean(detail.extensionAvailable as boolean)}
                      />
                      <FieldCard
                        label="Personal Guarantee Required"
                        value={formatBoolean(detail.personalGuaranteeRequired as boolean)}
                      />
                      <FieldCard
                        label="First-Time Borrowers Allowed"
                        value={formatBoolean(detail.firstTimeBorrowersAllowed as boolean)}
                      />
                      {detail.criteriaNotes ? (
                        <div className="md:col-span-2">
                          <FieldCard label="Criteria Notes" value={detail.criteriaNotes} />
                        </div>
                      ) : null}
                    </Section>

                    <TagSection title="Business Types">
                      {Array.isArray(detail.businessTypes) && detail.businessTypes.length ? (
                        detail.businessTypes.map((item: { name?: string; subTypes?: string[] }, idx: number) => (
                          <div key={idx} className="rounded-lg border bg-blue-50 p-3">
                            <div className="font-medium text-blue-700">{item.name}</div>
                            {item.subTypes?.length ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {item.subTypes.map((sub) => (
                                  <span key={sub} className="rounded-full bg-white px-2 py-1 text-xs">
                                    {sub}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <span>-</span>
                      )}
                    </TagSection>

                    <TagSection title="Property Types">
                      {Array.isArray(detail.propertyTypes) && detail.propertyTypes.length ? (
                        detail.propertyTypes.map((item: { type?: string; subTypes?: string[] }, idx: number) => (
                          <div key={idx} className="rounded-lg border bg-green-50 p-3">
                            <div className="font-medium text-green-700">{item.type}</div>
                            {item.subTypes?.length ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {item.subTypes.map((sub) => (
                                  <span key={sub} className="rounded-full bg-white px-2 py-1 text-xs">
                                    {sub}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </TagSection>

                    <TagSection title="Equipment Types">
                      {normalizeArray(detail.equipmentTypes).length ? (
                        normalizeArray(detail.equipmentTypes).map((e) => (
                          <span
                            key={e}
                            className="rounded-full bg-purple-100 px-3 py-1 text-xs text-purple-700 dark:bg-purple-500/15 dark:text-purple-400"
                          >
                            {e}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400">-</span>
                      )}
                    </TagSection>

                    <div>
                      <h4 className="mb-3 font-semibold text-slate-900 dark:text-white">
                        States Supported
                      </h4>
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                        {normalizeArray(detail.statesSupported).length ? (
                          normalizeArray(detail.statesSupported).map((s) => (
                            <div
                              key={s}
                              className="rounded bg-slate-100 px-2 py-1 text-center text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            >
                              {s}
                            </div>
                          ))
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400">-</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

const FieldCard = ({ label, value }: { label: string; value: unknown }) => (
  <div className="space-y-1">
    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {label}
    </div>
    <div className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
      {value === null || value === undefined || value === "" ? "-" : String(value)}
    </div>
  </div>
);

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-4">
    <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-900 dark:text-white">
      {title}
    </h4>
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">{children}</div>
  </div>
);

const TagSection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div>
    <h4 className="mb-3 font-semibold text-slate-900 dark:text-white">{title}</h4>
    <div className="flex flex-wrap gap-2">{children}</div>
  </div>
);

export default AssignedProducts;
