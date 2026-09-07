import { ExternalLink, Info, MoreVertical, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  const activeAdminCount = useMemo(
    () =>
      members.filter(
        (m) =>
          m.role === "LENDER_ADMIN" &&
          String(m.status || "").toUpperCase() === "ACTIVE",
      ).length,
    [members],
  );

  const isLastActiveAdmin = (member: LenderTeamMember | null) => {
    if (!member) return false;
    return (
      member.role === "LENDER_ADMIN" &&
      String(member.status || "").toUpperCase() === "ACTIVE" &&
      activeAdminCount <= 1
    );
  };

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const aIsCurrent = Boolean(currentUserId) && a.id === currentUserId;
      const bIsCurrent = Boolean(currentUserId) && b.id === currentUserId;
      if (aIsCurrent !== bIsCurrent) return aIsCurrent ? -1 : 1;

      const aIsAdmin = a.role === "LENDER_ADMIN";
      const bIsAdmin = b.role === "LENDER_ADMIN";
      if (aIsAdmin !== bIsAdmin) return aIsAdmin ? -1 : 1;

      return 0;
    });
  }, [members, currentUserId]);

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

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const response = await lenderFetch<{
        success: boolean;
        data: LenderTeamMember[];
      }>("/lender/users");

      setMembers(response.data || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load team members");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canManage) {
      fetchMembers();
    } else {
      setLoading(false);
    }
  }, [canManage]);

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
      toast.error(error.message || "Failed to access team member dashboard");
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
      await fetchMembers();
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
      await fetchMembers();
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

      await fetchMembers();
    } catch (error: any) {
      Swal.fire({
        title: "Delete failed",
        text: error.message || "Failed to remove team member",
        icon: "error",
        confirmButtonColor: "#183b57",
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
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <Users className="mx-auto mb-3 h-10 w-10 text-slate-400" />
          <h1 className="text-lg font-semibold text-slate-800">Access restricted</h1>
          <p className="mt-2 text-sm text-slate-500">
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

      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Team Members</h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage who has access to your Lender Portal
            </p>
          </div>

          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#183b57] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#264863]"
          >
            <Plus size={16} />
            Invite User
          </button>
        </div>

        <div className="flex gap-3 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <div className="space-y-1.5">
            <p>
              Roles control what each member can do in the Lender Portal.
              Permissions are enforced on every action.
            </p>
            <ul className="grid gap-1 text-xs text-sky-800 sm:grid-cols-2">
              <li>
                <strong>Admin</strong> — full access + team / settings
              </li>
              <li>
                <strong>Underwriter</strong> — decide, LOI, sign docs, chat
              </li>
              <li>
                <strong>Analyst</strong> — request docs + chat (no decide/LOI)
              </li>
              <li>
                <strong>Viewer</strong> — read-only (no mutations or chat)
              </li>
            </ul>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Member</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Date Added</th>
                  <th className="px-5 py-3">Last Login</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                      Loading team members...
                    </td>
                  </tr>
                ) : members.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                      No team members yet. Invite your first user to get started.
                    </td>
                  </tr>
                ) : (
                  sortedMembers.map((member) => {
                    const isCurrentUser =
                      Boolean(currentUserId) && member.id === currentUserId;

                    return (
                    <tr
                      key={member.id}
                      className="border-b border-slate-100 last:border-b-0"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                            {getMemberInitials(member)}
                          </div>
                          <div className="min-w-0">
                            <span className="font-medium text-slate-800">
                              {formatTeamMemberName(member)}
                            </span>
                            {isCurrentUser ? (
                              <span className="ml-2 inline-flex rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700 ring-1 ring-inset ring-brand-200">
                                You
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{member.email}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${roleBadgeClass(member.role)}`}
                        >
                          {member.roleLabel}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusBadgeClass(member.displayStatus)}`}
                        >
                          {formatDisplayStatus(member.displayStatus)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {formatTeamDate(member.createdAt)}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {formatTeamDateTime(member.lastLoginAt)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            data-menu-id={member.id}
                            onClick={(event) => openRowMenu(member.id, event)}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                              activeMenuId === member.id
                                ? "border-[#183b57]/30 bg-[#183b57]/5 text-[#183b57]"
                                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
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
        </div>
      </div>

      {activeMenuMember &&
        activeMenuId &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: menuPos.top, left: menuPos.left }}
            className="z-[9999] w-[180px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
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
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
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
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#183b57] focus:ring-2 focus:ring-brand-100"
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
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#183b57] focus:ring-2 focus:ring-brand-100"
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
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#183b57] focus:ring-2 focus:ring-brand-100"
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
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#183b57] focus:ring-2 focus:ring-brand-100"
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
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#183b57]" />
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
                className="rounded-xl bg-[#183b57] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#264863] disabled:opacity-60"
              >
                {submitting ? "Sending..." : "Send Invitation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editOpen && editingMember && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
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
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#183b57] focus:ring-2 focus:ring-brand-100"
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
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#183b57] focus:ring-2 focus:ring-brand-100"
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
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#183b57] focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
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
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#183b57]" />
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
                className="rounded-xl bg-[#183b57] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#264863] disabled:opacity-60"
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
