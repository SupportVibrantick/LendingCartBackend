// src/pages/LoanProducts/AllLoanProducts.tsx
import { FileText } from "lucide-react";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { MdModeEdit } from "react-icons/md";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

type Document = {
  id: string;
  name: string;
};

type LenderLoanProduct = {
  id: string;
  loanProductCode: string;
  loanProduct: {
    name: string;
    code: string;
  };
};

type DocumentForm = {
  lenderProductId: string;
  documentTypeId: string;

  isRequired?: boolean;

  minFiles: number;
  maxFiles: number;

  notes: string;
  sortOrder: number;
};

type DocumentConfig = {
  id: string;

  lenderProductId: string;
  lenderProductCode?: string;

  documentTypeId: string;
  documentName?: string;

  isRequired: boolean;

  minFiles: number;
  maxFiles: number;

  notes?: string;
  sortOrder?: number;      

  createdAt?: string;
};

// same as BrokersPage
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
    /* ignore */
  }
  return { "Content-Type": "application/json" };
}

const AllLoanProducts: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [documentConfig, setDocumentConfig] = useState<DocumentConfig[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [loanProducts, setLoanProducts] = useState<LenderLoanProduct[]>([]);

  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [form, setForm] = useState<DocumentForm>({
    lenderProductId: "",
    documentTypeId: "",
    isRequired: undefined,
    minFiles: 0,
    maxFiles: 0,
    notes: "",
    sortOrder: 0,
  });

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
      lenderProductId: "",
      documentTypeId: "",
      isRequired: undefined,
      minFiles: 0,
      maxFiles: 0,
      notes: "",
      sortOrder: 0,
    });
  };

  // ===== API Calls =====
  const fetchLoanProducts = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/lender/loan-products/list?page=1&limit=50`,
        {
          headers: getAuthHeaders(),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error("Failed to load loan products");
        return;
      }

      setLoanProducts(json.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDocuments = async () => {
    try {
      setLoadingList(true);

      const res = await fetch(`${API_BASE}/document-types/active`, {
        method: "GET",
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        console.error("Failed to load documents:", res.status);
        return;
      }

      const json = await res.json();
      if (!json.success) {
        console.error("Failed to load documents:", json.message);
        toast.error(json.message || "Failed to load documents");
        return;
      }

      const items = (json.data || []) as any[];

      const mapped: Document[] = items.map((p) => ({
        id: p.id,
        name: p.name ?? "",
      }));

      setDocuments(mapped);
    } catch (err) {
      console.error("Failed to load documents", err);
    } finally {
      setLoadingList(false);
    }
  };

  // const fetchLenderProducts = async () => {
  //   try {
  //     setLoadingList(true);
  //     const headers = getAuthHeaders();
  //     const res = await fetch(`${API_BASE}/lender/loan-products/list/`, {
  //       method: "GET",
  //       headers,
  //     });

  //     if (!res.ok) {
  //       console.error("Failed to load loan products:", res.status);
  //       return;
  //     }

  //     const json = await res.json();
  //     if (!json.success) {
  //       console.error("Failed to load loan products:", json.message);
  //       toast.error(json.message || "Failed to load loan products");
  //       return;
  //     }

  //     const items = (json.data || []) as any[];

  //     const mapped: Lender[] = items.map((p) => ({
  //       id: p.id,
  //       loanProductCode: String(p.loanProductCode),
  //     }));
  //     setLenders(mapped);
  //   } catch (err) {
  //     console.error("Failed to load lender products", err);
  //   } finally {
  //     setLoadingList(false);
  //   }
  // };

  const fetchDocumentConfigs = async () => {
    try {
      setLoadingList(true);

      let url = `${API_BASE}/lender/document-config/list?page=${page}&limit=10`;

      // Add filter
      if (selectedProduct) {
        url += `&loanProductCode=${selectedProduct}`;
      }

      const res = await fetch(url, {
        headers: getAuthHeaders(),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error("Failed to fetch documents");
        return;
      }

      setDocumentConfig(json.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingList(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.lenderProductId || !form.documentTypeId) {
      toast.error("Please select lender product and document");
      return;
    }

    try {
      setSaving(true);

      if (editingProductId) {
        const updatePayload = {
          lenderProductId: form.lenderProductId,
          documentTypeId: form.documentTypeId,

          isRequired: form.isRequired,

          minFiles: form.minFiles,
          maxFiles: form.maxFiles,

          notes: form.notes || undefined,
          sortOrder: form.sortOrder,
        };

        const res = await fetch(
          `${API_BASE}/lender/document-config/update/${editingProductId}`,
          {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify(updatePayload),
          },
        );

        const json = await res.json();
        if (!res.ok || !json.success) {
          toast.error(json.message || "Failed to update document config");
          return;
        }

        toast.success("Document config updated");
      } else {
        if (!form.lenderProductId) {
          return toast.error("Please select loan product");
        }

        if (!form.documentTypeId) {
          return toast.error("Please select document type");
        }

        if (form.minFiles > form.maxFiles) {
          return toast.error("Min files cannot be greater than max files");
        }

        const createPayload = {
          lenderProductId: form.lenderProductId,
          documentTypeId: form.documentTypeId,

          isRequired: form.isRequired ?? false,

          minFiles: form.minFiles || 1,
          maxFiles: form.maxFiles || 20,

          notes: form.notes?.trim() || "",
          sortOrder: form.sortOrder || 1,
        };

        const res = await fetch(`${API_BASE}/lender/document-config/create`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(createPayload),
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          toast.error(json.message || "Failed to create document config");
          return;
        }

        toast.success("Document mapped successfully");
      }

      await fetchDocumentConfigs();
      resetForm();
    } catch (err) {
      console.error("Error saving document", err);
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (config: DocumentConfig) => {
    setEditingProductId(config.id);

    setForm({
      lenderProductId: config.lenderProductId,
      documentTypeId: config.documentTypeId,

      isRequired: config.isRequired,

      minFiles: config.minFiles,
      maxFiles: config.maxFiles,

      notes: config.notes || "", 
      sortOrder: config.sortOrder ?? 0,
    });
  };

  // ===== Effects =====
  useEffect(() => {
    fetchDocuments();
    fetchLoanProducts();
    fetchDocumentConfigs();
  }, []);

  useEffect(() => {
    fetchDocumentConfigs();
  }, [selectedProduct, page]);

  // ===== UI =====
  return (
    <div className="px-6 py-6 text-gray-900 dark:text-gray-100">
      {/* Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            All <span className="text-[#18B6B4]">Documents</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1 dark:text-slate-400">
            Manage documents available on the platform.  
          </p>
        </div>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6">
        {/* LEFT CARD – Create / Edit product */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            {editingProductId ? "Edit Document" : "Add Document"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Product Ids */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                Select Loan Product
              </label>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                           dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                value={form.lenderProductId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, lenderProductId: e.target.value }))
                }
                disabled={!!editingProductId || saving}
              >
                <option value="">Select a loan product</option>
                {loanProducts.map((lp) => (
                  <option key={lp.id} value={lp.id}>
                    {lp.loanProduct?.name}
                  </option>
                ))}
              </select>
              {editingProductId && (
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                  Code cannot be changed for existing products.
                </p>
              )}
            </div>

            {/* Document Ids */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                Select Document Name
              </label>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                           dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                value={form.documentTypeId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, documentTypeId: e.target.value }))
                }
                disabled={!!editingProductId || saving}
              >
                <option value="">Select a document name</option>
                {documents.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>

              {editingProductId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                    Min Files
                  </label>
                  <input
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                                        dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                    type="number"
                    value={form.minFiles}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        minFiles: Number(e.target.value),
                      }))
                    }
                    placeholder="Enter min files"
                    disabled={saving}
                  />
                </div>
              )}

              {editingProductId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                    Max Files
                  </label>
                  <input
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                                        dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                    type="number"
                    value={form.maxFiles}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        maxFiles: Number(e.target.value),
                      }))
                    }
                    placeholder="Enter max files"
                    disabled={saving}
                  />
                </div>
              )}

              {editingProductId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                    Notes
                  </label>
                  <textarea
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                                        dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                    value={form.notes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, notes: e.target.value }))
                    }
                    rows={2}
                  />
                </div>
              )}

              {editingProductId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                    Sort Order
                  </label>
                  <input
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                                        dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        sortOrder: Number(e.target.value),
                      }))
                    }
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Min Files
              </label>
              <input
                type="number"
                value={form.minFiles}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    minFiles: Number(e.target.value),
                  }))
                }
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="e.g. 1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Max Files
              </label>
              <input
                type="number"
                value={form.maxFiles}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    maxFiles: Number(e.target.value),
                  }))
                }
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="e.g. 3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    notes: e.target.value,
                  }))
                }
                className="w-full rounded-md border px-3 py-2 text-sm"
                rows={2}
                placeholder="Enter notes..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Sort Order
              </label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    sortOrder: Number(e.target.value),
                  }))
                }
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="e.g. 1"
              />
            </div>

            {/* Is Mandatory */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                Is Mandatory
              </label>

              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                           dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                value={
                  form.isRequired === undefined ? "" : String(form.isRequired)
                }
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    isRequired:
                      e.target.value === ""
                        ? undefined
                        : e.target.value === "true",
                  }))
                }
              >
                <option value="">None</option>
                <option value="true">Required</option>
                <option value="false">Optional</option>
              </select>
              {editingProductId && (
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                  Code cannot be changed for existing products.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center rounded-md bg-[#18B6B4] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#159e9c] disabled:opacity-60 disabled:cursor-not-allowed
  dark:bg-[#18B6B4] dark:hover:bg-[#159e9c]"
              >
                {saving
                  ? editingProductId
                    ? "Saving..."
                    : "Creating..."
                  : editingProductId
                    ? "Save Changes"
                    : "Create Document"}
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
            {/* LEFT */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                All Documents
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Filter documents by loan product
              </p>
            </div>

            {/* RIGHT FILTER */}
            <div className="flex items-center gap-3">
              {/* Select Wrapper */}
              <div className="relative">
                <select
                  value={selectedProduct}
                  onChange={(e) => {
                    setSelectedProduct(e.target.value);
                    setPage(1);
                  }}
                  className="appearance-none text-sm pl-3 pr-10 py-2 rounded-xl border border-gray-200 bg-white shadow-sm 
                 focus:outline-none focus:ring-2 focus:ring-[#2C92D5] focus:border-transparent
                 hover:border-gray-300 transition
                 dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                >
                  <option value="">All Products</option>

                  {loanProducts.map((lp) => (
                    <option key={lp.id} value={lp.loanProductCode}>
                      {lp.loanProduct?.name}
                    </option>
                  ))}
                </select>

                {/* Dropdown Icon */}
                <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-400">
                  ▼
                </div>
              </div>

              {/* Clear Button */}
              {selectedProduct && (
                <button
                  onClick={() => setSelectedProduct("")}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition font-medium"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide dark:border-slate-700 dark:text-slate-400">
                  <th className="py-2 pr-4 text-left">Loan Product</th>
                  <th className="py-2 pr-4 text-left">Document</th>
                  <th className="py-2 pr-4 text-left">Required</th>
                  <th className="py-2 pr-4 text-left">Files</th>
                  <th className="py-2 pr-4 text-left">Notes</th>
                  <th className="py-2 pr-4 text-left">Created</th>
                  <th className="py-2 pr-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {loadingList ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-gray-500">
                      Loading document configs...
                    </td>
                  </tr>
                ) : documentConfig.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        {/* ICON */}
                        <div className="group w-14 h-14 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center shadow-sm">
                          <FileText className="w-6 h-6 text-[#2C92D5] group-hover:scale-110 transition" />
                        </div>

                        {/* TEXT */}
                        <p className="mt-4 text-sm font-medium text-gray-700">
                          No documents found
                        </p>

                        <p className="text-xs text-gray-400 mt-1">
                          Try selecting a different loan product
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  documentConfig.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50/40 transition"
                    >
                      {/* Loan Product */}
                      <td className="py-3 pr-4 text-gray-900 whitespace-nowrap">
                        {p.lenderProductCode || "-"}
                      </td>

                      {/* Document */}
                      <td className="py-3 pr-4 text-gray-900 whitespace-nowrap">
                        {p.documentName}
                      </td>

                      {/* Required */}
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                            p.isRequired
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {p.isRequired ? "Required" : "Optional"}
                        </span>
                      </td>

                      {/* Files */}
                      <td className="py-3 pr-4 text-gray-600">
                        {p.minFiles || 0} – {p.maxFiles || 0}
                      </td>

                      {/* Notes */}
                      <td className="py-3 pr-4 text-gray-600">
                        {p.notes || "-"}
                      </td>

                      {/* Created */}
                      <td className="py-3 pr-4 text-gray-500">
                        {formatDate(p.createdAt)}
                      </td>

                      {/* Action */}
                      <td className="py-3 pr-4 text-right">
                        <button
                          onClick={() => handleEdit(p)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 hover:bg-gray-100 transition"
                        >
                          <MdModeEdit />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AllLoanProducts;
