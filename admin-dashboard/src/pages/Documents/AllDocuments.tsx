import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import {
  Ban,
  CheckCircle2,
  FileText,
  Layers3,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import Swal from "sweetalert2";
import { filterLenderCatalogProducts } from "../../lib/canonicalLoanProducts";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const DEFAULT_PAGE_SIZE = 8;
const PAGE_SIZE_OPTIONS = [4, 8, 12, 16, 20] as const;
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
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
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
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const MENU_WIDTH = 168;
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
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
  const requiredOnPage = useMemo(
    () => documents.filter((doc) => doc.isRequired).length,
    [documents],
  );
  const inactiveOnPage = useMemo(
    () => documents.filter((doc) => !doc.isActive).length,
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
      pageNo = 1,
      searchQuery = "",
      productId = "",
      signal?: AbortSignal,
    ) => {
      try {
        setLoadingList(true);

        const params = new URLSearchParams({
          page: String(pageNo),
          limit: String(pageSize),
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
          {
            headers: getAuthHeaders({ json: false }),
            signal,
          },
        );

        if (signal?.aborted) return;

        const json = await res.json();
        if (!res.ok || !json.success) {
          toast.error(json.message || "Failed to load documents");
          return;
        }

        const total = Number(json.meta?.total || 0);
        const limit = Number(json.meta?.limit || pageSize);
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
        setCurrentPage((prev) => (prev === page ? prev : page));
      } catch (error) {
        if ((error as { name?: string })?.name === "AbortError") return;
        console.error(error);
        toast.error("Failed to load documents");
      } finally {
        if (!signal?.aborted) {
          setLoadingList(false);
        }
      }
    },
    [statusFilter, sourceFilter, pageSize],
  );

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setCurrentPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, sourceFilter, selectedProductId, pageSize]);

  useEffect(() => {
    closeForm();
  }, [selectedProductId]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchDocuments(
      currentPage,
      debouncedSearch,
      selectedProductId,
      controller.signal,
    );
    return () => controller.abort();
  }, [
    currentPage,
    debouncedSearch,
    selectedProductId,
    statusFilter,
    sourceFilter,
    pageSize,
    fetchDocuments,
  ]);

  useEffect(() => {
    if (!openMenuId) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest?.("[data-doc-menu-trigger]")) return;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setOpenMenuId(null);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenuId(null);
    };

    const onRepositionClose = () => setOpenMenuId(null);

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onRepositionClose);
    window.addEventListener("scroll", onRepositionClose, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onRepositionClose);
      window.removeEventListener("scroll", onRepositionClose, true);
    };
  }, [openMenuId]);

  const openRowMenu = (docKey: string, anchor: HTMLElement) => {
    const rect = anchor.getBoundingClientRect();
    const estimatedHeight = 96;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < estimatedHeight + 8;
    const top = openUp
      ? Math.max(8, rect.top - estimatedHeight - 4)
      : rect.bottom + 4;
    const left = Math.min(
      Math.max(8, rect.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - 8,
    );
    setMenuPos({ top, left });
    setOpenMenuId((prev) => (prev === docKey ? null : docKey));
  };

  const activeMenuDoc = useMemo(() => {
    if (!openMenuId) return null;
    return (
      documents.find(
        (doc) =>
          (doc.requirementId || `${doc.id}-${doc.loanProductId}`) ===
          openMenuId,
      ) || null
    );
  }, [documents, openMenuId]);

  const handleSubmit = async (event: FormEvent) => {
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
    <div className="space-y-4 text-gray-900 dark:text-gray-100">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#5D28A8] px-5 py-5 text-white sm:px-6 sm:py-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 left-1/3 h-36 w-36 rounded-full bg-fuchsia-300/20 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 ring-1 ring-white/20">
              <ShieldCheck className="h-3.5 w-3.5" />
              Loan requirements
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Document Management
            </h1>
            <p className="mt-1 max-w-xl text-sm text-white/80">
              Configure required documents for each loan program across admin,
              lender, and broker sources.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start">
            <button
              type="button"
              onClick={() =>
                fetchDocuments(currentPage, debouncedSearch, selectedProductId)
              }
              disabled={loadingList}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#13538A] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${loadingList ? "animate-spin" : ""}`}
              />
              {loadingList ? "Refreshing..." : "Refresh"}
            </button>
            <button
              type="button"
              onClick={openCreateForm}
              disabled={loadingProducts || products.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Add document
            </button>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Total documents",
            value: pagination.total,
            icon: Layers3,
            iconWrap:
              "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
          },
          {
            label: "Active on page",
            value: activeOnPage,
            icon: CheckCircle2,
            iconWrap:
              "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
          },
          {
            label: "Required on page",
            value: requiredOnPage,
            icon: ShieldCheck,
            iconWrap:
              "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
          },
          {
            label: "Inactive on page",
            value: inactiveOnPage,
            icon: Ban,
            iconWrap:
              "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3.5 dark:border-slate-700 dark:bg-slate-900"
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${stat.iconWrap}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 dark:text-slate-400">
                  {stat.label}
                </p>
                <p className="text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
                  {loadingList ? "-" : stat.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Table card + filters */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="space-y-3 border-b border-gray-100 p-4 dark:border-slate-800 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {selectedProduct
                  ? `Documents - ${selectedProduct.name}`
                  : "Documents - All loan programs"}
              </h2>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">
                {pagination.total} document{pagination.total === 1 ? "" : "s"}
                {debouncedSearch ? " matching search" : " in catalog"}
              </p>
            </div>

            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto_auto_auto] xl:items-end">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-slate-400">
                  Loan program
                </label>
                <select
                  value={selectedProductId}
                  onChange={(event) => setSelectedProductId(event.target.value)}
                  disabled={loadingProducts}
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/15 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
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
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-slate-400">
                  Search
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Search by name..."
                    className="h-10 w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm text-gray-900 outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/15 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
                  />
                  {searchInput ? (
                    <button
                      type="button"
                      onClick={() => setSearchInput("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-slate-400">
                  Source
                </label>
                <select
                  value={sourceFilter}
                  onChange={(event) =>
                    setSourceFilter(event.target.value as SourceFilter)
                  }
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/15 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="admin">Admin documents</option>
                  <option value="lender">Lender documents</option>
                  <option value="broker">Broker documents</option>
                  <option value="all">All sources</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-slate-400">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as StatusFilter)
                  }
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/15 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="all">All status</option>
                  <option value="active">Active only</option>
                  <option value="inactive">Inactive only</option>
                </select>
              </div>

              <label className="flex h-10 items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
                Per page
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-10 rounded-xl border border-gray-200 bg-white px-2.5 text-sm font-medium text-gray-700 outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/15 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto px-4 sm:px-5">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-slate-700 dark:text-slate-400">
                {!selectedProductId ? (
                  <th className="py-2.5 pr-4">Loan program</th>
                ) : null}
                <th className="py-2.5 pr-4">Document</th>
                <th className="py-2.5 pr-4">Created by</th>
                <th className="py-2.5 pr-4">Description</th>
                <th className="py-2.5 pr-4">Required</th>
                <th className="py-2.5 pr-4">Status</th>
                <th className="py-2.5 pr-4">Created</th>
                <th className="w-[72px] py-2.5 pr-0 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingList ? (
                <tr>
                  <td
                    colSpan={selectedProductId ? 7 : 8}
                    className="py-14 text-center"
                  >
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#13538A] dark:text-indigo-400" />
                    <p className="mt-3 text-sm text-gray-500 dark:text-slate-400">
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
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 dark:bg-slate-800">
                      <FileText className="h-6 w-6 text-gray-400 dark:text-slate-500" />
                    </div>
                    <p className="mt-4 text-sm font-semibold text-gray-800 dark:text-slate-200">
                      {selectedProductId
                        ? "No documents for this product"
                        : "No documents configured"}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                      {debouncedSearch ||
                      statusFilter !== "all" ||
                      sourceFilter !== "admin"
                        ? "Try adjusting your search or filters."
                        : "Use Add document to create the first one."}
                    </p>
                    {!debouncedSearch &&
                    statusFilter === "all" &&
                    sourceFilter === "admin" ? (
                      <button
                        type="button"
                        onClick={openCreateForm}
                        disabled={loadingProducts || products.length === 0}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#13538A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1b72be] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-indigo-600"
                      >
                        <Plus className="h-4 w-4" />
                        Add document
                      </button>
                    ) : null}
                  </td>
                </tr>
              ) : (
                documents.map((doc) => {
                  const docKey =
                    doc.requirementId || `${doc.id}-${doc.loanProductId}`;
                  const isBrokerDoc = doc.source === "BROKER";
                  const isLenderDoc = doc.source === "LENDER";
                  const isExternalDoc = isBrokerDoc || isLenderDoc;
                  const productLabel =
                    doc.loanProductName ||
                    products.find(
                      (product) =>
                        product.id === doc.loanProductId ||
                        product.code === doc.loanProductCode,
                    )?.name ||
                    "-";

                  return (
                    <tr
                      key={docKey}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50/80 dark:border-slate-800/80 dark:hover:bg-slate-800/40"
                    >
                      {!selectedProductId ? (
                        <td className="max-w-[220px] py-3 pr-4">
                          <p
                            className="truncate font-medium text-gray-800 dark:text-slate-100"
                            title={productLabel !== "-" ? productLabel : undefined}
                          >
                            {productLabel}
                          </p>
                          {doc.loanProductCode ? (
                            <p className="mt-0.5 text-[11px] text-gray-400 dark:text-slate-500">
                              {doc.loanProductCode}
                            </p>
                          ) : null}
                        </td>
                      ) : null}
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#13538A]/10 text-[#13538A] dark:bg-indigo-500/10 dark:text-indigo-300">
                            <FileText className="h-4 w-4" />
                          </div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {doc.name}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
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
                              className="max-w-[160px] truncate text-[11px] text-gray-400 dark:text-slate-500"
                              title={doc.createdByOrgName}
                            >
                              {doc.createdByOrgName}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="max-w-[280px] py-3 pr-4 text-gray-600 dark:text-slate-300">
                        <p className="truncate" title={doc.description || "-"}>
                          {doc.description || "-"}
                        </p>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                            doc.isRequired
                              ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
                              : "border-gray-200 bg-gray-50 text-gray-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {doc.isRequired ? "Required" : "Optional"}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
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
                      <td className="py-3 pr-4 whitespace-nowrap text-gray-500 dark:text-slate-400">
                        {formatDate(doc.createdAt)}
                      </td>
                      <td className="py-3 pr-0 text-right whitespace-nowrap">
                        <button
                          type="button"
                          data-doc-menu-trigger="true"
                          disabled={deletingId === (doc.requirementId || doc.id)}
                          title="More actions"
                          aria-label="More actions"
                          aria-expanded={openMenuId === docKey}
                          onClick={(event) => {
                            event.stopPropagation();
                            openRowMenu(docKey, event.currentTarget);
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {activeMenuDoc &&
          createPortal(
            <div
              ref={menuRef}
              style={{
                position: "fixed",
                top: menuPos.top,
                left: menuPos.left,
                width: MENU_WIDTH,
              }}
              className="z-[9999] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setOpenMenuId(null);
                  openEditForm(activeMenuDoc);
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-700 transition hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                type="button"
                disabled={
                  deletingId ===
                  (activeMenuDoc.requirementId || activeMenuDoc.id)
                }
                onClick={() => {
                  setOpenMenuId(null);
                  handleDelete(activeMenuDoc);
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                {deletingId ===
                (activeMenuDoc.requirementId || activeMenuDoc.id) ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Remove
              </button>
            </div>,
            document.body,
          )}

        {pagination.total > 0 ? (
          <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Showing{" "}
              <span className="font-medium text-gray-700 dark:text-slate-200">
                {showingFrom}-{showingTo}
              </span>{" "}
              of{" "}
              <span className="font-medium text-gray-700 dark:text-slate-200">
                {pagination.total}
              </span>
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                disabled={!pagination.hasPreviousPage || loadingList}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Prev
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
                      className={`min-w-8 rounded-lg px-2.5 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
                        pageNumber === currentPage
                          ? "bg-[#13538A] text-white dark:bg-indigo-600"
                          : "border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
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
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Create / Edit modal */}
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

          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {editingId ? "Edit Document" : "Add Document"}
                </h3>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                  {editingId && editingSource === "BROKER"
                    ? `Updating broker document${editingOrgName ? ` - ${editingOrgName}` : ""}`
                    : editingId && editingSource === "LENDER"
                      ? `Updating lender document${editingOrgName ? ` - ${editingOrgName}` : ""}`
                      : formProduct
                        ? `${editingId ? "Update" : "Create"} document for ${formProduct.name}`
                        : "Choose a loan program and fill document details"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
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
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/10 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100"
                >
                  <option value="">Select loan program</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
                {editingId ? (
                  <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                    Product cannot be changed while editing.
                  </p>
                ) : formProduct ? (
                  <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                    Code:{" "}
                    <span className="font-medium text-gray-700 dark:text-slate-300">
                      {formProduct.code}
                    </span>
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
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
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/10 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
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
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/10 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100"
                />
              </div>

              <label className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-3 dark:border-slate-700">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-100">
                    Required Document
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
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
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#13538A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1b72be] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-indigo-600"
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
