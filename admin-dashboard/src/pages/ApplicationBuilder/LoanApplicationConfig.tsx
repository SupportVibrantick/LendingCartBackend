import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Check,
  ChevronRight,
  Layers,
  Link2,
  Loader2,
  Package,
  Save,
  Settings2,
  Sparkles,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

type Application = { id: string; name: string };
type LoanProduct = { id: string; code: string; name: string };
type AppProduct = {
  id: string;
  brokerApplicationId: string;
  loanProductCode: string;
  isActive: boolean;
};
type Broker = { id: string; name: string };

const PRODUCT_LABELS: Record<string, string> = {
  FIX_AND_FLIP_LOAN_1_TO_4_UNITS: "Fix & Flip",
  DSCR_LOAN_1_TO_4_UNITS: "DSCR",
  CONSTRUCTION_LOAN_1_TO_4_UNITS: "Construction",
  BRIDGE_LOAN_1_TO_4_UNITS: "Bridge Loan",
  SBA_7A: "SBA 7A",
  SBA_7A_WORKING_CAPITAL: "SBA 7A Working Capital",
  CMBS: "CMBS",
  CRE_PERMANENT_LOAN: "CRE Permanent",
};

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

function formatProductCode(code: string) {
  return PRODUCT_LABELS[code] ?? code.replace(/_/g, " ");
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-[#13538A] focus:outline-none focus:ring-2 focus:ring-[#13538A]/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

const LoanApplicationConfig: React.FC = () => {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [leftBrokerId, setLeftBrokerId] = useState("");
  const [leftApplications, setLeftApplications] = useState<Application[]>([]);
  const [formAppId, setFormAppId] = useState("");
  const [selectedProductCodes, setSelectedProductCodes] = useState<string[]>([]);
  const [rightBrokerId, setRightBrokerId] = useState("");
  const [rightApplications, setRightApplications] = useState<Application[]>([]);
  const [rightAppId, setRightAppId] = useState("");
  const [items, setItems] = useState<AppProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchBrokers = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/brokers/read`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      setBrokers(json.data || []);
    } catch {
      toast.error("Failed to load brokers");
    }
  };

  const loadLoanProducts = async () => {
    try {
      const res = await fetch(`${API_BASE}/common/loan-products/loan-product-code`, {
        headers: getAuthHeaders(),
      });
      const json = await safeJson(res);
      setProducts(json.data || []);
    } catch {
      toast.error("Failed to load products");
    }
  };

  const loadApplicationsByBroker = async (brokerId: string, setter: React.Dispatch<React.SetStateAction<Application[]>>) => {
    try {
      const res = await fetch(
        `${API_BASE}/admin/applications?brokerOrgId=${brokerId}`,
        { headers: getAuthHeaders() }
      );
      const json = await safeJson(res);
      setter(json.data || []);
    } catch {
      toast.error("Failed to load applications");
    }
  };

  const loadRightTable = async (brokerId: string, appId: string) => {
    try {
      setLoading(true);
      const res = await fetch(
        `${API_BASE}/admin/applications/${appId}/products?brokerOrgId=${brokerId}`,
        { headers: getAuthHeaders() }
      );
      const json = await safeJson(res);
      setItems(json.data || []);
    } catch {
      toast.error("Failed to load configured products");
    } finally {
      setLoading(false);
    }
  };

  const handleAddConfig = async () => {
    if (!leftBrokerId || !formAppId || selectedProductCodes.length === 0) {
      toast.error("Please select broker, application and products");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/admin/applications/${formAppId}/products`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          brokerOrgId: leftBrokerId,
          loanProductCodes: selectedProductCodes,
        }),
      });
      const json = await safeJson(res);
      if (!res.ok || json.success !== true) throw new Error(json.message);
      toast.success("Products configured successfully");
      setSelectedProductCodes([]);
      if (rightBrokerId === leftBrokerId && rightAppId === formAppId) {
        loadRightTable(rightBrokerId, rightAppId);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchBrokers();
    loadLoanProducts();
  }, []);

  useEffect(() => {
    if (leftBrokerId) loadApplicationsByBroker(leftBrokerId, setLeftApplications);
    else {
      setLeftApplications([]);
      setFormAppId("");
    }
  }, [leftBrokerId]);

  useEffect(() => {
    if (rightBrokerId) loadApplicationsByBroker(rightBrokerId, setRightApplications);
    else {
      setRightApplications([]);
      setRightAppId("");
      setItems([]);
    }
  }, [rightBrokerId]);

  useEffect(() => {
    if (rightBrokerId && rightAppId) loadRightTable(rightBrokerId, rightAppId);
  }, [rightBrokerId, rightAppId]);

  return (
    <div className="space-y-6 px-4 py-6 md:px-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#13538A] via-[#1a6aad] to-[#2d8de0] p-6 md:p-8 text-white shadow-lg">
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
            <Link2 size={14} />
            Product Mapping
          </div>
          <h1 className="text-2xl font-bold md:text-3xl">Loan Application Config</h1>
          <p className="mt-1 max-w-2xl text-sm text-blue-100">
            Link loan products to broker applications. Configure on the left, review mapped products on the right.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
        {/* Left — Configure */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 p-5 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                <Settings2 size={20} />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-white">Assign Products</h2>
                <p className="text-xs text-slate-500">Step 1 → 2 → 3 → Save</p>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                1. Broker
              </label>
              <select className={inputClass} value={leftBrokerId} onChange={(e) => setLeftBrokerId(e.target.value)}>
                <option value="">Select Broker</option>
                {brokers.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {leftBrokerId && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  2. Application
                </label>
                <select className={inputClass} value={formAppId} onChange={(e) => setFormAppId(e.target.value)}>
                  <option value="">Select Application</option>
                  {leftApplications.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>3. Loan Products</span>
                {selectedProductCodes.length > 0 && (
                  <span className="rounded-full bg-[#13538A]/10 px-2 py-0.5 text-[#13538A] normal-case">
                    {selectedProductCodes.length} selected
                  </span>
                )}
              </label>
              <div className="custom-scrollbar max-h-[280px] space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                {products.map((p) => {
                  const selected = selectedProductCodes.includes(p.code);
                  return (
                    <label
                      key={p.code}
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg p-2.5 transition ${
                        selected
                          ? "border border-[#13538A]/30 bg-[#13538A]/5 dark:bg-indigo-900/20"
                          : "border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded border ${
                            selected
                              ? "border-[#13538A] bg-[#13538A] text-white"
                              : "border-slate-300 dark:border-slate-600"
                          }`}
                        >
                          {selected && <Check size={12} />}
                        </div>
                        <span className="text-sm text-slate-700 dark:text-slate-200">{p.name}</span>
                      </div>
                      <span className="text-[10px] font-medium text-slate-400">{p.code}</span>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={selected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProductCodes((prev) => [...prev, p.code]);
                          } else {
                            setSelectedProductCodes((prev) => prev.filter((x) => x !== p.code));
                          }
                        }}
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleAddConfig}
              disabled={saving || !leftBrokerId || !formAppId || selectedProductCodes.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#13538A] py-2.5 text-sm font-semibold text-white transition hover:bg-[#1a6aad] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Configuration
            </button>
          </div>
        </div>

        {/* Right — View */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 p-5 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                <Layers size={20} />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-white">Configured Products</h2>
                <p className="text-xs text-slate-500">Products linked to an application</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Broker
                </label>
                <select className={inputClass} value={rightBrokerId} onChange={(e) => setRightBrokerId(e.target.value)}>
                  <option value="">Select Broker</option>
                  {brokers.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              {rightBrokerId && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Application
                  </label>
                  <select className={inputClass} value={rightAppId} onChange={(e) => setRightAppId(e.target.value)}>
                    <option value="">Select Application</option>
                    {rightApplications.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {!rightAppId ? (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-16 text-center dark:border-slate-700">
                <Package className="mb-3 text-slate-300" size={40} />
                <p className="font-medium text-slate-600 dark:text-slate-300">Select broker & application</p>
                <p className="mt-1 text-sm text-slate-400">View mapped loan products here</p>
              </div>
            ) : loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="animate-spin text-[#13538A]" size={28} />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/50 py-16 text-center dark:border-amber-800 dark:bg-amber-900/10">
                <Sparkles className="mb-3 text-amber-500" size={36} />
                <p className="font-medium text-amber-800 dark:text-amber-300">No products configured</p>
                <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
                  Assign products from the left panel
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {items.length} product{items.length !== 1 ? "s" : ""} mapped
                </p>
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 transition hover:border-[#13538A]/30 dark:border-slate-700 dark:bg-slate-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-slate-900">
                        <Package size={16} className="text-[#13538A]" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-800 dark:text-slate-100">
                          {formatProductCode(item.loanProductCode)}
                        </p>
                        <p className="text-xs text-slate-400">{item.loanProductCode}</p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        item.isActive
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                          : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                      }`}
                    >
                      <ChevronRight size={10} />
                      {item.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoanApplicationConfig;
