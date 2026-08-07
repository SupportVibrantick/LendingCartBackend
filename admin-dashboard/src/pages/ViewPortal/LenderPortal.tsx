import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  Loader2,
  ExternalLink,
  Search,
  RefreshCcw,
  Mail,
  Landmark,
  SearchX,
  ChevronLeft,
  ChevronRight,
  Shield,
  LayoutGrid,
} from "lucide-react";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const LENDER_URI = import.meta.env.VITE_LENDER_URI || "http://localhost:5174";
const SEARCH_DEBOUNCE_MS = 350;

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("admin_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

type Lender = {
  organizationId: string;
  name: string;
  profileImage: string | null;
  adminEmail: string;
};

type ListMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const avatarTone = (name: string) => {
  const tones = [
    "from-teal-600 to-cyan-700",
    "from-[#0F766E] to-[#14b8a6]",
    "from-slate-600 to-slate-800",
    "from-emerald-600 to-teal-700",
    "from-sky-700 to-teal-600",
  ];
  const index =
    Math.abs(
      Array.from(name || "").reduce((sum, ch) => sum + ch.charCodeAt(0), 0),
    ) % tones.length;
  return tones[index];
};

const ImpersonateLenders = () => {
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [enteringId, setEnteringId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, pageSize]);

  const fetchLenders = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const res = await api.get("/admin/impersonate/lenders", {
        params: {
          page: currentPage,
          limit: pageSize,
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
        },
        signal: controller.signal,
      });

      const meta = (res.data?.meta || {}) as Partial<ListMeta>;
      const nextTotal = Number(meta.total) || 0;
      const nextTotalPages = Math.max(1, Number(meta.totalPages) || 1);

      setLenders(Array.isArray(res.data?.data) ? res.data.data : []);
      setTotal(nextTotal);
      setTotalPages(nextTotalPages);

      if (currentPage > nextTotalPages) {
        setCurrentPage(nextTotalPages);
      }
    } catch (err: any) {
      if (axios.isCancel?.(err) || err?.code === "ERR_CANCELED") return;
      console.error("Failed to fetch lenders", err);
      toast.error("Failed to load lender portals.");
      setLenders([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
      }
    }
  }, [currentPage, pageSize, debouncedSearch]);

  useEffect(() => {
    fetchLenders();
    return () => abortRef.current?.abort();
  }, [fetchLenders]);

  const handleViewPortal = async (orgId: string) => {
    const newTab = window.open("about:blank", "_blank");
    setEnteringId(orgId);

    try {
      const res = await api.post("/admin/auth/impersonate", {
        organizationId: orgId,
      });

      if (res.data?.success) {
        const { token, user } = res.data;
        const encodedUser = encodeURIComponent(JSON.stringify(user));
        const portalUrl = `${LENDER_URI}/impersonate?token=${token}&user=${encodedUser}`;

        if (newTab) {
          newTab.opener = null;
          newTab.location.href = portalUrl;
        } else {
          toast.error(
            "Popup blocked. Allow popups to open the portal in a new tab.",
          );
        }
      } else {
        newTab?.close();
        toast.error("Impersonation failed.");
      }
    } catch (err: any) {
      newTab?.close();
      console.error("Impersonation error", err?.response?.data || err);
      toast.error("Something went wrong while impersonating.");
    } finally {
      setEnteringId(null);
    }
  };

  const rangeStart = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, total);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#0F766E] via-[#18B6B4] to-emerald-400" />
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-teal-500/10 blur-2xl dark:bg-teal-400/10" />
        <div className="relative flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-[#0F766E] ring-1 ring-teal-500/20 dark:bg-teal-500/20 dark:text-teal-300">
              <Landmark className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                View Portal
              </p>
              <h2 className="mt-0.5 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Lender Portal Access
              </h2>
              <p className="mt-1 max-w-xl text-sm text-slate-500 dark:text-slate-400">
                Search active lender organizations and open their portal in a
                new tab to review the live experience.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 dark:border-slate-700 dark:bg-slate-800/80">
              <LayoutGrid className="h-4 w-4 text-[#0F766E]" />
              <div className="leading-none">
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  {debouncedSearch ? "Matches" : "Lenders"}
                </p>
                <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
                  {loading ? "—" : total}
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50 px-3.5 py-2 dark:border-amber-500/30 dark:bg-amber-500/10">
              <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <div className="leading-none">
                <p className="text-[10px] font-medium uppercase tracking-wide text-amber-700/70 dark:text-amber-300/70">
                  Mode
                </p>
                <p className="mt-0.5 text-sm font-bold text-amber-800 dark:text-amber-200">
                  Impersonate
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by organization or admin email..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-[#0F766E] focus:bg-white focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-teal-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#0F766E] focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              aria-label="Rows per page"
            >
              <option value={5}>5 / page</option>
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
            </select>

            <button
              type="button"
              onClick={() => fetchLenders()}
              disabled={loading}
              title="Refresh list"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-600 transition hover:border-teal-500/40 hover:text-[#0F766E] disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-teal-400/40 dark:hover:text-teal-300"
            >
              <RefreshCcw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <th className="px-5 py-3.5 sm:px-6">Organization</th>
                <th className="px-5 py-3.5 sm:px-6">Admin email</th>
                <th className="px-5 py-3.5 text-right sm:px-6">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-16">
                    <div className="flex flex-col items-center justify-center gap-3 text-[#0F766E] dark:text-teal-400">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        Loading lender portals…
                      </p>
                    </div>
                  </td>
                </tr>
              ) : lenders.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-16">
                    <div className="flex flex-col items-center justify-center gap-3 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                        <SearchX className="h-7 w-7" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {debouncedSearch
                            ? "No matching lenders"
                            : "No lenders found"}
                        </p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {debouncedSearch
                            ? "Try a different name or email."
                            : "Lender organizations will appear here once available."}
                        </p>
                      </div>
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="mt-1 text-sm font-medium text-[#0F766E] hover:underline dark:text-teal-400"
                        >
                          Clear search
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                lenders.map((lender) => {
                  const isEntering = enteringId === lender.organizationId;
                  return (
                    <tr
                      key={lender.organizationId}
                      className="group transition-colors hover:bg-slate-50/90 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-5 py-4 sm:px-6">
                        <div className="flex items-center gap-3.5">
                          <div
                            className={`relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900 ${avatarTone(lender.name)}`}
                          >
                            {lender.profileImage ? (
                              <img
                                src={`${API_BASE}${lender.profileImage}`}
                                alt={lender.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              (lender.name?.charAt(0) || "?").toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900 dark:text-white">
                              {lender.name || "Untitled organization"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 sm:px-6">
                        <div className="inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                          <Mail className="h-3.5 w-3.5 shrink-0 opacity-50" />
                          <span className="truncate text-sm">
                            {lender.adminEmail || "—"}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-right sm:px-6">
                        <button
                          type="button"
                          disabled={Boolean(enteringId)}
                          onClick={() =>
                            handleViewPortal(lender.organizationId)
                          }
                          className="inline-flex items-center gap-2 rounded-xl bg-[#0F766E] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#0b5f59] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-600 dark:hover:bg-teal-500"
                        >
                          {isEntering ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Opening…
                            </>
                          ) : (
                            <>
                              Enter Portal
                              <ExternalLink className="h-3.5 w-3.5" />
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 dark:border-slate-800 sm:flex-row sm:px-6">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Showing{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {rangeStart}
              </span>
              –
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {rangeEnd}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {total}
              </span>
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1 || loading}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>

              <span className="min-w-[5.5rem] text-center text-sm font-medium text-slate-600 dark:text-slate-300">
                {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() =>
                  setCurrentPage((p) => Math.min(p + 1, totalPages))
                }
                disabled={currentPage >= totalPages || loading}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImpersonateLenders;
