import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

/* ================= API ================= */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "http://localhost:4000",
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

      const list = Array.isArray(res.data?.data)
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
        })),
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
      new Set(assignments.map((a) => a.lenderName).filter(Boolean)),
    );
  }, [assignments]);

  // Filtered rows
  const filteredAssignments = useMemo(() => {
    if (!selectedLender) return assignments;
    return assignments.filter((a) => a.lenderName === selectedLender);
  }, [assignments, selectedLender]);

  /* ================= UI ================= */
  return (
    <div className="bg-white rounded-xl border shadow p-6">
      {/* Header + Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold">Assigned Lender Products</h2>
          <p className="text-sm text-gray-500">
            Which lender is assigned which loan product
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Lender Filter */}
          <select
            value={selectedLender}
            onChange={(e) => setSelectedLender(e.target.value)}
            className="rounded-md border px-3 py-1.5 text-sm bg-white"
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
            className="rounded-full border px-4 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="ds-table-wrap overflow-x-auto dark:border-slate-700">
        <table className="ds-table min-w-full">
          <thead>
            <tr>
              <th>Lender</th>
              <th>Product</th>
              <th>Code</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center text-text-secondary">
                  Loading...
                </td>
              </tr>
            ) : filteredAssignments.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-text-secondary">
                  No assignments found
                </td>
              </tr>
            ) : (
              filteredAssignments.map((a) => (
                <tr key={a.id}>
                  <td>
                    <span className="ds-table-title">{a.lenderName}</span>
                  </td>
                  <td className="ds-table-muted">{a.productName}</td>
                  <td className="ds-table-muted">{a.productCode}</td>
                  <td>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        a.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {a.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="ds-table-muted">
                    {a.createdAt
                      ? new Date(a.createdAt).toLocaleDateString()
                      : "—"}
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
