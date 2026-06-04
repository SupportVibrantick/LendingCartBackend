// src/pages/LoanProducts/AllLoanProducts.tsx
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { MdModeEdit } from "react-icons/md";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

type LoanProduct = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt?: string;
};

type LoanProductForm = {
  code: string;
  name: string;
  description: string;
};

// same as BrokersPage
function getAuthHeaders(): Record<string, string> {
  try {
    const token = sessionStorage.getItem("admin_token");
    if (token) {
      return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };
    }
  } catch {
    /* ignore */
  }
  return { "Content-Type": "application/json" };
}

// tiny helper for status pill
function statusClass(status?: string) {
  switch ((status || "").toUpperCase()) {
    case "ACTIVE":
      return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/40";
    case "INACTIVE":
      return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-300 dark:border-yellow-500/40";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-slate-600/30 dark:text-slate-100 dark:border-slate-500";
  }
}

const AllLoanProducts: React.FC = () => {
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [loanProductOptions, setLoanProductOptions] = useState<
  { id: string; code: string; name: string }[]
>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [form, setForm] = useState<LoanProductForm>({
    code: "",
    name: "",
    description: "",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const totalPages = Math.ceil(products.length / itemsPerPage);

  const paginatedProducts = products.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // ===== Helpers =====
  const formatDate = (value?: string) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString();
  };

  const resetForm = () => {
    setEditingProductId(null);
    setForm({
      code: "",
      name: "",
      description: "",
    });
  };

  // ===== API Calls =====
  const fetchLoanProducts = async () => {
    try {
      setLoadingList(true);

      const res = await fetch(`${API_BASE}/admin/loan-products/list`, {
        method: "GET",
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        console.error("Failed to load loan products:", res.status);
        return;
      }

      const json = await res.json();
      if (!json.success) {
        console.error("Failed to load loan products:", json.message);
        return;
      }

      const items = (json.data || []) as any[];

      const mapped: LoanProduct[] = items.map((p) => ({
        id: String(p.id),
        code: p.code,
        name: p.name ?? "",
        description: p.description ?? "",
        isActive: Boolean(p.isActive),
        createdAt: p.createdAt ?? undefined,
      }));

      setProducts(mapped);
      setCurrentPage(1);
    } catch (err) {
      console.error("Failed to load loan products", err);
    } finally {
      setLoadingList(false);
    }
  };

  const fetchLoanProductCodes = async () => {
  try {
    const res = await fetch(
      `${API_BASE}/common/loan-products/loan-product-code`
    );

    const json = await res.json();

    if (json?.success) {
      setLoanProductOptions(json.data || []);
    }
  } catch (error) {
    console.error("Failed to load loan product codes", error);
  }
};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code || !form.name) {
      toast.error("Code and Name are required.");
      return;
    }

    try {
      setSaving(true);

      if (editingProductId) {
        // Update existing (backend uses PUT)
        const res = await fetch(
          `${API_BASE}/admin/loan-products/update/${editingProductId}`,
          {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify({
              name: form.name,
              description: form.description || undefined,
            }),
          },
        );

        const json = await res.json();
        if (!res.ok || !json.success) {
          console.error(
            "Failed to update product:",
            json.message || res.status,
          );
          toast.error(json.message || "Failed to update product");
          return;
        }
      } else {
        // Create new
        const res = await fetch(`${API_BASE}/admin/loan-products/create`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            code: form.code,
            name: form.name,
            description: form.description || undefined,
          }),
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          console.error(
            "Failed to create product:",
            json.message || res.status,
          );
          toast.error(json.message || "Failed to create product");
          return;
        }
      }

      await fetchLoanProducts();
      resetForm();
    } catch (err) {
      console.error("Error saving loan product", err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (product: LoanProduct) => {
    setEditingProductId(product.id);
    setForm({
      code: product.code, // code not editable in backend, so field disabled
      name: product.name,
      description: product.description || "",
    });
  };

  const handleToggleStatus = async (product: LoanProduct) => {
    try {
      setTogglingId(product.id);

      // Correct path: PATCH /admin/loan-products/:id/status
      const res = await fetch(
        `${API_BASE}/admin/loan-products/status/${product.id}/status`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({ isActive: !product.isActive }),
        },
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        console.error(
          "Failed to update product status:",
          json.message || res.status,
        );
        toast.error(json.message || "Failed to update product status");
        return;
      }

      await fetchLoanProducts();
    } catch (err) {
      console.error("Failed to toggle product status", err);
    } finally {
      setTogglingId(null);
    }
  };

  // ===== Effects =====
  useEffect(() => {
    fetchLoanProducts();
     fetchLoanProductCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== UI =====
  return (
    <div className="px-6 py-6 text-gray-900 dark:text-gray-100">
      {/* Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#13538A] dark:text-indigo-600">
            Loan Products
          </h1>
          <p className="text-sm text-gray-500 mt-1 dark:text-slate-400">
            Manage global loan products available on the platform.  
          </p>
        </div>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[310px_minmax(0,1fr)] gap-4">
        {/* LEFT CARD – Create / Edit product */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            {editingProductId ? "Edit Loan Product" : "Add Loan Product"}
          </h2>
          <p className="text-sm text-gray-500 mb-4 dark:text-slate-400">
            Define loan products that can be used across lenders and
            applications.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                Product Code
              </label>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                           dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                value={form.code}
                onChange={(e) => {
  const selected = loanProductOptions.find(
    (item) => item.code === e.target.value
  );

  setForm((f) => ({
    ...f,
    code: e.target.value,
    name: selected?.name || "",
  }));
}}
                disabled={!!editingProductId || saving}
              >
                <option value="">Select a code</option>
              {loanProductOptions.map((opt) => (
  <option key={opt.id} value={opt.code}>
    {opt.name}
  </option>
))}
              </select>
              {editingProductId && (
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                  Code cannot be changed for existing products.
                </p>
              )}
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                Name
              </label>
              <input
                type="text"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                           dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. SBA Loan, DSCR Loan"
                disabled={saving}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                Description
              </label>
              <textarea
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                           dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Short description of this loan product"
                disabled={saving}
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center rounded-md bg-[#13538A] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#1b72be] disabled:opacity-60 disabled:cursor-not-allowed
                            dark:hover:bg-blue-600"
              >
                {saving
                  ? editingProductId
                    ? "Saving..."
                    : "Creating..."
                  : editingProductId
                    ? "Save Changes"
                    : "Create Product"}
              </button>

              {editingProductId && (
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="text-xs text-gray-500 hover:text-gray-700 underline dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Cancel edit
                </button>
              )}
            </div>
          </form>
        </div>

        {/* RIGHT CARD – Products table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                All Loan Products
              </h2>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Platform-wide loan products configured by Super Admin.
              </p>
            </div>

            <button
              type="button"
              onClick={fetchLoanProducts}
              disabled={loadingList}
              className="rounded-full border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed
                         dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              {loadingList ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="overflow-auto">
            <table className="min-w-full table-fixed text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide dark:border-slate-700 dark:text-slate-400">
                  <th className="w-[180px] py-2 pr-4 text-left">Code</th>
                  <th className="w-[200px] py-2 pr-4 text-left">Name</th>
                  <th className="py-2 pr-4 text-left">Description</th>
                  <th className="w-[120px] py-2 pr-4 text-left">Status</th>
                  <th className="w-[120px] py-2 pr-4 text-left">Created</th>
                  <th className="w-[100px] py-2 pr-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {loadingList ? (
                  <tr>
                    <td
                      className="py-6 text-center text-gray-500 dark:text-slate-400"
                      colSpan={6}
                    >
                      Loading products...
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td
                      className="py-6 text-center text-gray-500 dark:text-slate-400"
                      colSpan={6}
                    >
                      No loan products found.
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b text-xs border-gray-100 last:border-0 hover:bg-gray-50/40 dark:border-slate-800 dark:hover:bg-slate-800/60"
                    >
                      <td className="py-3 pr-4 text-gray-900 whitespace-nowrap dark:text-gray-100">
                        {p.code}
                      </td>
                      <td className="py-3 pr-4 text-gray-900 whitespace-nowrap dark:text-gray-100">
                        {p.name}
                      </td>
                      <td className="py-3 pr-4 text-gray-600 dark:text-slate-300 max-w-[400px]">
                        <div className="truncate" title={p.description || "-"}>
                          {p.description || "-"}
                        </div>
                      </td>

                      {/* Clickable status pill */}
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            if (!togglingId) {
                              handleToggleStatus(p);
                            }
                          }}
                          disabled={togglingId === p.id}
                          className={`inline-flex items-center px-3 py-1 rounded-full border text-xs cursor-pointer
                                      ${statusClass(
                                        p.isActive ? "ACTIVE" : "INACTIVE",
                                      )}
                                      disabled:opacity-60 disabled:cursor-not-allowed`}
                        >
                          {togglingId === p.id
                            ? "Updating..."
                            : p.isActive
                              ? "ACTIVE"
                              : "INACTIVE"}
                        </button>
                      </td>

                      <td className="py-3 pr-4 text-gray-600 whitespace-nowrap dark:text-slate-300">
                        {formatDate(p.createdAt)}
                      </td>

                      <td className="py-3 pr-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(p)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100
                                       dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <MdModeEdit />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {/* Pagination */}
            {products.length > itemsPerPage && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Showing {(currentPage - 1) * itemsPerPage + 1}-
                  {Math.min(currentPage * itemsPerPage, products.length)} of{" "}
                  {products.length}
                </p>

                <div className="flex items-center gap-2">
                  {/* Previous */}
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50
                   dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Prev
                  </button>

                  {/* Page Numbers */}
                  {Array.from({ length: totalPages }).map((_, i) => {
                    const page = i + 1;

                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1.5 text-sm rounded-md border
              ${
                currentPage === page
                  ? "bg-[#13538A] text-white border-[#13538A] dark:bg-blue-600 dark:border-blue-600"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
                      >
                        {page}
                      </button>
                    );
                  })}

                  {/* Next */}
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(p + 1, totalPages))
                    }
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-sm rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50
                   dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AllLoanProducts;
