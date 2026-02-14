import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { MdModeEdit } from "react-icons/md";
import { FiAlertCircle } from "react-icons/fi";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

/* ================= TYPES ================= */

type Document = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt?: string;
};

type DocumentForm = {
  code: string;
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

function statusClass(status?: string) {
  switch ((status || "").toUpperCase()) {
    case "ACTIVE":
      return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30";
    case "INACTIVE":
      return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-300 dark:border-yellow-500/30";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-500/10 dark:text-gray-300 dark:border-gray-500/30";
  }
}

const DOCUMENT_CODES = [
  { value: "SBA", label: "SBA" },
  { value: "USDA", label: "USDA" },
  { value: "BRIDGE", label: "Bridge" },
  { value: "DSCR", label: "DSCR" },
  { value: "CONSTRUCTION", label: "Construction" },
  { value: "EQUIPMENT", label: "Equipment" },
  { value: "ASSET_BASED", label: "Asset Based" },
  { value: "AR_AP", label: "AR/AP" },
  { value: "PO_FINANCE", label: "PO Finance" },
];

/* ================= COMPONENT ================= */

const AllDocuments = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DocumentForm>({
    code: "",
    name: "",
    description: "",
  });

  const formatDate = (value?: string) => {
    if (!value) return "-";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ code: "", name: "", description: "" });
  };

  /* ================= API ================= */

  const fetchDocuments = async () => {
    try {
      setLoadingList(true);
      const res = await fetch(`${API_BASE}/admin/document-types/read`, {
        headers: getAuthHeaders(),
      });
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
        }))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingList(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code || !form.name) {
      toast.error("Code and Name are required");
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
              ? { id: editingId, name: form.name, description: form.description }
              : form
          ),
        }
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || "Save failed");
        return;
      }

      toast.success(editingId ? "Document updated" : "Document created");
      await fetchDocuments();
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (doc: Document) => {
    setEditingId(doc.id);
    setForm({
      code: doc.code,
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
      await fetchDocuments();
    } finally {
      setTogglingId(null);
    }
  };

  /* ================= EFFECT ================= */

  useEffect(() => {
    fetchDocuments();
  }, []);

  /* ================= UI ================= */

  return (
    <div className="px-6 py-6 bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100 min-h-screen">
      <h1 className="text-2xl font-semibold mb-6 text-slate-900 dark:text-slate-100">
        All Documents
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* FORM */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold mb-4">
            {editingId ? "Edit Document" : "Add Document"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <select
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              disabled={!!editingId || saving}
              className="w-full border px-3 py-2 rounded bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
            >
              <option value="">Select code</option>
              {DOCUMENT_CODES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Name"
              className="w-full border px-3 py-2 rounded bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
            />

            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={3}
              placeholder="Description"
              className="w-full border px-3 py-2 rounded bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
            />

            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Save Changes"
                  : "Create Document"}
            </button>
          </form>
        </div>

        {/* TABLE */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 uppercase text-xs">
                <th className="py-2 text-left">Code</th>
                <th className="py-2 text-left">Name</th>
                <th className="py-2 text-left">Status</th>
                <th className="py-2 text-left">Created</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingList ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500 dark:text-slate-400">
                    Loading...
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">

                      {/* Icon Circle */}
                      <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center mb-4 border border-red-200 dark:border-red-500/20">
                        <FiAlertCircle className="text-red-500 dark:text-red-400 text-3xl" />
                      </div>

                      {/* Title */}
                      <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
                        No Documents Found
                      </h3>

                      {/* Subtitle */}
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-sm">
                        There are currently no document types available.
                        Please create a new document to get started.
                      </p>

                    </div>
                  </td>
                </tr>
              ) : (
                documents.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <td className="py-3">{p.code}</td>
                    <td className="py-3">{p.name}</td>
                    <td className="py-3">
                      <button
                        onClick={() => handleToggleStatus(p)}
                        disabled={togglingId === p.id}
                        className={`px-3 py-1 rounded-full border text-xs ${statusClass(
                          p.isActive ? "ACTIVE" : "INACTIVE"
                        )}`}
                      >
                        {togglingId === p.id
                          ? "Updating..."
                          : p.isActive
                            ? "ACTIVE"
                            : "INACTIVE"}
                      </button>
                    </td>
                    <td className="py-3">{formatDate(p.createdAt)}</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleEdit(p)}
                        className="h-8 w-8 inline-flex items-center justify-center border border-slate-300 dark:border-slate-600 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <MdModeEdit />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AllDocuments;
