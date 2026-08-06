import { useEffect, useState } from "react";
import { Eye, Pencil, Plus, RefreshCw, Search, Trash2, Users, X } from "lucide-react";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
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

export default function ContactPage({ portal = "loanOfficer" }: ContactPageProps) {
  const portalConfig = getContactsPortalConfig(portal);
  const canCreateContacts = portalConfig.canCreate;
  const canEditContacts = portalConfig.canEdit;
  const canDeleteContacts = portalConfig.canDelete;

  const [open, setOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewContact, setViewContact] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(5);
  const [totalPages, setTotalPages] = useState(1);

  const fetchContacts = async (pageNumber = 1) => {
    try {
      setLoading(true);

      const res = await fetch(portalConfig.listUrl(pageNumber, limit), {
        method: "GET",
        headers: portalConfig.getHeaders(false),
      });

      const data: ApiResponse = await res.json();
      portalConfig.checkResponse(res, data as { message?: string });

      if (data.success) {
        setContacts(data.data);
        setTotalPages(data.pagination.totalPages);
        setPage(data.pagination.page);
      }
    } catch (err) {
      if (isSessionExpiredError(err)) return;
      console.error("Failed to fetch contacts", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts(page);
  }, [page]);

  const filteredContacts = contacts.filter((c) => {
    const q = search.toLowerCase();

    return (
      c.firstName?.toLowerCase().includes(q) ||
      c.lastName?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.companyName?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.city?.toLowerCase().includes(q) ||
      c.state?.toLowerCase().includes(q)
    );
  });

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
      confirmButtonColor: "#13538A",
      confirmButtonText: "Delete",
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
      fetchContacts(page);
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

  return (
    <div className="space-y-6 text-gray-800 dark:text-gray-200">
      {/* Hero */}
      <div className="overflow-hidden rounded-2xl border border-[#13538A]/15 bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#2C92D5] p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
              {portalConfig.heroEyebrow}
            </p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">My Contacts</h1>
            <p className="mt-2 max-w-xl text-sm text-white/80">
              {portalConfig.heroDescription}
            </p>
          </div>
          <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
            <p className="text-xs text-white/70">Total contacts</p>
            <p className="text-2xl font-bold">{contacts.length}</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchContacts(page)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {canCreateContacts && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-xl bg-[#13538A] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a6aad]"
            >
              <Plus className="h-4 w-4" />
              Create Contact
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">        {/* Header */}
        <div className="grid min-w-[900px] grid-cols-6 bg-gray-50 px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:bg-gray-800 dark:text-gray-400">          <div>NAME</div>
          <div>EMAIL</div>
          <div>COMPANY</div>
          <div>PHONE</div>
          <div>CREATED</div>
          <div className="text-right">ACTIONS</div>
        </div>

        {/* Loading */}
        {loading &&
          Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}

        {/* Rows */}
        {!loading &&
          filteredContacts.map((contact) => (
            <div
              key={contact.id}
              className="grid min-w-[900px] grid-cols-6 items-center border-t border-gray-100 px-6 py-4 transition hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"            >
              {/* Name */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#13538A]/10 text-xs font-semibold text-[#13538A]">                  {contact.firstName[0]}
                </div>

                <div>
                  <div className="font-medium text-sm">
                    {contact.firstName} {contact.lastName}
                  </div>

                  <div className="text-xs text-gray-400">
                    {contact.contactType.replace(/_/g, " ")}
                  </div>
                </div>
              </div>

              {/* Email */}
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {contact.email}
              </div>

              {/* Company */}
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {contact.companyName}
              </div>

              {/* Phone */}
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {contact.phone}
              </div>

              {/* Created */}
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {new Date(contact.createdAt).toLocaleDateString()}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setViewContact(contact)}
                  className="rounded-lg p-2 text-gray-500 transition hover:bg-[#13538A]/10 hover:text-[#13538A]"
                >
                  <Eye size={16} />
                </button>

                {canEditContacts && (
                  <button
                    type="button"
                    onClick={() => openEditModal(contact)}
                    className="rounded-lg p-2 text-gray-500 transition hover:bg-amber-50 hover:text-amber-600"
                  >
                    <Pencil size={16} />
                  </button>
                )}

                {canDeleteContacts && (
                  <button
                    type="button"
                    onClick={() => handleDelete(contact)}
                    className="rounded-lg p-2 text-gray-500 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>            </div>
          ))}

        {/* Pagination */}
        {filteredContacts.length > 0 && (
          <div className="px-4 flex items-center justify-between mt-4 pb-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Page {page} of {totalPages}
            </span>

            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 border border-gray-300 dark:border-gray-700 
      bg-white dark:bg-gray-900
      text-gray-700 dark:text-gray-200
      rounded disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Previous
              </button>

              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 border border-gray-300 dark:border-gray-700 
      bg-white dark:bg-gray-900
      text-gray-700 dark:text-gray-200
      rounded disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Empty */}
        {!loading && filteredContacts.length === 0 && (
          <div className="flex flex-col items-center px-6 py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#13538A]/10 text-[#13538A]">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {search ? "No matching contacts" : "No contacts yet"}
            </h3>
            <p className="mt-1 max-w-sm text-sm text-gray-500">
              {search
                ? "Try adjusting your search terms."
                : "Create your first contact to manage lenders, brokers, and partners."}
            </p>
            {!search && canCreateContacts && (
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
        )}
        </div>
      </div>

      {/* Modal */}
      {(open || editContact) && (
        <CreateContactModal
          portal={portal}
          contact={editContact}
          onClose={() => {
            setOpen(false);
            setEditContact(null);
            fetchContacts(page);
          }}
        />
      )}

      {viewContact && (
        <ViewContactModal
          contact={viewContact}
          onClose={() => setViewContact(null)}
        />
      )}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="grid grid-cols-6 min-w-[900px] items-center px-6 py-4 border-t border-gray-200 dark:border-gray-800 animate-pulse">
      {/* Name */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700"></div>

        <div className="space-y-2">
          <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-2 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>

      {/* Email */}
      <div className="h-3 w-40 bg-gray-200 dark:bg-gray-700 rounded"></div>

      {/* Company */}
      <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>

      {/* Phone */}
      <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>

      {/* Created */}
      <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <div className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-700"></div>
        <div className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-700"></div>
        <div className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-700"></div>
      </div>
    </div>
  );
}
