import {
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  Lock,
  Pencil,
  Phone,
  Plus,
  Power,
  RefreshCw,
  Search,
  Shield,
  ShieldOff,
  MoreVertical,
  Users,
  Activity,
  ExternalLink,
  Link2,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
// import Swal from "sweetalert2";
// import Select from "react-select";
import PageMeta from "../../components/common/PageMeta";
import StatPill from "../../components/common/StatPill";
import ViewLoanOfficerModal from "./ViewLoanOfficerModal";
import { formatPhone, countGrantedLoPermissionUiSlots, getLoPermissionUiSlotTotal } from "./loanOfficerShared";
import { buildImpersonatePortalUrl } from "../../lib/impersonateUrl";
import { copyBrokerTeamInviteLink } from "../../lib/brokerTeamInvite";
import LoanOfficerFormModal from "../../components/loanOfficer/LoanOfficerFormModal";
import { LoanOfficerActivityPanel } from "./LoanOfficerActivity";
import { useBrokerEntitlements } from "../../lib/brokerEntitlements";

export { LO_PERMISSION_CATEGORIES as PERMISSIONS } from "./loanOfficerShared";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const SEARCH_DEBOUNCE_MS = 400;

interface LoanOfficer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
  roles: string[];
  permissions?: string[];
  assignedCoBrokers?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  }[];
  profile: {
    company: string;
    tollFree: string;
    tollFreeExt: string;
    serviceProvider: string;
    address: string;
    suite: string;
    city: string;
    state: string;
    zipCode: string;
    agentType: string;
    licenseNumber: string;
    preferredComm: string;
    website: string;
    avatarUrl: string | null;
  } | null;
}

const AVATAR_TONES = [
  "bg-violet-100 text-violet-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
];

function getInitials(first?: string, last?: string) {
  return `${first?.charAt(0) || ""}${last?.charAt(0) || ""}`.toUpperCase() || "?";
}

function getAvatarTone(seed: string) {
  const index = seed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_TONES[index % AVATAR_TONES.length];
}

function getTeamAssignmentTitle(
  members?: { firstName?: string; lastName?: string; email?: string }[],
) {
  if (!members?.length) return undefined;
  return members
    .map((member) => {
      const name = `${member.firstName || ""} ${member.lastName || ""}`.trim();
      return member.email ? `${name} (${member.email})` : name;
    })
    .filter(Boolean)
    .join(", ");
}

type SortKey = "name" | "email" | "phone" | "status" | "createdAt";
type SortDir = "asc" | "desc";

const ACTION_MENU_WIDTH = 168;
const ACTION_MENU_HEIGHT = 232;

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

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${
        active
          ? "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30"
          : "bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30"
      }`}
    >
      {active ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <ShieldOff className="h-3.5 w-3.5" />
      )}
      {active ? "Active" : "Suspended"}
    </span>
  );
}

function AccessBadge({
  permissions,
  allowedKeys,
}: {
  permissions?: string[];
  allowedKeys?: string[] | null;
}) {
  const total = getLoPermissionUiSlotTotal(allowedKeys);
  const slotCount = countGrantedLoPermissionUiSlots(
    permissions || [],
    allowedKeys,
  );
  const isComplete = total > 0 && slotCount >= total;
  const label = !slotCount
    ? "none"
    : isComplete
      ? "full access"
      : `${slotCount}/${total}`;

  return (
    <span
      title={`${slotCount} of ${total} permissions granted`}
      className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium capitalize text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
    >
      {label}
    </span>
  );
}

function CoBrokerBadge({
  brokers,
}: {
  brokers?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  }[];
}) {
  if (!brokers?.length) {
    return null;
  }

  const visible = brokers.slice(0, 3);
  const remaining = brokers.length - visible.length;
  const title = getTeamAssignmentTitle(brokers);

  return (
    <div className="flex min-w-0 items-center gap-2" title={title}>
      <div className="flex -space-x-2">
        {visible.map((broker) => {
          const name =
            `${broker.firstName || ""} ${broker.lastName || ""}`.trim() ||
            broker.email ||
            "?";
          return (
            <span
              key={broker.id}
              className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-white dark:ring-slate-950 ${getAvatarTone(name)}`}
            >
              {getInitials(broker.firstName, broker.lastName)}
            </span>
          );
        })}
        {remaining > 0 ? (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-text-secondary ring-2 ring-white dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-950">
            +{remaining}
          </span>
        ) : null}
      </div>
      <span className="truncate text-xs text-text-secondary">
        {brokers.length === 1
          ? `${brokers[0].firstName || ""} ${brokers[0].lastName || ""}`.trim() ||
            brokers[0].email
          : `${brokers.length} assigned`}
      </span>
    </div>
  );
}

type OfficersPageTab = "officers" | "activity";

const PAGE_SIZE_OPTIONS = [10, 15, 25] as const;

export default function LoanOfficersPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { entitlements } = useBrokerEntitlements();
  const allowedPermissionKeys = entitlements?.permissions ?? null;
  const initialQuery = searchParams.get("q") || "";
  const activeTab: OfficersPageTab =
    searchParams.get("tab") === "activity" ? "activity" : "officers";
  const [activityOfficerId, setActivityOfficerId] = useState("");
  const [officers, setOfficers] = useState<LoanOfficer[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [listStats, setListStats] = useState({
    total: 0,
    active: 0,
    disabled: 0,
  });
  const [search, setSearch] = useState(initialQuery);

  // Strip legacy ?officer= from the URL; keep selection in React state only.
  useEffect(() => {
    if (!searchParams.has("officer")) return;
    const legacyOfficer = searchParams.get("officer") || "";
    if (legacyOfficer) setActivityOfficerId(legacyOfficer);
    const next = new URLSearchParams(searchParams);
    next.delete("officer");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Prefer navigation state when opening Activity from redirect/menu.
  useEffect(() => {
    const fromState = (location.state as { officerId?: string } | null)?.officerId;
    if (!fromState) return;
    setActivityOfficerId(fromState);
    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: null,
    });
  }, [location.state, location.pathname, location.search, navigate]);

  const setActiveTab = (tab: OfficersPageTab, officerId?: string) => {
    const next = new URLSearchParams(searchParams);
    next.delete("officer");
    if (tab === "activity") {
      next.set("tab", "activity");
      if (officerId) setActivityOfficerId(officerId);
    } else {
      next.delete("tab");
      setActivityOfficerId("");
    }
    setSearchParams(next, { replace: true });
  };
  const [formModal, setFormModal] = useState<{
    open: boolean;
    mode: "create" | "edit";
    officerId?: string;
  }>({ open: false, mode: "create" });
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [viewOfficer, setViewOfficer] = useState<LoanOfficer | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState<"" | "ACTIVE" | "DISABLED">("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [copyingInvite, setCopyingInvite] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement | null>(null);

  const openCreateModal = () => {
    setFormModal({ open: true, mode: "create" });
  };

  const handleCopyInviteLink = async () => {
    try {
      setCopyingInvite(true);
      const invite = await copyBrokerTeamInviteLink("LOAN_OFFICER");
      toast.success(
        `Invite link copied (expires in ${invite.expiresInHours}h)`,
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to create invite link");
    } finally {
      setCopyingInvite(false);
    }
  };

  const openEditModal = (o: LoanOfficer) => {
    setFormModal({ open: true, mode: "edit", officerId: o.id });
  };

  const closeFormModal = () => {
    setFormModal({ open: false, mode: "create" });
  };

  /* ================= STATUS ================= */
  const toggleStatus = async (id: string, status: string) => {
    try {
      setTogglingId(id);

      const newStatus = status === "ACTIVE" ? "DISABLED" : "ACTIVE";

      const res = await fetch(`${API_BASE}/broker/users/${id}/status`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.message || "Failed to update status");
        return;
      }

      toast.success("Status updated");
      closeRowMenu();
      fetchOfficers();
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setTogglingId(null);
    }
  };

  const getHeaders = () => {
    const token = sessionStorage.getItem("broker_token");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const handleImpersonate = async (officer: LoanOfficer) => {
    if (officer.status !== "ACTIVE") {
      toast.error("Only active loan officers can be accessed");
      return;
    }

    try {
      setImpersonatingId(officer.id);
      closeRowMenu();

      const res = await fetch(
        `${API_BASE}/broker/users/${officer.id}/impersonate`,
        {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({}),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to access loan officer portal");
      }

      const impersonateParams: Record<string, string> = {
        token: json.token,
        user: JSON.stringify(json.user),
        redirectTo: json.redirectTo || "/loan-officer/dashboard",
      };
      if (json.permissions?.length) {
        impersonateParams.permissions = JSON.stringify(json.permissions);
      }

      const portalUrl = buildImpersonatePortalUrl(
        "/loan-officer/impersonate",
        impersonateParams,
        json.portalBaseUrl || null,
      );
      const newTab = window.open(portalUrl, "_blank", "noopener,noreferrer");

      if (!newTab) {
        toast.error("Pop-up blocked. Allow pop-ups to open the loan officer portal.");
        return;
      }

      toast.success(
        `Opened portal for ${officer.firstName} ${officer.lastName}`,
      );
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to open loan officer portal",
      );
    } finally {
      setImpersonatingId(null);
    }
  };

  /* ================= FETCH ================= */

  const fetchOfficers = useCallback(async () => {
    try {
      setLoading(true);

      const queryParams = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        role: "BROKER_OFFICER",
        sortBy: sortKey,
        sortOrder: sortDir,
      });

      if (debouncedSearch) {
        queryParams.set("search", debouncedSearch);
      }

      if (statusFilter) {
        queryParams.set("status", statusFilter);
      }

      const res = await fetch(
        `${API_BASE}/broker/users?${queryParams.toString()}`,
        { headers: getHeaders() },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.message || "Failed to load loan officers");
        setOfficers([]);
        setTotal(0);
        setTotalPages(1);
        setListStats({ total: 0, active: 0, disabled: 0 });
        return;
      }

      setOfficers(json.data || []);
      setTotal(json.total ?? 0);
      setTotalPages(json.totalPages || 1);
      setListStats({
        total: json.stats?.total ?? json.total ?? 0,
        active: json.stats?.active ?? 0,
        disabled: json.stats?.disabled ?? 0,
      });

      if (page > (json.totalPages || 1) && (json.totalPages || 1) >= 1) {
        setPage(json.totalPages || 1);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load loan officers");
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, statusFilter, sortKey, sortDir]);

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
    const next = new URLSearchParams(window.location.search);
    next.delete("officer");
    const q = search.trim();
    if (q) next.set("q", q);
    else next.delete("q");
    const nextStr = next.toString();
    const currentStr = window.location.search.replace(/^\?/, "");
    if (nextStr !== currentStr) {
      setSearchParams(next, { replace: true });
    }
  }, [search, setSearchParams]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, sortKey, sortDir, limit]);

  useEffect(() => {
    if (activeTab !== "officers") return;
    fetchOfficers();
  }, [fetchOfficers, activeTab]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current?.contains(target) ||
        (target instanceof Element && target.closest("[data-menu-id]"))
      ) {
        return;
      }
      setActiveMenuId(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveMenuId(null);
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

  const openRowMenu = (id: string, event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setMenuPos(computeActionMenuPosition(event.currentTarget.getBoundingClientRect()));
    setActiveMenuId((current) => (current === id ? null : id));
  };

  const closeRowMenu = () => setActiveMenuId(null);

  const activeMenuUser = useMemo(
    () => officers.find((o) => o.id === activeMenuId) ?? null,
    [officers, activeMenuId],
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "createdAt" ? "desc" : "asc");
    }
  };

  /* ================= DELETE ================= */

  // const handleDelete = async (id: string) => {
  //   const isDark = document.documentElement.classList.contains("dark");

  //   const result = await Swal.fire({
  //     title: "Are you sure?",
  //     text: "This Loan Officer will be permanently deleted!",
  //     icon: "warning",
  //     showCancelButton: true,
  //     confirmButtonColor: "#dc2626",
  //     cancelButtonColor: "#6b7280",
  //     confirmButtonText: "Yes, Delete",
  //     cancelButtonText: "Cancel",

  //     background: isDark ? "#1e293b" : "#ffffff",
  //     color: isDark ? "#e2e8f0" : "#1e293b",

  //     customClass: {
  //       popup: "rounded-2xl",
  //       container: "swal-high-zindex",
  //     },
  //   });

  //   if (!result.isConfirmed) return;

  //   closeRowMenu();
  //   const token = sessionStorage.getItem("broker_token");
  //   try {
  //     await fetch(`${API_BASE}/broker/users/${id}`, {
  //       method: "DELETE",
  //       headers: { Authorization: `Bearer ${token}` },
  //     });

  //     await Swal.fire({
  //       title: "Deleted!",
  //       text: "Loan Officer has been deleted successfully.",
  //       icon: "success",
  //       timer: 1500,
  //       showConfirmButton: false,
  //       background: isDark ? "#1e293b" : "#ffffff",
  //       color: isDark ? "#e2e8f0" : "#1e293b",
  //       customClass: {
  //         popup: "rounded-2xl",
  //         container: "swal-high-zindex",
  //       },
  //     });

  //     fetchOfficers();
  //   } catch (error) {
  //     Swal.fire({
  //       title: "Error",
  //       text: "Something went wrong!",
  //       icon: "error",
  //     });
  //   }
  // };

  // const getPermissionLabel = (key: string) => {
  //   for (const group of PERMISSIONS) {
  //     const found = group.items.find((i) => i.key === key);
  //     if (found) return found.label;
  //   }
  //   return key;
  // };

  // const isDark = document.documentElement.classList.contains("dark");

  // const customSelectStyles = {
  //   control: (base: any, state: any) => ({
  //     ...base,
  //     backgroundColor: isDark ? "#0f172a" : "#ffffff",
  //     borderColor: state.isFocused ? "#6366f1" : isDark ? "#334155" : "#cbd5f5",
  //     boxShadow: "none",
  //     minHeight: "42px",
  //     borderRadius: "10px",
  //     padding: "2px",
  //     ":hover": {
  //       borderColor: "#6366f1",
  //     },
  //   }),

  //   menu: (base: any) => ({
  //     ...base,
  //     backgroundColor: isDark ? "#0f172a" : "#ffffff",
  //     border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
  //     borderRadius: "10px",
  //     overflow: "hidden",
  //     zIndex: 9999,
  //   }),

  //   option: (base: any, state: any) => ({
  //     ...base,
  //     backgroundColor: state.isFocused
  //       ? isDark
  //         ? "#1e293b"
  //         : "#f1f5f9"
  //       : "transparent",
  //     color: isDark ? "#e2e8f0" : "#0f172a",
  //     cursor: "pointer",
  //   }),

  //   multiValue: (base: any) => ({
  //     ...base,
  //     backgroundColor: isDark ? "#1e293b" : "#e2e8f0",
  //     borderRadius: "6px",
  //   }),

  //   multiValueLabel: (base: any) => ({
  //     ...base,
  //     color: isDark ? "#e2e8f0" : "#0f172a",
  //   }),

  //   multiValueRemove: (base: any) => ({
  //     ...base,
  //     color: isDark ? "#94a3b8" : "#475569",
  //     ":hover": {
  //       backgroundColor: isDark ? "#334155" : "#cbd5f5",
  //       color: isDark ? "#fff" : "#000",
  //     },
  //   }),

  //   input: (base: any) => ({
  //     ...base,
  //     color: isDark ? "#e2e8f0" : "#0f172a",
  //   }),

  //   placeholder: (base: any) => ({
  //     ...base,
  //     color: isDark ? "#94a3b8" : "#64748b",
  //   }),

  //   singleValue: (base: any) => ({
  //     ...base,
  //     color: isDark ? "#e2e8f0" : "#0f172a",
  //   }),
  // };

  return (
    <>
      <PageMeta
        title={
          activeTab === "activity"
            ? "Loan Officer Activity | Broker Dashboard"
            : "Loan Officers | Broker Dashboard"
        }
        description="Manage loan officers and monitor team activity"
      />

      <div className="w-full min-w-0 space-y-4 pb-4 text-text-primary dark:text-slate-100">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="ds-page-title">Loan Officers</h1>
            <p className="ds-page-subtitle">
              {activeTab === "activity"
                ? "Track applications, contacts, messages, and profile updates across your team."
                : "Manage and monitor your loan officer team."}
            </p>
          </div>
          {activeTab === "officers" ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyInviteLink}
                disabled={copyingInvite}
                className="ds-btn-secondary h-10 px-4 text-sm disabled:opacity-60"
              >
                <Link2
                  className={`h-4 w-4 ${copyingInvite ? "animate-pulse" : ""}`}
                />
                {copyingInvite ? "Creating..." : "Copy invite link"}
              </button>
              <button
                type="button"
                onClick={openCreateModal}
                className="ds-btn-primary shrink-0"
              >
                <Plus size={16} />
                Add loan officer
              </button>
            </div>
          ) : null}
        </div>

        {activeTab === "officers" ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <StatPill
              icon={<Users size={14} />}
              label="Total"
              value={listStats.total}
              color="blue"
              loading={loading && listStats.total === 0}
              active={statusFilter === ""}
              onClick={() => {
                setStatusFilter("");
                setPage(1);
              }}
            />
            <StatPill
              icon={<UserCheck size={14} />}
              label="Active"
              value={listStats.active}
              color="emerald"
              loading={loading && listStats.total === 0}
              active={statusFilter === "ACTIVE"}
              onClick={() => {
                setStatusFilter("ACTIVE");
                setPage(1);
              }}
            />
            <StatPill
              icon={<UserX size={14} />}
              label="Suspended"
              value={listStats.disabled}
              color="rose"
              loading={loading && listStats.total === 0}
              active={statusFilter === "DISABLED"}
              onClick={() => {
                setStatusFilter("DISABLED");
                setPage(1);
              }}
            />
          </div>
        ) : null}

        <div className="inline-flex w-full gap-1 rounded-xl border border-border bg-white p-1 dark:border-slate-700 dark:bg-slate-950 sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab("officers")}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition sm:flex-none ${
              activeTab === "officers"
                ? "bg-[#4C78F5] text-white"
                : "text-text-secondary hover:bg-surface hover:text-[#4C78F5] dark:text-slate-300 dark:hover:bg-slate-900"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Officers
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("activity")}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition sm:flex-none ${
              activeTab === "activity"
                ? "bg-[#4C78F5] text-white"
                : "text-text-secondary hover:bg-surface hover:text-[#4C78F5] dark:text-slate-300 dark:hover:bg-slate-900"
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            Activity
          </button>
        </div>

        {activeTab === "activity" ? (
          <LoanOfficerActivityPanel
            embedded
            initialOfficerId={activityOfficerId}
          />
        ) : (
        <>
        <div className="overflow-hidden rounded-2xl border border-border bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-2.5 border-b border-border px-4 py-3.5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-center lg:min-w-0 lg:flex-1">
              <div className="group relative w-full sm:max-w-sm">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-secondary transition-colors group-focus-within:text-[#4C78F5]" />
                <input
                  type="text"
                  placeholder="Search loan officers..."
                  className="h-10 w-full rounded-xl border border-border bg-white py-2 pr-9 pl-10 text-sm text-text-primary outline-none transition placeholder:text-text-secondary/70 focus:border-[#4C78F5]/50 focus:ring-2 focus:ring-[#4C78F5]/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
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

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as "" | "ACTIVE" | "DISABLED")
                }
                className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-text-primary outline-none transition focus:border-[#4C78F5]/50 focus:ring-2 focus:ring-[#4C78F5]/15 sm:w-[160px] dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="DISABLED">Suspended</option>
              </select>

              <button
                type="button"
                onClick={() => fetchOfficers()}
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
              onChange={(e) => setLimit(Number(e.target.value))}
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
                  <th className="hidden md:table-cell">Co-Brokers</th>
                  <th className="hidden lg:table-cell">Access</th>
                  <th>
                    <SortHeader
                      label="Status"
                      active={sortKey === "status"}
                      direction={sortDir}
                      onClick={() => toggleSort("status")}
                    />
                  </th>
                  <th className="!text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && !isSearching ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-14 text-center">
                      <div className="inline-flex items-center gap-2 text-sm text-text-secondary">
                        <Users className="h-4 w-4 animate-pulse text-[#4C78F5]" />
                        Loading loan officers…
                      </div>
                    </td>
                  </tr>
                ) : !loading && officers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="!px-5 !py-14 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#4C78F5]/10 text-[#4C78F5]">
                        <Users className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-semibold text-text-primary">
                        {search || statusFilter
                          ? "No loan officers match your filters"
                          : "No loan officers yet"}
                      </p>
                      <p className="mx-auto mt-1.5 max-w-sm text-xs text-text-secondary">
                        {search || debouncedSearch || statusFilter
                          ? "Try a different search term or status filter."
                          : "Add your first loan officer to get started."}
                      </p>
                      {!search && !debouncedSearch && !statusFilter ? (
                        <button
                          type="button"
                          onClick={openCreateModal}
                          className="ds-btn-primary mt-4 h-9 px-4 text-xs"
                        >
                          <Plus size={14} />
                          Add loan officer
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSearch("");
                            setStatusFilter("");
                            setPage(1);
                          }}
                          className="mt-4 text-xs font-semibold text-[#4C78F5] hover:underline"
                        >
                          Clear filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  officers.map((o) => {
                    const fullName = `${o.firstName} ${o.lastName}`.trim();
                    const isActive = o.status === "ACTIVE";
                    const busy = togglingId === o.id;

                    return (
                      <tr key={o.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            {o.profile?.avatarUrl ? (
                              <img
                                src={`${API_BASE}${o.profile.avatarUrl}`}
                                alt={fullName}
                                className="h-9 w-9 shrink-0 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4C78F5] text-[11px] font-semibold text-white">
                                {getInitials(o.firstName, o.lastName)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="ds-table-title">{fullName || "Unnamed"}</p>
                              <p className="ds-table-meta">{o.email || "No email"}</p>
                              {o.phone ? (
                                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-text-secondary/80 sm:hidden">
                                  <Phone className="h-3 w-3" />
                                  {formatPhone(o.phone)}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>

                        <td className="hidden sm:table-cell">
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                            <Shield className="h-3 w-3" />
                            Loan Officer
                          </span>
                        </td>

                        <td className="hidden min-w-0 md:table-cell">
                          {o.assignedCoBrokers?.length ? (
                            <CoBrokerBadge brokers={o.assignedCoBrokers} />
                          ) : (
                            <span className="text-[12px] font-medium italic text-text-secondary/70">
                              None
                            </span>
                          )}
                        </td>

                        <td className="hidden lg:table-cell">
                          <AccessBadge
                            permissions={o.permissions}
                            allowedKeys={allowedPermissionKeys}
                          />
                        </td>

                        <td>
                          <StatusPill active={isActive} />
                        </td>

                        <td className="text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => toggleStatus(o.id, o.status)}
                              className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition disabled:opacity-50 ${
                                isActive
                                  ? "border border-border bg-white text-text-secondary hover:bg-surface dark:border-slate-700 dark:bg-slate-950"
                                  : "bg-[#4C78F5] text-white hover:bg-[#3B66E0]"
                              }`}
                            >
                              <Lock className="h-3.5 w-3.5" />
                              {busy
                                ? "Updating…"
                                : isActive
                                  ? "Suspend"
                                  : "Activate"}
                            </button>
                            <button
                              type="button"
                              data-menu-id={o.id}
                              onClick={(event) => openRowMenu(o.id, event)}
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
                                activeMenuId === o.id
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

          {!loading && !isSearching && officers.length > 0 ? (
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

                  {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                    const half = Math.floor(5 / 2);
                    let startPage = 1;
                    if (totalPages <= 5) startPage = 1;
                    else if (page <= half + 1) startPage = 1;
                    else if (page >= totalPages - half) startPage = totalPages - 4;
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
                  })}

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
        </>
        )}
      </div>

      {activeMenuUser &&
        activeMenuId &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: menuPos.top, left: menuPos.left }}
            className="z-[9999] max-h-[min(232px,calc(100vh-16px))] w-[168px] overflow-y-auto rounded-xl border border-border bg-white dark:border-slate-700 dark:bg-slate-950"
          >
            <div className="border-b border-border px-3 py-2 dark:border-slate-800">
              <p className="truncate text-[11px] font-semibold text-text-primary dark:text-white">
                {activeMenuUser.firstName} {activeMenuUser.lastName}
              </p>
              <p className="truncate text-[10px] text-text-secondary">
                {activeMenuUser.email}
              </p>
            </div>

            <div className="py-0.5">
              <button
                type="button"
                onClick={() => {
                  closeRowMenu();
                  setActiveTab("activity", activeMenuUser.id);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-primary transition hover:bg-[#4C78F5]/[0.06] dark:text-slate-200 dark:hover:bg-slate-900"
              >
                <Activity className="h-3.5 w-3.5 text-[#4C78F5]" />
                Activity
              </button>
              <button
                type="button"
                onClick={() => {
                  closeRowMenu();
                  setViewOfficer(activeMenuUser);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-primary transition hover:bg-[#4C78F5]/[0.06] dark:text-slate-200 dark:hover:bg-slate-900"
              >
                <Eye className="h-3.5 w-3.5 text-[#4C78F5]" />
                View details
              </button>
              <button
                type="button"
                disabled={
                  impersonatingId === activeMenuUser.id ||
                  activeMenuUser.status !== "ACTIVE"
                }
                onClick={() => handleImpersonate(activeMenuUser)}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-primary transition hover:bg-[#4C78F5]/[0.06] disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                <ExternalLink className="h-3.5 w-3.5 text-[#4C78F5]" />
                {impersonatingId === activeMenuUser.id
                  ? "Opening portal..."
                  : "Access portal"}
              </button>
              <button
                type="button"
                onClick={() => {
                  closeRowMenu();
                  openEditModal(activeMenuUser);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-primary transition hover:bg-[#4C78F5]/[0.06] dark:text-slate-200 dark:hover:bg-slate-900"
              >
                <Pencil className="h-3.5 w-3.5 text-amber-600" />
                Edit Profile
              </button>
              <button
                type="button"
                disabled={togglingId === activeMenuUser.id}
                onClick={() => toggleStatus(activeMenuUser.id, activeMenuUser.status)}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-primary transition hover:bg-[#4C78F5]/[0.06] disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                <Power
                  className={`h-3.5 w-3.5 ${
                    activeMenuUser.status === "ACTIVE"
                      ? "text-emerald-600"
                      : "text-text-secondary"
                  }`}
                />
                {activeMenuUser.status === "ACTIVE" ? "Suspend" : "Activate"}
              </button>
            </div>

            {/* <div className="border-t border-gray-100 py-0.5 dark:border-gray-800">
              <button
                type="button"
                onClick={() => handleDelete(activeMenuUser.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div> */}
          </div>,
          document.body,
        )}

      <LoanOfficerFormModal
        isOpen={formModal.open}
        mode={formModal.mode}
        officerId={formModal.officerId}
        onClose={closeFormModal}
        onSaved={fetchOfficers}
      />

      {viewOfficer && (
        <ViewLoanOfficerModal
          officerId={viewOfficer.id}
          fallback={viewOfficer}
          onClose={() => setViewOfficer(null)}
        />
      )}
    </>
  );
}
