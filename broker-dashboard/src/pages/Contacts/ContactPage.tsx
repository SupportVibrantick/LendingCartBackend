import {
  ArrowUpDown,
  Building2,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  Mail,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  MoreVertical,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import PageMeta from "../../components/common/PageMeta";
import CreateContactModal from "./CreateContactModal";
import ViewContactModal from "./ViewContactModal";
import { hasPermission } from "../../lib/brokerPermissions";
import { isLoanOfficerPortalPath } from "../../lib/portalAuth";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const SEARCH_DEBOUNCE_MS = 400;

type Contact = {
  id: string;
  contactType: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName: string;
  city: string;
  state: string;
  createdAt: string;
};

type ApiResponse = {
  success: boolean;
  data: Contact[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

type SortKey = "name" | "email" | "company" | "phone" | "createdAt";
type SortDir = "asc" | "desc";

const ACTION_MENU_WIDTH = 168;
const ACTION_MENU_HEIGHT = 168;

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

function StatCard({
  icon: Icon,
  label,
  value,
  iconWrap,
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
  iconWrap: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3.5 dark:border-gray-800 dark:bg-gray-900">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconWrap}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {label}
        </p>
        <p className="text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
          {value}
        </p>
      </div>
    </div>
  );
}

const AVATAR_TONES = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
];

function getAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("broker_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
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

function formatContactType(value?: string) {
  if (!value) return "Contact";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const PAGE_SIZE_OPTIONS = [5, 8, 10, 20] as const;

export default function ContactPage() {
  const isLoPortal = isLoanOfficerPortalPath();
  const canCreateContacts =
    !isLoPortal || hasPermission("CREATE_CONTACTS", "loanOfficer");
  const canEditContacts =
    !isLoPortal || hasPermission("EDIT_CONTACTS", "loanOfficer");
  const canDeleteContacts =
    !isLoPortal || hasPermission("DELETE_CONTACTS", "loanOfficer");

  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [open, setOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewContact, setViewContact] = useState<Contact | null>(null);
  const [search, setSearch] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement | null>(null);

  const fetchContacts = useCallback(async () => {
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

      const res = await fetch(`${API_BASE}/broker/contacts/list?${params}`, {
        method: "GET",
        headers: getAuthHeaders(),
      });

      const data: ApiResponse = await res.json();

      if (!res.ok || !data.success) {
        toast.error("Failed to fetch contacts");
        setContacts([]);
        setTotal(0);
        setTotalPages(1);
        return;
      }

      setContacts(data.data || []);
      setTotal(data.pagination.total ?? 0);
      setTotalPages(data.pagination.totalPages || 1);

      if (page > (data.pagination.totalPages || 1) && (data.pagination.totalPages || 1) >= 1) {
        setPage(data.pagination.totalPages || 1);
      }
    } catch {
      toast.error("Failed to fetch contacts");
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
    fetchContacts();
  }, [fetchContacts]);

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

  const activeMenuContact = useMemo(
    () => contacts.find((c) => c.id === activeMenuId) ?? null,
    [contacts, activeMenuId],
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "createdAt" ? "desc" : "asc");
    }
  };

  const openCreateModal = () => {
    if (!canCreateContacts) {
      toast.error("You don't have permission to create contacts");
      return;
    }
    setEditContact(null);
    setOpen(true);
  };

  const openEditModal = (contact: Contact) => {
    if (!canEditContacts) {
      toast.error("You don't have permission to edit contacts");
      return;
    }
    setEditContact(contact);
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setEditContact(null);
    fetchContacts();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!canDeleteContacts) {
      toast.error("You don't have permission to delete contacts");
      return;
    }
    const isDark = document.documentElement.classList.contains("dark");

    const result = await Swal.fire({
      title: "Delete contact?",
      text: `"${name}" will be removed from your contact list.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
      background: isDark ? "#1e293b" : "#ffffff",
      color: isDark ? "#e2e8f0" : "#1e293b",
      customClass: { popup: "rounded-2xl" },
    });

    if (!result.isConfirmed) return;

    closeRowMenu();
    try {
      const res = await fetch(`${API_BASE}/broker/contacts/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.message || "Failed to delete contact");
        return;
      }

      toast.success("Contact deleted");
      fetchContacts();
    } catch {
      toast.error("Something went wrong");
    }
  };

  const withCompanyCount = contacts.filter((c) =>
    Boolean(c.companyName?.trim()),
  ).length;

  return (
    <>
      <PageMeta title="Contacts | Broker Dashboard" description="Manage CRM contacts" />

      <div className="space-y-4 pb-4">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#2C92D5] px-5 py-5 text-white sm:px-6 sm:py-6">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 left-1/3 h-36 w-36 rounded-full bg-cyan-300/20 blur-2xl" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 ring-1 ring-white/20">
                <Users className="h-3.5 w-3.5" />
                CRM
              </div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Contacts
              </h1>
              <p className="mt-1 max-w-xl text-sm text-white/80">
                Manage lenders, brokers, partners, and everyone in your loan
                network.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fetchContacts()}
                disabled={loading || isSearching}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
              {canCreateContacts ? (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#13538A] transition hover:bg-white/90"
                >
                  <Plus className="h-4 w-4" />
                  Create contact
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            icon={Users}
            label="Total contacts"
            value={loading ? "—" : total}
            iconWrap="bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
          />
          <StatCard
            icon={Calendar}
            label="This page"
            value={loading ? "—" : contacts.length}
            iconWrap="bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
          />
          <StatCard
            icon={Building2}
            label="With company"
            value={loading ? "—" : withCompanyCount}
            iconWrap="bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
          />
        </div>

        {/* Toolbar + table */}
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-4 py-4 dark:border-gray-800 sm:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  All contacts
                </h2>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  {loading || isSearching
                    ? isSearching
                      ? "Searching..."
                      : "Loading contacts..."
                    : `${total} contact${total === 1 ? "" : "s"}${
                        debouncedSearch ? ` matching "${debouncedSearch}"` : ""
                      }`}
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search contacts..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-10 w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/15 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                  {search ? (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-gray-400 hover:text-gray-600"
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  Per page
                  <select
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setPage(1);
                    }}
                    className="h-10 rounded-xl border border-gray-200 bg-white px-2.5 text-sm font-medium text-gray-700 outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/15 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
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
                  <div className="hidden h-4 w-24 rounded bg-gray-100 dark:bg-gray-800 lg:block" />
                  <div className="ml-auto h-8 w-8 rounded-lg bg-gray-100 dark:bg-gray-800" />
                </div>
              ))}
            </div>
          ) : !loading && contacts.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#13538A]/10 text-[#13538A]">
                <Users size={24} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {search || debouncedSearch
                  ? "No matching contacts"
                  : "No contacts yet"}
              </h3>
              <p className="mt-1 max-w-md text-sm text-gray-500">
                {search || debouncedSearch
                  ? "Try adjusting your search terms."
                  : "Create your first contact to manage lenders, brokers, and partners."}
              </p>
              {!search && !debouncedSearch && canCreateContacts ? (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#13538A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a6aad]"
                >
                  <Plus className="h-4 w-4" />
                  Create Contact
                </button>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead className="sticky top-0 z-[1] bg-slate-50/95 backdrop-blur dark:bg-gray-800/90">
                  <tr className="border-b border-gray-200 dark:border-gray-700">
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
                        label="Company"
                        active={sortKey === "company"}
                        direction={sortDir}
                        onClick={() => toggleSort("company")}
                      />
                    </th>
                    <th className="hidden px-4 py-3 text-left lg:table-cell">
                      <SortHeader
                        label="Phone"
                        active={sortKey === "phone"}
                        direction={sortDir}
                        onClick={() => toggleSort("phone")}
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
                    <th className="w-[72px] px-4 py-3 text-right">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Actions
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {contacts.map((contact, index) => {
                    const fullName =
                      `${contact.firstName} ${contact.lastName}`.trim();
                    const location = [contact.city, contact.state]
                      .filter(Boolean)
                      .join(", ");

                    return (
                      <tr
                        key={contact.id}
                        className="group transition-colors hover:bg-[#13538A]/[0.03] dark:hover:bg-gray-800/40"
                      >
                        <td className="px-4 py-3.5 text-sm font-medium tabular-nums text-gray-400">
                          {(page - 1) * limit + index + 1}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ring-1 ring-gray-200/80 dark:ring-gray-700 ${getAvatarTone(fullName)}`}
                            >
                              {getInitials(contact.firstName, contact.lastName)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {fullName || "—"}
                              </p>
                              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                {formatContactType(contact.contactType)}
                                {location ? ` · ${location}` : ""}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          {contact.email ? (
                            <a
                              href={`mailto:${contact.email}`}
                              className="flex min-w-0 max-w-full items-center gap-2 text-sm text-gray-600 transition hover:text-[#13538A] dark:text-gray-300 dark:hover:text-cyan-400"
                              title={contact.email}
                            >
                              <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                              <span className="truncate">{contact.email}</span>
                            </a>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>

                        <td className="hidden px-4 py-3.5 md:table-cell">
                          <div
                            className="flex min-w-0 items-center gap-2 text-sm text-gray-600 dark:text-gray-300"
                            title={contact.companyName}
                          >
                            <Building2 className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                            <span className="truncate">
                              {contact.companyName || "—"}
                            </span>
                          </div>
                        </td>

                        <td className="hidden px-4 py-3.5 lg:table-cell">
                          {contact.phone ? (
                            <a
                              href={`tel:${contact.phone}`}
                              className="flex min-w-0 max-w-full items-center gap-2 text-sm text-gray-600 transition hover:text-[#13538A] dark:text-gray-300 dark:hover:text-cyan-400"
                              title={contact.phone}
                            >
                              <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                              <span className="truncate">{contact.phone}</span>
                            </a>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>

                        <td className="hidden px-4 py-3.5 sm:table-cell">
                          <span
                            className="block truncate text-sm text-gray-600 dark:text-gray-300"
                            title={formatDate(contact.createdAt)}
                          >
                            {formatDate(contact.createdAt)}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            data-menu-id={contact.id}
                            onClick={(event) => openRowMenu(contact.id, event)}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                              activeMenuId === contact.id
                                ? "border-[#13538A]/30 bg-[#13538A]/5 text-[#13538A] dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-400"
                                : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:bg-gray-800 dark:hover:text-white"
                            }`}
                            title="Actions"
                            aria-label="Open actions menu"
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

          {!loading && !isSearching && contacts.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing{" "}
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {total === 0 ? 0 : (page - 1) * limit + 1}-
                  {Math.min(page * limit, total)}
                </span>{" "}
                of{" "}
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {total}
                </span>
              </p>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={page === 1 || loading}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                >
                  <span className="inline-flex items-center gap-1">
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </span>
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
                      onClick={() => setPage(pageNum)}
                      disabled={loading}
                      className={`min-w-8 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition ${
                        pageNum === page
                          ? "border-[#13538A] bg-[#13538A] text-white"
                          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  type="button"
                  disabled={page === totalPages || loading}
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                >
                  <span className="inline-flex items-center gap-1">
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {activeMenuContact &&
        activeMenuId &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: menuPos.top, left: menuPos.left }}
            className="z-[9999] w-[168px] max-h-[min(168px,calc(100vh-16px))] overflow-y-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-800">
              <p className="truncate text-[11px] font-semibold text-gray-900 dark:text-white">
                {activeMenuContact.firstName} {activeMenuContact.lastName}
              </p>
              <p className="truncate text-[10px] text-gray-500">{activeMenuContact.email}</p>
            </div>

            <div className="py-0.5">
              <button
                type="button"
                onClick={() => {
                  closeRowMenu();
                  setViewContact(activeMenuContact);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <Eye className="h-3.5 w-3.5 text-[#13538A]" />
                View details
              </button>
              {canEditContacts && (
                <button
                  type="button"
                  onClick={() => {
                    closeRowMenu();
                    openEditModal(activeMenuContact);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <Pencil className="h-3.5 w-3.5 text-amber-600" />
                  Edit
                </button>
              )}
            </div>

            {canDeleteContacts && (
            <div className="border-t border-gray-100 py-0.5 dark:border-gray-800">
              <button
                type="button"
                onClick={() =>
                  handleDelete(
                    activeMenuContact.id,
                    `${activeMenuContact.firstName} ${activeMenuContact.lastName}`.trim(),
                  )
                }
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
            )}
          </div>,
          document.body,
        )}

      {open && (
        <CreateContactModal contact={editContact} onClose={closeModal} />
      )}

      {viewContact && (
        <ViewContactModal contact={viewContact} onClose={() => setViewContact(null)} />
      )}
    </>
  );
}
