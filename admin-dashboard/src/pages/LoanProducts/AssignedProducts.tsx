import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { createPortal } from "react-dom";
import { Eye, Loader2, SearchX } from "lucide-react";
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

/* ================= TYPES ================= */
type AssignedProduct = {
  id: string;
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
  businessTypes?: string[];
  propertyTypes?: any[];
  statesSupported?: string[];
  equipmentTypes?: string[];
};

const PRODUCT_LABELS: Record<string, string> = {
  FIX_AND_FLIP_LOAN_1_TO_4_UNITS: "FIX & FLIP",
  DSCR_LOAN_1_TO_4_UNITS: "DSCR",
  CONSTRUCTION_LOAN_1_TO_4_UNITS: "CONSTRUCTION",
  BRIDGE_LOAN_1_TO_4_UNITS: "BRIDGE LOAN",
  SBA_504_REAL_ESTATE_AND_EQUIPMENT: "SBA 504",
  USDA_BI: "USDA B&I",
  AGENCY_LOAN_MULTIFAMILY: "AGENCY MULTIFAMILY",
  CRE_PERMANENT_LOAN: "CRE PERMANENT",
  RENTAL_PORTFOLIO: "RENTAL PORTFOLIO",
  PURCHASE_ORDER_FINANCE: "PURCHASE ORDER FINANCE",
  ACCOUNTS_PAYABLE_FINANCE: "AP SUPPLY CHAIN",
  ACCOUNTS_RECEIVABLE: "ACCOUNTS RECEIVABLE",
  INVOICE_FACTORING: "AR FACTORING",
};

/* ================= COMPONENT ================= */
const AssignedProducts: React.FC = () => {
  const navigate = useNavigate();
  const tableTopRef = React.useRef<HTMLDivElement | null>(null);
  const [assignments, setAssignments] = useState<AssignedProduct[]>([]);
  const [loading, setLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const [selectedLender, setSelectedLender] = useState("");

  // 👁️ modal states
  const [viewId, setViewId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /* ================= FETCH LIST ================= */
  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/lender-products/read");

      const list = Array.isArray(res.data?.data)
        ? res.data.data
        : res.data?.data?.results || [];

      const normalizeArray = (val: any) =>
        Array.isArray(val) ? val : val ? val.split(",") : [];

      setAssignments(
        list.map((a: any) => ({
          id: a.id,

          lenderName: a.lender?.name || "-",
          productName: a.loanProduct?.name || "-",
          productCode: a.loanProduct?.code || "-",

          isActive: a.isActive,
          createdAt: a.createdAt,

          minLoanAmount: a.minLoanAmount,
          maxLoanAmount: a.maxLoanAmount,

          minTermMonths: a.minTermMonths,
          maxTermMonths: a.maxTermMonths,
          maxLtvPercent: a.maxLtvPercent,
          maxArvPercent: a.maxArvPercent,
          maxLtcPercent: a.maxLtcPercent,

          minCreditScore: a.minCreditScore,
          minExperience: a.minExperience,

          interestRateRange: a.interestRateRange,

          businessTypes: Array.isArray(a.businessTypes) ? a.businessTypes : [],

          propertyTypes: Array.isArray(a.propertyTypes) ? a.propertyTypes : [],

          equipmentTypes: normalizeArray(a.equipmentTypes),

          // ✅ FIXED
          statesSupported: normalizeArray(a.statesSupported),
        })),
      );
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
  }, [selectedLender]);

  const normalizeArray = (val: any) =>
    Array.isArray(val) ? val : val ? val.split(",") : [];

  /* ================= FETCH DETAIL ================= */
  const fetchAssignmentDetail = async (id: string) => {
    try {
      setDetailLoading(true);
      setDetail(null);

      const res = await api.get("/admin/lender-products/read");
      const list = Array.isArray(res.data?.data)
        ? res.data.data
        : res.data?.data?.results || [];

      const found = list.find((x: any) => x.id === id);

      if (!found) {
        setDetail(null);
        return;
      }

      // ✅ NORMALIZE DATA
      setDetail({
        ...found,

        businessTypes: Array.isArray(found.businessTypes)
          ? found.businessTypes
          : [],

        propertyTypes: Array.isArray(found.propertyTypes)
          ? found.propertyTypes
          : [],

        statesSupported: normalizeArray(found.statesSupported),

        equipmentTypes: normalizeArray(found.equipmentTypes),
      });
    } catch (err) {
      console.error("Failed to fetch detail", err);
    } finally {
      setDetailLoading(false);
    }
  };

  /* ================= DERIVED ================= */
  const lenders = useMemo(
    () =>
      Array.from(new Set(assignments.map((a) => a.lenderName).filter(Boolean))),
    [assignments],
  );

  const filteredAssignments = useMemo(() => {
    if (!selectedLender) return assignments;
    return assignments.filter((a) => a.lenderName === selectedLender);
  }, [assignments, selectedLender]);

  const totalPages = Math.ceil(filteredAssignments.length / pageSize);

  const paginatedAssignments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredAssignments.slice(start, end);
  }, [filteredAssignments, currentPage, pageSize]);

  const scrollToTop = () => {
    tableTopRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  useEffect(() => {
    scrollToTop();
  }, [currentPage]);

  /* ================= UI ================= */
  return (
    <>
      {/* ================= CARD ================= */}
      <div
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm
                      dark:border-slate-800 dark:bg-slate-900"
      >
        {/* ================= HEADER ================= */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* LEFT SECTION */}
          <div className="flex items-center gap-4">
            {/* BACK BUTTON (MODERN) */}
            <button
              onClick={() => navigate("/all-lenders-Organization")}
              className="flex items-center justify-center w-10 h-10 rounded-xl
      bg-slate-100 hover:bg-blue-100 
      dark:bg-slate-800 dark:hover:bg-blue-500/20
      transition-all duration-200 shadow-sm"
            >
              <ArrowLeft className="w-4 h-4 text-slate-700 dark:text-slate-200" />
            </button>

            {/* TITLE */}
            <div>
              <h2 className="text-md font-semibold text-slate-900 dark:text-white tracking-tight">
                Assigned Lender Products
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage lender ↔ product mappings efficiently
              </p>
            </div>
          </div>

          {/* RIGHT SECTION */}
          <div className="flex flex-wrap items-center gap-3">
            {/* FILTER */}
            <div className="relative">
              <select
                value={selectedLender}
                onChange={(e) => setSelectedLender(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 text-xs rounded-lg border 
        border-slate-300 dark:border-slate-700
        bg-white dark:bg-slate-800
        text-slate-900 dark:text-slate-100
        focus:outline-none focus:ring-2 focus:ring-blue-500/30
        hover:border-blue-400 transition-all"
              >
                <option value="">All Lenders</option>
                {lenders.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>

              {/* Dropdown Icon */}
              <span className="absolute right-2 top-2.5 text-slate-400 text-xs">
                ⌄
              </span>
            </div>

            {/* REFRESH BUTTON */}
            <button
              onClick={fetchAssignments}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-xs rounded-lg
      bg-[#13538A] text-white hover:bg-blue-700
      disabled:opacity-50 shadow-sm transition-all"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Refresh
            </button>

            {/* PAGE SIZE */}
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
                scrollToTop();
              }}
              className="px-3 py-2 text-xs rounded-lg border
      border-slate-300 dark:border-slate-700
      bg-white dark:bg-slate-800
      text-slate-900 dark:text-slate-100
      focus:outline-none focus:ring-2 focus:ring-blue-500/30
      hover:border-blue-400 transition-all"
            >
              <option value={5}>5 / page</option>
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
            </select>
          </div>
        </div>

        {/* ================= TABLE ================= */}
        <div ref={tableTopRef} className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr
                className="border-b border-slate-200 text-xs uppercase
                             text-slate-500 dark:border-slate-800 dark:text-slate-400 whitespace-nowrap"
              >
                <th className="py-2 pr-4 text-left">Lender</th>
                <th className="py-2 pr-4 text-left">Product</th>
                <th className="py-2 pr-4 text-left">Code</th>
                <th className="py-2 pr-4 text-left">Loan Amount</th>
                <th className="py-2 pr-4 text-left">Term</th>
                {/* <th className="py-2 pr-4 text-left">LTV</th>
                <th className="py-2 pr-4 text-left whitespace-nowrap">Credit Score</th>
                <th className="py-2 pr-4 text-left">Interest</th> */}
                <th className="py-2 pr-4 text-left">Status</th>
                <th className="py-2 pr-4 text-left">Created</th>
                <th className="py-2 pr-2 text-left">View</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-8">
                    <div
                      className="flex items-center justify-center gap-3
                      text-blue-600 dark:text-blue-400"
                    >
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="font-medium">
                        Loading assignments...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8">
                    <div
                      className="flex flex-col items-center justify-center gap-2
                      text-amber-600 dark:text-amber-400"
                    >
                      <SearchX className="w-6 h-6" />
                      <span className="font-medium">
                        No assigned products found
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Try changing filter or refresh the list
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedAssignments.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-slate-100 text-sm
                               hover:bg-slate-50
                               dark:border-slate-800 dark:hover:bg-slate-800/50"
                  >
                    <td className="py-3 pr-4 text-slate-900 font-semibold text-xs dark:text-slate-100">
                      {a.lenderName}
                    </td>
                    <td className="py-3 pr-4 dark:text-white text-xs">
                      {a.productName}
                    </td>
                    <td className="py-3 pr-4 dark:text-white text-xs">
                      {PRODUCT_LABELS[a.productCode] ??
                        a.productCode?.replace(/_/g, " ").toUpperCase()}
                    </td>
                    <td className="py-3 pr-4 dark:text-slate-100 text-xs">
                      {a.minLoanAmount} – {a.maxLoanAmount}
                    </td>

                    <td className="py-3 pr-4 dark:text-slate-100 text-xs">
                      {a.minTermMonths} – {a.maxTermMonths} mo
                    </td>

                    {/* <td className="py-3 pr-4">
                      {a.minLtvPercent} – {a.maxLtvPercent}%
                    </td>

                    <td className="py-3 pr-4">{a.minCreditScore}</td>

                    <td className="py-3 pr-4">{a.interestRateRange}</td> */}

                    <td className="py-3 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold
                        ${
                          a.isActive
                            ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400"
                            : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
                        }`}
                      >
                        {a.isActive ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 dark:text-white text-xs">
                      {a.createdAt
                        ? new Date(a.createdAt).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="py-3 pr-2 text-xs">
                      <button
                        onClick={() => {
                          setViewId(a.id);
                          fetchAssignmentDetail(a.id);
                        }}
                        className="group p-2 rounded-lg 
               bg-blue-50 hover:bg-blue-100 
               dark:bg-blue-500/10 dark:hover:bg-blue-500/20
               transition-all duration-200"
                        title="View details"
                      >
                        <Eye
                          className="w-4 h-4 text-blue-600 dark:text-blue-400 
                    group-hover:scale-110 transition-transform"
                        />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* ================= PAGINATION ================= */}
        {filteredAssignments.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
            {/* Page Info */}
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

            {/* Controls */}
            <div className="flex items-center gap-3">
              {/* Previous */}
              <button
                onClick={() => {
                  setCurrentPage((p) => Math.max(p - 1, 1));
                  scrollToTop();
                }}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm rounded-md border
                   border-slate-300 dark:border-slate-700
                   bg-white dark:bg-slate-800
                   text-slate-700 dark:text-slate-200
                   hover:bg-slate-50 dark:hover:bg-slate-700
                   disabled:opacity-40 disabled:cursor-not-allowed
                   transition-colors"
              >
                Previous
              </button>

              {/* Page Indicator */}
              <span
                className="text-sm font-medium px-3 py-1.5 rounded-md
                       bg-slate-100 text-slate-700
                       dark:bg-slate-800 dark:text-slate-300"
              >
                Page {currentPage} of {totalPages || 1}
              </span>

              {/* Next */}
              <button
                onClick={() => {
                  setCurrentPage((p) => Math.min(p + 1, totalPages || 1));
                  scrollToTop();
                }}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm rounded-md border
                   border-slate-300 dark:border-slate-700
                   bg-white dark:bg-slate-800
                   text-slate-700 dark:text-slate-200
                   hover:bg-slate-50 dark:hover:bg-slate-700
                   disabled:opacity-40 disabled:cursor-not-allowed
                   transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ================= DETAIL MODAL ================= */}
      {viewId &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center
                 bg-black/50 dark:bg-black/70 backdrop-blur-sm px-4"
          >
            {/* Modal Card */}
            <div
              className="relative w-full max-w-5xl max-h-[90vh] flex flex-col
                   rounded-xl shadow-2xl
                   bg-white dark:bg-slate-900
                   border border-slate-200 dark:border-slate-700"
              onClick={(e) => e.stopPropagation()}
            >
              {/* ================= HEADER ================= */}
              <div
                className="sticky top-0 z-10 flex items-center justify-between
                     px-6 py-4 border-b
                     bg-white dark:bg-slate-900
                     border-slate-200 dark:border-slate-700"
              >
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Assignment Details
                </h3>

                <button
                  onClick={() => {
                    setViewId(null);
                    setDetail(null);
                  }}
                  className="text-xl text-slate-500 hover:text-red-500
                       dark:text-slate-400 dark:hover:text-red-400
                       transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* ================= BODY ================= */}
              <div className="overflow-y-auto px-6 py-5 text-sm">
                {detailLoading ? (
                  <div
                    className="flex items-center justify-center py-10
                            text-blue-600 dark:text-blue-400"
                  >
                    Loading details...
                  </div>
                ) : !detail ? (
                  <div
                    className="flex items-center justify-center py-10
                            text-amber-600 dark:text-amber-400"
                  >
                    No data found
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* BASIC INFO */}
                    <Section title="Basic Info">
                      <FieldCard
                        label="Active"
                        value={detail.isActive ? "Yes" : "No"}
                      />
                      <FieldCard
                        label="Created At"
                        value={
                          detail.createdAt
                            ? new Date(detail.createdAt).toLocaleString()
                            : "-"
                        }
                      />
                    </Section>

                    {/* LENDER INFO */}
                    <Section title="Lender Info">
                      <FieldCard label="Name" value={detail.lender?.name} />
                      <FieldCard label="Email" value={detail.lender?.email} />
                      <FieldCard label="Phone" value={detail.lender?.phone} />
                      <FieldCard label="Status" value={detail.lender?.status} />
                    </Section>

                    {/* PRODUCT INFO */}
                    <Section title="Loan Product">
                      <FieldCard
                        label="Code"
                        value={
                          PRODUCT_LABELS[detail.loanProduct?.code] ??
                          detail.loanProduct?.code
                            ?.replace(/_/g, " ")
                            .toUpperCase()
                        }
                      />
                      <FieldCard
                        label="Name"
                        value={detail.loanProduct?.name}
                      />
                      <FieldCard
                        label="Description"
                        value={detail.loanProduct?.description}
                      />
                      <FieldCard
                        label="Product Active"
                        value={detail.loanProduct?.isActive ? "Yes" : "No"}
                      />
                    </Section>

                    {/* FINANCIAL */}
                    <Section title="Financial Criteria">
                      <FieldCard
                        label="Min Loan Amount"
                        value={detail.minLoanAmount}
                      />
                      <FieldCard
                        label="Max Loan Amount"
                        value={detail.maxLoanAmount}
                      />
                      <FieldCard
                        label="Min Term (Months)"
                        value={detail.minTermMonths}
                      />
                      <FieldCard
                        label="Max Term (Months)"
                        value={detail.maxTermMonths}
                      />

                      <FieldCard
                        label="Max LTV (%)"
                        value={detail.maxLtvPercent}
                      />

                      <FieldCard
                        label="Max ARV (%)"
                        value={detail.maxArvPercent}
                      />

                      <FieldCard
                        label="Max LTC (%)"
                        value={detail.maxLtcPercent}
                      />
                      <FieldCard
                        label="Min Credit Score"
                        value={detail.minCreditScore}
                      />
                      <FieldCard
                        label="Experience"
                        value={detail.minExperience}
                      />
                      <FieldCard
                        label="Interest Rate Range"
                        value={detail.interestRateRange}
                      />
                    </Section>

                    {/* BUSINESS TYPES */}
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white mb-3">
                        Business Types
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {detail.businessTypes?.length ? (
                          detail.businessTypes.map((item: any, idx: number) => (
                            <div
                              key={idx}
                              className="border rounded-lg p-3 bg-blue-50"
                            >
                              <div className="font-medium text-blue-700">
                                {item.name}
                              </div>

                              {item.subTypes?.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {item.subTypes.map((sub: string) => (
                                    <span
                                      key={sub}
                                      className="px-2 py-1 text-xs rounded-full bg-white"
                                    >
                                      {sub}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <span>-</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white mb-3">
                        Property Types
                      </h4>

                      <div className="space-y-3">
                        {detail.propertyTypes?.length ? (
                          detail.propertyTypes.map((item: any, idx: number) => (
                            <div
                              key={idx}
                              className="border rounded-lg p-3 bg-green-50"
                            >
                              <div className="font-medium text-green-700">
                                {item.type}
                              </div>

                              {item.subTypes?.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {item.subTypes.map((sub: string) => (
                                    <span
                                      key={sub}
                                      className="px-2 py-1 text-xs rounded-full bg-white"
                                    >
                                      {sub}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </div>
                    </div>

                    {/* EQUIPMENT TYPES */}
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white mb-3">
                        Equipment Types
                      </h4>

                      <div className="flex flex-wrap gap-2">
                        {detail.equipmentTypes?.length ? (
                          detail.equipmentTypes.map((e: string) => (
                            <span
                              key={e}
                              className="px-3 py-1 text-xs rounded-full
          bg-purple-100 text-purple-700
          dark:bg-purple-500/15 dark:text-purple-400"
                            >
                              {e}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400">
                            -
                          </span>
                        )}
                      </div>
                    </div>

                    {/* STATES */}
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white mb-3">
                        States Supported
                      </h4>
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        {detail.statesSupported?.length ? (
                          detail.statesSupported.map((s: string) => (
                            <div
                              key={s}
                              className="px-2 py-1 rounded text-center text-xs
                                   bg-slate-100 text-slate-700
                                   dark:bg-slate-800 dark:text-slate-300"
                            >
                              {s}
                            </div>
                          ))
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400">
                            -
                          </span>
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

/* ================= SMALL DETAIL ITEM ================= */
const FieldCard = ({ label, value }: { label: string; value: any }) => (
  <div className="space-y-1">
    <div
      className="text-xs font-semibold tracking-wide uppercase
                    text-slate-500 dark:text-slate-400"
    >
      {label}
    </div>

    <div
      className="w-full rounded-lg px-4 py-2.5 text-xs
                 bg-slate-100 text-slate-900
                 border border-slate-200
                 dark:bg-slate-800 dark:text-slate-100
                 dark:border-slate-700 cursor-not-allowed"
    >
      {value ?? "-"}
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
    <h4
      className="text-xs uppercase tracking-wide
                    font-semibold text-slate-900 dark:text-white mb-3"
    >
      {title}
    </h4>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{children}</div>
  </div>
);

export default AssignedProducts;
