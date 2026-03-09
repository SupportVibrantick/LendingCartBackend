import { useEffect, useState } from "react";
import { Eye, Pencil, PlusCircle, Search, Trash2, Users } from "lucide-react";
import CreateContactModal from "./CreateContactModal";
import ViewContactModal from "./ViewContactModal";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

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

export default function ContactPage() {
  const [open, setOpen] = useState(false);
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

      const token = sessionStorage.getItem("broker_token");

      const res = await fetch(
        `${API_BASE}/broker/contacts/list?page=${pageNumber}&limit=${limit}`,
        {
          method: "GET",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );

      const data: ApiResponse = await res.json();

      if (data.success) {
        setContacts(data.data);
        setTotalPages(data.pagination.totalPages);
        setPage(data.pagination.page);
      }
    } catch (err) {
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

  return (
    <div className="p-6 text-gray-800 dark:text-gray-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1
          className="text-3xl font-semibold"
          style={{
            color: "var(--primary-color)",
          }}
        >
          Contacts
        </h1>
        <div className="flex items-center gap-3">
          <div className="relative ">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="text"
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border border-gray-300 dark:border-gray-700 
            bg-white dark:bg-gray-900 
            text-gray-800 dark:text-gray-200
            rounded-lg pl-9 pr-4 py-2 text-sm 
            focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            onClick={() => setOpen(true)}
            className="bg-[#2C92D5] text-white px-4 py-2 rounded-lg hover:bg-[#1e78b5] transition"
          >
            + Create Contact
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-x-auto">
        {/* Header */}
        <div
          className="grid grid-cols-6 min-w-[900px] px-6 py-4 text-xs font-semibold 
        text-gray-500 dark:text-gray-400 
        bg-[#F3F3FF] dark:bg-gray-800"
        >
          <div>NAME</div>
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
              className="grid grid-cols-6 min-w-[900px] items-center px-6 py-4 
              border-t border-gray-200 dark:border-gray-800
              hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              {/* Name */}
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full 
                bg-gray-200 dark:bg-gray-700 
                text-gray-700 dark:text-gray-200
                flex items-center justify-center text-xs font-semibold"
                >
                  {contact.firstName[0]}
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
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setViewContact(contact)}
                  className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200"
                >
                  <Eye size={16} />
                </button>

                <button className="p-2 rounded-lg bg-yellow-100 text-yellow-600 hover:bg-yellow-200">
                  <Pencil size={16} />
                </button>

                <button className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
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
          <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
            {/* Icon */}
            <div
              className="w-16 h-16 flex items-center justify-center rounded-full 
  bg-indigo-100 dark:bg-indigo-900/40 mb-4"
            >
              <Users className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            </div>

            {/* Title */}
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              No Contacts Found
            </h3>

            {/* Description */}
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
              You haven't added any contacts yet. Start by creating your first
              contact to manage lenders, brokers, and partners.
            </p>

            {/* Button */}
            <button
              onClick={() => setOpen(true)}
              className="mt-5 flex items-center gap-2 px-4 py-2 rounded-lg 
    bg-[#2C92D5] text-white text-sm font-medium 
    hover:bg-[#1e7dbc] transition shadow-sm"
            >
              <PlusCircle size={16} />
              Create Contact
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {open && (
        <CreateContactModal
          onClose={() => {
            setOpen(false);
            fetchContacts();
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
