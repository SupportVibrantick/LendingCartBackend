import { useEffect, useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import CreateContactModal from "./CreateContactModal";
import ViewContactModal from "./ViewContactModal";

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

  const fetchContacts = async () => {
    try {
      setLoading(true);

      const token = sessionStorage.getItem("broker_token");
      const res = await fetch(
        "https://api-lendingcart.vibrantick.org/broker/contacts/list",
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
      }
    } catch (err) {
      console.error("Failed to fetch contacts", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Contacts</h1>

        <button
          onClick={() => setOpen(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
        >
          + Create Contact
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        {/* Header */}
        <div className="grid grid-cols-6 min-w-[900px] px-6 py-4 text-xs font-semibold text-gray-500 bg-gray-50">
          <div>NAME</div>
          <div>EMAIL</div>
          <div>COMPANY</div>
          <div>PHONE</div>
          <div>CREATED</div>
          <div className="text-right">ACTIONS</div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="p-6 text-center text-gray-500">
            Loading contacts...
          </div>
        )}

        {/* Rows */}
        {!loading &&
          contacts.map((contact) => (
            <div
              key={contact.id}
              className="grid grid-cols-6 min-w-[900px] items-center px-6 py-4 border-t hover:bg-gray-50 transition"
            >
              {/* Name */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold">
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
              <div className="text-sm text-gray-600">{contact.email}</div>

              {/* Company */}
              <div className="text-sm text-gray-600">{contact.companyName}</div>

              {/* Phone */}
              <div className="text-sm text-gray-600">{contact.phone}</div>

              {/* Created */}
              <div className="text-sm text-gray-500">
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

        {/* Empty */}
        {!loading && contacts.length === 0 && (
          <div className="p-6 text-center text-gray-500">No contacts found</div>
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
