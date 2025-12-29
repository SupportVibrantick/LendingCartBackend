// src/pages/Brokers/BrokersLenders.tsx
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";

type Broker = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  status?: string;
  createdAt?: string;
};

type Lender = {
  id: string;
  loanProductCode: string;
};

type RuleSet = {
  lenderProductId: string;
  name: string;
  description: string;
}

const comparisonOperators = ["GT", "GTE", "LT", "LTE", "EQ", "NEQ", "IN", "NOT_IN"];

const severity = ["Hard Fail", "Soft Fail"];

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

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
  const [brokers] = useState<Broker[]>([]);
  const [selectedBrokerId, setSelectedBrokerId] = useState<string>("");
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingBrokers] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<RuleSet>({
    lenderProductId: "",
    name: "",
    description: ""
  });

  function getAuthHeaders(): Record<string, string> {
    try {
      const token = sessionStorage.getItem("lending_token");
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

      if (!res.ok) throw new Error(`Failed to fetch loan products: ${res.status}`);

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

  // ===== Effects =====

  useEffect(() => {
    fetchLoanProducts();

  }, []);

  // ===== Handlers =====
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setFormError(null);

    if (
      !form.lenderProductId ||
      !form.name ||
      !form.description
    ) {
      setFormError(
        "Please fill required fields."
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        lenderProductId: form.lenderProductId,
        name: form.name,
        description: form.description
      }

      const headers = getAuthHeaders();

      const res = await fetch(`${API_BASE}/lender/eligibility-engine/rule-sets`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.message || "Failed to create rule set")
        setFormError(json?.message || `Server returned ${res.status}`);
        return;
      } else {
        toast.success(json.message || "Rule set created successfully")
      }

      await fetchLoanProducts();
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || "Network error");
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
            Lender Assigned Rules
          </h1>

        </div>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT CARD – Select broker */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-700">
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
            value={form.lenderProductId}
            onChange={(e) =>
              setForm((f) => ({ ...f, lenderProductId: e.target.value }))
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
                  return <option key={lender.id} value={lender.id}>
                    {lender.loanProductCode}
                  </option>
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
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
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
            <div className="text-sm text-red-600 col-span-2">
              {formError}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              disabled={submitting}
              type="submit"
              // disabled={saving}
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed
                           dark:bg-blue-500 dark:hover:bg-blue-600"
            >Create Rule Set</button>

          </div>
        </form>

        {/* RIGHT CARD – Assign Lender Form */}
        <form className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Lender Rule
          </h2>
          {/* <p className="text-sm text-gray-500 mb-4 dark:text-slate-400">
            Choose a broker to see its details and mapped lenders.
          </p> */}

          <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
            Product Name
          </label>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                       dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
            value={selectedBrokerId}
            onChange={(e) => setSelectedBrokerId(e.target.value)}
            disabled={loadingBrokers}
          >
            {loadingBrokers && <option value="">Loading brokers...</option>}
            {!loadingBrokers && brokers.length === 0 && (
              <option value="">No brokers found</option>
            )}
            {!loadingBrokers && brokers.length > 0 && (
              <>
                <option value="">Select a broker</option>
                {brokers.map((broker) => (
                  <option key={broker.id} value={broker.id}>
                    {broker.name}
                  </option>
                ))}
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
              // value={form.maxFiles}
              // onChange={(e) =>
              //   setForm((f) => ({ ...f, maxFiles: Number(e.target.value) }))
              // }
              placeholder="Enter field name"
            // disabled={saving}
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
              // value={form.maxFiles}
              // onChange={(e) =>
              //   setForm((f) => ({ ...f, maxFiles: Number(e.target.value) }))
              // }
              placeholder="Enter Value"
            // disabled={saving}
            />
          </div>

          <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2 mt-2">
            Severity
          </label>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                       dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
            value={selectedBrokerId}
            onChange={(e) => setSelectedBrokerId(e.target.value)}
            disabled={loadingBrokers}
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
            value={selectedBrokerId}
            onChange={(e) => setSelectedBrokerId(e.target.value)}
            disabled={loadingBrokers}
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
              value={form.description}
              // onChange={(e) =>
              //   setForm((f) => ({ ...f, description: e.target.value }))
              // }
              rows={2}
              disabled={submitting}
            />
          </div>

          <div >
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1 mt-2">
              Sort Order
            </label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900
                                        dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
              type="number"
              // value={form.maxFiles}
              // onChange={(e) =>
              //   setForm((f) => ({ ...f, maxFiles: Number(e.target.value) }))
              // }
              placeholder="Enter sort order"
            // disabled={saving}
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-1 mt-2">
            <button
              disabled={submitting}
              type="submit"
              // disabled={saving}
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed
                           dark:bg-blue-500 dark:hover:bg-blue-600"
            >Create Rule</button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default BrokersLenders;
