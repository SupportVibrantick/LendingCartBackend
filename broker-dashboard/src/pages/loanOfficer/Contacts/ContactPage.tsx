import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import PageMeta from "../../../components/common/PageMeta";
import CreateContactModal from "./CreateContactModal";
import ViewContactModal from "./ViewContactModal";
import { isSessionExpiredError } from "../../../lib/sessionExpiry";
import {
  getContactsPortalConfig,
  type ContactsPortal,
} from "../../../lib/contactsPortal";

type ContactPageProps = {
  portal?: ContactsPortal;
};

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

const SEARCH_DEBOUNCE_MS = 400;
const ACTION_MENU_WIDTH = 168;
const ACTION_MENU_HEIGHT = 168;
const PAGE_SIZE_OPTIONS = [10, 15, 25] as const;

const CONTACT_TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "LENDER", label: "Lender" },
  { value: "BROKER", label: "Broker" },
  { value: "PARTNER", label: "Partner" },
  { value: "CLIENT", label: "Client" },
  { value: "LOAN_OFFICER", label: "Loan Officer" },
  { value: "CO_BROKER", label: "Co Broker" },
  { value: "ATTORNEY", label: "Attorney" },
  { value: "TITLE_COMPANY", label: "Title Company" },
  { value: "APPRAISER", label: "Appraiser" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "OTHER", label: "Other" },
] as const;

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

function getInitials(first?: string, last?: string) {
  return (
    `${first?.charAt(0) || ""}${last?.charAt(0) || ""}`.toUpperCase() || "?"
  );
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
    case "ATTORNEY":
      return "bg-violet-100 text-violet-700 ring-violet-200";
    case "TITLE_COMPANY":
      return "bg-amber-100 text-amber-700 ring-amber-200";
    case "APPRAISER":
      return "bg-indigo-100 text-indigo-700 ring-indigo-200";
    case "INSURANCE":
      return "bg-rose-100 text-rose-700 ring-rose-200";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

export default function ContactPage({
  portal = "loanOfficer",
}: ContactPageProps) {
  const portalConfig = getContactsPortalConfig(portal);
  const canCreateContacts = portalConfig.canCreate;
  const canEditContacts = portalConfig.canEdit;
  const canDeleteContacts = portalConfig.canDelete;

  const [open, setOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewContact, setViewContact] = useState<Contact | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
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

  const fetchContacts = useCallback(
    async (pageNumber = page, searchTerm = debouncedSearch, pageLimit = limit) => {
      const config = getContactsPortalConfig(portal);
      try {
        setLoading(true);

        const res = await fetch(
          config.listUrl(pageNumber, pageLimit, searchTerm),
          {
            method: "GET",
            headers: config.getHeaders(false),
          },
        );

        const data: ApiResponse = await res.json();
        config.checkResponse(res, data as { message?: string });

        if (data.success) {
          setContacts(data.data || []);
          setTotal(data.pagination?.total ?? data.data?.length ?? 0);
          setTotalPages(data.pagination?.totalPages || 1);
          setPage(data.pagination?.page || pageNumber);
        } else {
          setContacts([]);
          setTotal(0);
          setTotalPages(1);
          toast.error("Failed to fetch contacts");
        }
      } catch (err) {
        if (isSessionExpiredError(err)) return;
        console.error("Failed to fetch contacts", err);
        toast.error("Failed to load contacts");
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, limit, page, portal],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = search.trim();
      setDebouncedSearch((prev) => {
        if (prev !== next) setPage(1);
        return next;
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    void fetchContacts(page, debouncedSearch, limit);
  }, [page, debouncedSearch, limit, fetchContacts]);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, limit]);

  const isSearching = search.trim() !== debouncedSearch;

  const displayedContacts = useMemo(() => {
    const filtered = typeFilter
      ? contacts.filter(
          (c) =>
            String(c.contactType || "OTHER").toUpperCase() ===
            typeFilter.toUpperCase(),
        )
      : contacts;

    const sorted = [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const nameA = `${a.firstName || ""} ${a.lastName || ""}`.trim();
      const nameB = `${b.firstName || ""} ${b.lastName || ""}`.trim();

      switch (sortKey) {
        case "name":
          return nameA.localeCompare(nameB) * dir;
        case "email":
          return (a.email || "").localeCompare(b.email || "") * dir;
        case "company":
          return (a.companyName || "").localeCompare(b.companyName || "") * dir;
        case "phone":
          return (a.phone || "").localeCompare(b.phone || "") * dir;
        case "createdAt":
        default: {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return (ta - tb) * dir;
        }
      }
    });

    return sorted;
  }, [contacts, sortDir, sortKey, typeFilter]);

  const activeMenuContact = useMemo(
    () => displayedContacts.find((c) => c.id === activeMenuId) || null,
    [activeMenuId, displayedContacts],
  );

  const displayTotal = typeFilter ? displayedContacts.length : total;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "createdAt" ? "desc" : "asc");
  };

  const closeRowMenu = () => setActiveMenuId(null);

  const openRowMenu = (id: string, event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setMenuPos(computeActionMenuPosition(rect));
    setActiveMenuId((prev) => (prev === id ? null : id));
  };

  useEffect(() => {
    if (!activeMenuId) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.(`[data-menu-id="${activeMenuId}"]`)) return;
      if (menuRef.current?.contains(event.target as Node)) return;
      closeRowMenu();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRowMenu();
    };

    const onScroll = () => closeRowMenu();

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [activeMenuId]);

  const handleDelete = async (contact: Contact) => {
    if (!canDeleteContacts) {
      toast.error("You don't have permission to delete contacts");
      return;
    }

    closeRowMenu();

    const result = await Swal.fire({
      title: "Delete contact?",
      text: `${contact.firstName} ${contact.lastName} will be removed.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Delete",
      customClass: { popup: "rounded-2xl" },
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(portalConfig.deleteUrl(contact.id), {
        method: "DELETE",
        headers: portalConfig.getHeaders(false),
      });
      const json = await res.json();
      portalConfig.checkResponse(res, json);
      if (!res.ok || json.success === false) {
        throw new Error(json.message || "Delete failed");
      }
      toast.success("Contact deleted");
      void fetchContacts(page, debouncedSearch, limit);
    } catch (err: unknown) {
      if (isSessionExpiredError(err)) return;
      toast.error(err instanceof Error ? err.message : "Delete failed");
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
    void fetchContacts(page, debouncedSearch, limit);
  };

  const pageTitle =
    portal === "coBroker"
      ? "Contacts | Co-Broker Portal"
      : "Contacts | Loan Officer Portal";

  return (
    <>
      <PageMeta title={pageTitle} description={portalConfig.heroDescription} />

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
                onClick={() => fetchContacts(page, debouncedSearch, limit)}
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
                ) : !loading && displayedContacts.length === 0 ? (
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
                  displayedContacts.map((contact) => {
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

          {!loading && !isSearching && displayedContacts.length > 0 ? (
            <div className="flex flex-col gap-3 border-t border-border px-4 py-3.5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-[13px] text-text-secondary">
                Showing{" "}
                <span className="font-semibold text-text-primary">
                  {displayTotal === 0 ? 0 : (page - 1) * limit + 1}
                </span>
                –
                <span className="font-semibold text-text-primary">
                  {Math.min(page * limit, displayTotal)}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-text-primary">
                  {displayTotal}
                </span>
              </p>

              {!typeFilter && totalPages > 1 ? (
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
              {canEditContacts ? (
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
              ) : null}
            </div>

            {canDeleteContacts ? (
              <div className="border-t border-border py-0.5 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => void handleDelete(activeMenuContact)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            ) : null}
          </div>,
          document.body,
        )}

      {(open || editContact) && (
        <CreateContactModal
          portal={portal}
          contact={editContact}
          onClose={closeModal}
        />
      )}

      {viewContact && (
        <ViewContactModal
          contact={viewContact}
          onClose={() => setViewContact(null)}
          onEdit={
            canEditContacts
              ? () => {
                  const contact = viewContact;
                  setViewContact(null);
                  openEditModal(contact);
                }
              : undefined
          }
        />
      )}
    </>
  );
}
