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
import StatPill from "../../components/common/StatPill";
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
const PAGE_SIZE_OPTIONS = [10, 15, 25] as const;
const SEARCH_DEBOUNCE_MS = 400;

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelative(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 86_400_000 * 7) return `${Math.floor(diff / 86_400_000)}d ago`;
  return formatDate(value);
}

function UsagePill({ count }: { count: number }) {
  if (count > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {count} app{count === 1 ? "" : "s"}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
      <CircleDashed className="h-3.5 w-3.5" />
      Unused
    </span>
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
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [listStats, setListStats] = useState({
    total: 0,
    used: 0,
    unused: 0,
  });
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
      setListStats({
        total: json.stats?.total ?? json.pagination?.total ?? 0,
        used: json.stats?.used ?? 0,
        unused: json.stats?.unused ?? 0,
      });
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      toast.error(err.message || "Failed to load custom documents");
      setDocuments([]);
      setTotal(0);
      setTotalPages(0);
      setListStats({ total: 0, used: 0, unused: 0 });
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
      confirmButtonColor: doc.usageCount ? "#4C78F5" : "#dc2626",
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

      <div className="w-full min-w-0 space-y-4 pb-4 text-text-primary dark:text-slate-100">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="ds-page-title">Custom Documents</h1>
            <p className="ds-page-subtitle">
              {readOnly
                ? "View your broker's custom document library. Contact your broker admin to request changes."
                : "Create loan-product-specific document types for your organization."}
            </p>
          </div>
          {canManage ? (
            <button
              type="button"
              onClick={openCreateModal}
              className="ds-btn-primary shrink-0"
            >
              <Plus size={16} />
              Add document
            </button>
          ) : null}
        </div>

        {readOnly ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            View-only access — you cannot add, edit, or remove custom documents.
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <StatPill
            icon={<FileText size={14} />}
            label="Total"
            value={listStats.total}
            color="blue"
            loading={loading && listStats.total === 0}
            active={usageFilter === "all"}
            onClick={() => {
              setUsageFilter("all");
              setPage(1);
            }}
          />
          <StatPill
            icon={<CheckCircle2 size={14} />}
            label="In use"
            value={listStats.used}
            color="emerald"
            loading={loading && listStats.total === 0}
            active={usageFilter === "used"}
            onClick={() => {
              setUsageFilter("used");
              setPage(1);
            }}
          />
          <StatPill
            icon={<CircleDashed size={14} />}
            label="Unused"
            value={listStats.unused}
            color="amber"
            loading={loading && listStats.total === 0}
            active={usageFilter === "unused"}
            onClick={() => {
              setUsageFilter("unused");
              setPage(1);
            }}
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-2.5 border-b border-border px-4 py-3.5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-center lg:min-w-0 lg:flex-1">
              <div className="group relative w-full sm:max-w-sm">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-secondary transition-colors group-focus-within:text-[#4C78F5]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search documents..."
                  className="h-10 w-full rounded-xl border border-border bg-white py-2 pr-9 pl-10 text-sm text-text-primary outline-none transition placeholder:text-text-secondary/70 focus:border-[#4C78F5]/50 focus:ring-2 focus:ring-[#4C78F5]/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-text-secondary hover:bg-surface"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>

              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                disabled={loadingProducts}
                className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-text-primary outline-none transition focus:border-[#4C78F5]/50 focus:ring-2 focus:ring-[#4C78F5]/15 disabled:opacity-60 sm:w-[180px] dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">All products</option>
                {selectableLoanProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name || product.code}
                  </option>
                ))}
              </select>

              <select
                value={usageFilter}
                onChange={(e) => setUsageFilter(e.target.value as UsageFilter)}
                className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-text-primary outline-none transition focus:border-[#4C78F5]/50 focus:ring-2 focus:ring-[#4C78F5]/15 sm:w-[140px] dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="all">All usage</option>
                <option value="used">In use</option>
                <option value="unused">Unused</option>
              </select>

              <button
                type="button"
                onClick={() => void loadDocuments()}
                disabled={loading || isSearching}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-white px-3 text-sm font-medium text-text-secondary transition hover:bg-surface disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>

            <div className="flex items-center gap-2">
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-white px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface dark:border-slate-700 dark:bg-slate-950"
                >
                  <FilterX className="h-3.5 w-3.5" />
                  Clear
                </button>
              ) : null}
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="h-10 w-full shrink-0 rounded-xl border border-border bg-white px-3 text-sm text-text-primary outline-none transition focus:border-[#4C78F5]/50 focus:ring-2 focus:ring-[#4C78F5]/15 sm:w-[120px] dark:border-slate-700 dark:bg-slate-950"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="ds-table min-w-[880px] w-full">
              <thead>
                <tr>
                  <th>Document</th>
                  <th className="hidden sm:table-cell">Product</th>
                  <th>Usage</th>
                  <th className="hidden md:table-cell">Description</th>
                  <th className="hidden lg:table-cell">Last touch</th>
                  {canManage ? <th className="!text-right">Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={tableColSpan} className="px-5 py-14 text-center">
                      <div className="inline-flex items-center gap-2 text-sm text-text-secondary">
                        <Loader2 className="h-4 w-4 animate-spin text-[#4C78F5]" />
                        Loading documents…
                      </div>
                    </td>
                  </tr>
                ) : showEmptyLibrary ? (
                  <tr>
                    <td
                      colSpan={tableColSpan}
                      className="!px-5 !py-14 text-center"
                    >
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#4C78F5]/10 text-[#4C78F5]">
                        <FileText className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-semibold text-text-primary">
                        No custom documents yet
                      </p>
                      <p className="mx-auto mt-1.5 max-w-sm text-xs text-text-secondary">
                        {readOnly
                          ? "No custom documents are available in your library yet."
                          : "Add a document linked to a loan product to reuse it when requesting files from clients."}
                      </p>
                      {canManage ? (
                        <button
                          type="button"
                          onClick={openCreateModal}
                          className="ds-btn-primary mt-4 h-9 px-4 text-xs"
                        >
                          <Plus size={14} />
                          Add document
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ) : showNoFilterResults ? (
                  <tr>
                    <td
                      colSpan={tableColSpan}
                      className="!px-5 !py-14 text-center"
                    >
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#4C78F5]/10 text-[#4C78F5]">
                        <Search className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-semibold text-text-primary">
                        No documents match your filters
                      </p>
                      <p className="mx-auto mt-1.5 max-w-sm text-xs text-text-secondary">
                        Try a different search term or filter.
                      </p>
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="mt-4 text-xs font-semibold text-[#4C78F5] hover:underline"
                      >
                        Clear filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  documents.map((doc) => {
                    const product = getPrimaryProduct(doc);
                    const usageCount = doc.usageCount || 0;

                    return (
                      <tr key={doc.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4C78F5] text-white">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="ds-table-title">{doc.name}</p>
                              <p className="ds-table-meta">
                                {doc.isProtected
                                  ? "System document"
                                  : doc.id.slice(0, 8).toUpperCase()}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="hidden sm:table-cell">
                          {product ? (
                            <span
                              className="inline-flex max-w-[180px] truncate rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium lowercase text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              title={product.name || product.code}
                            >
                              {product.name || product.code}
                            </span>
                          ) : (
                            <span className="text-[12px] font-medium italic text-text-secondary/70">
                              Not set
                            </span>
                          )}
                        </td>

                        <td>
                          <UsagePill count={usageCount} />
                        </td>

                        <td className="hidden max-w-[260px] md:table-cell">
                          {doc.description ? (
                            <p
                              className="truncate text-sm text-text-secondary"
                              title={doc.description}
                            >
                              {doc.description}
                            </p>
                          ) : (
                            <span className="text-[12px] font-medium italic text-text-secondary/70">
                              Not provided
                            </span>
                          )}
                        </td>

                        <td className="hidden ds-table-muted whitespace-nowrap lg:table-cell">
                          {formatRelative(doc.createdAt)}
                        </td>

                        {canManage ? (
                          <td className="text-right">
                            <div className="inline-flex items-center justify-end gap-2">
                              <button
                                type="button"
                                disabled={doc.isProtected}
                                onClick={() => openEditModal(doc)}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#4C78F5] px-3 text-xs font-semibold text-white transition hover:bg-[#3B66E0] disabled:opacity-40"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </button>
                              <button
                                type="button"
                                disabled={doc.isProtected}
                                onClick={() => void handleDeactivate(doc)}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-text-secondary transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950"
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

          {!loading && !isSearching && documents.length > 0 ? (
            <div className="flex flex-col gap-3 border-t border-border px-4 py-3.5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-[13px] text-text-secondary">
                Showing{" "}
                <span className="font-semibold text-text-primary">
                  {total === 0 ? 0 : (page - 1) * limit + 1}
                </span>
                –
                <span className="font-semibold text-text-primary">
                  {Math.min(page * limit, total)}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-text-primary">{total}</span>
              </p>

              {totalPages > 1 ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-surface disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {Array.from({
                    length: Math.min(Math.max(totalPages, 1), 5),
                  }).map((_, i) => {
                    const half = Math.floor(5 / 2);
                    let startPage = 1;
                    if (totalPages <= 5) startPage = 1;
                    else if (page <= half + 1) startPage = 1;
                    else if (page >= totalPages - half)
                      startPage = totalPages - 4;
                    else startPage = page - half;

                    const pageNum = startPage + i;
                    if (pageNum > totalPages) return null;

                    return (
                      <button
                        key={pageNum}
                        type="button"
                        disabled={loading}
                        onClick={() => setPage(pageNum)}
                        className={`inline-flex h-9 min-w-9 items-center justify-center rounded-xl px-2.5 text-sm font-semibold transition ${
                          pageNum === page
                            ? "bg-[#4C78F5] text-white"
                            : "border border-border bg-white hover:bg-surface dark:border-slate-700 dark:bg-slate-950"
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
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-surface disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
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
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#4C78F5] focus:ring-2 focus:ring-[#4C78F5]/10"
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
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#4C78F5] focus:ring-2 focus:ring-[#4C78F5]/10 disabled:opacity-60"
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
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#4C78F5] focus:ring-2 focus:ring-[#4C78F5]/10"
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
                className="inline-flex items-center gap-2 rounded-xl bg-[#4C78F5] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
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
