import React, { useEffect, useState } from "react";
import { Loader2, PlusCircle } from "lucide-react";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

type Broker = { id: string; name: string };
type AppItem = { id: string; name: string };
type ProductItem = { id: string; loanProductCode: string };

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

const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5";
const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#13538A] focus:outline-none focus:ring-1 focus:ring-[#13538A] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

const AddSectionAdmin: React.FC = () => {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [applications, setApplications] = useState<AppItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [selectedBrokerId, setSelectedBrokerId] = useState("");
  const [selectedAppId, setSelectedAppId] = useState("");
  const [productId, setProductId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchBrokers = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/brokers/read`, {
        headers: getAuthHeaders(),
      });
      const json = await safeJson(res);
      setBrokers(json.data || []);
    } catch {
      toast.error("Failed to load brokers");
    }
  };

  const loadApplications = async (brokerId: string) => {
    try {
      setLoading(true);
      const res = await fetch(
        `${API_BASE}/admin/applications?brokerOrgId=${brokerId}`,
        { headers: getAuthHeaders() }
      );
      const json = await safeJson(res);
      setApplications(json.data || []);
    } catch {
      toast.error("Failed to load applications");
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async (appId: string, brokerId: string) => {
    try {
      setLoading(true);
      const res = await fetch(
        `${API_BASE}/admin/applications/${appId}/products?brokerOrgId=${brokerId}`,
        { headers: getAuthHeaders() }
      );
      const json = await safeJson(res);
      setProducts(json.data || []);
    } catch {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrokers();
  }, []);

  useEffect(() => {
    if (selectedBrokerId) loadApplications(selectedBrokerId);
    else {
      setApplications([]);
      setProducts([]);
    }
    setSelectedAppId("");
    setProductId("");
  }, [selectedBrokerId]);

  useEffect(() => {
    if (selectedAppId && selectedBrokerId) {
      loadProducts(selectedAppId, selectedBrokerId);
    } else {
      setProducts([]);
      setProductId("");
    }
  }, [selectedAppId, selectedBrokerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBrokerId || !productId || !name.trim()) {
      toast.error("Please fill all required fields");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `${API_BASE}/admin/applications/products/${productId}/sections`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            brokerOrgId: selectedBrokerId,
            name,
            description,
            sortOrder: Number(sortOrder),
          }),
        }
      );
      const json = await safeJson(res);
      if (!res.ok || json.success === false) {
        throw new Error(json.message || "Failed to create section");
      }
      toast.success("Section created successfully");
      setName("");
      setDescription("");
      setSortOrder(1);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create section");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 py-6 md:px-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#13538A] dark:text-indigo-400">
          Add Section
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Group fields into sections like Personal Info, Business Info, etc.
        </p>
      </div>

      <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>
              Broker <span className="text-red-500">*</span>
            </label>
            <select
              className={inputClass}
              value={selectedBrokerId}
              onChange={(e) => setSelectedBrokerId(e.target.value)}
            >
              <option value="">Select Broker</option>
              {brokers.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {selectedBrokerId && (
            <div>
              <label className={labelClass}>
                Application <span className="text-red-500">*</span>
              </label>
              <select
                className={inputClass}
                value={selectedAppId}
                onChange={(e) => setSelectedAppId(e.target.value)}
                disabled={loading}
              >
                <option value="">
                  {loading ? "Loading..." : "Select Application"}
                </option>
                {applications.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          {selectedAppId && (
            <div>
              <label className={labelClass}>
                Loan Product <span className="text-red-500">*</span>
              </label>
              <select
                className={inputClass}
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                disabled={loading}
              >
                <option value="">
                  {loading ? "Loading..." : "Select Product"}
                </option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.loanProductCode.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          )}

          {productId && (
            <>
              <div>
                <label className={labelClass}>
                  Section Name <span className="text-red-500">*</span>
                </label>
                <input
                  className={inputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Personal Information"
                />
              </div>

              <div>
                <label className={labelClass}>Description</label>
                <textarea
                  rows={3}
                  className={inputClass}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>

              <div>
                <label className={labelClass}>Display Order</label>
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value))}
                />
                <p className="mt-1 text-xs text-slate-400">Lower number appears first</p>
              </div>

              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#13538A] py-2.5 text-sm font-medium text-white hover:bg-[#1a6aad] disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <PlusCircle size={16} />
                )}
                Create Section
              </button>
            </>
          )}
        </form>

        {!productId && selectedBrokerId && (
          <p className="mt-4 text-center text-xs text-slate-400">
            Select broker, application and product to continue
          </p>
        )}
      </div>
    </div>
  );
};

export default AddSectionAdmin;
