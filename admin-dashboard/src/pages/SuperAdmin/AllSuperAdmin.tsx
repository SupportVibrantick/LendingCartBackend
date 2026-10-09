import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router";
import toast from "react-hot-toast";
import {
  Ban,
  CalendarDays,
  CheckCircle2,
  Clock3,
  KeyRound,
  Mail,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useAdminPermissions } from "../../context/AdminPermissionsContext";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  SEARCH_DEBOUNCE_MS,
  displayStatus,
  fetchAdmins,
  formatDate,
  formatDateTime,
  getCurrentAdminId,
  getInitials,
  isActiveStatus,
  isFullAccess,
  updateAdminStatus,
  type AdminStats,
  type AdminUser,
} from "./adminUserShared";

const emptyStats: AdminStats = {
  total: 0,
  active: 0,
  inactive: 0,
  fullAccess: 0,
  customAccess: 0,
};

const AllSuperadmin: React.FC = () => {
  const navigate = useNavigate();
  const { can } = useAdminPermissions();
  const canCreate = can(["MANAGE_PERMISSIONS", "CREATE_USER"]);
  const canEdit = can(["MANAGE_PERMISSIONS", "UPDATE_USER"]);
  const currentAdminId = getCurrentAdminId();

  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">(
    "ALL",
  );
  const [accessFilter, setAccessFilter] = useState<"ALL" | "FULL" | "CUSTOM">(
    "ALL",
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalPages, setTotalPages] = useState(1);
  const [totalFiltered, setTotalFiltered] = useState(0);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [confirmStatus, setConfirmStatus] = useState<AdminUser | null>(null);
  const [detailAdmin, setDetailAdmin] = useState<AdminUser | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const MENU_WIDTH = 200;

  const loadAdmins = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchAdmins(
          {
            page: currentPage,
            limit: pageSize,
            search: debouncedSearch || undefined,
            status: statusFilter,
            accessLevel: accessFilter,
          },
          signal,
        );
        if (signal?.aborted) return;
        setAdmins(result.data);
        setStats(result.stats);
        setTotalPages(result.pagination.totalPages || 1);
        setTotalFiltered(result.pagination.total || 0);

        // If filters shrink results, clamp to a valid page and refetch once.
        if (
          result.pagination.totalPages > 0 &&
          currentPage > result.pagination.totalPages
        ) {
          setCurrentPage(result.pagination.totalPages);
        }
      } catch (err) {
        if (
          (err instanceof DOMException && err.name === "AbortError") ||
          (err as { name?: string })?.name === "AbortError"
        ) {
          return;
        }
        const message =
          err instanceof Error ? err.message : "Failed to load admin users";
        setError(message);
        toast.error(message);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [accessFilter, currentPage, debouncedSearch, pageSize, statusFilter],
  );

  // Debounce search input → backend `search` query param
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset to page 1 whenever server-side filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, accessFilter, pageSize]);

  useEffect(() => {
    const controller = new AbortController();
    loadAdmins(controller.signal);
    return () => controller.abort();
  }, [loadAdmins]);

  useEffect(() => {
    if (!openMenuId) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest?.("[data-admin-menu-trigger]")) return;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setOpenMenuId(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenuId(null);
    };
    const close = () => setOpenMenuId(null);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [openMenuId]);

  const hasFilters =
    Boolean(debouncedSearch) ||
    statusFilter !== "ALL" ||
    accessFilter !== "ALL";

  const clearFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setStatusFilter("ALL");
    setAccessFilter("ALL");
  };

  const openRowMenu = (adminId: string, anchor: HTMLElement) => {
    const rect = anchor.getBoundingClientRect();
    const estimatedHeight = 160;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < estimatedHeight + 8;
    const top = openUp
      ? Math.max(8, rect.top - estimatedHeight - 4)
      : rect.bottom + 4;
    const left = Math.min(
      Math.max(8, rect.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - 8,
    );
    setMenuPos({ top, left });
    setOpenMenuId((prev) => (prev === adminId ? null : adminId));
  };

  const activeMenuAdmin = useMemo(
    () => admins.find((a) => a.id === openMenuId) || null,
    [admins, openMenuId],
  );

  const handleToggleStatus = async (admin: AdminUser) => {
    if (admin.id === currentAdminId && isActiveStatus(admin.status)) {
      toast.error("You cannot deactivate your own account");
      return;
    }
    try {
      setTogglingId(admin.id);
      const next = isActiveStatus(admin.status) ? "INACTIVE" : "ACTIVE";
      await updateAdminStatus(admin.id, next);
      toast.success(
        next === "ACTIVE" ? "Admin activated" : "Admin deactivated",
      );
      setConfirmStatus(null);
      await loadAdmins();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setTogglingId(null);
    }
  };

  const showingFrom =
    totalFiltered === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const showingTo = Math.min(currentPage * pageSize, totalFiltered);

  const kpiCards = [
    {
      label: "Total Admins",
      value: stats.total,
      icon: Users,
      iconWrap: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    },
    {
      label: "Active Admins",
      value: stats.active,
      icon: CheckCircle2,
      iconWrap:
        "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    },
    {
      label: "Inactive Admins",
      value: stats.inactive,
      icon: Ban,
      iconWrap:
        "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    },
    {
      label: "Full Access",
      value: stats.fullAccess,
      icon: KeyRound,
      iconWrap:
        "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    },
    {
      label: "Custom Access",
      value: stats.customAccess,
      icon: Shield,
      iconWrap:
        "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
    },
  ];

  return (
    <div className="space-y-4 text-gray-900 dark:text-gray-100">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <nav className="mb-2 text-xs text-gray-500 dark:text-slate-400">
            <Link to="/" className="hover:text-[#13538A]">
              Dashboard
            </Link>
            <span className="mx-1.5">/</span>
            <span>Admin Management</span>
            <span className="mx-1.5">/</span>
            <span className="text-gray-800 dark:text-slate-200">
              Super Admin Users
            </span>
          </nav>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
            Super Admin Users
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Manage platform administrators, access levels and account status.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => loadAdmins()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            title="Reload from server"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {canCreate && (
            <Link
              to="/all-super-admins/create"
              className="inline-flex items-center gap-2 rounded-xl bg-[#13538A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0f4470]"
            >
              <Plus className="h-4 w-4" />
              Add Admin User
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {kpiCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3.5 dark:border-slate-700 dark:bg-slate-900"
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${stat.iconWrap}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 dark:text-slate-400">
                  {stat.label}
                </p>
                <p className="text-xl font-semibold tabular-nums">
                  {loading && !stats.total ? "—" : stat.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-gray-100 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-slate-700 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#13538A] dark:border-slate-600 dark:bg-slate-800"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as typeof statusFilter)
              }
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <select
              value={accessFilter}
              onChange={(e) =>
                setAccessFilter(e.target.value as typeof accessFilter)
              }
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="ALL">All access levels</option>
              <option value="FULL">Full Access</option>
              <option value="CUSTOM">Custom Access</option>
            </select>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <X className="h-3.5 w-3.5" />
                Clear filters
              </button>
            )}
          </div>
        </div>

        {error ? (
          <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <button
              type="button"
              onClick={() => loadAdmins()}
              className="rounded-lg bg-[#13538A] px-4 py-2 text-sm font-semibold text-white"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-slate-800/80 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Admin</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Access Level</th>
                  <th className="px-4 py-3 font-semibold">Permissions</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                  <th className="px-4 py-3 font-semibold">Last Login</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 8 }).map((__, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 animate-pulse rounded bg-gray-100 dark:bg-slate-800" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : admins.length === 0
                    ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-16 text-center">
                          <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                          <p className="text-sm font-medium text-gray-700 dark:text-slate-200">
                            No admin users found
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {hasFilters
                              ? "Try adjusting your search or filters."
                              : "Create the first platform administrator."}
                          </p>
                          {canCreate && !hasFilters && (
                            <Link
                              to="/all-super-admins/create"
                              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#13538A] px-3 py-2 text-sm font-semibold text-white"
                            >
                              <Plus className="h-4 w-4" />
                              Add Admin User
                            </Link>
                          )}
                        </td>
                      </tr>
                      )
                    : admins.map((admin) => {
                        const full = isFullAccess(admin);
                        const active = isActiveStatus(admin.status);
                        const isSelf = admin.id === currentAdminId;
                        return (
                          <tr
                            key={admin.id}
                            className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#13538A]/10 text-xs font-semibold text-[#13538A]">
                                  {getInitials(admin.firstName, admin.lastName)}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-gray-900 dark:text-white">
                                    {admin.firstName} {admin.lastName}
                                    {isSelf && (
                                      <span className="ml-1.5 text-xs font-normal text-gray-400">
                                        (you)
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-slate-300">
                              {admin.email}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${
                                  full
                                    ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300"
                                    : "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300"
                                }`}
                              >
                                {full ? "Full Access" : "Custom Access"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-slate-300">
                              {full
                                ? "All"
                                : `${admin.permissionCount ?? admin.permissions?.length ?? 0}`}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${
                                  active
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                                    : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                                }`}
                              >
                                {displayStatus(admin.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-slate-300">
                              {formatDate(admin.createdAt)}
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-slate-300">
                              {formatDateTime(admin.lastLoginAt)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                data-admin-menu-trigger
                                onClick={(e) =>
                                  openRowMenu(admin.id, e.currentTarget)
                                }
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300"
                                aria-label="Actions"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
              </tbody>
            </table>
          </div>
        )}

        {!error && !loading && totalFiltered > 0 && (
          <div className="flex flex-col gap-2 border-t border-gray-100 px-4 py-3 text-sm text-gray-500 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Showing {showingFrom}–{showingTo} of {totalFiltered}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40 dark:border-slate-600"
              >
                Previous
              </button>
              <span className="tabular-nums">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40 dark:border-slate-600"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {openMenuId &&
        activeMenuAdmin &&
        createPortal(
          <div
            ref={menuRef}
            style={{ top: menuPos.top, left: menuPos.left, width: MENU_WIDTH }}
            className="fixed z-[70] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-slate-800"
              onClick={() => {
                setDetailAdmin(activeMenuAdmin);
                setOpenMenuId(null);
              }}
            >
              <Users className="h-4 w-4" />
              View Details
            </button>
            {canEdit && (
              <>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-slate-800"
                  onClick={() => {
                    navigate(`/all-super-admins/${activeMenuAdmin.id}/edit`);
                    setOpenMenuId(null);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  Edit Admin
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-slate-800"
                  onClick={() => {
                    navigate(
                      `/all-super-admins/${activeMenuAdmin.id}/edit?tab=permissions`,
                    );
                    setOpenMenuId(null);
                  }}
                >
                  <Shield className="h-4 w-4" />
                  Manage Permissions
                </button>
                <button
                  type="button"
                  disabled={
                    togglingId === activeMenuAdmin.id ||
                    (activeMenuAdmin.id === currentAdminId &&
                      isActiveStatus(activeMenuAdmin.status))
                  }
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-slate-800"
                  onClick={() => {
                    setConfirmStatus(activeMenuAdmin);
                    setOpenMenuId(null);
                  }}
                >
                  {isActiveStatus(activeMenuAdmin.status) ? (
                    <>
                      <Ban className="h-4 w-4" />
                      Deactivate
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Activate
                    </>
                  )}
                </button>
              </>
            )}
          </div>,
          document.body,
        )}

      {confirmStatus &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
            onClick={() => setConfirmStatus(null)}
          >
            <div
              className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-gray-100 px-5 py-4 dark:border-slate-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {isActiveStatus(confirmStatus.status)
                    ? "Deactivate admin?"
                    : "Activate admin?"}
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">
                  {isActiveStatus(confirmStatus.status)
                    ? `${confirmStatus.firstName} ${confirmStatus.lastName} will lose access until reactivated.`
                    : `${confirmStatus.firstName} ${confirmStatus.lastName} will regain platform access.`}
                </p>
              </div>
              <div className="flex justify-end gap-2 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setConfirmStatus(null)}
                  className="rounded-xl border border-gray-200 px-3.5 py-2 text-sm font-semibold dark:border-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={togglingId === confirmStatus.id}
                  onClick={() => handleToggleStatus(confirmStatus)}
                  className="rounded-xl bg-[#13538A] px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {togglingId === confirmStatus.id ? "Updating…" : "Confirm"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {detailAdmin &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
            onClick={() => setDetailAdmin(null)}
          >
            <div
              className="w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-details-title"
            >
              <div className="relative overflow-hidden bg-gradient-to-r from-[#0f3d66] via-[#13538A] to-[#1a6aad] px-5 py-5 text-white">
                <div
                  className="pointer-events-none absolute inset-0 opacity-30"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 15% 20%, rgba(255,255,255,0.25), transparent 45%), radial-gradient(circle at 85% 0%, rgba(24,182,180,0.35), transparent 40%)",
                  }}
                />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-base font-semibold ring-1 ring-white/25">
                      {getInitials(detailAdmin.firstName, detailAdmin.lastName)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-white/70">
                        Admin details
                      </p>
                      <h3
                        id="admin-details-title"
                        className="truncate text-lg font-semibold"
                      >
                        {detailAdmin.firstName} {detailAdmin.lastName}
                        {detailAdmin.id === currentAdminId ? " (you)" : ""}
                      </h3>
                      <p className="mt-0.5 truncate text-sm text-white/80">
                        {detailAdmin.email}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailAdmin(null)}
                    className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="relative mt-4 flex flex-wrap gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      isActiveStatus(detailAdmin.status)
                        ? "bg-emerald-400/20 text-emerald-100 ring-1 ring-emerald-300/40"
                        : "bg-amber-400/20 text-amber-100 ring-1 ring-amber-300/40"
                    }`}
                  >
                    {displayStatus(detailAdmin.status)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white ring-1 ring-white/20">
                    {isFullAccess(detailAdmin) ? (
                      <ShieldCheck className="h-3 w-3" />
                    ) : (
                      <Shield className="h-3 w-3" />
                    )}
                    {isFullAccess(detailAdmin) ? "Full Access" : "Custom Access"}
                  </span>
                </div>
              </div>

              <dl className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
                {[
                  {
                    label: "Email",
                    value: detailAdmin.email,
                    icon: Mail,
                  },
                  {
                    label: "Access",
                    value: isFullAccess(detailAdmin)
                      ? "Full Access"
                      : `Custom (${detailAdmin.permissions?.length || detailAdmin.permissionCount || 0})`,
                    icon: isFullAccess(detailAdmin) ? ShieldCheck : Shield,
                  },
                  {
                    label: "Created",
                    value: formatDate(detailAdmin.createdAt),
                    icon: CalendarDays,
                  },
                  {
                    label: "Last login",
                    value: formatDateTime(detailAdmin.lastLoginAt),
                    icon: Clock3,
                  },
                ].map((row) => {
                  const Icon = row.icon;
                  return (
                    <div
                      key={row.label}
                      className="rounded-xl border border-gray-100 bg-gray-50/80 px-3.5 py-3 dark:border-slate-800 dark:bg-slate-800/50"
                    >
                      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                        <Icon className="h-3.5 w-3.5" />
                        {row.label}
                      </dt>
                      <dd className="mt-1 break-all text-sm font-medium text-gray-900 dark:text-slate-100">
                        {row.value}
                      </dd>
                    </div>
                  );
                })}
              </dl>

              {!isFullAccess(detailAdmin) &&
                (detailAdmin.permissions?.length || 0) > 0 && (
                  <div className="border-t border-gray-100 px-5 pb-5 dark:border-slate-800">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Assigned permissions ({detailAdmin.permissions?.length})
                    </p>
                    <div className="max-h-36 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50/60 p-2.5 dark:border-slate-700 dark:bg-slate-800/40">
                      <div className="flex flex-wrap gap-1.5">
                        {detailAdmin.permissions?.map((key) => (
                          <span
                            key={key}
                            className="rounded-full border border-[#13538A]/15 bg-white px-2 py-0.5 text-[11px] font-medium text-[#13538A] dark:border-sky-500/30 dark:bg-slate-900 dark:text-sky-300"
                          >
                            {key
                              .replace(/_/g, " ")
                              .toLowerCase()
                              .replace(/\b\w/g, (c) => c.toUpperCase())}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 bg-gray-50/70 px-5 py-4 dark:border-slate-800 dark:bg-slate-800/40">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      navigate(`/all-super-admins/${detailAdmin.id}/edit`);
                      setDetailAdmin(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDetailAdmin(null)}
                  className="rounded-xl bg-[#13538A] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#0f4470]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default AllSuperadmin;
