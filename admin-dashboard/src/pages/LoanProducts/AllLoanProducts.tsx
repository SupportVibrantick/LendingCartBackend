// src/pages/LoanProducts/AllLoanProducts.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import {
  Ban,
  CheckCircle2,
  Layers3,
  MoreVertical,
  Package,
  Pencil,
  RefreshCw,
  Search,
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
  description?: string | null;
  isActive: boolean;
  createdAt?: string;
};

type LoanProductForm = {
  code: string;
  name: string;
  description: string;
};

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

// same as BrokersPage
function getAuthHeaders(options?: {
  json?: boolean;
}): Record<string, string> {
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
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [form, setForm] = useState<LoanProductForm>({
    code: "",
    name: "",
    description: "",
  });

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
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
  const fetchLoanProducts = useCallback(
    async (pageNo = currentPage, searchQuery = debouncedSearch) => {
      try {
        setLoadingList(true);

        const params = new URLSearchParams({
          page: String(pageNo),
          limit: String(pageSize),
        });
        if (searchQuery.trim()) {
          params.set("search", searchQuery.trim());
        }

        const res = await fetch(
          `${API_BASE}/admin/loan-products/list?${params.toString()}`,
          {
            method: "GET",
            headers: getAuthHeaders(),
          },
        );

        if (!res.ok) {
          console.error("Failed to load loan products:", res.status);
          toast.error("Failed to load loan products");
          return;
        }

        const json = await res.json();
        if (!json.success) {
          console.error("Failed to load loan products:", json.message);
          toast.error(json.message || "Failed to load loan products");
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

        const meta = json.pagination || {};
        const total = Number(meta.total) || mapped.length;
        const limit = Number(meta.limit) || pageSize;
        const page = Number(meta.page) || pageNo;
        const totalPages = Math.max(
          1,
          Number(meta.totalPages) || Math.ceil(total / limit) || 1,
        );

        setPagination({
          page,
          limit,
          total,
          totalPages,
          hasNextPage: Boolean(meta.hasNextPage ?? page < totalPages),
          hasPreviousPage: Boolean(meta.hasPreviousPage ?? page > 1),
        });

        if (page !== pageNo) {
          setCurrentPage(page);
        }
      } catch (err) {
        console.error("Failed to load loan products", err);
        toast.error("Failed to load loan products");
      } finally {
        setLoadingList(false);
      }
    },
    [currentPage, debouncedSearch, pageSize],
  );

  const fetchLoanProductCodes = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/common/loan-products/loan-product-code`,
      );

      const json = await res.json();

      if (json?.success) {
        setLoanProductOptions(
          filterLenderCatalogProducts(
            (json.data || []).map(
              (item: { id: string; code: string; name: string }) => ({
                id: String(item.id),
                code: item.code,
                name: item.name,
              }),
            ),
          ),
        );
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
        // PATCH /admin/loan-products/update/:id
        const res = await fetch(
          `${API_BASE}/admin/loan-products/update/${editingProductId}`,
          {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({
              name: form.name.trim(),
              description: form.description.trim(),
            }),
          },
        );

        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
          toast.error(json.message || "Failed to update product");
          return;
        }

        toast.success(json.message || "Loan product updated successfully");
      } else {
        const res = await fetch(`${API_BASE}/admin/loan-products/create`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            code: form.code,
            name: form.name.trim(),
            description: form.description.trim() || undefined,
          }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
          toast.error(json.message || "Failed to create product");
          return;
        }

        toast.success(json.message || "Loan product created successfully");
      }

      await fetchLoanProducts(currentPage, debouncedSearch);
      resetForm();
    } catch (err) {
      console.error("Error saving loan product", err);
      toast.error("Error saving loan product");
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

      await fetchLoanProducts(currentPage, debouncedSearch);
    } catch (err) {
      console.error("Failed to toggle product status", err);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (product: LoanProduct) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: `Deleting loan product "${product.name}" will permanently remove it. This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete it!",
    });

    if (!result.isConfirmed) return;

    try {
      setDeletingId(product.id);

      const res = await fetch(
        `${API_BASE}/admin/loan-products/delete/${product.id}`,
        {
          method: "DELETE",
          headers: getAuthHeaders({ json: false }),
        },
      );

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        await Swal.fire({
          icon: "error",
          title: "Delete failed",
          text: json.message || "Failed to delete loan product",
        });
        return;
      }

      if (editingProductId === product.id) {
        resetForm();
      }

      await fetchLoanProducts(currentPage, debouncedSearch);

      await Swal.fire({
        icon: "success",
        title: "Deleted!",
        text: json.message || "Loan product deleted successfully.",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("Failed to delete loan product", err);
      await Swal.fire({
        icon: "error",
        title: "Delete failed",
        text: "Failed to delete loan product",
      });
    } finally {
      setDeletingId(null);
    }
  };

  // ===== Effects =====
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    fetchLoanProducts(currentPage, debouncedSearch);
  }, [currentPage, debouncedSearch, pageSize, fetchLoanProducts]);

  useEffect(() => {
    fetchLoanProductCodes();
  }, []);

  useEffect(() => {
    if (!openMenuId) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest?.("[data-product-menu-trigger]")) return;
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

  const openRowMenu = (productId: string, anchor: HTMLElement) => {
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
    setOpenMenuId((prev) => (prev === productId ? null : productId));
  };

  const activeMenuProduct = useMemo(
    () => products.find((p) => p.id === openMenuId) || null,
    [products, openMenuId],
  );

  const showingFrom =
    pagination.total === 0
      ? 0
      : (pagination.page - 1) * pagination.limit + 1;
  const showingTo = Math.min(
    pagination.page * pagination.limit,
    pagination.total,
  );

  const pageActiveCount = useMemo(
    () => products.filter((p) => p.isActive).length,
    [products],
  );
  const pageInactiveCount = useMemo(
    () => products.filter((p) => !p.isActive).length,
    [products],
  );

  const inputClass =
    "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/15 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100";

  // ===== UI =====
  return (
    <div className="space-y-4 text-gray-900 dark:text-gray-100">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#5D28A8] px-5 py-5 text-white sm:px-6 sm:py-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 left-1/3 h-36 w-36 rounded-full bg-fuchsia-300/20 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 ring-1 ring-white/20">
              <Package className="h-3.5 w-3.5" />
              Product catalog
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Loan Products
            </h1>
            <p className="mt-1 max-w-xl text-sm text-white/80">
              Manage global loan products available across lenders and
              applications.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchLoanProducts(currentPage, debouncedSearch)}
            disabled={loadingList}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#13538A] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${loadingList ? "animate-spin" : ""}`}
            />
            {loadingList ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {
            label: "Total products",
            value: pagination.total,
            icon: Layers3,
            iconWrap: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
          },
          {
            label: "Active on page",
            value: pageActiveCount,
            icon: CheckCircle2,
            iconWrap:
              "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
          },
          {
            label: "Inactive on page",
            value: pageInactiveCount,
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
                  {loadingList ? "—" : stat.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* LEFT – Create / Edit */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {editingProductId ? "Edit loan product" : "Add loan product"}
            </h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">
              {editingProductId
                ? "Update name and description for this product."
                : "Define a product lenders can offer on applications."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-200">
                Product code
              </label>
              <select
                className={inputClass}
                value={form.code}
                onChange={(e) => {
                  const selected = loanProductOptions.find(
                    (item) => item.code === e.target.value,
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
                <p className="mt-1.5 text-xs text-gray-500 dark:text-slate-400">
                  Code cannot be changed for existing products.
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-200">
                Name
              </label>
              <input
                type="text"
                className={inputClass}
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. SBA Loan, DSCR Loan"
                disabled={saving}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-200">
                Description
              </label>
              <textarea
                className={`${inputClass} resize-none`}
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Short description of this loan product"
                disabled={saving}
              />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#13538A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1b72be] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? editingProductId
                    ? "Saving..."
                    : "Creating..."
                  : editingProductId
                    ? "Save changes"
                    : "Create product"}
              </button>

              {editingProductId && (
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* RIGHT – Products table */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                All loan products
              </h2>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">
                Platform-wide catalog configured by Super Admin.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <div className="relative w-full sm:w-56">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search products..."
                  className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm text-gray-900 outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/15 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput("");
                      setCurrentPage(1);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <label className="flex items-center gap-2 self-end text-xs text-gray-500 sm:self-auto dark:text-slate-400">
                Per page
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-9 rounded-xl border border-gray-200 bg-white px-2.5 text-sm font-medium text-gray-700 outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/15 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
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

          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="w-[200px] py-2.5 pr-4">Name</th>
                  <th className="py-2.5 pr-4">Description</th>
                  <th className="w-[120px] py-2.5 pr-4">Status</th>
                  <th className="w-[110px] py-2.5 pr-4">Created</th>
                  <th className="w-[72px] py-2.5 pr-0 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {loadingList ? (
                  <tr>
                    <td
                      className="py-12 text-center text-gray-500 dark:text-slate-400"
                      colSpan={5}
                    >
                      <div className="inline-flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Loading products...
                      </div>
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td className="py-12" colSpan={5}>
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 dark:bg-slate-800 dark:text-slate-500">
                          <Package className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-medium text-gray-800 dark:text-slate-200">
                          {debouncedSearch
                            ? "No results found"
                            : "No loan products yet"}
                        </p>
                        <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-slate-400">
                          {debouncedSearch
                            ? `Nothing matched "${debouncedSearch}". Try a different search.`
                            : "Create your first product using the form on the left."}
                        </p>
                        {debouncedSearch && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchInput("");
                              setCurrentPage(1);
                            }}
                            className="mt-3 text-sm font-medium text-[#13538A] hover:underline dark:text-sky-400"
                          >
                            Clear search
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-gray-50 text-sm last:border-0 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:bg-slate-800/50"
                    >
                      <td className="py-3 pr-4">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {p.name}
                        </div>
                        <div className="mt-0.5 text-xs text-gray-400 dark:text-slate-500">
                          {p.code}
                        </div>
                      </td>
                      <td className="max-w-[360px] py-3 pr-4 text-gray-600 dark:text-slate-300">
                        <div className="truncate" title={p.description || "-"}>
                          {p.description || "—"}
                        </div>
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            if (!togglingId) handleToggleStatus(p);
                          }}
                          disabled={togglingId === p.id}
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${statusClass(
                            p.isActive ? "ACTIVE" : "INACTIVE",
                          )}`}
                        >
                          {togglingId === p.id
                            ? "Updating..."
                            : p.isActive
                              ? "Active"
                              : "Inactive"}
                        </button>
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap text-gray-600 dark:text-slate-300">
                        {formatDate(p.createdAt)}
                      </td>
                      <td className="py-3 pr-0 text-right whitespace-nowrap">
                        <button
                          type="button"
                          data-product-menu-trigger="true"
                          disabled={deletingId === p.id}
                          title="More actions"
                          aria-label="More actions"
                          onClick={(e) => {
                            e.stopPropagation();
                            openRowMenu(p.id, e.currentTarget);
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {activeMenuProduct &&
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
                onMouseDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenuId(null);
                    handleEdit(activeMenuProduct);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-700 transition hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  type="button"
                  disabled={deletingId === activeMenuProduct.id}
                  onClick={() => {
                    setOpenMenuId(null);
                    handleDelete(activeMenuProduct);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>,
              document.body,
            )}

          {pagination.total > 0 && (
            <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Showing{" "}
                <span className="font-medium text-gray-700 dark:text-slate-200">
                  {showingFrom}–{showingTo}
                </span>{" "}
                of{" "}
                <span className="font-medium text-gray-700 dark:text-slate-200">
                  {pagination.total}
                </span>
              </p>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={!pagination.hasPreviousPage || loadingList}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Prev
                </button>

                {Array.from({ length: pagination.totalPages }).map((_, i) => {
                  const page = i + 1;
                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      disabled={loadingList}
                      className={`min-w-8 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition ${
                        currentPage === page
                          ? "border-[#13538A] bg-[#13538A] text-white"
                          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((p) =>
                      Math.min(p + 1, pagination.totalPages),
                    )
                  }
                  disabled={!pagination.hasNextPage || loadingList}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AllLoanProducts;
