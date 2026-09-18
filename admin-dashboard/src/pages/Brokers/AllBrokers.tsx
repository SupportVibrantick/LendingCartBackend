import React, { useCallback, useEffect, useState } from "react";
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
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

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
  UserCheck,
  Activity,
  X,
  UserRound,
  BriefcaseBusiness,
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

function fieldClass(hasError?: boolean) {
  return `mt-1.5 w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/15 dark:bg-slate-800 dark:text-gray-100 ${
    hasError
      ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
      : "border-slate-200 dark:border-slate-600"
  }`;
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
  const debouncedQuery = useDebouncedValue(query.trim(), 350);
  const [pageSize, setPageSize] = useState<number>(8);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ all: 0, active: 0 });

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
    setCurrentPage(1);
  }, [debouncedQuery, pageSize]);

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

  const fetchBrokers = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const headers = getAuthHeaders();
        const params = new URLSearchParams({
          page: String(currentPage),
          limit: String(pageSize),
        });
        if (debouncedQuery) params.set("search", debouncedQuery);

        const res = await fetch(
          `${API_BASE}/admin/brokers/read?${params.toString()}`,
          {
            method: "GET",
            headers,
            signal,
          },
        );

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
        setTotal(Number(json?.meta?.total) || normalized.length);
        setTotalPages(
          Math.max(1, Number(json?.meta?.totalPages) || 1),
        );
        setStats({
          all: Number(json?.meta?.totals?.all) || Number(json?.meta?.total) || 0,
          active: Number(json?.meta?.totals?.active) || 0,
        });
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error(err);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [API_BASE, currentPage, debouncedQuery, pageSize],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchBrokers(controller.signal);
    return () => controller.abort();
  }, [fetchBrokers]);

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

  function gotoPage(page: number) {
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function getPageNumbers() {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i += 1) pages.push(i);
      return pages;
    }

    pages.push(1);
    if (currentPage > 3) pages.push("ellipsis");

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i += 1) pages.push(i);

    if (currentPage < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
    return pages;
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

  const totalBrokers = stats.all;
  const activeBrokers = stats.active;
  const inactiveBrokers = Math.max(totalBrokers - activeBrokers, 0);

  const isSearchEmpty =
    debouncedQuery !== "" && brokers.length === 0 && !loading;
  const isTotalEmpty = debouncedQuery === "" && total === 0 && !loading;

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

  const statCards = [
    {
      label: "Total Brokers",
      value: totalBrokers,
      icon: Building2,
      iconWrap: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400",
      hint: "All broker organizations",
    },
    {
      label: "Active Brokers",
      value: activeBrokers,
      icon: Activity,
      iconWrap:
        "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
      hint: "Currently active accounts",
    },
    {
      label: "Inactive Brokers",
      value: inactiveBrokers,
      icon: UserCheck,
      iconWrap:
        "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
      hint: "Paused or inactive accounts",
    },
  ] as const;

  return (
    <div className="w-full pb-6 transition-colors duration-300">
      <div className="w-full">
        {/* Header */}
        <div className="mb-4 overflow-hidden rounded-xl border border-[#13538A]/20 bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#5D28A8] p-4 text-white sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                Broker Database
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  All Brokers
                </h1>
                <button
                  type="button"
                  onClick={() => fetchBrokers()}
                  disabled={loading}
                  title="Refresh list"
                  className="group inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/25 bg-white/10 text-white transition hover:bg-white/20 active:scale-95 disabled:opacity-50"
                >
                  <RefreshCcw
                    size={16}
                    className={
                      loading
                        ? "animate-spin"
                        : "transition-transform duration-500 group-hover:rotate-180"
                    }
                  />
                </button>
              </div>
              <p className="mt-1.5 max-w-xl text-sm leading-6 text-white/80">
                Manage broker organizations, admins, and lender assignments from
                one place.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={openAdd}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-xs font-semibold text-[#13538A] transition hover:bg-white/90 active:scale-95"
              >
                <TiPlus className="h-3.5 w-3.5" />
                Add Broker
              </button>
              <button
                type="button"
                onClick={() => navigate("/all-brokers-lenders")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-white/20 active:scale-95"
              >
                <UserCheck className="h-3.5 w-3.5" />
                Assigned Lenders
              </button>
            </div>
          </div>
        </div>

        {/* Stats — neutral cards, colored icons only */}
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {statCards.map(({ label, value, icon: Icon, iconWrap, hint }) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3.5 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
            >
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  {label}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
                  {value}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">{hint}</p>
              </div>
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconWrap}`}
              >
                <Icon className="h-5 w-5" />
              </div>
            </div>
          ))}
        </div>

        {/* Per page (left) + Search (right) */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Per page
            </span>
            <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
              {[4, 8, 12, 16, 20].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setPageSize(size)}
                  className={`min-w-9 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                    pageSize === size
                      ? "bg-[#13538A] text-white"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div className="relative w-full max-w-[280px] self-end sm:self-auto">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search brokers..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Clear search"
                title="Clear search"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
        </div>

        {/* ================= CONTENT GRID ================= */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="h-52 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white animate-pulse dark:border-slate-800 dark:bg-slate-900"
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
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-16 text-center dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#13538A]/10 text-[#13538A]">
              <Building2 size={26} />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              No brokers yet
            </h3>
            <p className="mt-1.5 max-w-sm text-sm text-slate-500 dark:text-slate-400">
              Get started by adding the first broker organization to the
              platform.
            </p>
            <button
              type="button"
              onClick={openAdd}
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-[#13538A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#10446f]"
            >
              <TiPlus className="h-3.5 w-3.5" />
              Add Broker
            </button>
          </div>
        ) : isSearchEmpty ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-16 text-center dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <SearchX size={26} />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              No results found
            </h3>
            <p className="mt-1.5 max-w-md text-sm text-slate-500 dark:text-slate-400">
              We couldn’t find any broker matching{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                “{query}”
              </span>
              . Try a different name, email, or phone.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setQuery("")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <X size={14} />
                Clear search
              </button>
              <button
                type="button"
                onClick={openAdd}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#13538A] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#10446f]"
              >
                <TiPlus className="h-3.5 w-3.5" />
                Add Broker
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {brokers.map((l) => (
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
                className="group flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-colors duration-200 hover:border-[#13538A]/35 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/40 cursor-pointer"
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
        {!loading && total > 0 && (
          <div className="mt-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Showing{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {Math.min((currentPage - 1) * pageSize + 1, total)}–
                {Math.min(currentPage * pageSize, total)}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {total}
              </span>{" "}
              broker{total === 1 ? "" : "s"}
            </p>

            {totalPages > 1 ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => gotoPage(currentPage - 1)}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <ChevronLeft size={16} />
                  Prev
                </button>

                <div className="flex items-center gap-1">
                  {getPageNumbers().map((page, index) =>
                    page === "ellipsis" ? (
                      <span
                        key={`e-${index}`}
                        className="px-1.5 text-sm text-slate-400"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={page}
                        type="button"
                        onClick={() => gotoPage(page)}
                        className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2.5 text-xs font-semibold transition ${
                          page === currentPage
                            ? "bg-[#13538A] text-white shadow-sm"
                            : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                        }`}
                      >
                        {page}
                      </button>
                    ),
                  )}
                </div>

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => gotoPage(currentPage + 1)}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            ) : null}
          </div>
        )}

        {/* Add Broker Modal */}
        {isAddOpen && (
          <div className="fixed inset-0 z-[500000] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
            <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
              {/* Sticky header */}
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:px-6">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#13538A]">
                    Broker Database
                  </p>
                  <h2 className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-white">
                    Create Broker
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                    Add a new broker organization and its primary admin.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <form
                onSubmit={handleSubmit}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
                  {/* Organization */}
                  <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/40">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400">
                        <Building2 size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                            Organization Details
                          </h3>
                          <InfoTip text="Basic information about the Broker organization." />
                        </div>
                        <p className="text-xs text-slate-500">
                          Required company contact info
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <label className="block">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Organization Name{" "}
                          <span className="text-red-500">*</span>
                        </span>
                        <input
                          value={form.organizationName}
                          onChange={(e) => {
                            setForm({
                              ...form,
                              organizationName: e.target.value,
                            });
                            setErrors((prev) => ({
                              ...prev,
                              organizationName: "",
                            }));
                          }}
                          className={fieldClass(Boolean(errors.organizationName))}
                        />
                        {errors.organizationName && (
                          <p className="mt-1 text-xs text-red-600">
                            {errors.organizationName}
                          </p>
                        )}
                      </label>

                      <label className="block">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
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
                            setErrors((prev) => ({
                              ...prev,
                              organizationEmail: "",
                            }));
                          }}
                          className={fieldClass(Boolean(errors.organizationEmail))}
                        />
                        {errors.organizationEmail && (
                          <p className="mt-1 text-xs text-red-600">
                            {errors.organizationEmail}
                          </p>
                        )}
                      </label>

                      <label className="block md:col-span-2">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
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
                            setErrors((prev) => ({
                              ...prev,
                              organizationPhone: "",
                            }));
                          }}
                          placeholder="(123) 456-7890"
                          className={fieldClass(Boolean(errors.organizationPhone))}
                        />
                        {errors.organizationPhone && (
                          <p className="mt-1 text-xs text-red-600">
                            {errors.organizationPhone}
                          </p>
                        )}
                      </label>
                    </div>
                  </section>

                  {/* Admin */}
                  <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/40">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400">
                        <UserRound size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                            Admin Details
                          </h3>
                          <InfoTip text="Admin user who will manage this broker organization." />
                        </div>
                        <p className="text-xs text-slate-500">
                          Primary login for the broker portal
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <label className="block">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Admin First Name{" "}
                          <span className="text-red-500">*</span>
                        </span>
                        <input
                          value={form.adminFirstName}
                          onChange={(e) => {
                            setForm({ ...form, adminFirstName: e.target.value });
                            setErrors((prev) => ({
                              ...prev,
                              adminFirstName: "",
                            }));
                          }}
                          className={fieldClass(Boolean(errors.adminFirstName))}
                        />
                        {errors.adminFirstName && (
                          <p className="mt-1 text-xs text-red-600">
                            {errors.adminFirstName}
                          </p>
                        )}
                      </label>

                      <label className="block">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Admin Last Name{" "}
                          <span className="text-red-500">*</span>
                        </span>
                        <input
                          value={form.adminLastName}
                          onChange={(e) => {
                            setForm({ ...form, adminLastName: e.target.value });
                            setErrors((prev) => ({
                              ...prev,
                              adminLastName: "",
                            }));
                          }}
                          className={fieldClass(Boolean(errors.adminLastName))}
                        />
                        {errors.adminLastName && (
                          <p className="mt-1 text-xs text-red-600">
                            {errors.adminLastName}
                          </p>
                        )}
                      </label>

                      <label className="block">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Admin Email <span className="text-red-500">*</span>
                        </span>
                        <input
                          type="email"
                          value={form.adminEmail}
                          onChange={(e) => {
                            setForm({ ...form, adminEmail: e.target.value });
                            setErrors((prev) => ({ ...prev, adminEmail: "" }));
                          }}
                          className={fieldClass(Boolean(errors.adminEmail))}
                        />
                        {errors.adminEmail && (
                          <p className="mt-1 text-xs text-red-600">
                            {errors.adminEmail}
                          </p>
                        )}
                      </label>

                      <label className="block">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Admin Password <span className="text-red-500">*</span>
                        </span>
                        <div className="relative mt-1.5">
                          <input
                            type={showPassword ? "text" : "password"}
                            value={form.adminPassword}
                            onChange={(e) => {
                              setForm({
                                ...form,
                                adminPassword: e.target.value,
                              });
                              setErrors((prev) => ({
                                ...prev,
                                adminPassword: "",
                              }));
                            }}
                            className={`${fieldClass(Boolean(errors.adminPassword)).replace("mt-1.5 ", "")} pr-10`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
                            aria-label={
                              showPassword ? "Hide password" : "Show password"
                            }
                          >
                            {showPassword ? (
                              <EyeOff size={16} />
                            ) : (
                              <Eye size={16} />
                            )}
                          </button>
                        </div>
                        {errors.adminPassword && (
                          <p className="mt-1 text-xs text-red-600">
                            {errors.adminPassword}
                          </p>
                        )}
                      </label>

                      <label className="block md:col-span-2">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
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
                          className={fieldClass(Boolean(errors.adminPhone))}
                        />
                        {errors.adminPhone && (
                          <p className="mt-1 text-xs text-red-600">
                            {errors.adminPhone}
                          </p>
                        )}
                      </label>
                    </div>
                  </section>

                  {/* Professional */}
                  <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/40">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                        <BriefcaseBusiness size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                            Professional Information
                          </h3>
                          <InfoTip text="Optional broker profile details. Can be updated later from the broker dashboard." />
                        </div>
                        <p className="text-xs text-slate-500">
                          Optional — can be completed later
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <label className="block md:col-span-2">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Company
                        </span>
                        <input
                          value={form.company}
                          onChange={(e) => {
                            setForm({ ...form, company: e.target.value });
                            setErrors((prev) => ({ ...prev, company: "" }));
                          }}
                          className={fieldClass()}
                        />
                      </label>

                      <label className="block">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          License Number
                        </span>
                        <input
                          value={form.licenseNumber}
                          onChange={(e) => {
                            setForm({ ...form, licenseNumber: e.target.value });
                            setErrors((prev) => ({
                              ...prev,
                              licenseNumber: "",
                            }));
                          }}
                          className={fieldClass(Boolean(errors.licenseNumber))}
                        />
                        {errors.licenseNumber && (
                          <p className="mt-1 text-xs text-red-600">
                            {errors.licenseNumber}
                          </p>
                        )}
                      </label>

                      <label className="block">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Website
                        </span>
                        <input
                          value={form.website}
                          onChange={(e) => {
                            setForm({ ...form, website: e.target.value });
                            setErrors((prev) => ({ ...prev, website: "" }));
                          }}
                          placeholder="example.com"
                          className={fieldClass(Boolean(errors.website))}
                        />
                        {errors.website && (
                          <p className="mt-1 text-xs text-red-600">
                            {errors.website}
                          </p>
                        )}
                      </label>

                      <label className="block md:col-span-2">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Address
                        </span>
                        <input
                          value={form.address}
                          onChange={(e) => {
                            setForm({ ...form, address: e.target.value });
                            setErrors((prev) => ({ ...prev, address: "" }));
                          }}
                          className={fieldClass()}
                        />
                      </label>

                      <label className="block">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          City
                        </span>
                        <input
                          value={form.city}
                          onChange={(e) => {
                            setForm({ ...form, city: e.target.value });
                            setErrors((prev) => ({ ...prev, city: "" }));
                          }}
                          className={fieldClass()}
                        />
                      </label>

                      <label className="block">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          State
                        </span>
                        <select
                          value={form.state}
                          onChange={(e) => {
                            setForm({ ...form, state: e.target.value });
                            setErrors((prev) => ({ ...prev, state: "" }));
                          }}
                          className={fieldClass()}
                        >
                          <option value="">Select state</option>
                          {LO_US_STATES.map((state) => (
                            <option key={state.code} value={state.code}>
                              {state.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block md:col-span-2">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
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
                          className={fieldClass(Boolean(errors.zipCode))}
                        />
                        {errors.zipCode && (
                          <p className="mt-1 text-xs text-red-600">
                            {errors.zipCode}
                          </p>
                        )}
                      </label>
                    </div>
                  </section>

                  {formError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                      {formError}
                    </div>
                  )}
                </div>

                {/* Sticky footer */}
                <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
                  <button
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#13538A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#10446f] disabled:opacity-60"
                  >
                    <TiPlus className="h-3.5 w-3.5" />
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
