import React, { useEffect, useMemo, useState } from "react";
import { MdModeEdit } from "react-icons/md";
import { TiPlus } from "react-icons/ti";
import EditBrokerModal from "./EditBrokerModal"; // adjust path if needed
import Swal from "sweetalert2";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  // UserPlus,
  Users,
  UserCheck,
  Activity,
  // Filter,
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

export default function BrokersPage() {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(false);
  const [rowLoadingId, setRowLoadingId] = useState<string | null>(null);
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
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editingBroker, setEditingBroker] = useState<Broker | null>(null);

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
    });
    setFormError(null);
    setIsAddOpen(true);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setFormError(null);

    if (
      !form.organizationName.trim() ||
      !form.organizationEmail.trim() ||
      !form.adminEmail.trim() ||
      !form.adminPassword.trim()
    ) {
      setFormError(
        "Please fill required fields: organization name, organization email, admin email and password.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        organizationName: form.organizationName,
        organizationEmail: form.organizationEmail,
        organizationPhone: form.organizationPhone,
        adminFirstName: form.adminFirstName,
        adminLastName: form.adminLastName,
        adminEmail: form.adminEmail,
        adminPassword: form.adminPassword,
      };

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

const openEditModal = async (b: Broker) => {
  try {
    const token = sessionStorage.getItem("admin_token");

    const res = await fetch(
      `${API_BASE}/admin/brokers/read/${b.id}`,
      {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }
    );

    const json = await res.json();

    const brokerData = json?.data;

 const admin = brokerData?.admins?.[0];

setEditingBroker({
  id: brokerData.id,
  name: brokerData.name || "",
  email: brokerData.email || "",
  phone: brokerData.phone || "",
  status: brokerData.status,

  adminId: admin?.id,
  adminFirstName: admin?.firstName || "",
  adminLastName: admin?.lastName || "",
  adminEmail: admin?.email || "",
  adminStatus: admin?.status || "",

  createdAt: brokerData.createdAt,
});
  } catch (err) {
    console.error(err);
  }
};

  const handleEditSave = async (updated: Broker) => {
    // optimistic
    setBrokers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setEditingBroker(null);

    try {
      const token = sessionStorage.getItem("admin_token");
      const res = await fetch(
        `${API_BASE}/admin/brokers/update/${updated.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        body: JSON.stringify({
  name: updated.name,
  email: updated.email,
  phone: updated.phone,
    status: updated.status,

admin: {
  id: updated.adminId,
  firstName: updated.adminFirstName,
  lastName: updated.adminLastName,
  email: updated.adminEmail,
  password:
    updated.adminPassword?.trim() || undefined,
  status: updated.adminStatus,
},
})
        },
      );

      const json = await res.json().catch(() => ({}) as any);

      if (res.ok && json?.data?.organization) {
        const org = json.data.organization;
        setBrokers((prev) =>
          prev.map((b) =>
            b.id === updated.id
              ? {
                  ...b,
                  name: org.name ?? b.name,
                  email: org.email ?? b.email,
                  phone: org.phone ?? b.phone,
                  status: org.status ?? b.status,
                  createdAt: org.createdAt ?? b.createdAt,
                }
              : b,
          ),
        );
      } else if (!res.ok) {
        console.error("Broker update error:", json);
      }
    } catch (err) {
      console.error("Failed to persist broker update:", err);
    }
  };

  const changeStatusFor = async (broker: Broker) => {
    if (!broker?.id) return;

    const cur = (broker.status || "INACTIVE").toUpperCase();
    const next = cur === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    const result = await Swal.fire({
      title: "Change Status?",
      text: `Do you want to mark this Broker as ${next}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#2563eb",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, change it",
    });
    if (!result.isConfirmed) return;

    const prevStatus = broker.status;

    // optimistic update in UI
    setBrokers((prev) =>
      prev.map((b) => (b.id === broker.id ? { ...b, status: next } : b)),
    );
    setRowLoadingId(broker.id);

    const token = sessionStorage.getItem("admin_token");
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    try {
      const toActive = next === "ACTIVE";
      const statusUrl = `${API_BASE}/admin/brokers/status/${
        toActive ? "activate" : "deactivate"
      }/${broker.id}`;

      let res = await fetch(statusUrl, {
        method: "PATCH",
        headers,
        body: JSON.stringify({}),
      });

      if (res.status === 404 || res.status === 405) {
        const updateUrl = `${API_BASE}/admin/brokers/update/${broker.id}`;
        res = await fetch(updateUrl, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ status: next }),
        });
      }

      if (!res.ok) {
        throw new Error(`Status update failed: ${res.status}`);
      }

      Swal.fire({
        icon: "success",
        title: "Updated!",
        text: `Broker is now ${next}`,
        timer: 1300,
        showConfirmButton: false,
      });

      const json = await res.json().catch(() => ({}) as any);

      if (json?.data) {
        if (json.data.status) {
          const serverStatus = json.data.status;
          setBrokers((prev) =>
            prev.map((b) =>
              b.id === broker.id ? { ...b, status: serverStatus } : b,
            ),
          );
        } else if (json.data.organization?.status) {
          const orgStatus = json.data.organization.status;
          setBrokers((prev) =>
            prev.map((b) =>
              b.id === broker.id ? { ...b, status: orgStatus } : b,
            ),
          );
        }
      }
    } catch (err: any) {
      console.error("changeStatusFor error:", err);
      setBrokers((prev) =>
        prev.map((b) =>
          b.id === broker.id ? { ...b, status: prevStatus } : b,
        ),
      );
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err?.message || "Failed to update status. Try again.",
      });
    } finally {
      setRowLoadingId(null);
    }
  };

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

  const openAdminsFor = async (broker: Broker) => {
    setShowAdminsFor(broker);
    setEditingAdminId(null);
    setAdminEditForm({});
    await fetchAdmins(broker.id);
  };

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-72 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse overflow-hidden"
              >
                <div className="h-2/3 bg-slate-100 dark:bg-slate-800/50"></div>
                <div className="p-6 space-y-3">
                  <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-700 rounded"></div>
                  <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded"></div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {paginated.map((l) => (
              <div
                key={l.id}
                className="group relative bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 transition-all duration-300 hover:shadow-md"
              >
                {/* STATUS */}
                <div className="absolute top-4 right-4">
                  <button
                    onClick={() => !rowLoadingId && changeStatusFor(l)}
                    disabled={!!rowLoadingId}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${statusClass(
                      l.status,
                    )}`}
                  >
                    {l.status === "ACTIVE" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    )}
                    {l.status}
                  </button>
                </div>

                <div className="flex gap-4">
                  {/* Image */}
                  <div className="relative flex-shrink-0">
                    <div className="h-14 w-14 rounded-xl overflow-hidden bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center border border-emerald-100 dark:border-emerald-500/20">
                      {l.profileImage ? (
                        <img
                          src={`${API_BASE}/public${l.profileImage}`}
                          className="h-full w-full object-cover"
                          onError={(e: any) =>
                            (e.currentTarget.src = "/circle_logo.png")
                          }
                          alt={l.name}
                        />
                      ) : (
                        <Building2
                          size={24}
                          className="text-emerald-600 dark:text-emerald-400"
                        />
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 pr-16">
                    <h3
                      className="text-base font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 transition-colors cursor-pointer"
                      onClick={() => openAdminsFor(l)}
                    >
                      {l.name}
                    </h3>
                    {/* <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      {l.brokerName
                        ? `Broker: ${l.brokerName}`
                        : "No Broker Assigned"}
                    </p> */}

                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Mail size={14} className="flex-shrink-0" />
                        <span className="text-[12px] truncate">{l.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500">
                        <span className="text-[12px] truncate">{l.phone}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/50 flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    Created:{" "}
                    {l.createdAt
                      ? new Date(l.createdAt).toLocaleDateString()
                      : "-"}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      disabled={!!rowLoadingId}
                      onClick={() => openEditModal(l)}
                      className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                      title="Edit Lender"
                    >
                      <MdModeEdit size={16} />
                    </button>
                    {/* <button
                      disabled={!!rowLoadingId}
                      onClick={() => han(l)}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                      title="Delete Lender"
                    >
                      {rowLoadingId === l.id ? (
                        <RefreshCcw size={16} className="animate-spin" />
                      ) : (
                        <MdDelete size={16} />
                      )}
                    </button> */}
                  </div>
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
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-lg dark:bg-slate-900 dark:border dark:border-slate-700">
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
                        Organization Name <span className="text-red-500">*</span>
                      </span>
                      <input
                        value={form.organizationName}
                        onChange={(e) =>
                          setForm({ ...form, organizationName: e.target.value })
                        }
                        className="w-full px-3 py-2 mt-1 border rounded-md
                              border-gray-300 bg-white text-gray-900
                              dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm text-gray-700 dark:text-slate-200">
                        Organization Email <span className="text-red-500">*</span>
                      </span>
                      <input
                        value={form.organizationEmail}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            organizationEmail: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 mt-1 border rounded-md
                              border-gray-300 bg-white text-gray-900
                              dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                      />
                    </label>

                    <label className="block md:col-span-1">
                      <span className="text-sm text-gray-700 dark:text-slate-200">
                        Organization Phone <span className="text-red-500">*</span>
                      </span>
                      <input
                        value={form.organizationPhone}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            organizationPhone: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 mt-1 border rounded-md
                              border-gray-300 bg-white text-gray-900
                              dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                      />
                    </label>
                  </div>
                </div>

                {/* ================= ADMIN SECTION ================= */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                      Admin Details
                    </h3>
                    <InfoTip text="Admin user who will manage their lender." />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* First + Last Name parallel */}
                    <label className="block">
                      <span className="text-sm text-gray-700 dark:text-slate-200">
                        Admin First Name <span className="text-red-500">*</span>
                      </span>
                      <input
                        value={form.adminFirstName}
                        onChange={(e) =>
                          setForm({ ...form, adminFirstName: e.target.value })
                        }
                        className="w-full px-3 py-2 mt-1 border rounded-md
                              border-gray-300 bg-white text-gray-900
                              dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm text-gray-700 dark:text-slate-200">
                        Admin Last Name <span className="text-red-500">*</span>
                      </span>
                      <input
                        value={form.adminLastName}
                        onChange={(e) =>
                          setForm({ ...form, adminLastName: e.target.value })
                        }
                        className="w-full px-3 py-2 mt-1 border rounded-md
                              border-gray-300 bg-white text-gray-900
                              dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                      />
                    </label>

                    {/* Email + Password parallel */}
                    <label className="block">
                      <span className="text-sm text-gray-700 dark:text-slate-200">
                        Admin Email <span className="text-red-500">*</span>
                      </span>
                      <input
                        value={form.adminEmail}
                        onChange={(e) =>
                          setForm({ ...form, adminEmail: e.target.value })
                        }
                        className="w-full px-3 py-2 mt-1 border rounded-md
                              border-gray-300 bg-white text-gray-900
                              dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm text-gray-700 dark:text-slate-200">
                        Admin Password <span className="text-red-500">*</span>
                      </span>

                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={form.adminPassword}
                          onChange={(e) =>
                            setForm({ ...form, adminPassword: e.target.value })
                          }
                          className="w-full px-3 py-2 mt-1 border rounded-md pr-10
                    border-gray-300 bg-white text-gray-900
                    dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
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

        {/* Edit Broker Modal */}
        {editingBroker && (
          <EditBrokerModal
            isOpen={Boolean(editingBroker)}
            broker={editingBroker}
            onClose={() => setEditingBroker(null)}
            onSave={handleEditSave}
          />
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
