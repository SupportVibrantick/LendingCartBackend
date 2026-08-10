import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { MdDelete, MdModeEdit } from "react-icons/md";
import Swal from "sweetalert2";
import { filterLenderCatalogProducts } from "../../lib/canonicalLoanProducts";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const ITEMS_PER_PAGE = 10;
const SEARCH_DEBOUNCE_MS = 400;

type LoanProduct = {
  id: string;
  code: string;
  name: string;
  isActive?: boolean;
};

type Document = {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  isRequired?: boolean;
  isCustom?: boolean;
  source?: "ADMIN" | "LENDER" | "BROKER";
  createdByOrgId?: string | null;
  createdByOrgName?: string | null;
  createdByOrgType?: string | null;
  requirementId?: string | null;
  loanProductId?: string | null;
  loanProductCode?: string | null;
  loanProductName?: string | null;
  createdAt?: string;
};

type DocumentForm = {
  loanProductId: string;
  name: string;
  description: string;
  isRequired: boolean;
};

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type StatusFilter = "all" | "active" | "inactive";
type SourceFilter = "all" | "admin" | "lender" | "broker";

const EMPTY_FORM: DocumentForm = {
  loanProductId: "",
  name: "",
  description: "",
  isRequired: true,
};

function getAuthHeaders(options?: { json?: boolean }): Record<string, string> {
  const headers: Record<string, string> = {};
  if (options?.json !== false) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const token = sessionStorage.getItem("admin_token");
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    /* ignore */
  }

  return headers;
}

function getSwalTheme() {
  const isDark = document.documentElement.classList.contains("dark");
  return {
    background: isDark ? "#1e293b" : "#ffffff",
    color: isDark ? "#e2e8f0" : "#1e293b",
    customClass: { popup: "rounded-2xl" },
  };
}

function statusClass(isActive: boolean) {
  return isActive
    ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/40"
    : "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/40";
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AllDocuments() {
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSource, setEditingSource] = useState<
    "ADMIN" | "LENDER" | "BROKER" | null
  >(null);
  const [editingOrgName, setEditingOrgName] = useState<string | null>(null);
  const [form, setForm] = useState<DocumentForm>(EMPTY_FORM);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("admin");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: ITEMS_PER_PAGE,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) || null,
    [products, selectedProductId],
  );

  const formProduct = useMemo(
    () => products.find((product) => product.id === form.loanProductId) || null,
    [products, form.loanProductId],
  );

  const activeOnPage = useMemo(
    () => documents.filter((doc) => doc.isActive).length,
    [documents],
  );

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setEditingSource(null);
    setEditingOrgName(null);
    setForm(EMPTY_FORM);
  };

  const openCreateForm = () => {
    if (!products.length) {
      toast.error("No loan programs available");
      return;
    }
    setEditingId(null);
    setEditingSource(null);
    setEditingOrgName(null);
    setForm({
      ...EMPTY_FORM,
      loanProductId: selectedProductId || products[0]?.id || "",
    });
    setFormOpen(true);
  };

  const openEditForm = (doc: Document) => {
    setEditingId(doc.id);
    setEditingSource(doc.source || "ADMIN");
    setEditingOrgName(doc.createdByOrgName || null);
    setForm({
      loanProductId: doc.loanProductId || selectedProductId || "",
      name: doc.name,
      description: doc.description || "",
      isRequired: doc.isRequired ?? true,
    });
    setFormOpen(true);
  };

  const fetchProducts = useCallback(async () => {
    try {
      setLoadingProducts(true);
      // Same catalog endpoint + filter as lender Add Loan Product
      const res = await fetch(
        `${API_BASE}/common/loan-products/loan-product-code`,
        { headers: getAuthHeaders({ json: false }) },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        toast.error(json.message || "Failed to load loan programs");
        return;
      }

      const list = filterLenderCatalogProducts(
        ((json.data || []) as LoanProduct[]).filter(
          (item) => item?.id && item?.code,
        ),
      );
      setProducts(list);

      setSelectedProductId((prev) => {
        if (!prev) return "";
        if (list.some((product) => product.id === prev)) {
          return prev;
        }
        return "";
      });
    } catch (error) {
      console.error(error);
      toast.error("Failed to load loan programs");
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const fetchDocuments = useCallback(
    async (
      pageNo = currentPage,
      searchQuery = debouncedSearch,
      productId = selectedProductId,
    ) => {
      try {
        setLoadingList(true);

        const params = new URLSearchParams({
          page: String(pageNo),
          limit: String(ITEMS_PER_PAGE),
        });

        if (productId) {
          params.set("loanProductId", productId);
        }

        if (searchQuery.trim()) {
          params.set("search", searchQuery.trim());
        }
        if (statusFilter === "active") params.set("isActive", "true");
        if (statusFilter === "inactive") params.set("isActive", "false");
        if (sourceFilter !== "all") params.set("source", sourceFilter);

        const res = await fetch(
          `${API_BASE}/admin/document-types/read?${params.toString()}`,
          { headers: getAuthHeaders({ json: false }) },
        );

        const json = await res.json();
        if (!res.ok || !json.success) {
          toast.error(json.message || "Failed to load documents");
          return;
        }

        const total = Number(json.meta?.total || 0);
        const limit = Number(json.meta?.limit || ITEMS_PER_PAGE);
        const page = Number(json.meta?.page || pageNo);
        const totalPages = Math.max(1, Math.ceil(total / limit));

        setDocuments(
          (json.data || []).map((item: Document) => ({
            id: String(item.id),
            name: item.name ?? "",
            description: item.description ?? "",
            isActive: Boolean(item.isActive),
            isRequired: Boolean(item.isRequired ?? true),
            isCustom: Boolean(item.isCustom),
            source:
              item.source ||
              (item.isCustom
                ? item.createdByOrgType === "BROKER"
                  ? "BROKER"
                  : "LENDER"
                : "ADMIN"),
            createdByOrgId: item.createdByOrgId || null,
            createdByOrgName: item.createdByOrgName || null,
            createdByOrgType: item.createdByOrgType || null,
            requirementId: item.requirementId || null,
            loanProductId: item.loanProductId || productId || null,
            loanProductCode: item.loanProductCode || null,
            loanProductName: item.loanProductName || null,
            createdAt: item.createdAt,
          })),
        );

        setPagination({
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        });
        setCurrentPage(page);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load documents");
      } finally {
        setLoadingList(false);
      }
    },
    [
      currentPage,
      debouncedSearch,
      selectedProductId,
      statusFilter,
      sourceFilter,
    ],
  );

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, sourceFilter, selectedProductId]);

  useEffect(() => {
    closeForm();
  }, [selectedProductId]);

  useEffect(() => {
    fetchDocuments(currentPage, debouncedSearch, selectedProductId);
  }, [
    currentPage,
    debouncedSearch,
    statusFilter,
    sourceFilter,
    selectedProductId,
    fetchDocuments,
  ]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const targetProductId = form.loanProductId || selectedProductId;

    if (!targetProductId) {
      toast.error("Please select a loan program");
      return;
    }

    if (!form.name.trim()) {
      toast.error("Document name is required");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch(
        editingId
          ? `${API_BASE}/admin/document-types/update`
          : `${API_BASE}/admin/document-types/create`,
        {
          method: editingId ? "PUT" : "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(
            editingId
              ? {
                  id: editingId,
                  name: form.name.trim(),
                  description: form.description.trim(),
                  loanProductId: targetProductId,
                  isRequired: form.isRequired,
                }
              : {
                  name: form.name.trim(),
                  description: form.description.trim(),
                  loanProductId: targetProductId,
                  isRequired: form.isRequired,
                },
          ),
        },
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || "Save failed");
        return;
      }

      toast.success(editingId ? "Document updated" : "Document created");
      closeForm();

      // Switch list filter to the product the document was saved against
      if (targetProductId !== selectedProductId) {
        setSelectedProductId(targetProductId);
        setCurrentPage(1);
      } else {
        await fetchDocuments(
          editingId ? currentPage : 1,
          debouncedSearch,
          targetProductId,
        );
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to save document");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (doc: Document) => {
    try {
      setTogglingId(doc.id);

      const res = await fetch(`${API_BASE}/admin/document-types/status`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id: doc.id,
          isActive: !doc.isActive,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || "Status update failed");
        return;
      }

      toast.success(`Document marked as ${doc.isActive ? "inactive" : "active"}`);
      await fetchDocuments(currentPage, debouncedSearch, selectedProductId);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (doc: Document) => {
    const productId = doc.loanProductId || selectedProductId;
    if (!productId) {
      toast.error("Loan program missing for this document");
      return;
    }

    const productLabel =
      doc.loanProductName ||
      selectedProduct?.name ||
      products.find((product) => product.id === productId)?.name ||
      "this product";

    const result = await Swal.fire({
      title: "Remove document?",
      html: `Remove <strong>${doc.name}</strong> from <strong>${productLabel}</strong>?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, remove",
      cancelButtonText: "Cancel",
      ...getSwalTheme(),
    });

    if (!result.isConfirmed) return;

    try {
      setDeletingId(doc.requirementId || doc.id);

      const res = await fetch(`${API_BASE}/admin/document-types/delete`, {
        method: "DELETE",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id: doc.id,
          loanProductId: productId,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        await Swal.fire({
          icon: "error",
          title: "Delete failed",
          text: json.message || "Failed to delete document",
          ...getSwalTheme(),
        });
        return;
      }

      if (editingId === doc.id) closeForm();

      const nextPage =
        documents.length === 1 && currentPage > 1
          ? currentPage - 1
          : currentPage;

      await fetchDocuments(nextPage, debouncedSearch, selectedProductId);

      await Swal.fire({
        icon: "success",
        title: "Removed",
        text: `"${doc.name}" has been removed from this product.`,
        timer: 1500,
        showConfirmButton: false,
        ...getSwalTheme(),
      });
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete document");
    } finally {
      setDeletingId(null);
    }
  };

  const showingFrom =
    pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const showingTo = Math.min(
    pagination.page * pagination.limit,
    pagination.total,
  );

  return (
    <div className="text-gray-900 dark:text-gray-100">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#13538A] dark:text-indigo-400">
            Document Management
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Manage required documents for each loan program separately.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          disabled={loadingProducts || products.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#13538A] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1b72be] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-blue-600"
        >
          <Plus className="h-4 w-4" />
          Add Document
        </button>
      </div>

      {/* Filters / table toolbar */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto]">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Loan Program
              </label>
              <select
                value={selectedProductId}
                onChange={(event) => setSelectedProductId(event.target.value)}
                disabled={loadingProducts}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/10 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">All loan programs</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Search
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search by name..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/10 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Created By
              </label>
              <select
                value={sourceFilter}
                onChange={(event) =>
                  setSourceFilter(event.target.value as SourceFilter)
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#13538A] dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="admin">Admin documents</option>
                <option value="lender">Lender documents</option>
                <option value="broker">Broker documents</option>
                <option value="all">All sources</option>
              </select>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-[140px] flex-1">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as StatusFilter)
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#13538A] dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="all">All status</option>
                  <option value="active">Active only</option>
                  <option value="inactive">Inactive only</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() =>
                  fetchDocuments(currentPage, debouncedSearch, selectedProductId)
                }
                disabled={loadingList}
                className="inline-flex h-[42px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loadingList ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          {selectedProduct ? (
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {selectedProduct.code}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              All programs
            </span>
          )}
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {sourceFilter === "admin"
              ? "Admin only"
              : sourceFilter === "lender"
                ? "Lender only"
                : sourceFilter === "broker"
                  ? "Broker only"
                  : "All sources"}
          </span>
          <span className="inline-flex items-center rounded-full border border-[#13538A]/15 bg-[#13538A]/5 px-3 py-1 text-xs font-medium text-[#13538A] dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
            {pagination.total} total
          </span>
          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            {activeOnPage} active on page
          </span>
        </div>
      </div>

      {/* Documents table only */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {selectedProduct
                ? `Documents · ${selectedProduct.name}`
                : "Documents · All loan programs"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {selectedProduct
                ? "List of documents configured for the selected loan program"
                : "Documents configured across all loan programs"}
              {" · "}
              {sourceFilter === "admin"
                ? "Showing admin-created documents"
                : sourceFilter === "lender"
                  ? "Showing lender-created documents"
                  : sourceFilter === "broker"
                    ? "Showing broker-created documents"
                    : "Showing admin, lender, and broker documents"}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto px-5">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-800">
                {!selectedProductId ? (
                  <th className="py-3 pr-4">Loan Program</th>
                ) : null}
                <th className="py-3 pr-4">Document</th>
                <th className="py-3 pr-4">Created By</th>
                <th className="py-3 pr-4">Description</th>
                <th className="py-3 pr-4">Required</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Created</th>
                <th className="py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingList ? (
                <tr>
                  <td
                    colSpan={selectedProductId ? 7 : 8}
                    className="py-14 text-center"
                  >
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#13538A]" />
                    <p className="mt-3 text-sm text-slate-500">
                      Loading documents...
                    </p>
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td
                    colSpan={selectedProductId ? 7 : 8}
                    className="py-16 text-center"
                  >
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                      <FileText className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {selectedProductId
                        ? "No documents for this product"
                        : "No documents configured"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {debouncedSearch ||
                      statusFilter !== "all" ||
                      sourceFilter !== "admin"
                        ? "Try adjusting your search or filter."
                        : "Use Add Document to create the first one."}
                    </p>
                    {!debouncedSearch &&
                    statusFilter === "all" &&
                    sourceFilter === "admin" ? (
                      <button
                        type="button"
                        onClick={openCreateForm}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#13538A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1b72be]"
                      >
                        <Plus className="h-4 w-4" />
                        Add Document
                      </button>
                    ) : null}
                  </td>
                </tr>
              ) : (
                documents.map((doc) => {
                  const isBrokerDoc = doc.source === "BROKER";
                  const isLenderDoc = doc.source === "LENDER";
                  const isExternalDoc = isBrokerDoc || isLenderDoc;

                  return (
                  <tr
                    key={doc.requirementId || `${doc.id}-${doc.loanProductId}`}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70 dark:border-slate-800/80 dark:hover:bg-slate-800/40"
                  >
                    {!selectedProductId ? (
                      <td className="max-w-[220px] py-3.5 pr-4">
                        <p
                          className="truncate font-medium text-slate-800 dark:text-slate-100"
                          title={
                            doc.loanProductName ||
                            products.find(
                              (product) =>
                                product.id === doc.loanProductId ||
                                product.code === doc.loanProductCode,
                            )?.name ||
                            undefined
                          }
                        >
                          {doc.loanProductName ||
                            products.find(
                              (product) =>
                                product.id === doc.loanProductId ||
                                product.code === doc.loanProductCode,
                            )?.name ||
                            "—"}
                        </p>
                        {doc.loanProductCode ? (
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {doc.loanProductCode}
                          </p>
                        ) : null}
                      </td>
                    ) : null}
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#13538A]/10 text-[#13538A] dark:bg-indigo-500/10 dark:text-indigo-300">
                          <FileText className="h-4 w-4" />
                        </div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {doc.name}
                        </p>
                      </div>
                    </td>
                    <td className="py-3.5 pr-4">
                      <div className="space-y-1">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                            isBrokerDoc
                              ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                              : isLenderDoc
                                ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300"
                                : "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300"
                          }`}
                        >
                          {isBrokerDoc
                            ? "Broker"
                            : isLenderDoc
                              ? "Lender"
                              : "Admin"}
                        </span>
                        {isExternalDoc && doc.createdByOrgName ? (
                          <p
                            className="max-w-[160px] truncate text-[11px] text-slate-400"
                            title={doc.createdByOrgName}
                          >
                            {doc.createdByOrgName}
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td className="max-w-[280px] py-3.5 pr-4 text-slate-600 dark:text-slate-300">
                      <p className="truncate" title={doc.description || "—"}>
                        {doc.description || "—"}
                      </p>
                    </td>
                    <td className="py-3.5 pr-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                          doc.isRequired
                            ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
                            : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {doc.isRequired ? "Required" : "Optional"}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(doc)}
                        disabled={togglingId === doc.id}
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${statusClass(doc.isActive)}`}
                      >
                        {togglingId === doc.id
                          ? "Updating..."
                          : doc.isActive
                            ? "Active"
                            : "Inactive"}
                      </button>
                    </td>
                    <td className="py-3.5 pr-4 text-slate-500 dark:text-slate-400">
                      {formatDate(doc.createdAt)}
                    </td>
                    <td className="py-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditForm(doc)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          title={
                            isBrokerDoc
                              ? "Edit broker document"
                              : isLenderDoc
                                ? "Edit lender document"
                                : "Edit"
                          }
                        >
                          <MdModeEdit />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(doc)}
                          disabled={deletingId === (doc.requirementId || doc.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/20 dark:text-red-400 dark:hover:bg-red-500/10"
                          title="Remove from product"
                        >
                          {deletingId === (doc.requirementId || doc.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MdDelete />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {pagination.total > 0 ? (
          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Showing{" "}
              <span className="font-medium text-slate-800 dark:text-slate-100">
                {showingFrom}–{showingTo}
              </span>{" "}
              of{" "}
              <span className="font-medium text-slate-800 dark:text-slate-100">
                {pagination.total}
              </span>
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                disabled={!pagination.hasPreviousPage || loadingList}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium disabled:opacity-50 dark:border-slate-700"
              >
                Previous
              </button>

              {Array.from({ length: Math.min(pagination.totalPages, 5) }).map(
                (_, index) => {
                  const half = Math.floor(5 / 2);
                  let start = 1;
                  if (pagination.totalPages <= 5) start = 1;
                  else if (currentPage <= half + 1) start = 1;
                  else if (currentPage >= pagination.totalPages - half) {
                    start = pagination.totalPages - 4;
                  } else start = currentPage - half;

                  const pageNumber = start + index;
                  if (pageNumber > pagination.totalPages) return null;

                  return (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => setCurrentPage(pageNumber)}
                      disabled={loadingList}
                      className={`min-w-8 rounded-lg px-2.5 py-1.5 text-sm font-medium ${
                        pageNumber === currentPage
                          ? "bg-[#13538A] text-white dark:bg-indigo-600"
                          : "border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                },
              )}

              <button
                type="button"
                onClick={() =>
                  setCurrentPage((page) =>
                    Math.min(page + 1, pagination.totalPages),
                  )
                }
                disabled={!pagination.hasNextPage || loadingList}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium disabled:opacity-50 dark:border-slate-700"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Create / Edit modal — separate from table */}
      {formOpen ? (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close dialog backdrop"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]"
            onClick={() => {
              if (!saving) closeForm();
            }}
          />

          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {editingId ? "Edit Document" : "Add Document"}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {editingId && editingSource === "BROKER"
                    ? `Updating broker document${editingOrgName ? ` · ${editingOrgName}` : ""}`
                    : editingId && editingSource === "LENDER"
                      ? `Updating lender document${editingOrgName ? ` · ${editingOrgName}` : ""}`
                      : formProduct
                        ? `${editingId ? "Update" : "Create"} document for ${formProduct.name}`
                        : "Choose a loan program and fill document details"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Loan Program
                </label>
                <select
                  value={form.loanProductId}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      loanProductId: event.target.value,
                    }))
                  }
                  disabled={saving || !!editingId || products.length === 0}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/10 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">Select loan program</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
                {editingId ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Product cannot be changed while editing.
                  </p>
                ) : formProduct ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Code:{" "}
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {formProduct.code}
                    </span>
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Document Name
                </label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="e.g. Bank Statements, Appraisal Report"
                  disabled={saving}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/10 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Description
                </label>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Optional guidance for admins and lenders"
                  disabled={saving}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/10 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-700">
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    Required Document
                  </p>
                  <p className="text-xs text-slate-500">
                    Mark if this document is required for the product
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={form.isRequired}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      isRequired: event.target.checked,
                    }))
                  }
                  disabled={saving}
                  className="h-4 w-4 accent-[#13538A]"
                />
              </label>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#13538A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1b72be] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : editingId ? (
                    "Save Changes"
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Create Document
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
