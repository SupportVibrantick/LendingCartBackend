import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
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
const PAGE_SIZE_OPTIONS = [5, 8, 10, 20] as const;
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

function StatCard({
  icon: Icon,
  label,
  value,
  iconWrap,
}: {
  icon: typeof FileText;
  label: string;
  value: number | string;
  iconWrap: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3.5 dark:border-gray-800 dark:bg-gray-900">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconWrap}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {label}
        </p>
        <p className="text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
          {value}
        </p>
      </div>
    </div>
  );
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
  const [limit, setLimit] = useState(8);
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
          limit,
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
  }, [page, limit, debouncedSearch, productFilter, usageFilter]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const hasActiveFilters =
    debouncedSearch.length > 0 ||
    Boolean(productFilter) ||
    usageFilter !== "all";
  const showEmptyLibrary = !loading && total === 0 && !hasActiveFilters;
  const showNoFilterResults = !loading && total === 0 && hasActiveFilters;
  const usedOnPage = documents.filter((doc) => (doc.usageCount || 0) > 0).length;
  const unusedOnPage = documents.length - usedOnPage;
  const isSearching = search.trim() !== debouncedSearch;

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

      <div className="space-y-4 pb-4">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#2C92D5] px-5 py-5 text-white sm:px-6 sm:py-6">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 left-1/3 h-36 w-36 rounded-full bg-cyan-300/20 blur-2xl" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 ring-1 ring-white/20">
                <FileText className="h-3.5 w-3.5" />
                Documents
              </div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Custom Documents
              </h1>
              <p className="mt-1 max-w-xl text-sm text-white/80">
                {readOnly
                  ? "View your broker's custom document library. Contact your broker admin to request changes."
                  : "Create loan-product-specific document types for your organization."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void loadDocuments()}
                disabled={loading || isSearching}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
              {canManage ? (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#13538A] transition hover:bg-white/90"
                >
                  <Plus className="h-4 w-4" />
                  Add document
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {readOnly ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            View-only access — you cannot add, edit, or remove custom documents.
          </div>
        ) : null}

        {/* KPIs */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            icon={FileText}
            label="Total documents"
            value={loading ? "—" : total}
            iconWrap="bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
          />
          <StatCard
            icon={CheckCircle2}
            label="In use on page"
            value={loading ? "—" : usedOnPage}
            iconWrap="bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
          />
          <StatCard
            icon={CircleDashed}
            label="Unused on page"
            value={loading ? "—" : unusedOnPage}
            iconWrap="bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
          />
        </div>

        {/* Toolbar + table */}
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-4 py-4 dark:border-gray-800 sm:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  {selectedFilterProduct
                    ? selectedFilterProduct.name
                    : "All documents"}
                </h2>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  {loading || isSearching
                    ? isSearching
                      ? "Searching..."
                      : "Loading documents..."
                    : `${total} document${total === 1 ? "" : "s"}${
                        debouncedSearch ? ` matching "${debouncedSearch}"` : ""
                      }${
                        usageFilter === "used"
                          ? " · In use"
                          : usageFilter === "unused"
                            ? " · Not used"
                            : ""
                      }`}
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                <div className="relative w-full sm:w-56">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search documents..."
                    className="h-10 w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/15 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                  {search ? (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-gray-400 hover:text-gray-600"
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                <select
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                  disabled={loadingProducts}
                  className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/15 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                >
                  <option value="">All loan products</option>
                  {selectableLoanProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name || product.code}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1.5">
                  {(
                    [
                      ["all", "All"],
                      ["used", "In use"],
                      ["unused", "Unused"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setUsageFilter(value)}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        usageFilter === value
                          ? "bg-[#13538A] text-white"
                          : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  Per page
                  <select
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setPage(1);
                    }}
                    className="h-10 rounded-xl border border-gray-200 bg-white px-2.5 text-sm font-medium text-gray-700 outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/15 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>

                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300"
                  >
                    <FilterX className="h-3.5 w-3.5" />
                    Clear
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-[1] bg-slate-50/95 backdrop-blur dark:bg-gray-800/90">
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Document
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Loan product
                  </th>
                  <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 md:table-cell">
                    Description
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Usage
                  </th>
                  <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 sm:table-cell">
                    Created
                  </th>
                  {canManage ? (
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Actions
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loading ? (
                  <tr>
                    <td colSpan={tableColSpan} className="px-4 py-16 text-center">
                      <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#13538A]" />
                      <p className="mt-3 text-sm text-gray-500">
                        Loading documents...
                      </p>
                    </td>
                  </tr>
                ) : showEmptyLibrary ? (
                  <tr>
                    <td colSpan={tableColSpan} className="px-4 py-16 text-center">
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#13538A]/10 text-[#13538A]">
                        <FileText size={24} />
                      </div>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        No custom documents yet
                      </p>
                      <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
                        {readOnly
                          ? "No custom documents are available in your library yet."
                          : "Add a document linked to a loan product to reuse it when requesting files from clients."}
                      </p>
                      {canManage ? (
                        <button
                          type="button"
                          onClick={openCreateModal}
                          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#13538A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a6aad]"
                        >
                          <Plus className="h-4 w-4" />
                          Add your first document
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ) : showNoFilterResults ? (
                  <tr>
                    <td colSpan={tableColSpan} className="px-4 py-16 text-center">
                      <Search
                        size={28}
                        className="mx-auto mb-3 text-gray-300"
                      />
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        No documents found
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        Try adjusting your search or filters.
                      </p>
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#13538A] hover:underline"
                      >
                        <FilterX className="h-3.5 w-3.5" />
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
                        className="group transition-colors hover:bg-[#13538A]/[0.03] dark:hover:bg-gray-800/40"
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#13538A]/10 text-[#13538A]">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {doc.name}
                              </p>
                              {doc.isProtected ? (
                                <span className="mt-1 inline-flex rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                                  System
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="max-w-[220px] px-4 py-3.5">
                          {product ? (
                            <>
                              <p
                                className="truncate text-sm font-medium text-gray-800 dark:text-gray-200"
                                title={product.name || product.code}
                              >
                                {product.name || product.code}
                              </p>
                              {product.code ? (
                                <p className="mt-0.5 truncate text-xs text-gray-400">
                                  {product.code}
                                </p>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>
                        <td className="hidden max-w-[280px] px-4 py-3.5 md:table-cell">
                          <p
                            className="truncate text-sm text-gray-600 dark:text-gray-300"
                            title={doc.description || undefined}
                          >
                            {doc.description || "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                              usageCount > 0
                                ? "bg-emerald-50 text-emerald-700 ring-emerald-200/80 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30"
                                : "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
                            }`}
                          >
                            {usageCount > 0
                              ? `${usageCount} app${usageCount === 1 ? "" : "s"}`
                              : "Not used"}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3.5 sm:table-cell">
                          <span className="block truncate text-sm text-gray-600 dark:text-gray-300">
                            {formatDate(doc.createdAt)}
                          </span>
                        </td>
                        {canManage ? (
                          <td className="px-4 py-3.5 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={doc.isProtected}
                                onClick={() => openEditModal(doc)}
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </button>
                              <button
                                type="button"
                                disabled={doc.isProtected}
                                onClick={() => void handleDeactivate(doc)}
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-500/30 dark:bg-gray-900 dark:text-red-400"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Remove
                              </button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {!loading && !isSearching && documents.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing{" "}
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {total === 0 ? 0 : (page - 1) * limit + 1}-
                  {Math.min(page * limit, total)}
                </span>{" "}
                of{" "}
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {total}
                </span>
              </p>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                >
                  <span className="inline-flex items-center gap-1">
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </span>
                </button>

                {Array.from({
                  length: Math.min(Math.max(totalPages, 1), 5),
                }).map((_, i) => {
                  const half = Math.floor(5 / 2);
                  let startPage = 1;
                  if (totalPages <= 5) startPage = 1;
                  else if (page <= half + 1) startPage = 1;
                  else if (page >= totalPages - half) startPage = totalPages - 4;
                  else startPage = page - half;

                  const pageNum = startPage + i;
                  if (pageNum > totalPages) return null;

                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setPage(pageNum)}
                      disabled={loading}
                      className={`min-w-8 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition ${
                        pageNum === page
                          ? "border-[#13538A] bg-[#13538A] text-white"
                          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  type="button"
                  disabled={page >= totalPages || loading || totalPages < 1}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                >
                  <span className="inline-flex items-center gap-1">
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </span>
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
