import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  FileText,
  Loader2,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { MdModeEdit } from "react-icons/md";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { formatLoanProduct } from "../../lib/loanPipelineUtils";
import { getLenderAuthHeaders } from "../../lib/lenderApi";
import { cleanupOrphanedCustomDocumentTypes } from "../../lib/documentConfigApi";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

type DocumentType = {
  id: string;
  name: string;
  isCustom?: boolean;
  description?: string | null;
};

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
  documentTypeId: string;
  customDocumentName: string;
  isRequired: boolean;
  minFiles: number;
  maxFiles: number;
  notes: string;
  sortOrder: number;
};

type DocumentPickerMode = "list" | "custom";

const DEFAULT_FORM: DocumentForm = {
  lenderProductId: "",
  documentTypeId: "",
  customDocumentName: "",
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

function StepBadge({ step, label }: { step: number; label: string }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0F766E] text-xs font-bold text-white">
        {step}
      </span>
      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
        {label}
      </span>
    </div>
  );
}

export default function AllDocuments() {
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
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
  const [pickerMode, setPickerMode] = useState<DocumentPickerMode>("list");
  const [pickerSearch, setPickerSearch] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [form, setForm] = useState<DocumentForm>(DEFAULT_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const filteredDocumentTypes = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase();
    if (!query) return documentTypes;
    return documentTypes.filter((doc) =>
      doc.name.toLowerCase().includes(query),
    );
  }, [documentTypes, pickerSearch]);

  const selectedDocumentName = useMemo(() => {
    if (pickerMode === "custom") return form.customDocumentName.trim();
    return (
      documentTypes.find((doc) => doc.id === form.documentTypeId)?.name || ""
    );
  }, [
    documentTypes,
    form.customDocumentName,
    form.documentTypeId,
    pickerMode,
  ]);

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

  const fetchDocumentTypes = async () => {
    try {
      setLoadingTypes(true);
      const res = await fetch(
        `${API_BASE}/document-types/active?all=true`,
        { headers: getLenderAuthHeaders() },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load document types");
      }
      setDocumentTypes(json.data || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load document types");
    } finally {
      setLoadingTypes(false);
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
      await Promise.all([fetchLoanProducts(), fetchDocumentTypes()]);
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

  const resetForm = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setPickerMode("list");
    setPickerSearch("");
    setShowAdvanced(false);
  };

  const handleEdit = (config: DocumentConfig) => {
    setEditingId(config.id);
    setPickerMode("list");
    setPickerSearch("");
    setShowAdvanced(Boolean(config.notes || config.sortOrder));
    setForm({
      lenderProductId: config.lenderProductId,
      documentTypeId: config.documentTypeId,
      customDocumentName: "",
      isRequired: config.isRequired,
      minFiles: config.minFiles ?? 1,
      maxFiles: config.maxFiles ?? 5,
      notes: config.notes || "",
      sortOrder: config.sortOrder ?? 1,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.lenderProductId) {
      toast.error("Please select a loan product");
      return;
    }

    if (!editingId) {
      if (pickerMode === "list" && !form.documentTypeId) {
        toast.error("Please pick a document from the list");
        return;
      }
      if (pickerMode === "custom" && form.customDocumentName.trim().length < 2) {
        toast.error("Please enter a document name (at least 2 characters)");
        return;
      }
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
        const payload: Record<string, unknown> = {
          lenderProductId: form.lenderProductId,
          isRequired: form.isRequired,
          minFiles: form.minFiles,
          maxFiles: form.maxFiles,
          notes: form.notes.trim() || undefined,
          sortOrder: form.sortOrder,
        };

        if (pickerMode === "list") {
          payload.documentTypeId = form.documentTypeId;
        } else {
          payload.customDocumentName = form.customDocumentName.trim();
        }

        const res = await fetch(`${API_BASE}/lender/document-config/create`, {
          method: "POST",
          headers: getLenderAuthHeaders(true),
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.message || "Failed to add document");
        }
        toast.success("Document added to product");
      }

      resetForm();
      await fetchDocumentConfigs();
      await fetchDocumentTypes();
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
      await fetchDocumentTypes();

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
        confirmButtonColor: "#0F766E",
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
    form.lenderProductId &&
    (editingId ||
      (pickerMode === "list"
        ? Boolean(form.documentTypeId)
        : form.customDocumentName.trim().length >= 2));

  return (
    <>
      <PageMeta
        title="Documents | Lender Portal"
        description="Manage required documents for your loan products."
      />
      <PageBreadcrumb pageTitle="Documents" />

      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
                Document Requirements
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                Choose a loan product, pick a document, and mark it required or
                optional. Your custom documents stay private to your portal.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">
              <FileText className="h-3.5 w-3.5" />
              {pagination.total} configured
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {editingId ? "Edit Document" : "Add Document"}
              </h2>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </button>
              ) : null}
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <StepBadge step={1} label="Select loan product" />
                <select
                  value={form.lenderProductId}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      lenderProductId: event.target.value,
                    }))
                  }
                  disabled={Boolean(editingId) || saving}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:disabled:bg-slate-800/60"
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

              {!editingId ? (
                <div>
                  <StepBadge step={2} label="Choose document" />

                  <div className="mb-3 flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setPickerMode("list");
                        setForm((prev) => ({
                          ...prev,
                          customDocumentName: "",
                        }));
                      }}
                      className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        pickerMode === "list"
                          ? "bg-white text-[#0F766E] shadow-sm dark:bg-slate-900"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      From list
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPickerMode("custom");
                        setForm((prev) => ({
                          ...prev,
                          documentTypeId: "",
                        }));
                      }}
                      className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        pickerMode === "custom"
                          ? "bg-white text-[#0F766E] shadow-sm dark:bg-slate-900"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      Your own
                    </button>
                  </div>

                  {pickerMode === "list" ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                        value={pickerSearch}
                        onChange={(event) =>
                          setPickerSearch(event.target.value)
                        }
                          placeholder="Search documents..."
                          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#0F766E] dark:border-slate-700 dark:bg-slate-800"
                        />
                      </div>

                      <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
                        {loadingTypes ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin text-[#0F766E]" />
                          </div>
                        ) : filteredDocumentTypes.length === 0 ? (
                          <p className="px-3 py-6 text-center text-xs text-slate-400">
                            No documents found
                          </p>
                        ) : (
                          filteredDocumentTypes.map((doc) => {
                            const selected = form.documentTypeId === doc.id;
                            return (
                              <button
                                key={doc.id}
                                type="button"
                                onClick={() =>
                                  setForm((prev) => ({
                                    ...prev,
                                    documentTypeId: doc.id,
                                  }))
                                }
                                className={`flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 text-left text-sm last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60 ${
                                  selected
                                    ? "bg-teal-50 text-[#0F766E] dark:bg-teal-500/10"
                                    : "text-slate-700 dark:text-slate-200"
                                }`}
                              >
                                <span className="truncate">{doc.name}</span>
                                <span className="flex shrink-0 items-center gap-1.5">
                                  {doc.isCustom ? (
                                    <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                                      Yours
                                    </span>
                                  ) : null}
                                  {selected ? (
                                    <Check className="h-4 w-4 text-[#0F766E]" />
                                  ) : null}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="text"
                        value={form.customDocumentName}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            customDocumentName: event.target.value,
                          }))
                        }
                        placeholder="e.g. LLC Operating Agreement"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] dark:border-slate-700 dark:bg-slate-800"
                      />
                      <p className="mt-1.5 text-[11px] text-slate-400">
                        This document will only appear in your lender portal.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-800/50">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Document
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                    {documentConfigs.find((item) => item.id === editingId)
                      ?.documentName || "—"}
                  </p>
                </div>
              )}

              <div>
                <StepBadge
                  step={editingId ? 2 : 3}
                  label="Is this required?"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, isRequired: true }))
                    }
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                      form.isRequired
                        ? "border-[#0F766E] bg-teal-50 text-[#0F766E] dark:bg-teal-500/10"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                    }`}
                  >
                    Required
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, isRequired: false }))
                    }
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                      !form.isRequired
                        ? "border-[#0F766E] bg-teal-50 text-[#0F766E] dark:bg-teal-500/10"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                    }`}
                  >
                    Optional
                  </button>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced((prev) => !prev)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  More options
                  <ChevronDown
                    className={`h-4 w-4 transition ${showAdvanced ? "rotate-180" : ""}`}
                  />
                </button>

                {showAdvanced ? (
                  <div className="mt-3 space-y-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs text-slate-500">
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
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0F766E] dark:border-slate-700 dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-slate-500">
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
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0F766E] dark:border-slate-700 dark:bg-slate-800"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">
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
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0F766E] dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">
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
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0F766E] dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              {!editingId && selectedDocumentName ? (
                <div className="rounded-xl border border-teal-100 bg-teal-50/60 px-3 py-2.5 text-xs text-teal-800 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-200">
                  Adding <strong>{selectedDocumentName}</strong> as{" "}
                  <strong>{form.isRequired ? "Required" : "Optional"}</strong>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={saving || !canSubmit}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F766E] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0d6b64] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : editingId ? (
                  "Save Changes"
                ) : (
                  "Add to Product"
                )}
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Configured Documents
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Documents mapped to your loan products
                  </p>
                </div>

                <select
                  value={selectedProductFilter}
                  onChange={(event) => {
                    setSelectedProductFilter(event.target.value);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0F766E] dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">All loan products</option>
                  {loanProducts.map((product) => (
                    <option key={product.id} value={product.loanProductCode}>
                      {product.loanProduct?.name ||
                        formatLoanProduct(product.loanProductCode)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={tableSearch}
                    onChange={(event) => setTableSearch(event.target.value)}
                    placeholder="Search configured documents..."
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#0F766E] dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value={10}>10 / page</option>
                  <option value={15}>15 / page</option>
                  <option value={25}>25 / page</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-800">
                    <th className="py-3 pr-4">Loan Product</th>
                    <th className="py-3 pr-4">Document</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Files</th>
                    <th className="py-3 pr-4">Notes</th>
                    <th className="py-3 pr-4">Added</th>
                    <th className="py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingList ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin text-[#0F766E]" />
                      </td>
                    </tr>
                  ) : documentConfigs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-500/10">
                          <FileText className="h-5 w-5 text-[#0F766E]" />
                        </div>
                        <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                          No documents yet
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {debouncedTableSearch || selectedProductFilter
                            ? "Try changing your search or filter."
                            : "Use the form on the left to add your first document."}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    documentConfigs.map((config) => (
                      <tr
                        key={config.id}
                        className="border-b border-slate-50 last:border-0 dark:border-slate-800/80"
                      >
                        <td className="py-3 pr-4 font-medium text-slate-800 dark:text-slate-100">
                          {resolveProductLabel(config)}
                        </td>
                        <td className="py-3 pr-4 text-slate-700 dark:text-slate-200">
                          <div className="flex items-center gap-2">
                            <span>{config.documentName || "—"}</span>
                            {config.isCustom ? (
                              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
                                Custom
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              config.isRequired
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {config.isRequired ? "Required" : "Optional"}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                          {config.minFiles ?? 0} – {config.maxFiles ?? "∞"}
                        </td>
                        <td className="max-w-[180px] truncate py-3 pr-4 text-slate-500 dark:text-slate-400">
                          {config.notes || "—"}
                        </td>
                        <td className="py-3 pr-4 text-slate-500 dark:text-slate-400">
                          {formatDate(config.createdAt)}
                        </td>
                        <td className="py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleEdit(config)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                              title="Edit"
                            >
                              <MdModeEdit />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(config)}
                              disabled={deletingId === config.id}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-500/20 dark:text-red-400 dark:hover:bg-red-500/10"
                              title="Delete"
                            >
                              {deletingId === config.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {pagination.total > 0 ? (
              <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Showing{" "}
                  <span className="font-medium">{showingFrom}</span>
                  {" – "}
                  <span className="font-medium">{showingTo}</span> of{" "}
                  <span className="font-medium">{pagination.total}</span>
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => gotoPage(page - 1)}
                    disabled={page <= 1 || loadingList}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium disabled:opacity-50 dark:border-slate-700"
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
                          className={`min-w-8 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                            pageNumber === page
                              ? "bg-[#0F766E] text-white"
                              : "border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200"
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
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium disabled:opacity-50 dark:border-slate-700"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
