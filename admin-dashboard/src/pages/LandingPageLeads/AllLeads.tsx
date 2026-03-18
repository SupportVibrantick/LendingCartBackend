import { useEffect, useMemo, useState } from "react";
import { MdDelete } from "react-icons/md";
import { TiPlus } from "react-icons/ti";
import Swal from "sweetalert2";

import {
  Users,
  UserCheck,
  Activity,
  Search,
  // Filter,
} from "lucide-react";
import toast from "react-hot-toast";
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

  leadType: string;
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
    "" | "commerciallendingmastery" | "clm-landing-page"
  >("");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [rowLoadingId, setRowLoadingId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(5);
  const [total, setTotal] = useState(0);

  const totalPages = Math.ceil(total / limit);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    source: "Admin",
  });

  const [stats, setStats] = useState({
    totalLeads: 0,
    convertedLeads: 0,
    newLeads: 0,
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /* ================= FETCH ================= */
  async function fetchLeads(page = 1) {
    setLoading(true);

    try {
      const params = new URLSearchParams();

      params.append("page", String(page));
      params.append("limit", String(limit));

      if (source) params.append("source", source);

      const res = await fetch(
        `${API_BASE}/admin/landing-page-leads/leads?${params.toString()}`,
        {
          headers: getAuthHeaders(),
        },
      );

      if (!res.ok) throw new Error("Failed to load leads");

      const json = await res.json();

      setLeads(json.data || []);
      setCurrentPage(json.meta?.page || 1);
      setTotal(json.meta?.total || 0);
    } catch (err) {
      console.error("Leads error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchStats() {
    try {
      const res = await fetch(`${API_BASE}/admin/landing-page-leads/stats`, {
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error("Failed to load stats");

      const json = await res.json();

      const d = json.data;

      setStats({
        totalLeads: d.totalLeads || 0,
        newLeads: d.newLeads || 0,
        convertedLeads: d.convertedLeads || 0,
      });
    } catch (err) {
      console.error("Stats error:", err);
    }
  }

  useEffect(() => {
    fetchLeads(1);
    fetchStats();
  }, [source]);

  /* ================= FILTER + PAGINATION ================= */

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return leads.filter((l) =>
      `${l.firstName} ${l.lastName} ${l.email} ${l.phone} ${l.status}`
        .toLowerCase()
        .includes(q),
    );
  }, [leads, query]);

  /* ================= ACTIONS ================= */

  async function changeStatus(
    id: string,
    status: Lead["status"],
    leadType: string,
  ) {
    setRowLoadingId(id);

    try {
      const payload = {
        id,
        status,
        leadType,
      };

      const res = await fetch(
        `${API_BASE}/admin/landing-page-leads/leads/status`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        },
      );

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(json?.message || "Failed to update status");
        return;
      }

      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));

      fetchStats();
    } catch (err) {
      toast.error("Failed to update status");
    } finally {
      setRowLoadingId(null);
    }
  }

  async function deleteLead(id: string) {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to recover this lead!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete it!",
    });

    if (!result.isConfirmed) return;

    setRowLoadingId(id);

    const url = source
      ? `${API_BASE}/admin/landing-page-leads/${source}/${id}`
      : `${API_BASE}/admin/landing-page-leads/${id}`;

    try {
      const res = await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem("admin_token")}`,
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) throw new Error();

      setLeads((prev) => prev.filter((l) => l.id !== id));

      Swal.fire({
        title: "Deleted!",
        text: "Lead has been deleted successfully.",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch {
      Swal.fire({
        title: "Error!",
        text: "Failed to delete lead.",
        icon: "error",
      });
    } finally {
      setRowLoadingId(null);
    }
  }

  const openAdd = () => {
    setForm({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      source: "Admin",
    });
    setFormError(null);
    setIsAddOpen(true);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setFormError(null);

    if (!form.email.trim()) {
      setFormError("Email is required.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(
        `${API_BASE}/admin/landing-page-leads/crm/manual-leads`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(form),
        },
      );

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setFormError(json?.message || "Failed to create lead");
        return;
      }

      setIsAddOpen(false);
      await fetchLeads();
    } catch (err: any) {
      setFormError("Network error");
      console.log(err);
    } finally {
      setSubmitting(false);
    }
  };

  function gotoPage(page: number) {
    if (page < 1 || page > totalPages) return;
    fetchLeads(page);
  }

  /* ================= UI ================= */

  return (
    <div className="px-6 py-6 bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100 min-h-screen">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {/* TOTAL LEADS */}
        <div
          className="
    bg-white dark:bg-slate-900
    border border-slate-200 dark:border-slate-800
    rounded-2xl p-6
    shadow-sm hover:shadow-md
    transition-all duration-200
    flex items-center justify-between
  "
        >
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Total Leads
            </p>
            <p className="text-xl font-semibold text-slate-900 dark:text-white mt-1">
              {stats.totalLeads}
            </p>
          </div>

          <div className="h-8 w-8 flex items-center justify-center rounded-full bg-indigo-600 text-white">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* CONVERTED LEADS */}
        <div
          className="
    bg-white dark:bg-slate-900
    border border-slate-200 dark:border-slate-800
    rounded-2xl p-6
    shadow-sm hover:shadow-md
    transition-all duration-200
    flex items-center justify-between
  "
        >
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Converted Leads
            </p>
            <p className="text-xl font-semibold text-slate-900 dark:text-white mt-1">
              {stats.convertedLeads}
            </p>
          </div>

          <div className="h-8 w-8 flex items-center justify-center rounded-full bg-purple-600 text-white">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        {/* NEW LEADS */}
        <div
          className="
    bg-white dark:bg-slate-900
    border border-slate-200 dark:border-slate-800
    rounded-2xl p-6
    shadow-sm hover:shadow-md
    transition-all duration-200
    flex items-center justify-between
  "
        >
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              New Leads
            </p>
            <p className="text-xl font-semibold text-slate-900 dark:text-white mt-1">
              {stats.newLeads}
            </p>
          </div>

          <div className="h-8 w-8 flex items-center justify-center rounded-full bg-emerald-600 text-white">
            <Activity className="w-5 h-5" />
          </div>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#13538A] dark:text-indigo-600">
            All Leads
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage landing page leads and follow-ups
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          {/* Source Dropdown */}
          <div className="relative">
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as any)}
              className="
                appearance-none
                pl-3 pr-9 py-2.5
                rounded-xl text-sm font-medium
                bg-white dark:bg-slate-800
                text-slate-900 dark:text-slate-100
                border border-slate-300 dark:border-slate-600
                hover:bg-slate-50 dark:hover:bg-slate-700
                focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500
                transition cursor-pointer
              "
            >
              <option value="">All Leads</option>
              <option value="commerciallendingmastery">
                Commercial Lending Mastery
              </option>
              <option value="clmlandingpage">CLM Landing Page</option>
            </select>

            {/* Dropdown Arrow */}
            <svg
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 sm:flex-none">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>

            <input
              placeholder="Search leads..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="
        pl-10 pr-4 py-2.5
        rounded-xl text-sm
        bg-white dark:bg-slate-800
        text-slate-900 dark:text-slate-100
        border border-slate-300 dark:border-slate-600
        placeholder:text-slate-400
        focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500
        transition
        w-full sm:w-64
      "
            />
          </div>
          <button
            onClick={openAdd}
            className="inline-flex items-center whitespace-nowrap px-4 py-2.5 bg-[#13538A] text-white text-sm font-bold rounded-xl hover:bg-[#1169b7] shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
          >
            <TiPlus className="mr-2 text-lg" />
            Add Leads
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
            {/* Spinner */}
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />

            {/* Message */}
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Loading leads...
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            {/* Icon */}
            <div
              className="w-14 h-14 flex items-center justify-center
      rounded-full
      bg-blue-100 dark:bg-blue-900/30
      text-blue-600 dark:text-blue-400
      mb-4"
            >
              <Search size={26} />
            </div>

            {/* Title */}
            <h3 className="text-base font-semibold text-slate-800 dark:text-white">
              No Leads Found
            </h3>

            {/* Subtitle */}
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-sm">
              There are no leads matching your current filters or search
              criteria.
            </p>
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
                {filtered.map((l) => (
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
                          changeStatus(l.id, e.target.value as any, l.leadType)
                        }
                        className={`px-2 py-1 text-xs rounded-full border ${statusClass(
                          l.status,
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
            {!loading && totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Page{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {currentPage}
                  </span>{" "}
                  of {totalPages}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => gotoPage(currentPage - 1)}
                    className="px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700
        bg-white dark:bg-slate-900
        text-slate-700 dark:text-slate-200
        hover:bg-slate-50 dark:hover:bg-slate-800
        disabled:opacity-40"
                  >
                    Prev
                  </button>

                  {Array.from({ length: totalPages }).map((_, i) => {
                    const page = i + 1;

                    return (
                      <button
                        key={page}
                        onClick={() => gotoPage(page)}
                        className={`px-3 py-1.5 rounded-md border text-sm
            ${
              currentPage === page
                ? "bg-blue-600 text-white border-blue-600"
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
                    className="px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700
        bg-white dark:bg-slate-900
        text-slate-700 dark:text-slate-200
        hover:bg-slate-50 dark:hover:bg-slate-800
        disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {isAddOpen && (
          <div className="fixed inset-0 z-[500000] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
            <div className="bg-white rounded-xl p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-lg dark:bg-slate-900 dark:border dark:border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                  Create Lead
                </h2>
                <button
                  onClick={() => setIsAddOpen(false)}
                  className="text-gray-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-500 text-sm sm:text-base"
                >
                  Close
                </button>
              </div>

              <form
                onSubmit={handleSubmit}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              >
                <label>
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    First Name
                  </span>
                  <input
                    value={form.firstName}
                    onChange={(e) =>
                      setForm({ ...form, firstName: e.target.value })
                    }
                    className="mt-1 w-full px-3 py-2 rounded-lg border text-sm
        border-slate-300 dark:border-slate-600
        bg-white dark:bg-slate-800
        text-slate-900 dark:text-white"
                    placeholder="John"
                  />
                </label>

                <label>
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    Last Name
                  </span>
                  <input
                    value={form.lastName}
                    onChange={(e) =>
                      setForm({ ...form, lastName: e.target.value })
                    }
                    className="mt-1 w-full px-3 py-2 rounded-lg border text-sm
        border-slate-300 dark:border-slate-600
        bg-white dark:bg-slate-800
        text-slate-900 dark:text-white"
                    placeholder="Doe"
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    Email <span className="text-red-500">*</span>
                  </span>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    className="mt-1 w-full px-3 py-2 rounded-lg border text-sm
        border-slate-300 dark:border-slate-600
        bg-white dark:bg-slate-800
        text-slate-900 dark:text-white"
                    placeholder="john@example.com"
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    Phone
                  </span>
                  <input
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                    className="mt-1 w-full px-3 py-2 rounded-lg border text-sm
        border-slate-300 dark:border-slate-600
        bg-white dark:bg-slate-800
        text-slate-900 dark:text-white"
                    placeholder="+1 234 567 890"
                  />
                </label>

                {/* Source (readonly or selectable) */}
                <label className="sm:col-span-2">
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    Source
                  </span>
                  <label className="sm:col-span-2">
                    <span className="text-sm text-slate-600 dark:text-slate-300">
                      Source
                    </span>

                    <select
                      value={form.source}
                      onChange={(e) =>
                        setForm({ ...form, source: e.target.value })
                      }
                      className="mt-1 w-full px-3 py-2 rounded-lg border text-sm
      border-slate-300 dark:border-slate-600
      bg-white dark:bg-slate-800
      text-slate-900 dark:text-white
      focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500
      transition cursor-pointer"
                    >
                      <option value="Admin">Admin</option>
                      <option value="commerciallendingmastery">
                        Commercial Lending Mastery
                      </option>
                      <option value="clmlandingpage">
                        CLM Landing Page Lead
                      </option>
                    </select>
                  </label>
                </label>

                {formError && (
                  <div className="text-sm text-red-600 sm:col-span-2">
                    {formError}
                  </div>
                )}

                <div className="sm:col-span-2 flex justify-end gap-3 mt-3">
                  {/* <button
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="px-4 py-2 rounded-lg text-sm
        text-slate-700 dark:text-slate-200
        hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button> */}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-lg bg-[#13538A] text-white text-sm font-semibold
        hover:bg-[#1074cc] disabled:opacity-70"
                  >
                    {submitting ? "Adding..." : "Add Lead"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
