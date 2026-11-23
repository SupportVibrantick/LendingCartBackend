import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Info,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  ShieldOff,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import PageMeta from "../../components/common/PageMeta";
import { buildImpersonatePortalUrl } from "../../lib/impersonateUrl";
import { lenderFetch } from "../../lib/lenderApi";
import {
  ROLE_CAPABILITY_LABELS,
  canManageTeam,
} from "../../lib/lenderPermissions";
import { getPaginationWindow } from "../../lib/loanPipelineUtils";
import {
  LENDER_TEAM_ROLE_OPTIONS,
  type LenderTeamMember,
  type LenderTeamRole,
  formatDisplayStatus,
  formatTeamDate,
  formatTeamDateTime,
  formatTeamMemberName,
  getMemberInitials,
  getRoleOption,
  roleBadgeClass,
  statusBadgeClass,
} from "../../lib/lenderTeamMembers";

const ROWS_PER_PAGE = 10;
const SEARCH_DEBOUNCE_MS = 400;

function EmptyCell({ label }: { label: string }) {
  return (
    <span className="text-[12px] font-medium italic text-text-secondary/70">
      {label}
    </span>
  );
}

function StatusPill({ status }: { status?: string | null }) {
  const key = String(status || "").toUpperCase();
  const label = formatDisplayStatus(status);
  const icon =
    key === "ACTIVE" ? (
      <CheckCircle2 className="h-3.5 w-3.5" />
    ) : key === "INVITED" ? (
      <Clock3 className="h-3.5 w-3.5" />
    ) : (
      <ShieldOff className="h-3.5 w-3.5" />
    );

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusBadgeClass(status)}`}
    >
      {icon}
      {label === "—" ? "Unknown" : label}
    </span>
  );
}

type InviteForm = {
  firstName: string;
  lastName: string;
  email: string;
  role: LenderTeamRole;
};

type EditForm = {
  firstName: string;
  lastName: string;
  role: LenderTeamRole;
};

const emptyInviteForm = (): InviteForm => ({
  firstName: "",
  lastName: "",
  email: "",
  role: "LENDER_VIEWER",
});

type TeamMembersListPayload = {
  success: boolean;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  activeAdminCount?: number;
  data: LenderTeamMember[];
};

// Share identical in-flight GETs across React Strict Mode remounts.
const inflightTeamMembers = new Map<string, Promise<TeamMembersListPayload>>();

async function fetchTeamMembersList(
  params: URLSearchParams,
  force = false,
): Promise<TeamMembersListPayload> {
  const key = params.toString();
  if (!force) {
    const existing = inflightTeamMembers.get(key);
    if (existing) return existing;
  }

  const request = lenderFetch<TeamMembersListPayload>(
    `/lender/users?${key}`,
  ).finally(() => {
    if (inflightTeamMembers.get(key) === request) {
      inflightTeamMembers.delete(key);
    }
  });

  inflightTeamMembers.set(key, request);
  return request;
}

export default function TeamMembers() {
  const canManage = canManageTeam();
  const [members, setMembers] = useState<LenderTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<LenderTeamMember | null>(null);
  const [inviteForm, setInviteForm] = useState<InviteForm>(emptyInviteForm);
  const [editForm, setEditForm] = useState<EditForm>({
    firstName: "",
    lastName: "",
    role: "LENDER_VIEWER",
  });
  const [accessingId, setAccessingId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | LenderTeamRole>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(ROWS_PER_PAGE);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: ROWS_PER_PAGE,
    total: 0,
    totalPages: 1,
  });
  const [activeAdminCount, setActiveAdminCount] = useState(0);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const filtersRef = useRef({
    search: "",
    role: "" as "" | LenderTeamRole,
    pageSize: ROWS_PER_PAGE,
  });

  const selectedInviteRole = useMemo(
    () => getRoleOption(inviteForm.role),
    [inviteForm.role],
  );

  const selectedEditRole = useMemo(
    () => getRoleOption(editForm.role),
    [editForm.role],
  );

  const inviteCapabilities = useMemo(
    () => ROLE_CAPABILITY_LABELS[inviteForm.role] || [],
    [inviteForm.role],
  );

  const editCapabilities = useMemo(
    () => ROLE_CAPABILITY_LABELS[editForm.role] || [],
    [editForm.role],
  );

  const currentUserId = useMemo(() => {
    try {
      const raw =
        sessionStorage.getItem("lender_user") ||
        sessionStorage.getItem("user") ||
        "{}";
      const user = JSON.parse(raw);
      return String(user?.id || user?.userId || "");
    } catch {
      return "";
    }
  }, []);

  const isLastActiveAdmin = (member: LenderTeamMember | null) => {
    if (!member) return false;
    return (
      member.role === "LENDER_ADMIN" &&
      String(member.status || "").toUpperCase() === "ACTIVE" &&
      activeAdminCount <= 1
    );
  };

  const displayedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const aIsCurrent = Boolean(currentUserId) && a.id === currentUserId;
      const bIsCurrent = Boolean(currentUserId) && b.id === currentUserId;
      if (aIsCurrent !== bIsCurrent) return aIsCurrent ? -1 : 1;
      return 0;
    });
  }, [members, currentUserId]);

  const pageNumbers = useMemo(
    () => getPaginationWindow(page, pagination.totalPages),
    [page, pagination.totalPages],
  );

  const hasActiveFilters = Boolean(debouncedSearch || roleFilter);
  const showingFrom =
    pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const showingTo = Math.min(
    pagination.page * pagination.limit,
    pagination.total,
  );

  const activeMenuMember = useMemo(
    () => members.find((m) => m.id === activeMenuId) ?? null,
    [members, activeMenuId],
  );

  const closeRowMenu = () => setActiveMenuId(null);

  const openRowMenu = (
    memberId: string,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 180;
    const estimatedHeight = 160;
    const gap = 6;

    let left = rect.right - menuWidth;
    let top = rect.bottom + gap;

    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
    if (top + estimatedHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - estimatedHeight - gap);
    }

    setMenuPos({ top, left });
    setActiveMenuId((prev) => (prev === memberId ? null : memberId));
  };

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
      const trigger = document.querySelector(
        `[data-menu-id="${activeMenuId}"]`,
      ) as HTMLElement | null;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const menuWidth = 180;
      const estimatedHeight = menuRef.current?.offsetHeight || 160;
      const gap = 6;
      let left = rect.right - menuWidth;
      let top = rect.bottom + gap;
      left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
      if (top + estimatedHeight > window.innerHeight - 8) {
        top = Math.max(8, rect.top - estimatedHeight - gap);
      }
      setMenuPos({ top, left });
    };

    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [activeMenuId]);

  const fetchMembers = useCallback(
    async (options?: { force?: boolean; isActive?: () => boolean }) => {
      const isActive = options?.isActive;
      if (!isActive || isActive()) setLoading(true);

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(pageSize),
        });
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (roleFilter) params.set("role", roleFilter);

        const json = await fetchTeamMembersList(
          params,
          Boolean(options?.force),
        );
        if (isActive && !isActive()) return;

        setMembers(Array.isArray(json.data) ? json.data : []);
        setPagination({
          page: Number(json.page) || page,
          limit: Number(json.limit) || pageSize,
          total: Number(json.total) || 0,
          totalPages: Math.max(Number(json.totalPages) || 1, 1),
        });
        setActiveAdminCount(Number(json.activeAdminCount) || 0);

        if (json.page && json.page !== page && json.page >= 1) {
          setPage(json.page);
        }
      } catch (error: any) {
        if (isActive && !isActive()) return;
        toast.error(error.message || "Failed to load team members");
      } finally {
        if (!isActive || isActive()) {
          setLoading(false);
        }
      }
    },
    [page, pageSize, debouncedSearch, roleFilter],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (!canManage) {
      setLoading(false);
      return;
    }

    const filtersChanged =
      filtersRef.current.search !== debouncedSearch ||
      filtersRef.current.role !== roleFilter ||
      filtersRef.current.pageSize !== pageSize;

    if (filtersChanged) {
      filtersRef.current = {
        search: debouncedSearch,
        role: roleFilter,
        pageSize,
      };
      if (page !== 1) {
        setPage(1);
        return;
      }
    }

    let active = true;
    void fetchMembers({ isActive: () => active });
    return () => {
      active = false;
    };
  }, [
    canManage,
    page,
    pageSize,
    debouncedSearch,
    roleFilter,
    fetchMembers,
  ]);

  const handleAccessDashboard = async (member: LenderTeamMember) => {
    if (member.id === currentUserId) {
      toast.error("You are already signed in as this user");
      return;
    }

    if (String(member.status || "").toUpperCase() !== "ACTIVE") {
      toast.error("Only active team members can be accessed");
      return;
    }

    try {
      setAccessingId(member.id);
      const json = await lenderFetch<{
        success: boolean;
        token: string;
        user: Record<string, unknown>;
        redirectTo?: string;
        message?: string;
      }>(`/lender/users/${member.id}/impersonate`, {
        method: "POST",
      });

      if (!json?.token) {
        throw new Error(json?.message || "Failed to access dashboard");
      }

      const impersonateParams: Record<string, string> = {
        token: json.token,
        user: JSON.stringify(json.user || {}),
        redirectTo: json.redirectTo || "/",
      };

      const url = buildImpersonatePortalUrl("/impersonate", impersonateParams);
      const popup = window.open(url, "_blank", "noopener,noreferrer");
      if (!popup) {
        toast.error("Pop-up blocked. Allow pop-ups to open the member dashboard.");
        return;
      }

      toast.success(
        `Opened dashboard for ${formatTeamMemberName(member)}`,
      );
    } catch (error: any) {
      const message = String(error?.message || "");
      if (/exit the current view mode/i.test(message)) {
        toast.error(
          "Exit View Mode first (red button in the header), then try Access dashboard again.",
        );
      } else {
        toast.error(message || "Failed to access team member dashboard");
      }
    } finally {
      setAccessingId(null);
    }
  };

  const openEditModal = (member: LenderTeamMember) => {
    setEditingMember(member);
    setEditForm({
      firstName: member.firstName || "",
      lastName: member.lastName || "",
      role: (member.role || "LENDER_VIEWER") as LenderTeamRole,
    });
    setEditOpen(true);
  };

  const handleInvite = async () => {
    if (
      !inviteForm.firstName.trim() ||
      !inviteForm.lastName.trim() ||
      !inviteForm.email.trim()
    ) {
      toast.error("Please complete all required fields");
      return;
    }

    try {
      setSubmitting(true);
      await lenderFetch("/lender/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: inviteForm.firstName.trim(),
          lastName: inviteForm.lastName.trim(),
          email: inviteForm.email.trim(),
          role: inviteForm.role,
        }),
      });

      toast.success("Invitation sent successfully");
      setInviteOpen(false);
      setInviteForm(emptyInviteForm());
      await fetchMembers({ force: true });
    } catch (error: any) {
      toast.error(error.message || "Failed to send invitation");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingMember) return;

    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      toast.error("First name and last name are required");
      return;
    }

    if (
      isLastActiveAdmin(editingMember) &&
      editForm.role !== "LENDER_ADMIN"
    ) {
      toast.error(
        "Cannot demote the last active admin. Promote another admin first.",
      );
      return;
    }

    if (
      editingMember.id === currentUserId &&
      editingMember.role === "LENDER_ADMIN" &&
      editForm.role !== "LENDER_ADMIN"
    ) {
      toast.error("You cannot remove your own admin access");
      return;
    }

    try {
      setSubmitting(true);
      await lenderFetch(`/lender/users/${editingMember.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: editForm.firstName.trim(),
          lastName: editForm.lastName.trim(),
          role: editForm.role,
        }),
      });

      toast.success("Team member updated");
      setEditOpen(false);
      setEditingMember(null);
      await fetchMembers({ force: true });
    } catch (error: any) {
      toast.error(error.message || "Failed to update team member");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (member: LenderTeamMember) => {
    if (isLastActiveAdmin(member)) {
      toast.error(
        "Cannot remove the last active admin. Promote another admin first.",
      );
      return;
    }

    const isDark = document.documentElement.classList.contains("dark");
    const memberName = formatTeamMemberName(member);

    const result = await Swal.fire({
      title: "Remove team member?",
      html: `Are you sure you want to remove <strong>${memberName}</strong> from your lender portal team?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, remove",
      cancelButtonText: "Cancel",
      background: isDark ? "#1e293b" : "#ffffff",
      color: isDark ? "#e2e8f0" : "#1e293b",
      customClass: {
        popup: "rounded-2xl",
        container: "swal-high-zindex",
      },
    });

    if (!result.isConfirmed) return;

    try {
      await lenderFetch(`/lender/users/${member.id}`, {
        method: "DELETE",
      });

      await Swal.fire({
        title: "Removed",
        text: `${memberName} has been removed from your team.`,
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
        background: isDark ? "#1e293b" : "#ffffff",
        color: isDark ? "#e2e8f0" : "#1e293b",
        customClass: {
          popup: "rounded-2xl",
          container: "swal-high-zindex",
        },
      });

      await fetchMembers({ force: true });
    } catch (error: any) {
      Swal.fire({
        title: "Delete failed",
        text: error.message || "Failed to remove team member",
        icon: "error",
        confirmButtonColor: "#4C78F5",
        background: isDark ? "#1e293b" : "#ffffff",
        color: isDark ? "#e2e8f0" : "#1e293b",
        customClass: {
          popup: "rounded-2xl",
          container: "swal-high-zindex",
        },
      });
    }
  };

  if (!canManage) {
    return (
      <>
        <PageMeta
          title="Team Members"
          description="Manage lender portal team members"
        />
        <div className="rounded-2xl border border-border bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
          <Users className="mx-auto mb-3 h-10 w-10 text-text-secondary" />
          <h1 className="text-lg font-semibold text-text-primary">Access restricted</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Only lender admins can manage team members and permissions.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageMeta
        title="Team Members"
        description="Manage lender portal team members"
      />

      <div className="space-y-4 text-text-primary dark:text-slate-100">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="ds-page-title">Users</h1>
            <p className="ds-page-subtitle">
              Every team member across your Lender Portal
            </p>
          </div>

          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="ds-btn-primary shrink-0"
          >
            <Plus size={16} />
            Add User
          </button>
        </div>

        <div className="flex gap-2.5 rounded-xl border border-brand-100 bg-brand-50/80 px-3.5 py-2.5 text-[13px] text-brand-800 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
          <p>
            Roles control portal access.{" "}
            <span className="font-semibold">Admin</span>,{" "}
            <span className="font-semibold">Underwriter</span>,{" "}
            <span className="font-semibold">Analyst</span>, and{" "}
            <span className="font-semibold">Viewer</span> permissions are
            enforced on every action.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-2.5 border-b border-border px-4 py-3.5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-center lg:min-w-0 lg:flex-1">
              <div className="group relative w-full sm:max-w-sm">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-secondary transition-colors group-focus-within:text-brand-500" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search users..."
                  className="h-10 w-full rounded-xl border border-border bg-white py-2 pr-9 pl-10 text-sm text-text-primary outline-none transition placeholder:text-text-secondary/70 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950"
                />
                {searchTerm ? (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-text-secondary hover:bg-surface"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>

              <select
                value={roleFilter}
                onChange={(event) =>
                  setRoleFilter(event.target.value as "" | LenderTeamRole)
                }
                className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-text-primary outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 sm:w-[160px] dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">All roles</option>
                {LENDER_TEAM_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              className="h-10 w-full shrink-0 rounded-xl border border-border bg-white px-3 text-sm text-text-primary outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 sm:ml-auto sm:w-[120px] lg:ml-0 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value={10}>10 / page</option>
              <option value={15}>15 / page</option>
              <option value={25}>25 / page</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="ds-table min-w-[880px] w-full">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Date Added</th>
                  <th>Last Login</th>
                  <th className="!text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-14 text-center">
                      <div className="inline-flex items-center gap-2 text-sm text-text-secondary">
                        <Users className="h-4 w-4 animate-pulse text-brand-500" />
                        Loading team members…
                      </div>
                    </td>
                  </tr>
                ) : displayedMembers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-14 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                        <Users className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-semibold text-text-primary">
                        {!hasActiveFilters
                          ? "No team members yet"
                          : "No users match your filters"}
                      </p>
                      <p className="mx-auto mt-1.5 max-w-sm text-xs text-text-secondary">
                        {!hasActiveFilters
                          ? "Invite your first user to get started."
                          : "Try a different search term or role filter."}
                      </p>
                      {!hasActiveFilters ? (
                        <button
                          type="button"
                          onClick={() => setInviteOpen(true)}
                          className="ds-btn-primary mt-4 h-9 px-4 text-xs"
                        >
                          <Plus size={14} />
                          Add User
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchTerm("");
                            setDebouncedSearch("");
                            setRoleFilter("");
                            setPage(1);
                          }}
                          className="mt-4 text-xs font-semibold text-brand-500 hover:underline"
                        >
                          Clear filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  displayedMembers.map((member) => {
                    const isCurrentUser =
                      Boolean(currentUserId) && member.id === currentUserId;
                    const added = formatTeamDate(member.createdAt);
                    const lastLogin = formatTeamDateTime(member.lastLoginAt);

                    return (
                      <tr key={member.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[11px] font-semibold text-white">
                              {getMemberInitials(member)}
                            </div>
                            <div className="min-w-0">
                              <p className="ds-table-title">
                                {formatTeamMemberName(member) || "Unnamed user"}
                                {isCurrentUser ? (
                                  <span className="ml-2 inline-flex rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                                    You
                                  </span>
                                ) : null}
                              </p>
                              <p className="ds-table-meta">
                                {member.email || "No email"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${roleBadgeClass(member.role)}`}
                          >
                            {member.roleLabel || "No role"}
                          </span>
                        </td>
                        <td>
                          <StatusPill status={member.displayStatus} />
                        </td>
                        <td className="ds-table-muted whitespace-nowrap">
                          {added !== "—" ? (
                            added
                          ) : (
                            <EmptyCell label="Not set" />
                          )}
                        </td>
                        <td className="ds-table-muted whitespace-nowrap">
                          {lastLogin !== "—" ? (
                            lastLogin
                          ) : (
                            <EmptyCell label="Never" />
                          )}
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            data-menu-id={member.id}
                            onClick={(event) => openRowMenu(member.id, event)}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
                              activeMenuId === member.id
                                ? "border-brand-300 bg-brand-50 text-brand-500"
                                : "border-border bg-white text-text-secondary hover:bg-surface hover:text-text-primary dark:border-slate-700 dark:bg-slate-900"
                            }`}
                            title="More actions"
                            aria-label="Open actions menu"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {!loading && pagination.total > 0 ? (
            <div className="flex flex-col gap-3 border-t border-border px-4 py-3.5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-[13px] text-text-secondary">
                Showing{" "}
                <span className="font-semibold text-text-primary">
                  {showingFrom}
                </span>
                –
                <span className="font-semibold text-text-primary">
                  {showingTo}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-text-primary">
                  {pagination.total}
                </span>
              </p>

              {pagination.totalPages > 1 ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((current) => Math.max(current - 1, 1))}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-surface disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {pageNumbers.map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      disabled={loading}
                      onClick={() => setPage(pageNumber)}
                      className={`inline-flex h-9 min-w-9 items-center justify-center rounded-xl px-2.5 text-sm font-semibold transition ${
                        page === pageNumber
                          ? "bg-brand-500 text-white"
                          : "border border-border bg-white hover:bg-surface dark:border-slate-700 dark:bg-slate-900"
                      }`}
                    >
                      {pageNumber}
                    </button>
                  ))}

                  <button
                    type="button"
                    disabled={page >= pagination.totalPages || loading}
                    onClick={() =>
                      setPage((current) =>
                        Math.min(current + 1, pagination.totalPages),
                      )
                    }
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

      {activeMenuMember &&
        activeMenuId &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: menuPos.top, left: menuPos.left }}
            className="z-[9999] w-[180px] overflow-hidden rounded-xl border border-border bg-white dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="border-b border-slate-100 px-3 py-2">
              <p className="truncate text-[11px] font-semibold text-slate-900">
                {formatTeamMemberName(activeMenuMember)}
              </p>
              <p className="truncate text-[10px] text-slate-500">
                {activeMenuMember.email}
              </p>
            </div>

            <div className="py-0.5">
              {Boolean(currentUserId) &&
              activeMenuMember.id !== currentUserId &&
              String(activeMenuMember.status || "").toUpperCase() ===
                "ACTIVE" ? (
                <button
                  type="button"
                  disabled={accessingId === activeMenuMember.id}
                  onClick={() => {
                    closeRowMenu();
                    void handleAccessDashboard(activeMenuMember);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-cyan-600" />
                  {accessingId === activeMenuMember.id
                    ? "Opening..."
                    : "Access dashboard"}
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  closeRowMenu();
                  openEditModal(activeMenuMember);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 transition hover:bg-slate-50"
              >
                <Pencil className="h-3.5 w-3.5 text-amber-600" />
                Edit member
              </button>

              {Boolean(currentUserId) &&
              activeMenuMember.id !== currentUserId ? (
                <button
                  type="button"
                  disabled={isLastActiveAdmin(activeMenuMember)}
                  onClick={() => {
                    closeRowMenu();
                    void handleDelete(activeMenuMember);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                  title={
                    isLastActiveAdmin(activeMenuMember)
                      ? "Cannot remove the last active admin"
                      : "Remove member"
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove member
                </button>
              ) : null}
            </div>
          </div>,
          document.body,
        )}

      {inviteOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-border px-6 py-4 dark:border-slate-800">
              <h2 className="text-lg font-semibold text-text-primary dark:text-white">
                Invite Team Member
              </h2>
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    First Name *
                  </label>
                  <input
                    value={inviteForm.firstName}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, firstName: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#4C78F5] focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Last Name *
                  </label>
                  <input
                    value={inviteForm.lastName}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, lastName: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#4C78F5] focus:ring-2 focus:ring-brand-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, email: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#4C78F5] focus:ring-2 focus:ring-brand-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Role *
                </label>
                <select
                  value={inviteForm.role}
                  onChange={(e) =>
                    setInviteForm({
                      ...inviteForm,
                      role: e.target.value as LenderTeamRole,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#4C78F5] focus:ring-2 focus:ring-brand-100"
                >
                  {LENDER_TEAM_ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {selectedInviteRole && (
                  <p className="mt-2 text-xs text-slate-500">
                    {selectedInviteRole.description}
                  </p>
                )}
                {inviteCapabilities.length > 0 && (
                  <ul className="mt-3 space-y-1 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
                    {inviteCapabilities.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#4C78F5]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleInvite}
                className="rounded-xl bg-[#4C78F5] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#3A5FD4] disabled:opacity-60"
              >
                {submitting ? "Sending..." : "Send Invitation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editOpen && editingMember && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-border px-6 py-4 dark:border-slate-800">
              <h2 className="text-lg font-semibold text-text-primary dark:text-white">
                Edit Team Member
              </h2>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    First Name *
                  </label>
                  <input
                    value={editForm.firstName}
                    onChange={(e) =>
                      setEditForm({ ...editForm, firstName: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#4C78F5] focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Last Name *
                  </label>
                  <input
                    value={editForm.lastName}
                    onChange={(e) =>
                      setEditForm({ ...editForm, lastName: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#4C78F5] focus:ring-2 focus:ring-brand-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Role *
                </label>
                <select
                  value={editForm.role}
                  disabled={
                    (editingMember.id === currentUserId &&
                      editingMember.role === "LENDER_ADMIN") ||
                    isLastActiveAdmin(editingMember)
                  }
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      role: e.target.value as LenderTeamRole,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#4C78F5] focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                >
                  {LENDER_TEAM_ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {selectedEditRole && (
                  <p className="mt-2 text-xs text-slate-500">
                    {selectedEditRole.description}
                  </p>
                )}
                {editingMember.id === currentUserId &&
                editingMember.role === "LENDER_ADMIN" ? (
                  <p className="mt-2 text-xs text-amber-700">
                    You cannot demote your own admin account.
                  </p>
                ) : isLastActiveAdmin(editingMember) ? (
                  <p className="mt-2 text-xs text-amber-700">
                    This is the last active admin. Promote another admin before
                    changing this role.
                  </p>
                ) : null}
                {editCapabilities.length > 0 && (
                  <ul className="mt-3 space-y-1 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
                    {editCapabilities.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#4C78F5]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleEdit}
                className="rounded-xl bg-[#4C78F5] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#3A5FD4] disabled:opacity-60"
              >
                {submitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
