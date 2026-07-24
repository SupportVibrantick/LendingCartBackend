import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { MdDelete, MdModeEdit } from "react-icons/md";
import Swal from "sweetalert2";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const ITEMS_PER_PAGE = 10;
const SEARCH_DEBOUNCE_MS = 400;

type Document = {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt?: string;
};

type DocumentForm = {
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

type StatusFilter = "all" | "active" | "inactive";

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
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DocumentForm>({ name: "", description: "" });
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: ITEMS_PER_PAGE,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const activeOnPage = useMemo(
    () => documents.filter((doc) => doc.isActive).length,
    [documents],
  );

  const resetForm = () => {
    setEditingId(null);
    setForm({ name: "", description: "" });
  };

  const fetchDocuments = useCallback(
    async (pageNo = currentPage, searchQuery = debouncedSearch) => {
      try {
        setLoadingList(true);

        const params = new URLSearchParams({
          page: String(pageNo),
          limit: String(ITEMS_PER_PAGE),
        });

        if (searchQuery.trim()) {
          params.set("search", searchQuery.trim());
        }
        if (statusFilter === "active") params.set("isActive", "true");
        if (statusFilter === "inactive") params.set("isActive", "false");

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
    [currentPage, debouncedSearch, statusFilter],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchDocuments(currentPage, debouncedSearch);
  }, [currentPage, debouncedSearch, statusFilter, fetchDocuments]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
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
                }
              : {
                  name: form.name.trim(),
                  description: form.description.trim(),
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
      await fetchDocuments(currentPage, debouncedSearch);
      resetForm();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save document");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (doc: Document) => {
    setEditingId(doc.id);
    setForm({
      name: doc.name,
      description: doc.description || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
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
      await fetchDocuments(currentPage, debouncedSearch);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (doc: Document) => {
    const result = await Swal.fire({
      title: "Delete document?",
      html: `Remove <strong>${doc.name}</strong> from the platform catalog?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
      ...getSwalTheme(),
    });

    if (!result.isConfirmed) return;

    try {
      setDeletingId(doc.id);

      const res = await fetch(`${API_BASE}/admin/document-types/delete`, {
        method: "DELETE",
        headers: getAuthHeaders(),
        body: JSON.stringify({ id: doc.id }),
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

      if (editingId === doc.id) resetForm();

      const nextPage =
        documents.length === 1 && currentPage > 1
          ? currentPage - 1
          : currentPage;

      await fetchDocuments(nextPage, debouncedSearch);

      await Swal.fire({
        icon: "success",
        title: "Deleted",
        text: `"${doc.name}" has been removed.`,
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
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#13538A] dark:text-indigo-400">
            Document Management
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-slate-400">
            Manage platform-wide document types used by lenders, brokers, and
            loan applications.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-[#13538A]/15 bg-[#13538A]/5 px-3 py-1.5 text-xs font-medium text-[#13538A] dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
          <FileText className="h-3.5 w-3.5" />
          {pagination.total} total documents
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Catalog Size
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {pagination.total}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-sm dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700/70 dark:text-emerald-300/80">
            Active On Page
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-300">
            {activeOnPage}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            Platform Catalog
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Documents created here are available across all lender portals.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {editingId ? "Edit Document" : "Add Document"}
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {editingId
                  ? "Update the selected document type."
                  : "Create a reusable document type for the platform."}
              </p>
            </div>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Document Name
              </label>
              <input
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

            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#13538A] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1b72be] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-blue-600"
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
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                All Documents
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Search, filter, and manage document types
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search documents..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/10 dark:border-slate-700 dark:bg-slate-800 sm:w-64"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#13538A] dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="all">All status</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>

              <button
                type="button"
                onClick={() => fetchDocuments(currentPage, debouncedSearch)}
                disabled={loadingList}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loadingList ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-800">
                  <th className="py-3 pr-4">Document</th>
                  <th className="py-3 pr-4">Description</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Created</th>
                  <th className="py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingList ? (
                  <tr>
                    <td colSpan={5} className="py-14 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#13538A]" />
                      <p className="mt-3 text-sm text-slate-500">
                        Loading documents...
                      </p>
                    </td>
                  </tr>
                ) : documents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                        <FileText className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        No documents found
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {debouncedSearch || statusFilter !== "all"
                          ? "Try adjusting your search or filter."
                          : "Create your first document using the form on the left."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  documents.map((doc) => (
                    <tr
                      key={doc.id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70 dark:border-slate-800/80 dark:hover:bg-slate-800/40"
                    >
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
                      <td className="max-w-[280px] py-3.5 pr-4 text-slate-600 dark:text-slate-300">
                        <p className="truncate" title={doc.description || "—"}>
                          {doc.description || "—"}
                        </p>
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
                            onClick={() => handleEdit(doc)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            title="Edit"
                          >
                            <MdModeEdit />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(doc)}
                            disabled={deletingId === doc.id}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/20 dark:text-red-400 dark:hover:bg-red-500/10"
                            title="Delete"
                          >
                            {deletingId === doc.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MdDelete />
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
      </div>
    </div>
  );
}
