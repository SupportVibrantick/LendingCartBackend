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
  Power,
  RefreshCw,
  Search,
  Trash2,
  MoreVertical,
  UserCheck,
  Users,
  UserX,
  Activity,
  ExternalLink,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
// import Select from "react-select";
import PageMeta from "../../components/common/PageMeta";
import ViewLoanOfficerModal from "./ViewLoanOfficerModal";
import { US_STATES, formatPhone } from "./loanOfficerShared";

export { PERMISSIONS, US_STATES } from "./loanOfficerShared";

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

const ACTION_MENU_WIDTH = 168;
const ACTION_MENU_HEIGHT = 232;

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
      className={`group inline-flex w-full items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 transition hover:text-[#13538A] ${
        align === "right" ? "justify-end" : "justify-start"
      } ${active ? "text-[#13538A]" : ""}`}
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
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement | null>(null);

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
      closeRowMenu();
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

  const handleImpersonate = async (officer: LoanOfficer) => {
    if (officer.status !== "ACTIVE") {
      toast.error("Only active loan officers can be accessed");
      return;
    }

    try {
      setImpersonatingId(officer.id);
      closeRowMenu();

      const res = await fetch(
        `${API_BASE}/broker/users/${officer.id}/impersonate`,
        {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({}),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to access loan officer portal");
      }

      const query = new URLSearchParams({
        token: json.token,
        user: JSON.stringify(json.user),
      });
      if (json.permissions?.length) {
        query.set("permissions", JSON.stringify(json.permissions));
      }

      const portalUrl = `/loan-officer/impersonate?${query.toString()}`;
      const newTab = window.open(portalUrl, "_blank", "noopener,noreferrer");

      if (!newTab) {
        toast.error("Pop-up blocked. Allow pop-ups to open the loan officer portal.");
        return;
      }

      toast.success(
        `Opened portal for ${officer.firstName} ${officer.lastName}`,
      );
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to open loan officer portal",
      );
    } finally {
      setImpersonatingId(null);
    }
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current?.contains(target) ||
        (target instanceof Element && target.closest("[data-menu-id]"))
      ) {
        return;
      }
      setActiveMenuId(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveMenuId(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!activeMenuId) return;

    const reposition = () => {
      const btn = document.querySelector(
        `[data-menu-id="${activeMenuId}"]`,
      ) as HTMLElement | null;
      if (!btn) return;
      setMenuPos(computeActionMenuPosition(btn.getBoundingClientRect()));
    };

    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [activeMenuId]);

  const openRowMenu = (id: string, event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setMenuPos(computeActionMenuPosition(event.currentTarget.getBoundingClientRect()));
    setActiveMenuId((current) => (current === id ? null : id));
  };

  const closeRowMenu = () => setActiveMenuId(null);

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

  const activeMenuUser = useMemo(
    () => sortedOfficers.find((o) => o.id === activeMenuId) ?? null,
    [sortedOfficers, activeMenuId],
  );

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

    closeRowMenu();
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

      <div className="space-y-4 pb-6">
        {/* Hero */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#2C92D5] p-4 text-white shadow-sm dark:border-gray-800 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-medium backdrop-blur-sm">
                <Users className="h-3 w-3" />
                CRM · Team
              </div>
              <h1 className="text-xl font-semibold tracking-tight">Loan Officers</h1>
              <p className="mt-1 max-w-2xl text-xs text-white/80">
                Manage and monitor all your loan officers in one place.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/20 backdrop-blur-sm">
                <p className="text-[10px] text-white/70">Total (page)</p>
                <p className="mt-0.5 text-lg font-semibold">{stats.total}</p>
              </div>
              <div className="rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/20 backdrop-blur-sm">
                <p className="flex items-center gap-1 text-[10px] text-white/70">
                  <UserCheck className="h-3 w-3" /> Active
                </p>
                <p className="mt-0.5 text-lg font-semibold">{stats.active}</p>
              </div>
              <div className="rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/20 backdrop-blur-sm">
                <p className="flex items-center gap-1 text-[10px] text-white/70">
                  <UserX className="h-3 w-3" /> Disabled
                </p>
                <p className="mt-0.5 text-lg font-semibold">{stats.disabled}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                placeholder="Search loan officers..."
                className="h-9 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-9 text-xs outline-none focus:border-[#13538A]/40 focus:ring-2 focus:ring-[#13538A]/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fetchOfficers()}
                disabled={loading}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>

              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#13538A] px-3 text-xs font-medium text-white shadow-sm hover:bg-[#1a6aad]"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Loan Officer
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-0.5">
            <span className="shrink-0 text-[10px] font-medium text-gray-500">Status:</span>
            {(["", "ACTIVE", "DISABLED"] as const).map((value) => (
              <button
                key={value || "all"}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium transition ${
                  statusFilter === value
                    ? "bg-[#13538A] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                }`}
              >
                {value === "" ? "All" : value === "ACTIVE" ? "Active" : "Disabled"}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
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
            <div className="max-h-[calc(100vh-15rem)] overflow-y-auto overflow-x-hidden">
              <table className="w-full table-fixed border-collapse text-left text-xs">
                <colgroup>
                  <col className="w-12" />
                  <col className="w-[24%]" />
                  <col className="w-[30%]" />
                  <col className="w-[14%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                  <col className="w-14" />
                </colgroup>
                <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/95 backdrop-blur dark:border-gray-700 dark:bg-gray-800/95">
                  <tr>
                    <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      #
                    </th>
                    <th className="px-4 py-2">
                      <SortHeader
                        label="Name"
                        active={sortKey === "name"}
                        direction={sortDir}
                        onClick={() => toggleSort("name")}
                      />
                    </th>
                    <th className="px-4 py-2">
                      <SortHeader
                        label="Email"
                        active={sortKey === "email"}
                        direction={sortDir}
                        onClick={() => toggleSort("email")}
                      />
                    </th>
                    <th className="px-4 py-2">
                      <SortHeader
                        label="Phone"
                        active={sortKey === "phone"}
                        direction={sortDir}
                        onClick={() => toggleSort("phone")}
                      />
                    </th>
                    <th className="px-4 py-2">
                      <SortHeader
                        label="Status"
                        active={sortKey === "status"}
                        direction={sortDir}
                        onClick={() => toggleSort("status")}
                      />
                    </th>
                    <th className="px-4 py-2">
                      <SortHeader
                        label="Created"
                        active={sortKey === "createdAt"}
                        direction={sortDir}
                        onClick={() => toggleSort("createdAt")}
                      />
                    </th>
                    <th className="px-4 py-2 text-right">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Actions
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {sortedOfficers.map((o, index) => {
                    const fullName = `${o.firstName} ${o.lastName}`.trim();
                    const isActive = o.status === "ACTIVE";

                    return (
                      <tr
                        key={o.id}
                        className={`group transition-colors ${
                          isActive
                            ? "hover:bg-[#13538A]/[0.03] dark:hover:bg-gray-800/40"
                            : "bg-gray-50/50 hover:bg-gray-100/70 dark:bg-gray-900/20 dark:hover:bg-gray-800/40"
                        }`}
                      >
                        <td className="px-4 py-2.5 text-[11px] font-medium tabular-nums text-gray-400">
                          {(page - 1) * limit + index + 1}
                        </td>

                        <td className="px-4 py-2.5">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 ring-gray-200/80 dark:ring-gray-700">
                              {o.profile?.avatarUrl ? (
                                <img
                                  src={`${API_BASE}${o.profile.avatarUrl}`}
                                  alt={fullName}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span
                                  className={`flex h-full w-full items-center justify-center text-[11px] font-bold ${getAvatarTone(fullName)}`}
                                >
                                  {getInitials(o.firstName, o.lastName)}
                                </span>
                              )}
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white dark:border-gray-900 ${
                                  isActive ? "bg-emerald-500" : "bg-gray-400"
                                }`}
                              />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-gray-900 dark:text-gray-100">
                                {fullName}
                              </p>
                              <p className="truncate text-[10px] text-gray-400">
                                {o.profile?.agentType || "Loan Officer"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-2.5">
                          <a
                            href={`mailto:${o.email}`}
                            className="flex min-w-0 items-center gap-1.5 text-xs text-gray-600 transition hover:text-[#13538A] dark:text-gray-300 dark:hover:text-cyan-400"
                            title={o.email}
                          >
                            <Mail className="h-3 w-3 shrink-0 text-gray-400" />
                            <span className="truncate">{o.email}</span>
                          </a>
                        </td>

                        <td className="px-4 py-2.5">
                          {o.phone ? (
                            <a
                              href={`tel:${o.phone}`}
                              className="inline-flex items-center gap-1.5 text-xs text-gray-600 transition hover:text-[#13538A] dark:text-gray-300 dark:hover:text-cyan-400"
                            >
                              <Phone className="h-3 w-3 shrink-0 text-gray-400" />
                              {formatPhone(o.phone)}
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>

                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            disabled={togglingId === o.id}
                            onClick={() => toggleStatus(o.id, o.status)}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition disabled:opacity-50 ${
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
                            {togglingId === o.id ? "..." : isActive ? "Active" : "Disabled"}
                          </button>
                        </td>

                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <Calendar className="h-3 w-3 shrink-0 opacity-70" />
                            <span className="whitespace-nowrap">{formatDate(o.createdAt)}</span>
                          </div>
                        </td>

                        <td className="px-2 py-2.5 text-right">
                          <button
                            type="button"
                            data-menu-id={o.id}
                            onClick={(event) => openRowMenu(o.id, event)}
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-gray-500 transition hover:border-gray-200 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:border-gray-700 dark:hover:bg-gray-800 dark:hover:text-white ${
                              activeMenuId === o.id
                                ? "border-gray-200 bg-gray-100 text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                : ""
                            }`}
                            title="Actions"
                            aria-label="Open actions menu"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && sortedOfficers.length > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-gray-100 bg-gray-50/50 px-4 py-2.5 text-[10px] text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing{" "}
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {sortedOfficers.length}
                </span>{" "}
                on page{" "}
                <span className="font-semibold text-gray-800 dark:text-gray-200">{page}</span>
                {statusFilter ? (
                  <>
                    {" "}
                    · filtered by{" "}
                    <span className="font-medium text-[#13538A] dark:text-cyan-400">
                      {statusFilter.toLowerCase()}
                    </span>
                  </>
                ) : null}
              </span>
              <span className="text-gray-400">
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

      {activeMenuUser &&
        activeMenuId &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: menuPos.top, left: menuPos.left }}
            className="z-[9999] w-[168px] max-h-[min(232px,calc(100vh-16px))] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-800">
              <p className="truncate text-[11px] font-semibold text-gray-900 dark:text-white">
                {activeMenuUser.firstName} {activeMenuUser.lastName}
              </p>
              <p className="truncate text-[10px] text-gray-500">{activeMenuUser.email}</p>
            </div>

            <div className="py-0.5">
              <button
                type="button"
                onClick={() => {
                  closeRowMenu();
                  navigate("/loan-officer-activity", {
                    state: { officerId: activeMenuUser.id },
                  });
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <Activity className="h-3.5 w-3.5 text-sky-600" />
                Activity
              </button>
              <button
                type="button"
                onClick={() => {
                  closeRowMenu();
                  setViewOfficer(activeMenuUser);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <Eye className="h-3.5 w-3.5 text-[#13538A]" />
                View details
              </button>
              <button
                type="button"
                disabled={
                  impersonatingId === activeMenuUser.id ||
                  activeMenuUser.status !== "ACTIVE"
                }
                onClick={() => handleImpersonate(activeMenuUser)}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <ExternalLink className="h-3.5 w-3.5 text-cyan-600" />
                {impersonatingId === activeMenuUser.id
                  ? "Opening portal..."
                  : "Access portal"}
              </button>
              <button
                type="button"
                onClick={() => {
                  closeRowMenu();
                  openEditModal(activeMenuUser);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <Pencil className="h-3.5 w-3.5 text-amber-600" />
                Edit
              </button>
              <button
                type="button"
                disabled={togglingId === activeMenuUser.id}
                onClick={() => toggleStatus(activeMenuUser.id, activeMenuUser.status)}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <Power
                  className={`h-3.5 w-3.5 ${
                    activeMenuUser.status === "ACTIVE" ? "text-emerald-600" : "text-gray-500"
                  }`}
                />
                {activeMenuUser.status === "ACTIVE" ? "Disable" : "Enable"}
              </button>
            </div>

            <div className="border-t border-gray-100 py-0.5 dark:border-gray-800">
              <button
                type="button"
                onClick={() => handleDelete(activeMenuUser.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          </div>,
          document.body,
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
        <ViewLoanOfficerModal
          officerId={viewOfficer.id}
          fallback={viewOfficer}
          onClose={() => setViewOfficer(null)}
        />
      )}
    </>
  );
}
