import {
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  ExternalLink,
  MoreVertical,
  Phone,
  RefreshCw,
  Search,
  Link2,
  Shield,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router";
import toast from "react-hot-toast";
import PageMeta from "../../components/common/PageMeta";
import StatPill from "../../components/common/StatPill";
import { buildImpersonatePortalUrl } from "../../lib/impersonateUrl";
import { hasPermission } from "../../lib/brokerPermissions";
import {
  getPortalAuthHeaders,
  isCoBrokerPortalPath,
  isLoanOfficerPortalPath,
} from "../../lib/portalAuth";

const ACTION_MENU_WIDTH = 180;
const ACTION_MENU_HEIGHT = 148;
const LOANS_MENU_WIDTH = 320;
const LOANS_MENU_MAX_HEIGHT = 320;

function computeLoansMenuPosition(rect: DOMRect) {
  const padding = 8;
  const estimatedHeight = Math.min(LOANS_MENU_MAX_HEIGHT, 280);
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const openUpward =
    spaceBelow < estimatedHeight + padding && spaceAbove > spaceBelow;

  let top = openUpward ? rect.top - estimatedHeight - 6 : rect.bottom + 6;
  top = Math.max(
    padding,
    Math.min(top, window.innerHeight - estimatedHeight - padding),
  );

  const left = Math.max(
    padding,
    Math.min(
      rect.left,
      window.innerWidth - LOANS_MENU_WIDTH - padding,
    ),
  );

  return { top, left };
}

function computeActionMenuPosition(rect: DOMRect) {
  const padding = 8;
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const openUpward =
    spaceBelow < ACTION_MENU_HEIGHT + padding && spaceAbove > spaceBelow;

  let top = openUpward ? rect.top - ACTION_MENU_HEIGHT - 6 : rect.bottom + 6;
  top = Math.max(
    padding,
    Math.min(top, window.innerHeight - ACTION_MENU_HEIGHT - padding),
  );

  const left = Math.max(
    padding,
    Math.min(
      rect.right - ACTION_MENU_WIDTH,
      window.innerWidth - ACTION_MENU_WIDTH - padding,
    ),
  );

  return { top, left };
}

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const SEARCH_DEBOUNCE_MS = 400;

type BorrowerApplication = {
  applicationId: string;
  applicationNumber: string;
  applicationStatus: string;
  submissionId: string | null;
  createdAt: string;
};

type BorrowerRow = {
  id: string;
  applicationId: string | null;
  applicationNumber: string;
  applicationStatus: string;
  submissionId: string | null;
  clientId: string | null;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  applicationCount?: number;
  applications?: BorrowerApplication[];
};

type ApiResponse = {
  success: boolean;
  data: BorrowerRow[];
  stats?: {
    total: number;
    portalReady: number;
    pendingLink: number;
    applications?: number;
  };
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

type SortKey = "name" | "email" | "phone" | "applicationNumber" | "createdAt";
type SortDir = "asc" | "desc";

function resolveBorrowersPortalConfig() {
  if (isCoBrokerPortalPath()) {
    return {
      listUrl: `${API_BASE}/subbroker/borrowers/list`,
      impersonateUrl: (clientId: string) =>
        `${API_BASE}/subbroker/borrowers/${clientId}/impersonate`,
      previewPath: "/sub-broker/loan-pipeline-preview",
      pageTitle: "Borrowers | Co-Broker Portal",
      pageDescription:
        "One row per client portal email — open Loans to see every application and status.",
      canAccessBorrowerPortal: true,
    };
  }

  if (isLoanOfficerPortalPath()) {
    return {
      listUrl: `${API_BASE}/broker/borrowers/list`,
      impersonateUrl: (clientId: string) =>
        `${API_BASE}/broker/borrowers/${clientId}/impersonate`,
      previewPath: "/loan-officer/loan-pipeline-preview",
      pageTitle: "Borrowers | Loan Officer Portal",
      pageDescription:
        "One row per client portal email — open Loans to see every application and status.",
      canAccessBorrowerPortal: hasPermission(
        "ACCESS_BORROWER_PORTAL",
        "loanOfficer",
      ),
    };
  }

  return {
    listUrl: `${API_BASE}/broker/borrowers/list`,
    impersonateUrl: (clientId: string) =>
      `${API_BASE}/broker/borrowers/${clientId}/impersonate`,
    previewPath: "/loan-preview",
    pageTitle: "Borrowers | Broker Dashboard",
    pageDescription:
      "One row per client portal email — open Loans to see every application and status.",
    canAccessBorrowerPortal: true,
  };
}

function getAuthHeaders(json = false): Record<string, string> {
  return getPortalAuthHeaders(json);
}

function getInitials(name?: string) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

function formatDate(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPhone(value?: string) {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return value;
}

function humanizeStatus(value?: string) {
  if (!value) return "Unknown";
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function StatusPill({ status }: { status?: string }) {
  const key = String(status || "").toUpperCase();
  const isPositive =
    key === "ACTIVE" ||
    key === "APPROVED" ||
    key === "FUNDED" ||
    key === "IN_REVIEW" ||
    key === "SUBMITTED";
  const isNegative =
    key === "REJECTED" ||
    key === "DECLINED" ||
    key === "CANCELLED" ||
    key === "SUSPENDED" ||
    key === "DISABLED";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${
        isNegative
          ? "bg-rose-100 text-rose-700 ring-rose-200"
          : isPositive
            ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
            : "bg-slate-100 text-slate-600 ring-slate-200"
      }`}
    >
      {isNegative ? (
        <X className="h-3.5 w-3.5" />
      ) : (
        <CheckCircle2 className="h-3.5 w-3.5" />
      )}
      {humanizeStatus(status)}
    </span>
  );
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
      className={`group inline-flex w-full items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] transition ${
        align === "right" ? "justify-end" : "justify-start"
      } ${active ? "text-[#4C78F5]" : "text-text-secondary hover:text-[#4C78F5] dark:text-slate-400"}`}
    >
      {label}
      {active ? (
        direction === "asc" ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 shrink-0 opacity-0 transition group-hover:opacity-50" />
      )}
    </button>
  );
}

const PAGE_SIZE_OPTIONS = [10, 15, 25] as const;

export default function BorrowersPage() {
  const navigate = useNavigate();
  const portalConfig = resolveBorrowersPortalConfig();
  const canAccessBorrowerPortal = portalConfig.canAccessBorrowerPortal;
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [borrowers, setBorrowers] = useState<BorrowerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [listStats, setListStats] = useState({
    total: 0,
    portalReady: 0,
    pendingLink: 0,
  });
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [loansMenuId, setLoansMenuId] = useState<string | null>(null);
  const [loansMenuPos, setLoansMenuPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const loansMenuRef = useRef<HTMLDivElement | null>(null);

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

      const res = await fetch(`${portalConfig.listUrl}?${params}`, {
        method: "GET",
        headers: getAuthHeaders(),
      });

      const data: ApiResponse = await res.json();

      if (!res.ok || !data.success) {
        toast.error("Failed to fetch borrowers");
        setBorrowers([]);
        setTotal(0);
        setTotalPages(1);
        setListStats({ total: 0, portalReady: 0, pendingLink: 0 });
        return;
      }

      setBorrowers(data.data || []);
      setTotal(data.pagination.total ?? 0);
      setTotalPages(data.pagination.totalPages || 1);
      setListStats({
        total: data.stats?.total ?? data.pagination.total ?? 0,
        portalReady: data.stats?.portalReady ?? 0,
        pendingLink: data.stats?.pendingLink ?? 0,
      });

      if (page > (data.pagination.totalPages || 1) && (data.pagination.totalPages || 1) >= 1) {
        setPage(data.pagination.totalPages || 1);
      }
    } catch {
      toast.error("Failed to fetch borrowers");
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, sortKey, sortDir, portalConfig.listUrl]);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current?.contains(target) ||
        (target instanceof Element && target.closest("[data-menu-id]"))
      ) {
        // keep actions menu
      } else {
        setActiveMenuId(null);
      }

      if (
        loansMenuRef.current?.contains(target) ||
        (target instanceof Element && target.closest("[data-loans-menu-id]"))
      ) {
        return;
      }
      setLoansMenuId(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveMenuId(null);
        setLoansMenuId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!activeMenuId) return;

    const reposition = () => {
      const btn = document.querySelector(
        `[data-menu-id="${activeMenuId}"]`,
      ) as HTMLElement | null;
      if (!btn) return;
      setMenuPos(computeActionMenuPosition(btn.getBoundingClientRect()));
    };

    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);

    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [activeMenuId]);

  useEffect(() => {
    if (!loansMenuId) return;

    const reposition = () => {
      const btn = document.querySelector(
        `[data-loans-menu-id="${loansMenuId}"]`,
      ) as HTMLElement | null;
      if (!btn) return;
      setLoansMenuPos(computeLoansMenuPosition(btn.getBoundingClientRect()));
    };

    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);

    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [loansMenuId]);

  const openRowMenu = (id: string, event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setLoansMenuId(null);
    setMenuPos(
      computeActionMenuPosition(event.currentTarget.getBoundingClientRect()),
    );
    setActiveMenuId((current) => (current === id ? null : id));
  };

  const openLoansMenu = (
    id: string,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
    setActiveMenuId(null);
    setLoansMenuPos(
      computeLoansMenuPosition(event.currentTarget.getBoundingClientRect()),
    );
    setLoansMenuId((current) => (current === id ? null : id));
  };

  const closeRowMenu = () => setActiveMenuId(null);
  const closeLoansMenu = () => setLoansMenuId(null);

  const activeMenuBorrower = useMemo(
    () => borrowers.find((row) => row.id === activeMenuId) ?? null,
    [borrowers, activeMenuId],
  );

  const activeLoansBorrower = useMemo(
    () => borrowers.find((row) => row.id === loansMenuId) ?? null,
    [borrowers, loansMenuId],
  );

  const getBorrowerApplications = (row: BorrowerRow): BorrowerApplication[] => {
    if (Array.isArray(row.applications) && row.applications.length > 0) {
      return row.applications;
    }
    if (!row.applicationId && !row.applicationNumber) return [];
    return [
      {
        applicationId: row.applicationId || row.id,
        applicationNumber: row.applicationNumber || "",
        applicationStatus: row.applicationStatus,
        submissionId: row.submissionId,
        createdAt: row.createdAt,
      },
    ];
  };

  const openApplication = (
    row: BorrowerRow,
    loan?: BorrowerApplication | null,
  ) => {
    const target = loan || getBorrowerApplications(row)[0] || null;
    if (!target?.submissionId) {
      toast.error("No submission found for this application");
      return;
    }
    navigate(portalConfig.previewPath, {
      state: { submissionId: target.submissionId },
    });
  };

  const handleImpersonate = async (row: BorrowerRow) => {
    if (!canAccessBorrowerPortal) {
      toast.error("You don't have permission to access borrower portals");
      return;
    }
    if (!row.clientId) {
      toast.error("This borrower does not have a linked client record");
      return;
    }

    try {
      setImpersonatingId(row.clientId);

      const res = await fetch(portalConfig.impersonateUrl(row.clientId), {
        method: "POST",
        headers: getAuthHeaders(true),
        body: JSON.stringify({}),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to access client portal");
      }

      const portalUrl = buildImpersonatePortalUrl(
        "/client-portal/impersonate",
        {
          token: json.token,
          user: JSON.stringify(json.user),
          redirectTo: json.redirectTo || "/client-portal",
        },
        json.portalBaseUrl || null,
      );
      const newTab = window.open(portalUrl, "_blank", "noopener,noreferrer");

      if (!newTab) {
        toast.error("Pop-up blocked. Allow pop-ups to open the client portal.");
        return;
      }

      toast.success(`Opened client portal for ${row.name || row.email}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to open client portal";
      if (/exit the current impersonation/i.test(message)) {
        toast.error(
          "Exit view mode first (red button in the header), then try again.",
        );
      } else {
        toast.error(message);
      }
    } finally {
      setImpersonatingId(null);
    }
  };

  return (
    <>
      <PageMeta
        title={portalConfig.pageTitle}
        description={portalConfig.pageDescription}
      />

      <div className="w-full min-w-0 space-y-4 pb-4 text-text-primary dark:text-slate-100">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="ds-page-title">Borrowers</h1>
            <p className="ds-page-subtitle">{portalConfig.pageDescription}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <StatPill
            icon={<Users size={14} />}
            label="Total"
            value={listStats.total}
            color="blue"
            loading={loading && listStats.total === 0}
          />
          <StatPill
            icon={<Shield size={14} />}
            label="Portal ready"
            value={listStats.portalReady}
            color="emerald"
            loading={loading && listStats.total === 0}
          />
          <StatPill
            icon={<Link2 size={14} />}
            label="Pending link"
            value={listStats.pendingLink}
            color="amber"
            loading={loading && listStats.total === 0}
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-2.5 border-b border-border px-4 py-3.5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-center lg:min-w-0 lg:flex-1">
              <div className="group relative w-full sm:max-w-sm">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-secondary transition-colors group-focus-within:text-[#4C78F5]" />
                <input
                  type="text"
                  placeholder="Search borrowers..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-white py-2 pr-9 pl-10 text-sm text-text-primary outline-none transition placeholder:text-text-secondary/70 focus:border-[#4C78F5]/50 focus:ring-2 focus:ring-[#4C78F5]/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-text-secondary hover:bg-surface"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => fetchBorrowers()}
                disabled={loading || isSearching}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-white px-3 text-sm font-medium text-text-secondary transition hover:bg-surface disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>

            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="h-10 w-full shrink-0 rounded-xl border border-border bg-white px-3 text-sm text-text-primary outline-none transition focus:border-[#4C78F5]/50 focus:ring-2 focus:ring-[#4C78F5]/15 sm:ml-auto sm:w-[120px] lg:ml-0 dark:border-slate-700 dark:bg-slate-950"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="ds-table min-w-[880px] w-full">
              <thead>
                <tr>
                  <th>
                    <SortHeader
                      label="User"
                      active={sortKey === "name"}
                      direction={sortDir}
                      onClick={() => toggleSort("name")}
                    />
                  </th>
                  <th className="hidden sm:table-cell">Role</th>
                  <th>
                    <SortHeader
                      label="Loans"
                      active={sortKey === "applicationNumber"}
                      direction={sortDir}
                      onClick={() => toggleSort("applicationNumber")}
                    />
                  </th>
                  <th className="hidden lg:table-cell">
                    <SortHeader
                      label="Created"
                      active={sortKey === "createdAt"}
                      direction={sortDir}
                      onClick={() => toggleSort("createdAt")}
                    />
                  </th>
                  <th>Latest status</th>
                  <th className="!text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && !isSearching ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-14 text-center">
                      <div className="inline-flex items-center gap-2 text-sm text-text-secondary">
                        <Users className="h-4 w-4 animate-pulse text-[#4C78F5]" />
                        Loading borrowers…
                      </div>
                    </td>
                  </tr>
                ) : !loading && borrowers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="!px-5 !py-14 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#4C78F5]/10 text-[#4C78F5]">
                        <UserRound className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-semibold text-text-primary">
                        {search || debouncedSearch
                          ? "No borrowers match your search"
                          : "No borrowers yet"}
                      </p>
                      <p className="mx-auto mt-1.5 max-w-sm text-xs text-text-secondary">
                        {search || debouncedSearch
                          ? "Try a different search term."
                          : "Borrowers appear here once loan applications are submitted."}
                      </p>
                      {search || debouncedSearch ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSearch("");
                            setPage(1);
                          }}
                          className="mt-4 text-xs font-semibold text-[#4C78F5] hover:underline"
                        >
                          Clear search
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ) : (
                  borrowers.map((row) => {
                    const portalReady = Boolean(row.clientId);
                    const openingPortal =
                      Boolean(row.clientId) &&
                      impersonatingId === row.clientId;
                    const loans = getBorrowerApplications(row);
                    const loanCount =
                      row.applicationCount || loans.length || 0;
                    const primaryLoan = loans[0] || null;
                    const hasOpenableLoan = loans.some(
                      (loan) => Boolean(loan.submissionId),
                    );

                    return (
                      <tr key={row.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4C78F5] text-[11px] font-semibold text-white">
                              {getInitials(row.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="ds-table-title">
                                {row.name || "Unnamed"}
                              </p>
                              <p className="ds-table-meta">
                                {row.email || "No email"}
                              </p>
                              {row.phone ? (
                                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-text-secondary/80 sm:hidden">
                                  <Phone className="h-3 w-3" />
                                  {formatPhone(row.phone)}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>

                        <td className="hidden sm:table-cell">
                          <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-1 text-[11px] font-semibold text-teal-700 ring-1 ring-inset ring-teal-200">
                            <Shield className="h-3 w-3" />
                            Client
                          </span>
                        </td>

                        <td>
                          {loanCount > 0 ? (
                            <button
                              type="button"
                              data-loans-menu-id={row.id}
                              onClick={(event) => openLoansMenu(row.id, event)}
                              className={`inline-flex max-w-[220px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-left text-[11px] font-semibold transition ${
                                loansMenuId === row.id
                                  ? "border-[#4C78F5]/40 bg-[#4C78F5]/10 text-[#4C78F5]"
                                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-[#4C78F5]/30 hover:bg-[#4C78F5]/5 hover:text-[#4C78F5] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              }`}
                              title="View applications"
                            >
                              <span className="truncate">
                                {primaryLoan?.applicationNumber || "Application"}
                              </span>
                              {loanCount > 1 ? (
                                <span className="shrink-0 rounded-full bg-[#4C78F5]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#4C78F5]">
                                  +{loanCount - 1}
                                </span>
                              ) : (
                                <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
                              )}
                            </button>
                          ) : (
                            <span className="text-[12px] font-medium italic text-text-secondary/70">
                              Not set
                            </span>
                          )}
                        </td>

                        <td className="hidden ds-table-muted whitespace-nowrap lg:table-cell">
                          {formatDate(row.createdAt) || (
                            <span className="text-[12px] font-medium italic text-text-secondary/70">
                              Not set
                            </span>
                          )}
                        </td>

                        <td>
                          <StatusPill
                            status={
                              primaryLoan?.applicationStatus ||
                              row.applicationStatus
                            }
                          />
                        </td>

                        <td className="text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={!hasOpenableLoan}
                              onClick={() => {
                                if (loanCount > 1) {
                                  const btn = document.querySelector(
                                    `[data-loans-menu-id="${row.id}"]`,
                                  ) as HTMLButtonElement | null;
                                  if (btn) {
                                    setActiveMenuId(null);
                                    setLoansMenuPos(
                                      computeLoansMenuPosition(
                                        btn.getBoundingClientRect(),
                                      ),
                                    );
                                    setLoansMenuId(row.id);
                                    return;
                                  }
                                }
                                openApplication(row, primaryLoan);
                              }}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#4C78F5] px-3 text-xs font-semibold text-white transition hover:bg-[#3B66E0] disabled:opacity-50"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Open
                            </button>
                            {canAccessBorrowerPortal && portalReady ? (
                              <button
                                type="button"
                                disabled={openingPortal}
                                onClick={() => void handleImpersonate(row)}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                {openingPortal ? "Opening…" : "Portal"}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              data-menu-id={row.id}
                              onClick={(event) => openRowMenu(row.id, event)}
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
                                activeMenuId === row.id
                                  ? "border-[#4C78F5]/40 bg-[#4C78F5]/10 text-[#4C78F5]"
                                  : "border-border bg-white text-text-secondary hover:bg-surface hover:text-text-primary dark:border-slate-700 dark:bg-slate-900"
                              }`}
                              title="More actions"
                              aria-label="Open actions menu"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {!loading && !isSearching && borrowers.length > 0 ? (
            <div className="flex flex-col gap-3 border-t border-border px-4 py-3.5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-[13px] text-text-secondary">
                Showing{" "}
                <span className="font-semibold text-text-primary">
                  {total === 0 ? 0 : (page - 1) * limit + 1}
                </span>
                –
                <span className="font-semibold text-text-primary">
                  {Math.min(page * limit, total)}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-text-primary">{total}</span>
              </p>

              {totalPages > 1 ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-surface disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {Array.from({ length: Math.min(totalPages, 5) }).map(
                    (_, i) => {
                      const half = Math.floor(5 / 2);
                      let startPage = 1;
                      if (totalPages <= 5) startPage = 1;
                      else if (page <= half + 1) startPage = 1;
                      else if (page >= totalPages - half)
                        startPage = totalPages - 4;
                      else startPage = page - half;

                      const pageNum = startPage + i;
                      if (pageNum > totalPages) return null;

                      return (
                        <button
                          key={pageNum}
                          type="button"
                          disabled={loading}
                          onClick={() => setPage(pageNum)}
                          className={`inline-flex h-9 min-w-9 items-center justify-center rounded-xl px-2.5 text-sm font-semibold transition ${
                            pageNum === page
                              ? "bg-[#4C78F5] text-white"
                              : "border border-border bg-white hover:bg-surface dark:border-slate-700 dark:bg-slate-900"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    },
                  )}

                  <button
                    type="button"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-surface disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {activeLoansBorrower &&
        loansMenuId &&
        createPortal(
          <div
            ref={loansMenuRef}
            style={{
              position: "fixed",
              top: loansMenuPos.top,
              left: loansMenuPos.left,
              width: LOANS_MENU_WIDTH,
            }}
            className="z-[9999] overflow-hidden rounded-xl border border-border bg-white dark:border-slate-700 dark:bg-slate-950"
          >
            <div className="border-b border-border px-3 py-2.5 dark:border-slate-800">
              <p className="truncate text-[12px] font-semibold text-text-primary dark:text-white">
                {activeLoansBorrower.name || "Borrower"}
              </p>
              <p className="truncate text-[11px] text-text-secondary">
                {activeLoansBorrower.email || "No email"} ·{" "}
                {getBorrowerApplications(activeLoansBorrower).length} loan
                {getBorrowerApplications(activeLoansBorrower).length === 1
                  ? ""
                  : "s"}
              </p>
            </div>

            <div className="max-h-[260px] overflow-y-auto py-1">
              {getBorrowerApplications(activeLoansBorrower).map((loan) => (
                <button
                  key={loan.applicationId}
                  type="button"
                  disabled={!loan.submissionId}
                  onClick={() => {
                    closeLoansMenu();
                    openApplication(activeLoansBorrower, loan);
                  }}
                  className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-[#4C78F5]/[0.06] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-slate-900"
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#4C78F5]/10 text-[#4C78F5]">
                    <Eye className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-text-primary dark:text-slate-100">
                      {loan.applicationNumber || "Untitled application"}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <StatusPill status={loan.applicationStatus} />
                      <span className="text-[10px] text-text-secondary">
                        {formatDate(loan.createdAt)}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}

      {activeMenuBorrower &&
        activeMenuId &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: menuPos.top, left: menuPos.left }}
            className="z-[9999] w-[180px] overflow-hidden rounded-xl border border-border bg-white dark:border-slate-700 dark:bg-slate-950"
          >
            <div className="border-b border-border px-3 py-2 dark:border-slate-800">
              <p className="truncate text-[11px] font-semibold text-text-primary dark:text-white">
                {activeMenuBorrower.name || "Borrower"}
              </p>
              <p className="truncate text-[10px] text-text-secondary">
                {activeMenuBorrower.email ||
                  activeMenuBorrower.applicationNumber}
              </p>
            </div>

            <div className="py-0.5">
              <button
                type="button"
                disabled={
                  !getBorrowerApplications(activeMenuBorrower).some(
                    (loan) => loan.submissionId,
                  )
                }
                onClick={() => {
                  const loans = getBorrowerApplications(activeMenuBorrower);
                  closeRowMenu();
                  if (loans.length > 1) {
                    const btn = document.querySelector(
                      `[data-loans-menu-id="${activeMenuBorrower.id}"]`,
                    ) as HTMLButtonElement | null;
                    if (btn) {
                      setLoansMenuPos(
                        computeLoansMenuPosition(btn.getBoundingClientRect()),
                      );
                      setLoansMenuId(activeMenuBorrower.id);
                      return;
                    }
                  }
                  openApplication(activeMenuBorrower, loans[0]);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-primary transition hover:bg-[#4C78F5]/[0.06] disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                <Eye className="h-3.5 w-3.5 text-[#4C78F5]" />
                View applications
              </button>

              {canAccessBorrowerPortal ? (
                <button
                  type="button"
                  disabled={
                    !activeMenuBorrower.clientId ||
                    impersonatingId === activeMenuBorrower.clientId
                  }
                  onClick={() => {
                    closeRowMenu();
                    void handleImpersonate(activeMenuBorrower);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-primary transition hover:bg-[#4C78F5]/[0.06] disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-[#4C78F5]" />
                  {impersonatingId === activeMenuBorrower.clientId
                    ? "Opening portal..."
                    : "Access client portal"}
                </button>
              ) : null}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
