import {
  ChevronLeft,
  ChevronRight,
  FileText,
  FilterX,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { hasPermission } from "../../lib/brokerPermissions";
import { isLoanOfficerPortalPath } from "../../lib/portalAuth";
import {
  collapseLoanProductIds,
  collapseLoanProductLabels,
  collapseLoanProductsForSelect,
  createBrokerCustomDocument,
  deactivateBrokerCustomDocument,
  expandLoanProductIds,
  fetchBrokerCustomDocuments,
  fetchLoanProductOptions,
  updateBrokerCustomDocument,
  type BrokerCustomDocument,
  type LoanProductOption,
} from "../../lib/documentTypesApi";

type DocumentFormState = {
  name: string;
  description: string;
  loanProductId: string;
};

type UsageFilter = "all" | "used" | "unused";

const emptyForm: DocumentFormState = {
  name: "",
  description: "",
  loanProductId: "",
};
const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 400;

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function BrokerCustomDocuments() {
  const isLoanOfficerPortal = isLoanOfficerPortalPath();
  const canManage =
    !isLoanOfficerPortal ||
    hasPermission("MANAGE_CUSTOM_DOCUMENTS", "loanOfficer");
  const readOnly = isLoanOfficerPortal && !canManage;

  const [documents, setDocuments] = useState<BrokerCustomDocument[]>([]);
  const [loanProducts, setLoanProducts] = useState<LoanProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [usageFilter, setUsageFilter] = useState<UsageFilter>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<BrokerCustomDocument | null>(
    null,
  );
  const [form, setForm] = useState<DocumentFormState>(emptyForm);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, productFilter, usageFilter]);

  useEffect(() => {
    const controller = new AbortController();

    const loadProducts = async () => {
      try {
        setLoadingProducts(true);
        const products = await fetchLoanProductOptions({
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setLoanProducts(products);
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        toast.error(err.message || "Failed to load loan products");
        setLoanProducts([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoadingProducts(false);
        }
      }
    };

    void loadProducts();
    return () => controller.abort();
  }, []);

  const selectableLoanProducts = useMemo(
    () => collapseLoanProductsForSelect(loanProducts),
    [loanProducts],
  );

  const selectedFormProduct = useMemo(
    () =>
      selectableLoanProducts.find(
        (product) => product.id === form.loanProductId,
      ) || null,
    [selectableLoanProducts, form.loanProductId],
  );

  const selectedFilterProduct = useMemo(
    () =>
      selectableLoanProducts.find((product) => product.id === productFilter) ||
      null,
    [selectableLoanProducts, productFilter],
  );

  const loadDocuments = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);

      const json = await fetchBrokerCustomDocuments(
        {
          page,
          limit: PAGE_SIZE,
          search: debouncedSearch || undefined,
          loanProductId: productFilter || undefined,
          usage: usageFilter,
        },
        { signal: controller.signal },
      );

      if (controller.signal.aborted) return;

      setDocuments(json.data || []);
      setTotal(json.pagination?.total || 0);
      setTotalPages(json.pagination?.totalPages || 0);
      setPage(json.pagination?.page || page);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      toast.error(err.message || "Failed to load custom documents");
      setDocuments([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [page, debouncedSearch, productFilter, usageFilter]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 1) return [1];
    const pages: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    for (let i = start; i <= end; i += 1) {
      pages.push(i);
    }
    return pages;
  }, [page, totalPages]);

  const hasActiveFilters =
    debouncedSearch.length > 0 ||
    Boolean(productFilter) ||
    usageFilter !== "all";
  const showEmptyLibrary = !loading && total === 0 && !hasActiveFilters;
  const showNoFilterResults = !loading && total === 0 && hasActiveFilters;
  const usedOnPage = documents.filter((doc) => (doc.usageCount || 0) > 0).length;

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setProductFilter("");
    setUsageFilter("all");
    setPage(1);
  };

  const openCreateModal = () => {
    if (!canManage) return;
    setEditingDoc(null);
    setForm({
      ...emptyForm,
      loanProductId: productFilter || "",
    });
    setModalOpen(true);
  };

  const openEditModal = (doc: BrokerCustomDocument) => {
    if (!canManage) return;
    setEditingDoc(doc);
    const collapsedIds = collapseLoanProductIds(
      (doc.loanProductIds || []).filter(Boolean),
      loanProducts,
    );
    setForm({
      name: doc.name,
      description: doc.description || "",
      loanProductId: collapsedIds[0] || "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingDoc(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!canManage) {
      toast.error("You have view-only access to custom documents");
      return;
    }
    const name = form.name.trim();
    const description = form.description.trim();
    const loanProductId = form.loanProductId.trim();

    if (name.length < 2) {
      toast.error("Document name must be at least 2 characters");
      return;
    }

    if (!loanProductId) {
      toast.error("Select a loan product");
      return;
    }

    const loanProductIds = expandLoanProductIds(
      [loanProductId],
      loanProducts,
    );

    try {
      setSaving(true);
      if (editingDoc) {
        await updateBrokerCustomDocument(editingDoc.id, {
          name,
          description,
        });
        toast.success("Custom document updated");
      } else {
        await createBrokerCustomDocument({
          name,
          description,
          loanProductIds,
        });
        toast.success("Custom document created");
        setPage(1);
      }
      closeModal();
      await loadDocuments();
    } catch (err: any) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (doc: BrokerCustomDocument) => {
    if (!canManage) return;
    if (doc.isProtected) {
      toast.error("This system document cannot be removed");
      return;
    }

    const result = await Swal.fire({
      title: "Remove custom document?",
      html: doc.usageCount
        ? `This document is used on <strong>${doc.usageCount}</strong> application(s) and cannot be removed until those requests are cleared.`
        : `Remove <strong>${doc.name}</strong> from your document library?`,
      icon: doc.usageCount ? "warning" : "question",
      showCancelButton: !doc.usageCount,
      confirmButtonColor: doc.usageCount ? "#13538A" : "#dc2626",
      confirmButtonText: doc.usageCount ? "OK" : "Yes, remove",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed || doc.usageCount) return;

    try {
      await deactivateBrokerCustomDocument(doc.id);
      toast.success("Custom document removed");
      await loadDocuments();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove document");
    }
  };

  const getPrimaryProduct = (doc: BrokerCustomDocument) => {
    const products = collapseLoanProductLabels(doc.loanProducts || []);
    return products[0] || null;
  };

  const tableColSpan = canManage ? 6 : 5;

  return (
    <>
      <PageMeta
        title="Custom Documents | Broker Dashboard"
        description="Manage broker custom document types"
      />
      <PageBreadcrumb pageTitle="Custom Documents" />

      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  Custom Documents
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  {readOnly
                    ? "View your broker's custom document library. Contact your broker admin to request changes."
                    : "Create loan-product-specific document types. Only your broker organization can access them."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadDocuments()}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  <RefreshCw
                    size={16}
                    className={loading ? "animate-spin" : undefined}
                  />
                  Refresh
                </button>
                {canManage && (
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#13538A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0f4270]"
                  >
                    <Plus size={16} />
                    Add Document
                  </button>
                )}
              </div>
            </div>

            {readOnly && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                View-only access — you cannot add, edit, or remove custom
                documents.
              </div>
            )}
          </div>

          <div className="px-5 py-4 sm:px-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="xl:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Search
                </label>
                <div className="relative">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or description..."
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/10"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      aria-label="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Loan product
                </label>
                <select
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                  disabled={loadingProducts}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/10 disabled:opacity-60"
                >
                  <option value="">All loan products</option>
                  {selectableLoanProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name || product.code}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Usage
                </label>
                <select
                  value={usageFilter}
                  onChange={(e) =>
                    setUsageFilter(e.target.value as UsageFilter)
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/10"
                >
                  <option value="all">All documents</option>
                  <option value="used">In use</option>
                  <option value="unused">Not used</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <span className="inline-flex items-center rounded-full border border-[#13538A]/15 bg-[#13538A]/5 px-3 py-1 text-xs font-medium text-[#13538A]">
                {loading ? "…" : total} total
              </span>
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                {selectedFilterProduct
                  ? selectedFilterProduct.name
                  : "All loan products"}
              </span>
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                {usageFilter === "used"
                  ? "In use"
                  : usageFilter === "unused"
                    ? "Not used"
                    : "All usage"}
              </span>
              {!loading && documents.length > 0 && (
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  {usedOnPage} in use on page
                </span>
              )}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  <FilterX size={12} />
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {selectedFilterProduct
                  ? `Documents · ${selectedFilterProduct.name}`
                  : "Documents · All loan products"}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {selectedFilterProduct
                  ? "Custom documents configured for the selected loan product"
                  : "Custom documents across all loan products"}
                {debouncedSearch ? ` · Matching “${debouncedSearch}”` : ""}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto px-5 sm:px-6">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="py-3 pr-4">Document</th>
                  <th className="py-3 pr-4">Loan product</th>
                  <th className="py-3 pr-4">Description</th>
                  <th className="py-3 pr-4">Usage</th>
                  <th className="py-3 pr-4">Created</th>
                  {canManage && <th className="py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={tableColSpan} className="py-16 text-center">
                      <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#13538A]" />
                      <p className="mt-3 text-sm text-slate-500">
                        Loading documents...
                      </p>
                    </td>
                  </tr>
                ) : showEmptyLibrary ? (
                  <tr>
                    <td colSpan={tableColSpan} className="py-16 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                        <FileText size={24} />
                      </div>
                      <p className="mt-4 text-sm font-semibold text-slate-700">
                        No custom documents yet
                      </p>
                      <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
                        {readOnly
                          ? "No custom documents are available in your library yet."
                          : "Add a document linked to a loan product to reuse it when requesting files from clients."}
                      </p>
                      {canManage && (
                        <button
                          type="button"
                          onClick={openCreateModal}
                          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#13538A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f4270]"
                        >
                          <Plus size={16} />
                          Add your first document
                        </button>
                      )}
                    </td>
                  </tr>
                ) : showNoFilterResults ? (
                  <tr>
                    <td colSpan={tableColSpan} className="py-16 text-center">
                      <Search size={28} className="mx-auto mb-3 text-slate-300" />
                      <p className="text-sm font-semibold text-slate-700">
                        No documents found
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Try adjusting your search or filters.
                      </p>
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#13538A] hover:underline"
                      >
                        <FilterX size={14} />
                        Clear filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  documents.map((doc) => {
                    const product = getPrimaryProduct(doc);
                    const usageCount = doc.usageCount || 0;

                    return (
                      <tr
                        key={doc.id}
                        className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70"
                      >
                        <td className="py-3.5 pr-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#13538A]/10 text-[#13538A]">
                              <FileText size={16} />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-900">
                                {doc.name}
                              </p>
                              {doc.isProtected && (
                                <span className="mt-1 inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-violet-700">
                                  System
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="max-w-[220px] py-3.5 pr-4">
                          {product ? (
                            <>
                              <p
                                className="truncate font-medium text-slate-800"
                                title={product.name || product.code}
                              >
                                {product.name || product.code}
                              </p>
                              {product.code ? (
                                <p className="mt-0.5 truncate text-[11px] text-slate-400">
                                  {product.code}
                                </p>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="max-w-[280px] py-3.5 pr-4 text-slate-600">
                          <p
                            className="truncate"
                            title={doc.description || undefined}
                          >
                            {doc.description || "—"}
                          </p>
                        </td>
                        <td className="py-3.5 pr-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                              usageCount > 0
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-slate-50 text-slate-600"
                            }`}
                          >
                            {usageCount > 0
                              ? `${usageCount} app${usageCount === 1 ? "" : "s"}`
                              : "Not used"}
                          </span>
                        </td>
                        <td className="py-3.5 pr-4 text-slate-500">
                          {formatDate(doc.createdAt)}
                        </td>
                        {canManage && (
                          <td className="py-3.5 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                disabled={doc.isProtected}
                                onClick={() => openEditModal(doc)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Pencil size={14} />
                                Edit
                              </button>
                              <button
                                type="button"
                                disabled={doc.isProtected}
                                onClick={() => void handleDeactivate(doc)}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Trash2 size={14} />
                                Remove
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {!loading && totalPages > 1 && (
            <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-sm text-slate-600">
                Showing page {page} of {totalPages} · {total} total
              </p>

              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>

                {pageNumbers.map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    className={`min-w-[2.25rem] rounded-lg border px-3 py-1.5 text-sm font-medium ${
                      pageNumber === page
                        ? "border-[#13538A] bg-[#13538A] text-white"
                        : "border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {pageNumber}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingDoc ? "Edit Custom Document" : "Add Custom Document"}
                </h2>
                {selectedFormProduct ? (
                  <p className="mt-0.5 text-xs text-slate-500">
                    For {selectedFormProduct.name}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Document name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g. Operating Agreement"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/10"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Loan product *
                </label>
                <select
                  value={form.loanProductId}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      loanProductId: e.target.value,
                    }))
                  }
                  disabled={
                    Boolean(editingDoc) ||
                    saving ||
                    loadingProducts ||
                    selectableLoanProducts.length === 0
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/10 disabled:opacity-60"
                >
                  <option value="">
                    {loadingProducts
                      ? "Loading loan products..."
                      : "Select loan product"}
                  </option>
                  {selectableLoanProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name || product.code}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-slate-500">
                  {editingDoc
                    ? "Loan product cannot be changed while editing."
                    : selectedFormProduct
                      ? `Available for ${selectedFormProduct.name}, only to your broker organization.`
                      : "Select one loan product. Access stays limited to your broker organization."}
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Optional notes for your team"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/10"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || loadingProducts}
                onClick={() => void handleSave()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#13538A] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                {editingDoc ? "Save changes" : "Create document"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
