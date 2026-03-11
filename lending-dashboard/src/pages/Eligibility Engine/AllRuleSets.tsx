import { useEffect, useState, useMemo } from "react";
import { MdModeEdit } from "react-icons/md";
import EditRuleSetModal from "./EditRuleSetModal"; // adjust path if needed
import toast from "react-hot-toast";

type RuleSet = {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  lenderProductId: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
};

type LoanProductList = {
  id: string;
  lenderOrgId: string;
  loanProductId: string;
  loanProductCode: string;
  loanProductName: string;
  minLoanAmount: number;
  maxLoanAmount: number;
  minTermMonths: number;
  maxTermMonths: number;
  industriesSupported: string[];
  regionsSupported: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

// function statusClass(status?: string) {
//     switch (status) {
//         case "ACTIVE":
//             return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/40";
//         case "INACTIVE":
//             return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-300 dark:border-yellow-500/40";
//         case "SUSPENDED":
//             return "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/40";
//         default:
//             return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-slate-600/30 dark:text-slate-100 dark:border-slate-500";
//     }
// }

export default function AllRuleSets() {
  const [rules, setRules] = useState<RuleSet[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [selectedLenderProductId, setSelectedLenderProductId] =
    useState<string>("");
  const [lenders, setLenders] = useState<LoanProductList[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  // const [rowLoadingId, setRowLoadingId] = useState<string | null>(null);

  // const [isAddOpen, setIsAddOpen] = useState(false);
  // const [form, setForm] = useState({
  //     organizationName: "",
  //     organizationEmail: "",
  //     organizationPhone: "",
  //     adminFirstName: "",
  //     adminLastName: "",
  //     adminEmail: "",
  //     adminPassword: "",
  // });
  // const [formError, setFormError] = useState<string | null>(null);
  // const [submitting, setSubmitting] = useState(false);

  const [editingRuleSet, setEditingRuleSet] = useState<RuleSet | null>(null);

  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState<number>(10);
  // const [currentPage, setCurrentPage] = useState<number>(1);

  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

  useEffect(() => {
    setCurrentPage(1);
  }, [query, pageSize]);

  function getAuthHeaders(): Record<string, string> {
    try {
      const token = sessionStorage.getItem("lender_token");
      if (token) {
        return {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        };
      }
    } catch (e) {
      // ignore
    }
    return { "Content-Type": "application/json" };
  }

  async function fetchRuleSets(lenderProductId: string) {
    if (!lenderProductId) {
      setRules([]);
      return;
    }

    setLoadingRules(true);

    try {
      const res = await fetch(
        `${API_BASE}/lender/eligibility-engine/rule-sets?lenderProductId=${lenderProductId}`,
        {
          method: "GET",
          headers: getAuthHeaders(),
        },
      );

      const json = await res.json();

      if (!res.ok || json.success === false) {
        console.error("Rule sets error:", json);
        setRules([]);
        return;
      }

      const list = Array.isArray(json.data) ? json.data : [];
      setRules(list);
    } catch (err) {
      console.error("Failed to fetch rule sets", err);
      setRules([]);
    } finally {
      setLoadingRules(false);
    }
  }

  async function fetchLoanProducts() {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/lender/loan-products/list`, {
        method: "GET",
        headers,
      });

      if (!res.ok)
        throw new Error(`Failed to fetch loan products: ${res.status}`);

      const json = await res.json();

      const list = Array.isArray(json)
        ? json
        : json.data?.results || json.data || [];

      setLenders(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLoanProducts();
  }, []);

  const filteredRules = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return rules;

    return rules.filter((r) => r.name.toLowerCase().includes(q));
  }, [rules, query]);

  const totalItems = filteredRules.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const paginatedRules = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRules.slice(start, start + pageSize);
  }, [filteredRules, currentPage, pageSize]);
  // const openAdd = () => {
  //     setForm({
  //         organizationName: "",
  //         organizationEmail: "",
  //         organizationPhone: "",
  //         adminFirstName: "",
  //         adminLastName: "",
  //         adminEmail: "",
  //         adminPassword: "",
  //     });
  //     setFormError(null);
  //     setIsAddOpen(true);
  // };

  // const handleSubmit = async (e?: React.FormEvent) => {
  //     e?.preventDefault();
  //     setFormError(null);

  //     if (
  //         !form.organizationName.trim() ||
  //         !form.organizationEmail.trim() ||
  //         !form.adminEmail.trim() ||
  //         !form.adminPassword.trim()
  //     ) {
  //         setFormError(
  //             "Please fill required fields: organization name, organization email, admin email and password."
  //         );
  //         return;
  //     }

  //     setSubmitting(true);
  //     try {
  //         const payload = {
  //             organizationName: form.organizationName,
  //             organizationEmail: form.organizationEmail,
  //             organizationPhone: form.organizationPhone,
  //             adminFirstName: form.adminFirstName,
  //             adminLastName: form.adminLastName,
  //             adminEmail: form.adminEmail,
  //             adminPassword: form.adminPassword,
  //         };

  //         const headers = getAuthHeaders();

  //         const res = await fetch(`${API_BASE}/admin/brokers/create`, {
  //             method: "POST",
  //             headers,
  //             body: JSON.stringify(payload),
  //         });

  //         const json = await res.json().catch(() => ({}));
  //         if (!res.ok) {
  //             setFormError(json?.message || `Server returned ${res.status}`);
  //             return;
  //         }

  //         setIsAddOpen(false);
  //         await fetchBrokers();
  //     } catch (err: any) {
  //         console.error(err);
  //         setFormError(err.message || "Network error");
  //     } finally {
  //         setSubmitting(false);
  //     }
  // };

  // const filtered = useMemo(() => {
  //     const q = query.trim().toLowerCase();
  //     if (!q) return brokers;
  //     return brokers.filter((b) => {
  //         return (
  //             (b.name || "").toLowerCase().includes(q) ||
  //             (b.email || "").toLowerCase().includes(q) ||
  //             (b.phone || "").toLowerCase().includes(q) ||
  //             (b.status || "").toLowerCase().includes(q)
  //         );
  //     });
  // }, [brokers, query]);

  // const total = filtered.length;
  // const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // useEffect(() => {
  //     if (currentPage > totalPages) setCurrentPage(totalPages);
  // }, [currentPage, totalPages]);

  // const paginated = useMemo(() => {
  //     const start = (currentPage - 1) * pageSize;
  //     return filtered.slice(start, start + pageSize);
  // }, [filtered, currentPage, pageSize]);

  // function gotoPage(page: number) {
  //     if (page < 1) page = 1;
  //     if (page > totalPages) page = totalPages;
  //     setCurrentPage(page);
  //     window.scrollTo({ top: 0, behavior: "smooth" });
  // }

  const openEditModal = (r: RuleSet) => {
    setEditingRuleSet(r);
  };

  const handleEditSave = async (updated: RuleSet): Promise<void> => {
    // 🔹 optimistic UI update
    // setRules((prev) =>
    //     prev.map((r) => (r.id === updated.id ? updated : r))
    // );

    setEditingRuleSet(null);
    try {
      const res = await fetch(
        `${API_BASE}/lender/eligibility-engine/rules-set/${updated.id}`,
        {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            name: updated.name,
            description: updated.description,
            effectiveFrom: updated.effectiveFrom,
            effectiveTo: updated.effectiveTo,
          }),
        },
      );

      const json = await res.json();

      if (!res.ok || json.success === false) {
        console.error(json.message || "Failed to update rule set");
        toast.error("Failed to update rule set");
      }

      // 🔹 sync with server response (optional but best)
      if (json.success) {
        setRules((prev) =>
          prev.map((r) => (r.id === updated.id ? json.data : r)),
        );
        toast.success("Updated successfully");
      }
    } catch (err) {
      console.error("Failed to update rule set", err);
      toast.error("Failed to update rule set");
    }
  };

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 text-gray-900 dark:text-gray-100">
      {/* Header + controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
            All <span className="text-[#18B6B4]">Set Rules</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 dark:text-slate-400">
            Manage set rules
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="flex flex-1 sm:flex-none items-center gap-3">
            {/* Loan Product Select */}
            <select
              className="h-10 px-3 border rounded-md text-sm
    bg-white text-gray-900 border-gray-300
    dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100
    focus:outline-none focus:ring-2 focus:ring-[#18B6B4]/30 focus:border-[#18B6B4]"
              value={selectedLenderProductId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedLenderProductId(id);
                fetchRuleSets(id);
              }}
            >
              <option value="">Select Loan Product</option>
              {lenders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.loanProductCode}
                </option>
              ))}
            </select>

            {/* Search */}
            <div className="relative flex-1">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
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
                placeholder="Search by name"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full h-10 pl-9 pr-3 border rounded-md text-sm
      bg-white text-gray-900 border-gray-300
      dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100
      placeholder-gray-400 dark:placeholder-slate-400
      focus:outline-none focus:ring-2 focus:ring-[#18B6B4]/30 focus:border-[#18B6B4]"
                aria-label="Search brokers"
              />
            </div>

            {/* Page Size */}
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="h-10 px-3 border rounded-md text-sm
    bg-white text-gray-900 border-gray-300
    dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100
    focus:outline-none focus:ring-2 focus:ring-[#18B6B4]/30 focus:border-[#18B6B4]"
              aria-label="Page size"
            >
              <option value={5}>5 / page</option>
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="mt-6 bg-white rounded-xl border p-5 dark:bg-slate-900">
        <h2 className="text-lg font-semibold mb-3">Eligibility Rule Sets</h2>

        {loadingRules ? (
          <div className="py-6 text-center text-gray-500">
            Loading rule sets...
          </div>
        ) : paginatedRules.length === 0 ? (
          <div
            className="py-10 flex flex-col items-center justify-center text-center
               rounded-lg border border-dashed
               border-gray-300 bg-gray-50
               dark:border-slate-700 dark:bg-slate-800/40"
          >
            {/* Icon */}
            <div className="mb-3 text-3xl">{query ? "🔍" : "📌"}</div>

            {/* Main Message */}
            <p className="text-sm sm:text-base font-medium text-gray-700 dark:text-slate-200">
              {query ? (
                <>
                  No <span className="font-semibold">rule sets</span> matched
                  your
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {" "}
                    search
                  </span>
                  .
                </>
              ) : (
                <>
                  Please{" "}
                  <span className="text-[#18B6B4] font-semibold">
                    select a loan product
                  </span>{" "}
                  to view rule sets.
                </>
              )}
            </p>

            {/* Helper Text */}
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
              {query
                ? "Try changing or clearing the search keyword."
                : "Choose a product from the dropdown above."}
            </p>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-gray-500">
                <th className="py-2 text-left">Name</th>
                <th className="py-2 text-left">Description</th>
                <th className="py-2 text-left">Status</th>
                <th className="py-2 text-left">Effective From</th>
                <th className="py-2 text-left">Effective To</th>
                <th className="py-2 text-left">Created</th>
                <th className="py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRules.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-3">{r.name}</td>
                  <td className="py-3">{r.description || "-"}</td>
                  <td className="py-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs border ${
                        r.isActive
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {r.isActive ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </td>
                  <td className="py-3">{formatDate(r.effectiveFrom)}</td>

                  <td className="py-3">{formatDate(r.effectiveTo)}</td>
                  <td className="py-3">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        disabled={loading}
                        onClick={() => openEditModal(r)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-40
                                                                             dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                        aria-label={`Edit ${r.id}`}
                      >
                        <MdModeEdit />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-end items-center gap-2 mt-4">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            Prev
          </button>

          {Array.from({ length: totalPages }).map((_, i) => {
            const page = i + 1;
            return (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1 border rounded ${
                  page === currentPage
                    ? "bg-[#18B6B4] text-white"
                    : "bg-white text-gray-700"
                }`}
              >
                {page}
              </button>
            );
          })}

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {/* Edit Rule set Modal */}
      {editingRuleSet && (
        <EditRuleSetModal
          isOpen={true}
          ruleSet={editingRuleSet}
          onClose={() => setEditingRuleSet(null)}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
}
