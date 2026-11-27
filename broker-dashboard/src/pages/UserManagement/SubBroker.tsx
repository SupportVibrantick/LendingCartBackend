import {
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  Eye,
  Link2,
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
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import PageMeta from "../../components/common/PageMeta";
import StatPill from "../../components/common/StatPill";
import CoBrokerFormModal from "../../components/coBroker/CoBrokerFormModal";
import CoBrokerDetailsModal from "../../components/coBroker/CoBrokerDetailsModal";
import type { CoBrokerDetail } from "../../lib/coBrokerForm";
import { buildImpersonatePortalUrl } from "../../lib/impersonateUrl";
import { getBrokerAuthHeaders } from "../../lib/brokerApi";
import { hasPermission } from "../../lib/brokerPermissions";
import { isLoanOfficerPortalPath } from "../../lib/portalAuth";
import { copyBrokerTeamInviteLink } from "../../lib/brokerTeamInvite";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const SEARCH_DEBOUNCE_MS = 400;

interface SubBrokerUser extends CoBrokerDetail {
  createdById: string | null;
}

function getAuthHeaders(options?: { json?: boolean }): Record<string, string> {
  return getBrokerAuthHeaders(Boolean(options?.json));
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function getInitials(first?: string, last?: string) {
  return (
    `${first?.charAt(0) || ""}${last?.charAt(0) || ""}`.toUpperCase() || "?"
  );
}

function formatTeamAssignments(
  members?: { firstName?: string; lastName?: string; email?: string }[],
) {
  if (!members?.length) return "";
  const names = members
    .map((member) =>
      `${member.firstName || ""} ${member.lastName || ""}`.trim(),
    )
    .filter(Boolean);
  if (!names.length) return "";
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
const ACTION_MENU_HEIGHT = 236;

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

function LoanOfficerCell({
  label,
  title,
}: {
  label: string;
  title?: string;
}) {
  if (!label) {
    return (
      <span className="text-[12px] font-medium italic text-text-secondary/70">
        None
      </span>
    );
  }

  return (
    <span
      title={title}
      className="block max-w-[180px] truncate text-sm text-text-primary dark:text-slate-200"
    >
      {label}
    </span>
  );
}

const PAGE_SIZE_OPTIONS = [10, 15, 25] as const;

export default function SubBroker() {
  const isLoPortal = isLoanOfficerPortalPath();
  const canAccessCoBrokerPortal =
    !isLoPortal || hasPermission("ACCESS_CO_BROKER_PORTAL", "loanOfficer");
  const canEditCoBrokers =
    !isLoPortal || hasPermission("EDIT_CO_BROKERS", "loanOfficer");
  const canDisableCoBrokers =
    !isLoPortal || hasPermission("DISABLE_CO_BROKERS", "loanOfficer");
  // const canDeleteCoBrokers =
  //   !isLoPortal || hasPermission("DELETE_CO_BROKERS", "loanOfficer");

  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [officers, setOfficers] = useState<SubBrokerUser[]>([]);
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
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState<"" | "ACTIVE" | "DISABLED">(
    "",
  );
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [formModalMode, setFormModalMode] = useState<"create" | "edit">(
    "create",
  );
  const [editSubBrokerId, setEditSubBrokerId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [viewSubBroker, setViewSubBroker] = useState<SubBrokerUser | null>(
    null,
  );
  const [viewLoading, setViewLoading] = useState(false);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [copyingInvite, setCopyingInvite] = useState(false);
  // const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const fetchOfficers = useCallback(async () => {
    try {
      setLoading(true);

      const queryParams = new URLSearchParams({
        page: String(page),
        limit: String(limit),
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
        `${API_BASE}/broker/sub-broker/list?${queryParams.toString()}`,
        { headers: getAuthHeaders() },
      );
      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.message || "Failed to fetch Co Brokers");
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
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, statusFilter, sortKey, sortDir]);

  const isSearching = search.trim() !== debouncedSearch;

  useEffect(() => {
    const handler = window.setTimeout(() => {
      const next = search.trim();
      setDebouncedSearch((prev) => {
        if (prev !== next) {
          setPage(1);
        }
        return next;
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(handler);
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

      const rect = btn.getBoundingClientRect();
      setMenuPos(computeActionMenuPosition(rect));
    };

    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);

    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [activeMenuId]);

  const openRowMenu = (
    id: string,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
    setMenuPos(
      computeActionMenuPosition(event.currentTarget.getBoundingClientRect()),
    );
    setActiveMenuId((current) => (current === id ? null : id));
  };

  const closeRowMenu = () => setActiveMenuId(null);

  useEffect(() => {
    if (!formModalOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeFormModal();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [formModalOpen]);

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

  const handleImpersonate = async (officer: SubBrokerUser) => {
    if (!canAccessCoBrokerPortal) {
      toast.error("You don't have permission to access co-broker portals");
      return;
    }
    if (officer.status !== "ACTIVE") {
      toast.error("Only active co-brokers can be accessed");
      return;
    }

    try {
      setImpersonatingId(officer.id);
      closeRowMenu();

      const res = await fetch(
        `${API_BASE}/broker/sub-broker/${officer.id}/impersonate`,
        {
          method: "POST",
          headers: getAuthHeaders({ json: true }),
          body: JSON.stringify({}),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to access co-broker portal");
      }

      const impersonateParams: Record<string, string> = {
        token: json.token,
        user: JSON.stringify(json.user),
        redirectTo: json.redirectTo || "/sub-broker/dashboard",
      };
      if (json.branding) {
        impersonateParams.branding = JSON.stringify(json.branding);
      }

      const portalUrl = buildImpersonatePortalUrl(
        "/sub-broker/impersonate",
        impersonateParams,
        json.portalBaseUrl || null,
      );
      const newTab = window.open(portalUrl, "_blank", "noopener,noreferrer");

      if (!newTab) {
        toast.error(
          "Pop-up blocked. Allow pop-ups to open the co-broker portal.",
        );
        return;
      }

      const displayName =
        `${officer.firstName || ""} ${officer.lastName || ""}`.trim() ||
        officer.email;
      toast.success(`Opened portal for ${displayName}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to access co-broker portal");
    } finally {
      setImpersonatingId(null);
    }
  };

  const confirmSuspendCoBroker = async (displayName: string) => {
    const safeName = displayName
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

    const result = await Swal.fire({
      icon: "warning",
      title: "Suspend co-broker?",
      html: `<div style="text-align:left;font-size:14px;line-height:1.45;color:#334155">
        <p style="margin:0 0 10px">You are about to suspend <strong>${safeName}</strong>.</p>
        <p style="margin:0 0 10px">They will lose portal access until reactivated.</p>
        <p style="margin:0;font-weight:600">Type <span style="font-family:ui-monospace,monospace;color:#b91c1c">SUSPEND</span> to confirm.</p>
      </div>`,
      input: "text",
      inputPlaceholder: "Type SUSPEND",
      inputAttributes: {
        autocapitalize: "characters",
        autocomplete: "off",
        spellcheck: "false",
      },
      showCancelButton: true,
      focusCancel: true,
      confirmButtonText: "Suspend",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc2626",
      reverseButtons: true,
      inputValidator: (value) => {
        if ((value || "").trim() !== "SUSPEND") {
          return "Type SUSPEND to confirm";
        }
        return null;
      },
    });

    return result.isConfirmed;
  };

  const toggleStatus = async (
    id: string,
    currentStatus: string,
    displayName?: string,
  ) => {
    if (!canDisableCoBrokers) {
      toast.error("You don't have permission to disable co-brokers");
      return;
    }

    const newStatus = currentStatus === "ACTIVE" ? "DISABLED" : "ACTIVE";
    const broker = officers.find((o) => o.id === id);
    const name =
      displayName?.trim() ||
      `${broker?.firstName || ""} ${broker?.lastName || ""}`.trim() ||
      broker?.email ||
      "this co-broker";

    if (newStatus === "DISABLED") {
      const confirmed = await confirmSuspendCoBroker(name);
      if (!confirmed) return;
    }

    try {
      setTogglingId(id);

      const res = await fetch(`${API_BASE}/broker/sub-broker/${id}/status`, {
        method: "PATCH",
        headers: getAuthHeaders({ json: true }),
        body: JSON.stringify({ status: newStatus }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || "Failed to update status");
        return;
      }

      toast.success(
        `Co broker ${newStatus === "ACTIVE" ? "activated" : "suspended"}`,
      );
      closeRowMenu();
      fetchOfficers();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setTogglingId(null);
    }
  };

  const fetchSubBrokerDetails = async (
    id: string,
    mode: "view" | "edit",
  ): Promise<SubBrokerUser | null> => {
    try {
      if (mode === "view") setViewLoading(true);
      const token =
        sessionStorage.getItem("loan_officer_token") ??
        sessionStorage.getItem("broker_token");

      if (!token) {
        toast.error("Unauthorized!");
        return null;
      }

      const res = await fetch(`${API_BASE}/broker/sub-broker/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.message || "Failed to fetch Co Brokers details");
        return null;
      }

      return json.data as SubBrokerUser;
    } catch {
      toast.error("Something went wrong");
      return null;
    } finally {
      if (mode === "view") setViewLoading(false);
    }
  };

  const openViewSubBroker = async (id: string) => {
    setViewSubBroker(null);
    setViewLoading(true);
    const data = await fetchSubBrokerDetails(id, "view");
    if (data) setViewSubBroker(data);
    else setViewLoading(false);
  };

  const openEditSubBroker = async (id: string) => {
    if (!canEditCoBrokers) {
      toast.error("You don't have permission to edit co-brokers");
      return;
    }
    setFormModalMode("edit");
    setEditSubBrokerId(id);
    setFormModalOpen(true);
  };

  // const handleDelete = async (id: string) => {
  //   if (!canDeleteCoBrokers) {
  //     toast.error("You don't have permission to delete co-brokers");
  //     return;
  //   }
  //   const isDark = document.documentElement.classList.contains("dark");

  //   const result = await Swal.fire({
  //     title: "Delete Co Brokers?",
  //     text: "This Co Brokers will be removed and will no longer be able to sign in.",
  //     icon: "warning",
  //     showCancelButton: true,
  //     confirmButtonColor: "#dc2626",
  //     cancelButtonColor: "#6b7280",
  //     confirmButtonText: "Yes, delete",
  //     cancelButtonText: "Cancel",
  //     background: isDark ? "#1e293b" : "#ffffff",
  //     color: isDark ? "#e2e8f0" : "#1e293b",
  //     customClass: {
  //       popup: "rounded-2xl",
  //       container: "swal-high-zindex",
  //     },
  //   });

  //   if (!result.isConfirmed) return;

  //   try {
  //     setDeletingId(id);
  //     const res = await fetch(`${API_BASE}/broker/sub-broker/${id}`, {
  //       method: "DELETE",
  //       headers: getAuthHeaders(),
  //     });
  //     const json = await res.json();

  //     if (!res.ok || !json.success) {
  //       toast.error(json.message || "Failed to delete Co Brokers");
  //       return;
  //     }

  //     if (viewSubBroker?.id === id) setViewSubBroker(null);
  //     closeRowMenu();

  //     await Swal.fire({
  //       title: "Deleted",
  //       text: "Co Brokers has been deleted successfully.",
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
  //   } catch {
  //     toast.error("Something went wrong");
  //   } finally {
  //     setDeletingId(null);
  //   }
  // };

  const openCreateModal = () => {
    if (!canEditCoBrokers) {
      toast.error("You don't have permission to create co-brokers");
      return;
    }
    setFormModalMode("create");
    setEditSubBrokerId(null);
    setFormModalOpen(true);
  };

  const handleCopyInviteLink = async () => {
    if (!canEditCoBrokers) {
      toast.error("You don't have permission to create invite links");
      return;
    }
    try {
      setCopyingInvite(true);
      const invite = await copyBrokerTeamInviteLink("SUB_BROKER");
      toast.success(
        `Invite link copied (expires in ${invite.expiresInHours}h)`,
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to create invite link");
    } finally {
      setCopyingInvite(false);
    }
  };

  const closeFormModal = () => {
    setFormModalOpen(false);
    setEditSubBrokerId(null);
  };

  return (
    <>
      <PageMeta
        title="Co Brokers | Broker Dashboard"
        description="Manage Co Brokers"
      />

      <div className="w-full min-w-0 space-y-4 pb-4 text-text-primary dark:text-slate-100">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="ds-page-title">Co Brokers</h1>
            <p className="ds-page-subtitle">
              Manage co-brokers, control access, and monitor their activity.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canEditCoBrokers ? (
              <>
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
                  Add co broker
                </button>
              </>
            ) : null}
          </div>
        </div>

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

        <div className="overflow-hidden rounded-2xl border border-border bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-2.5 border-b border-border px-4 py-3.5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-center lg:min-w-0 lg:flex-1">
              <div className="group relative w-full sm:max-w-sm">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-secondary transition-colors group-focus-within:text-[#4C78F5]" />
                <input
                  type="text"
                  placeholder="Search co brokers..."
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
                  <th className="hidden md:table-cell">Loan Officers</th>
                  <th className="hidden lg:table-cell">Company</th>
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
                        Loading co brokers…
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
                        {search || debouncedSearch || statusFilter
                          ? "No co brokers match your filters"
                          : "No co brokers yet"}
                      </p>
                      <p className="mx-auto mt-1.5 max-w-sm text-xs text-text-secondary">
                        {search || debouncedSearch || statusFilter
                          ? "Try a different search term or status filter."
                          : "Add your first co broker to delegate loan pipeline work."}
                      </p>
                      {!search && !debouncedSearch && !statusFilter ? (
                        canEditCoBrokers ? (
                          <button
                            type="button"
                            onClick={openCreateModal}
                            className="ds-btn-primary mt-4 h-9 px-4 text-xs"
                          >
                            <Plus size={14} />
                            Add co broker
                          </button>
                        ) : null
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
                    const loanOfficerLabel = formatTeamAssignments(
                      o.assignedLoanOfficers,
                    );
                    const loanOfficerTitle = getTeamAssignmentTitle(
                      o.assignedLoanOfficers,
                    );
                    const company = o.profile?.company?.trim() || "";

                    return (
                      <tr key={o.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4C78F5] text-[11px] font-semibold text-white">
                              {getInitials(o.firstName, o.lastName)}
                            </div>
                            <div className="min-w-0">
                              <p className="ds-table-title">
                                {fullName || "Unnamed"}
                              </p>
                              <p className="ds-table-meta">
                                {o.email || "No email"}
                              </p>
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
                          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-100 px-2.5 py-1 text-[11px] font-semibold text-cyan-700 ring-1 ring-inset ring-cyan-200">
                            <Shield className="h-3 w-3" />
                            Co Broker
                          </span>
                        </td>

                        <td className="hidden min-w-0 md:table-cell">
                          <LoanOfficerCell
                            label={loanOfficerLabel}
                            title={loanOfficerTitle}
                          />
                        </td>

                        <td className="hidden lg:table-cell">
                          {company ? (
                            <span className="inline-flex max-w-[160px] truncate rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium lowercase text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {company}
                            </span>
                          ) : (
                            <span className="text-[12px] font-medium italic text-text-secondary/70">
                              Not set
                            </span>
                          )}
                        </td>

                        <td>
                          <StatusPill active={isActive} />
                        </td>

                        <td className="text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            {canDisableCoBrokers ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  toggleStatus(o.id, o.status, fullName)
                                }
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
                            ) : null}
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

      {activeMenuUser &&
        activeMenuId &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: menuPos.top, left: menuPos.left }}
            className="z-[9999] max-h-[min(196px,calc(100vh-16px))] w-[168px] overflow-y-auto rounded-xl border border-border bg-white dark:border-slate-700 dark:bg-slate-950"
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
                disabled={viewLoading}
                onClick={() => {
                  closeRowMenu();
                  openViewSubBroker(activeMenuUser.id);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-primary transition hover:bg-[#4C78F5]/[0.06] disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                <Eye className="h-3.5 w-3.5 text-[#4C78F5]" />
                View details
              </button>
              {canAccessCoBrokerPortal && (
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
              )}
              {canEditCoBrokers && (
                <button
                  type="button"
                  onClick={() => {
                    closeRowMenu();
                    openEditSubBroker(activeMenuUser.id);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-primary transition hover:bg-[#4C78F5]/[0.06] dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  <Pencil className="h-3.5 w-3.5 text-amber-600" />
                  Edit
                </button>
              )}
              {canDisableCoBrokers && (
                <button
                  type="button"
                  disabled={togglingId === activeMenuUser.id}
                  onClick={() =>
                    toggleStatus(
                      activeMenuUser.id,
                      activeMenuUser.status,
                      `${activeMenuUser.firstName} ${activeMenuUser.lastName}`.trim(),
                    )
                  }
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
              )}
            </div>
            {/* 
            {canDeleteCoBrokers && (
            <div className="border-t border-gray-100 py-0.5 dark:border-gray-800">
              <button
                type="button"
                disabled={deletingId === activeMenuUser.id}
                onClick={() => handleDelete(activeMenuUser.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
            )} */}
          </div>,
          document.body,
        )}

      <CoBrokerFormModal
        isOpen={formModalOpen}
        mode={formModalMode}
        subBrokerId={editSubBrokerId}
        onClose={closeFormModal}
        onSaved={fetchOfficers}
      />

      <CoBrokerDetailsModal
        isOpen={viewLoading || !!viewSubBroker}
        coBroker={viewSubBroker}
        loading={viewLoading}
        onClose={() => {
          setViewSubBroker(null);
          setViewLoading(false);
        }}
        onEdit={(id) => {
          setViewSubBroker(null);
          openEditSubBroker(id);
        }}
      />
    </>
  );
}
