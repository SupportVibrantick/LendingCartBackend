import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  FileText,
  Loader2,
  Lock,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { MdModeEdit } from "react-icons/md";
import { BsThreeDotsVertical } from "react-icons/bs";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { formatLoanProduct } from "../../lib/loanPipelineUtils";
import { getLenderAuthHeaders } from "../../lib/lenderApi";
import { cleanupOrphanedCustomDocumentTypes } from "../../lib/documentConfigApi";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

type LenderLoanProduct = {
  id: string;
  loanProductCode: string;
  loanProduct?: {
    name?: string;
    code?: string;
  };
};

type DocumentConfig = {
  id: string;
  lenderProductId: string;
  loanProductCode?: string | null;
  documentTypeId: string;
  documentName?: string | null;
  isCustom?: boolean;
  isRequired: boolean;
  minFiles: number | null;
  maxFiles: number | null;
  notes?: string | null;
  sortOrder?: number | null;
  createdAt?: string;
};

type DocumentForm = {
  lenderProductId: string;
  documentName: string;
  isRequired: boolean;
  minFiles: number;
  maxFiles: number;
  notes: string;
  sortOrder: number;
};

const DEFAULT_FORM: DocumentForm = {
  lenderProductId: "",
  documentName: "",
  isRequired: true,
  minFiles: 1,
  maxFiles: 5,
  notes: "",
  sortOrder: 1,
};

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

function getSwalTheme() {
  const isDark = document.documentElement.classList.contains("dark");

  return {
    background: isDark ? "#1e293b" : "#ffffff",
    color: isDark ? "#e2e8f0" : "#1e293b",
    customClass: {
      popup: "rounded-2xl",
      container: "swal-high-zindex",
    },
  };
}

function FieldLabel({
  step,
  label,
  hint,
}: {
  step: number;
  label: string;
  hint?: string;
}) {
  return (
    <div className="mb-2">
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#183b57]/10 text-[11px] font-bold text-[#183b57] dark:bg-brand-500/15 dark:text-brand-300">
          {step}
        </span>
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {label}
        </span>
      </div>
      {hint ? (
        <p className="mt-1 pl-8 text-[11px] leading-relaxed text-slate-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#183b57] focus:ring-2 focus:ring-[#183b57]/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-brand-500/20 dark:disabled:bg-slate-800/60";

export default function AllDocuments() {
  const [loanProducts, setLoanProducts] = useState<LenderLoanProduct[]>([]);
  const [documentConfigs, setDocumentConfigs] = useState<DocumentConfig[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [selectedProductFilter, setSelectedProductFilter] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [debouncedTableSearch, setDebouncedTableSearch] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<DocumentForm>(DEFAULT_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const productNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    loanProducts.forEach((product) => {
      map.set(
        product.loanProductCode,
        product.loanProduct?.name || formatLoanProduct(product.loanProductCode),
      );
    });
    return map;
  }, [loanProducts]);

  const resolveProductLabel = useCallback(
    (config: DocumentConfig) => {
      if (config.loanProductCode) {
        return (
          productNameByCode.get(config.loanProductCode) ||
          formatLoanProduct(config.loanProductCode)
        );
      }
      const matched = loanProducts.find(
        (product) => product.id === config.lenderProductId,
      );
      if (matched) {
        return (
          matched.loanProduct?.name ||
          formatLoanProduct(matched.loanProductCode)
        );
      }
      return "—";
    },
    [loanProducts, productNameByCode],
  );

  const fetchLoanProducts = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/lender/loan-products/list?page=1&limit=100`,
        { headers: getLenderAuthHeaders() },
      );
      const json = await res.json();
      if (res.ok && json.success) {
        setLoanProducts(json.data || []);
      }
    } catch {
      toast.error("Failed to load loan products");
    }
  };

  const fetchDocumentConfigs = async () => {
    try {
      setLoadingList(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (selectedProductFilter) {
        params.set("loanProductCode", selectedProductFilter);
      }
      if (debouncedTableSearch.trim()) {
        params.set("search", debouncedTableSearch.trim());
      }

      const res = await fetch(
        `${API_BASE}/lender/document-config/list?${params.toString()}`,
        { headers: getLenderAuthHeaders() },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load document configs");
      }

      setDocumentConfigs(json.data || []);
      setPagination({
        page: json.pagination?.page || page,
        limit: json.pagination?.limit || pageSize,
        total: json.pagination?.total || 0,
        totalPages: json.pagination?.totalPages || 1,
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to load document configs");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      await cleanupOrphanedCustomDocumentTypes().catch(() => undefined);
      await fetchLoanProducts();
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedTableSearch(tableSearch);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [tableSearch]);

  useEffect(() => {
    setPage(1);
  }, [debouncedTableSearch, selectedProductFilter, pageSize]);

  useEffect(() => {
    fetchDocumentConfigs();
  }, [page, pageSize, debouncedTableSearch, selectedProductFilter]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    }

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setShowAdvanced(false);
    setOpenMenuId(null);
    setFormOpen(false);
  };

  const openCreateForm = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setShowAdvanced(false);
    setOpenMenuId(null);
    setFormOpen(true);
  };

  const handleEdit = (config: DocumentConfig) => {
    setEditingId(config.id);
    setShowAdvanced(Boolean(config.notes || config.sortOrder));
    setForm({
      lenderProductId: config.lenderProductId,
      documentName: config.documentName || "",
      isRequired: config.isRequired,
      minFiles: config.minFiles ?? 1,
      maxFiles: config.maxFiles ?? 5,
      notes: config.notes || "",
      sortOrder: config.sortOrder ?? 1,
    });
    setOpenMenuId(null);
    setFormOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.lenderProductId) {
      toast.error("Please select a loan product");
      return;
    }

    if (form.documentName.trim().length < 2) {
      toast.error("Please enter a document name (at least 2 characters)");
      return;
    }

    if (form.minFiles > form.maxFiles) {
      toast.error("Min files cannot exceed max files");
      return;
    }

    try {
      setSaving(true);

      if (editingId) {
        const res = await fetch(
          `${API_BASE}/lender/document-config/update/${editingId}`,
          {
            method: "PUT",
            headers: getLenderAuthHeaders(true),
            body: JSON.stringify({
              documentName: form.documentName.trim(),
              isRequired: form.isRequired,
              minFiles: form.minFiles,
              maxFiles: form.maxFiles,
              notes: form.notes.trim() || undefined,
              sortOrder: form.sortOrder,
            }),
          },
        );
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.message || "Failed to update document");
        }
        toast.success("Document updated");
      } else {
        const res = await fetch(`${API_BASE}/lender/document-config/create`, {
          method: "POST",
          headers: getLenderAuthHeaders(true),
          body: JSON.stringify({
            lenderProductId: form.lenderProductId,
            customDocumentName: form.documentName.trim(),
            isRequired: form.isRequired,
            minFiles: form.minFiles,
            maxFiles: form.maxFiles,
            notes: form.notes.trim() || undefined,
            sortOrder: form.sortOrder,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.message || "Failed to add document");
        }
        toast.success("Document added to product");
      }

      resetForm();
      await fetchDocumentConfigs();
    } catch (error: any) {
      toast.error(error.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (config: DocumentConfig) => {
    const label = config.documentName || "this document";
    const productLabel = resolveProductLabel(config);

    const result = await Swal.fire({
      title: "Remove document?",
      html: `Remove <strong>${label}</strong> from <strong>${productLabel}</strong>?`,
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
      setDeletingId(config.id);
      const res = await fetch(
        `${API_BASE}/lender/document-config/delete/${config.id}`,
        { method: "DELETE", headers: getLenderAuthHeaders() },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to delete document");
      }

      if (editingId === config.id) resetForm();
      await fetchDocumentConfigs();

      await Swal.fire({
        title: "Removed",
        text: json.data?.customTypeDeactivated
          ? `"${label}" has been removed and will no longer appear in document lists.`
          : `"${label}" has been removed from ${productLabel}.`,
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
        ...getSwalTheme(),
      });
    } catch (error: any) {
      await Swal.fire({
        title: "Delete failed",
        text: error.message || "Failed to delete document",
        icon: "error",
        confirmButtonColor: "#183b57",
        ...getSwalTheme(),
      });
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages = pagination.totalPages;
  const showingFrom =
    pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const showingTo = Math.min(
    pagination.page * pagination.limit,
    pagination.total,
  );

  const gotoPage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages) return;
    setPage(nextPage);
  };

  const canSubmit =
    form.lenderProductId && form.documentName.trim().length >= 2;

  return (
    <>
      <PageMeta
        title="Documents | Lender Portal"
        description="Manage required documents for your loan products."
      />
      <PageBreadcrumb pageTitle="Documents" />

      <div className="space-y-6">
        {/* Page header */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="absolute inset-y-0 left-0 w-1 bg-[#183b57]" />
          <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#183b57]/10 text-[#183b57] dark:bg-brand-500/15 dark:text-brand-300">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                  Document Requirements
                </h1>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  Attach private documents to each loan product. Only your
                  organization can see what you add here.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <Lock className="h-3 w-3 text-[#183b57]" />
                Private to your portal
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#183b57]/10 px-3 py-1.5 text-xs font-semibold text-[#183b57] dark:bg-brand-500/15 dark:text-brand-300">
                {pagination.total} configured
              </span>
              <button
                type="button"
                onClick={openCreateForm}
                disabled={loanProducts.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#183b57] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#264863] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Add Document
              </button>
            </div>
          </div>
        </div>

        {/* Full-width configured list */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    Configured Documents
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Documents mapped to your loan products
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
                <select
                  value={selectedProductFilter}
                  onChange={(event) => {
                    setSelectedProductFilter(event.target.value);
                  }}
                  className={`${inputClass} lg:max-w-[240px]`}
                >
                  <option value="">All loan products</option>
                  {loanProducts.map((product) => (
                    <option
                      key={product.id}
                      value={product.loanProductCode}
                    >
                      {product.loanProduct?.name ||
                        formatLoanProduct(product.loanProductCode)}
                    </option>
                  ))}
                </select>

                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={tableSearch}
                    onChange={(event) => setTableSearch(event.target.value)}
                    placeholder="Search documents..."
                    className={`${inputClass} pl-10`}
                  />
                </div>

                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  className={`${inputClass} lg:w-[120px]`}
                >
                  <option value={10}>10 / page</option>
                  <option value={15}>15 / page</option>
                  <option value={25}>25 / page</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[22%]" />
                <col className="w-[12%]" />
                <col className="w-[10%]" />
                <col className="w-[16%]" />
                <col className="w-[12%]" />
                <col className="w-[6%]" />
              </colgroup>
              <thead>
                <tr className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:bg-slate-800/50 dark:text-slate-500">
                  <th className="px-5 py-3">Loan Product</th>
                  <th className="px-3 py-3">Document</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Files</th>
                  <th className="px-3 py-3">Notes</th>
                  <th className="px-3 py-3">Added</th>
                  <th className="px-4 py-3 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loadingList ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-14 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#183b57]" />
                      <p className="mt-2 text-xs text-slate-400">
                        Loading documents...
                      </p>
                    </td>
                  </tr>
                ) : documentConfigs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-14 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#183b57]/10 dark:bg-brand-500/10">
                        <FileText className="h-6 w-6 text-[#183b57]" />
                      </div>
                      <p className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        No documents yet
                      </p>
                      <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-slate-400">
                        {debouncedTableSearch || selectedProductFilter
                          ? "Try changing your search or product filter."
                          : "Use Add Document to create your first requirement."}
                      </p>
                      {!debouncedTableSearch && !selectedProductFilter ? (
                        <button
                          type="button"
                          onClick={openCreateForm}
                          disabled={loanProducts.length === 0}
                          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#183b57] px-4 py-2 text-sm font-semibold text-white hover:bg-[#264863] disabled:opacity-50"
                        >
                          <Plus className="h-4 w-4" />
                          Add Document
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ) : (
                  documentConfigs.map((config) => (
                    <tr
                      key={config.id}
                      className={`transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                        editingId === config.id
                          ? "bg-amber-50/50 dark:bg-amber-500/5"
                          : ""
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <p
                          className="truncate font-medium text-slate-800 dark:text-slate-100"
                          title={resolveProductLabel(config)}
                        >
                          {resolveProductLabel(config)}
                        </p>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span
                            className="truncate font-medium text-slate-700 dark:text-slate-200"
                            title={config.documentName || undefined}
                          >
                            {config.documentName || "—"}
                          </span>
                          {config.isCustom ? (
                            <span className="shrink-0 rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
                              Custom
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <span
                          className={`inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-1 text-[11px] font-semibold ${
                            config.isRequired
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {config.isRequired ? (
                            <ShieldCheck className="h-3 w-3 shrink-0" />
                          ) : null}
                          {config.isRequired ? "Required" : "Optional"}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 tabular-nums text-slate-600 dark:text-slate-300">
                        {config.minFiles ?? 0}–{config.maxFiles ?? "∞"}
                      </td>
                      <td className="px-3 py-3.5">
                        {config.notes ? (
                          <div className="group relative min-w-0">
                            <p className="cursor-default truncate text-slate-500 dark:text-slate-400">
                              {config.notes}
                            </p>
                            <div className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden w-64 max-w-[min(16rem,70vw)] rounded-lg border border-slate-200 bg-slate-900 px-3 py-2 text-xs leading-relaxed text-white shadow-lg group-hover:block dark:border-slate-600 dark:bg-slate-800">
                              {config.notes}
                              <span className="absolute left-4 top-full border-4 border-transparent border-t-slate-900 dark:border-t-slate-800" />
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-slate-500 dark:text-slate-400">
                        {formatDate(config.createdAt)}
                      </td>
                      <td className="relative overflow-visible px-4 py-3.5 text-right">
                        <div
                          ref={openMenuId === config.id ? menuRef : null}
                          className="flex items-center justify-end"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setOpenMenuId(
                                openMenuId === config.id ? null : config.id,
                              )
                            }
                            disabled={deletingId === config.id}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                            aria-label="Row actions"
                          >
                            {deletingId === config.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <BsThreeDotsVertical size={15} />
                            )}
                          </button>

                          {openMenuId === config.id ? (
                            <div className="absolute right-2 top-11 z-50 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                              <button
                                type="button"
                                onClick={() => handleEdit(config)}
                                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-[#183b57] transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-slate-800"
                              >
                                <MdModeEdit size={15} />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  void handleDelete(config);
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pagination.total > 0 ? (
            <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Showing{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {showingFrom}
                </span>
                {" – "}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {showingTo}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {pagination.total}
                </span>
              </p>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => gotoPage(page - 1)}
                  disabled={page <= 1 || loadingList}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Previous
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({
                    length: Math.min(totalPages, 5),
                  }).map((_, index) => {
                    const half = Math.floor(5 / 2);
                    let start = 1;
                    if (totalPages <= 5) start = 1;
                    else if (page <= half + 1) start = 1;
                    else if (page >= totalPages - half) start = totalPages - 4;
                    else start = page - half;

                    const pageNumber = start + index;
                    if (pageNumber > totalPages) return null;

                    return (
                      <button
                        key={pageNumber}
                        type="button"
                        onClick={() => gotoPage(pageNumber)}
                        disabled={loadingList}
                        className={`min-w-8 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                          pageNumber === page
                            ? "bg-[#183b57] text-white shadow-sm"
                            : "border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        }`}
                      >
                        {pageNumber}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => gotoPage(page + 1)}
                  disabled={page >= totalPages || loadingList}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Add / Edit modal */}
      {formOpen ? (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close dialog backdrop"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]"
            onClick={() => {
              if (!saving) resetForm();
            }}
          />

          <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {editingId ? "Edit Document" : "Add Document"}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {editingId
                    ? "Update requirement settings for this document"
                    : "Link a document to one of your products"}
                </p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5">
              <div>
                <FieldLabel step={1} label="Loan product" />
                <select
                  value={form.lenderProductId}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      lenderProductId: event.target.value,
                    }))
                  }
                  disabled={Boolean(editingId) || saving}
                  className={inputClass}
                >
                  <option value="">Choose a product...</option>
                  {loanProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.loanProduct?.name ||
                        formatLoanProduct(product.loanProductCode)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel
                  step={2}
                  label="Document name"
                  hint={
                    editingId
                      ? undefined
                      : "Private to your portal · applies only to the selected product"
                  }
                />
                <input
                  autoFocus
                  type="text"
                  value={form.documentName}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      documentName: event.target.value,
                    }))
                  }
                  placeholder="e.g. LLC Operating Agreement"
                  disabled={saving}
                  className={inputClass}
                />
              </div>

              <div>
                <FieldLabel step={3} label="Requirement" />
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-slate-600">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      Required Document
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
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
                    className="h-4 w-4 shrink-0 accent-[#183b57]"
                  />
                </label>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced((prev) => !prev)}
                  className="flex w-full items-center justify-between rounded-xl border border-dashed border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  More options
                  <ChevronDown
                    className={`h-4 w-4 transition ${showAdvanced ? "rotate-180" : ""}`}
                  />
                </button>

                {showAdvanced ? (
                  <div className="mt-3 space-y-3 rounded-xl border border-slate-100 bg-slate-50/90 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-slate-500">
                          Min files
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={form.minFiles}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              minFiles: Number(event.target.value),
                            }))
                          }
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-slate-500">
                          Max files
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={form.maxFiles}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              maxFiles: Number(event.target.value),
                            }))
                          }
                          className={inputClass}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-500">
                        Sort order
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={form.sortOrder}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            sortOrder: Number(event.target.value),
                          }))
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-500">
                        Notes for broker
                      </label>
                      <textarea
                        value={form.notes}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            notes: event.target.value,
                          }))
                        }
                        rows={2}
                        placeholder="Optional instructions"
                        className={`${inputClass} resize-none`}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !canSubmit}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#183b57] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#264863] disabled:cursor-not-allowed disabled:opacity-50"
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
                      Add to Product
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
