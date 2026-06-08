import {
  ArrowUpDown,
  Calendar,
  ChevronDown,
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
  UserCheck,
  Users,
  UserX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import PageMeta from "../../components/common/PageMeta";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

interface SubBrokerUser {
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

type FormState = typeof initialFormState;

const AVATAR_TONES = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
];

function getAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("broker_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

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
      className={`group inline-flex w-full items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 transition hover:text-[#13538A] ${
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

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-[#13538A]/40 focus:bg-white focus:ring-2 focus:ring-[#13538A]/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100";

export default function SubBroker() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [officers, setOfficers] = useState<SubBrokerUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState<"" | "ACTIVE" | "DISABLED">("");
  const [showModal, setShowModal] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialFormState);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editOfficer, setEditOfficer] = useState<SubBrokerUser | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const updateField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }
  };

  const fetchOfficers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/broker/sub-broker/list`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || "Failed to fetch sub brokers");
        return;
      }
      setOfficers(json.data || []);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timer);
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
    fetchOfficers();
  }, [fetchOfficers]);

  useEffect(() => {
    if (!showModal) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeModal();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showModal]);

  const filteredOfficers = useMemo(() => {
    let list = officers;

    if (statusFilter) {
      list = list.filter((o) => o.status === statusFilter);
    }

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter((o) =>
        [o.firstName, o.lastName, o.email, o.phone || ""]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }

    return list;
  }, [officers, debouncedSearch, statusFilter]);

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

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "createdAt" ? "desc" : "asc");
    }
  };

  const stats = useMemo(
    () => ({
      total: officers.length,
      active: officers.filter((o) => o.status === "ACTIVE").length,
      disabled: officers.filter((o) => o.status !== "ACTIVE").length,
    }),
    [officers]
  );

  const toggleStatus = async (id: string, currentStatus: string) => {
    try {
      setTogglingId(id);
      const newStatus = currentStatus === "ACTIVE" ? "DISABLED" : "ACTIVE";

      const res = await fetch(`${API_BASE}/broker/sub-broker/${id}/status`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || "Failed to update status");
        return;
      }

      toast.success(`Sub broker ${newStatus === "ACTIVE" ? "activated" : "disabled"}`);
      fetchOfficers();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setTogglingId(null);
    }
  };

  const fetchSubBrokerDetails = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/broker/sub-broker/${id}`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || "Failed to fetch details");
        return;
      }

      const data = json.data;
      setForm({
        email: data.email || "",
        password: "",
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        phone: data.phone || "",
      });
      setEditOfficer(data);
      setShowModal(true);
    } catch {
      toast.error("Something went wrong");
    }
  };

  const validateForm = (): Record<string, string> => {
    const next: Record<string, string> = {};

    if (!form.firstName.trim()) next.firstName = "First name is required";
    else if (form.firstName.length < 2) next.firstName = "Minimum 2 characters";

    if (!form.lastName.trim()) next.lastName = "Last name is required";

    if (!form.email) next.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Invalid email format";

    if (!editOfficer) {
      if (!form.password) next.password = "Password is required";
      else if (form.password.length < 6) next.password = "Minimum 6 characters";
    }

    const cleanPhone = form.phone.replace(/\D/g, "");
    if (!cleanPhone) next.phone = "Phone is required";
    else if (cleanPhone.length < 10) next.phone = "Enter 10-digit phone number";

    return next;
  };

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
      const res = await fetch(`${API_BASE}/broker/sub-broker/create`, {
        method: "POST",
        headers: getAuthHeaders(),
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
          setErrors((prev) => ({ ...prev, email: "Email already exists" }));
        }
        toast.error(json.message || "Failed to create sub broker");
        return;
      }

      toast.success("Sub broker created successfully");
      closeModal();
      fetchOfficers();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setCreating(false);
    }
  };

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
      const res = await fetch(`${API_BASE}/broker/sub-broker/${editOfficer.id}/update`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          email: form.email,
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone.replace(/\D/g, ""),
          ...(form.password ? { password: form.password } : {}),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || "Failed to update sub broker");
        return;
      }

      toast.success("Sub broker updated successfully");
      closeModal();
      fetchOfficers();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setCreating(false);
    }
  };

  const openCreateModal = () => {
    setErrors({});
    setEditOfficer(null);
    setForm(initialFormState);
    setShowPassword(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditOfficer(null);
    setForm(initialFormState);
    setErrors({});
    setShowPassword(false);
  };

  return (
    <>
      <PageMeta title="Sub Brokers | Broker Dashboard" description="Manage sub brokers" />

      <div className="space-y-6">
        {/* Hero */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#2C92D5] p-6 text-white shadow-sm dark:border-gray-800">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                <Users className="h-3.5 w-3.5" />
                CRM · Team
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">Sub Brokers</h1>
              <p className="mt-1 max-w-2xl text-sm text-white/80">
                Manage sub brokers, control access, and monitor their activity from one place.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Total", value: stats.total, icon: Users },
                { label: "Active", value: stats.active, icon: UserCheck },
                { label: "Disabled", value: stats.disabled, icon: UserX },
              ].map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/20 backdrop-blur-sm"
                >
                  <div className="flex items-center gap-2 text-white/70">
                    <Icon className="h-4 w-4" />
                    <span className="text-xs">{label}</span>
                  </div>
                  <p className="mt-1 text-2xl font-semibold">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                placeholder="Search by name, email, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-10 text-sm outline-none focus:border-[#13538A]/40 focus:ring-2 focus:ring-[#13538A]/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fetchOfficers()}
                disabled={loading}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>

              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#13538A] px-4 text-sm font-medium text-white shadow-sm hover:bg-[#1a6aad]"
              >
                <Plus className="h-4 w-4" />
                Create Sub Broker
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
            <span className="shrink-0 text-xs font-medium text-gray-500">Status:</span>
            {(["", "ACTIVE", "DISABLED"] as const).map((status) => (
              <button
                key={status || "all"}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  statusFilter === status
                    ? "bg-[#13538A] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                }`}
              >
                {status || "All"}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {loading ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-4 px-6 py-4">
                  <div className="h-4 w-6 rounded bg-gray-100 dark:bg-gray-800" />
                  <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-800" />
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
                {search || statusFilter ? "No matching sub brokers" : "No sub brokers yet"}
              </h3>
              <p className="mt-1 max-w-md text-sm text-gray-500">
                {search || statusFilter
                  ? "Try adjusting your search or status filter."
                  : "Create your first sub broker to delegate loan pipeline work."}
              </p>
              {!search && !statusFilter && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#13538A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a6aad]"
                >
                  <Plus className="h-4 w-4" />
                  Create Sub Broker
                </button>
              )}
            </div>
          ) : (
            <div className="max-h-[min(560px,calc(100vh-22rem))] overflow-auto">
              <table className="w-full min-w-[920px] border-collapse text-left">
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
                          {index + 1}
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <span
                              className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold ring-2 ring-white dark:ring-gray-900 ${getAvatarTone(fullName)}`}
                            >
                              {getInitials(o.firstName, o.lastName)}
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
                              <p className="text-xs text-gray-400">Sub Broker</p>
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
                              onClick={() => {
                                setErrors({});
                                fetchSubBrokerDetails(o.id);
                              }}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-[#13538A] transition hover:border-[#13538A]/30 hover:bg-[#13538A]/10 dark:border-gray-700 dark:bg-gray-900"
                              title="Edit sub broker"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={togglingId === o.id}
                              onClick={() => toggleStatus(o.id, o.status)}
                              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition disabled:opacity-50 ${
                                isActive
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                                  : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900"
                              }`}
                              title={isActive ? "Disable sub broker" : "Activate sub broker"}
                            >
                              <Power className="h-4 w-4" />
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
            <div className="flex flex-col gap-2 border-t border-gray-100 px-5 py-3 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
              <span>
                Showing <span className="font-semibold text-gray-800 dark:text-gray-200">{sortedOfficers.length}</span> of{" "}
                <span className="font-semibold text-gray-800 dark:text-gray-200">{officers.length}</span> sub broker(s)
              </span>
              <span className="text-gray-400">
                Sorted by {sortKey.replace("createdAt", "created")} ({sortDir})
              </span>
            </div>
          )}
        </div>
      </div>

      {showModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={closeModal}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="flex max-h-[min(90vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-start justify-between border-b px-6 py-4 dark:border-gray-800">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {editOfficer ? "Edit Sub Broker" : "Create Sub Broker"}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {editOfficer
                      ? "Update contact details for this sub broker."
                      : "Add a new sub broker to your organization."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form
                onSubmit={editOfficer ? handleUpdate : handleCreate}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="space-y-4 overflow-y-auto p-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        First Name
                      </label>
                      <input
                        className={`${inputClass} ${errors.firstName ? "border-red-400" : ""}`}
                        value={form.firstName}
                        onChange={(e) => updateField("firstName", e.target.value)}
                        placeholder="First name"
                      />
                      {errors.firstName && (
                        <p className="mt-1 text-xs text-red-500">{errors.firstName}</p>
                      )}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Last Name
                      </label>
                      <input
                        className={`${inputClass} ${errors.lastName ? "border-red-400" : ""}`}
                        value={form.lastName}
                        onChange={(e) => updateField("lastName", e.target.value)}
                        placeholder="Last name"
                      />
                      {errors.lastName && (
                        <p className="mt-1 text-xs text-red-500">{errors.lastName}</p>
                      )}
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Email
                      </label>
                      <input
                        type="email"
                        className={`${inputClass} ${errors.email ? "border-red-400" : ""}`}
                        value={form.email}
                        onChange={(e) => updateField("email", e.target.value)}
                        placeholder="email@example.com"
                      />
                      {errors.email && (
                        <p className="mt-1 text-xs text-red-500">{errors.email}</p>
                      )}
                    </div>

                    {!editOfficer && (
                      <div className="sm:col-span-2">
                        <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Password
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            className={`${inputClass} pr-11 ${errors.password ? "border-red-400" : ""}`}
                            value={form.password}
                            onChange={(e) => updateField("password", e.target.value)}
                            placeholder="Minimum 6 characters"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#13538A]"
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                        {errors.password && (
                          <p className="mt-1 text-xs text-red-500">{errors.password}</p>
                        )}
                      </div>
                    )}

                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Phone
                      </label>
                      <input
                        className={`${inputClass} ${errors.phone ? "border-red-400" : ""}`}
                        value={formatPhone(form.phone)}
                        onChange={(e) =>
                          updateField("phone", e.target.value.replace(/\D/g, "").slice(0, 10))
                        }
                        placeholder="555-123-4567"
                      />
                      {errors.phone && (
                        <p className="mt-1 text-xs text-red-500">{errors.phone}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 justify-end gap-3 border-t px-6 py-4 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="rounded-xl bg-[#13538A] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1a6aad] disabled:opacity-60"
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
          </div>,
          document.body
        )}
    </>
  );
}
