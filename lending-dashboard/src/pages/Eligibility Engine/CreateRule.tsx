// src/pages/Brokers/BrokersLenders.tsx
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";

type Lender = {
  id: string;
  loanProductCode: string;
};

type RuleSet = {
  lenderLoanProductId: string;
  name: string;
  description: string;
};

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
  ruleSetId: string;
  fieldName: string;
  comparisonOperator: string;
  value: string;
  severity: string;
  message: string;
  sortOrder: number;
};

const comparisonOperators = [
  "GT",
  "GTE",
  "LT",
  "LTE",
  "EQ",
  "NEQ",
  "IN",
  "NOT_IN",
];

const severity = ["HARD_FAIL", "SOFT_FAIL"];

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

// tiny helper for status pill
// function statusClass(status?: string) {
//   switch ((status || "").toUpperCase()) {
//     case "ACTIVE":
//       return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/40";
//     case "INACTIVE":
//       return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-300 dark:border-yellow-500/40";
//     case "SUSPENDED":
//       return "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/40";
//     default:
//       return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-slate-600/30 dark:text-slate-100 dark:border-slate-500";
//   }
// }

const BrokersLenders: React.FC = () => {
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [ruleFormError, setruleFormError] = useState<string | null>(null);
  const [ruleSetId, setRuleSetId] = useState<RuleSetId[]>([
    {
      id: "",
      lenderLoanProductId: "",
      name: "",
      description: "",
      effectiveFrom: "",
      effectiveTo: "",
      isActive: false,
      createdAt: "",
      updatedAt: "",
    },
  ]);
  const [form, setForm] = useState<RuleSet>({
    lenderLoanProductId: "",
    name: "",
    description: "",
  });
  const [ruleForm, setRuleForm] = useState<Rule>({
    ruleSetId: "",
    fieldName: "",
    comparisonOperator: "",
    value: "",
    severity: "",
    message: "",
    sortOrder: 0,
  });

  function getAuthHeaders(): Record<string, string> {
    try {
      const token = sessionStorage.getItem("lender_token");
      if (token) {
        return {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        };
      }
    } catch {
      // ignore
    }
    return { "Content-Type": "application/json" };
  }

  // ===== Helpers =====
  async function fetchLoanProducts() {
    // setLoading(true);
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
      // setLoading(false);
    }
  }

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

  // ===== Effects =====

  useEffect(() => {
    fetchLoanProducts();
    fetchRuleSetIds();
  }, []);

  // ===== Handlers =====
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setFormError(null);

    if (!form.lenderLoanProductId || !form.name || !form.description) {
      setFormError("Please fill required fields.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        lenderLoanProductId: form.lenderLoanProductId,
        name: form.name,
        description: form.description,
      };

      const headers = getAuthHeaders();

      const res = await fetch(
        `${API_BASE}/lender/eligibility-engine/rule-sets`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        },
      );

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.message || "Failed to create rule set");
        setFormError(json?.message || `Server returned ${res.status}`);
        return;
      } else {
        toast.success(json.message || "Rule set created successfully");
        setForm({
          lenderLoanProductId: "",
          name: "",
          description: "",
        });
      }

      await fetchLoanProducts();
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRuleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setruleFormError(null);

    if (
      !ruleForm.ruleSetId ||
      !ruleForm.fieldName ||
      !ruleForm.value ||
      !ruleForm.comparisonOperator ||
      !ruleForm.severity ||
      !ruleForm.message ||
      !ruleForm.sortOrder
    ) {
      setruleFormError("Please fill required fields.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        ruleSetId: ruleForm.ruleSetId,
        fieldName: ruleForm.fieldName,
        value: ruleForm.value,
        comparisonOperator: ruleForm.comparisonOperator,
        severity: ruleForm.severity,
        message: ruleForm.message,
        sortOrder: ruleForm.sortOrder,
      };

      const headers = getAuthHeaders();

      const res = await fetch(`${API_BASE}/lender/eligibility-engine/rules`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.message || "Failed to create rule");
        setruleFormError(json?.message || `Server returned ${res.status}`);
        return;
      } else {
        toast.success(json.message || "Rule created successfully");
        setRuleForm({
          ruleSetId: "",
          fieldName: "",
          comparisonOperator: "",
          value: "",
          severity: "",
          message: "",
          sortOrder: 0,
        });
      }

      await fetchRuleSetIds();
    } catch (err: any) {
      console.error(err);
      setruleFormError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  // const selectedBroker = brokers.find((b) => b.id === selectedBrokerId);

  // ===== UI =====
  return (
    <div className="px-6 py-6 text-gray-900 dark:text-gray-100">
      {/* Heading same style as BrokersPage */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Lender <span className="text-[#18B6B4]">Assigned Rules</span>
          </h1>
        </div>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT CARD – Select broker */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-700"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Lender Rule Set
          </h2>
          {/* <p className="text-sm text-gray-500 mb-4 dark:text-slate-400">
            Choose a broker to see its details and mapped lenders.
          </p> */}

          <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
            Lender Product
          </label>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                       dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100 mb-2"
            value={form.lenderLoanProductId}
            onChange={(e) =>
              setForm((f) => ({ ...f, lenderLoanProductId: e.target.value }))
            }
            disabled={submitting}
          >
            {lenders.length === 0 && (
              <option value="">No lender products found</option>
            )}
            {lenders.length > 0 && (
              <>
                <option value="">Select a product</option>
                {lenders.map((lender) => {
                  return (
                    <option key={lender.id} value={lender.id}>
                      {lender.loanProductCode}
                    </option>
                  );
                })}
              </>
            )}
          </select>

          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
              Name
            </label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                                        dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Enter name"
              disabled={submitting}
            />
          </div>

          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
              Description
            </label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                                        dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={2}
              disabled={submitting}
            />
          </div>

          {formError && (
            <div className="text-sm text-red-600 col-span-2">{formError}</div>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              disabled={submitting}
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-[#18B6B4] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#159e9c] disabled:opacity-60 disabled:cursor-not-allowed
  dark:bg-[#18B6B4] dark:hover:bg-[#159e9c]"
            >
              Create Rule Set
            </button>
          </div>
        </form>

        {/* RIGHT CARD – Assign Lender Form */}
        <form
          onSubmit={handleRuleSubmit}
          className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-700"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Lender Rule
          </h2>
          {/* <p className="text-sm text-gray-500 mb-4 dark:text-slate-400">
            Choose a broker to see its details and mapped lenders.
          </p> */}

          <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
            Rule Set Name
          </label>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                       dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
            value={ruleForm.ruleSetId}
            onChange={(e) =>
              setRuleForm((f) => ({ ...f, ruleSetId: e.target.value }))
            }
            disabled={submitting}
          >
            {ruleSetId.length === 0 && (
              <option value="">No rule set names found</option>
            )}
            {ruleSetId.length > 0 && (
              <>
                <option value="">Select a rule set name</option>
                {ruleSetId.map((rule) => {
                  return (
                    <option key={rule.id} value={rule.id}>
                      {rule.name}
                    </option>
                  );
                })}
              </>
            )}
          </select>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1 mt-2">
              Field Name
            </label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                                        dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
              type="text"
              value={ruleForm.fieldName}
              onChange={(e) =>
                setRuleForm((f) => ({ ...f, fieldName: e.target.value }))
              }
              placeholder="Enter field name"
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1 mt-2">
              Value
            </label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                                        dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
              type="number"
              min={0}
              value={ruleForm.value}
              onChange={(e) =>
                setRuleForm((f) => ({ ...f, value: e.target.value }))
              }
              placeholder="Enter Value"
              disabled={submitting}
            />
          </div>

          <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2 mt-2">
            Severity
          </label>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                       dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
            value={ruleForm.severity}
            onChange={(e) =>
              setRuleForm((f) => ({ ...f, severity: e.target.value }))
            }
            disabled={submitting}
          >
            {severity.length > 0 && (
              <>
                <option value="">Select a severity</option>
                {severity.map((s, i) => (
                  <option key={i} value={s}>
                    {s}
                  </option>
                ))}
              </>
            )}
          </select>

          <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2 mt-2">
            Comparison Operator
          </label>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                       dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
            value={ruleForm.comparisonOperator}
            onChange={(e) =>
              setRuleForm((f) => ({ ...f, comparisonOperator: e.target.value }))
            }
            disabled={submitting}
          >
            {comparisonOperators.length > 0 && (
              <>
                <option value="">Select a Operator</option>
                {comparisonOperators.map((operator, i) => (
                  <option key={i} value={operator}>
                    {operator}
                  </option>
                ))}
              </>
            )}
          </select>

          <div className="mb-2 mt-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
              Message
            </label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                                        dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
              value={ruleForm.message}
              onChange={(e) =>
                setRuleForm((f) => ({ ...f, message: e.target.value }))
              }
              rows={2}
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1 mt-2">
              Sort Order
            </label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                                        dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
              type="number"
              // value={ruleForm.sortOrder}
              min={0}
              onChange={(e) =>
                setRuleForm((f) => ({
                  ...f,
                  sortOrder: Number(e.target.value),
                }))
              }
              placeholder="Enter sort order"
              disabled={submitting}
            />
          </div>

          {ruleFormError && (
            <div className="text-sm text-red-600 col-span-2">
              {ruleFormError}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-1 mt-2">
            <button
              disabled={submitting}
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-[#18B6B4] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#159e9c] disabled:opacity-60 disabled:cursor-not-allowed
  dark:bg-[#18B6B4] dark:hover:bg-[#159e9c]"
            >
              Create Rule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BrokersLenders;
