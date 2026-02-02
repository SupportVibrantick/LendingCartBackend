import { useEffect, useMemo, useState } from "react";
import { MdDelete } from "react-icons/md";

/* ================= TYPES ================= */

type Lead = {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  status: "NEW" | "CONTACTED" | "QUALIFIED" | "NOT_INTERESTED" | "CONVERTED";
  source: string;
  createdAt?: string;
};

const STATUS_OPTIONS: Lead["status"][] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "NOT_INTERESTED",
  "CONVERTED",
];

/* ================= HELPERS ================= */

function statusClass(status: Lead["status"]) {
  switch (status) {
    case "NEW":
      return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30";
    case "CONTACTED":
      return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-300 dark:border-yellow-500/30";
    case "QUALIFIED":
      return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30";
    case "CONVERTED":
      return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/30";
    case "NOT_INTERESTED":
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-500/10 dark:text-gray-300 dark:border-gray-500/30";
  }
}

function getAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("admin_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/* ================= COMPONENT ================= */

export default function AllLeads() {
  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

  const [source, setSource] = useState<
    "commercial-lending-mastery" | "clm-landing-page"
  >("commercial-lending-mastery");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [rowLoadingId, setRowLoadingId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [pageSize] = useState(10);
  const [currentPage] = useState(1);

  /* ================= FETCH ================= */

  async function fetchLeads() {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/admin/landing-page-leads/${source}`,
        {
          method: "GET",
          headers: getAuthHeaders(),
        }
      );

      if (!res.ok) throw new Error("Failed to load leads");

      const json = await res.json();
      setLeads(json.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLeads();
  }, [source]);

  /* ================= FILTER + PAGINATION ================= */

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return leads.filter((l) =>
      `${l.firstName} ${l.lastName} ${l.email} ${l.phone} ${l.status}`
        .toLowerCase()
        .includes(q)
    );
  }, [leads, query]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  /* ================= ACTIONS ================= */

  async function changeStatus(id: string, status: Lead["status"]) {
    setRowLoadingId(id);
    try {
      await fetch(
        `${API_BASE}/admin/landing-page-leads/${source}/${id}/status`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({ status }),
        }
      );

      setLeads((prev) =>
        prev.map((l) => (l.id === id ? { ...l, status } : l))
      );
    } catch {
      alert("Failed to update status");
    } finally {
      setRowLoadingId(null);
    }
  }

  async function deleteLead(id: string) {
    if (!window.confirm("Delete this lead?")) return;
    setRowLoadingId(id);

    try {
      await fetch(`${API_BASE}/admin/landing-page-leads/${source}/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      setLeads((prev) => prev.filter((l) => l.id !== id));
    } catch {
      alert("Failed to delete lead");
    } finally {
      setRowLoadingId(null);
    }
  }

  /* ================= UI ================= */

  return (
    <div className="px-6 py-6 bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100 min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            All Leads
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage landing page leads and follow-ups
          </p>
        </div>

        <div className="flex gap-2">
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as any)}
            className="px-3 py-2 border rounded-md bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
          >
            <option value="commercial-lending-mastery">
              Commercial Lending Mastery
            </option>
            <option value="clm-landing-page">CLM Landing Page</option>
          </select>

          <input
            placeholder="Search leads"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="px-3 py-2 border rounded-md bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
            Loading leads...
          </div>
        ) : paginated.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
            No leads found.
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-xs uppercase text-slate-500 dark:text-slate-400">
                  <th className="py-2 text-left">Name</th>
                  <th className="py-2 text-left">Email</th>
                  <th className="py-2 text-left">Phone</th>
                  <th className="py-2 text-left">Source</th>
                  <th className="py-2 text-left">Status</th>
                  <th className="py-2 text-left">Created</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {paginated.map((l) => (
                  <tr
                    key={l.id}
                    className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <td className="py-3">
                      {l.firstName} {l.lastName}
                    </td>
                    <td className="py-3">{l.email}</td>
                    <td className="py-3">{l.phone || "-"}</td>
                    <td className="py-3 capitalize text-slate-600 dark:text-slate-400">
                      {l.source}
                    </td>
                    <td className="py-3">
                      <select
                        value={l.status}
                        disabled={rowLoadingId === l.id}
                        onChange={(e) =>
                          changeStatus(l.id, e.target.value as any)
                        }
                        className={`px-2 py-1 text-xs rounded-full border ${statusClass(
                          l.status
                        )}`}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="py-3">
                      {l.createdAt
                        ? new Date(l.createdAt).toLocaleDateString()
                        : "-"}
                    </td>

                    <td className="py-3 text-right">
                      <button
                        disabled={rowLoadingId === l.id}
                        onClick={() => deleteLead(l.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-200 dark:border-red-500/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                      >
                        <MdDelete />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
