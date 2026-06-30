import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  ExternalLink,
  FileText,
  Mail,
  Phone,
  RefreshCw,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import toast from "react-hot-toast";
import PageMeta from "../../components/common/PageMeta";
import { buildImpersonatePortalUrl } from "../../lib/impersonateUrl";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

type BorrowerRow = {
  id: string;
  applicationId: string;
  applicationNumber: string;
  applicationStatus: string;
  submissionId: string | null;
  clientId: string | null;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
};

type ApiResponse = {
  success: boolean;
  data: BorrowerRow[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

type SortKey = "name" | "email" | "phone" | "applicationNumber" | "createdAt";
type SortDir = "asc" | "desc";

const AVATAR_TONES = [
  "bg-orange-100 text-orange-700",
  "bg-amber-100 text-amber-700",
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
];

function getAuthHeaders(json = false): Record<string, string> {
  const token = sessionStorage.getItem("broker_token");
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function getInitials(name?: string) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

function getAvatarTone(seed: string) {
  const index = seed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_TONES[index % AVATAR_TONES.length];
}

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPhone(value?: string) {
  if (!value) return "—";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return value;
}

function SortHeader({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: SortDir;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group inline-flex w-full items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 transition hover:text-[#13538A] ${
        active ? "text-[#13538A]" : ""
      }`}
    >
      {label}
      {active ? (
        direction === "asc" ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-60" />
      )}
    </button>
  );
}

export default function BorrowersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [borrowers, setBorrowers] = useState<BorrowerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  const fetchBorrowers = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });

      if (debouncedSearch) {
        params.append("search", debouncedSearch);
      }

      const res = await fetch(`${API_BASE}/broker/borrowers/list?${params}`, {
        method: "GET",
        headers: getAuthHeaders(),
      });

      const data: ApiResponse = await res.json();

      if (data.success) {
        setBorrowers(data.data);
        setTotalPages(data.pagination.totalPages);
        setTotalCount(data.pagination.total);
        setPage(data.pagination.page);
      } else {
        toast.error("Failed to fetch borrowers");
      }
    } catch {
      toast.error("Failed to fetch borrowers");
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const q = search.trim();
    if (q) {
      setSearchParams({ q }, { replace: true });
    } else if (searchParams.has("q")) {
      setSearchParams({}, { replace: true });
    }
  }, [search, searchParams, setSearchParams]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchBorrowers();
  }, [fetchBorrowers]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  };

  const sortedBorrowers = useMemo(() => {
    const rows = [...borrowers];
    rows.sort((a, b) => {
      const left = String(a[sortKey] || "").toLowerCase();
      const right = String(b[sortKey] || "").toLowerCase();
      if (left < right) return sortDir === "asc" ? -1 : 1;
      if (left > right) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }, [borrowers, sortKey, sortDir]);

  const openApplication = (row: BorrowerRow) => {
    if (!row.submissionId) {
      toast.error("No submission found for this application");
      return;
    }
    navigate("/loan-preview", { state: { submissionId: row.submissionId } });
  };

  const handleImpersonate = async (row: BorrowerRow) => {
    if (!row.clientId) {
      toast.error("This borrower does not have a linked client record");
      return;
    }

    try {
      setImpersonatingId(row.clientId);

      const res = await fetch(
        `${API_BASE}/broker/borrowers/${row.clientId}/impersonate`,
        {
          method: "POST",
          headers: getAuthHeaders(true),
          body: JSON.stringify({}),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to access client portal");
      }

      const portalUrl = buildImpersonatePortalUrl("/client-portal/impersonate", {
        token: json.token,
        user: JSON.stringify(json.user),
        redirectTo: json.redirectTo || "/client-portal",
      });
      const newTab = window.open(portalUrl, "_blank", "noopener,noreferrer");

      if (!newTab) {
        toast.error("Pop-up blocked. Allow pop-ups to open the client portal.");
        return;
      }

      toast.success(`Opened client portal for ${row.name || row.email}`);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to open client portal",
      );
    } finally {
      setImpersonatingId(null);
    }
  };

  return (
    <>
      <PageMeta title="Borrowers | Broker Dashboard" description="Borrowers from loan applications" />

      <div className="space-y-4 pb-6">
        <div className="overflow-hidden rounded-2xl border border-gray-200  bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#2C92D5]  p-4 text-white shadow-sm dark:border-gray-800 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-medium backdrop-blur-sm">
                <UserRound className="h-3 w-3" /> 
                CRM · Borrowers
              </div>
              <h1 className="text-xl font-semibold tracking-tight">Borrowers List</h1>
              <p className="mt-1 max-w-2xl text-xs text-white/80">
                Automatically extracted from loan applications — name, contact details, and loan number.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/20 backdrop-blur-sm">
                <p className="text-[10px] text-white/70">Total borrowers</p>
                <p className="mt-0.5 text-lg font-semibold">{totalCount}</p>
              </div>
              <div className="rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/20 backdrop-blur-sm">
                <p className="text-[10px] text-white/70">On this page</p>
                <p className="mt-0.5 text-lg font-semibold">{borrowers.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, phone, or loan #..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-9 text-xs outline-none focus:border-[#13538A]/40 focus:ring-2 focus:ring-[#13538A]/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => fetchBorrowers()}
              disabled={loading}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {loading ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-4 px-6 py-4">
                  <div className="h-4 w-6 rounded bg-gray-100 dark:bg-gray-800" />
                  <div className="h-11 w-11 rounded-xl bg-gray-100 dark:bg-gray-800" />
                  <div className="h-4 flex-1 rounded bg-gray-100 dark:bg-gray-800" />
                  <div className="h-4 w-32 rounded bg-gray-100 dark:bg-gray-800" />
                </div>
              ))}
            </div>
          ) : sortedBorrowers.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
                <UserRound size={24} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {search ? "No matching borrowers" : "No borrowers yet"}
              </h3>
              <p className="mt-1 max-w-md text-sm text-gray-500">
                {search
                  ? "Try adjusting your search terms."
                  : "Borrowers appear here once loan applications are submitted."}
              </p>
            </div>
          ) : (
            <div className="max-h-[calc(100vh-15rem)] overflow-y-auto overflow-x-hidden">
              <table className="w-full table-fixed border-collapse text-left text-xs">
                <colgroup>
                  <col className="w-12" />
                  <col className="w-[24%]" />
                  <col className="w-[24%]" />
                  <col className="w-[18%]" />
                  <col className="w-[16%]" />
                  <col className="w-[12%]" />
                  <col className="w-20" />
                </colgroup>
                <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/95 backdrop-blur dark:border-gray-700 dark:bg-gray-800/95">
                  <tr>
                    <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      #
                    </th>
                    <th className="px-4 py-2">
                      <SortHeader
                        label="Name"
                        active={sortKey === "name"}
                        direction={sortDir}
                        onClick={() => toggleSort("name")}
                      />
                    </th>       
                    <th className="px-4 py-2">
                      <SortHeader
                        label="Email"
                        active={sortKey === "email"}
                        direction={sortDir}
                        onClick={() => toggleSort("email")}
                      />
                    </th>
                    <th className="px-4 py-2">
                      <SortHeader
                        label="Phone"
                        active={sortKey === "phone"}
                        direction={sortDir}
                        onClick={() => toggleSort("phone")}
                      />
                    </th>
                    <th className="px-4 py-2">
                      <SortHeader
                        label="Loan #"
                        active={sortKey === "applicationNumber"}
                        direction={sortDir}
                        onClick={() => toggleSort("applicationNumber")}
                      />
                    </th>
                    <th className="px-4 py-2">
                      <SortHeader
                        label="Created"
                        active={sortKey === "createdAt"}
                        direction={sortDir}
                        onClick={() => toggleSort("createdAt")}
                      />
                    </th>
                    <th className="px-4 py-2 text-right">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                        Actions
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {sortedBorrowers.map((row, index) => (
                    <tr
                      key={row.id}
                      className="group cursor-pointer transition-colors hover:bg-orange-50/50 dark:hover:bg-gray-800/40"
                      onClick={() => openApplication(row)}
                    >
                      <td className="px-4 py-2.5 text-[11px] font-medium tabular-nums text-gray-400">
                        {(page - 1) * limit + index + 1}
                      </td>

                      <td className="px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ring-1 ring-gray-200/80 dark:ring-gray-700 ${getAvatarTone(row.name)}`}
                          >
                            {getInitials(row.name)}
                          </span>
                          <p className="truncate text-xs font-semibold text-gray-900 dark:text-gray-100">
                            {row.name || "—"}
                          </p>
                        </div>
                      </td>

                      <td className="px-4 py-2.5">
                        {row.email ? (
                          <a
                            href={`mailto:${row.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex min-w-0 items-center gap-1.5 text-xs text-gray-600 transition hover:text-[#13538A] dark:text-gray-300"
                            title={row.email}
                          >
                            <Mail className="h-3 w-3 shrink-0 text-gray-400" />
                            <span className="truncate">{row.email}</span>
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      <td className="px-4 py-2.5">
                        {row.phone ? (
                          <a
                            href={`tel:${row.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 text-xs text-gray-600 transition hover:text-[#13538A] dark:text-gray-300"
                          >
                            <Phone className="h-3 w-3 shrink-0 text-gray-400" />
                            {formatPhone(row.phone)}
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      <td className="px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-200">
                          <FileText className="h-3 w-3 shrink-0 text-orange-500" />
                          <span className="truncate">{row.applicationNumber}</span>
                        </div>
                      </td>

                      <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(row.createdAt)}
                      </td>

                      <td className="px-2 py-2.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openApplication(row);
                            }}
                            disabled={!row.submissionId}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-gray-500 transition hover:border-gray-200 hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:border-gray-700 dark:hover:bg-gray-800 dark:hover:text-white"
                            title="View application"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleImpersonate(row);
                            }}
                            disabled={
                              !row.clientId || impersonatingId === row.clientId
                            }
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-gray-500 transition hover:border-gray-200 hover:bg-gray-100 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:border-gray-700 dark:hover:bg-gray-800 dark:hover:text-cyan-400"
                            title={
                              impersonatingId === row.clientId
                                ? "Opening portal..."
                                : "Access client portal"
                            }
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && sortedBorrowers.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-3 text-[11px] text-gray-500 dark:border-gray-800">
              Showing {sortedBorrowers.length} of {totalCount} borrower(s)
              {sortKey ? ` · Sorted by ${sortKey} (${sortDir})` : ""}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500">
              Page{" "}
              <span className="font-semibold text-gray-800 dark:text-gray-200">{page}</span> of{" "}
              <span className="font-semibold text-gray-800 dark:text-gray-200">{totalPages}</span>
            </p>       

            <div className="flex gap-2">
              <button
                type="button"
                disabled={page === 1 || loading}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>
              <button
                type="button"
                disabled={page === totalPages || loading} 
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
