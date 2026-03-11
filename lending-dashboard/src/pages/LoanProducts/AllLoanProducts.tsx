import React, { useEffect, useMemo, useState } from "react";
import { MdModeEdit } from "react-icons/md";
import { TiPlus } from "react-icons/ti";
import EditLoanProductModal from "./EditLoanProductModal"; // you can reuse this for lenders too
import toast from "react-hot-toast";

type LoanProductForm = {
  loanProductCode: string;
  minLoanAmount: number;
  maxLoanAmount: number;
  minTermMonths: number;
  maxTermMonths: number;
  regionsSupported: string[];
  industriesSupported: string[];
};

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

type LoanProductCode = {
  id: string;
  code: string;
  name: string;
};

const safeParseArray = (value: any): string[] => {
  if (Array.isArray(value)) return value;

  if (typeof value !== "string") return [];

  try {
    let parsed = JSON.parse(value);

    // handle double-stringified case
    if (typeof parsed === "string") {
      parsed = JSON.parse(parsed);
    }

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// const STATUS_ORDER = ["ACTIVE", "INACTIVE"]; // keep real backend enum

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
  const [lenders, setLenders] = useState<LoanProductList[]>([]);
  const [loading, setLoading] = useState(false);
  const [loanProductCode, setLoanProductCode] = useState<LoanProductCode[]>([]);
  const [rowLoadingId, setRowLoadingId] = useState<any | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState<LoanProductForm>({
    loanProductCode: "",
    minLoanAmount: 0,
    maxLoanAmount: 0,
    minTermMonths: 0,
    maxTermMonths: 0,
    regionsSupported: [],
    industriesSupported: [],
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editingLender, setEditingLender] = useState<LoanProductList | null>(
    null,
  );

  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001"; // adjust if needed

  useEffect(() => {
    fetchLoanProducts();
    fetchLoanProductCodeList();
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

  // -------- LENDERS LIST --------
  async function fetchLoanProducts() {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/lender/loan-products/list`, {
        method: "GET",
        headers,
      });

      if (!res.ok)
        throw new Error(`Failed to fetch loan products: ${res.status}`);

      const json = await res.json();

      const list = Array.isArray(json)
        ? json
        : json.data?.results || json.data || [];
      const normalized = (list as LoanProductList[]).map((p) => ({
        ...p,
        industriesSupported: safeParseArray(p.industriesSupported),
        regionsSupported: safeParseArray(p.regionsSupported),
      }));
      setLenders(normalized as any);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // ------- Loan Product Code List ---------
  async function fetchLoanProductCodeList() {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(
        `${API_BASE}/common/loan-products/loan-product-code`,
        {
          method: "GET",
          headers,
        },
      );

      if (!res.ok)
        throw new Error(`Failed to fetch loan product codes: ${res.status}`);

      const json = await res.json();

      const list = Array.isArray(json)
        ? json
        : json.data?.results || json.data || [];

      setLoanProductCode(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const openAdd = () => {
    setForm({
      loanProductCode: "",
      minLoanAmount: 0,
      maxLoanAmount: 0,
      minTermMonths: 0,
      maxTermMonths: 0,
      regionsSupported: [],
      industriesSupported: [],
    });
    setFormError(null);
    setIsAddOpen(true);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setFormError(null);

    if (
      !form.loanProductCode ||
      !form.minLoanAmount ||
      !form.maxLoanAmount ||
      !form.minTermMonths ||
      !form.maxTermMonths ||
      !form.regionsSupported ||
      !form.industriesSupported
    ) {
      setFormError("Please fill required fields.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        loanProductCode: form.loanProductCode,
        minLoanAmount: form.minLoanAmount,
        maxLoanAmount: form.maxLoanAmount,
        minTermMonths: form.minTermMonths,
        maxTermMonths: form.maxTermMonths,
        regionsSupported: form.regionsSupported,
        industriesSupported: form.industriesSupported,
      };

      const headers = getAuthHeaders();

      const res = await fetch(`${API_BASE}/lender/loan-products/create`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.message || "Failed to create loan product");
        setFormError(json?.message || `Server returned ${res.status}`);
        return;
      } else {
        toast.success(json.message || "Loan product created successfully");
      }

      setIsAddOpen(false);
      await fetchLoanProducts();
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lenders;
    return lenders.filter((b) => {
      return (b.loanProductCode || "").toLowerCase().includes(q);
    });
  }, [lenders, query]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
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

  const openEditModal = (b: LoanProductList) => {
    setEditingLender(b);
  };

  const handleEditSave = async (updated: LoanProductList) => {
    const normalizedUpdated = {
      ...updated,
      regionsSupported: safeParseArray(updated.regionsSupported),
      industriesSupported: safeParseArray(updated.industriesSupported),
    };
    setLenders((prev) =>
      prev.map((p) => (p.id === updated.id ? normalizedUpdated : p)),
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

    // optimistic UI update
    setLenders((prev) =>
      prev.map((b) => (b.id === loan.id ? { ...b, isActive: nextStatus } : b)),
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
          body: JSON.stringify({
            isActive: nextStatus,
          }),
        },
      );

      const json = await res.json();

      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || "Status update failed");
      }

      toast.success(`Loan product ${nextStatus ? "activated" : "deactivated"}`);
    } catch (err: any) {
      console.error(err);

      // rollback UI on failure
      setLenders((prev) =>
        prev.map((b) =>
          b.id === loan.id ? { ...b, isActive: prevStatus } : b,
        ),
      );

      toast.error(err?.message || "Failed to update status");
    } finally {
      setRowLoadingId(null);
    }
  };

  function toggleChip(
    key: "regionsSupported" | "industriesSupported",
    value: string,
  ) {
    setForm((prev) => {
      const set = new Set(prev[key]);
      set.has(value) ? set.delete(value) : set.add(value);
      return { ...prev, [key]: Array.from(set) };
    });
  }

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
            onClick={openAdd}
            className="inline-flex items-center whitespace-nowrap px-4 py-2 bg-[#18B6B4] text-white rounded-md hover:bg-[#159e9c] transition"
            type="button"
            aria-label="Add Lender"
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
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide dark:border-slate-700 dark:text-slate-400">
                    <th className="py-2 pr-4 text-left">Loan Product</th>
                    <th className="py-2 pr-4 text-left">Min Amount</th>
                    <th className="py-2 pr-4 text-left">Max Amount</th>
                    <th className="py-2 pr-4 text-left">Tenure</th>
                    <th className="py-2 pr-4 text-left">Industries</th>
                    <th className="py-2 pr-4 text-left">Regions</th>
                    <th className="py-2 pr-4 text-left">Status</th>
                    <th className="py-2 pr-4 text-left">Created</th>
                    <th className="py-2 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((b) => {
                    const isLoading = rowLoadingId === b.id;
                    const industries = b.industriesSupported;
                    const regions = b.regionsSupported;

                    return (
                      <tr
                        key={b.id}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50/40 dark:border-slate-800 dark:hover:bg-slate-800/60"
                      >
                        <td className="py-3 pr-4 text-gray-900 whitespace-nowrap dark:text-gray-100">
                          {b.loanProductCode}
                        </td>

                        <td className="py-3 pr-4 text-gray-600 whitespace-nowrap dark:text-slate-300">
                          {b.minLoanAmount}
                        </td>
                        <td className="py-3 pr-4 text-gray-600 whitespace-nowrap dark:text-slate-300">
                          {b.maxLoanAmount}
                        </td>

                        <td className="py-3 pr-4 text-gray-600 whitespace-nowrap dark:text-slate-300">
                          {b.minTermMonths} - {b.maxTermMonths} months
                        </td>

                        <td className="py-3 pr-4 text-gray-600 whitespace-nowrap dark:text-slate-300">
                          {industries.join(", ")}
                        </td>

                        <td className="py-3 pr-4 text-gray-600 whitespace-nowrap dark:text-slate-300">
                          {regions.join(", ")}
                        </td>

                        <td className="py-3 pr-4 whitespace-nowrap">
                          <button
                            onClick={() => !isLoading && changeStatusFor(b)}
                            disabled={isLoading}
                            className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-full border ${statusClass(
                              b.isActive ? "ACTIVE" : "INACTIVE",
                            )} disabled:opacity-60`}
                            title="Click to change status"
                            aria-label={`Change status for ${b.isActive}`}
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
                                ></circle>
                                <path
                                  fill="currentColor"
                                  className="opacity-75"
                                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                />
                              </svg>
                            ) : null}
                            <span> {b.isActive ? "ACTIVE" : "INACTIVE"}</span>
                          </button>
                        </td>

                        <td className="py-3 pr-4 text-gray-600 whitespace-nowrap dark:text-slate-300">
                          {b.createdAt
                            ? new Date(b.createdAt).toLocaleDateString()
                            : "-"}
                        </td>

                        <td className="py-3 pr-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              disabled={isLoading}
                              onClick={() => openEditModal(b)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-40
                                         dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                              aria-label={`Edit ${b.loanProductCode}`}
                            >
                              <MdModeEdit />
                            </button>
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

      {/* Add Lender Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-500000 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-lg dark:bg-slate-900 dark:border dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Create Loan Product
              </h2>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-gray-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-500"
              >
                Close
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 md:grid-cols-2 gap-3"
            >
              {/* 🔹 loanProductCode dropdown */}
              <label className="block md:col-span-2">
                <span className="text-sm text-gray-700 dark:text-slate-200">
                  Loan Product Code
                </span>
                <select
                  value={form.loanProductCode}
                  onChange={(e) =>
                    setForm({ ...form, loanProductCode: e.target.value })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md bg-white text-gray-900
                             border-gray-300
                             dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                >
                  <option value="">No Loan Product Code (none)</option>
                  {!loanProductCode && (
                    <option value="" disabled>
                      Loading products...
                    </option>
                  )}
                  {loanProductCode &&
                    loanProductCode.map((p) => (
                      <option key={p.id} value={p.code}>
                        {p.code}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm text-gray-700 dark:text-slate-200">
                  Min Loan Amount
                </span>
                <input
                  type="number"
                  // value={form.minLoanAmount}
                  min={0}
                  max={form.maxLoanAmount || undefined}
                  required
                  onChange={(e) =>
                    setForm({ ...form, minLoanAmount: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md
                             border-gray-300 bg-white text-gray-900
                             dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-700 dark:text-slate-200">
                  Max Loan Amount
                </span>
                <input
                  type="number"
                  min={form.minLoanAmount || 0}
                  required
                  // value={form.maxLoanAmount}
                  onChange={(e) =>
                    setForm({ ...form, maxLoanAmount: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md
                             border-gray-300 bg-white text-gray-900
                             dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-700 dark:text-slate-200">
                  Min Term Months
                </span>
                <input
                  type="number"
                  min={0}
                  max={form.maxTermMonths || undefined}
                  required
                  // value={form.minTermMonths}
                  onChange={(e) =>
                    setForm({ ...form, minTermMonths: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md
                             border-gray-300 bg-white text-gray-900
                             dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-700 dark:text-slate-200">
                  Max Term Months
                </span>
                <input
                  type="number"
                  min={form.minTermMonths || 0}
                  required
                  // value={form.maxTermMonths}
                  onChange={(e) =>
                    setForm({ ...form, maxTermMonths: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md
                             border-gray-300 bg-white text-gray-900
                             dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                />
              </label>

              <div>
                <label className="block text-sm text-gray-700 dark:text-slate-200">
                  Regions Supported
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["CA", "TX", "FL", "NY", "NJ"].map((r) => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => toggleChip("regionsSupported", r)}
                      className={`px-3 py-1 rounded-full border ${form.regionsSupported.includes(r) ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 dark:text-slate-200">
                  Industries Supported
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["Real Estate", "Hospitality"].map((r) => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => toggleChip("industriesSupported", r)}
                      className={`px-3 py-1 rounded-full border ${form.industriesSupported.includes(r) ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {formError && (
                <div className="text-sm text-red-600 col-span-2">
                  {formError}
                </div>
              )}

              <div className="col-span-2 flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md
                             dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#18B6B4] text-white rounded-md hover:bg-[#159e9c] transition disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {submitting ? "Creating..." : "Create Loan Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Lender Modal (reusing EditBrokerModal for now) */}
      {editingLender && (
        <EditLoanProductModal
          isOpen={Boolean(editingLender)}
          loanProduct={editingLender}
          onClose={() => setEditingLender(null)}
          onSave={handleEditSave as any}
        />
      )}
    </div>
  );
}
