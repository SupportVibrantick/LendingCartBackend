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
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import toast from "react-hot-toast";
import PageMeta from "../../components/common/PageMeta";
import { buildImpersonatePortalUrl } from "../../lib/impersonateUrl";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const SEARCH_DEBOUNCE_MS = 400;

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
  align = "left",
}: {
  label: string;
  active: boolean;
  direction: SortDir;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group inline-flex w-full items-center gap-1.5 text-xs font-semibold uppercase tracking-wide transition ${
        align === "right" ? "justify-end" : "justify-start"
      } ${active ? "text-[#13538A]" : "text-gray-500 hover:text-[#13538A] dark:text-gray-400"}`}
    >
      {label}
      {active ? (
        direction === "asc" ? (
          <ChevronUp className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0" />
        )
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-0 transition group-hover:opacity-50" />
      )}
    </button>
  );
}

function StatChip({
  icon,
  label,
  value,
  tone = "blue",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "blue" | "orange" | "slate";
}) {
  const tones = {
    blue: "border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300",
    orange:
      "border-orange-100 bg-orange-50 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300",
    slate:
      "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
  };

  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border px-4 py-2.5 ${tones[tone]}`}
    >
      {icon}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
          {label}
        </p>
        <p className="text-lg font-bold leading-tight">{value}</p>
      </div>
    </div>
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
  const [total, setTotal] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  const fetchBorrowers = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sortBy: sortKey,
        sortOrder: sortDir,
      });

      if (debouncedSearch) {
        params.set("search", debouncedSearch);
      }

      const res = await fetch(`${API_BASE}/broker/borrowers/list?${params}`, {
        method: "GET",
        headers: getAuthHeaders(),
      });

      const data: ApiResponse = await res.json();

      if (!res.ok || !data.success) {
        toast.error("Failed to fetch borrowers");
        setBorrowers([]);
        setTotal(0);
        setTotalPages(1);
        return;
      }

      setBorrowers(data.data || []);
      setTotal(data.pagination.total ?? 0);
      setTotalPages(data.pagination.totalPages || 1);

      if (page > (data.pagination.totalPages || 1) && (data.pagination.totalPages || 1) >= 1) {
        setPage(data.pagination.totalPages || 1);
      }
    } catch {
      toast.error("Failed to fetch borrowers");
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, sortKey, sortDir]);

  const isSearching = search.trim() !== debouncedSearch;

  useEffect(() => {
    const handler = setTimeout(() => {
      const next = search.trim();
      setDebouncedSearch((prev) => {
        if (prev !== next) {
          setPage(1);
        }
        return next;
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    const q = search.trim();
    if (q) {
      setSearchParams({ q }, { replace: true });
    } else if (searchParams.has("q")) {
      setSearchParams({}, { replace: true });
    }
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [sortKey, sortDir]);

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

  const sortLabel =
    sortKey === "createdAt"
      ? "date created"
      : sortKey === "applicationNumber"
        ? "loan #"
        : sortKey;

  return (
    <>
      <PageMeta title="Borrowers | Broker Dashboard" description="Borrowers from loan applications" />

      <div className="space-y-5 pb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-gray-400">
            User Management
            </p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Borrowers</h1>
            <p className="mt-1 max-w-xl text-sm text-gray-500 dark:text-gray-400">
              Automatically extracted from loan applications — name, contact details, and loan number.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <StatChip
              icon={<Users className="h-3.5 w-3.5" />}
              label="Total"
              value={total}
              tone="blue"
            />
            <StatChip
              icon={<UserRound className="h-3.5 w-3.5" />}
              label="This page"
              value={borrowers.length}
              tone="orange"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-100 p-4 dark:border-gray-800 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full sm:max-w-sm lg:flex-1 lg:max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, phone, or loan #..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-9 text-sm outline-none focus:border-[#13538A]/40 focus:ring-2 focus:ring-[#13538A]/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => fetchBorrowers()}
                disabled={loading || isSearching}
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/50 px-4 py-2.5 dark:border-gray-800 dark:bg-gray-800/30 sm:px-5">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {loading || isSearching ? (
                isSearching ? "Searching..." : "Loading borrowers..."
              ) : (
                <>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {total}
                  </span>{" "}
                  borrower{total === 1 ? "" : "s"}
                  {debouncedSearch ? ` matching "${debouncedSearch}"` : ""}
                </>
              )}
            </p>
            {!loading && !isSearching && borrowers.length > 0 && (
              <p className="text-xs text-gray-400">
                Sorted by{" "}
                <span className="font-medium text-gray-600 dark:text-gray-300">
                  {sortLabel}
                </span>
              </p>
            )}
          </div>

          {loading && !isSearching ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex animate-pulse items-center gap-4 px-5 py-4"
                >
                  <div className="h-4 w-6 rounded bg-gray-100 dark:bg-gray-800" />
                  <div className="h-9 w-9 rounded-lg bg-gray-100 dark:bg-gray-800" />
                  <div className="h-4 flex-1 max-w-[180px] rounded bg-gray-100 dark:bg-gray-800" />
                  <div className="hidden h-4 w-40 rounded bg-gray-100 dark:bg-gray-800 md:block" />
                  <div className="hidden h-4 w-24 rounded bg-gray-100 dark:bg-gray-800 lg:block" />
                  <div className="ml-auto h-8 w-16 rounded-lg bg-gray-100 dark:bg-gray-800" />
                </div>
              ))}
            </div>
          ) : !loading && borrowers.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#13538A]/10 text-[#13538A]">
                <UserRound size={24} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {search || debouncedSearch ? "No matching borrowers" : "No borrowers yet"}
              </h3>
              <p className="mt-1 max-w-md text-sm text-gray-500">
                {search || debouncedSearch
                  ? "Try adjusting your search terms."
                  : "Borrowers appear here once loan applications are submitted."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                    <th className="w-10 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                      #
                    </th>
                    <th className="px-4 py-3 text-left">
                      <SortHeader
                        label="Name"
                        active={sortKey === "name"}
                        direction={sortDir}
                        onClick={() => toggleSort("name")}
                      />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <SortHeader
                        label="Email"
                        active={sortKey === "email"}
                        direction={sortDir}
                        onClick={() => toggleSort("email")}
                      />
                    </th>
                    <th className="hidden px-4 py-3 text-left md:table-cell">
                      <SortHeader
                        label="Phone"
                        active={sortKey === "phone"}
                        direction={sortDir}
                        onClick={() => toggleSort("phone")}
                      />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <SortHeader
                        label="Loan #"
                        active={sortKey === "applicationNumber"}
                        direction={sortDir}
                        onClick={() => toggleSort("applicationNumber")}
                      />
                    </th>
                    <th className="hidden px-4 py-3 text-left sm:table-cell">
                      <SortHeader
                        label="Created"
                        active={sortKey === "createdAt"}
                        direction={sortDir}
                        onClick={() => toggleSort("createdAt")}
                      />
                    </th>
                    <th className="w-20 px-4 py-3 text-right">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Actions
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {borrowers.map((row, index) => (
                    <tr
                      key={row.id}
                      className="group cursor-pointer transition-colors hover:bg-orange-50/50 dark:hover:bg-gray-800/40"
                      onClick={() => openApplication(row)}
                    >
                      <td className="px-4 py-3.5 text-xs font-medium tabular-nums text-gray-400">
                        {(page - 1) * limit + index + 1}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ring-1 ring-gray-200/80 dark:ring-gray-700 ${getAvatarTone(row.name)}`}
                          >
                            {getInitials(row.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {row.name || "—"}
                            </p>
                            <p className="truncate text-xs text-gray-400 md:hidden">
                              {row.phone ? formatPhone(row.phone) : "—"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        {row.email ? (
                          <a
                            href={`mailto:${row.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex min-w-0 items-center gap-1.5 text-sm text-gray-600 transition hover:text-[#13538A] dark:text-gray-300"
                            title={row.email}
                          >
                            <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                            <span className="truncate">{row.email}</span>
                          </a>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>

                      <td className="hidden px-4 py-3.5 md:table-cell">
                        {row.phone ? (
                          <a
                            href={`tel:${row.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 text-sm text-gray-600 transition hover:text-[#13538A] dark:text-gray-300"
                          >
                            <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                            {formatPhone(row.phone)}
                          </a>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-200">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                          <span className="truncate">{row.applicationNumber}</span>
                        </div>
                      </td>

                      <td className="hidden px-4 py-3.5 text-sm text-gray-500 dark:text-gray-400 sm:table-cell">
                        {formatDate(row.createdAt)}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openApplication(row);
                            }}
                            disabled={!row.submissionId}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-gray-400 transition hover:border-gray-200 hover:bg-white hover:text-[#13538A] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:border-gray-700 dark:hover:bg-gray-800 dark:hover:text-cyan-400 sm:opacity-0 sm:group-hover:opacity-100"
                            title="View application"
                          >
                            <Eye className="h-4 w-4" />
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
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition hover:border-gray-300 hover:bg-gray-50 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:bg-gray-800 dark:hover:text-cyan-400"
                            title={
                              impersonatingId === row.clientId
                                ? "Opening portal..."
                                : "Access client portal"
                            }
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !isSearching && borrowers.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50/60 px-4 py-3 dark:border-gray-800 dark:bg-gray-900/50 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing{" "}
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {total === 0 ? 0 : (page - 1) * limit + 1}–
                  {Math.min(page * limit, total)}
                </span>{" "}
                of {total} borrower{total === 1 ? "" : "s"}
              </p>

              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page === 1 || loading}
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>
                  <span className="px-2 text-sm font-medium text-gray-600 dark:text-gray-300">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page === totalPages || loading}
                    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {totalPages > 1 && (loading || borrowers.length === 0) && (
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
                Previous
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
