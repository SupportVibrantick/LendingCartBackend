import { Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Swal from "sweetalert2";

const API_BASE = import.meta.env.VITE_API_BASE || "";

interface LoanOfficer {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    status: string;
    createdAt: string;
}

const initialFormState = {
    email: "",
    confirmEmail: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    phone: "",
    allowedToLogin: true,
    company: "",
    tollFree: "",
    tollFreeExt: "",
    serviceProvider: "Internal",
    address: "",
    suite: "",
    city: "",
    state: "",
    zipCode: "",
    licenseNumber: "",
    preferredComm: "EMAIL",
    website: "",
    agentType: "Loan Officer",
    avatarFile: null as File | null,
};

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

export default function LoanOfficersPage() {
    const [officers, setOfficers] = useState<LoanOfficer[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [togglingId, setTogglingId] = useState<string | null>(null);

    const [form, setForm] = useState(initialFormState);

    /* ================= STATUS ================= */
    const toggleStatus = async (id: string, status: string) => {
        try {
            setTogglingId(id);

            const newStatus = status === "ACTIVE" ? "DISABLED" : "ACTIVE";

            await fetch(`${API_BASE}/broker/users/${id}/status`, {
                method: "PATCH",
                headers: getHeaders(),
                body: JSON.stringify({ status: newStatus }),
            });

            fetchOfficers();
        } finally {
            setTogglingId(null);
        }
    };

    const getHeaders = () => {
        const token = sessionStorage.getItem("broker_token");
        return {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
    };

    /* ================= FETCH ================= */

    const fetchOfficers = async () => {
        try {
            setLoading(true);
            const res = await fetch(
                `${API_BASE}/broker/users?page=${page}&limit=${limit}&search=${search}`,
                { headers: getHeaders() }
            );
            const json = await res.json();

            if (json.success) {
                const filtered = (json.data || []).filter((u: any) =>
                    u.roles.includes("BROKER_OFFICER")
                );

                setOfficers(filtered);
                setTotalPages(json.totalPages || 1);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOfficers();
    }, [page, search]);

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        Object.entries(form).forEach(([key, value]) => {
            // if (key === "avatarFile") {
            //     if (!value) newErrors[key] = "Avatar is required";
            // } else
            if (typeof value === "string" && value.trim() === "") {
                newErrors[key] = "This field is required";
            }
        });

        if (form.email !== form.confirmEmail) {
            newErrors.confirmEmail = "Emails do not match";
        }

        if (form.password !== form.confirmPassword) {
            newErrors.confirmPassword = "Passwords do not match";
        }

        return newErrors;
    };

    /* ================= CREATE ================= */

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();

        const validationErrors = validateForm();
        setErrors(validationErrors);

        if (Object.keys(validationErrors).length > 0) {
            toast.error("Please fix the errors");
            return;
        }

        try {
            const formData = new FormData();

            Object.entries(form).forEach(([key, value]) => {
                if (value === null || value === undefined) return;

                if (key === "avatarFile" && value instanceof File) {
                    formData.append("avatarUrl", value);
                } else if (typeof value === "boolean") {
                    formData.append(key, value.toString());
                } else {
                    formData.append(key, value as string);
                }
            });

            const token = sessionStorage.getItem("broker_token");

            const res = await fetch(`${API_BASE}/broker/users`, {
                method: "POST",
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: formData,
            });

            const json = await res.json();

            if (!res.ok || !json.success) {
                toast.error(json.message || "Failed");
                return;
            }

            toast.success("Loan Officer Created Successfully");
            setForm(initialFormState);
            setErrors({});
            setShowModal(false);
            fetchOfficers();
        } catch (err) {
            console.error(err);
        }
    };

    /* ================= DELETE ================= */

    const handleDelete = async (id: string) => {
        const result = await Swal.fire({
            title: "Are you sure?",
            text: "This Loan Officer will be permanently deleted!",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#dc2626",
            cancelButtonColor: "#6b7280",
            confirmButtonText: "Yes, Delete",
            cancelButtonText: "Cancel",
        });

        if (!result.isConfirmed) return;

        try {
            await fetch(`${API_BASE}/broker/users/${id}`, {
                method: "DELETE",
                headers: getHeaders(),
            });

            await Swal.fire({
                title: "Deleted!",
                text: "Loan Officer has been deleted successfully.",
                icon: "success",
                timer: 1500,
                showConfirmButton: false,
            });

            fetchOfficers();
        } catch (error) {
            Swal.fire({
                title: "Error",
                text: "Something went wrong!",
                icon: "error",
            });
        }
    };

    return (
        <div className="p-6">
            {/* Header + Controls */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">

                {/* Left: Heading */}
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r 
      from-indigo-600 to-purple-600 
      bg-clip-text text-transparent">
                        Loan Officers
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Manage and monitor all your loan officers in one place
                    </p>
                </div>

                {/* Right: Search + Button */}
                <div className="flex items-center gap-4">

                    {/* Search */}
                    <div className="relative w-72">
                        <input
                            placeholder="Search loan officers..."
                            className="w-full border border-gray-300 
                   focus:border-indigo-500 focus:ring-2 
                   focus:ring-indigo-200 
                   rounded-xl py-2.5 pl-10 pr-4 
                   outline-none transition-all"
                            value={search}
                            onChange={(e) => {
                                setPage(1);
                                setSearch(e.target.value);
                            }}
                        />

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
                    </div>

                    {/* Create Button */}
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 
                 text-white px-5 py-2.5 rounded-xl 
                 shadow-sm hover:shadow-md 
                 transition-all duration-200"
                    >
                        + Create Loan Officer
                    </button>

                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gradient-to-r from-indigo-50 to-purple-50">
                        <tr className="text-gray-600 uppercase text-xs tracking-wider">
                            <th className="p-4 text-left">Name</th>
                            <th className="p-4 text-left">Email</th>
                            <th className="p-4 text-left">Phone</th>
                            <th className="p-4 text-left">Status</th>
                            <th className="p-4 text-left">Created</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="p-10 text-center text-gray-400">
                                    Loading...
                                </td>
                            </tr>
                        ) : officers.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-10">
                                    <div className="flex flex-col items-center justify-center text-center space-y-4">
                                        <div className="bg-indigo-100 text-indigo-600 rounded-full p-4">
                                            <Users size={32} />
                                        </div>
                                        <div>
                                            <p className="text-lg font-semibold text-gray-700">
                                                No Loan Officers Found
                                            </p>
                                            <p className="text-sm text-gray-500 mt-1">
                                                Try adjusting your search or create a new loan officer.
                                            </p>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            officers.map((o) => (
                                <tr
                                    key={o.id}
                                    className="hover:bg-indigo-50/40 transition-all duration-200"
                                >
                                    <td className="p-4 font-medium text-gray-800">
                                        {o.firstName} {o.lastName}
                                    </td>

                                    <td className="p-4 text-gray-600">{o.email}</td>

                                    <td className="p-4 text-gray-600">
                                        {o.phone || "-"}
                                    </td>

                                    <td className="p-4">
                                        <span
                                            onClick={() =>
                                                togglingId !== o.id &&
                                                toggleStatus(o.id, o.status)
                                            }
                                            className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-all duration-200
                ${o.status === "ACTIVE"
                                                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                                    : "bg-red-100 text-red-600 hover:bg-red-200"
                                                }
                ${togglingId === o.id ? "opacity-50 cursor-not-allowed" : ""}
              `}
                                        >
                                            {togglingId === o.id ? "Updating..." : o.status}
                                        </span>
                                    </td>

                                    <td className="p-4 text-gray-500">
                                        {new Date(o.createdAt).toLocaleDateString()}
                                    </td>

                                    <td className="p-4 text-right">
                                        <button
                                            onClick={() => handleDelete(o.id)}
                                            className="inline-flex items-center justify-center 
                           h-9 w-9 rounded-lg 
                           bg-red-50 hover:bg-red-100 
                           text-red-600 
                           transition-all duration-200"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="flex justify-end gap-2 mt-4">
                <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1 border rounded"
                >
                    Prev
                </button>

                <span className="px-3 py-1">
                    {page} / {totalPages}
                </span>

                <button
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1 border rounded"
                >
                    Next
                </button>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[273797737392739]">
                    <div className="bg-white rounded-xl shadow-xl w-[750px] max-h-[90vh] overflow-y-auto p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-semibold">
                                Create Loan Officer
                            </h2>

                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="text-gray-500 hover:text-red-600 text-2xl font-bold"
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleCreate} className="space-y-5">

                            {/* Basic Info */}
                            <h3 className="text-md font-semibold border-b pb-2">
                                Basic Information
                            </h3>
                            <div className="grid grid-cols-2 gap-4">

                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        First Name
                                    </label>
                                    <input
                                        className="w-full border rounded p-2"
                                        value={form.firstName}
                                        placeholder="Enter first name"
                                        onChange={(e) =>
                                            setForm({ ...form, firstName: e.target.value })
                                        }
                                    />
                                    {errors.firstName && (
                                        <p className="text-xs text-red-500 mt-1">
                                            {errors.firstName}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Last Name
                                    </label>
                                    <input
                                        className="w-full border rounded p-2"
                                        placeholder="Enter last name"
                                        value={form.lastName}
                                        onChange={(e) =>
                                            setForm({ ...form, lastName: e.target.value })
                                        }
                                    />
                                    {errors.lastName && (
                                        <p className="text-xs text-red-500 mt-1">
                                            {errors.lastName}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        className="w-full border rounded p-2"
                                        placeholder="Enter email"
                                        value={form.email}
                                        onChange={(e) =>
                                            setForm({ ...form, email: e.target.value })
                                        }
                                    />
                                    {errors.email && (
                                        <p className="text-xs text-red-500 mt-1">
                                            {errors.email}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Confirm Email
                                    </label>
                                    <input
                                        type="email"
                                        className="w-full border rounded p-2"
                                        placeholder="Enter confirm email"
                                        value={form.confirmEmail}
                                        onChange={(e) =>
                                            setForm({ ...form, confirmEmail: e.target.value })
                                        }
                                    />
                                    {errors.confirmEmail && (
                                        <p className="text-xs text-red-500 mt-1">
                                            {errors.confirmEmail}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Password
                                    </label>
                                    <input
                                        type="password"
                                        className="w-full border rounded p-2"
                                        value={form.password}
                                        placeholder="Enter password"
                                        onChange={(e) =>
                                            setForm({ ...form, password: e.target.value })
                                        }
                                    />
                                    {errors.password && (
                                        <p className="text-xs text-red-500 mt-1">
                                            {errors.password}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Confirm Password
                                    </label>
                                    <input
                                        type="password"
                                        className="w-full border rounded p-2"
                                        value={form.confirmPassword}
                                        placeholder="Enter confirm password"
                                        onChange={(e) =>
                                            setForm({ ...form, confirmPassword: e.target.value })
                                        }
                                    />
                                    {errors.confirmPassword && (
                                        <p className="text-xs text-red-500 mt-1">
                                            {errors.confirmPassword}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Phone
                                    </label>
                                    <input
                                        className="w-full border rounded p-2"
                                        value={form.phone}
                                        placeholder="Enter phone"
                                        onChange={(e) =>
                                            setForm({ ...form, phone: e.target.value })
                                        }
                                    />
                                    {errors.phone && (
                                        <p className="text-xs text-red-500 mt-1">
                                            {errors.phone}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        License Number
                                    </label>
                                    <input
                                        className="w-full border rounded p-2"
                                        value={form.licenseNumber}
                                        placeholder="Enter license number"
                                        onChange={(e) =>
                                            setForm({ ...form, licenseNumber: e.target.value })
                                        }
                                    />
                                    {errors.licenseNumber && (
                                        <p className="text-xs text-red-500 mt-1">
                                            {errors.licenseNumber}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Agent Type
                                    </label>
                                    <select
                                        className="w-full border rounded p-2"
                                        value={form.agentType}
                                        onChange={(e) =>
                                            setForm({ ...form, agentType: e.target.value })
                                        }
                                        disabled
                                    >
                                        <option value="Loan Officer">Loan Officer</option>
                                        <option value="Senior Loan Officer">Senior Loan Officer</option>
                                        <option value="Manager">Manager</option>
                                    </select>
                                    {errors.agentType && (
                                        <p className="text-xs text-red-500 mt-1">
                                            {errors.agentType}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <h3 className="text-md font-semibold border-b pb-2 mt-6">
                                Company Information
                            </h3>
                            {/* Company Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Company
                                    </label>
                                    <input
                                        className="w-full border rounded p-2"
                                        value={form.company}
                                        placeholder="Enter company"
                                        onChange={(e) =>
                                            setForm({ ...form, company: e.target.value })
                                        }
                                    />
                                    {errors.company && (
                                        <p className="text-xs text-red-500 mt-1">
                                            {errors.company}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Service Provider
                                    </label>
                                    <select
                                        className="w-full border rounded p-2"
                                        value={form.serviceProvider}
                                        onChange={(e) =>
                                            setForm({ ...form, serviceProvider: e.target.value })
                                        }
                                    >
                                        <option value="Internal">Internal</option>
                                        <option value="External">External</option>
                                        <option value="Partner">Partner</option>
                                    </select>
                                    {errors.serviceProvider && (
                                        <p className="text-xs text-red-500 mt-1">
                                            {errors.serviceProvider}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Toll Free
                                    </label>
                                    <input
                                        className="w-full border rounded p-2"
                                        value={form.tollFree}
                                        placeholder="Enter toll free"
                                        onChange={(e) =>
                                            setForm({ ...form, tollFree: e.target.value })
                                        }
                                    />
                                    {errors.tollFree && (
                                        <p className="text-xs text-red-500 mt-1">
                                            {errors.tollFree}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Toll Free Ext
                                    </label>
                                    <input
                                        className="w-full border rounded p-2"
                                        value={form.tollFreeExt}
                                        placeholder="Enter toll free ext"
                                        onChange={(e) =>
                                            setForm({ ...form, tollFreeExt: e.target.value })
                                        }
                                    />
                                    {errors.tollFreeExt && (
                                        <p className="text-xs text-red-500 mt-1">
                                            {errors.tollFreeExt}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <h3 className="text-md font-semibold border-b pb-2 mt-6">
                                Address Details
                            </h3>
                            {/* Address */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Address
                                    </label>
                                    <input
                                        className="w-full border rounded p-2"
                                        value={form.address}
                                        placeholder="Enter address"
                                        onChange={(e) =>
                                            setForm({ ...form, address: e.target.value })
                                        }
                                    />
                                    {errors.address && (
                                        <p className="text-xs text-red-500 mt-1">
                                            {errors.address}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Suite
                                    </label>
                                    <input
                                        className="w-full border rounded p-2"
                                        value={form.suite}
                                        placeholder="Enter suite"
                                        onChange={(e) =>
                                            setForm({ ...form, suite: e.target.value })
                                        }
                                    />
                                    {errors.suite && (
                                        <p className="text-xs text-red-500 mt-1">
                                            {errors.suite}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        City
                                    </label>
                                    <input
                                        className="w-full border rounded p-2"
                                        value={form.city}
                                        placeholder="Enter city"
                                        onChange={(e) =>
                                            setForm({ ...form, city: e.target.value })
                                        }
                                    />
                                    {errors.city && (
                                        <p className="text-xs text-red-500 mt-1">
                                            {errors.city}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        State
                                    </label>
                                    <select
                                        className="w-full border rounded p-2 bg-white"
                                        value={form.state}
                                        onChange={(e) =>
                                            setForm({ ...form, state: e.target.value })
                                        }
                                        required
                                    >
                                        <option value="">Select State</option>
                                        {US_STATES.map((state) => (
                                            <option key={state.code} value={state.code}>
                                                {state.name} ({state.code})
                                            </option>
                                        ))}
                                    </select>
                                    {errors.state && (
                                        <p className="text-xs text-red-500 mt-1">
                                            {errors.state}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Zip Code
                                    </label>
                                    <input
                                        className="w-full border rounded p-2"
                                        value={form.zipCode}
                                        placeholder="Enter zip code"
                                        onChange={(e) =>
                                            setForm({ ...form, zipCode: e.target.value })
                                        }
                                    />
                                    {errors.zipCode && (
                                        <p className="text-xs text-red-500 mt-1">
                                            {errors.zipCode}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Website
                                    </label>
                                    <input
                                        className="w-full border rounded p-2"
                                        value={form.website}
                                        placeholder="Enter website"
                                        onChange={(e) =>
                                            setForm({ ...form, website: e.target.value })
                                        }
                                    />
                                    {errors.website && (
                                        <p className="text-xs text-red-500 mt-1">
                                            {errors.website}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Avatar URL
                                    </label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="w-full border rounded p-2"
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                avatarFile: e.target.files?.[0] || null,
                                            })
                                        }
                                    />
                                    {errors.avatarFile && (
                                        <p className="text-xs text-red-500 mt-1">
                                            {errors.avatarFile}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Preferred Communication
                                    </label>
                                    <select
                                        className="w-full border rounded p-2"
                                        value={form.preferredComm}
                                        onChange={(e) =>
                                            setForm({ ...form, preferredComm: e.target.value })
                                        }
                                    >
                                        <option value="EMAIL">Email</option>
                                        <option value="PHONE">Phone</option>
                                    </select>
                                    {errors.preferredComm && (
                                        <p className="text-xs text-red-500 mt-1">
                                            {errors.preferredComm}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Toggle */}
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={form.allowedToLogin}
                                    onChange={(e) =>
                                        setForm({ ...form, allowedToLogin: e.target.checked })
                                    }
                                />
                                <label className="text-sm">Allowed To Login</label>
                            </div>

                            {/* Buttons */}
                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-indigo-600 text-white rounded"
                                >
                                    Create Officer
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
