import { useEffect, useState } from "react";
import {
  RefreshCcw,
  Search,
  Building2,
  SearchX,
  ChevronLeft,
  ChevronRight,
  Mail,
  UserPlus,
} from "lucide-react";

/* ================= TYPES ================= */

type Lender = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: "NOT_CONNECTED" | "CONNECTED";
  profileImage?: string | null;
};

type Meta = {
  page: number;
  limit: number;
  total: number;
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

function getAuthHeaders(): HeadersInit {
  const token = sessionStorage.getItem("broker_token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

export default function FindLenders() {
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [meta, setMeta] = useState<Meta>({ page: 1, limit: 10, total: 0 });
  const [loading, setLoading] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(9);

  const [hasSearched, setHasSearched] = useState(false);

  /* ================= FETCH ================= */

  useEffect(() => {
    if (!hasSearched) return;
    fetchLenders();
  }, [page, limit, q, hasSearched]);

  async function fetchLenders() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(q && { q }),
      });

      const res = await fetch(
        `${API_BASE}/broker/lenders?${params.toString()}`,
        { headers: getAuthHeaders() }
      );

      const json = await res.json();
      if (!res.ok || json.success !== true) {
        throw new Error(json.message || "Failed to load lenders");
      }

      setLenders(
        (json.data || []).map((l: any) => ({
          ...l,
          profileImage: l.profileImage || null,
        }))
      );
      setMeta(json.meta || { page, limit, total: 0 });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleFindLenders() {
    setPage(1);
    setHasSearched(true);
  }

  function inviteLender(lenderId: string) {
    setInvitingId(lenderId);
    setTimeout(() => {
      setLenders((prev) => prev.filter((l) => l.id !== lenderId));
      setInvitingId(null);
    }, 800);
  }

  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));
  const isSearchEmpty = q.trim() !== "" && lenders.length === 0 && !loading;
  const isTotalEmpty = q.trim() === "" && meta.total === 0 && !loading;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 px-4 py-8 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="max-w-7xl mx-auto">

        {/* ================= HEADER ================= */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Find Lenders
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
              Build your network by connecting with verified lenders.
            </p>
          </div>

          {hasSearched && <button
            onClick={() => {
              if (!hasSearched) return;
              fetchLenders();
            }}
            disabled={loading || !hasSearched}
            className="group flex items-center justify-center w-12 h-12 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCcw
              size={22}
              className={`${loading ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"} text-blue-600`}
            />
          </button>}
        </div>

        {/* ================= FIRST SCREEN (CTA) ================= */}
        {!hasSearched && (
          <div className="relative overflow-hidden py-32 flex flex-col items-center justify-center text-center bg-white dark:bg-slate-900 rounded-2xl  dark:border-slate-800">

            {/* Decorative gradient blobs */}
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>

            {/* Icon bubble */}
            <div className="relative z-10 w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-8 shadow-2xl shadow-blue-500/30 animate-pulse">
              <Building2 size={52} className="text-white" />
            </div>

            <h3 className="relative z-10 text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Discover Verified Lenders
            </h3>

            <p className="relative z-10 text-slate-600 dark:text-slate-400 mt-3 max-w-md text-sm leading-relaxed">
              Find and connect with trusted lenders to grow your business network and unlock new opportunities.
            </p>

            {/* CTA Button */}
            <button
              onClick={handleFindLenders}
              className="
      relative z-10 mt-10 px-10 py-3 rounded-2xl
      bg-gradient-to-r from-blue-600 to-indigo-600
      hover:from-blue-700 hover:to-indigo-700
      text-white font-bold text-sm
      shadow-xl shadow-blue-500/30
      transition-all duration-300
      hover:scale-105 active:scale-95
      flex items-center gap-3
    "
            >
              <Search size={14} className="text-white" />
              Find Lenders
            </button>

            {/* Small hint text */}
            <div className="relative z-10 mt-6 text-xs text-slate-400 dark:text-slate-500">
              You can search, filter, and invite lenders after loading.
            </div>
          </div>

        )}

        {/* ================= FILTERS BAR ================= */}
        {hasSearched && (
          <>
            <div className="mb-10 p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col md:flex-row items-center gap-4">
              <div className="relative flex-1 w-full">
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={q}
                  onChange={(e) => { setPage(1); setQ(e.target.value); }}
                  placeholder="Search lenders by name or email..."
                  className="text-sm w-full pl-12 pr-4 py-2 bg-transparent border-none focus:ring-2 focus:ring-blue-500/20 rounded-xl text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                />
              </div>

              <div className="hidden md:block h-8 w-px bg-slate-200 dark:bg-slate-800"></div>

              <div className="flex items-center gap-2 pr-4">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  View:
                </span>

                <div className="relative">
                  <select
                    value={limit}
                    onChange={(e) => {
                      setPage(1);
                      setLimit(Number(e.target.value));
                    }}
                    className="
        appearance-none
        px-3 py-2 pr-8
        rounded-xl text-sm font-semibold
        bg-white dark:bg-slate-800
        text-slate-900 dark:text-slate-100
        border border-slate-200 dark:border-slate-700
        hover:bg-slate-50 dark:hover:bg-slate-700
        focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500
        transition cursor-pointer
      "
                  >
                    <option value={6}>6 / page</option>
                    <option value={9}>9 / page</option>
                    <option value={12}>12 / page</option>
                  </select>

                  {/* ▼ custom arrow */}
                  <svg
                    className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

            </div>
          </>
        )}

        {/* ================= CONTENT ================= */}

        {/* --- LOADING SKELETON --- */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-72 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse overflow-hidden">
                <div className="h-2/3 bg-slate-100 dark:bg-slate-800/50"></div>
                <div className="p-6 space-y-3">
                  <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-700 rounded"></div>
                  <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* --- EMPTY TOTAL --- */}
        {!loading && isTotalEmpty && hasSearched && (
          <div className="py-24 flex flex-col items-center text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 shadow-sm">
            <div className="w-24 h-24 rounded-3xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-6">
              <Building2 size={48} className="text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">No Lenders Available</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-sm">
              The lender directory is currently empty. Please check back later.
            </p>
          </div>
        )}

        {/* --- EMPTY SEARCH --- */}
        {!loading && isSearchEmpty && (
          <div className="py-24 flex flex-col items-center text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-orange-300 dark:border-orange-700/50 shadow-sm">
            <div className="w-24 h-24 rounded-3xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center mb-6">
              <SearchX size={48} className="text-orange-600 dark:text-orange-400" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">No Results Found</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-sm">
              We couldn't find any lenders matching "<span className="font-semibold text-orange-600">{q}</span>".
            </p>
            <button onClick={() => setQ("")} className="mt-6 text-sm font-bold text-blue-600 hover:underline">Clear search</button>
          </div>
        )}

        {/* --- CARDS GRID --- */}
        {!loading && !isTotalEmpty && !isSearchEmpty && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {lenders.map((l) => (
              <div
                key={l.id}
                className="group relative bg-white dark:bg-slate-900 rounded-[1rem] border border-slate-200 dark:border-slate-800 p-8 shadow-sm hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 hover:-translate-y-2"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-6">
                    <img
                      src={l.profileImage ? `${API_BASE}/public${l.profileImage}` : "/circle_logo.png"}
                      onError={(e: any) => {
                        e.currentTarget.src = "/circle_logo.png";
                      }}
                      className="h-24 w-24 rounded-full object-cover ring-4 ring-slate-50 dark:ring-slate-800 shadow-inner"
                    />
                    <div className="absolute -top-2 -right-2 bg-blue-600 text-white p-1.5 rounded-xl shadow-lg">
                      <Building2 size={14} />
                    </div>
                  </div>

                  <h3 className="text-md font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                    {l.name}
                  </h3>

                  <div className="flex items-center gap-2 mt-2 text-slate-500 dark:text-slate-400">
                    <Mail size={16} />
                    <span className="text-xs font-medium truncate max-w-[200px]">{l.email}</span>
                  </div>

                  <button
                    onClick={() => inviteLender(l.id)}
                    disabled={invitingId === l.id}
                    className="text-xs mt-8 w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl font-bold tracking-wide transition-all
                      bg-slate-950 dark:bg-white text-white dark:text-slate-950
                      hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white
                      disabled:opacity-50 active:scale-95 shadow-lg shadow-slate-200 dark:shadow-none"
                  >
                    {invitingId === l.id ? (
                      <RefreshCcw size={18} className="animate-spin" />
                    ) : (
                      <UserPlus size={18} />
                    )}
                    {invitingId === l.id ? "Processing..." : "Send Invitation"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ================= PAGINATION ================= */}
        {!loading && totalPages > 1 && (
          <div className="mt-16 flex flex-col sm:flex-row items-center justify-between gap-6 border-t border-slate-200 dark:border-slate-800 pt-8">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Showing <span className="text-slate-900 dark:text-white">Page {meta.page}</span> of {totalPages}
            </p>

            <div className="flex items-center gap-3">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-bold disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
              >
                <ChevronLeft size={18} />
                Prev
              </button>

              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-bold disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
              >
                Next
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}