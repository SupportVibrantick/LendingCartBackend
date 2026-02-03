import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { createPortal } from "react-dom";

/* ================= API ================= */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "http://localhost:3001",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("admin_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
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

  const [selectedLender, setSelectedLender] = useState("");

  // 👁️ modal states
  const [viewId, setViewId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /* ================= FETCH LIST ================= */
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
        }))
      );
    } catch (err) {
      console.error("Failed to fetch assignments", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  /* ================= FETCH DETAIL ================= */
  const fetchAssignmentDetail = async (id: string) => {
    try {
      setDetailLoading(true);
      setDetail(null);

      const res = await api.get("/admin/lender-products/read");
      const list = Array.isArray(res.data?.data)
        ? res.data.data
        : res.data?.data?.results || [];

      setDetail(list.find((x: any) => x.id === id) || null);
    } catch (err) {
      console.error("Failed to fetch detail", err);
    } finally {
      setDetailLoading(false);
    }
  };

  /* ================= DERIVED ================= */
  const lenders = useMemo(
    () =>
      Array.from(
        new Set(assignments.map((a) => a.lenderName).filter(Boolean))
      ),
    [assignments]
  );

  const filteredAssignments = useMemo(() => {
    if (!selectedLender) return assignments;
    return assignments.filter((a) => a.lenderName === selectedLender);
  }, [assignments, selectedLender]);

  /* ================= UI ================= */
  return (
    <>
      {/* ================= CARD ================= */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm
                      dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Assigned Lender Products
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Lender ↔ Product mapping
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedLender}
              onChange={(e) => setSelectedLender(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm
                         text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30
                         dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">All Lenders</option>
              {lenders.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>

            <button
              onClick={fetchAssignments}
              disabled={loading}
              className="rounded-md border border-slate-300 px-4 py-1.5 text-sm
                         text-slate-700 hover:bg-slate-50 disabled:opacity-50
                         dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* ================= TABLE ================= */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase
                             text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="py-2 pr-4 text-left">Lender</th>
                <th className="py-2 pr-4 text-left">Product</th>
                <th className="py-2 pr-4 text-left">Code</th>
                <th className="py-2 pr-4 text-left">Status</th>
                <th className="py-2 pr-4 text-left">Created</th>
                <th className="py-2 pr-2 text-left">View</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    No data found
                  </td>
                </tr>
              ) : (
                filteredAssignments.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-slate-100
                               hover:bg-slate-50
                               dark:border-slate-800 dark:hover:bg-slate-800/50"
                  >
                    <td className="py-3 pr-4 text-slate-900 dark:text-slate-100">
                      {a.lenderName}
                    </td>
                    <td className="py-3 pr-4 dark:text-white">{a.productName}</td>
                    <td className="py-3 pr-4 dark:text-white">{a.productCode}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold
                        ${a.isActive
                            ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400"
                            : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
                          }`}
                      >
                        {a.isActive ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 dark:text-white">
                      {a.createdAt
                        ? new Date(a.createdAt).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="py-3 pr-2">
                      <button
                        onClick={() => {
                          setViewId(a.id);
                          fetchAssignmentDetail(a.id);
                        }}
                        className="text-blue-600 hover:text-blue-800
                                   dark:text-blue-400 dark:hover:text-blue-300"
                        title="View details"
                      >
                        👁️
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= DETAIL MODAL ================= */}
      {viewId &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center
                    bg-black/40 backdrop-blur-sm">

            {/* Modal Card */}
            <div
              className="relative w-full max-w-2xl rounded-xl
                   bg-white p-6 shadow-2xl
                   dark:bg-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setViewId(null);
                  setDetail(null);
                }}
                className="absolute right-4 top-3 text-xl text-slate-500
                     hover:text-slate-700 dark:hover:text-slate-300"
              >
                ✕
              </button>

              <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
                Assignment Details
              </h3>

              {detailLoading ? (
                <p className="text-slate-500">Loading details...</p>
              ) : !detail ? (
                <p className="text-slate-500">No data found</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <Detail label="Lender" value={detail.lender?.name} />
                  <Detail
                    label="Product"
                    value={`${detail.loanProduct?.name} (${detail.loanProduct?.code})`}
                  />
                  <Detail
                    label="Loan Amount"
                    value={`${detail.minLoanAmount} – ${detail.maxLoanAmount}`}
                  />
                  <Detail
                    label="Term (Months)"
                    value={`${detail.minTermMonths} – ${detail.maxTermMonths}`}
                  />
                  <Detail
                    label="LTV"
                    value={`${detail.minLtvPercent ?? "-"} – ${detail.maxLtvPercent ?? "-"}`}
                  />
                  <Detail
                    label="Credit Score"
                    value={detail.minCreditScore ?? "-"}
                  />
                  <Detail
                    label="Experience"
                    value={detail.minExperience ?? "-"}
                  />
                  <Detail
                    label="Interest Rate"
                    value={detail.interestRateRange ?? "-"}
                  />
                  <Detail
                    label="Business Types"
                    value={
                      detail.businessTypes?.length
                        ? detail.businessTypes.join(", ")
                        : "-"
                    }
                  />
                  <Detail
                    label="States"
                    value={
                      detail.statesSupported?.length
                        ? detail.statesSupported.join(", ")
                        : "-"
                    }
                  />
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

    </>
  );
};

/* ================= SMALL DETAIL ITEM ================= */
const Detail = ({ label, value }: { label: string; value: any }) => (
  <div>
    <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
    <div className="font-medium text-slate-900 dark:text-slate-100 ">
      {value || "-"}
    </div>
  </div>
);

export default AssignedProducts;
