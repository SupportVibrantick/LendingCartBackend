import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
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

const SEARCH_DEBOUNCE_MS = 350;
const PAGE_SIZE = 10;

const AVATAR_TONES = [
  "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
];

const TYPE_TONES: Record<string, string> = {
  ATTORNEY:
    "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/30",
  LENDER:
    "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
  BROKER:
    "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30",
  TITLE_COMPANY:
    "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
  APPRAISER:
    "bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/30",
  INSURANCE:
    "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30",
  OTHER:
    "bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-600",
};

function getInitials(first?: string, last?: string) {
  return (
    `${first?.charAt(0) || ""}${last?.charAt(0) || ""}`.toUpperCase() || "?"
  );
}

function getAvatarTone(seed: string) {
  const index = seed
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_TONES[index % AVATAR_TONES.length];
}

function formatContactType(value?: string) {
  if (!value) return "Contact";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function typeTone(value?: string) {
  if (!value) return TYPE_TONES.OTHER;
  return TYPE_TONES[value.toUpperCase()] || TYPE_TONES.OTHER;
}

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 backdrop-blur-sm">
      <span className="text-white/80">{icon}</span>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-white/70">
          {label}
        </p>
        <p className="text-lg font-bold leading-tight text-white">{value}</p>
      </div>
    </div>
  );
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
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchContacts = useCallback(
    async (pageNumber = 1, searchTerm = "") => {
      const config = getContactsPortalConfig(portal);
      try {
        setLoading(true);

        const res = await fetch(
          config.listUrl(pageNumber, PAGE_SIZE, searchTerm),
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
        }
      } catch (err) {
        if (isSessionExpiredError(err)) return;
        console.error("Failed to fetch contacts", err);
        toast.error("Failed to load contacts");
      } finally {
        setLoading(false);
      }
    },
    [portal],
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
    fetchContacts(page, debouncedSearch);
  }, [page, debouncedSearch, fetchContacts]);

  const typeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const contact of contacts) {
      const key = contact.contactType || "OTHER";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    if (!typeFilter) return contacts;
    return contacts.filter(
      (c) => (c.contactType || "OTHER").toUpperCase() === typeFilter,
    );
  }, [contacts, typeFilter]);

  const isSearching = search.trim() !== debouncedSearch;

  const handleDelete = async (contact: Contact) => {
    if (!canDeleteContacts) {
      toast.error("You don't have permission to delete contacts");
      return;
    }

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
      fetchContacts(page, debouncedSearch);
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

  const pageTitle =
    portal === "coBroker"
      ? "Contacts | Co-Broker Portal"
      : "Contacts | Loan Officer Portal";

  return (
    <>
      <PageMeta title={pageTitle} description={portalConfig.heroDescription} />

      <div className="space-y-5 text-gray-800 dark:text-gray-200">
        <section className="overflow-hidden rounded-2xl border border-[#13538A]/15 bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#2C92D5] p-6 text-white shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
                {portalConfig.heroEyebrow}
              </p>
              <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
                My Contacts
              </h1>
              <p className="mt-2 max-w-xl text-sm text-white/80">
                {portalConfig.heroDescription}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatChip
                icon={<Users className="h-3.5 w-3.5" />}
                label="Total contacts"
                value={loading && total === 0 ? "—" : total}
              />
              <StatChip
                icon={<Building2 className="h-3.5 w-3.5" />}
                label="On this page"
                value={loading ? "—" : filteredContacts.length}
              />
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-100 p-4 dark:border-gray-800 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full sm:max-w-md lg:flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, phone, or company..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-10 text-sm outline-none transition focus:border-[#13538A]/40 focus:bg-white focus:ring-2 focus:ring-[#13538A]/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
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

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchContacts(page, debouncedSearch)}
                  disabled={loading || isSearching}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </button>
                {canCreateContacts && (
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#13538A] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a6aad]"
                  >
                    <Plus className="h-4 w-4" />
                    Create Contact
                  </button>
                )}
              </div>
            </div>

            {(typeOptions.length > 0 || typeFilter) && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-gray-500">Type:</span>
                <button
                  type="button"
                  onClick={() => setTypeFilter("")}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    !typeFilter
                      ? "bg-[#13538A] text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                >
                  All
                </button>
                {typeOptions.map(([type, count]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() =>
                      setTypeFilter((prev) =>
                        prev === type.toUpperCase() ? "" : type.toUpperCase(),
                      )
                    }
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                      typeFilter === type.toUpperCase()
                        ? "bg-[#13538A] text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                  >
                    {formatContactType(type)}
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                        typeFilter === type.toUpperCase()
                          ? "bg-white/20"
                          : "bg-white dark:bg-gray-900"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/60 px-4 py-2.5 dark:border-gray-800 dark:bg-gray-800/40 sm:px-5">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {loading || isSearching ? (
                isSearching ? "Searching..." : "Loading contacts..."
              ) : (
                <>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {typeFilter ? filteredContacts.length : total}
                  </span>{" "}
                  contact
                  {(typeFilter ? filteredContacts.length : total) === 1
                    ? ""
                    : "s"}
                  {debouncedSearch ? ` matching "${debouncedSearch}"` : ""}
                  {typeFilter
                    ? ` · ${formatContactType(typeFilter)}`
                    : ""}
                </>
              )}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  <th className="px-5 py-3.5">Name</th>
                  <th className="px-5 py-3.5">Contact</th>
                  <th className="px-5 py-3.5">Company</th>
                  <th className="px-5 py-3.5">Location</th>
                  <th className="px-5 py-3.5">Created</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-5 py-4" colSpan={6}>
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-xl bg-gray-100 dark:bg-gray-800" />
                          <div className="h-4 w-40 rounded bg-gray-100 dark:bg-gray-800" />
                          <div className="ml-auto h-4 w-24 rounded bg-gray-100 dark:bg-gray-800" />
                        </div>
                      </td>
                    </tr>
                  ))}

                {!loading &&
                  filteredContacts.map((contact) => {
                    const fullName =
                      `${contact.firstName || ""} ${contact.lastName || ""}`.trim() ||
                      "Unnamed";
                    const location = [contact.city, contact.state]
                      .filter(Boolean)
                      .join(", ");

                    return (
                      <tr
                        key={contact.id}
                        className="group transition hover:bg-slate-50/80 dark:hover:bg-gray-800/40"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${getAvatarTone(
                                contact.id || fullName,
                              )}`}
                            >
                              {getInitials(contact.firstName, contact.lastName)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                {fullName}
                              </p>
                              <span
                                className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${typeTone(
                                  contact.contactType,
                                )}`}
                              >
                                {formatContactType(contact.contactType)}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="space-y-1.5">
                            {contact.email ? (
                              <a
                                href={`mailto:${contact.email}`}
                                className="flex max-w-[220px] items-center gap-1.5 truncate text-sm text-gray-600 transition hover:text-[#13538A] dark:text-gray-300"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                                <span className="truncate">{contact.email}</span>
                              </a>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                            {contact.phone ? (
                              <a
                                href={`tel:${contact.phone}`}
                                className="flex items-center gap-1.5 text-sm text-gray-600 transition hover:text-[#13538A] dark:text-gray-300"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                                {contact.phone}
                              </a>
                            ) : null}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex max-w-[200px] items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                            {contact.companyName ? (
                              <>
                                <Building2 className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                                <span className="truncate">
                                  {contact.companyName}
                                </span>
                              </>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          {location ? (
                            <div className="flex max-w-[160px] items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                              <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                              <span className="truncate">{location}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(contact.createdAt)}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1 opacity-80 transition group-hover:opacity-100">
                            <button
                              type="button"
                              title="View"
                              onClick={() => setViewContact(contact)}
                              className="rounded-lg p-2 text-gray-500 transition hover:bg-[#13538A]/10 hover:text-[#13538A]"
                            >
                              <Eye size={16} />
                            </button>
                            {canEditContacts && (
                              <button
                                type="button"
                                title="Edit"
                                onClick={() => openEditModal(contact)}
                                className="rounded-lg p-2 text-gray-500 transition hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-500/10"
                              >
                                <Pencil size={16} />
                              </button>
                            )}
                            {canDeleteContacts && (
                              <button
                                type="button"
                                title="Delete"
                                onClick={() => handleDelete(contact)}
                                className="rounded-lg p-2 text-gray-500 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {!loading && filteredContacts.length === 0 && (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#13538A]/10 text-[#13538A]">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {search || typeFilter
                  ? "No matching contacts"
                  : "No contacts yet"}
              </h3>
              <p className="mt-1 max-w-sm text-sm text-gray-500">
                {search || typeFilter
                  ? "Try adjusting your search or type filter."
                  : "Create your first contact to manage lenders, brokers, and partners."}
              </p>
              {!search && !typeFilter && canCreateContacts && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#13538A] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1a6aad]"
                >
                  <Plus className="h-4 w-4" />
                  Create Contact
                </button>
              )}
            </div>
          )}

          {!loading && filteredContacts.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Page{" "}
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {page}
                </span>{" "}
                of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </section>

        {(open || editContact) && (
          <CreateContactModal
            portal={portal}
            contact={editContact}
            onClose={() => {
              setOpen(false);
              setEditContact(null);
              fetchContacts(page, debouncedSearch);
            }}
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
      </div>
    </>
  );
}
