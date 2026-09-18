import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Landmark,
  LayoutGrid,
  Loader2,
  Mail,
  RefreshCcw,
  Search,
  SearchX,
  Shield,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const LENDER_URI = import.meta.env.VITE_LENDER_URI || "http://localhost:5174";
const SEARCH_DEBOUNCE_MS = 350;
const PAGE_SIZE_OPTIONS = [5, 8, 10, 20] as const;

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
    "from-[#13538A] to-[#1a6fad]",
    "from-teal-600 to-cyan-600",
    "from-slate-600 to-slate-800",
    "from-emerald-600 to-teal-700",
    "from-sky-600 to-blue-700",
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
  const [pageSize, setPageSize] = useState(8);
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
  const shortOrgId = (id: string) =>
    id.length <= 12 ? id : `${id.slice(0, 6)}…${id.slice(-4)}`;

  return (
    <div className="w-full space-y-4 text-gray-900 dark:text-gray-100">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#5D28A8] px-5 py-5 text-white sm:px-6 sm:py-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 left-1/3 h-36 w-36 rounded-full bg-fuchsia-300/20 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 ring-1 ring-white/20">
              <Landmark className="h-3.5 w-3.5" />
              View portal
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Lender Portal Access
            </h1>
            <p className="mt-1 max-w-xl text-sm text-white/80">
              Search active lender organizations and open their portal in a new
              tab to review the live experience.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchLenders()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#13538A] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCcw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {
            label: debouncedSearch ? "Matching lenders" : "Total lenders",
            value: total,
            icon: LayoutGrid,
            iconWrap:
              "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
          },
          {
            label: "On this page",
            value: lenders.length,
            icon: Landmark,
            iconWrap:
              "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
          },
          {
            label: "Access mode",
            value: "Impersonate",
            icon: Shield,
            iconWrap:
              "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
            isText: true,
          },
        ].map(({ label, value, icon: Icon, iconWrap, isText }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3.5 dark:border-slate-700 dark:bg-slate-900"
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconWrap}`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400">
                {label}
              </p>
              <p
                className={`font-semibold text-gray-900 dark:text-white ${
                  isText ? "text-base" : "text-xl tabular-nums"
                }`}
              >
                {loading && !isText ? "—" : value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-slate-800 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Lender organizations
            </h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">
              {total} lender{total === 1 ? "" : "s"}
              {debouncedSearch ? " matching search" : " available"}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                placeholder="Search name or email..."
                className="h-10 w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm text-gray-900 outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/15 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <label className="flex items-center gap-2 self-end text-xs text-gray-500 sm:self-auto dark:text-slate-400">
              Per page
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-10 rounded-xl border border-gray-200 bg-white px-2.5 text-sm font-medium text-gray-700 outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/15 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                aria-label="Rows per page"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="custom-scrollbar overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="sticky top-0 z-[1] bg-slate-50/95 backdrop-blur dark:bg-slate-800/90">
              <tr className="border-b border-gray-200 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:border-slate-700 dark:text-slate-400">
                <th className="px-5 py-3.5 sm:px-6">Organization</th>
                <th className="px-5 py-3.5 sm:px-6">Admin email</th>
                <th className="w-[170px] px-5 py-3.5 text-right sm:px-6">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-16">
                    <div className="flex flex-col items-center justify-center gap-3 text-[#13538A] dark:text-sky-400">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <p className="text-sm font-medium text-gray-600 dark:text-slate-300">
                        Loading lender portals…
                      </p>
                    </div>
                  </td>
                </tr>
              ) : lenders.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-16">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 dark:bg-slate-800 dark:text-slate-500">
                        <SearchX className="h-6 w-6" />
                      </div>
                      <p className="text-sm font-medium text-gray-800 dark:text-slate-200">
                        {debouncedSearch
                          ? "No results found"
                          : "No lenders found"}
                      </p>
                      <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-slate-400">
                        {debouncedSearch
                          ? `Nothing matched "${debouncedSearch}". Try a different name or email.`
                          : "Lender organizations will appear here once available."}
                      </p>
                      {searchQuery ? (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="mt-3 text-sm font-medium text-[#13538A] hover:underline dark:text-sky-400"
                        >
                          Clear search
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ) : (
                lenders.map((lender) => {
                  const isEntering = enteringId === lender.organizationId;
                  return (
                    <tr
                      key={lender.organizationId}
                      className="group relative transition-colors hover:bg-[#13538A]/[0.03] dark:hover:bg-slate-800/50"
                    >
                      <td className="relative px-5 py-4 sm:px-6">
                        <span
                          className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-[#13538A] opacity-0 transition group-hover:opacity-80"
                          aria-hidden
                        />
                        <div className="flex items-center gap-3.5">
                          <div
                            className={`relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br text-sm font-bold text-white ring-2 ring-white dark:ring-slate-900 ${avatarTone(lender.name)}`}
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
                            <p className="truncate font-semibold text-gray-900 dark:text-white">
                              {lender.name || "Untitled organization"}
                            </p>
                            <p className="mt-0.5 truncate font-mono text-[11px] text-gray-400">
                              {shortOrgId(lender.organizationId)}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 sm:px-6">
                        <div className="inline-flex max-w-full items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-2.5 py-1.5 text-gray-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                          <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" />
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
                          className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-[#13538A] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#0f4573] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isEntering ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Opening…
                            </>
                          ) : (
                            <>
                              Enter portal
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

        {total > 0 ? (
          <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Showing{" "}
              <span className="font-medium text-gray-700 dark:text-slate-200">
                {rangeStart}–{rangeEnd}
              </span>{" "}
              of{" "}
              <span className="font-medium text-gray-700 dark:text-slate-200">
                {total}
              </span>
            </p>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1 || loading}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <span className="inline-flex items-center gap-1">
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </span>
              </button>

              {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                const half = Math.floor(5 / 2);
                let startPage = 1;
                if (totalPages <= 5) startPage = 1;
                else if (currentPage <= half + 1) startPage = 1;
                else if (currentPage >= totalPages - half)
                  startPage = totalPages - 4;
                else startPage = currentPage - half;

                const page = startPage + i;
                if (page > totalPages) return null;

                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    disabled={loading}
                    className={`min-w-8 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition ${
                      page === currentPage
                        ? "border-[#13538A] bg-[#13538A] text-white"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    }`}
                  >
                    {page}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() =>
                  setCurrentPage((p) => Math.min(p + 1, totalPages))
                }
                disabled={currentPage >= totalPages || loading}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <span className="inline-flex items-center gap-1">
                  Next
                  <ChevronRight className="h-4 w-4" />
                </span>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ImpersonateLenders;
