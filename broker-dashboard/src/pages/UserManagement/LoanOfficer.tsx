import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  Mail,
  Pencil,
  Phone,
  Plus,
  Power,
  RefreshCw,
  Search,
  Shield,
  MoreVertical,
  UserCheck,
  Users,
  UserX,
  Activity,
  ExternalLink,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
// import Swal from "sweetalert2";
// import Select from "react-select";
import PageMeta from "../../components/common/PageMeta";
import ViewLoanOfficerModal from "./ViewLoanOfficerModal";
import { formatPhone, normalizeLoanOfficerPermissions, LO_HIDDEN_PERMISSION_KEYS, countGrantedLoPermissionUiSlots, getLoPermissionUiSlotTotal } from "./loanOfficerShared";
import { buildImpersonatePortalUrl } from "../../lib/impersonateUrl";
import LoanOfficerFormModal from "../../components/loanOfficer/LoanOfficerFormModal";

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
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
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

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTeamAssignments(
  members?: { firstName?: string; lastName?: string; email?: string }[],
) {
  if (!members?.length) return "—";
  const names = members
    .map((member) => `${member.firstName || ""} ${member.lastName || ""}`.trim())
    .filter(Boolean);
  if (!names.length) return "—";
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1}`;
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

function OfficerStatusBadge({
  active,
  loading,
  onClick,
}: {
  active: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      title="Click to toggle status"
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50 ${
        active
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30"
          : "bg-slate-100 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-emerald-500" : "bg-slate-400"
        }`}
      />
      {loading ? "Updating..." : active ? "Active" : "Disabled"}
    </button>
  );
}

function PermissionsBadge({ permissions }: { permissions?: string[] }) {
  const visibleGranted = normalizeLoanOfficerPermissions(permissions || []).filter(
    (key) => !LO_HIDDEN_PERMISSION_KEYS.includes(key),
  );
  const slotCount = countGrantedLoPermissionUiSlots(permissions || []);
  const total = getLoPermissionUiSlotTotal();

  if (!visibleGranted.length) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20">
        No permissions
      </span>
    );
  }

  return (
    <span
      title={`${slotCount} of ${total} permissions granted`}
      className="inline-flex items-center gap-1 rounded-full bg-[#13538A]/10 px-2.5 py-1 text-xs font-semibold text-[#13538A] ring-1 ring-[#13538A]/15 dark:bg-[#13538A]/20 dark:text-cyan-300"
    >
      <Shield className="h-3 w-3" />
      {slotCount}/{total}
    </span>
  );
}

function CoBrokerBadge({
  label,
  title,
}: {
  label: string;
  title?: string;
}) {
  if (label === "—") {
    return <span className="text-sm text-gray-400">—</span>;
  }

  return (
    <span
      title={title}
      className="inline-flex max-w-[140px] items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
    >
      <Users className="mr-1 h-3 w-3 shrink-0 text-gray-400" />
      <span className="truncate">{label}</span>
    </span>
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
  tone?: "blue" | "emerald" | "slate";
}) {
  const tones = {
    blue: "border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300",
    emerald:
      "border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
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

export default function LoanOfficersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [officers, setOfficers] = useState<LoanOfficer[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [listStats, setListStats] = useState({
    total: 0,
    active: 0,
    disabled: 0,
  });
  const [search, setSearch] = useState(initialQuery);
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
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement | null>(null);

  const openCreateModal = () => {
    setFormModal({ open: true, mode: "create" });
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
        return;
      }

      setOfficers(json.data || []);
      setTotal(json.total ?? 0);
      setTotalPages(json.totalPages || 1);

      if (json.stats) {
        setListStats({
          total: json.stats.total ?? 0,
          active: json.stats.active ?? 0,
          disabled: json.stats.disabled ?? 0,
        });
      }

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
    const q = search.trim();
    if (q) {
      setSearchParams({ q }, { replace: true });
    } else if (searchParams.has("q")) {
      setSearchParams({}, { replace: true });
    }
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, sortKey, sortDir]);

  useEffect(() => {
    fetchOfficers();
  }, [fetchOfficers]);

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

  const stats = listStats;

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
      <PageMeta title="Loan Officers | Broker Dashboard" description="Manage loan officers" />

      <div className="space-y-5 pb-6">
        {/* Page header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
              User Management
            </p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Loan Officers
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-xl">
              Manage and monitor your loan officer team.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <StatChip icon={<Users className="h-3.5 w-3.5" />} label="Total" value={stats.total} />
            <StatChip
              icon={<UserCheck className="h-3.5 w-3.5" />}
              label="Active"
              value={stats.active}
              tone="emerald"
            />
            <StatChip
              icon={<UserX className="h-3.5 w-3.5" />}
              label="Disabled"
              value={stats.disabled}
              tone="slate"
            />
          </div>
        </div>

        {/* Toolbar + table card */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white  dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-4 py-4 dark:border-gray-800 sm:px-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-1 sm:min-w-0">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    placeholder="Search loan officers..."
                    className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-9 text-sm outline-none focus:border-[#13538A]/40 focus:ring-2 focus:ring-[#13538A]/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
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

                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                  {(["", "ACTIVE", "DISABLED"] as const).map((value) => (
                    <button
                      key={value || "all"}
                      type="button"
                      onClick={() => setStatusFilter(value)}
                      className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        statusFilter === value
                          ? "bg-[#13538A] text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                      }`}
                    >
                      {value === "" ? "All" : value === "ACTIVE" ? "Active" : "Disabled"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchOfficers()}
                  disabled={loading || isSearching}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </button>

                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#13538A] px-4 text-sm font-semibold text-white hover:bg-[#1a6aad]"
                >
                  <Plus className="h-4 w-4" />
                  Create Loan Officer
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/50 px-4 py-2.5 dark:border-gray-800 dark:bg-gray-800/30 sm:px-5">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {loading || isSearching ? (
                isSearching ? "Searching..." : "Loading team members..."
              ) : (
                <>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {total}
                  </span>{" "}
                  loan officer{total === 1 ? "" : "s"}
                  {debouncedSearch ? ` matching "${debouncedSearch}"` : ""}
                  {statusFilter
                    ? ` · ${statusFilter === "ACTIVE" ? "Active" : "Disabled"}`
                    : ""}
                </>
              )}
            </p>
            {!loading && !isSearching && officers.length > 0 && (
              <p className="text-xs text-gray-400">
                Sorted by{" "}
                <span className="font-medium text-gray-600 dark:text-gray-300">
                  {sortKey === "createdAt" ? "date created" : sortKey}
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
                  <div className="h-10 w-10 rounded-xl bg-gray-100 dark:bg-gray-800" />
                  <div className="h-4 flex-1 max-w-[180px] rounded bg-gray-100 dark:bg-gray-800" />
                  <div className="hidden h-4 w-40 rounded bg-gray-100 dark:bg-gray-800 md:block" />
                  <div className="hidden h-6 w-20 rounded-full bg-gray-100 dark:bg-gray-800 sm:block" />
                  <div className="ml-auto h-8 w-8 rounded-lg bg-gray-100 dark:bg-gray-800" />
                </div>
              ))}
            </div>
          ) : !loading && officers.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#13538A]/10 text-[#13538A]">
                <Users size={24} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {search || statusFilter ? "No matching loan officers" : "No loan officers yet"}
              </h3>
              <p className="mt-1 max-w-md text-sm text-gray-500">
                {search || debouncedSearch || statusFilter
                  ? "Try adjusting your search or status filter."
                  : "Create your first loan officer to start building your team."}
              </p>
              {!search && !debouncedSearch && !statusFilter && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#13538A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a6aad]"
                >
                  <Plus className="h-4 w-4" />
                  Create Loan Officer
                </button>
              )}
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
                        label="Status"
                        active={sortKey === "status"}
                        direction={sortDir}
                        onClick={() => toggleSort("status")}
                      />
                    </th>
                    <th className="hidden px-4 py-3 text-left lg:table-cell">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Co-Brokers
                      </span>
                    </th>
                    <th className="hidden px-4 py-3 text-left xl:table-cell">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Permissions
                      </span>
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
                  {officers.map((o, index) => {
                    const fullName = `${o.firstName} ${o.lastName}`.trim();
                    const isActive = o.status === "ACTIVE";
                    const coBrokerLabel = formatTeamAssignments(o.assignedCoBrokers);
                    const coBrokerTitle = getTeamAssignmentTitle(o.assignedCoBrokers);

                    return (
                      <tr
                        key={o.id}
                        className={`group transition-colors ${
                          isActive
                            ? "hover:bg-[#13538A]/[0.03] dark:hover:bg-gray-800/40"
                            : "bg-gray-50/40 hover:bg-gray-100/60 dark:bg-gray-900/20 dark:hover:bg-gray-800/40"
                        }`}
                      >
                        <td className="px-4 py-3.5 text-sm font-medium tabular-nums text-gray-400">
                          {(page - 1) * limit + index + 1}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 ring-gray-200/80 dark:ring-gray-700">
                              {o.profile?.avatarUrl ? (
                                <img
                                  src={`${API_BASE}${o.profile.avatarUrl}`}
                                  alt={fullName}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span
                                  className={`flex h-full w-full items-center justify-center text-xs font-bold ${getAvatarTone(fullName)}`}
                                >
                                  {getInitials(o.firstName, o.lastName)}
                                </span>
                              )}
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-gray-900 ${
                                  isActive ? "bg-emerald-500" : "bg-gray-400"
                                }`}
                              />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {fullName}
                              </p>
                              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                {o.profile?.agentType || "Loan Officer"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <a
                            href={`mailto:${o.email}`}
                            className="inline-flex max-w-[220px] items-center gap-2 text-sm text-gray-600 transition hover:text-[#13538A] dark:text-gray-300 dark:hover:text-cyan-400 xl:max-w-none"
                            title={o.email}
                          >
                            <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                            <span className="truncate">{o.email}</span>
                          </a>
                        </td>

                        <td className="hidden px-4 py-3.5 md:table-cell">
                          {o.phone ? (
                            <a
                              href={`tel:${o.phone}`}
                              className="inline-flex items-center gap-2 text-sm text-gray-600 transition hover:text-[#13538A] dark:text-gray-300 dark:hover:text-cyan-400 whitespace-nowrap"
                            >
                              <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                              {formatPhone(o.phone)}
                            </a>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <OfficerStatusBadge
                            active={isActive}
                            loading={togglingId === o.id}
                            onClick={() => toggleStatus(o.id, o.status)}
                          />
                        </td>

                        <td className="hidden px-4 py-3.5 lg:table-cell">
                          <CoBrokerBadge label={coBrokerLabel} title={coBrokerTitle} />
                        </td>

                        <td className="hidden px-4 py-3.5 xl:table-cell">
                          <PermissionsBadge permissions={o.permissions} />
                        </td>

                        <td className="hidden px-4 py-3.5 sm:table-cell">
                          <span className="text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                            {formatDate(o.createdAt)}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setViewOfficer(o)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-gray-400 transition hover:border-gray-200 hover:bg-white hover:text-[#13538A] dark:hover:border-gray-700 dark:hover:bg-gray-800 dark:hover:text-cyan-400 sm:opacity-0 sm:group-hover:opacity-100"
                              title="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              data-menu-id={o.id}
                              onClick={(event) => openRowMenu(o.id, event)}
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                                activeMenuId === o.id
                                  ? "border-[#13538A]/30 bg-[#13538A]/5 text-[#13538A] dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-400"
                                  : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:bg-gray-800 dark:hover:text-white"
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
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !isSearching && officers.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50/60 px-4 py-3 dark:border-gray-800 dark:bg-gray-900/50 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing{" "}
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {total === 0 ? 0 : (page - 1) * limit + 1}–
                  {Math.min(page * limit, total)}
                </span>{" "}
                of {total} loan officer{total === 1 ? "" : "s"}
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

        {/* Pagination — standalone when table footer hidden */}
        {totalPages > 1 && (loading || officers.length === 0) && (
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

      {activeMenuUser &&
        activeMenuId &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: menuPos.top, left: menuPos.left }}
            className="z-[9999] w-[168px] max-h-[min(232px,calc(100vh-16px))] overflow-y-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-800">
              <p className="truncate text-[11px] font-semibold text-gray-900 dark:text-white">
                {activeMenuUser.firstName} {activeMenuUser.lastName}
              </p>
              <p className="truncate text-[10px] text-gray-500">{activeMenuUser.email}</p>
            </div>

            <div className="py-0.5">
              <button
                type="button"
                onClick={() => {
                  closeRowMenu();
                  navigate("/loan-officer-activity", {
                    state: { officerId: activeMenuUser.id },
                  });
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <Activity className="h-3.5 w-3.5 text-sky-600" />
                Activity
              </button>
              <button
                type="button"
                onClick={() => {
                  closeRowMenu();
                  setViewOfficer(activeMenuUser);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <Eye className="h-3.5 w-3.5 text-[#13538A]" />
                View details
              </button>
              <button
                type="button"
                disabled={
                  impersonatingId === activeMenuUser.id ||
                  activeMenuUser.status !== "ACTIVE"
                }
                onClick={() => handleImpersonate(activeMenuUser)}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <ExternalLink className="h-3.5 w-3.5 text-cyan-600" />
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
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <Pencil className="h-3.5 w-3.5 text-amber-600" />
                Edit Profile
              </button>
              <button
                type="button"
                disabled={togglingId === activeMenuUser.id}
                onClick={() => toggleStatus(activeMenuUser.id, activeMenuUser.status)}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <Power
                  className={`h-3.5 w-3.5 ${
                    activeMenuUser.status === "ACTIVE" ? "text-emerald-600" : "text-gray-500"
                  }`}
                />
                {activeMenuUser.status === "ACTIVE" ? "Disable" : "Enable"}
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
