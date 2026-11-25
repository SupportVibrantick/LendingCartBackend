import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Shield,
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

function getAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("broker_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getInitials(first?: string, last?: string) {
  return `${first?.charAt(0) || ""}${last?.charAt(0) || ""}`.toUpperCase() || "?";
}

function formatDate(value?: string) {
  if (!value) return "";
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

function contactTypeBadgeClass(value?: string) {
  switch (String(value || "").toUpperCase()) {
    case "LENDER":
      return "bg-emerald-100 text-emerald-700 ring-emerald-200";
    case "BROKER":
      return "bg-violet-100 text-violet-700 ring-violet-200";
    case "LOAN_OFFICER":
    case "LOAN OFFICER":
      return "bg-amber-100 text-amber-700 ring-amber-200";
    case "CO_BROKER":
    case "CO BROKER":
      return "bg-cyan-100 text-cyan-700 ring-cyan-200";
    case "PARTNER":
      return "bg-sky-100 text-sky-700 ring-sky-200";
    case "CLIENT":
    case "BORROWER":
      return "bg-teal-100 text-teal-700 ring-teal-200";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

const CONTACT_TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "LENDER", label: "Lender" },
  { value: "BROKER", label: "Broker" },
  { value: "PARTNER", label: "Partner" },
  { value: "CLIENT", label: "Client" },
  { value: "LOAN_OFFICER", label: "Loan Officer" },
  { value: "CO_BROKER", label: "Co Broker" },
] as const;

const PAGE_SIZE_OPTIONS = [10, 15, 25] as const;

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
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState("");
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
      if (typeFilter) {
        params.set("contactType", typeFilter);
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

      const rows = data.data || [];
      // Fallback client filter if API ignores contactType.
      const filtered = typeFilter
        ? rows.filter(
            (row) =>
              String(row.contactType || "").toUpperCase() ===
              typeFilter.toUpperCase(),
          )
        : rows;

      setContacts(filtered);
      setTotal(
        typeFilter && filtered.length !== rows.length
          ? filtered.length
          : (data.pagination.total ?? 0),
      );
      setTotalPages(data.pagination.totalPages || 1);

      if (page > (data.pagination.totalPages || 1) && (data.pagination.totalPages || 1) >= 1) {
        setPage(data.pagination.totalPages || 1);
      }
    } catch {
      toast.error("Failed to fetch contacts");
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, typeFilter, sortKey, sortDir]);

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
  }, [sortKey, sortDir, typeFilter]);

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

  return (
    <>
      <PageMeta title="Contacts | Broker Dashboard" description="Manage CRM contacts" />

      <div className="w-full min-w-0 space-y-4 pb-4 text-text-primary dark:text-slate-100">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="ds-page-title">Contacts</h1>
            <p className="ds-page-subtitle">
              Manage lenders, brokers, partners, and everyone in your loan
              network.
            </p>
          </div>
          {canCreateContacts ? (
            <button
              type="button"
              onClick={openCreateModal}
              className="ds-btn-primary shrink-0"
            >
              <Plus size={16} />
              Add contact
            </button>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-2.5 border-b border-border px-4 py-3.5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-center lg:min-w-0 lg:flex-1">
              <div className="group relative w-full sm:max-w-sm">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-secondary transition-colors group-focus-within:text-[#4C78F5]" />
                <input
                  type="text"
                  placeholder="Search contacts..."
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

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-text-primary outline-none transition focus:border-[#4C78F5]/50 focus:ring-2 focus:ring-[#4C78F5]/15 sm:w-[160px] dark:border-slate-700 dark:bg-slate-950"
              >
                {CONTACT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => fetchContacts()}
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
                  <th className="hidden md:table-cell">
                    <SortHeader
                      label="Company"
                      active={sortKey === "company"}
                      direction={sortDir}
                      onClick={() => toggleSort("company")}
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
                  <th className="!text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && !isSearching ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-14 text-center">
                      <div className="inline-flex items-center gap-2 text-sm text-text-secondary">
                        <Users className="h-4 w-4 animate-pulse text-[#4C78F5]" />
                        Loading contacts…
                      </div>
                    </td>
                  </tr>
                ) : !loading && contacts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="!px-5 !py-14 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#4C78F5]/10 text-[#4C78F5]">
                        <Users className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-semibold text-text-primary">
                        {search || debouncedSearch || typeFilter
                          ? "No contacts match your filters"
                          : "No contacts yet"}
                      </p>
                      <p className="mx-auto mt-1.5 max-w-sm text-xs text-text-secondary">
                        {search || debouncedSearch || typeFilter
                          ? "Try a different search term or type filter."
                          : "Add your first contact to manage lenders, brokers, and partners."}
                      </p>
                      {!search && !debouncedSearch && !typeFilter ? (
                        canCreateContacts ? (
                          <button
                            type="button"
                            onClick={openCreateModal}
                            className="ds-btn-primary mt-4 h-9 px-4 text-xs"
                          >
                            <Plus size={14} />
                            Add contact
                          </button>
                        ) : null
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSearch("");
                            setTypeFilter("");
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
                  contacts.map((contact) => {
                    const fullName =
                      `${contact.firstName} ${contact.lastName}`.trim();
                    const location = [contact.city, contact.state]
                      .filter(Boolean)
                      .join(", ");
                    const company = contact.companyName?.trim() || "";

                    return (
                      <tr key={contact.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4C78F5] text-[11px] font-semibold text-white">
                              {getInitials(contact.firstName, contact.lastName)}
                            </div>
                            <div className="min-w-0">
                              <p className="ds-table-title">
                                {fullName || "Unnamed"}
                              </p>
                              <p className="ds-table-meta">
                                {contact.email || "No email"}
                              </p>
                              {contact.phone || location ? (
                                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-text-secondary/80 sm:hidden">
                                  {contact.phone ? (
                                    <>
                                      <Phone className="h-3 w-3" />
                                      {contact.phone}
                                    </>
                                  ) : (
                                    location
                                  )}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>

                        <td className="hidden sm:table-cell">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${contactTypeBadgeClass(contact.contactType)}`}
                          >
                            <Shield className="h-3 w-3" />
                            {formatContactType(contact.contactType)}
                          </span>
                        </td>

                        <td className="hidden md:table-cell">
                          {company ? (
                            <span className="inline-flex max-w-[180px] truncate rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium lowercase text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {company}
                            </span>
                          ) : (
                            <span className="text-[12px] font-medium italic text-text-secondary/70">
                              Not set
                            </span>
                          )}
                        </td>

                        <td className="hidden ds-table-muted whitespace-nowrap lg:table-cell">
                          {formatDate(contact.createdAt) || (
                            <span className="text-[12px] font-medium italic text-text-secondary/70">
                              Not set
                            </span>
                          )}
                        </td>

                        <td className="text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setViewContact(contact)}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#4C78F5] px-3 text-xs font-semibold text-white transition hover:bg-[#3B66E0]"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </button>
                            {canEditContacts ? (
                              <button
                                type="button"
                                onClick={() => openEditModal(contact)}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface dark:border-slate-700 dark:bg-slate-950"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </button>
                            ) : null}
                            <button
                              type="button"
                              data-menu-id={contact.id}
                              onClick={(event) =>
                                openRowMenu(contact.id, event)
                              }
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
                                activeMenuId === contact.id
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

          {!loading && !isSearching && contacts.length > 0 ? (
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

      {activeMenuContact &&
        activeMenuId &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: menuPos.top, left: menuPos.left }}
            className="z-[9999] max-h-[min(168px,calc(100vh-16px))] w-[168px] overflow-y-auto rounded-xl border border-border bg-white dark:border-slate-700 dark:bg-slate-950"
          >
            <div className="border-b border-border px-3 py-2 dark:border-slate-800">
              <p className="truncate text-[11px] font-semibold text-text-primary dark:text-white">
                {activeMenuContact.firstName} {activeMenuContact.lastName}
              </p>
              <p className="truncate text-[10px] text-text-secondary">
                {activeMenuContact.email}
              </p>
            </div>

            <div className="py-0.5">
              <button
                type="button"
                onClick={() => {
                  closeRowMenu();
                  setViewContact(activeMenuContact);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-primary transition hover:bg-[#4C78F5]/[0.06] dark:text-slate-200 dark:hover:bg-slate-900"
              >
                <Eye className="h-3.5 w-3.5 text-[#4C78F5]" />
                View details
              </button>
              {canEditContacts && (
                <button
                  type="button"
                  onClick={() => {
                    closeRowMenu();
                    openEditModal(activeMenuContact);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-primary transition hover:bg-[#4C78F5]/[0.06] dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  <Pencil className="h-3.5 w-3.5 text-amber-600" />
                  Edit
                </button>
              )}
            </div>

            {canDeleteContacts && (
              <div className="border-t border-border py-0.5 dark:border-slate-800">
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
