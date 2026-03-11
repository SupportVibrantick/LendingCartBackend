import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

/* ================= TYPES ================= */

type Application = {
  id: string;
  name: string;
};

type LoanProduct = {
  id: string;
  code: string;
  name: string;
};

type AppProduct = {
  id: string;
  brokerApplicationId: string;
  loanProductCode: string;
  isActive: boolean;
};

/* ================= HELPERS ================= */

function getAuthHeaders() {
  const token = sessionStorage.getItem("broker_token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error("RAW RESPONSE:", text);
    throw new Error("Server returned invalid response. Please login again.");
  }
}

/* ================= PAGE ================= */

const LoanApplicationConfig: React.FC = () => {
  /* ---------- Master data ---------- */
  const [applications, setApplications] = useState<Application[]>([]);
  const [products, setProducts] = useState<LoanProduct[]>([]);

  /* ---------- LEFT FORM state ---------- */
  const [formAppId, setFormAppId] = useState<string>("");
  const [selectedProductCodes, setSelectedProductCodes] = useState<string[]>(
    [],
  );

  /* ---------- RIGHT TABLE state ---------- */
  const [tableAppId, setTableAppId] = useState<string>("");

  /* ---------- Right list ---------- */
  const [items, setItems] = useState<AppProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 5;

  const totalPages = Math.ceil(items.length / limit);

  const startIndex = (page - 1) * limit;
  const paginatedItems = items.slice(startIndex, startIndex + limit);

  /* ================= LOAD APPLICATIONS ================= */

  const loadApplications = async () => {
    try {
      const res = await fetch(`${API_BASE}/broker/applications`, {
        headers: getAuthHeaders(),
      });

      const json = await safeJson(res);

      if (!res.ok || json.success !== true) {
        throw new Error(json.message || "Failed to load applications");
      }

      setApplications(json.data || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load applications");
    }
  };

  /* ================= LOAD LOAN PRODUCTS ================= */

  const loadLoanProducts = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/common/loan-products/loan-product-code`,
        {
          headers: getAuthHeaders(),
        },
      );

      const json = await safeJson(res);

      if (!res.ok || json.success !== true) {
        throw new Error(json.message || "Failed to load loan products");
      }

      setProducts(json.data || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load loan products");
    }
  };

  useEffect(() => {
    loadApplications();
    loadLoanProducts();
  }, []);

  /* ================= LOAD CONFIGURED PRODUCTS (RIGHT TABLE) ================= */

  const loadConfiguredProducts = async (applicationId: string) => {
    try {
      setLoading(true);

      const res = await fetch(
        `${API_BASE}/broker/applications/${applicationId}/products`,
        {
          headers: getAuthHeaders(),
        },
      );

      const json = await safeJson(res);

      if (!res.ok || json.success !== true) {
        throw new Error(json.message || "Failed to load configured products");
      }

      setItems(json.data || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load configured products");
    } finally {
      setLoading(false);
    }
  };

  /* ================= WHEN TABLE APP CHANGES ================= */

  useEffect(() => {
    if (tableAppId) {
      loadConfiguredProducts(tableAppId);
    } else {
      setItems([]);
    }
  }, [tableAppId]);

  /* ================= ADD / CONFIG PRODUCT(S) (LEFT FORM) ================= */

  const handleAddConfig = async () => {
    if (!formAppId) {
      toast.error("Please select application in form");
      return;
    }

    if (selectedProductCodes.length === 0) {
      toast.error("Please select at least one product");
      return;
    }

    const loadingToast = toast.loading("Saving configuration...");

    try {
      const payload = { loanProductCodes: selectedProductCodes };

      const res = await fetch(
        `${API_BASE}/broker/applications/${formAppId}/products`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        },
      );

      const json = await safeJson(res);

      if (!res.ok || json.success !== true) {
        throw new Error(json.message || "Failed to save configuration");
      }

      toast.success("Product(s) configured successfully");

      setSelectedProductCodes([]);

      // If same app is open in table, refresh it
      if (tableAppId === formAppId) {
        loadConfiguredProducts(tableAppId);
      }
    } catch (err: any) {
      toast.error(err.message || "Could not save configuration");
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  /* ================= UI ================= */

  return (
    <div className="px-6 py-6 text-gray-900 dark:text-gray-100">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#2C92D5]">
          Loan Application Config
        </h1>
        <p className="text-sm text-slate-400">
          Map applications with loan products
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-6">
        {/* ================= LEFT FORM ================= */}
        <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-4">Configuration Form</h2>

          <div className="space-y-4">
            {/* Application Select (FORM) */}
            <div>
              <label className="block text-sm mb-1">Select Application</label>
              <select
                className="w-full border rounded-lg px-3 py-2 dark:bg-slate-800"
                value={formAppId}
                onChange={(e) => setFormAppId(e.target.value)}
              >
                <option value="">-- Select Application --</option>
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Product Multi Select */}
            <div>
              <label className="block text-sm mb-2">Select Products</label>

              <div className="space-y-2 max-h-[260px] overflow-y-auto border rounded-lg p-3 dark:border-slate-700">
                {products.map((p) => (
                  <label
                    key={p.code}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedProductCodes.includes(p.code)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedProductCodes((prev) => [...prev, p.code]);
                        } else {
                          setSelectedProductCodes((prev) =>
                            prev.filter((x) => x !== p.code),
                          );
                        }
                      }}
                    />
                    <span>
                      {p.name}{" "}
                      <span className="text-slate-400">({p.code})</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={handleAddConfig}
              className="w-full bg-[#2C92D5] hover:bg-[#197bbc] text-white py-2 rounded-lg text-sm"
            >
              Add / Configure Product(s)
            </button>
          </div>
        </div>

        {/* ================= RIGHT LIST ================= */}
        <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4 gap-4">
            <h2 className="text-lg font-semibold">Configured Products</h2>

            {/* Application Select (TABLE) */}
            <select
              className="border rounded-lg px-3 py-2 text-sm dark:bg-slate-800"
              value={tableAppId}
              onChange={(e) => {
                setTableAppId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">-- Select Application --</option>
              {applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name}
                </option>
              ))}
            </select>
          </div>

          {!tableAppId && (
            <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/40">
              <div className="h-12 w-12 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 mb-3">
                {/* Select Icon */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-3-3v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>

              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                No application selected
              </h3>

              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Please select an application from the dropdown above to view
                configured products.
              </p>

              <div className="mt-3 text-xs text-blue-600 dark:text-blue-400">
                ↑ Select application from above
              </div>
            </div>
          )}

          {tableAppId && loading && (
            <div className="text-sm text-slate-400">Loading...</div>
          )}

          {tableAppId && !loading && (
            <div className="space-y-3">
              {paginatedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between border rounded-lg px-4 py-3 dark:border-slate-700"
                >
                  <div>
                    <div className="font-medium text-sm">{item.loanProductCode}</div>
                    <div className="text-xs text-slate-400">
                      {item.isActive ? "Active" : "Inactive"}
                    </div>
                  </div>

                  <span
                    className={`text-xs px-3 py-1 rounded-full ${
                      item.isActive
                        ? "bg-emerald-200 text-emerald-800"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {item.isActive ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>
              ))}

              {items.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/40">
                  <div className="h-12 w-12 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 mb-3">
                    {/* Box Icon */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M20 13V7a2 2 0 00-2-2h-3.28a2 2 0 01-1.42-.59l-.88-.88A2 2 0 0011 3H6a2 2 0 00-2 2v8m16 0v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6m16 0H4"
                      />
                    </svg>
                  </div>

                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    No Products Configured
                  </h3>

                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    This application does not have any loan products mapped yet.
                  </p>

                  <div className="mt-3 text-xs text-blue-600 dark:text-blue-400">
                    Use the form on the left to configure products.
                  </div>
                </div>
              )}
            </div>
          )}
          {items.length > limit && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1 border rounded-md disabled:opacity-50 dark:border-slate-600"
              >
                Previous
              </button>

              <span className="text-slate-500 dark:text-slate-400">
                Showing {startIndex + 1}–
                {Math.min(startIndex + limit, items.length)} of {items.length}
              </span>

              <button
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 border rounded-md disabled:opacity-50 dark:border-slate-600"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoanApplicationConfig;
