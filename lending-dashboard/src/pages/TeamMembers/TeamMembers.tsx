import { Info, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import PageMeta from "../../components/common/PageMeta";
import { lenderFetch } from "../../lib/lenderApi";
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
  isLenderAdminUser,
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
  const isAdmin = isLenderAdminUser();
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

  const selectedInviteRole = useMemo(
    () => getRoleOption(inviteForm.role),
    [inviteForm.role],
  );

  const selectedEditRole = useMemo(
    () => getRoleOption(editForm.role),
    [editForm.role],
  );

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
    if (isAdmin) {
      fetchMembers();
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

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
        confirmButtonColor: "#0F766E",
        background: isDark ? "#1e293b" : "#ffffff",
        color: isDark ? "#e2e8f0" : "#1e293b",
        customClass: {
          popup: "rounded-2xl",
          container: "swal-high-zindex",
        },
      });
    }
  };

  if (!isAdmin) {
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
            Only lender admins can manage team members.
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
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F766E] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0d655f]"
          >
            <Plus size={16} />
            Invite User
          </button>
        </div>

        <div className="flex gap-3 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <p>
            <strong>Admin</strong> users have full portal access.{" "}
            <strong>Underwriters</strong> can review deals, request documents,
            approve or decline, generate LOI, and chat with brokers.{" "}
            <strong>Analysts</strong> can review deals, request documents, and
            chat with brokers. <strong>Viewers</strong> have read-only access.
          </p>
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
                  members.map((member) => (
                    <tr
                      key={member.id}
                      className="border-b border-slate-100 last:border-b-0"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-700">
                            {getMemberInitials(member)}
                          </div>
                          <span className="font-medium text-slate-800">
                            {formatTeamMemberName(member)}
                          </span>
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
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(member)}
                            className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                            title="Edit member"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(member)}
                            className="rounded-lg border border-rose-200 p-2 text-rose-500 transition hover:bg-rose-50 hover:text-rose-700"
                            title="Remove member"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

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
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100"
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
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100"
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
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100"
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
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100"
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
                className="rounded-xl bg-[#0F766E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0d655f] disabled:opacity-60"
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
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100"
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
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Role *
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      role: e.target.value as LenderTeamRole,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100"
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
                className="rounded-xl bg-[#0F766E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0d655f] disabled:opacity-60"
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
