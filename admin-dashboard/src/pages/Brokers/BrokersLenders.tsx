// src/pages/Brokers/BrokersLenders.tsx
import React, { useEffect, useState } from "react";
import { MdModeEdit, MdDelete } from "react-icons/md";

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
  name: string;
  email: string;
  phone?: string | null;
  status?: string;
  createdAt?: string;
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

// same as BrokersPage
function getAuthHeaders(): Record<string, string> {
  try {
    const token = sessionStorage.getItem("admin_token");
    if (token) {
      return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };
    }
  } catch {
    /* ignore */
  }
  return { "Content-Type": "application/json" };
}

// tiny helper for status pill
function statusClass(status?: string) {
  switch ((status || "").toUpperCase()) {
    case "ACTIVE":
      return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/40";
    case "INACTIVE":
      return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-300 dark:border-yellow-500/40";
    case "SUSPENDED":
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/40";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-slate-600/30 dark:text-slate-100 dark:border-slate-500";
  }
}

const BrokersLenders: React.FC = () => {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [selectedBrokerId, setSelectedBrokerId] = useState<string>("");
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [loadingBrokers, setLoadingBrokers] = useState(false);
  const [loadingLenders, setLoadingLenders] = useState(false);

  // ===== Helpers =====
  const fetchBrokers = async () => {
    try {
      setLoadingBrokers(true);

      const res = await fetch(`${API_BASE}/admin/brokers/read`, {
        method: "GET",
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        console.error("Failed to load brokers:", res.status);
        return;
      }

      const json = await res.json();

      if (!json.success) {
        console.error("Failed to load brokers:", json.message);
        return;
      }

      const items = (json.data || []) as any[];

      const mapped: Broker[] = items.map((b) => ({
        id: String(b.id),
        name: b.name ?? "",
        email: b.email ?? "",
        phone: b.phone ?? "",
        status: b.status ?? "UNKNOWN",
        createdAt: b.createdAt ?? undefined,
      }));

      setBrokers(mapped);

      if (!selectedBrokerId && mapped.length > 0) {
        setSelectedBrokerId(mapped[0].id);
      }
    } catch (err) {
      console.error("Failed to load brokers", err);
    } finally {
      setLoadingBrokers(false);
    }
  };

  const fetchLendersForBroker = async (brokerId: string) => {
    if (!brokerId) return;
    try {
      setLoadingLenders(true);

      const res = await fetch(`${API_BASE}/admin/brokers/read/${brokerId}`, {
        method: "GET",
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        console.error("Failed to load lenders:", res.status);
        setLenders([]);
        return;
      }

      const json = await res.json();

      if (!json.success) {
        console.error("Failed to load lenders:", json.message);
        setLenders([]);
        return;
      }

      const brokerData = json.data;
      const accessList = (brokerData?.lenderAccess || []) as any[];

      const mapped: Lender[] = accessList
        .filter((a) => a?.lender)
        .map((a) => ({
          id: a.lender.id,
          name: a.lender.name,
          email: a.lender.email,
          phone: a.lender.phone,
          status: a.lender.status,
          createdAt: a.lender.createdAt,
        }));

      setLenders(mapped);
    } catch (err) {
      console.error("Failed to load lenders", err);
    } finally {
      setLoadingLenders(false);
    }
  };

  // ===== Effects =====
  useEffect(() => {
    fetchBrokers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedBrokerId) {
      fetchLendersForBroker(selectedBrokerId);
    } else {
      setLenders([]);
    }
  }, [selectedBrokerId]);

  // ===== Handlers =====
  const handleRefresh = () => {
    if (selectedBrokerId) fetchLendersForBroker(selectedBrokerId);
  };

  const formatDate = (value?: string) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString();
  };

  const handleEdit = (lender: Lender) => {
    // open modal later if needed
  };

  const handleDelete = (lender: Lender) => {
    // confirm + delete API later
  };

  const selectedBroker = brokers.find((b) => b.id === selectedBrokerId);

  // ===== UI =====
  return (
    <div className="px-6 py-6 text-gray-900 dark:text-gray-100">
      {/* Heading same style as BrokersPage */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Broker Lender Mapping
          </h1>
          <p className="text-sm text-gray-500 mt-1 dark:text-slate-400">
            Select a broker on the left to view and manage their lenders.
          </p>
        </div>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6">
        {/* LEFT CARD – Select broker */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Select Broker
          </h2>
          <p className="text-sm text-gray-500 mb-4 dark:text-slate-400">
            Choose a broker to see its details and mapped lenders.
          </p>

          <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
            Broker
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

          {/* Selected broker details */}
          {selectedBroker && (
            <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-100 text-xs text-gray-600 space-y-1 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-200">
              <div>
                <span className="font-semibold text-gray-700 dark:text-slate-100">
                  Email:{" "}
                </span>
                {selectedBroker.email || "-"}
              </div>
              <div>
                <span className="font-semibold text-gray-700 dark:text-slate-100">
                  Phone:{" "}
                </span>
                {selectedBroker.phone || "-"}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700 dark:text-slate-100">
                  Status:
                </span>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full border text-[11px] ${statusClass(
                    selectedBroker.status,
                  )}`}
                >
                  {selectedBroker.status || "UNKNOWN"}
                </span>
              </div>
              <div>
                <span className="font-semibold text-gray-700 dark:text-slate-100">
                  Created:
                </span>{" "}
                {formatDate(selectedBroker.createdAt)}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT CARD – Lenders table (same table UI as BrokersPage) */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Lenders
              </h2>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {selectedBroker
                  ? `Linked to ${selectedBroker.name}`
                  : "Select a broker to view lenders."}
              </p>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={!selectedBrokerId || loadingLenders}
              className="rounded-full border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed
                         dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              {loadingLenders ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide dark:border-slate-700 dark:text-slate-400">
                  <th className="py-2 pr-4 text-left">Lender Name</th>
                  <th className="py-2 pr-4 text-left">Email</th>
                  <th className="py-2 pr-4 text-left">Phone</th>
                  <th className="py-2 pr-4 text-left">Status</th>
                  <th className="py-2 pr-4 text-left">Created</th>
                  <th className="py-2 pr-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {loadingLenders ? (
                  <tr>
                    <td
                      className="py-6 text-center text-gray-500 dark:text-slate-400"
                      colSpan={6}
                    >
                      Loading lenders...
                    </td>
                  </tr>
                ) : lenders.length === 0 ? (
                  <tr>
                    <td
                      className="py-6 text-center text-gray-500 dark:text-slate-400"
                      colSpan={6}
                    >
                      No lenders found for this broker.
                    </td>
                  </tr>
                ) : (
                  lenders.map((l) => (
                    <tr
                      key={l.id}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50/40 dark:border-slate-800 dark:hover:bg-slate-800/60"
                    >
                      <td className="py-3 pr-4 text-gray-900 whitespace-nowrap dark:text-gray-100">
                        {l.name}
                      </td>
                      <td className="py-3 pr-4 text-gray-600 whitespace-nowrap dark:text-slate-300">
                        {l.email}
                      </td>
                      <td className="py-3 pr-4 text-gray-600 whitespace-nowrap dark:text-slate-300">
                        {l.phone || "-"}
                      </td>

                      <td className="py-3 pr-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full border text-xs ${statusClass(
                            l.status || "ACTIVE",
                          )}`}
                        >
                          {l.status || "ACTIVE"}
                        </span>
                      </td>

                      <td className="py-3 pr-4 text-gray-600 whitespace-nowrap dark:text-slate-300">
                        {formatDate(l.createdAt)}
                      </td>

                      <td className="py-3 pr-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(l)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100
                                       dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <MdModeEdit />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(l)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-200 text-red-500 hover:bg-red-50
                                       dark:border-red-500/60 dark:bg-slate-900 dark:hover:bg-red-500/10"
                          >
                            <MdDelete />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrokersLenders;
