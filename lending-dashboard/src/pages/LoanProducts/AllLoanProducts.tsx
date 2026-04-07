import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdModeEdit, MdOutlineRemoveRedEye } from "react-icons/md";
import { TiPlus } from "react-icons/ti";
import { BsThreeDotsVertical } from "react-icons/bs";
import toast from "react-hot-toast";
import EditLoanProductModal from "./EditLoanProductModal";

type LoanProductList = {
  id: string;
  lenderOrgId: string;
  loanProductId: string;
  loanProductCode: string;
  loanProductName: string;
  minLoanAmount: number;
  maxLoanAmount: number;
  minTermMonths: number;
  maxTermMonths: number;
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
  const [lenders, setLenders] = useState<LoanProductList[]>([]);
  const [loading, setLoading] = useState(false);
  const [rowLoadingId, setRowLoadingId] = useState<string | null>(null);
  const [editingLender, setEditingLender] = useState<LoanProductList | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [viewDetails, setViewDetails] = useState<any | null>(null);

  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

  useEffect(() => {
    fetchLoanProducts();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, pageSize]);

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

  async function fetchLoanProducts() {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/lender/loan-products/list`, {
        method: "GET",
        headers,
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch loan products: ${res.status}`);
      }

      const json = await res.json();
      const list = Array.isArray(json)
        ? json
        : json.data?.results || json.data || [];
      const normalized = (list as LoanProductList[]).map((product) => ({
        ...product,
        industriesSupported: safeParseArray(product.industriesSupported),
        regionsSupported: safeParseArray(product.regionsSupported),
      }));

      setLenders(normalized);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lenders;

    return lenders.filter((item) =>
      (item.loanProductCode || "").toLowerCase().includes(q),
    );
  }, [lenders, query]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  function gotoPage(page: number) {
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
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
      const res = await fetch(
        `${API_BASE}/lender/loan-products/update/${updated.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            minLoanAmount: updated.minLoanAmount,
            maxLoanAmount: updated.maxLoanAmount,
            minTermMonths: updated.minTermMonths,
            maxTermMonths: updated.maxTermMonths,
            industriesSupported: updated.industriesSupported,
            regionsSupported: updated.regionsSupported,
            isActive: updated.isActive,
          }),
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

  return (
    <div className="px-6 py-6 text-gray-900 dark:text-gray-100">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            <span className="text-[#18B6B4]">Loan</span> Products
          </h1>
          <p className="text-sm text-gray-500 mt-1 dark:text-slate-400">
            Manage global loan products available on the platform.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              placeholder="Search by loan product name"
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

          <button
            onClick={() => navigate("/add-loan-product")}
            className="inline-flex items-center whitespace-nowrap px-4 py-2 bg-[#18B6B4] text-white rounded-md hover:bg-[#159e9c] transition"
            type="button"
            aria-label="Add Loan"
          >
            <TiPlus className="mr-2" />
            Add Loan
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-700">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-500 dark:text-slate-400">
            Loading loan products...
          </div>
        ) : total === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500 dark:text-slate-400">
            No Loan Products found.
          </div>
        ) : (
          <>
            <div>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide dark:border-slate-700 dark:text-slate-400">
                    <th className="py-2 pr-4 text-left">Loan Product</th>
                    <th className="py-2 pr-4 text-left">Min Amount</th>
                    <th className="py-2 pr-4 text-left">Max Amount</th>
                    <th className="py-2 pr-4 text-left">Tenure</th>
                    <th className="py-2 pr-4 text-left">Status</th>
                    <th className="py-2 pr-4 text-left">Created</th>
                    <th className="py-2 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((item) => {
                    const isLoading = rowLoadingId === item.id;

                    return (
                      <tr
                        key={item.id}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50/40 dark:border-slate-800 dark:hover:bg-slate-800/60"
                      >
                        <td className="py-3 pr-4 text-gray-900 whitespace-nowrap dark:text-gray-100">
                          {item.loanProductCode}
                        </td>
                        <td className="py-3 pr-4 text-gray-600 whitespace-nowrap dark:text-slate-300">
                          {item.minLoanAmount}
                        </td>
                        <td className="py-3 pr-4 text-gray-600 whitespace-nowrap dark:text-slate-300">
                          {item.maxLoanAmount}
                        </td>
                        <td className="py-3 pr-4 text-gray-600 whitespace-nowrap dark:text-slate-300">
                          {item.minTermMonths} - {item.maxTermMonths} months
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap">
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
                        </td>
                        <td className="py-3 pr-4 text-gray-600 whitespace-nowrap dark:text-slate-300">
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleDateString()
                            : "-"}
                        </td>
                        <td className="py-3 pr-4 relative overflow-visible">
                          <div className="flex items-center justify-end">
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
                  {Math.min(currentPage * pageSize, total)}
                </span>{" "}
                of <span className="font-medium">{total}</span>
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
                  {Array.from({ length: Math.min(totalPages, 5) }).map(
                    (_, i) => {
                      const half = Math.floor(5 / 2);
                      let start = 1;
                      if (totalPages <= 5) start = 1;
                      else if (currentPage <= half + 1) start = 1;
                      else if (currentPage >= totalPages - half)
                        start = totalPages - 4;
                      else start = currentPage - half;

                      const page = start + i;
                      if (page > totalPages) return null;

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
                    },
                  )}
                </div>

                <button
                  onClick={() => gotoPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
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
          loanProduct={editingLender}
          onClose={() => setEditingLender(null)}
          onSave={handleEditSave as any}
        />
      )}

      {/* View details Modal */}
      {viewDetails && (
        <div className="fixed inset-0 z-999999 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div
            className="w-[95%] max-w-3xl bg-white rounded-xl shadow-xl p-6 overflow-y-auto max-h-[90vh]
                    dark:bg-slate-900"
          >
            {/* HEADER */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                Loan Product Details
              </h2>
              <button
                onClick={() => setViewDetails(null)}
                className="text-gray-500 hover:text-red-500 text-lg"
              >
                ✕
              </button>
            </div>

            {/* CONTENT */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Detail
                label="Product Code"
                value={viewDetails.loanProductCode}
              />
              <Detail
                label="Product Name"
                value={viewDetails.loanProduct?.name}
              />
              <Detail label="Min Amount" value={viewDetails.minLoanAmount} />
              <Detail label="Max Amount" value={viewDetails.maxLoanAmount} />
              <Detail
                label="Tenure"
                value={`${viewDetails.minTermMonths} - ${viewDetails.maxTermMonths}`}
              />
              <Detail
                label="Interest Rate"
                value={viewDetails.interestRateRange}
              />
              <Detail
                label="LTV Range"
                value={`${viewDetails.minLtvPercent} - ${viewDetails.maxLtvPercent}`}
              />
              <Detail label="Credit Score" value={viewDetails.minCreditScore} />
              <Detail label="Experience" value={viewDetails.minExperience} />

              {/* STATES */}
              <div className="col-span-2">
                <p className="font-medium text-gray-700 dark:text-slate-300 mb-1">
                  States Supported
                </p>
                <div className="flex flex-wrap gap-2">
                  {viewDetails.statesSupported?.map((s: string) => (
                    <span
                      key={s}
                      className="px-2 py-1 text-xs rounded-full bg-emerald-100 text-emerald-700
                           dark:bg-emerald-500/10 dark:text-emerald-300"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* BUSINESS TYPES */}
              <div className="col-span-2">
                <p className="font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Business Types
                </p>
                {Object.entries(viewDetails.businessTypes || {}).map(
                  ([category, list]: any) => (
                    <div key={category} className="mb-2">
                      <p className="text-xs font-semibold text-gray-500">
                        {category}
                      </p>
                      <ul className="list-disc ml-5 text-gray-700 dark:text-slate-300">
                        {list.map((item: string) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ),
                )}
              </div>

              {/* PROPERTY TYPES */}
              <div className="col-span-2">
                <p className="font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Property Types
                </p>
                {Object.entries(viewDetails.propertyTypes || {}).map(
                  ([category, list]: any) => (
                    <div key={category} className="mb-2">
                      <p className="text-xs font-semibold text-gray-500">
                        {category}
                      </p>
                      <ul className="list-disc ml-5 text-gray-700 dark:text-slate-300">
                        {list.map((item: string) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ),
                )}
              </div>
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
    <p className="font-medium text-gray-800 dark:text-white bg-blue-100 px-2 py-1 rounded-sm text-xs">
      {value || "-"}
    </p>
  </div>
);
