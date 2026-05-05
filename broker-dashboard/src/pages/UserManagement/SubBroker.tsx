import { Users, Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
// import Swal from "sweetalert2";

const API_BASE = import.meta.env.VITE_API_BASE || "";

interface LoanOfficer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: string;
  createdAt: string;
  createdById: string | null;
}

const initialFormState = {
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  phone: "",
};

export const PERMISSIONS = [
  {
    title: "Loan Management",
    items: [
      { label: "View Loan Pipeline", key: "VIEW_PIPELINE" },
      { label: "View Applications", key: "VIEW_APPLICATIONS" },
      { label: "Create Applications", key: "CREATE_APPLICATION" },
    ],
  },
  {
    title: "Team Management",
    items: [{ label: "Manage Loan Officers", key: "MANAGE_LOAN_OFFICERS" }],
  },
  {
    title: "Clients",
    items: [
      { label: "View Clients", key: "VIEW_CLIENTS" },
      { label: "Manage Clients", key: "MANAGE_CLIENTS" },
    ],
  },
  {
    title: "Lenders",
    items: [{ label: "View Lenders", key: "VIEW_LENDERS" }],
  },
  {
    title: "Templates & Website",
    items: [
      { label: "View Templates", key: "VIEW_TEMPLATES" },
      { label: "Manage Templates", key: "MANAGE_TEMPLATES" },
      { label: "Website Builder Access", key: "VIEW_WEBSITE_BUILDER" },
    ],
  },
  {
    title: "Settings",
    items: [
      { label: "View Settings", key: "VIEW_SETTINGS" },
      { label: "Manage Settings", key: "MANAGE_SETTINGS" },
    ],
  },
  {
    title: "Reports & Logs",
    items: [
      { label: "View Logs", key: "VIEW_LOGS" },
      { label: "View Dashboard Stats", key: "VIEW_STATS" },
    ],
  },
  {
    title: "Notifications",
    items: [{ label: "View Notifications", key: "VIEW_NOTIFICATIONS" }],
  },
];

export const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 10);

  if (digits.length < 4) return digits;
  if (digits.length < 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;

  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
};

type FormState = typeof initialFormState;

const inputStyle =
  "w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 transition-all outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600";

export default function SubBroker() {
  const [officers, setOfficers] = useState<LoanOfficer[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  //   const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  const [form, setForm] = useState(initialFormState);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({
    password: false,
    confirmPassword: false,
  });
  const [editOfficer, setEditOfficer] = useState<LoanOfficer | null>(null);

  const updateField = (key: keyof FormState, value: any) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));

    // Clear error on change
    if (errors[key]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }
  };

  // const togglePermission = (key: string) => {
  //   setSelectedPermissions((prev) =>
  //     prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
  //   );
  // };

  /* ================= STATUS ================= */
  const toggleStatus = async (id: string, currentStatus: string) => {
    try {
      setTogglingId(id);

      const token = sessionStorage.getItem("broker_token");

      const newStatus = currentStatus === "ACTIVE" ? "DISABLED" : "ACTIVE";

      const res = await fetch(`${API_BASE}/broker/sub-broker/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.message || "Failed to update status");
        return;
      }

      toast.success("Status updated successfully");

      fetchOfficers(); // refresh list
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setTogglingId(null);
    }
  };

  const fetchSubBrokerDetails = async (id: string) => {
    try {
      const token = sessionStorage.getItem("broker_token");

      const res = await fetch(`${API_BASE}/broker/sub-broker/${id}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.message || "Failed to fetch details");
        return;
      }

      const data = json.data;

      // ✅ Set form values
      setForm({
        email: data.email || "",
        password: "", // never prefill password
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        phone: data.phone || "",
      });

      setEditOfficer(data);
      setShowModal(true);
    } catch (err) {
      toast.error("Something went wrong");
    }
  };

  /* ================= FETCH ================= */

  const fetchOfficers = async () => {
    try {
      setLoading(true);

      const token = sessionStorage.getItem("broker_token");

      const res = await fetch(`${API_BASE}/broker/sub-broker/list`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.message || "Failed to fetch sub brokers");
        return;
      }

      setOfficers(json.data || []);
      setTotalPages(1);
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 500);

    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchOfficers();
  }, [page, debouncedSearch]);

  const validateForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};

    // First Name
    if (!form.firstName.trim()) {
      errors.firstName = "First name is required";
    } else if (form.firstName.length < 2) {
      errors.firstName = "Minimum 2 characters required";
    }

    // Last Name
    if (!form.lastName.trim()) {
      errors.lastName = "Last name is required";
    }

    // Email
    if (!form.email) {
      errors.email = "Email is required";
    } else if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      errors.email = "Invalid email format";
    }

    // Password
    if (!editOfficer) {
      if (!form.password) {
        errors.password = "Password is required";
      } else if (form.password.length < 6) {
        errors.password = "Minimum 6 characters required";
      }
    }

    // Phone (US)
    const cleanPhone = form.phone.replace(/\D/g, "");

    if (!cleanPhone) {
      errors.phone = "Phone is required";
    } else if (cleanPhone.length < 10) {
      errors.phone = "Enter 10-digit phone number";
    } else if (cleanPhone.length === 10 && !/^[2-9]\d{9}$/.test(cleanPhone)) {
      errors.phone = "Invalid US phone number";
    }

    return errors;
  };

  /* ================= CREATE ================= */
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validateForm();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      toast.error("Please fix form errors");
      return;
    }

    setCreating(true);

    try {
      const token = sessionStorage.getItem("broker_token"); // ✅ get token

      const res = await fetch(`${API_BASE}/broker/sub-broker/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}), // ✅ attach token
        },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone.replace(/\D/g, ""),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        if (json.message?.toLowerCase().includes("email")) {
          setErrors((prev) => ({
            ...prev,
            email: "Email already exists",
          }));
        }

        toast.error(json.message || "Failed to create sub broker");
        return;
      }

      toast.success("Sub Broker Created Successfully");

      setForm(initialFormState);
      setShowModal(false);
      fetchOfficers();
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setCreating(false);
    }
  };

  /* ================= UPDATE ================= */
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editOfficer) return;

    const validationErrors = validateForm();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      toast.error("Please fix form errors");
      return;
    }

    setCreating(true);

    try {
      const token = sessionStorage.getItem("broker_token");

      const res = await fetch(
        `${API_BASE}/broker/sub-broker/${editOfficer.id}/update`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            email: form.email,
            firstName: form.firstName,
            lastName: form.lastName,
            phone: form.phone.replace(/\D/g, ""),
            ...(form.password ? { password: form.password } : {}), // optional
          }),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.message || "Failed to update sub broker");
        return;
      }

      toast.success("Sub Broker Updated Successfully");

      setForm(initialFormState);
      setEditOfficer(null);
      setShowModal(false);
      fetchOfficers();
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 dark:bg-slate-900 min-h-screen transition-colors">
      {/* Header + Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
        {/* Left: Heading */}
        <div>
          <h1
            className="text-3xl font-bold"
            style={{
              color: "var(--primary-color)",
            }}
          >
            Sub Brokers
          </h1>

          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Manage and monitor all your sub brokers, track their activity, and
            control access from one place.
          </p>
        </div>

        {/* Right: Search + Button */}
        <div className="flex items-center gap-4">
          <div className="relative w-72">
            <input
              placeholder="Search sub brokers..."
              className="w-full border border-gray-300 dark:border-slate-600
bg-white dark:bg-slate-800
text-gray-800 dark:text-slate-200
focus:border-indigo-500 focus:ring-2
focus:ring-indigo-200 dark:focus:ring-indigo-500/30
rounded-xl py-2.5 pl-10 pr-10
outline-none transition-all text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {/* Search Icon */}
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>

            {/* Clear Button */}
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
              >
                ✕
              </button>
            )}
          </div>

          {/* Create Button */}
          <button
            onClick={() => {
              setErrors({});
              setEditOfficer(null);
              setForm(initialFormState);
              setShowModal(true);
            }}
            className="bg-[#2C92D5] hover:bg-[#1d80c2] 
                 text-white px-5 py-2.5 rounded-xl 
                 shadow-sm hover:shadow-md 
                 transition-all duration-200 text-sm"
          >
            + Create Sub Broker
          </button>
        </div>
      </div>

      {/* Table */}
      <div
        className="bg-white dark:bg-slate-800
rounded-2xl shadow-sm
border border-gray-200 dark:border-slate-700
overflow-hidden transition-colors"
      >
        <table className="w-full text-sm">
          {/* Header */}
          <thead
            className="bg-gradient-to-r 
    from-indigo-50 to-purple-50
    dark:from-slate-800 dark:to-slate-800
    border-b border-gray-200 dark:border-slate-700"
          >
            <tr className="text-gray-600 dark:text-slate-400 uppercase text-xs tracking-wider">
              <th className="p-4 text-left">Name</th>
              <th className="p-4 text-left">Email</th>
              <th className="p-4 text-left">Phone</th>
              <th className="p-4 text-left">Status</th>
              <th className="p-4 text-left">Created</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="p-10 text-center text-gray-400 dark:text-slate-500"
                >
                  Loading...
                </td>
              </tr>
            ) : officers.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-10">
                  <div className="flex flex-col items-center justify-center text-center space-y-4">
                    <div
                      className="bg-indigo-100 dark:bg-indigo-900/30 
        text-indigo-600 dark:text-indigo-400 
        rounded-full p-4"
                    >
                      <Users size={32} />
                    </div>

                    <div>
                      <p className="text-lg font-semibold text-gray-700 dark:text-slate-200">
                        No Sub Brokers Found
                      </p>
                      <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                        You haven’t added any sub brokers yet. Create one to get
                        started.
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              officers.map((o) => (
                <tr
                  key={o.id}
                  className="hover:bg-indigo-50/40 
    dark:hover:bg-slate-700/40 
    transition-all duration-200"
                >
                  {/* Name */}
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-12 w-12 rounded-full flex items-center justify-center
          bg-slate-100 dark:bg-slate-700
          text-slate-600 dark:text-slate-300 font-semibold"
                      >
                        {o.firstName?.charAt(0)}
                        {o.lastName?.charAt(0)}
                      </div>

                      <div>
                        <p className="font-semibold text-gray-800 dark:text-slate-200">
                          {o.firstName} {o.lastName}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="p-4 text-gray-600 dark:text-slate-300">
                    {o.email}
                  </td>

                  {/* Phone */}
                  <td className="p-4 text-gray-600 dark:text-slate-300">
                    {o.phone ? formatPhone(o.phone) : "-"}
                  </td>

                  {/* Status */}
                  <td className="p-4">
                    <span
                      onClick={() =>
                        togglingId !== o.id && toggleStatus(o.id, o.status)
                      }
                      className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer
        ${
          o.status === "ACTIVE"
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
        }`}
                    >
                      {o.status}
                    </span>
                  </td>

                  {/* Created */}
                  <td className="p-4 text-gray-500 dark:text-slate-400">
                    {new Date(o.createdAt).toLocaleDateString()}
                  </td>

                  {/* Actions */}
                  <td className="p-4 text-right space-x-2">
                    {/* <button
                      onClick={() => setViewOfficer(o)}
                      className="inline-flex items-center justify-center 
        h-9 w-9 rounded-lg
        bg-blue-50 hover:bg-blue-100
        dark:bg-blue-900/30 dark:hover:bg-blue-900/50
        text-blue-600 dark:text-blue-400"
                    >
                      <Eye size={16} />
                    </button> */}

                    <button
                      onClick={() => {
                        setErrors({});
                        fetchSubBrokerDetails(o.id);
                      }}
                      className="inline-flex items-center justify-center 
        h-9 w-9 rounded-lg
        bg-yellow-50 hover:bg-yellow-100
        dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50
        text-yellow-600 dark:text-yellow-400"
                    >
                      ✎
                    </button>

                    {/* <button
                      onClick={() => handleDelete(o.id)}
                      className="inline-flex items-center justify-center 
        h-9 w-9 rounded-lg
        bg-red-50 hover:bg-red-100
        dark:bg-red-900/30 dark:hover:bg-red-900/50
        text-red-600 dark:text-red-400"
                    >
                      <Trash2 size={16} />
                    </button> */}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Page{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {page}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {totalPages}
            </span>
          </p>

          <div className="flex gap-2">
            <button
              disabled={page === 1 || loading}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              className="px-4 py-2 rounded-lg border
            border-gray-200 dark:border-slate-600
            bg-white dark:bg-slate-800
            text-slate-700 dark:text-slate-200
            hover:bg-slate-100 dark:hover:bg-slate-700
            disabled:opacity-50
            disabled:cursor-not-allowed
            transition-colors"
            >
              Prev
            </button>

            <button
              disabled={page === totalPages || loading}
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              className="
            px-4 py-2 rounded-lg border
            border-gray-200 dark:border-slate-600
            bg-white dark:bg-slate-800
            text-slate-700 dark:text-slate-200
            hover:bg-slate-100 dark:hover:bg-slate-700
            disabled:opacity-50
            disabled:cursor-not-allowed
            transition-colors
          "
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center z-[273797737392739] p-4 transition-colors">
          <div
            className="bg-white dark:bg-slate-800
rounded-2xl shadow-2xl
border border-gray-200 dark:border-slate-700
transition-colors w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200"
          >
            {/* Header */}
            <div
              className="flex justify-between items-center p-6 
border-b border-gray-200 dark:border-slate-700
bg-slate-50/60 dark:bg-slate-800"
            >
              <div>
                <h2 className="text-xl font-bold dark:text-white">
                  {editOfficer ? "Edit Sub Broker" : "Create Sub Broker"}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {editOfficer
                    ? "Update sub broker details."
                    : "Fill in the details to create a new sub broker."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-2 rounded-full
                                dark:hover:bg-red-900/30
                                text-slate-400 dark:text-slate-500
                                hover:text-red-600 dark:hover:text-red-400
                                transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form
              onSubmit={editOfficer ? handleUpdate : handleCreate}
              className="flex flex-col h-full"
            >
              {/* Form Content */}
              <div className="p-6 space-y-6 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* First Name */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      First Name
                    </label>
                    <input
                      placeholder="Enter first name"
                      className={`${inputStyle} ${errors.firstName ? "border-red-500" : ""}`}
                      value={form.firstName}
                      onChange={(e) => updateField("firstName", e.target.value)}
                    />
                    {errors.firstName && (
                      <p className="text-xs text-red-500">{errors.firstName}</p>
                    )}
                  </div>

                  {/* Last Name */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      Last Name
                    </label>
                    <input
                      placeholder="Enter last name"
                      className={`${inputStyle} ${errors.lastName ? "border-red-500" : ""}`}
                      value={form.lastName}
                      onChange={(e) => updateField("lastName", e.target.value)}
                    />
                    {errors.lastName && (
                      <p className="text-xs text-red-500">{errors.lastName}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      Email
                    </label>
                    <input
                      type="email"
                      placeholder="Enter email"
                      className={`${inputStyle} ${errors.email ? "border-red-500" : ""}`}
                      value={form.email}
                      onChange={(e) => updateField("email", e.target.value)}
                    />
                    {errors.email && (
                      <p className="text-xs text-red-500">{errors.email}</p>
                    )}
                  </div>

                  {/* Password (only create) */}
                  {!editOfficer && (
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        Password
                      </label>

                      <div className="relative">
                        <input
                          type={showPassword.password ? "text" : "password"}
                          placeholder="Enter password"
                          className={`${inputStyle} pr-12 ${
                            errors.password ? "border-red-500" : ""
                          }`}
                          value={form.password}
                          onChange={(e) =>
                            updateField("password", e.target.value)
                          }
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setShowPassword((prev) => ({
                              ...prev,
                              password: !prev.password,
                            }))
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2
              text-slate-400 hover:text-indigo-600 transition-colors"
                        >
                          {showPassword.password ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                      </div>

                      {errors.password && (
                        <p className="text-xs text-red-500">
                          {errors.password}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Phone */}
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      Phone Number
                    </label>

                    <input
                      placeholder="Enter phone number"
                      className={`${inputStyle} ${errors.phone ? "border-red-500" : ""}`}
                      value={formatPhone(form.phone)}
                      onChange={(e) =>
                        updateField(
                          "phone",
                          e.target.value.replace(/\D/g, "").slice(0, 10),
                        )
                      }
                    />

                    {errors.phone && (
                      <p className="text-xs text-red-500">{errors.phone}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border 
      border-gray-300 dark:border-slate-600
      text-slate-600 dark:text-slate-300
      hover:bg-gray-100 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creating}
                  className="bg-[#2C92D5] hover:bg-[#1d80c2]
      text-white px-5 py-2 rounded-lg font-semibold
      transition-all shadow-sm hover:shadow-md"
                >
                  {creating
                    ? editOfficer
                      ? "Updating..."
                      : "Creating..."
                    : editOfficer
                      ? "Update Sub Broker"
                      : "Create Sub Broker"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
