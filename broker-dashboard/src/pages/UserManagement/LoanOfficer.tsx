import { Trash2, Users, Eye } from "lucide-react";
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
    lastLoginAt: string | null;
    roles: string[];
    profile: {
        company: string;
        tollFree: string;
        tollFreeExt: string;
        serviceProvider: string;
        address: string;
        suite: string;
        city: string;
        state: string;
        zipCode: string;
        agentType: string;
        licenseNumber: string;
        preferredComm: string;
        website: string;
        avatarUrl: string | null;
    } | null;
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
    avatarPreview: "",
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

type FormState = typeof initialFormState;

const basicFields: {
    label: string;
    key: keyof FormState;
    type?: string;
    placeholder?: string;
}[] = [
        { label: "First Name", key: "firstName", placeholder: "Jane" },
        { label: "Last Name", key: "lastName", placeholder: "Doe" },
        { label: "Email", key: "email", type: "email" },
        { label: "Confirm Email", key: "confirmEmail", type: "email" },
        { label: "Password", key: "password", type: "password" },
        { label: "Confirm Password", key: "confirmPassword", type: "password" },
        { label: "Phone", key: "phone" },
        { label: "License Number", key: "licenseNumber" },
    ];

const inputStyle =
    "w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 transition-all outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600";

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
    const [viewOfficer, setViewOfficer] = useState<LoanOfficer | null>(null);
    const [debouncedSearch, setDebouncedSearch] = useState(search);

    const [form, setForm] = useState(initialFormState);
    const [creating, setCreating] = useState(false);

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

    /* ================= STATUS ================= */
    const toggleStatus = async (id: string, status: string) => {
        try {
            setTogglingId(id);

            const newStatus = status === "ACTIVE" ? "DISABLED" : "ACTIVE";

            const res = await fetch(`${API_BASE}/broker/users/${id}/status`, {
                method: "PATCH",
                headers: getHeaders(),
                body: JSON.stringify({ status: newStatus }),
            });

            const json = await res.json();

            if (!res.ok || !json.success) {
                toast.error(json.message || "Failed to update status");
                return;
            }

            toast.success("Status updated");
            fetchOfficers();
        } catch (err) {
            toast.error("Something went wrong");
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

            const queryParams = new URLSearchParams({
                page: String(page),
                limit: String(limit),
            });

            if (debouncedSearch) {
                queryParams.append("search", debouncedSearch);
            }

            const res = await fetch(
                `${API_BASE}/broker/users?${queryParams.toString()}`,
                { headers: getHeaders() }
            );

            const json = await res.json();

            if (json.success) {

                const officersOnly: LoanOfficer[] = (json.data || []).filter(
                    (user: LoanOfficer) =>
                        user?.roles?.includes("BROKER_OFFICER")
                );

                setOfficers(officersOnly);

                // IMPORTANT: use backend total (not filtered length)
                setTotalPages(json.totalPages || 1);

                // Safety reset if page exceeds totalPages
                if (page > (json.totalPages || 1)) {
                    setPage(1);
                }
            }

        } catch (err) {
            console.error(err);
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
        fetchOfficers();
    }, [page, debouncedSearch]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch]);

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^[0-9]{8,15}$/;
        const zipRegex = /^[0-9]{4,10}$/;

        // Required Fields (avatar NOT included)
        const requiredFields: (keyof FormState)[] = [
            "firstName",
            "lastName",
            "email",
            "confirmEmail",
            "password",
            "confirmPassword",
            "phone",
            "company",
            "tollFree",
            "tollFreeExt",
            "suite",
            "serviceProvider",
            "address",
            "city",
            "state",
            "zipCode",
            "licenseNumber",
            "preferredComm",
            "website",
            "agentType",
        ];

        requiredFields.forEach((field) => {
            if (!form[field]?.toString().trim()) {
                newErrors[field] = "This field is required";
            }
        });

        // Email format
        if (form.email && !emailRegex.test(form.email)) {
            newErrors.email = "Invalid email format";
        }

        if (form.confirmEmail && !emailRegex.test(form.confirmEmail)) {
            newErrors.confirmEmail = "Invalid email format";
        }

        // Email match
        if (form.email !== form.confirmEmail) {
            newErrors.confirmEmail = "Emails do not match";
        }

        // Password strength
        if (form.password.length < 8) {
            newErrors.password = "Password must be at least 8 characters";
        }

        // Password match
        if (form.password !== form.confirmPassword) {
            newErrors.confirmPassword = "Passwords do not match";
        }

        // Phone validation
        if (form.phone && !phoneRegex.test(form.phone)) {
            newErrors.phone = "Invalid phone number";
        }

        // Zip validation
        if (form.zipCode && !zipRegex.test(form.zipCode)) {
            newErrors.zipCode = "Invalid zip code";
        }

        // Website validation
        if (form.website) {
            try {
                new URL(form.website.startsWith("http") ? form.website : `https://${form.website}`);
            } catch {
                newErrors.website = "Invalid website URL";
            }
        }


        return newErrors;
    };

    /* ================= CREATE ================= */

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (creating) return;

        const validationErrors = validateForm();
        setErrors(validationErrors);

        if (Object.keys(validationErrors).length > 0) {
            toast.error("Please fix the errors");
            return;
        }

        setCreating(true);

        try {
            const token = sessionStorage.getItem("broker_token");

            const formData = new FormData();

            Object.entries(form).forEach(([key, value]) => {
                if (!value) return;

                if (key === "avatarFile" && value instanceof File) {
                    formData.append("avatar", value);
                }
                else if (key !== "avatarPreview") {
                    formData.append(key, String(value));
                }
            });

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
            toast.error("Something went wrong");
        } finally {
            setCreating(false);
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
            background: "#1e293b",
            color: "#e2e8f0",
            customClass: {
                container: "swal-high-zindex"
            }
        });

        if (!result.isConfirmed) return;

        const token = sessionStorage.getItem("broker_token");
        try {
            await fetch(`${API_BASE}/broker/users/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });

            await Swal.fire({
                title: "Deleted!",
                text: "Loan Officer has been deleted successfully.",
                icon: "success",
                timer: 1500,
                showConfirmButton: false,
                background: "#1e293b",
                color: "#e2e8f0",
                customClass: {
                    container: "swal-high-zindex"
                }
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

    const InfoItem = ({ label, value }: { label: string; value: any }) => (
        <div className="space-y-1">
            <p className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">
                {label}
            </p>
            <p className="font-medium text-slate-800 dark:text-slate-200 break-words">
                {value || "-"}
            </p>
        </div>
    );


    return (
        <div className="p-6 bg-gray-50 dark:bg-slate-900 min-h-screen transition-colors">
            {/* Header + Controls */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">

                {/* Left: Heading */}
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r 
      from-indigo-600 to-purple-600 
      bg-clip-text text-transparent">
                        Loan Officers
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                        Manage and monitor all your loan officers in one place
                    </p>
                </div>

                {/* Right: Search + Button */}
                <div className="flex items-center gap-4">

                    <div className="relative w-72">
                        <input
                            placeholder="Search loan officers..."
                            className="w-full border border-gray-300 dark:border-slate-600
bg-white dark:bg-slate-800
text-gray-800 dark:text-slate-200
focus:border-indigo-500 focus:ring-2
focus:ring-indigo-200 dark:focus:ring-indigo-500/30
rounded-xl py-2.5 pl-10 pr-10
outline-none transition-all"
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
            <div className="bg-white dark:bg-slate-800
rounded-2xl shadow-sm
border border-gray-200 dark:border-slate-700
overflow-hidden transition-colors">

                <table className="w-full text-sm">

                    {/* Header */}
                    <thead className="bg-gradient-to-r 
    from-indigo-50 to-purple-50
    dark:from-slate-800 dark:to-slate-800
    border-b border-gray-200 dark:border-slate-700">

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
                                <td colSpan={6}
                                    className="p-10 text-center text-gray-400 dark:text-slate-500">
                                    Loading...
                                </td>
                            </tr>
                        ) : officers.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-10">
                                    <div className="flex flex-col items-center justify-center text-center space-y-4">
                                        <div className="bg-indigo-100 dark:bg-indigo-900/30 
              text-indigo-600 dark:text-indigo-400 
              rounded-full p-4">
                                            <Users size={32} />
                                        </div>

                                        <div>
                                            <p className="text-lg font-semibold text-gray-700 dark:text-slate-200">
                                                No Loan Officers Found
                                            </p>
                                            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
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
                                    className="hover:bg-indigo-50/40 
            dark:hover:bg-slate-700/40 
            transition-all duration-200">
                                    {/* Name */}
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">

                                            {/* Avatar */}
                                            <div className="h-12 w-12 rounded-full overflow-hidden
                bg-slate-100 dark:bg-slate-700
                border border-gray-200 dark:border-slate-600
                flex-shrink-0">
                                                {o.profile?.avatarUrl ? (
                                                    <img
                                                        src={`${API_BASE}${o.profile?.avatarUrl}`}
                                                        alt="avatar"
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="h-full w-full flex items-center justify-center
                    text-xs font-semibold
                    text-slate-500 dark:text-slate-300">
                                                        {o.firstName?.charAt(0)}
                                                        {o.lastName?.charAt(0)}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Name + Role */}
                                            <div>
                                                <p className="font-semibold text-gray-800 dark:text-slate-200">
                                                    {o.firstName} {o.lastName}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-slate-400">
                                                    {o.profile?.agentType || "-"}
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
                                        {o.phone || "-"}
                                    </td>

                                    {/* Status */}
                                    <td className="p-4">
                                        <span
                                            onClick={() =>
                                                togglingId !== o.id &&
                                                toggleStatus(o.id, o.status)
                                            }
                                            className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-all duration-200
                ${o.status === "ACTIVE"
                                                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400"
                                                    : "bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
                                                }
                ${togglingId === o.id ? "opacity-50 cursor-not-allowed" : ""}
              `}
                                        >
                                            {togglingId === o.id ? "Updating..." : o.status}
                                        </span>
                                    </td> 

                                    {/* Created */}
                                    <td className="p-4 text-gray-500 dark:text-slate-400">
                                        {new Date(o.createdAt).toLocaleDateString()}
                                    </td>

                                    {/* Actions */}
                                    <td className="p-4 text-right space-x-2">

                                        {/* View */}
                                        <button
                                            onClick={() => setViewOfficer(o)}
                                            className="inline-flex items-center justify-center 
                h-9 w-9 rounded-lg
                bg-blue-50 hover:bg-blue-100
                dark:bg-blue-900/30 dark:hover:bg-blue-900/50
                text-blue-600 dark:text-blue-400
                transition-all duration-200"
                                        >
                                            <Eye size={16} />
                                        </button>

                                        {/* Delete */}
                                        <button
                                            onClick={() => handleDelete(o.id)}
                                            className="inline-flex items-center justify-center 
                h-9 w-9 rounded-lg
                bg-red-50 hover:bg-red-100
                dark:bg-red-900/30 dark:hover:bg-red-900/50
                text-red-600 dark:text-red-400
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
            {
                totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Page <span className="font-semibold text-slate-700 dark:text-slate-200">{page}</span> of{" "}
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{totalPages}</span>
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
                )
            }

            {
                showModal && (
                    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center z-[273797737392739] p-4 transition-colors">
                        <div className="bg-white dark:bg-slate-800
rounded-2xl shadow-2xl
border border-gray-200 dark:border-slate-700
transition-colors w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">

                            {/* Header */}
                            <div className="flex justify-between items-center p-6 
border-b border-gray-200 dark:border-slate-700
bg-slate-50/60 dark:bg-slate-800">

                                <div>
                                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                                        Create Loan Officer
                                    </h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Fill in the details to register a new officer in the system.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="p-2 rounded-full
    hover:bg-red-50 dark:hover:bg-red-900/30
    text-slate-400 dark:text-slate-500
    hover:text-red-600 dark:hover:text-red-400
    transition-colors"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Scrollable Form Body */}
                            <form onSubmit={handleCreate} className="overflow-y-auto p-6 space-y-8 custom-scrollbar">

                                {/* Section: Basic Info */}
                                <section>
                                    {/* Avatar Upload */}
                                    <div className="space-y-4 md:col-span-2 mt-4">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Profile Picture
                                        </label>

                                        <div className="flex items-center gap-6">
                                            {/* Preview Container */}
                                            <div className="relative group">
                                                <div className="h-24 w-24 rounded-full overflow-hidden
bg-slate-100 dark:bg-slate-700
border-2 border-slate-200 dark:border-slate-600
shadow-sm transition-all group-hover:border-blue-400">
                                                    {form.avatarPreview ? (
                                                        <img
                                                            src={form.avatarPreview}
                                                            alt="Avatar Preview"
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-300">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                            </svg>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Controls */}
                                            <div className="flex flex-col gap-2">
                                                <label className="cursor-pointer inline-flex items-center px-4 py-2
bg-white dark:bg-slate-700
border border-slate-300 dark:border-slate-600
rounded-lg text-sm font-semibold
text-slate-700 dark:text-slate-200
hover:bg-slate-50 dark:hover:bg-slate-600
hover:border-slate-400 dark:hover:border-slate-500
transition-all active:scale-95 shadow-sm">
                                                    <span>Change Photo</span>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden" // Hides the ugly default input
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (!file) return;

                                                            if (file.size > 2 * 1024 * 1024) {
                                                                toast.error("Image must be under 2MB");
                                                                return;
                                                            }

                                                            if (!file.type.startsWith("image/")) {
                                                                toast.error("Only image files allowed");
                                                                return;
                                                            }

                                                            setForm((prev) => ({
                                                                ...prev,
                                                                avatarFile: file,
                                                                avatarPreview: URL.createObjectURL(file),
                                                            }));
                                                        }}
                                                    />
                                                </label>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    JPG, GIF or PNG. Max size 2MB.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 mb-4 mt-4">
                                        <div className="h-8 w-1 bg-indigo-600 rounded-full"></div>
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Basic Information</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                        {basicFields.map((field) => (
                                            <div key={field.key} className="space-y-1">
                                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">
                                                    {field.label}
                                                </label>

                                                <input
                                                    type={field.type || "text"}
                                                    placeholder={field.placeholder}
                                                    className={`w-full px-4 py-2.5 rounded-lg border 
      bg-slate-50 transition-all outline-none
      focus:ring-2 focus:ring-indigo-500/20 
      focus:border-indigo-600 dark:border-slate-600 dark:bg-slate-700 text-slate-800 dark:text-slate-200
      ${errors[field.key]
                                                            ? "border-red-500 bg-red-50"
                                                            : "border-slate-200"
                                                        }`}
                                                    value={form[field.key] as string}
                                                    onChange={(e) => updateField(field.key, e.target.value)}
                                                />

                                                {errors[field.key] && (
                                                    <p className="text-xs font-medium text-red-500 mt-1 ml-1">
                                                        {errors[field.key]}
                                                    </p>
                                                )}
                                            </div>
                                        ))}

                                        <div className="space-y-1 md:col-span-2">
                                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Agent Type</label>
                                            <select
                                                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-100 transition-all outline-none text-slate-500 dark:text-slate-400 cursor-not-allowed dark:border-slate-600 dark:bg-slate-700"
                                                value={form.agentType}
                                                disabled
                                            >
                                                <option value="Loan Officer">Loan Officer</option>
                                                <option value="Senior Loan Officer">Senior Loan Officer</option>
                                                <option value="Manager">Manager</option>
                                            </select>
                                        </div>
                                    </div>
                                </section>

                                {/* Section: Company Info */}
                                <section>
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="h-8 w-1 bg-emerald-500 rounded-full"></div>
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Company Details</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1 md:col-span-2">
                                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">
                                                Company
                                            </label>

                                            <input
                                                className={`${inputStyle} ${errors.company ? "border-red-500 bg-red-50" : ""
                                                    }`}
                                                value={form.company}
                                                onChange={(e) => updateField("company", e.target.value)}
                                            />

                                            {errors.company && (
                                                <p className="text-xs text-red-500 mt-1">{errors.company}</p>
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">
                                                Service Provider
                                            </label>

                                            <select
                                                className={`${inputStyle} ${errors.serviceProvider ? "border-red-500 bg-red-50" : ""
                                                    }`}
                                                value={form.serviceProvider}
                                                onChange={(e) => updateField("serviceProvider", e.target.value)}
                                            >
                                                <option value="">Select</option>
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

                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="col-span-2 space-y-1">
                                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Toll Free</label>
                                                <input
                                                    className={`${inputStyle} ${errors.tollFree ? "border-red-500 bg-red-50" : ""
                                                        }`}
                                                    value={form.tollFree}
                                                    onChange={(e) => updateField("tollFree", e.target.value)}
                                                />

                                                {errors.tollFree && (
                                                    <p className="text-xs text-red-500 mt-1">
                                                        {errors.tollFree}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">
                                                    Ext
                                                </label>

                                                <input
                                                    className={`${inputStyle} ${errors.tollFreeExt ? "border-red-500 bg-red-50" : ""
                                                        }`}
                                                    value={form.tollFreeExt}
                                                    onChange={(e) => updateField("tollFreeExt", e.target.value)}
                                                />

                                                {errors.tollFreeExt && (
                                                    <p className="text-xs text-red-500 mt-1">
                                                        {errors.tollFreeExt}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* Address Section */}
                                <section>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                        <div className="space-y-1 md:col-span-2">
                                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                                Address
                                            </label>

                                            <input
                                                className={`${inputStyle} ${errors.address ? "border-red-500 bg-red-50" : ""
                                                    }`}
                                                value={form.address}
                                                onChange={(e) => updateField("address", e.target.value)}
                                            />

                                            {errors.address && (
                                                <p className="text-xs text-red-500 mt-1">
                                                    {errors.address}
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                                Suite
                                            </label>

                                            <input
                                                className={`${inputStyle} ${errors.suite ? "border-red-500 bg-red-50" : ""
                                                    }`}
                                                value={form.suite}
                                                onChange={(e) => updateField("suite", e.target.value)}
                                            />

                                            {errors.suite && (
                                                <p className="text-xs text-red-500 mt-1">
                                                    {errors.suite}
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">City</label>
                                            <input
                                                className={`${inputStyle} ${errors.city ? "border-red-500 bg-red-50" : ""
                                                    }`}
                                                value={form.city}
                                                onChange={(e) => updateField("city", e.target.value)}
                                            />

                                            {errors.city && (
                                                <p className="text-xs text-red-500 mt-1">
                                                    {errors.city}
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">State</label>
                                            <select
                                                className={`${inputStyle} ${errors.state ? "border-red-500 bg-red-50" : ""
                                                    }`}
                                                value={form.state}
                                                onChange={(e) => updateField("state", e.target.value)}
                                            >
                                                <option value="">Select State</option>
                                                {US_STATES.map((s) => (
                                                    <option key={s.code} value={s.code}>
                                                        {s.name}
                                                    </option>
                                                ))}
                                            </select>

                                            {errors.state && (
                                                <p className="text-xs text-red-500 mt-1">
                                                    {errors.state}
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Zip Code</label>
                                            <input
                                                className={`${inputStyle} ${errors.zipCode ? "border-red-500 bg-red-50" : ""
                                                    }`}
                                                value={form.zipCode}
                                                onChange={(e) => updateField("zipCode", e.target.value)}
                                            />

                                            {errors.zipCode && (
                                                <p className="text-xs text-red-500 mt-1">
                                                    {errors.zipCode}
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Preferred Communication</label>
                                            <select
                                                className={inputStyle}
                                                value={form.preferredComm}
                                                onChange={(e) => setForm({ ...form, preferredComm: e.target.value })}
                                            >
                                                <option value="EMAIL">Email</option>
                                                <option value="PHONE">Phone</option>
                                            </select>
                                        </div>

                                        <div className="space-y-1 md:col-span-2">
                                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Website</label>
                                            <input
                                                className={`${inputStyle} ${errors.website ? "border-red-500 bg-red-50" : ""
                                                    }`}
                                                value={form.website}
                                                onChange={(e) => updateField("website", e.target.value)}
                                            />

                                            {errors.website && (
                                                <p className="text-xs text-red-500 mt-1">
                                                    {errors.website}
                                                </p>
                                            )}
                                        </div>

                                    </div>
                                </section>

                                {/* Footer Controls */}
                                <div className="bg-slate-50 dark:bg-slate-800
border-t border-gray-200 dark:border-slate-700
-mx-6 -mb-6 p-6
flex flex-col md:flex-row items-center justify-between gap-4 mt-8">
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={form.allowedToLogin}
                                                onChange={(e) => setForm({ ...form, allowedToLogin: e.target.checked })}
                                            />
                                            <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                        </div>
                                        <span className="text-sm font-medium 
text-slate-600 dark:text-slate-300
group-hover:text-slate-900 dark:group-hover:text-white
transition-colors">Allow user to login</span>
                                    </label>

                                    <div className="flex gap-3 w-full md:w-auto">
                                        <button
                                            type="button"
                                            onClick={() => setShowModal(false)}
                                            className="flex-1 md:flex-none px-6 py-2.5
text-slate-600 dark:text-slate-300
font-semibold
hover:bg-slate-200 dark:hover:bg-slate-700
rounded-lg transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={creating}
                                            className={`relative flex-1 md:flex-none px-8 py-3
  rounded-xl font-semibold text-white
  bg-gradient-to-r 
  from-indigo-600 via-purple-600 to-indigo-600
  dark:from-indigo-500 dark:via-purple-500 dark:to-indigo-500
  hover:from-indigo-700 hover:via-purple-700 hover:to-indigo-700
  dark:hover:from-indigo-400 dark:hover:via-purple-400 dark:hover:to-indigo-400
  shadow-lg shadow-indigo-200
  dark:shadow-black/40
  transition-all duration-300
  active:scale-[0.97]
  disabled:opacity-50 disabled:cursor-not-allowed
  overflow-hidden`}
                                        >
                                            <span className="relative z-10 flex items-center justify-center gap-2">
                                                {creating && (
                                                    <svg
                                                        className="animate-spin h-4 w-4"
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <circle
                                                            className="opacity-25"
                                                            cx="12"
                                                            cy="12"
                                                            r="10"
                                                            stroke="currentColor"
                                                            strokeWidth="4"
                                                        />
                                                        <path
                                                            className="opacity-75"
                                                            fill="currentColor"
                                                            d="M4 12a8 8 0 018-8v8H4z"
                                                        />
                                                    </svg>
                                                )}
                                                {creating ? "Creating Officer..." : "Create Officer"}
                                            </span>

                                            {/* Shine Effect */}
                                            <span className="absolute inset-0 
  bg-white/10 dark:bg-white/5 
  opacity-0 hover:opacity-20 
  transition-opacity duration-300"></span>
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {
                viewOfficer && (
                    <div className="fixed inset-0 
    bg-black/60 dark:bg-black/80
    backdrop-blur-sm 
    flex items-center justify-center 
    z-[777787878788] p-4 transition-colors">

                        <div className="bg-white dark:bg-slate-800
      rounded-2xl shadow-2xl
      border border-gray-200 dark:border-slate-700
      w-full max-w-3xl max-h-[90vh]
      overflow-y-auto p-8
      transition-colors">

                            {/* Header */}
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                                    Loan Officer Profile
                                </h2>

                                <button
                                    onClick={() => setViewOfficer(null)}
                                    className="text-slate-400 dark:text-slate-500 
            hover:text-red-600 dark:hover:text-red-400
            transition-colors"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Avatar Section */}
                            <div className="flex items-center gap-6 mb-8">

                                <div className="h-24 w-24 rounded-full overflow-hidden
          bg-slate-100 dark:bg-slate-700
          border border-gray-200 dark:border-slate-600">

                                    {viewOfficer.profile?.avatarUrl ? (
                                        <img
                                            src={`${API_BASE}${viewOfficer.profile.avatarUrl}`}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="h-full flex items-center justify-center
              text-slate-400 dark:text-slate-300">
                                            No Image
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200">
                                        {viewOfficer.firstName} {viewOfficer.lastName}
                                    </h3>

                                    <p className="text-slate-500 dark:text-slate-400">
                                        {viewOfficer.email}
                                    </p>

                                    <p className="text-sm text-slate-400 dark:text-slate-500">
                                        Status: {viewOfficer.status}
                                    </p>
                                </div>
                            </div>

                            {/* Grid Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">

                                <InfoItem label="Phone" value={viewOfficer.phone} />
                                <InfoItem label="Company" value={viewOfficer.profile?.company} />
                                <InfoItem label="Toll Free" value={viewOfficer.profile?.tollFree} />
                                <InfoItem label="Ext" value={viewOfficer.profile?.tollFreeExt} />
                                <InfoItem label="Service Provider" value={viewOfficer.profile?.serviceProvider} />
                                <InfoItem label="License Number" value={viewOfficer.profile?.licenseNumber} />
                                <InfoItem label="Agent Type" value={viewOfficer.profile?.agentType} />
                                <InfoItem label="Preferred Comm" value={viewOfficer.profile?.preferredComm} />
                                <InfoItem label="Website" value={viewOfficer.profile?.website} />

                                <InfoItem
                                    label="Address"
                                    value={`${viewOfficer.profile?.address || ""} 
            ${viewOfficer.profile?.suite || ""}, 
            ${viewOfficer.profile?.city || ""}, 
            ${viewOfficer.profile?.state || ""} 
            ${viewOfficer.profile?.zipCode || ""}`}
                                />

                                <InfoItem
                                    label="Created At"
                                    value={new Date(viewOfficer.createdAt).toLocaleString()}
                                />

                                <InfoItem
                                    label="Last Login"
                                    value={
                                        viewOfficer.lastLoginAt
                                            ? new Date(viewOfficer.lastLoginAt).toLocaleString()
                                            : "Never"
                                    }
                                />
                            </div>

                        </div>
                    </div>
                )
            }
        </div >
    );
}
