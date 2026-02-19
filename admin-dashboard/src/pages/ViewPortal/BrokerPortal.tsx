import { useEffect, useState } from "react";
import axios from "axios";
import { Loader2, ExternalLink, Search, RefreshCcw, Mail } from "lucide-react";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";
const BROKER_URI = import.meta.env.VITE_BROKER_URI || "http://localhost:5174";

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("admin_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

type Broker = {
  organizationId: string;
  name: string;
  profileImage: string | null;
  adminEmail: string;
};

const ImpersonateBrokers = () => {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const fetchBrokers = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/impersonate/brokers");
      setBrokers(res.data?.data || []);
    } catch (err) {
      console.error("Failed to fetch brokers", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrokers();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const filteredBrokers = brokers.filter(
    (b) =>
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.adminEmail.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const totalPages = Math.ceil(filteredBrokers.length / pageSize);

  const paginatedBrokers = filteredBrokers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const handleViewPortal = async (orgId: string) => {
    try {
      const res = await api.post("/admin/auth/impersonate", {
        organizationId: orgId,
      });

      if (res.data?.success) {
        const { token, user } = res.data;
        const encodedUser = encodeURIComponent(JSON.stringify(user));

        window.open(
          `${BROKER_URI}/impersonate?token=${token}&user=${encodedUser}`,
          "_self",
        );
      } else {
        toast.error("Impersonation failed.");
      }
    } catch (err: any) {
      console.error("Impersonation error", err?.response?.data || err);
      toast.error("Something went wrong while impersonating.");
    }
  };
  return (
    <div className="w-full max-w-6xl mx-auto overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {/* HEADER SECTION */}
      <div className="flex flex-col border-b border-slate-100 p-6 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Broker Portal Access
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Access and impersonate active broker portals.
          </p>
        </div>

        <div className="mt-4 flex items-center gap-3 md:mt-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              className="h-10 rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={fetchBrokers}
            disabled={loading}
            className="flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <RefreshCcw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
          </button>
          {/* Page Size */}
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="rounded-md border px-3 py-1.5 text-sm
                   border-slate-300 dark:border-slate-700
                   bg-white dark:bg-slate-800
                   text-slate-700 dark:text-slate-200
                   focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value={5}>5 / page</option>
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
          </select>
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="bg-slate-50/50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              <th className="px-6 py-4">Organization</th>
              <th className="px-6 py-4">Admin Email</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={3} className="py-20 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-indigo-600 dark:text-indigo-400">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="font-medium animate-pulse">
                      Retrieving brokers...
                    </span>
                  </div>
                </td>
              </tr>
            ) : filteredBrokers.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-20 text-center text-slate-500">
                  {searchQuery
                    ? "No results match your search."
                    : "No brokers found."}
                </td>
              </tr>
            ) : (
              paginatedBrokers.map((broker) => (
                <tr
                  key={broker.organizationId}
                  className="group transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/30"
                >
                  {/* ORG INFO */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-800">
                        {broker.profileImage ? (
                          <img
                            src={`${API_BASE}${broker.profileImage}`}
                            alt={broker.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          broker.name?.charAt(0)
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {broker.name}
                        </span>
                        {/* <span className="text-xs text-slate-400">
                          ID: {broker.organizationId.substring(0, 8)}...
                        </span> */}
                      </div>
                    </div>
                  </td>

                  {/* EMAIL */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <Mail className="h-3.5 w-3.5 opacity-40" />
                      {broker.adminEmail}
                    </div>
                  </td>

                  {/* ACTION */}
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleViewPortal(broker.organizationId)}
                      className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 transition-all hover:bg-indigo-600 hover:text-white dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-600 dark:hover:text-white"
                    >
                      Enter Portal
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* PAGINATION */}
      {filteredBrokers.length > 0 && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-200 dark:border-slate-800">
          {/* Page Info */}
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Showing{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              {(currentPage - 1) * pageSize + 1}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              {Math.min(currentPage * pageSize, filteredBrokers.length)}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              {filteredBrokers.length}
            </span>{" "}
            results
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            {/* Previous */}
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm rounded-md border
                   border-slate-300 dark:border-slate-700
                   bg-white dark:bg-slate-800
                   text-slate-700 dark:text-slate-200
                   hover:bg-slate-50 dark:hover:bg-slate-700
                   disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            {/* Page Indicator */}
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Page {currentPage} of {totalPages || 1}
            </span>

            {/* Next */}
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm rounded-md border
                   border-slate-300 dark:border-slate-700
                   bg-white dark:bg-slate-800
                   text-slate-700 dark:text-slate-200
                   hover:bg-slate-50 dark:hover:bg-slate-700
                   disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImpersonateBrokers;
