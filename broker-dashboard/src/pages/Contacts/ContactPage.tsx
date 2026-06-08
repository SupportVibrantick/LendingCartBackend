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
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import PageMeta from "../../components/common/PageMeta";
import CreateContactModal from "./CreateContactModal";
import ViewContactModal from "./ViewContactModal";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

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

function SortHeader({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: SortDir;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group inline-flex w-full items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 transition hover:text-[#13538A] ${
        active ? "text-[#13538A]" : ""
      }`}
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

export default function ContactPage() {
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
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });

      if (debouncedSearch) {
        params.append("search", debouncedSearch);
      }

      const res = await fetch(`${API_BASE}/broker/contacts/list?${params}`, {
        method: "GET",
        headers: getAuthHeaders(),
      });

      const data: ApiResponse = await res.json();

      if (data.success) {
        setContacts(data.data);
        setTotalPages(data.pagination.totalPages);
        setTotalCount(data.pagination.total);
        setPage(data.pagination.page);
      }
    } catch {
      toast.error("Failed to fetch contacts");
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch]);

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
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const sortedContacts = useMemo(() => {
    const list = [...contacts];

    list.sort((a, b) => {
      let cmp = 0;

      switch (sortKey) {
        case "name":
          cmp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
          break;
        case "email":
          cmp = a.email.localeCompare(b.email);
          break;
        case "company":
          cmp = (a.companyName || "").localeCompare(b.companyName || "");
          break;
        case "phone":
          cmp = (a.phone || "").localeCompare(b.phone || "");
          break;
        case "createdAt":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }

      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [contacts, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "createdAt" ? "desc" : "asc");
    }
  };

  const openCreateModal = () => {
    setEditContact(null);
    setOpen(true);
  };

  const openEditModal = (contact: Contact) => {
    setEditContact(contact);
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setEditContact(null);
    fetchContacts();
  };

  const handleDelete = async (id: string, name: string) => {
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

      <div className="space-y-6">
        {/* Hero */}
        <div className="overflow-hidden rounded-2xl border border-[#13538A]/15 bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#2C92D5] p-6 text-white shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
                CRM · Directory
              </p>
              <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Contacts</h1>
              <p className="mt-2 max-w-xl text-sm text-white/80">
                Manage lenders, brokers, partners, and everyone in your loan network.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                <p className="text-xs text-white/70">Total contacts</p>
                <p className="text-2xl font-bold">{totalCount}</p>
              </div>
              <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                <p className="text-xs text-white/70">On this page</p>
                <p className="text-2xl font-bold">{contacts.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-10 text-sm text-gray-800 outline-none transition focus:border-[#13538A]/40 focus:ring-2 focus:ring-[#13538A]/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => fetchContacts()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#13538A] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a6aad]"
          >
            <Plus className="h-4 w-4" />
            Create Contact
          </button>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {loading ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-4 px-6 py-4">
                  <div className="h-4 w-6 rounded bg-gray-100 dark:bg-gray-800" />
                  <div className="h-11 w-11 rounded-xl bg-gray-100 dark:bg-gray-800" />
                  <div className="h-4 flex-1 rounded bg-gray-100 dark:bg-gray-800" />
                  <div className="h-4 w-32 rounded bg-gray-100 dark:bg-gray-800" />
                  <div className="h-6 w-16 rounded-full bg-gray-100 dark:bg-gray-800" />
                </div>
              ))}
            </div>
          ) : sortedContacts.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#13538A]/10 text-[#13538A]">
                <Users size={24} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {search ? "No matching contacts" : "No contacts yet"}
              </h3>
              <p className="mt-1 max-w-md text-sm text-gray-500">
                {search
                  ? "Try adjusting your search terms."
                  : "Create your first contact to manage lenders, brokers, and partners."}
              </p>
              {!search && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#13538A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a6aad]"
                >
                  <Plus className="h-4 w-4" />
                  Create Contact
                </button>
              )}
            </div>
          ) : (
            <div className="max-h-[min(560px,calc(100vh-22rem))] overflow-auto">
              <table className="w-full min-w-[980px] border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-gray-50 shadow-[0_1px_0_0_rgb(229_231_235)] dark:bg-gray-800 dark:shadow-[0_1px_0_0_rgb(31_41_55)]">
                  <tr>
                    <th className="w-12 px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      #
                    </th>
                    <th className="px-4 py-3.5">
                      <SortHeader
                        label="Name"
                        active={sortKey === "name"}
                        direction={sortDir}
                        onClick={() => toggleSort("name")}
                      />
                    </th>
                    <th className="px-4 py-3.5">
                      <SortHeader
                        label="Email"
                        active={sortKey === "email"}
                        direction={sortDir}
                        onClick={() => toggleSort("email")}
                      />
                    </th>
                    <th className="px-4 py-3.5">
                      <SortHeader
                        label="Company"
                        active={sortKey === "company"}
                        direction={sortDir}
                        onClick={() => toggleSort("company")}
                      />
                    </th>
                    <th className="px-4 py-3.5">
                      <SortHeader
                        label="Phone"
                        active={sortKey === "phone"}
                        direction={sortDir}
                        onClick={() => toggleSort("phone")}
                      />
                    </th>
                    <th className="px-4 py-3.5">
                      <SortHeader
                        label="Created"
                        active={sortKey === "createdAt"}
                        direction={sortDir}
                        onClick={() => toggleSort("createdAt")}
                      />
                    </th>
                    <th className="px-4 py-3.5 text-right">
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Actions
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedContacts.map((contact, index) => {
                    const fullName = `${contact.firstName} ${contact.lastName}`.trim();
                    const location = [contact.city, contact.state].filter(Boolean).join(", ");

                    return (
                      <tr
                        key={contact.id}
                        className="group border-b border-gray-100 transition last:border-b-0 hover:bg-[#13538A]/[0.04] dark:border-gray-800 dark:hover:bg-gray-800/60"
                      >
                        <td className="px-4 py-4 text-xs font-medium text-gray-400">
                          {(page - 1) * limit + index + 1}
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <span
                              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold ring-2 ring-white dark:ring-gray-900 ${getAvatarTone(fullName)}`}
                            >
                              {getInitials(contact.firstName, contact.lastName)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-gray-900 dark:text-gray-100">
                                {fullName}
                              </p>
                              <p className="truncate text-xs text-gray-400">
                                {formatContactType(contact.contactType)}
                                {location ? ` · ${location}` : ""}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex max-w-[220px] items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-800">
                              <Mail className="h-3.5 w-3.5" />
                            </span>
                            <span className="truncate" title={contact.email}>
                              {contact.email}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex max-w-[180px] items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-800">
                              <Building2 className="h-3.5 w-3.5" />
                            </span>
                            <span className="truncate" title={contact.companyName}>
                              {contact.companyName || "—"}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-800">
                              <Phone className="h-3.5 w-3.5" />
                            </span>
                            {contact.phone || "—"}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Calendar className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                            {formatDate(contact.createdAt)}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewContact(contact)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-[#13538A] transition hover:border-[#13538A]/30 hover:bg-[#13538A]/10 dark:border-gray-700 dark:bg-gray-900"
                              title="View contact"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(contact)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-amber-600 transition hover:border-amber-200 hover:bg-amber-50 dark:border-gray-700 dark:bg-gray-900"
                              title="Edit contact"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(contact.id, fullName)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-red-600 transition hover:border-red-200 hover:bg-red-50 dark:border-gray-700 dark:bg-gray-900"
                              title="Delete contact"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && sortedContacts.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-3 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-gray-500">
                Showing{" "}
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {sortedContacts.length}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {totalCount}
                </span>{" "}
                contact(s)
              </span>
              <span className="text-xs text-gray-400">
                Sorted by {sortKey.replace("createdAt", "created")} ({sortDir})
              </span>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500">
              Page{" "}
              <span className="font-semibold text-gray-800 dark:text-gray-200">{page}</span> of{" "}
              <span className="font-semibold text-gray-800 dark:text-gray-200">{totalPages}</span>
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={page === 1 || loading}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>
              <button
                type="button"
                disabled={page === totalPages || loading}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {open && (
        <CreateContactModal contact={editContact} onClose={closeModal} />
      )}

      {viewContact && (
        <ViewContactModal contact={viewContact} onClose={() => setViewContact(null)} />
      )}
    </>
  );
}
