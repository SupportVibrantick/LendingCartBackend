import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { MdModeEdit, MdDelete } from "react-icons/md";
import { FiAlertCircle } from "react-icons/fi";
import Swal from "sweetalert2";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

/* ================= TYPES ================= */

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

/* ================= HELPERS ================= */

function getAuthHeaders(): Record<string, string> {
  try {
    const token = sessionStorage.getItem("admin_token");
    if (token) {
      return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };
    }
  } catch {
    /* ignore */
  }
  return { "Content-Type": "application/json" };
}

/* ================= COMPONENT ================= */

const AllDocuments = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DocumentForm>({
    name: "",
    description: "",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(5);
  const [total, setTotal] = useState(0);

  const totalPages = Math.ceil(total / limit);
  const formatDate = (value?: string) => {
    if (!value) return "-";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ name: "", description: "" });
  };

  /* ================= API ================= */

  const fetchDocuments = async (page = 1) => {
    try {
      setLoadingList(true);

      const res = await fetch(
        `${API_BASE}/admin/document-types/read?page=${page}&limit=${limit}`,
        {
          headers: getAuthHeaders(),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.message || "Failed to load documents");
        return;
      }

      setDocuments(
        (json.data || []).map((d: any) => ({
          id: String(d.id),
          code: d.code,
          name: d.name ?? "",
          description: d.description ?? "",
          isActive: Boolean(d.isActive),
          createdAt: d.createdAt ?? undefined,
        })),
      );

      setTotal(json.meta?.total || 0);
      setCurrentPage(json.meta?.page || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingList(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      toast.error("Name is required");
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
                  name: form.name,
                  description: form.description,
                }
              : form,
          ),
        },
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || "Save failed");
        return;
      }

      toast.success(editingId ? "Document updated" : "Document created");
      await fetchDocuments(currentPage);
      resetForm();
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

      toast.success("Status updated");
      await fetchDocuments(currentPage);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (doc: Document) => {
    const result = await Swal.fire({
      title: "Delete document?",
      text: `"${doc.name}" will be permanently removed.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Delete",
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
        toast.error(json.message || "Delete failed");
        return;
      }

      toast.success(json.message || "Document deleted");

      if (editingId === doc.id) {
        resetForm();
      }

      const nextPage =
        documents.length === 1 && currentPage > 1
          ? currentPage - 1
          : currentPage;

      await fetchDocuments(nextPage);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete document");
    } finally {
      setDeletingId(null);
    }
  };

  const gotoPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    fetchDocuments(page);
  };

  /* ================= EFFECT ================= */

  useEffect(() => {
    fetchDocuments(1);
  }, []);

  /* ================= UI ================= */

  return (
    <div className="px-6 py-6 bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100 min-h-screen">
      <h1 className="text-2xl font-semibold mb-6 text-[#13538A] dark:text-indigo-600">
        Document Management
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* FORM */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold">
                {editingId ? "Edit Document" : "Create Document"}
              </h2>
              <p className="text-xs text-slate-500">
                {editingId
                  ? "Update your existing document"
                  : "Add a new document type"}
              </p>
            </div>

            {editingId && (
              <button
                onClick={resetForm}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition"
              >
                + New
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">
                Document Name
              </label>
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Enter document name"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-[#18B6B4]/20 outline-none transition"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 mb-1 block">
                Description
              </label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Enter description"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-[#18B6B4]/20 outline-none transition"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 text-sm py-2.5 rounded-xl bg-[#13538A] hover:bg-[#0b70c8] text-white font-semibold transition-all active:scale-95"
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Document"
                    : "Create Document"}
              </button>
            </div>
          </form>
        </div>

        {/* TABLE */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="w-full overflow-x-auto">
            <table className="min-w-full text-sm border-separate border-spacing-y-2">
              <thead>
                <tr className="text-xs uppercase text-slate-500 dark:text-slate-400">
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Created</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {loadingList ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-14 text-center text-slate-500"
                    >
                      <span className="animate-pulse">
                        Loading documents...
                      </span>
                    </td>
                  </tr>
                ) : documents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-20 text-center">
                      <div className="flex flex-col items-center">
                        <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                          <FiAlertCircle size={26} className="text-slate-400" />
                        </div>

                        <h3 className="text-base font-semibold">
                          No Documents Found
                        </h3>

                        <p className="text-sm text-slate-500 mt-1">
                          Create your first document to get started
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  documents.map((p) => (
                    <tr
                      key={p.id}
                      className="
            bg-white dark:bg-slate-900 
            shadow-sm 
            hover:shadow-md 
            transition-all 
            rounded-xl
          "
                    >
                      <td className="px-4 py-3">
                        <p
                          className="font-medium text-slate-800 dark:text-slate-200 "
                          title={p.name}
                        >
                          {p.name}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleStatus(p)}
                          disabled={togglingId === p.id}
                          className={`px-3 py-1 text-xs font-semibold rounded-full transition
                ${
                  p.isActive
                    ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
                    : "bg-rose-100 text-rose-600 hover:bg-rose-200"
                }
              `}
                        >
                          {togglingId === p.id
                            ? "..."
                            : p.isActive
                              ? "Active"
                              : "Inactive"}
                        </button>
                      </td>

                      <td className="px-4 py-3 text-slate-500 text-sm">
                        {formatDate(p.createdAt)}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(p)}
                            className="
                h-9 w-9 flex items-center justify-center 
                rounded-lg 
                bg-slate-100 dark:bg-slate-800
                hover:bg-blue-600 hover:text-white
                transition-all
              "
                          >
                            <MdModeEdit size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(p)}
                            disabled={deletingId === p.id}
                            className="
                h-9 w-9 flex items-center justify-center 
                rounded-lg 
                bg-slate-100 dark:bg-slate-800 text-rose-600
                hover:bg-rose-600 hover:text-white
                transition-all
                disabled:opacity-50 disabled:cursor-not-allowed
              "
                            title="Delete document"
                          >
                            <MdDelete size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {!loadingList && totalPages > 1 && (
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-700 pt-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Showing page{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {currentPage}
                  </span>{" "}
                  of {totalPages}
                </p>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => gotoPage(currentPage - 1)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700
        bg-white dark:bg-slate-900
        text-slate-700 dark:text-slate-200
        hover:bg-slate-50 dark:hover:bg-slate-800
        transition-colors
        disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Prev
                  </button>

                  {Array.from({ length: totalPages }).map((_, i) => {
                    const page = i + 1;

                    return (
                      <button
                        key={page}
                        onClick={() => gotoPage(page)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-colors
              ${
                currentPage === page
                  ? "bg-[#13538A] text-white border-[#13538A] shadow-sm dark:bg-indigo-600 dark:border-indigo-600"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
                      >
                        {page}
                      </button>
                    );
                  })}

                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => gotoPage(currentPage + 1)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700
        bg-white dark:bg-slate-900
        text-slate-700 dark:text-slate-200
        hover:bg-slate-50 dark:hover:bg-slate-800
        transition-colors
        disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AllDocuments;
