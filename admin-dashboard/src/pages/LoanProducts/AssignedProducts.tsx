import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

/* ================= API ================= */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "http://localhost:3001",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("admin_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* ================= TYPES ================= */
type AssignedProduct = {
  id: string;
  lenderName: string;
  productName: string;
  productCode: string;
  isActive: boolean;
  createdAt?: string;
};

/* ================= COMPONENT ================= */
const AssignedProducts: React.FC = () => {
  const [assignments, setAssignments] = useState<AssignedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLender, setSelectedLender] = useState<string>("");

  /* ================= LOAD DATA ================= */
  const fetchAssignments = async () => {
    try {
      setLoading(true);

      const res = await api.get("/admin/lender-products/read");

      const list =
        Array.isArray(res.data?.data)
          ? res.data.data
          : res.data?.data?.results || [];

      setAssignments(
        list.map((a: any) => ({
          id: a.id,
          lenderName: a.lender?.name || "-",
          productName: a.loanProduct?.name || "-",
          productCode: a.loanProduct?.code || "-",
          isActive: a.isActive,
          createdAt: a.createdAt,
        }))
      );
    } catch (err) {
      console.error("Failed to fetch assigned products", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  /* ================= DERIVED DATA ================= */

  // Unique lenders for filter dropdown
  const lenders = useMemo(() => {
    return Array.from(
      new Set(assignments.map((a) => a.lenderName).filter(Boolean))
    );
  }, [assignments]);

  // Filtered rows
  const filteredAssignments = useMemo(() => {
    if (!selectedLender) return assignments;
    return assignments.filter((a) => a.lenderName === selectedLender);
  }, [assignments, selectedLender]);

  /* ================= UI ================= */
  return (
    <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 shadow p-6">
      {/* Header + Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold">Assigned Lender Products</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Which lender is assigned which loan product
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Lender Filter */}
          <select
            value={selectedLender}
            onChange={(e) => setSelectedLender(e.target.value)}
            className="rounded-md border px-3 py-1.5 text-sm bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
          >
            <option value="">All Lenders</option>
            {lenders.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>

          {/* Refresh */}
          <button
            onClick={fetchAssignments}
            disabled={loading}
            className="rounded-full border border-slate-300 dark:border-slate-600 px-4 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 uppercase">
              <th className="py-2 pr-4 text-left">Lender</th>
              <th className="py-2 pr-4 text-left">Product</th>
              <th className="py-2 pr-4 text-left">Code</th>
              <th className="py-2 pr-4 text-left">Status</th>
              <th className="py-2 pr-4 text-left">Created</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-6 text-center text-slate-500 dark:text-slate-400"
                >
                  Loading...
                </td>
              </tr>
            ) : filteredAssignments.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-6 text-center text-slate-500 dark:text-slate-400"
                >
                  No assignments found
                </td>
              </tr>
            ) : (
              filteredAssignments.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-slate-200 dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <td className="py-3 pr-4">{a.lenderName}</td>
                  <td className="py-3 pr-4">{a.productName}</td>
                  <td className="py-3 pr-4">{a.productCode}</td>
                  <td className="py-3 pr-4">
                    {a.isActive ? "ACTIVE" : "INACTIVE"}
                  </td>
                  <td className="py-3 pr-4">
                    {a.createdAt
                      ? new Date(a.createdAt).toLocaleDateString()
                      : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AssignedProducts;
