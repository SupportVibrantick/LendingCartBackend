import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Building2,
  CheckCircle2,
  FilePlus,
  FileText,
  Filter,
  Loader2,
  Pencil,
  Sparkles,
  XCircle,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

type AppItem = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
};

type Broker = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status?: string;
  createdAt?: string;
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
    throw new Error("Server returned invalid response. Please login again.");
  }
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-[#13538A] focus:outline-none focus:ring-2 focus:ring-[#13538A]/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

const CreateApplication: React.FC = () => {
  const [items, setItems] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [brokerOrgId, setBrokerOrgId] = useState("");
  const [filterBrokerOrgId, setFilterBrokerOrgId] = useState("");
  const [, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", isActive: true });

  const loadApplications = async (selectedBrokerId: string) => {
    try {
      if (!selectedBrokerId) return;
      setLoading(true);
      const res = await fetch(
        `${API_BASE}/admin/applications?brokerOrgId=${selectedBrokerId}`,
        { headers: getAuthHeaders() }
      );
      const json = await safeJson(res);
      if (!res.ok || json.success !== true) {
        throw new Error(json.message || "Failed to load applications");
      }
      setItems(json.data || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load applications");
    } finally {
      setLoading(false);
    }
  };

  async function fetchBrokers() {
    try {
      const res = await fetch(`${API_BASE}/admin/brokers/read`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`Failed to fetch brokers: ${res.status}`);
      const json = await res.json();
      const list = Array.isArray(json) ? json : json.data || [];
      setBrokers(
        list.map((o: Record<string, unknown>) => ({
          id: String(o.id),
          name: String(o.name ?? ""),
          email: String(o.email ?? ""),
          phone: String(o.phone ?? ""),
          status: String(o.status ?? "UNKNOWN"),
          createdAt: o.createdAt ? String(o.createdAt) : undefined,
        }))
      );
    } catch {
      toast.error("Failed to load brokers");
    }
  }

  useEffect(() => {
    fetchBrokers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Application name is required");
      return;
    }
    if (!brokerOrgId) {
      toast.error("Please select a broker");
      return;
    }

    setSubmitting(true);
    const loadingToast = toast.loading("Creating application...");
    try {
      const res = await fetch(`${API_BASE}/admin/applications`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: form.name, brokerOrgId }),
      });
      const json = await safeJson(res);
      if (!res.ok || json.success !== true) {
        throw new Error(json.message || "Create failed");
      }
      toast.success("Application created successfully");
      setForm({ name: "", isActive: true });
      if (filterBrokerOrgId === brokerOrgId) {
        loadApplications(filterBrokerOrgId);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not create application");
    } finally {
      toast.dismiss(loadingToast);
      setSubmitting(false);
    }
  };

  const handleEdit = (item: AppItem) => {
    setEditingId(item.id);
    setForm({ name: item.name, isActive: item.isActive });
    setBrokerOrgId(filterBrokerOrgId);
  };

  const toggleStatus = async (e: React.MouseEvent, item: AppItem) => {
    e.preventDefault();
    if (!filterBrokerOrgId) {
      toast.error("Please select a broker first from filter");
      return;
    }
    const loadingToast = toast.loading("Updating status...");
    try {
      const res = await fetch(`${API_BASE}/admin/applications/${item.id}/status`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          isActive: !item.isActive,
          brokerOrgId: filterBrokerOrgId,
        }),
      });
      const json = await safeJson(res);
      if (!res.ok || json.success !== true) {
        throw new Error(json.message || "Status update failed");
      }
      toast.success(
        `Application ${!item.isActive ? "activated" : "deactivated"} successfully`
      );
      loadApplications(filterBrokerOrgId);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not update status");
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const activeCount = items.filter((i) => i.isActive).length;

  return (
    <div className="space-y-6 px-4 py-6 md:px-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#13538A] via-[#1a6aad] to-[#2d8de0] p-6 md:p-8 text-white shadow-lg">
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-white/5 blur-xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
              <Sparkles size={14} />
              Application Builder
            </div>
            <h1 className="text-2xl font-bold md:text-3xl">Create & Manage Applications</h1>
            <p className="mt-1 max-w-xl text-sm text-blue-100">
              Set up loan application flows per broker. Only one application can be active at a time.
            </p>
          </div>
          {filterBrokerOrgId && !loading && (
            <div className="flex gap-3">
              <div className="rounded-xl bg-white/15 px-4 py-3 backdrop-blur-sm">
                <p className="text-xs text-blue-100">Total</p>
                <p className="text-2xl font-bold">{items.length}</p>
              </div>
              <div className="rounded-xl bg-white/15 px-4 py-3 backdrop-blur-sm">
                <p className="text-xs text-blue-100">Active</p>
                <p className="text-2xl font-bold">{activeCount}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* Create Form */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#13538A]/10 text-[#13538A] dark:bg-indigo-500/20 dark:text-indigo-400">
              <FilePlus size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">New Application</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Create a flow for a broker</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Building2 size={13} /> Broker
              </label>
              <select
                className={inputClass}
                value={brokerOrgId}
                onChange={(e) => setBrokerOrgId(e.target.value)}
              >
                <option value="">Select Broker</option>
                {brokers.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <FileText size={13} /> Application Name
              </label>
              <input
                className={inputClass}
                placeholder="e.g. Main Loan Application"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#13538A] py-2.5 text-sm font-semibold text-white transition hover:bg-[#1a6aad] disabled:opacity-60"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <FilePlus size={16} />}
              Create Application
            </button>
          </form>
        </div>

        {/* Applications List */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">Applications</h2>
              <p className="text-xs text-slate-500">View and manage by broker</p>
            </div>
            <div className="relative min-w-[200px]">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                className={`${inputClass} pl-9`}
                value={filterBrokerOrgId}
                onChange={(e) => {
                  const selected = e.target.value;
                  setFilterBrokerOrgId(selected);
                  if (selected) loadApplications(selected);
                  else setItems([]);
                }}
              >
                <option value="">Filter by Broker</option>
                {brokers.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          {!filterBrokerOrgId ? (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <Filter className="text-slate-400" size={24} />
              </div>
              <h3 className="font-semibold text-slate-700 dark:text-slate-200">Select a Broker</h3>
              <p className="mt-1 max-w-xs text-sm text-slate-500">
                Choose a broker from the filter to view their applications.
              </p>
            </div>
          ) : loading ? (
            <div className="space-y-0 divide-y divide-slate-100 dark:divide-slate-800">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-4 px-5 py-4">
                  <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-40 rounded bg-slate-100 dark:bg-slate-800" />
                    <div className="h-2.5 w-24 rounded bg-slate-100 dark:bg-slate-800" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/30">
                <FileText className="text-blue-500" size={28} />
              </div>
              <h3 className="font-semibold text-slate-700 dark:text-slate-200">No Applications Found</h3>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                Create a new application using the form on the left.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                    <th className="px-5 py-3">Application</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#13538A]/10 text-[#13538A] dark:bg-indigo-500/20 dark:text-indigo-400">
                            <FileText size={16} />
                          </div>
                          <span className="font-medium text-slate-800 dark:text-slate-100">
                            {item.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={(e) => toggleStatus(e, item)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                            item.isActive
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {item.isActive ? (
                            <CheckCircle2 size={12} />
                          ) : (
                            <XCircle size={12} />
                          )}
                          {item.isActive ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => handleEdit(item)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-[#13538A] hover:text-[#13538A] dark:border-slate-700 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
                          title="Edit name"
                        >
                          <Pencil size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateApplication;
