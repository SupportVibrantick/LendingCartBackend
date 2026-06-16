import React, { useEffect, useMemo, useState } from "react";
import { TiPlus } from "react-icons/ti";
import Swal from "sweetalert2";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  BROKER_DETAIL_PATH,
  setActiveBrokerId,
} from "../../lib/brokerDetailNavigation";
import {
  LO_US_STATES,
  formatLoZip,
  normalizeLoWebsiteUrl,
} from "../../lib/brokerLoanOfficerForm";

Swal.mixin({
  customClass: {
    popup: "swal-high-z",
  },
});

import {
  RefreshCcw,
  Search,
  Building2,
  SearchX,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  Users,
  UserCheck,
  Activity,
} from "lucide-react";

type Broker = {
  id: string;
  name: string;
  email: string;
  phone: string;

  adminId?: string;
  adminFirstName?: string;
  adminLastName?: string;
  adminEmail?: string;
  adminPassword?: string;
  adminStatus?: string;

  affiliateLinks?: any[];
  lenderAccess?: any[];
  whiteLabel?: any;

  adminCount?: number;
  affiliateLinksCount?: number;
  lenderAccessCount?: number;

  status?: string;
  createdAt?: string;
  updatedAt?: string;
  profileImage?: string | null;
};

type Admin = {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
};

function statusClass(status?: string) {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/40";
    case "INACTIVE":
      return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-300 dark:border-yellow-500/40";
    case "SUSPENDED":
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/40";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-slate-600/30 dark:text-slate-100 dark:border-slate-500";
  }
}

function formatCardDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function BrokersPage() {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState({
    organizationName: "",
    organizationEmail: "",
    organizationPhone: "",
    adminFirstName: "",
    adminLastName: "",
    adminEmail: "",
    adminPassword: "",
    adminPhone: "",
    company: "",
    licenseNumber: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    website: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Admins modal & editing state
  const [showAdminsFor, setShowAdminsFor] = useState<Broker | null>(null);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [adminsError, setAdminsError] = useState<string | null>(null);

  // Admin inline-edit state
  const [editingAdminId, setEditingAdminId] = useState<string | null>(null);
  const [adminEditForm, setAdminEditForm] = useState<Admin>({});
  const [adminSaving, setAdminSaving] = useState(false);

  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

  const navigate = useNavigate();

  useEffect(() => {
    fetchBrokers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, pageSize]);

  function getAuthHeaders(): Record<string, string> {
    try {
      const token = sessionStorage.getItem("admin_token");
      if (token) {
        return {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        };
      }
    } catch (e) {
      // ignore
    }
    return { "Content-Type": "application/json" };
  }

  async function fetchBrokers() {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/admin/brokers/read`, {
        method: "GET",
        headers,
      });

      if (!res.ok) throw new Error(`Failed to fetch brokers: ${res.status}`);

      const json = await res.json();
      const list = Array.isArray(json) ? json : json.data || [];

      const normalized: Broker[] = list.map((o: any) => ({
        id: String(o.id),
        name: o.name ?? "",
        email: o.email ?? "",
        phone: o.phone ?? "",
        status: o.status ?? "UNKNOWN",
        createdAt: o.createdAt ?? null,
        profileImage: o.profileImage || null,
      }));

      setBrokers(normalized);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const openAdd = () => {
    setForm({
      organizationName: "",
      organizationEmail: "",
      organizationPhone: "",
      adminFirstName: "",
      adminLastName: "",
      adminEmail: "",
      adminPassword: "",
      adminPhone: "",
      company: "",
      licenseNumber: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      website: "",
    });
    setFormError(null);
    setErrors({});
    setIsAddOpen(true);
  };

  const formatUSPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 10);
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) {
      return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
    }
    return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6)}`;
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const usPhoneRegex = /^(?:\+1\s?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}$/;
    const nameRegex = /^[A-Za-z\s'-]+$/;
    const strongPassword =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;

    if (!form.organizationName.trim()) {
      newErrors.organizationName = "Organization name is required.";
    } else if (form.organizationName.trim().length < 2) {
      newErrors.organizationName = "Minimum 2 characters required.";
    }

    if (!form.organizationEmail.trim()) {
      newErrors.organizationEmail = "Organization email is required.";
    } else if (!emailRegex.test(form.organizationEmail.trim())) {
      newErrors.organizationEmail = "Enter a valid email address.";
    }

    if (!form.organizationPhone.trim()) {
      newErrors.organizationPhone = "Organization phone is required.";
    } else if (!usPhoneRegex.test(form.organizationPhone.trim())) {
      newErrors.organizationPhone =
        "Enter valid US phone number (e.g., 123-456-7890).";
    }

    if (!form.adminFirstName.trim()) {
      newErrors.adminFirstName = "First name is required.";
    } else if (!nameRegex.test(form.adminFirstName.trim())) {
      newErrors.adminFirstName = "Only letters allowed.";
    }

    if (!form.adminLastName.trim()) {
      newErrors.adminLastName = "Last name is required.";
    } else if (!nameRegex.test(form.adminLastName.trim())) {
      newErrors.adminLastName = "Only letters allowed.";
    }

    if (!form.adminEmail.trim()) {
      newErrors.adminEmail = "Admin email is required.";
    } else if (!emailRegex.test(form.adminEmail.trim())) {
      newErrors.adminEmail = "Enter a valid email address.";
    }

    if (!form.adminPassword.trim()) {
      newErrors.adminPassword = "Password is required.";
    } else if (!strongPassword.test(form.adminPassword)) {
      newErrors.adminPassword =
        "Password must be 8+ chars, include uppercase, lowercase, number & special character.";
    }

    if (form.adminPhone.trim() && !usPhoneRegex.test(form.adminPhone.trim())) {
      newErrors.adminPhone =
        "Enter valid US phone number (e.g., 123-456-7890).";
    }

    const licenseRegex = /^[A-Za-z0-9-]{4,20}$/;
    const zipRegex = /^\d{5}(-\d{4})?$/;

    if (form.licenseNumber.trim() && !licenseRegex.test(form.licenseNumber.trim())) {
      newErrors.licenseNumber =
        "License must be 4–20 alphanumeric characters.";
    }

    if (form.zipCode.trim() && !zipRegex.test(form.zipCode.trim())) {
      newErrors.zipCode = "Enter valid US ZIP (e.g. 12345 or 12345-6789).";
    }

    if (form.website.trim()) {
      const normalized = normalizeLoWebsiteUrl(form.website);
      if (!normalized) {
        newErrors.website = "Enter a valid website URL.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setFormError(null);

    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload: Record<string, string> = {
        organizationName: form.organizationName.trim(),
        organizationEmail: form.organizationEmail.trim().toLowerCase(),
        organizationPhone: form.organizationPhone.replace(/\D/g, ""),
        adminFirstName: form.adminFirstName.trim(),
        adminLastName: form.adminLastName.trim(),
        adminEmail: form.adminEmail.trim().toLowerCase(),
        adminPassword: form.adminPassword,
      };

      const adminPhoneDigits = form.adminPhone.replace(/\D/g, "");
      if (adminPhoneDigits) payload.adminPhone = adminPhoneDigits;

      const optionalFields: Array<[keyof typeof form, string]> = [
        ["company", "company"],
        ["licenseNumber", "licenseNumber"],
        ["address", "address"],
        ["city", "city"],
        ["state", "state"],
        ["zipCode", "zipCode"],
      ];

      optionalFields.forEach(([formKey, payloadKey]) => {
        const value = String(form[formKey] ?? "").trim();
        if (value) payload[payloadKey] = value;
      });

      if (form.website.trim()) {
        const normalizedWebsite = normalizeLoWebsiteUrl(form.website);
        if (normalizedWebsite) payload.website = normalizedWebsite;
      }

      const headers = getAuthHeaders();

      const res = await fetch(`${API_BASE}/admin/brokers/create`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(json?.message || `Server returned ${res.status}`);
        return;
      }

      setIsAddOpen(false);
      await fetchBrokers();
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return brokers;
    return brokers.filter((b) => {
      return (
        (b.name || "").toLowerCase().includes(q) ||
        (b.email || "").toLowerCase().includes(q) ||
        (b.phone || "").toLowerCase().includes(q) ||
        (b.status || "").toLowerCase().includes(q)
      );
    });
  }, [brokers, query]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  function gotoPage(page: number) {
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function fetchAdmins(brokerId: string) {
    setLoadingAdmins(true);
    setAdmins([]);
    setAdminsError(null);

    try {
      const token = sessionStorage.getItem("admin_token");
      const res = await fetch(`${API_BASE}/admin/brokers/read/${brokerId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) throw new Error(`Failed to load admins: ${res.status}`);

      const json = await res.json().catch(() => ({}) as any);

      const adminList = json?.data?.admins || [];
      const normalized: Admin[] = (
        Array.isArray(adminList) ? adminList : []
      ).map((a: any) => ({
        id: a.id,
        firstName: a.firstName ?? "",
        lastName: a.lastName ?? "",
        email: a.email ?? "",
        phone: a.phone ?? "",
      }));

      setAdmins(normalized);
    } catch (err: any) {
      console.error("fetchAdmins error:", err);
      setAdminsError(err?.message || "Failed to load admins");
    } finally {
      setLoadingAdmins(false);
    }
  }

  // const openAdminsFor = async (broker: Broker) => {
  //   setShowAdminsFor(broker);
  //   setEditingAdminId(null);
  //   setAdminEditForm({});
  //   await fetchAdmins(broker.id);
  // };

  const closeAdmins = () => {
    setShowAdminsFor(null);
    setAdmins([]);
    setAdminsError(null);
    setEditingAdminId(null);
    setAdminEditForm({});
  };

  const startEditAdmin = (a: Admin) => {
    setEditingAdminId(a.id ?? null);
    setAdminEditForm({
      id: a.id,
      firstName: a.firstName,
      lastName: a.lastName,
      email: a.email,
      phone: a.phone,
    });
  };

  const cancelEditAdmin = () => {
    setEditingAdminId(null);
    setAdminEditForm({});
  };

  const saveAdminEdit = async () => {
    const adminId = editingAdminId;
    if (!adminId) return alert("No admin selected for edit.");
    if (!showAdminsFor?.id)
      return alert("No broker selected for this admin edit.");

    if (
      !(
        adminEditForm.firstName ||
        adminEditForm.lastName ||
        adminEditForm.email
      )
    ) {
      return alert(
        "Please provide at least one field to update (first name / last name / email).",
      );
    }

    setAdminSaving(true);

    setAdmins((prev) =>
      prev.map((p) => (p.id === adminId ? { ...p, ...adminEditForm } : p)),
    );

    try {
      const token = sessionStorage.getItem("admin_token");
      const res = await fetch(
        `${API_BASE}/admin/brokers/update/${showAdminsFor.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            admin: {
              id: adminId,
              firstName: adminEditForm.firstName,
              lastName: adminEditForm.lastName,
              email: adminEditForm.email,
            },
          }),
        },
      );

      if (!res.ok) {
        throw new Error(`Save failed: ${res.status}`);
      }

      const json = await res.json().catch(() => ({}) as any);
      if (json && json.data && json.data.admin) {
        const serverAdmin = json.data.admin;
        setAdmins((prev) =>
          prev.map((p) => (p.id === adminId ? { ...p, ...serverAdmin } : p)),
        );
      }

      setEditingAdminId(null);
      setAdminEditForm({});
    } catch (err: any) {
      console.error("saveAdminEdit error:", err);
      alert(err?.message || "Failed to save admin. Changes rolled back.");
      if (showAdminsFor?.id) {
        await fetchAdmins(showAdminsFor.id);
      }
    } finally {
      setAdminSaving(false);
    }
  };

  const activeBrokers = useMemo(
    () => brokers.filter((l) => l.status === "ACTIVE").length,
    [brokers],
  );

  const totalBrokers = brokers.length;

  const isSearchEmpty =
    query.trim() !== "" && filtered.length === 0 && !loading;
  const isTotalEmpty = query.trim() === "" && total === 0 && !loading;

  const InfoTip = ({ text }: { text: string }) => (
    <div className="relative group cursor-pointer">
      <span className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
        ⓘ
      </span>
      <div className="absolute left-1/2 top-full z-50 mt-2 hidden w-64 -translate-x-1/2 rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-lg group-hover:block">
        {text}
      </div>
    </div>
  );
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 px-4 py-8 sm:px-6 lg:px-8 transition-colors duration-300">
      {/* Header + controls */}
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#13538A] dark:text-indigo-600">
              All Brokers 
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
              Manage broker organizations and their admins.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchBrokers}
              disabled={loading}
              className="group flex items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all active:scale-95 disabled:opacity-50"
              title="Refresh List"
            >
              <RefreshCcw
                size={18}
                className={`${loading ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"} text-blue-600`}
              />
            </button>
            <button
              onClick={openAdd}
              className="inline-flex items-center whitespace-nowrap px-4 py-2.5 bg-[#13538A] text-white text-sm font-bold rounded-xl hover:bg-[#2e87d4] shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
            >
              <TiPlus className="mr-2 text-lg" />
              Add Broker
            </button>
            <button
              onClick={() => navigate("/all-brokers-lenders")}
              className="inline-flex items-center whitespace-nowrap px-4 py-2.5 bg-[#13538A] text-white text-sm font-bold rounded-xl hover:bg-[#2e87d4] shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
            >
              <UserCheck className="mr-2 h-5 w-5" />
              Assigned Lenders
            </button>
          </div>
        </div>

        {/* ================= STATS CARDS ================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {/* TOTAL Brokers */}
          <div
            className="
    bg-white dark:bg-slate-900
    border border-slate-200 dark:border-slate-800
    rounded-2xl p-6
    shadow-sm hover:shadow-md
    transition-all duration-200
    flex items-center justify-between
  "
          >
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Total Brokers
              </p>
              <p className="text-xl font-semibold text-slate-900 dark:text-white mt-1">
                {totalBrokers}
              </p>
            </div>

            <div className="h-8 w-8 flex items-center justify-center rounded-full bg-indigo-600 text-white">
              <Users className="w-5 h-5" />
            </div>
          </div>

          {/* Total Volume */}
          <div
            className="
    bg-white dark:bg-slate-900
    border border-slate-200 dark:border-slate-800
    rounded-2xl p-6
    shadow-sm hover:shadow-md
    transition-all duration-200
    flex items-center justify-between
  "
          >
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Total Volume
              </p>
              <p className="text-xl font-semibold text-slate-900 dark:text-white mt-1">
                0
              </p>
            </div>

            <div className="h-8 w-8 flex items-center justify-center rounded-full bg-red-600 text-white">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>

          {/* Active Lenders */}
          <div
            className="
    bg-white dark:bg-slate-900
    border border-slate-200 dark:border-slate-800
    rounded-2xl p-6
    shadow-sm hover:shadow-md
    transition-all duration-200
    flex items-center justify-between
  "
          >
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Active Lenders
              </p>
              <p className="text-xl font-semibold text-slate-900 dark:text-white mt-1">
                {activeBrokers}
              </p>
            </div>

            <div className="h-8 w-8 flex items-center justify-center rounded-full bg-emerald-600 text-white">
              <Activity className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* ================= SEARCH & FILTER BAR ================= */}
        <div className="mb-8 p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search
              size={20}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(e) => {
                setCurrentPage(1);
                setQuery(e.target.value);
              }}
              placeholder="Search by name, email, phone or status..."
              className="text-sm w-full pl-12 pr-4 py-2 bg-transparent border-none focus:ring-2 focus:ring-blue-500/20 rounded-xl text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
            />
          </div>

          <div className="hidden md:block h-8 w-px bg-slate-200 dark:bg-slate-800"></div>

          <div className="flex items-center gap-2 pr-4">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
              View:
            </span>

            <div className="relative">
              <select
                value={pageSize}
                onChange={(e) => {
                  setCurrentPage(1);
                  setPageSize(Number(e.target.value));
                }}
                className="
                            appearance-none
                            px-3 py-2 pr-8
                            rounded-xl text-sm font-semibold
                            bg-white dark:bg-slate-800
                            text-slate-900 dark:text-slate-100
                            border border-slate-200 dark:border-slate-700
                            hover:bg-slate-50 dark:hover:bg-slate-700
                            focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500
                            transition cursor-pointer
                        "
              >
                <option value={6}>6 / page</option>
                <option value={9}>9 / page</option>
                <option value={12}>12 / page</option>
                <option value={20}>20 / page</option>
              </select>

              <svg
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* ================= CONTENT GRID ================= */}
        {loading ? (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(220px,260px))]">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-52 w-full max-w-[260px] overflow-hidden rounded-2xl border border-slate-200 bg-white animate-pulse dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="h-1 bg-slate-200 dark:bg-slate-700" />
                <div className="space-y-4 p-5">
                  <div className="flex gap-3">
                    <div className="h-12 w-12 rounded-xl bg-slate-200 dark:bg-slate-700" />
                    <div className="flex-1 space-y-2 pt-1">
                      <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
                      <div className="h-3 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
                    </div>
                  </div>
                  <div className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800/50" />
                </div>
              </div>
            ))}
          </div>
        ) : isTotalEmpty ? (
          <div className="py-24 flex flex-col items-center text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 shadow-sm">
            <div className="w-24 h-24 rounded-3xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-6">
              <Building2
                size={48}
                className="text-blue-600 dark:text-blue-400"
              />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
              No Broker Found
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-sm">
              Get started by adding a new Broker to the platform.
            </p>
            <button
              onClick={openAdd}
              className="mt-6 px-6 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition"
            >
              Add Broker
            </button>
          </div>
        ) : isSearchEmpty ? (
          <div className="py-24 flex flex-col items-center text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-orange-300 dark:border-orange-700/50 shadow-sm">
            <div className="w-24 h-24 rounded-3xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center mb-6">
              <SearchX
                size={48}
                className="text-orange-600 dark:text-orange-400"
              />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
              No Results Found
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-sm">
              We couldn't find any Broker matching "
              <span className="font-semibold text-orange-600">{query}</span>".
            </p>
            <button
              onClick={() => setQuery("")}
              className="mt-6 text-sm font-bold text-blue-600 hover:underline"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(220px,260px))]">
            {paginated.map((l) => (
              <div
                key={l.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setActiveBrokerId(l.id);
                  navigate(BROKER_DETAIL_PATH);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActiveBrokerId(l.id);
                    navigate(BROKER_DETAIL_PATH);
                  }
                }}
                className="group flex w-full max-w-[260px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-colors duration-200 hover:border-[#13538A]/35 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/40 cursor-pointer"
              >
                <div className="h-1 bg-gradient-to-r from-[#13538A] via-[#18B6B4] to-emerald-400 opacity-80 group-hover:opacity-100" />

                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 dark:border-emerald-500/20 dark:from-emerald-500/10 dark:to-teal-500/10">
                        {l.profileImage ? (
                          <img
                            src={`${API_BASE}/public${l.profileImage}`}
                            className="h-full w-full object-cover"
                            onError={(e: any) => {
                              e.currentTarget.src = "/circle_logo.png";
                            }}
                            alt={l.name}
                          />
                        ) : (
                          <Building2
                            size={18}
                            className="text-emerald-600 dark:text-emerald-400"
                          />
                        )}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-1.5">
                        <h3
                          className="line-clamp-2 text-[13px] font-bold leading-snug text-slate-900 transition-colors group-hover:text-[#13538A] dark:text-white dark:group-hover:text-indigo-300"
                          title={l.name}
                        >
                          {l.name}
                        </h3>
                        <span
                          className={`pointer-events-none inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${statusClass(
                            l.status,
                          )}`}
                        >
                          {l.status === "ACTIVE" && (
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          )}
                          {l.status || "UNKNOWN"}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                        Broker organization
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2 rounded-lg border border-slate-100 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
                    <div className="flex items-start gap-2.5 text-slate-600 dark:text-slate-300">
                      <Mail size={13} className="mt-0.5 shrink-0 text-slate-400" />
                      <span
                        className="min-w-0 break-all text-[11px] leading-relaxed"
                        title={l.email}
                      >
                        {l.email || "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300">
                      <Phone size={13} className="shrink-0 text-slate-400" />
                      <span className="text-[11px]">{l.phone || "—"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-800/30">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Created {formatCardDate(l.createdAt)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#13538A] opacity-0 transition-opacity group-hover:opacity-100 dark:text-indigo-400">
                    View details
                    <ChevronRight size={12} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ================= PAGINATION ================= */}
        {!loading && totalPages > 1 && (
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-6 border-t border-slate-200 dark:border-slate-800 pt-8">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Showing{" "}
              <span className="text-slate-900 dark:text-white">
                Page {currentPage}
              </span>{" "}
              of {totalPages}
            </p>

            <div className="flex items-center gap-3">
              <button
                disabled={currentPage === 1}
                onClick={() => gotoPage(currentPage - 1)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-bold disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
              >
                <ChevronLeft size={18} />
                Prev
              </button>

              <button
                disabled={currentPage === totalPages}
                onClick={() => gotoPage(currentPage + 1)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-bold disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
              >
                Next
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Add Broker Modal */}
        {isAddOpen && (
          <div className="fixed inset-0 z-500000 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-lg dark:bg-slate-900 dark:border dark:border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Create Broker
                </h2>
                <button
                  onClick={() => setIsAddOpen(false)}
                  className="text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* ================= ORGANIZATION SECTION ================= */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                      Organization Details
                    </h3>
                    <InfoTip text="Basic information about the Broker organization." />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-sm text-gray-700 dark:text-slate-200">
                        Organization Name{" "}
                        <span className="text-red-500">*</span>
                      </span>
                      <input
                        value={form.organizationName}
                        onChange={(e) => {
                          setForm({ ...form, organizationName: e.target.value });
                          setErrors((prev) => ({ ...prev, organizationName: "" }));
                        }}
                        className={`w-full px-3 py-2 mt-1 border rounded-md bg-white text-gray-900 dark:bg-slate-800 dark:text-gray-100 ${
                          errors.organizationName
                            ? "border-red-500"
                            : "border-gray-300 dark:border-slate-600"
                        }`}
                      />
                      {errors.organizationName && (
                        <p className="text-xs text-red-600 mt-1">
                          {errors.organizationName}
                        </p>
                      )}
                    </label>

                    <label className="block">
                      <span className="text-sm text-gray-700 dark:text-slate-200">
                        Organization Email{" "}
                        <span className="text-red-500">*</span>
                      </span>
                      <input
                        type="email"
                        value={form.organizationEmail}
                        onChange={(e) => {
                          setForm({
                            ...form,
                            organizationEmail: e.target.value,
                          });
                          setErrors((prev) => ({ ...prev, organizationEmail: "" }));
                        }}
                        className={`w-full px-3 py-2 mt-1 border rounded-md bg-white text-gray-900 dark:bg-slate-800 dark:text-gray-100 ${
                          errors.organizationEmail
                            ? "border-red-500"
                            : "border-gray-300 dark:border-slate-600"
                        }`}
                      />
                      {errors.organizationEmail && (
                        <p className="text-xs text-red-600 mt-1">
                          {errors.organizationEmail}
                        </p>
                      )}
                    </label>

                    <label className="block md:col-span-1">
                      <span className="text-sm text-gray-700 dark:text-slate-200">
                        Organization Phone{" "}
                        <span className="text-red-500">*</span>
                      </span>
                      <input
                        type="tel"
                        value={form.organizationPhone}
                        onChange={(e) => {
                          setForm({
                            ...form,
                            organizationPhone: formatUSPhone(e.target.value),
                          });
                          setErrors((prev) => ({ ...prev, organizationPhone: "" }));
                        }}
                        placeholder="(123) 456-7890"
                        className={`w-full px-3 py-2 mt-1 border rounded-md bg-white text-gray-900 dark:bg-slate-800 dark:text-gray-100 ${
                          errors.organizationPhone
                            ? "border-red-500"
                            : "border-gray-300 dark:border-slate-600"
                        }`}
                      />
                      {errors.organizationPhone && (
                        <p className="text-xs text-red-600 mt-1">
                          {errors.organizationPhone}
                        </p>
                      )}
                    </label>
                  </div>
                </div>

                {/* ================= ADMIN SECTION ================= */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                      Admin Details
                    </h3>
                    <InfoTip text="Admin user who will manage this broker organization." />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* First + Last Name parallel */}
                    <label className="block">
                      <span className="text-sm text-gray-700 dark:text-slate-200">
                        Admin First Name <span className="text-red-500">*</span>
                      </span>
                      <input
                        value={form.adminFirstName}
                        onChange={(e) => {
                          setForm({ ...form, adminFirstName: e.target.value });
                          setErrors((prev) => ({ ...prev, adminFirstName: "" }));
                        }}
                        className={`w-full px-3 py-2 mt-1 border rounded-md bg-white text-gray-900 dark:bg-slate-800 dark:text-gray-100 ${
                          errors.adminFirstName
                            ? "border-red-500"
                            : "border-gray-300 dark:border-slate-600"
                        }`}
                      />
                      {errors.adminFirstName && (
                        <p className="text-xs text-red-600 mt-1">
                          {errors.adminFirstName}
                        </p>
                      )}
                    </label>

                    <label className="block">
                      <span className="text-sm text-gray-700 dark:text-slate-200">
                        Admin Last Name <span className="text-red-500">*</span>
                      </span>
                      <input
                        value={form.adminLastName}
                        onChange={(e) => {
                          setForm({ ...form, adminLastName: e.target.value });
                          setErrors((prev) => ({ ...prev, adminLastName: "" }));
                        }}
                        className={`w-full px-3 py-2 mt-1 border rounded-md bg-white text-gray-900 dark:bg-slate-800 dark:text-gray-100 ${
                          errors.adminLastName
                            ? "border-red-500"
                            : "border-gray-300 dark:border-slate-600"
                        }`}
                      />
                      {errors.adminLastName && (
                        <p className="text-xs text-red-600 mt-1">
                          {errors.adminLastName}
                        </p>
                      )}
                    </label>

                    {/* Email + Password parallel */}
                    <label className="block">
                      <span className="text-sm text-gray-700 dark:text-slate-200">
                        Admin Email <span className="text-red-500">*</span>
                      </span>
                      <input
                        type="email"
                        value={form.adminEmail}
                        onChange={(e) => {
                          setForm({ ...form, adminEmail: e.target.value });
                          setErrors((prev) => ({ ...prev, adminEmail: "" }));
                        }}
                        className={`w-full px-3 py-2 mt-1 border rounded-md bg-white text-gray-900 dark:bg-slate-800 dark:text-gray-100 ${
                          errors.adminEmail
                            ? "border-red-500"
                            : "border-gray-300 dark:border-slate-600"
                        }`}
                      />
                      {errors.adminEmail && (
                        <p className="text-xs text-red-600 mt-1">
                          {errors.adminEmail}
                        </p>
                      )}
                    </label>

                    <label className="block">
                      <span className="text-sm text-gray-700 dark:text-slate-200">
                        Admin Password <span className="text-red-500">*</span>
                      </span>

                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={form.adminPassword}
                          onChange={(e) => {
                            setForm({ ...form, adminPassword: e.target.value });
                            setErrors((prev) => ({ ...prev, adminPassword: "" }));
                          }}
                          className={`w-full px-3 py-2 mt-1 border rounded-md pr-10 bg-white text-gray-900 dark:bg-slate-800 dark:text-gray-100 ${
                            errors.adminPassword
                              ? "border-red-500"
                              : "border-gray-300 dark:border-slate-600"
                          }`}
                        />

                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2
                    text-gray-500 hover:text-gray-700
                    dark:text-slate-400 dark:hover:text-slate-200"
                        >
                          {showPassword ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                      </div>
                      {errors.adminPassword && (
                        <p className="text-xs text-red-600 mt-1">
                          {errors.adminPassword}
                        </p>
                      )}
                    </label>

                    <label className="block">
                      <span className="text-sm text-gray-700 dark:text-slate-200">
                        Admin Phone
                      </span>
                      <input
                        type="tel"
                        value={form.adminPhone}
                        onChange={(e) => {
                          setForm({
                            ...form,
                            adminPhone: formatUSPhone(e.target.value),
                          });
                          setErrors((prev) => ({ ...prev, adminPhone: "" }));
                        }}
                        placeholder="(123) 456-7890"
                        className={`w-full px-3 py-2 mt-1 border rounded-md bg-white text-gray-900 dark:bg-slate-800 dark:text-gray-100 ${
                          errors.adminPhone
                            ? "border-red-500"
                            : "border-gray-300 dark:border-slate-600"
                        }`}
                      />
                      {errors.adminPhone && (
                        <p className="text-xs text-red-600 mt-1">
                          {errors.adminPhone}
                        </p>
                      )}
                    </label>
                  </div>
                </div>

                {/* ================= PROFESSIONAL SECTION (OPTIONAL) ================= */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                      Professional Information
                    </h3>
                    <InfoTip text="Optional broker profile details. Can be updated later from the broker dashboard." />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="block md:col-span-2">
                      <span className="text-sm text-gray-700 dark:text-slate-200">
                        Company
                      </span>
                      <input
                        value={form.company}
                        onChange={(e) => {
                          setForm({ ...form, company: e.target.value });
                          setErrors((prev) => ({ ...prev, company: "" }));
                        }}
                        className="w-full px-3 py-2 mt-1 border rounded-md bg-white text-gray-900 border-gray-300 dark:bg-slate-800 dark:text-gray-100 dark:border-slate-600"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm text-gray-700 dark:text-slate-200">
                        License Number
                      </span>
                      <input
                        value={form.licenseNumber}
                        onChange={(e) => {
                          setForm({ ...form, licenseNumber: e.target.value });
                          setErrors((prev) => ({ ...prev, licenseNumber: "" }));
                        }}
                        className={`w-full px-3 py-2 mt-1 border rounded-md bg-white text-gray-900 dark:bg-slate-800 dark:text-gray-100 ${
                          errors.licenseNumber
                            ? "border-red-500"
                            : "border-gray-300 dark:border-slate-600"
                        }`}
                      />
                      {errors.licenseNumber && (
                        <p className="text-xs text-red-600 mt-1">
                          {errors.licenseNumber}
                        </p>
                      )}
                    </label>

                    <label className="block">
                      <span className="text-sm text-gray-700 dark:text-slate-200">
                        Website
                      </span>
                      <input
                        value={form.website}
                        onChange={(e) => {
                          setForm({ ...form, website: e.target.value });
                          setErrors((prev) => ({ ...prev, website: "" }));
                        }}
                        placeholder="example.com"
                        className={`w-full px-3 py-2 mt-1 border rounded-md bg-white text-gray-900 dark:bg-slate-800 dark:text-gray-100 ${
                          errors.website
                            ? "border-red-500"
                            : "border-gray-300 dark:border-slate-600"
                        }`}
                      />
                      {errors.website && (
                        <p className="text-xs text-red-600 mt-1">
                          {errors.website}
                        </p>
                      )}
                    </label>

                    <label className="block md:col-span-2">
                      <span className="text-sm text-gray-700 dark:text-slate-200">
                        Address
                      </span>
                      <input
                        value={form.address}
                        onChange={(e) => {
                          setForm({ ...form, address: e.target.value });
                          setErrors((prev) => ({ ...prev, address: "" }));
                        }}
                        className="w-full px-3 py-2 mt-1 border rounded-md bg-white text-gray-900 border-gray-300 dark:bg-slate-800 dark:text-gray-100 dark:border-slate-600"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm text-gray-700 dark:text-slate-200">
                        City
                      </span>
                      <input
                        value={form.city}
                        onChange={(e) => {
                          setForm({ ...form, city: e.target.value });
                          setErrors((prev) => ({ ...prev, city: "" }));
                        }}
                        className="w-full px-3 py-2 mt-1 border rounded-md bg-white text-gray-900 border-gray-300 dark:bg-slate-800 dark:text-gray-100 dark:border-slate-600"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm text-gray-700 dark:text-slate-200">
                        State
                      </span>
                      <select
                        value={form.state}
                        onChange={(e) => {
                          setForm({ ...form, state: e.target.value });
                          setErrors((prev) => ({ ...prev, state: "" }));
                        }}
                        className="w-full px-3 py-2 mt-1 border rounded-md bg-white text-gray-900 border-gray-300 dark:bg-slate-800 dark:text-gray-100 dark:border-slate-600"
                      >
                        <option value="">Select state</option>
                        {LO_US_STATES.map((state) => (
                          <option key={state.code} value={state.code}>
                            {state.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-sm text-gray-700 dark:text-slate-200">
                        ZIP Code
                      </span>
                      <input
                        value={form.zipCode}
                        onChange={(e) => {
                          setForm({
                            ...form,
                            zipCode: formatLoZip(e.target.value),
                          });
                          setErrors((prev) => ({ ...prev, zipCode: "" }));
                        }}
                        placeholder="12345"
                        className={`w-full px-3 py-2 mt-1 border rounded-md bg-white text-gray-900 dark:bg-slate-800 dark:text-gray-100 ${
                          errors.zipCode
                            ? "border-red-500"
                            : "border-gray-300 dark:border-slate-600"
                        }`}
                      />
                      {errors.zipCode && (
                        <p className="text-xs text-red-600 mt-1">
                          {errors.zipCode}
                        </p>
                      )}
                    </label>
                  </div>
                </div>

                {/* ================= ERRORS ================= */}
                {formError && (
                  <div className="text-sm text-red-600">{formError}</div>
                )}

                {/* ================= ACTIONS ================= */}
                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md
                          dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-[#13538A] hover:bg-[#2e87d4] text-white rounded-md disabled:opacity-70"
                  >
                    {submitting ? "Creating..." : "Create Broker"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Admins Modal */}
        {showAdminsFor && (
          <div className="fixed inset-0 z-600000 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-lg dark:bg-slate-900 dark:border dark:border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Admins for {showAdminsFor.name}
                </h2>
                <button
                  onClick={closeAdmins}
                  className="text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Close
                </button>
              </div>

              <div>
                {loadingAdmins ? (
                  <div className="py-8 text-center text-gray-500 dark:text-slate-400">
                    Loading admins...
                  </div>
                ) : adminsError ? (
                  <div className="py-8 text-center text-red-600 dark:text-red-400">
                    {adminsError}
                  </div>
                ) : admins.length === 0 ? (
                  <div className="py-8 text-center text-gray-500 dark:text-slate-400">
                    No admins found for this broker.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {admins.map((a, idx) => (
                      <div
                        key={a.id ?? idx}
                        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 transition hover:shadow-sm"
                      >
                        {editingAdminId === a.id ? (
                          /* ===== EDIT MODE ===== */
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
                            <input
                              value={adminEditForm.firstName || ""}
                              onChange={(e) =>
                                setAdminEditForm({
                                  ...adminEditForm,
                                  firstName: e.target.value,
                                })
                              }
                              placeholder="First name"
                              className="col-span-1 px-3 py-2 rounded-lg border text-sm
            border-slate-300 dark:border-slate-600
            bg-white dark:bg-slate-900
            text-slate-900 dark:text-white
            focus:ring-2 focus:ring-blue-500/30"
                            />

                            <input
                              value={adminEditForm.lastName || ""}
                              onChange={(e) =>
                                setAdminEditForm({
                                  ...adminEditForm,
                                  lastName: e.target.value,
                                })
                              }
                              placeholder="Last name"
                              className="col-span-1 px-3 py-2 rounded-lg border text-sm
            border-slate-300 dark:border-slate-600
            bg-white dark:bg-slate-900
            text-slate-900 dark:text-white
            focus:ring-2 focus:ring-blue-500/30"
                            />

                            <input
                              value={adminEditForm.email || ""}
                              onChange={(e) =>
                                setAdminEditForm({
                                  ...adminEditForm,
                                  email: e.target.value,
                                })
                              }
                              placeholder="Email"
                              className="col-span-2 px-3 py-2 rounded-lg border text-sm
            border-slate-300 dark:border-slate-600
            bg-white dark:bg-slate-900
            text-slate-900 dark:text-white
            focus:ring-2 focus:ring-blue-500/30"
                            />

                            <input
                              value={adminEditForm.phone || ""}
                              onChange={(e) =>
                                setAdminEditForm({
                                  ...adminEditForm,
                                  phone: e.target.value,
                                })
                              }
                              placeholder="Phone"
                              className="col-span-1 px-3 py-2 rounded-lg border text-sm
            border-slate-300 dark:border-slate-600
            bg-white dark:bg-slate-900
            text-slate-900 dark:text-white
            focus:ring-2 focus:ring-blue-500/30"
                            />

                            <div className="col-span-full flex justify-end gap-2 mt-2">
                              <button
                                onClick={cancelEditAdmin}
                                disabled={adminSaving}
                                className="px-4 py-2 rounded-lg border text-sm font-semibold
              border-slate-300 dark:border-slate-600
              text-slate-700 dark:text-slate-200
              hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                              >
                                Cancel
                              </button>

                              <button
                                onClick={saveAdminEdit}
                                disabled={adminSaving}
                                className="px-4 py-2 rounded-lg bg-[#13538A] hover:bg-[#2e87d4] text-white text-sm font-semibold
              transition disabled:opacity-70"
                              >
                                {adminSaving ? "Saving..." : "Save Changes"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            {/* LEFT SIDE - AVATAR + INFO */}
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              {/* Avatar initials */}
                              <div className="h-12 w-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm uppercase shrink-0">
                                {a.firstName?.[0] || "A"}
                                {a.lastName?.[0] || ""}
                              </div>

                              {/* Name & email */}
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 dark:text-white truncate">
                                  {a.firstName || "—"} {a.lastName || ""}
                                </p>
                                <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                                  {a.email || "No email"}
                                </p>
                              </div>
                            </div>

                            {/* RIGHT SIDE - PHONE + ACTION */}
                            <div className="flex items-center gap-3">
                              <span
                                className="px-3 py-1 rounded-full text-xs font-semibold
        bg-slate-100 dark:bg-slate-800
        text-slate-600 dark:text-slate-300"
                              >
                                {a.phone || "No phone"}
                              </span>

                              <button
                                onClick={() => startEditAdmin(a)}
                                className="px-4 py-2 rounded-lg text-sm font-semibold
          bg-blue-600 text-white
          hover:bg-blue-700 active:scale-95 transition"
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={closeAdmins}
                  className="px-4 py-2 bg-gray-100 rounded-md text-sm
                           dark:bg-slate-800 dark:text-slate-100"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
