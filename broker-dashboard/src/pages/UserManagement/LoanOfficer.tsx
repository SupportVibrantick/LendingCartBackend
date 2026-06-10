import {
  ArrowUpDown,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  EyeOff,
  Mail,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  Users,
  UserX,
  Activity,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
// import Select from "react-select";
import PageMeta from "../../components/common/PageMeta";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

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
  permissions?: string[];
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

// const permissionOptions = PERMISSIONS.flatMap((group) =>
//   group.items.map((item) => ({
//     label: `${group.title} - ${item.label}`,
//     value: item.key,
//   })),
// );

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

const cleanNumber = (value: string) => {
  return value.replace(/\D/g, "");
};

const formatZip = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 9);

  if (digits.length <= 5) return digits;

  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

const AVATAR_TONES = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
];

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

type SortKey = "name" | "email" | "phone" | "status" | "createdAt";
type SortDir = "asc" | "desc";

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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [officers, setOfficers] = useState<LoanOfficer[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState(initialQuery);
  const [showModal, setShowModal] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [viewOfficer, setViewOfficer] = useState<LoanOfficer | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const [form, setForm] = useState(initialFormState);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({
    password: false,
    confirmPassword: false,
  });
  const [editOfficer, setEditOfficer] = useState<LoanOfficer | null>(null);
  const [statusFilter, setStatusFilter] = useState<"" | "ACTIVE" | "DISABLED">("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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

  const normalizeWebsiteUrl = (input: string) => {
    if (!input) return "";

    let url = input.trim();

    // If protocol missing → add https://
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }

    try {
      const parsed = new URL(url);

      // Remove trailing slash
      parsed.pathname = parsed.pathname.replace(/\/$/, "");

      return parsed.toString();
    } catch {
      return null; // invalid
    }
  };

  // const togglePermission = (key: string) => {
  //   setSelectedPermissions((prev) =>
  //     prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
  //   );
  // };

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
        { headers: getHeaders() },
      );

      const json = await res.json();

      if (json.success) {
        const officersOnly: LoanOfficer[] = (json.data || []).filter(
          (user: LoanOfficer) => user?.roles?.includes("BROKER_OFFICER"),
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
    fetchOfficers();
  }, [page, debouncedSearch]);

  const filteredOfficers = useMemo(() => {
    if (!statusFilter) return officers;
    return officers.filter((o) => o.status === statusFilter);
  }, [officers, statusFilter]);

  const sortedOfficers = useMemo(() => {
    const list = [...filteredOfficers];

    list.sort((a, b) => {
      let cmp = 0;

      switch (sortKey) {
        case "name":
          cmp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
          break;
        case "email":
          cmp = a.email.localeCompare(b.email);
          break;
        case "phone":
          cmp = (a.phone || "").localeCompare(b.phone || "");
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "createdAt":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }

      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [filteredOfficers, sortKey, sortDir]);

  const stats = useMemo(
    () => ({
      total: officers.length,
      active: officers.filter((o) => o.status === "ACTIVE").length,
      disabled: officers.filter((o) => o.status === "DISABLED").length,
    }),
    [officers],
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
    setErrors({});
    setEditOfficer(null);
    setForm(initialFormState);
    setSelectedPermissions([]);
    setShowModal(true);
  };

  const openEditModal = (o: LoanOfficer) => {
    setErrors({});
    setEditOfficer(o);
    setForm({
      ...initialFormState,
      email: o.email,
      confirmEmail: o.email,
      firstName: o.firstName,
      lastName: o.lastName,
      phone: o.phone || "",
      company: o.profile?.company || "",
      tollFree: o.profile?.tollFree || "",
      tollFreeExt: o.profile?.tollFreeExt || "",
      serviceProvider: o.profile?.serviceProvider || "Internal",
      address: o.profile?.address || "",
      suite: o.profile?.suite || "",
      city: o.profile?.city || "",
      state: o.profile?.state || "",
      zipCode: o.profile?.zipCode || "",
      licenseNumber: o.profile?.licenseNumber || "",
      preferredComm: o.profile?.preferredComm || "EMAIL",
      website: o.profile?.website?.replace(/^https?:\/\/(www\.)?/, "") || "",
      agentType: o.profile?.agentType || "Loan Officer",
      avatarPreview: o.profile?.avatarUrl ? `${API_BASE}${o.profile.avatarUrl}` : "",
    });
    setSelectedPermissions(o.permissions || []);
    setShowModal(true);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // US Email
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/;

    // US Phone (10 digit with optional +1, spaces, dashes, brackets)
    const phoneRegex = /^(\+1\s?)?(\(?\d{3}\)?[\s-]?)\d{3}[\s-]?\d{4}$/;

    // US ZIP (12345 or 12345-6789)
    const zipRegex = /^\d{5}(-\d{4})?$/;

    // US License (basic alphanumeric rule)
    const licenseRegex = /^[A-Za-z0-9-]{4,20}$/;

    // Required fields
    const requiredFields: (keyof FormState)[] = editOfficer
      ? [
          "firstName",
          "lastName",
          "email",
          "confirmEmail",
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
        ]
      : [
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

    // Email validation
    if (form.email && !emailRegex.test(form.email)) {
      newErrors.email = "Enter a valid US email address";
    }

    if (form.confirmEmail && !emailRegex.test(form.confirmEmail)) {
      newErrors.confirmEmail = "Enter a valid US email address";
    }

    if (form.email !== form.confirmEmail) {
      newErrors.confirmEmail = "Emails do not match";
    }

    // Password strength (USA standard)
    if (!editOfficer) {
      if (
        form.password.length < 8 ||
        !/[A-Z]/.test(form.password) ||
        !/[0-9]/.test(form.password)
      ) {
        newErrors.password =
          "Password must be 8+ characters with 1 uppercase & 1 number";
      }

      if (form.password !== form.confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
      }
    }

    // Phone validation
    const formattedPhone = formatPhone(form.phone);

    if (form.phone && !phoneRegex.test(formattedPhone)) {
      newErrors.phone = "Enter valid US phone (e.g. 123-456-7890)";
    }

    // ZIP validation
    const formattedZip = formatZip(form.zipCode);

    if (form.zipCode && !zipRegex.test(formattedZip)) {
      newErrors.zipCode = "Enter valid US ZIP (e.g. 12345 or 12345-6789)";
    }

    // License validation
    if (form.licenseNumber && !licenseRegex.test(form.licenseNumber)) {
      newErrors.licenseNumber = "License must be 4–20 alphanumeric characters";
    }

    // Website validation (US domain friendly)
    if (form.website) {
      const normalized = normalizeWebsiteUrl(form.website);

      if (!normalized) {
        newErrors.website = "Enter a valid website URL";
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
        if (value === null || value === undefined) return;

        if (key === "avatarFile" && value instanceof File) {
          formData.append("avatar", value);
          return;
        }

        if (key === "website" && typeof value === "string") {
          const normalized = normalizeWebsiteUrl(value);

          if (normalized) {
            formData.append("website", normalized);
          }

          return;
        }

        if (key !== "avatarPreview") {
          if (key === "phone" || key === "tollFree" || key === "zipCode") {
            formData.append(key, cleanNumber(String(value)));
          } else {
            formData.append(key, String(value));
          }
          formData.append(key, String(value));
        }
      });

      formData.append("permissions", JSON.stringify(selectedPermissions));

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

  /* ================= UPDATE ================= */
  const handleUpdate = async (userId: string) => {
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
        if (value === null || value === undefined) return;

        if (
          key === "password" ||
          key === "confirmPassword" ||
          key === "avatarPreview"
        ) {
          return;
        }

        if (key === "avatarFile" && value instanceof File) {
          formData.append("avatar", value);
          return;
        }

        if (key === "website" && typeof value === "string") {
          const normalized = normalizeWebsiteUrl(value);

          if (normalized) {
            formData.append("website", normalized);
          }

          return;
        }

        if (key === "phone" || key === "tollFree" || key === "zipCode") {
          formData.append(key, cleanNumber(String(value)));
        } else {
          formData.append(key, String(value));
        }
      });

      formData.append("permissions", JSON.stringify(selectedPermissions));

      const res = await fetch(`${API_BASE}/broker/users/${userId}`, {
        method: "PUT",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.message || "Update failed");
        return;
      }

      toast.success("Loan Officer Updated Successfully");
      setShowModal(false);
      setViewOfficer(null);
      setEditOfficer(null);
      setForm(initialFormState);
      fetchOfficers();
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setCreating(false);
    }
  };

  /* ================= DELETE ================= */

  const handleDelete = async (id: string) => {
    const isDark = document.documentElement.classList.contains("dark");

    const result = await Swal.fire({
      title: "Are you sure?",
      text: "This Loan Officer will be permanently deleted!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, Delete",
      cancelButtonText: "Cancel",

      background: isDark ? "#1e293b" : "#ffffff",
      color: isDark ? "#e2e8f0" : "#1e293b",

      customClass: {
        popup: "rounded-2xl",
        container: "swal-high-zindex",
      },
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
        background: isDark ? "#1e293b" : "#ffffff",
        color: isDark ? "#e2e8f0" : "#1e293b",
        customClass: {
          popup: "rounded-2xl",
          container: "swal-high-zindex",
        },
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

  // const getPermissionLabel = (key: string) => {
  //   for (const group of PERMISSIONS) {
  //     const found = group.items.find((i) => i.key === key);
  //     if (found) return found.label;
  //   }
  //   return key;
  // };

  const InfoItem = ({ label, value }: { label: string; value: any }) => (
    <div className="space-y-1">
      <p
        className="text-xs font-semibold uppercase tracking-wide
      text-slate-500 dark:text-slate-400"
      >
        {label}
      </p>

      <div
        className="
      w-full px-4 py-2.5 rounded-lg border
      border-slate-200 dark:border-slate-600
      bg-slate-100 dark:bg-slate-700
      text-slate-800 dark:text-slate-200 cursor-not-allowed
    "
      >
        {value || "-"}
      </div>
    </div>
  );

  // const isDark = document.documentElement.classList.contains("dark");

  // const customSelectStyles = {
  //   control: (base: any, state: any) => ({
  //     ...base,
  //     backgroundColor: isDark ? "#0f172a" : "#ffffff",
  //     borderColor: state.isFocused ? "#6366f1" : isDark ? "#334155" : "#cbd5f5",
  //     boxShadow: "none",
  //     minHeight: "42px",
  //     borderRadius: "10px",
  //     padding: "2px",
  //     ":hover": {
  //       borderColor: "#6366f1",
  //     },
  //   }),

  //   menu: (base: any) => ({
  //     ...base,
  //     backgroundColor: isDark ? "#0f172a" : "#ffffff",
  //     border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
  //     borderRadius: "10px",
  //     overflow: "hidden",
  //     zIndex: 9999,
  //   }),

  //   option: (base: any, state: any) => ({
  //     ...base,
  //     backgroundColor: state.isFocused
  //       ? isDark
  //         ? "#1e293b"
  //         : "#f1f5f9"
  //       : "transparent",
  //     color: isDark ? "#e2e8f0" : "#0f172a",
  //     cursor: "pointer",
  //   }),

  //   multiValue: (base: any) => ({
  //     ...base,
  //     backgroundColor: isDark ? "#1e293b" : "#e2e8f0",
  //     borderRadius: "6px",
  //   }),

  //   multiValueLabel: (base: any) => ({
  //     ...base,
  //     color: isDark ? "#e2e8f0" : "#0f172a",
  //   }),

  //   multiValueRemove: (base: any) => ({
  //     ...base,
  //     color: isDark ? "#94a3b8" : "#475569",
  //     ":hover": {
  //       backgroundColor: isDark ? "#334155" : "#cbd5f5",
  //       color: isDark ? "#fff" : "#000",
  //     },
  //   }),

  //   input: (base: any) => ({
  //     ...base,
  //     color: isDark ? "#e2e8f0" : "#0f172a",
  //   }),

  //   placeholder: (base: any) => ({
  //     ...base,
  //     color: isDark ? "#94a3b8" : "#64748b",
  //   }),

  //   singleValue: (base: any) => ({
  //     ...base,
  //     color: isDark ? "#e2e8f0" : "#0f172a",
  //   }),
  // };

  return (
    <>
      <PageMeta title="Loan Officers | Broker Dashboard" description="Manage loan officers" />

      <div className="space-y-6">
        {/* Hero */}
        <div className="overflow-hidden rounded-2xl border border-[#13538A]/15 bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#2C92D5] p-6 text-white shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
                CRM · Team
              </p>
              <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Loan Officers</h1>
              <p className="mt-2 max-w-xl text-sm text-white/80">
                Manage and monitor all your loan officers in one place.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                <p className="text-xs text-white/70">Total (page)</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                <p className="flex items-center gap-1 text-xs text-white/70">
                  <UserCheck className="h-3 w-3" /> Active
                </p>
                <p className="text-2xl font-bold">{stats.active}</p>
              </div>
              <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                <p className="flex items-center gap-1 text-xs text-white/70">
                  <UserX className="h-3 w-3" /> Disabled
                </p>
                <p className="text-2xl font-bold">{stats.disabled}</p>
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
                placeholder="Search loan officers..."
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-10 text-sm text-gray-800 outline-none transition focus:border-[#13538A]/40 focus:ring-2 focus:ring-[#13538A]/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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

            <div className="flex rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900">
              {(["", "ACTIVE", "DISABLED"] as const).map((value) => (
                <button
                  key={value || "all"}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    statusFilter === value
                      ? "bg-[#13538A] text-white shadow-sm"
                      : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
                >
                  {value === "" ? "All" : value === "ACTIVE" ? "Active" : "Disabled"}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => fetchOfficers()}
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
            Create Loan Officer
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
          ) : sortedOfficers.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#13538A]/10 text-[#13538A]">
                <Users size={24} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {search || statusFilter ? "No matching loan officers" : "No loan officers yet"}
              </h3>
              <p className="mt-1 max-w-md text-sm text-gray-500">
                {search || statusFilter
                  ? "Try adjusting your search or status filter."
                  : "Create your first loan officer to start building your team."}
              </p>
              {!search && !statusFilter && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#13538A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a6aad]"
                >
                  <Plus className="h-4 w-4" />
                  Create Loan Officer
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
                        label="Phone"
                        active={sortKey === "phone"}
                        direction={sortDir}
                        onClick={() => toggleSort("phone")}
                      />
                    </th>
                    <th className="px-4 py-3.5">
                      <SortHeader
                        label="Status"
                        active={sortKey === "status"}
                        direction={sortDir}
                        onClick={() => toggleSort("status")}
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
                  {sortedOfficers.map((o, index) => {
                    const fullName = `${o.firstName} ${o.lastName}`.trim();
                    const isActive = o.status === "ACTIVE";

                    return (
                      <tr
                        key={o.id}
                        className={`group border-b border-gray-100 transition last:border-b-0 dark:border-gray-800 ${
                          isActive
                            ? "hover:bg-[#13538A]/[0.04] dark:hover:bg-gray-800/60"
                            : "bg-gray-50/40 hover:bg-gray-100/60 dark:bg-gray-900/30 dark:hover:bg-gray-800/60"
                        }`}
                      >
                        <td className="px-4 py-4 text-xs font-medium text-gray-400">
                          {(page - 1) * limit + index + 1}
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl ring-2 ring-white dark:ring-gray-900">
                              {o.profile?.avatarUrl ? (
                                <img
                                  src={`${API_BASE}${o.profile.avatarUrl}`}
                                  alt={fullName}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span
                                  className={`flex h-full w-full items-center justify-center text-sm font-bold ${getAvatarTone(fullName)}`}
                                >
                                  {getInitials(o.firstName, o.lastName)}
                                </span>
                              )}
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-gray-900 ${
                                  isActive ? "bg-emerald-500" : "bg-gray-400"
                                }`}
                              />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-gray-900 dark:text-gray-100">
                                {fullName}
                              </p>
                              <p className="truncate text-xs text-gray-400">
                                {o.profile?.agentType || "Loan Officer"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex max-w-[220px] items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-800">
                              <Mail className="h-3.5 w-3.5" />
                            </span>
                            <span className="truncate" title={o.email}>
                              {o.email}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-800">
                              <Phone className="h-3.5 w-3.5" />
                            </span>
                            {o.phone ? formatPhone(o.phone) : "—"}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <button
                            type="button"
                            disabled={togglingId === o.id}
                            onClick={() => toggleStatus(o.id, o.status)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                              isActive
                                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30"
                                : "bg-gray-100 text-gray-600 ring-1 ring-gray-200 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700"
                            }`}
                            title="Click to toggle status"
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                isActive ? "bg-emerald-500" : "bg-gray-400"
                              }`}
                            />
                            {togglingId === o.id ? "Updating..." : isActive ? "Active" : "Disabled"}
                          </button>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Calendar className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                            {formatDate(o.createdAt)}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                navigate("/loan-officer-activity", {
                                  state: { officerId: o.id },
                                })
                              }
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-sky-600 transition hover:border-sky-200 hover:bg-sky-50 dark:border-gray-700 dark:bg-gray-900"
                              title="View activity"
                            >
                              <Activity className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setViewOfficer(o)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-[#13538A] transition hover:border-[#13538A]/30 hover:bg-[#13538A]/10 dark:border-gray-700 dark:bg-gray-900"
                              title="View profile"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(o)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-amber-600 transition hover:border-amber-200 hover:bg-amber-50 dark:border-gray-700 dark:bg-gray-900"
                              title="Edit loan officer"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(o.id)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-red-600 transition hover:border-red-200 hover:bg-red-50 dark:border-gray-700 dark:bg-gray-900"
                              title="Delete loan officer"
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

          {!loading && sortedOfficers.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-3 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-gray-500">
                Showing{" "}
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {sortedOfficers.length}
                </span>{" "}
                on page{" "}
                <span className="font-semibold text-gray-800 dark:text-gray-200">{page}</span>
                {statusFilter ? ` · filtered by ${statusFilter.toLowerCase()}` : ""}
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
                  {editOfficer ? "Edit Loan Officer" : "Create Loan Officer"}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Fill in the details to register a new officer in the system. 
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
              onSubmit={(e) => {
                e.preventDefault();
                if (editOfficer) {
                  handleUpdate(editOfficer.id);
                } else {
                  handleCreate(e);
                }
              }}
              className="overflow-y-auto p-6 space-y-8 custom-scrollbar"
            >
              {/* Section: Basic Info */}
              <section>
                {/* Avatar Upload */}
                <div className="space-y-4 md:col-span-2 mt-4 text-center">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Profile Picture
                  </label>

                  <div className="flex flex-col items-center gap-4">
                    {/* Preview Container */}
                    <div className="relative group">
                      <div
                        className="h-24 w-24 rounded-full overflow-hidden
        bg-slate-100 dark:bg-slate-700
        border-2 border-slate-200 dark:border-slate-600
        shadow-sm transition-all group-hover:border-blue-400"
                      >
                        {form.avatarPreview ? (
                          <img
                            src={form.avatarPreview}
                            alt="Avatar Preview"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div
                            className="flex items-center justify-center h-full
            text-slate-400 dark:text-slate-300"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-8 w-8"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-col items-center gap-2">
                      <label
                        className="cursor-pointer inline-flex items-center px-4 py-2
        bg-white dark:bg-slate-700
        border border-slate-300 dark:border-slate-600
        rounded-lg text-sm font-semibold
        text-slate-700 dark:text-slate-200
        hover:bg-slate-50 dark:hover:bg-slate-600
        hover:border-slate-400 dark:hover:border-slate-500
        transition-all active:scale-95 shadow-sm"
                      >
                        <span>Change Photo</span>

                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
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
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Basic Information
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  {basicFields
                    .filter((field) => {
                      if (editOfficer) {
                        return (
                          field.key !== "password" &&
                          field.key !== "confirmPassword"
                        );
                      }
                      return true;
                    })
                    .map((field) => (
                      <div key={field.key} className="space-y-1">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">
                          {field.label}
                        </label>

                        <div className="relative">
                          <input
                            type={
                              field.type === "password"
                                ? showPassword[field.key]
                                  ? "text"
                                  : "password"
                                : field.type || "text"
                            }
                            placeholder={field.placeholder}
                            disabled={
                              !!editOfficer &&
                              (field.key === "email" ||
                                field.key === "confirmEmail")
                            }
                            className={`w-full px-4 py-2.5 pr-12 rounded-lg border
    bg-slate-50 dark:bg-slate-700
    text-slate-800 dark:text-slate-200
    border-slate-200 dark:border-slate-600
    transition-all outline-none
    focus:ring-2 focus:ring-indigo-500/20
    focus:border-indigo-600
    ${
      editOfficer && (field.key === "email" || field.key === "confirmEmail")
        ? "opacity-60 cursor-not-allowed"
        : ""
    }
    ${errors[field.key] ? "border-red-500 bg-red-50 dark:bg-red-900/30" : ""}
  `}
                            value={
                              field.key === "phone"
                                ? formatPhone(form.phone)
                                : (form[field.key] as string)
                            }
                            onChange={(e) => {
                              if (field.key === "phone") {
                                updateField(
                                  "phone",
                                  e.target.value.replace(/\D/g, ""),
                                );
                              } else {
                                updateField(field.key, e.target.value);
                              }
                            }}
                          />

                          {field.type === "password" && (
                            <button
                              type="button"
                              onClick={() =>
                                setShowPassword((prev) => ({
                                  ...prev,
                                  [field.key]: !prev[field.key],
                                }))
                              }
                              className="absolute right-3 top-1/2 -translate-y-1/2
    text-slate-400 dark:text-slate-300
    hover:text-indigo-600 dark:hover:text-indigo-400
    transition-colors"
                            >
                              {showPassword[field.key] ? (
                                <Eye size={18} />
                              ) : (
                                <EyeOff size={18} />
                              )}
                            </button>
                          )}
                        </div>

                        {errors[field.key] && (
                          <p className="text-xs font-medium text-red-500 mt-1 ml-1">
                            {errors[field.key]}
                          </p>
                        )}
                      </div>
                    ))}

                  <div className="space-y-1 md:col-span-2">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">
                      Agent Type
                    </label>
                    <select
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-100 transition-all outline-none text-slate-500 dark:text-slate-400 cursor-not-allowed dark:border-slate-600 dark:bg-slate-700"
                      value={form.agentType}
                      disabled
                    >
                      <option value="Loan Officer">Loan Officer</option>
                      <option value="Senior Loan Officer">
                        Senior Loan Officer
                      </option>
                      <option value="Manager">Manager</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Section: Company Info */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-1 bg-emerald-500 rounded-full"></div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Company Details
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">
                      Company
                    </label>

                    <input
                      className={`${inputStyle} ${
                        errors.company ? "border-red-500 bg-red-50" : ""
                      }`}
                      value={form.company}
                      onChange={(e) => updateField("company", e.target.value)}
                    />

                    {errors.company && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors.company}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">
                      Service Provider
                    </label>

                    <select
                      className={`${inputStyle} ${
                        errors.serviceProvider ? "border-red-500 bg-red-50" : ""
                      }`}
                      value={form.serviceProvider}
                      onChange={(e) =>
                        updateField("serviceProvider", e.target.value)
                      }
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
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">
                        Toll Free
                      </label>
                      <input
                        className={`${inputStyle} ${
                          errors.tollFree ? "border-red-500 bg-red-50" : ""
                        }`}
                        value={formatPhone(form.tollFree)}
                        onChange={(e) => {
                          updateField(
                            "tollFree",
                            e.target.value.replace(/\D/g, ""),
                          );
                        }}
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
                        className={`${inputStyle} ${
                          errors.tollFreeExt ? "border-red-500 bg-red-50" : ""
                        }`}
                        value={form.tollFreeExt}
                        onChange={(e) =>
                          updateField(
                            "tollFreeExt",
                            e.target.value.replace(/\D/g, ""),
                          )
                        }
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
                      className={`${inputStyle} ${
                        errors.address ? "border-red-500 bg-red-50" : ""
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
                      className={`${inputStyle} ${
                        errors.suite ? "border-red-500 bg-red-50" : ""
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
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      City
                    </label>
                    <input
                      className={`${inputStyle} ${
                        errors.city ? "border-red-500 bg-red-50" : ""
                      }`}
                      value={form.city}
                      onChange={(e) => updateField("city", e.target.value)}
                    />

                    {errors.city && (
                      <p className="text-xs text-red-500 mt-1">{errors.city}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      State
                    </label>
                    <select
                      className={`${inputStyle} ${
                        errors.state ? "border-red-500 bg-red-50" : ""
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
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Zip Code
                    </label>
                    <input
                      className={`${inputStyle} ${
                        errors.zipCode ? "border-red-500 bg-red-50" : ""
                      }`}
                      value={formatZip(form.zipCode)}
                      onChange={(e) =>
                        updateField(
                          "zipCode",
                          e.target.value.replace(/\D/g, ""),
                        )
                      }
                    />

                    {errors.zipCode && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors.zipCode}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Preferred Communication
                    </label>
                    <select
                      className={inputStyle}
                      value={form.preferredComm}
                      onChange={(e) =>
                        setForm({ ...form, preferredComm: e.target.value })
                      }
                    >
                      <option value="EMAIL">Email</option>
                      <option value="PHONE">Phone</option>
                    </select>
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Website
                    </label>

                    <div className="flex">
                      {/* Fixed Prefix */}
                      <span
                        className="inline-flex items-center px-3 rounded-l-lg
      border border-r-0
      border-slate-200 dark:border-slate-600
      bg-slate-100 dark:bg-slate-700
      text-slate-500 dark:text-slate-400 text-sm"
                      >
                        https://www.
                      </span>

                      {/* Input */}
                      <input
                        className={`${inputStyle} rounded-l-none ${errors.website ? "border-red-500 bg-red-50 dark:bg-red-900/30" : ""}`}
                        placeholder="example.com"
                        value={form.website}
                        onChange={(e) => updateField("website", e.target.value)}
                      />
                    </div>

                    {errors.website && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors.website}
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/* Permissions */}
              {/* <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-1 bg-purple-500 rounded-full"></div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Permissions
                  </h3>
                </div>

                <Select
                  isMulti
                  options={permissionOptions}
                  value={permissionOptions.filter((opt) =>
                    selectedPermissions.includes(opt.value),
                  )}
                  onChange={(selected) =>
                    setSelectedPermissions(selected.map((s) => s.value))
                  }
                  placeholder="Select permissions..."
                  className="text-sm"
                  classNamePrefix="react-select"
                  styles={customSelectStyles}
                />
              </section> */}

              {/* Footer Controls */}
              <div
                className="bg-slate-50 dark:bg-slate-800
border-t border-gray-200 dark:border-slate-700
-mx-6 -mb-6 p-6
flex flex-col md:flex-row items-center justify-between gap-4 mt-8"
              >
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={form.allowedToLogin}
                      onChange={(e) =>
                        setForm({ ...form, allowedToLogin: e.target.checked })
                      }
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2C92D5]"></div>
                  </div>
                  <span
                    className="text-sm font-medium 
text-slate-600 dark:text-slate-300
group-hover:text-slate-900 dark:group-hover:text-white
transition-colors"
                  >
                    Allow user to login
                  </span>
                </label>

                <div className="flex gap-3 w-full md:w-auto">
                  {/* <button
                                            type="button"
                                            onClick={() => setShowModal(false)}
                                            className="flex-1 md:flex-none px-6 py-2.5
text-slate-600 dark:text-slate-300
font-semibold
hover:bg-slate-200 dark:hover:bg-slate-700
rounded-lg transition-colors"
                                        >
                                            Cancel
                                        </button> */}
                  <button
                    type="submit"
                    disabled={creating}
                    className={`relative flex-1 md:flex-none px-8 py-3
  rounded-xl font-semibold text-white
  hover:shadow-lg hover:shadow-indigo-200
  dark:shadow-black/40
  transition-all duration-300
  active:scale-[0.97]
  disabled:opacity-50 disabled:cursor-not-allowed
  overflow-hidden text-sm`}
                    style={{
                      backgroundColor: "var(--primary-color)",
                    }}
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
                      {creating
                        ? editOfficer
                          ? "Updating Officer..."
                          : "Creating Officer..."
                        : editOfficer
                          ? "Update Officer"
                          : "Create Officer"}
                    </span>

                    {/* Shine Effect */}
                    <span
                      className="absolute inset-0 
  bg-white/10 dark:bg-white/5 
  opacity-0 hover:opacity-20 
  transition-opacity duration-300"
                    ></span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewOfficer && (
        <div
          className="fixed inset-0 
    bg-black/60 dark:bg-black/80
    backdrop-blur-sm 
    flex items-center justify-center 
    z-[777787878788] p-4 transition-colors"
        >
          <div
            className="bg-white dark:bg-slate-800
      rounded-2xl shadow-2xl
      border border-gray-200 dark:border-slate-700
      w-full max-w-3xl max-h-[90vh]
      overflow-y-auto 
      transition-colors"
          >
            {/* Header (Sticky & Solid Background) */}
            <div
              className="sticky top-0 z-30
bg-white dark:bg-slate-800
border-b border-gray-200 dark:border-slate-700
px-6 py-4
flex justify-between items-center"
            >
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">
                Loan Officer Profile
              </h2>

              <button
                onClick={() => setViewOfficer(null)}
                className="h-9 w-9 flex items-center justify-center rounded-full
    text-slate-400 dark:text-slate-500
    hover:bg-red-50 dark:hover:bg-red-900/30
    hover:text-red-600 dark:hover:text-red-400
    transition-all"
              >
                ✕
              </button>
            </div>

            {/* Avatar Section - Centered */}
            <div className="flex flex-col items-center text-center mb-10 mt-4">
              <div
                className="h-28 w-28 rounded-full overflow-hidden
    bg-slate-100 dark:bg-slate-700
    border border-gray-200 dark:border-slate-600
    shadow-sm"
              >
                {viewOfficer.profile?.avatarUrl ? (
                  <img
                    src={`${API_BASE}${viewOfficer.profile.avatarUrl}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className="h-full flex items-center justify-center
        text-slate-400 dark:text-slate-300"
                  >
                    No Image
                  </div>
                )}
              </div>

              <h3 className="mt-4 text-xl font-semibold text-slate-800 dark:text-slate-200">
                {viewOfficer.firstName} {viewOfficer.lastName}
              </h3>

              <p className="text-slate-500 dark:text-slate-400">
                {viewOfficer.email}
              </p>

              <span
                className={`mt-2 px-3 py-1 text-xs font-medium rounded-full
    ${
      viewOfficer.status === "ACTIVE"
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
        : "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"
    }`}
              >
                {viewOfficer.status}
              </span>
            </div>

            {/* Grid Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm p-4">
              <InfoItem
                label="Phone"
                value={viewOfficer.phone ? formatPhone(viewOfficer.phone) : "-"}
              />
              <InfoItem label="Email" value={viewOfficer.email} />
              <InfoItem label="Company" value={viewOfficer.profile?.company} />
              <InfoItem
                label="Toll Free"
                value={viewOfficer.profile?.tollFree}
              />
              <InfoItem label="Ext" value={viewOfficer.profile?.tollFreeExt} />
              <InfoItem
                label="Service Provider"
                value={viewOfficer.profile?.serviceProvider}
              />
              <InfoItem
                label="License Number"
                value={viewOfficer.profile?.licenseNumber}
              />
              <InfoItem
                label="Agent Type"
                value={viewOfficer.profile?.agentType}
              />
              <InfoItem
                label="Preferred Comm"
                value={viewOfficer.profile?.preferredComm}
              />
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

              {/* Permissions */}
              {/* <div className="md:col-span-2 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Permissions
                </p>

                <div className="flex flex-wrap gap-2">
                  {viewOfficer.permissions &&
                  viewOfficer.permissions.length > 0 ? (
                    viewOfficer.permissions.map((perm) => (
                      <span
                        key={perm}
                        className="px-3 py-1 rounded-full text-xs font-medium
          bg-indigo-100 text-indigo-700
          dark:bg-indigo-900/30 dark:text-indigo-400"
                      >
                        {getPermissionLabel(perm)}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400 italic">
                      No permissions assigned
                    </span>
                  )}
                </div>
              </div> */}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
