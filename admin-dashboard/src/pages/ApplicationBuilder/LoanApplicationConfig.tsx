import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

/* ================= TYPES ================= */

type Application = { id: string; name: string };
type LoanProduct = { id: string; code: string; name: string };
type AppProduct = {
  id: string;
  brokerApplicationId: string;
  loanProductCode: string;
  isActive: boolean;
};
type Broker = { id: string; name: string };

/* ================= HELPERS ================= */

function getAuthHeaders() {
  const token = sessionStorage.getItem("admin_token");
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
    throw new Error("Invalid server response");
  }
}

/* ================= PAGE ================= */

const LoanApplicationConfig: React.FC = () => {
  /* ================= MASTER ================= */
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [products, setProducts] = useState<LoanProduct[]>([]);

  /* ================= LEFT FORM ================= */
  const [leftBrokerId, setLeftBrokerId] = useState("");
  const [leftApplications, setLeftApplications] = useState<Application[]>([]);
  const [formAppId, setFormAppId] = useState("");
  const [selectedProductCodes, setSelectedProductCodes] = useState<string[]>(
    [],
  );

  /* ================= RIGHT PANEL ================= */
  const [rightBrokerId, setRightBrokerId] = useState("");
  const [rightApplications, setRightApplications] = useState<Application[]>([]);
  const [rightAppId, setRightAppId] = useState("");
  const [items, setItems] = useState<AppProduct[]>([]);

  const [loading, setLoading] = useState(false);

  /* ================= LOAD BROKERS ================= */

  const fetchBrokers = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/brokers/read`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      setBrokers(json.data || []);
    } catch (error) {
      toast.error("Failed to load brokers");
    } finally {
      setLoading(false);
    }
  };

  /* ================= LOAD PRODUCTS ================= */

  const loadLoanProducts = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/common/loan-products/loan-product-code`,
        {
          headers: getAuthHeaders(),
        },
      );
      const json = await safeJson(res);
      setProducts(json.data || []);
    } catch (e) {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  /* ================= LOAD APPLICATIONS BY BROKER ================= */

  const loadApplicationsByBroker = async (brokerId: string, setter: any) => {
    try {
      const res = await fetch(
        `${API_BASE}/admin/applications?brokerOrgId=${brokerId}`,
        { headers: getAuthHeaders() },
      );
      const json = await safeJson(res);
      setter(json.data || []);
    } catch (error) {
      toast.error("Failed to load applications");
    } finally {
      setLoading(false);
    }
  };

  /* ================= RIGHT TABLE LOAD ================= */

  const loadRightTable = async (brokerId: string, appId: string) => {
    try {
      setLoading(true);
      const res = await fetch(
        `${API_BASE}/admin/applications/${appId}/products?brokerOrgId=${brokerId}`,
        { headers: getAuthHeaders() },
      );
      const json = await safeJson(res);
      setItems(json.data || []);
    } catch (e: any) {
      toast.error("Failed to load configured products");
    } finally {
      setLoading(false);
    }
  };

  /* ================= LEFT SAVE ================= */

  const handleAddConfig = async () => {
    if (!leftBrokerId || !formAppId || selectedProductCodes.length === 0) {
      toast.error("Please select broker, application and products");
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE}/admin/applications/${formAppId}/products`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            brokerOrgId: leftBrokerId,
            loanProductCodes: selectedProductCodes,
          }),
        },
      );

      const json = await safeJson(res);

      if (!res.ok || json.success !== true) throw new Error(json.message);

      toast.success("Products configured successfully");
      setSelectedProductCodes([]);

      if (rightBrokerId === leftBrokerId && rightAppId === formAppId) {
        loadRightTable(rightBrokerId, rightAppId);
      }
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    }
  };

  /* ================= EFFECTS ================= */

  useEffect(() => {
    fetchBrokers();
    loadLoanProducts();
  }, []);

  useEffect(() => {
    if (leftBrokerId) {
      loadApplicationsByBroker(leftBrokerId, setLeftApplications);
    } else {
      setLeftApplications([]);
      setFormAppId("");
    }
  }, [leftBrokerId]);

  useEffect(() => {
    if (rightBrokerId) {
      loadApplicationsByBroker(rightBrokerId, setRightApplications);
    } else {
      setRightApplications([]);
      setRightAppId("");
      setItems([]);
    }
  }, [rightBrokerId]);

  useEffect(() => {
    if (rightBrokerId && rightAppId) {
      loadRightTable(rightBrokerId, rightAppId);
    }
  }, [rightBrokerId, rightAppId]);

  const selectClass =
    "w-full rounded-lg border px-3 py-2 text-sm bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700";

  /* ================= UI ================= */

  return (
    <div className="px-2 py-6 text-gray-900 dark:text-gray-100">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#13538A] dark:text-indigo-600">
          Loan Application Config
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Map applications with loan products
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[390px_minmax(0,1fr)] gap-4">
        {/* ================= LEFT ================= */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-4">Configuration Form</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Broker</label>
              <select
                className={selectClass}
                value={leftBrokerId}
                onChange={(e) => setLeftBrokerId(e.target.value)}
              >
                <option value="">Select Broker</option>
                {brokers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {leftBrokerId && (
              <div>
                <label className="block text-sm mb-1">Application</label>
                <select
                  className={selectClass}
                  value={formAppId}
                  onChange={(e) => setFormAppId(e.target.value)}
                >
                  <option value="">Select Application</option>
                  {leftApplications.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">
                Select Products
              </label>

              <div className="max-h-[260px] overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2 bg-white dark:bg-slate-900">
                {products.map((p) => {
                  const selected = selectedProductCodes.includes(p.code);

                  return (
                    <label
                      key={p.code}
                      className={`flex items-center justify-between gap-3 p-2 rounded-lg cursor-pointer transition-all text-xs
          ${
            selected
              ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700"
              : "hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedProductCodes((prev) => [
                                ...prev,
                                p.code,
                              ]);
                            } else {
                              setSelectedProductCodes((prev) =>
                                prev.filter((x) => x !== p.code),
                              );
                            }
                          }}
                          className="w-4 h-4 accent-blue-600 cursor-pointer"
                        />

                        <span className="text-xs text-slate-700 dark:text-slate-200">
                          {p.name}
                        </span>
                      </div>

                      <span className="text-xs text-slate-400">({p.code})</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleAddConfig}
              className="w-full bg-[#13538A] hover:bg-[#2e87d4] text-white py-2 rounded-lg text-sm"
            >
              Save Configuration
            </button>
          </div>
        </div>

        {/* ================= RIGHT ================= */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm mb-1">Broker</label>
              <select
                className={selectClass}
                value={rightBrokerId}
                onChange={(e) => setRightBrokerId(e.target.value)}
              >
                <option value="">Select Broker</option>
                {brokers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {rightBrokerId && (
              <div>
                <label className="block text-sm mb-1">Application</label>
                <select
                  className={selectClass}
                  value={rightAppId}
                  onChange={(e) => setRightAppId(e.target.value)}
                >
                  <option value="">Select Application</option>
                  {rightApplications.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {!rightAppId && (
            <div className="text-center text-slate-400 py-20 border-2 border-dashed rounded-xl">
              Select broker & application to view products
            </div>
          )}

          {rightAppId && !loading && items.length === 0 && (
            <div className="text-center py-20 border-2 border-dashed rounded-xl">
              <div className="text-blue-500 text-4xl mb-2">➕</div>
              <div className="font-semibold">No products configured</div>
              <div className="text-sm text-slate-400">Add from left panel</div>
            </div>
          )}

          {rightAppId && loading && (
            <div className="text-sm text-slate-400">Loading...</div>
          )}

          {items.map((item) => (
            <div
              key={item.id}
              className="flex justify-between border border-slate-200 dark:border-slate-700 p-3 rounded mb-2"
            >
              <div>{item.loanProductCode}</div>
              <span
                className={`text-xs px-3 py-1 rounded-full ${item.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-700"}`}
              >
                {item.isActive ? "ACTIVE" : "INACTIVE"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LoanApplicationConfig;
