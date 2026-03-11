import { useEffect, useState, useMemo } from "react";
import { MdModeEdit } from "react-icons/md";
import EditRuleModal from "./EditRuleModal";
import toast from "react-hot-toast";

type RuleSetId = {
  id: string;
  lenderLoanProductId: string;
  name: string;
  description: string;
  effectiveFrom: string;
  effectiveTo: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type Rule = {
  id: string;
  ruleSetId: string;
  fieldName: string;
  comparisonOperator: string;
  value: string;
  severity: string;
  message: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export default function AllRuleSets() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [selectedLenderProductId, setSelectedLenderProductId] =
    useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [ruleSetId, setRuleSetId] = useState<RuleSetId[]>([]);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);

  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState<number>(10);
  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

  useEffect(() => {
    setCurrentPage(1);
  }, [query, pageSize, selectedLenderProductId]);

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

  useEffect(() => {
    if (!selectedLenderProductId) {
      setRules([]);
      return;
    }

    const controller = new AbortController();

    const loadRules = async () => {
      setLoadingRules(true);
      try {
        const res = await fetch(
          `${API_BASE}/lender/eligibility-engine/rules?ruleSetId=${selectedLenderProductId}`,
          {
            headers: getAuthHeaders(),
            signal: controller.signal,
          },
        );

        const json = await res.json();

        if (!res.ok || json.success === false) {
          setRules([]);
          return;
        }

        setRules(Array.isArray(json.data) ? json.data : []);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error(err);
          setRules([]);
        }
      } finally {
        setLoadingRules(false);
      }
    };

    loadRules();

    // cancel previous request
    return () => controller.abort();
  }, [selectedLenderProductId]);

  async function fetchRuleSetIds() {
    // setLoading(true);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(
        `${API_BASE}/lender/eligibility-engine/rule-sets/all`,
        {
          method: "GET",
          headers,
        },
      );

      if (!res.ok)
        throw new Error(`Failed to fetch rule set ids: ${res.status}`);

      const json = await res.json();

      const list = Array.isArray(json)
        ? json
        : json.data?.results || json.data || [];

      setRuleSetId(list);
    } catch (err) {
      console.error(err);
    } finally {
      // setLoading(false);
    }
  }

  useEffect(() => {
    fetchRuleSetIds();
  }, []);

  const filteredRules = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rules;

    return rules.filter(
      (r) =>
        r.fieldName.toLowerCase().includes(q) ||
        r.comparisonOperator.toLowerCase().includes(q) ||
        r.severity.toLowerCase().includes(q),
    );
  }, [rules, query]);

  const totalItems = filteredRules.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const paginatedRules = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRules.slice(start, start + pageSize);
  }, [filteredRules, currentPage, pageSize]);

  const handleEditSave = async (updated: Rule) => {
    try {
      const res = await fetch(
        `${API_BASE}/lender/eligibility-engine/rules/${updated.id}`,
        {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            fieldName: updated.fieldName,
            comparisonOperator: updated.comparisonOperator,
            value: updated.value,
            severity: updated.severity,
            message: updated.message,
            sortOrder: updated.sortOrder,
          }),
        },
      );

      const json = await res.json();

      if (!res.ok || json.success === false) {
        toast.error(json.message || "Failed to update rule");
        return;
      }

      setRules((prev) =>
        prev.map((r) => (r.id === updated.id ? json.data : r)),
      );

      toast.success("Rule updated successfully");
      setEditingRule(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update rule");
    }
  };

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 text-gray-900 dark:text-gray-100">
      {/* Header + controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
            All <span className="text-[#18B6B4]">Rules</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 dark:text-slate-400">
            Manage rules
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="flex flex-1 sm:flex-none items-center gap-2">
            <select
              className="px-2 py-2 border rounded-md bg-white text-gray-900 text-sm
                         border-gray-300
                         dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
              value={selectedLenderProductId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedLenderProductId(id);
              }}
            >
              <option value="">Select Rule Set Name</option>
              {ruleSetId
                .filter((r) => r.id)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
            <input
              placeholder="Search by field name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-md text-sm sm:text-base
                         focus:outline-none focus:ring-1 focus:ring-blue-500
                         border-gray-300 bg-white text-gray-900
                         dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100
                         placeholder-gray-400 dark:placeholder-slate-400"
              aria-label="Search brokers"
            />
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2 py-2 border rounded-md bg-white text-gray-900 text-sm
                         border-gray-300
                         dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
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
        <h2 className="text-lg font-semibold mb-3">Eligibility Rules</h2>

        {loadingRules ? (
          <div className="py-6 text-center text-gray-500">Loading rules...</div>
        ) : paginatedRules.length === 0 ? (
          <div
            className="py-10 flex flex-col items-center justify-center text-center rounded-lg border border-dashed
                border-gray-300 bg-gray-50
                dark:border-slate-700 dark:bg-slate-800/40"
          >
            {/* ICON */}
            <div className="mb-3 text-3xl">
              {!selectedLenderProductId && "📌"}
              {selectedLenderProductId && rules.length === 0 && !query && "📭"}
              {query && "🔍"}
            </div>

            {/* MESSAGE */}
            <p className="text-sm sm:text-base font-medium text-gray-700 dark:text-slate-200">
              {!selectedLenderProductId && (
                <>
                  Please{" "}
                  <span className="text-[#18B6B4] font-semibold">
                    select a rule set
                  </span>{" "}
                  to view eligibility rules.
                </>
              )}

              {selectedLenderProductId && rules.length === 0 && !query && (
                <>
                  No <span className="font-semibold">eligibility rules</span>{" "}
                  found for the selected rule set.
                </>
              )}

              {query && (
                <>
                  No rules matched your
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {" "}
                    search criteria
                  </span>
                  .
                </>
              )}
            </p>

            {/* HELPER TEXT */}
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
              {!selectedLenderProductId &&
                "Choose a rule set from the dropdown above."}
              {selectedLenderProductId &&
                rules.length === 0 &&
                !query &&
                "Try adding a new rule for this rule set."}
              {query && "Try adjusting or clearing the search input."}
            </p>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-gray-500">
                <th className="py-2 text-left">Field</th>
                <th className="py-2 text-left">Operator</th>
                <th className="py-2 text-left">Value</th>
                <th className="py-2 text-left">Severity</th>
                <th className="py-2 text-left">Message</th>
                <th className="py-2 text-left">Sort Order</th>
                <th className="py-2 text-left">Created</th>
                <th className="py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRules.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-3">{r.fieldName}</td>

                  <td className="py-3">
                    <span className="px-2 py-1 text-xs rounded">
                      {r.comparisonOperator}
                    </span>
                  </td>

                  <td className="py-3">{r.value}</td>

                  <td className="py-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs border ${
                        r.severity === "HARD_FAIL"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {r.severity}
                    </span>
                  </td>

                  <td className="py-3 max-w-xs truncate">
                    {r.message?.trim() || "—"}
                  </td>

                  <td className="py-3">{r.sortOrder}</td>

                  <td className="py-3">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>

                  <td className="py-3">
                    <button
                      onClick={() => setEditingRule(r)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100
                       dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <MdModeEdit />
                    </button>
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

      {/* Edit Rule  Modal */}
      {editingRule && (
        <EditRuleModal
          isOpen={true}
          rule={editingRule}
          onClose={() => setEditingRule(null)}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
}
