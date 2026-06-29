import {
  ArrowUpDown,
  Calendar,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  Mail,
  Pencil,
  Phone,
  Plus,
  Power,
  RefreshCw,
  Search,
  Trash2,
  MoreVertical,
  UserCheck,
  Users,
  UserX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import PageMeta from "../../components/common/PageMeta";
import CoBrokerFormModal from "../../components/coBroker/CoBrokerFormModal";
import CoBrokerDetailsModal from "../../components/coBroker/CoBrokerDetailsModal";
import type { CoBrokerDetail } from "../../lib/coBrokerForm";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

interface SubBrokerUser extends CoBrokerDetail {
  createdById: string | null;
}

const AVATAR_TONES = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
];

function getAuthHeaders(options?: { json?: boolean }): Record<string, string> {
  const token = sessionStorage.getItem("broker_token");
  return {
    ...(options?.json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

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
      className={`group inline-flex w-full items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 transition hover:text-[#13538A] ${
        align === "right" ? "justify-end" : "justify-start"
      } ${active ? "text-[#13538A]" : ""}`}
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


export default function SubBroker() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [officers, setOfficers] = useState<SubBrokerUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState<"" | "ACTIVE" | "DISABLED">("");
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [formModalMode, setFormModalMode] = useState<"create" | "edit">("create");
  const [editSubBrokerId, setEditSubBrokerId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [viewSubBroker, setViewSubBroker] = useState<SubBrokerUser | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const fetchOfficers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/broker/sub-broker/list`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || "Failed to fetch Co Brokers");
        return;
      }
      setOfficers(json.data || []);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

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
  }, [search]);

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

  const openRowMenu = (id: string, event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setMenuPos(computeActionMenuPosition(event.currentTarget.getBoundingClientRect()));
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

  const filteredOfficers = useMemo(() => {
    let list = officers;

    if (statusFilter) {
      list = list.filter((o) => o.status === statusFilter);
    }

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter((o) =>
        [o.firstName, o.lastName, o.email, o.phone || ""]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }

    return list;
  }, [officers, debouncedSearch, statusFilter]);

  const sortedOfficers = useMemo(() => {
    const list = [...filteredOfficers];

    list.sort((a, b) => {
      let cmp = 0;

      switch (sortKey) {
        case "name":
          cmp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
          break;
        case "email":
          cmp = a.email.localeCompare(b.email);
          break;
        case "phone":
          cmp = (a.phone || "").localeCompare(b.phone || "");
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "createdAt":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }

      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [filteredOfficers, sortKey, sortDir]);

  const activeMenuUser = useMemo(
    () => sortedOfficers.find((o) => o.id === activeMenuId) ?? null,
    [sortedOfficers, activeMenuId],
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "createdAt" ? "desc" : "asc");
    }
  };

  const stats = useMemo(
    () => ({
      total: officers.length,
      active: officers.filter((o) => o.status === "ACTIVE").length,
      disabled: officers.filter((o) => o.status !== "ACTIVE").length,
    }),
    [officers]
  );

  const handleImpersonate = async (officer: SubBrokerUser) => {
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

      const query = new URLSearchParams({
        token: json.token,
        user: JSON.stringify(json.user),
        redirectTo: json.redirectTo || "/sub-broker/loan-pipeline",
      });
      if (json.branding) {
        query.set("branding", JSON.stringify(json.branding));
      }

      const portalUrl = `/sub-broker/impersonate?${query.toString()}`;
      const newTab = window.open(portalUrl, "_blank", "noopener,noreferrer");

      if (!newTab) {
        toast.error("Pop-up blocked. Allow pop-ups to open the co-broker portal.");
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

  const toggleStatus = async (id: string, currentStatus: string) => {
    try {
      setTogglingId(id);
      const newStatus = currentStatus === "ACTIVE" ? "DISABLED" : "ACTIVE";

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

      toast.success(`Co Brokers ${newStatus === "ACTIVE" ? "activated" : "disabled"}`);
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

      const res = await fetch(`${API_BASE}/broker/sub-broker/${id}`, {
        headers: getAuthHeaders(),
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
    setFormModalMode("edit");
    setEditSubBrokerId(id);
    setFormModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const isDark = document.documentElement.classList.contains("dark");

    const result = await Swal.fire({
      title: "Delete Co Brokers?",
      text: "This Co Brokers will be removed and will no longer be able to sign in.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete",
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
      setDeletingId(id);
      const res = await fetch(`${API_BASE}/broker/sub-broker/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.message || "Failed to delete Co Brokers");
        return;
      }

      if (viewSubBroker?.id === id) setViewSubBroker(null);
      closeRowMenu();

      await Swal.fire({
        title: "Deleted",
        text: "Co Brokers has been deleted successfully.",
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

      fetchOfficers();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setDeletingId(null);
    }
  };

  const openCreateModal = () => {
    setFormModalMode("create");
    setEditSubBrokerId(null);
    setFormModalOpen(true);
  };

  const closeFormModal = () => {
    setFormModalOpen(false);
    setEditSubBrokerId(null);
  };

  return (
    <>
      <PageMeta title="Co Brokers | Broker Dashboard" description="Manage Co Brokers" />

      <div className="space-y-4 pb-6">
        {/* Hero */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#2C92D5] p-4 text-white shadow-sm dark:border-gray-800 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-medium backdrop-blur-sm">
                <Users className="h-3 w-3" />
                CRM · Team
              </div>
              <h1 className="text-xl font-semibold tracking-tight">Co Brokers</h1>
              <p className="mt-1 max-w-2xl text-xs text-white/80">
                Manage Co Brokers, control access, and monitor their activity from one place. 
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Total", value: stats.total, icon: Users },
                { label: "Active", value: stats.active, icon: UserCheck },
                { label: "Disabled", value: stats.disabled, icon: UserX },
              ].map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/20 backdrop-blur-sm"
                >
                  <div className="flex items-center gap-1.5 text-white/70">
                    <Icon className="h-3 w-3" />
                    <span className="text-[10px]">{label}</span>
                  </div>
                  <p className="mt-0.5 text-lg font-semibold">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                placeholder="Search by name, email, or phone..."
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
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fetchOfficers()}
                disabled={loading}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>

              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#13538A] px-3 text-xs font-medium text-white shadow-sm hover:bg-[#1a6aad]"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Co Brokers
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-0.5">
            <span className="shrink-0 text-[10px] font-medium text-gray-500">Status:</span>
            {(["", "ACTIVE", "DISABLED"] as const).map((status) => (
              <button
                key={status || "all"}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium transition ${
                  statusFilter === status
                    ? "bg-[#13538A] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                }`}
              >
                {status || "All"}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {loading ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-4 px-6 py-4">
                  <div className="h-4 w-6 rounded bg-gray-100 dark:bg-gray-800" />
                  <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-800" />
                  <div className="h-4 flex-1 rounded bg-gray-100 dark:bg-gray-800" />
                  <div className="h-4 w-32 rounded bg-gray-100 dark:bg-gray-800" />
                  <div className="h-6 w-16 rounded-full bg-gray-100 dark:bg-gray-800" />
                </div>
              ))}
            </div>
          ) : sortedOfficers.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#13538A]/10 text-[#13538A]">
                <Users size={24} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {search || statusFilter ? "No matching Co Brokers" : "No Co Brokers yet"}
              </h3>
              <p className="mt-1 max-w-md text-sm text-gray-500">
                {search || statusFilter
                  ? "Try adjusting your search or status filter."
                  : "Create your first Co Brokers to delegate loan pipeline work."}
              </p>
              {!search && !statusFilter && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#13538A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a6aad]"
                >
                  <Plus className="h-4 w-4" />
                  Create Co Brokers
                </button>
              )}
            </div>
          ) : (
            <div className="max-h-[calc(100vh-15rem)] overflow-y-auto overflow-x-hidden">
              <table className="w-full table-fixed border-collapse text-left text-xs">
                <colgroup>
                  <col className="w-12" />
                  <col className="w-[24%]" />
                  <col className="w-[30%]" />
                  <col className="w-[14%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                  <col className="w-14" />
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
                        label="Status"
                        active={sortKey === "status"}
                        direction={sortDir}
                        onClick={() => toggleSort("status")}
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
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Actions
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {sortedOfficers.map((o, index) => {
                    const fullName = `${o.firstName} ${o.lastName}`.trim();
                    const isActive = o.status === "ACTIVE";

                    return (
                      <tr
                        key={o.id}
                        className={`group transition-colors ${
                          isActive
                            ? "hover:bg-[#13538A]/[0.03] dark:hover:bg-gray-800/40"
                            : "bg-gray-50/50 hover:bg-gray-100/70 dark:bg-gray-900/20 dark:hover:bg-gray-800/40"
                        }`}
                      >
                        <td className="px-4 py-2.5 text-[11px] font-medium tabular-nums text-gray-400">
                          {index + 1}
                        </td>

                        <td className="px-4 py-2.5">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span
                              className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ring-1 ring-gray-200/80 dark:ring-gray-700 ${getAvatarTone(fullName)}`}
                            >
                              {getInitials(o.firstName, o.lastName)}
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white dark:border-gray-900 ${
                                  isActive ? "bg-emerald-500" : "bg-gray-400"
                                }`}
                              />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-gray-900 dark:text-gray-100">
                                {fullName}
                              </p>
                              <p className="truncate text-[10px] text-gray-400">Co Brokers</p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-2.5">
                          <a
                            href={`mailto:${o.email}`}
                            className="flex min-w-0 items-center gap-1.5 text-xs text-gray-600 transition hover:text-[#13538A] dark:text-gray-300 dark:hover:text-cyan-400"
                            title={o.email}
                          >
                            <Mail className="h-3 w-3 shrink-0 text-gray-400" />
                            <span className="truncate">{o.email}</span>
                          </a>
                        </td>

                        <td className="px-4 py-2.5">
                          {o.phone ? (
                            <a
                              href={`tel:${o.phone}`}
                              className="inline-flex items-center gap-1.5 text-xs text-gray-600 transition hover:text-[#13538A] dark:text-gray-300 dark:hover:text-cyan-400"
                            >
                              <Phone className="h-3 w-3 shrink-0 text-gray-400" />
                              {formatPhone(o.phone)}
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>

                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            disabled={togglingId === o.id}
                            onClick={() => toggleStatus(o.id, o.status)}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition disabled:opacity-50 ${
                              isActive
                                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30"
                                : "bg-gray-100 text-gray-600 ring-1 ring-gray-200 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700"
                            }`}
                            title="Click to toggle status"
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                isActive ? "bg-emerald-500" : "bg-gray-400"
                              }`}
                            />
                            {togglingId === o.id ? "..." : isActive ? "Active" : "Disabled"}
                          </button>
                        </td>

                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <Calendar className="h-3 w-3 shrink-0 opacity-70" />
                            <span className="whitespace-nowrap">{formatDate(o.createdAt)}</span>
                          </div>
                        </td>

                        <td className="px-2 py-2.5 text-right">
                          <button
                            type="button"
                            data-menu-id={o.id}
                            onClick={(event) => openRowMenu(o.id, event)}
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-gray-500 transition hover:border-gray-200 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:border-gray-700 dark:hover:bg-gray-800 dark:hover:text-white ${
                              activeMenuId === o.id
                                ? "border-gray-200 bg-gray-100 text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                : ""
                            }`}
                            title="Actions"
                            aria-label="Open actions menu"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && sortedOfficers.length > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-gray-100 bg-gray-50/50 px-4 py-2.5 text-[10px] text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing{" "}
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {sortedOfficers.length}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {officers.length}
                </span>{" "}
                Co Brokers(s)
                {statusFilter ? (
                  <>
                    {" "}
                    · filtered by{" "}
                    <span className="font-medium text-[#13538A] dark:text-cyan-400">
                      {statusFilter.toLowerCase()}
                    </span>
                  </>
                ) : null}
              </span>
              <span className="text-gray-400">
                Sorted by {sortKey.replace("createdAt", "created")} ({sortDir})
              </span>
            </div>
          )}
        </div>
      </div>

      {activeMenuUser &&
        activeMenuId &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: menuPos.top, left: menuPos.left }}
            className="z-[9999] w-[168px] max-h-[min(196px,calc(100vh-16px))] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
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
                disabled={viewLoading}
                onClick={() => {
                  closeRowMenu();
                  openViewSubBroker(activeMenuUser.id);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-800"
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
                  openEditSubBroker(activeMenuUser.id);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <Pencil className="h-3.5 w-3.5 text-amber-600" />
                Edit
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
