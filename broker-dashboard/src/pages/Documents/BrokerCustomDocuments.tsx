import {
  ChevronLeft,
  ChevronRight,
  FileText,
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
import {
  createBrokerCustomDocument,
  deactivateBrokerCustomDocument,
  fetchBrokerCustomDocuments,
  updateBrokerCustomDocument,
  type BrokerCustomDocument,
} from "../../lib/documentTypesApi";

type DocumentFormState = {
  name: string;
  description: string;
};

const emptyForm: DocumentFormState = { name: "", description: "" };
const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 400;

export default function BrokerCustomDocuments() {
  const [documents, setDocuments] = useState<BrokerCustomDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
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
  }, [debouncedSearch]);

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
  }, [page, debouncedSearch]);

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

  const isSearchActive = debouncedSearch.length > 0;
  const showEmptyLibrary = !loading && total === 0 && !isSearchActive;
  const showNoSearchResults = !loading && total === 0 && isSearchActive;

  const openCreateModal = () => {
    setEditingDoc(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEditModal = (doc: BrokerCustomDocument) => {
    setEditingDoc(doc);
    setForm({
      name: doc.name,
      description: doc.description || "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingDoc(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    const name = form.name.trim();
    const description = form.description.trim();

    if (name.length < 2) {
      toast.error("Document name must be at least 2 characters");
      return;
    }

    try {
      setSaving(true);
      if (editingDoc) {
        await updateBrokerCustomDocument(editingDoc.id, {
          name,
          description,
        });
        toast.success("Custom document updated");
      } else {
        await createBrokerCustomDocument({ name, description });
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

  return (
    <>
      <PageMeta
        title="Custom Documents | Broker Dashboard"
        description="Manage broker custom document types"
      />
      <PageBreadcrumb pageTitle="Custom Documents" />

      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Custom Documents
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Create and manage document types you request from clients during
                the loan process.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void loadDocuments()}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <RefreshCw
                  size={16}
                  className={loading ? "animate-spin" : undefined}
                />
                Refresh
              </button>
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 rounded-xl bg-[#13538A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0f4270]"
              >
                <Plus size={16} />
                Add Document
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-md">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or description..."
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-9 text-sm outline-none focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/10"
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

            {!loading && (
              <p className="text-sm text-slate-500">
                {total} document{total === 1 ? "" : "s"}
                {isSearchActive ? ` matching "${debouncedSearch}"` : ""}
              </p>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex min-h-[280px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#13538A]" />
            </div>
          ) : showEmptyLibrary ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-12 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <FileText size={24} />
              </div>
              <p className="text-base font-semibold text-slate-800">
                No custom documents yet
              </p>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                Add document types here to reuse them when requesting files from
                clients on loan applications.
              </p>
              <button
                type="button"
                onClick={openCreateModal}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#13538A] px-4 py-2.5 text-sm font-semibold text-white"
              >
                <Plus size={16} />
                Add your first document
              </button>
            </div>
          ) : showNoSearchResults ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-12 text-center">
              <Search size={28} className="mb-3 text-slate-300" />
              <p className="text-base font-semibold text-slate-800">
                No documents found
              </p>
              <p className="mt-1 text-sm text-slate-500">
                No results for &quot;{debouncedSearch}&quot;. Try a different
                search term.
              </p>
              <button
                type="button"
                onClick={() => setSearch("")}
                className="mt-4 text-sm font-medium text-[#13538A] hover:underline"
              >
                Clear search
              </button>
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Document</th>
                  <th className="px-5 py-3 font-semibold">Description</th>
                  <th className="px-5 py-3 font-semibold">Usage</th>
                  <th className="px-5 py-3 font-semibold">Created</th>
                  <th className="px-5 py-3 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">
                        {doc.name}
                      </div>
                      {doc.isProtected && (
                        <span className="mt-1 inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-violet-700">
                          System
                        </span>
                      )}
                    </td>
                    <td className="max-w-xs px-5 py-4 text-slate-600">
                      {doc.description || "—"}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {doc.usageCount || 0} app
                      {(doc.usageCount || 0) === 1 ? "" : "s"}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={doc.isProtected}
                          onClick={() => openEditModal(doc)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Pencil size={14} />
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={doc.isProtected}
                          onClick={() => void handleDeactivate(doc)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 size={14} />
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && totalPages > 1 && (
          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
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

      {modalOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-lg font-bold text-slate-900">
                {editingDoc ? "Edit Custom Document" : "Add Custom Document"}
              </h2>
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
                disabled={saving}
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
