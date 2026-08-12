import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { MdDelete } from "react-icons/md";
import { TiPlus } from "react-icons/ti";
import Swal from "sweetalert2";
import {
  Users,
  UserCheck,
  Activity,
  Search,
  RefreshCw,
  X,
  Filter,
  MoreVertical,
  RefreshCcw,
  Eye,
  Pencil,
} from "lucide-react";
import toast from "react-hot-toast";
import PageMeta from "../../components/common/PageMeta";

type GhlSyncStatus = "PENDING" | "SYNCED" | "FAILED" | "SKIPPED";
type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "NOT_INTERESTED"
  | "CONVERTED";
type SourceFilter =
  | ""
  | "commerciallendingmastery"
  | "clmlandingpage"
  | "loan-ai-book-demo"
  | "Admin";

type Lead = {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  company?: string;
  message?: string;
  interestedPlanCode?: string | null;
  interestedPlanName?: string | null;
  status: LeadStatus;
  source: string;
  ghlSyncStatus?: GhlSyncStatus | null;
  ghlContactId?: string | null;
  ghlSyncedAt?: string | null;
  ghlLastError?: string | null;
  createdAt?: string;
  leadType: string;
};

const STATUS_OPTIONS: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "NOT_INTERESTED",
  "CONVERTED",
];

const GHL_OPTIONS: GhlSyncStatus[] = [
  "PENDING",
  "SYNCED",
  "FAILED",
  "SKIPPED",
];

const PAGE_SIZE = 10;

/** Format as 999-999-9999 while typing (max 10 digits). */
function formatPhoneInput(value: string) {
  const digits = String(value || "")
    .replace(/\D/g, "")
    .slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function formatSourceLabel(source: string) {
  switch (source) {
    case "loan-ai-book-demo":
      return "Loan AI Book Demo";
    case "commerciallendingmastery":
      return "Commercial Lending Mastery";
    case "clmlandingpage":
      return "CLM Landing Page";
    case "Admin":
      return "Admin";
    default:
      return source;
  }
}

function statusClass(status: LeadStatus) {
  switch (status) {
    case "NEW":
      return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30";
    case "CONTACTED":
      return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30";
    case "QUALIFIED":
      return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30";
    case "CONVERTED":
      return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/30";
    case "NOT_INTERESTED":
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:border-slate-500/30";
  }
}

function ghlStatusClass(status?: GhlSyncStatus | null) {
  switch (status) {
    case "SYNCED":
      return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30";
    case "PENDING":
      return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30";
    case "FAILED":
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30";
    case "SKIPPED":
      return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:border-slate-500/30";
    default:
      return "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/30";
  }
}

function getAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("admin_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-[160px] flex-1 flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-9 text-sm text-slate-900 transition focus:border-[#13538A] focus:outline-none focus:ring-2 focus:ring-[#13538A]/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        >
          {children}
        </select>
        <svg
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
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
    </label>
  );
}

export default function AllLeads() {
  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

  const [source, setSource] = useState<SourceFilter>("");
  const [statusFilter, setStatusFilter] = useState<"" | LeadStatus>("");
  const [ghlFilter, setGhlFilter] = useState<"" | GhlSyncStatus>("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [rowLoadingId, setRowLoadingId] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"view" | "edit">("view");
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    message: "",
    interestedPlanCode: "",
    interestedPlanName: "",
    status: "NEW" as LeadStatus,
    syncGhl: false,
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    source: "Admin",
    status: "NEW" as LeadStatus,
    campaign: "",
    company: "",
    message: "",
    interestedPlanCode: "",
    interestedPlanName: "",
    syncGhl: true,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const MENU_WIDTH = 188;

  const [stats, setStats] = useState({
    totalLeads: 0,
    convertedLeads: 0,
    newLeads: 0,
  });

  const hasActiveFilters = Boolean(
    source || statusFilter || ghlFilter || debouncedQuery,
  );

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!openMenuId) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest?.("[data-lead-menu-trigger]")) return;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setOpenMenuId(null);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenuId(null);
    };

    const onRepositionClose = () => setOpenMenuId(null);

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onRepositionClose);
    window.addEventListener("scroll", onRepositionClose, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onRepositionClose);
      window.removeEventListener("scroll", onRepositionClose, true);
    };
  }, [openMenuId]);

  function openRowMenu(leadId: string, anchor: HTMLElement) {
    const rect = anchor.getBoundingClientRect();
    const estimatedHeight = 96;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < estimatedHeight + 8;

    const top = openUp
      ? Math.max(8, rect.top - estimatedHeight - 4)
      : rect.bottom + 4;
    const left = Math.min(
      Math.max(8, rect.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - 8,
    );

    setMenuPos({ top, left });
    setOpenMenuId((prev) => (prev === leadId ? null : leadId));
  }

  async function fetchLeads(page = 1) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(PAGE_SIZE));
      if (source) params.set("source", source);
      if (statusFilter) params.set("status", statusFilter);
      if (ghlFilter) params.set("ghlSyncStatus", ghlFilter);
      if (debouncedQuery) params.set("q", debouncedQuery);

      const res = await fetch(
        `${API_BASE}/admin/landing-page-leads/leads?${params.toString()}`,
        { headers: getAuthHeaders() },
      );
      if (!res.ok) throw new Error("Failed to load leads");

      const json = await res.json();
      setLeads(json.data || []);
      setCurrentPage(json.meta?.page || page);
      setTotal(json.meta?.total || 0);
    } catch (err) {
      console.error("Leads error:", err);
      toast.error("Failed to load leads");
    } finally {
      setLoading(false);
    }
  }

  async function fetchStats() {
    try {
      const res = await fetch(`${API_BASE}/admin/landing-page-leads/stats`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to load stats");
      const json = await res.json();
      const d = json.data;
      setStats({
        totalLeads: d.totalLeads || 0,
        newLeads: d.newLeads || 0,
        convertedLeads: d.convertedLeads || 0,
      });
    } catch (err) {
      console.error("Stats error:", err);
    }
  }

  useEffect(() => {
    setCurrentPage(1);
    fetchLeads(1);
  }, [source, statusFilter, ghlFilter, debouncedQuery]);

  useEffect(() => {
    fetchStats();
  }, []);

  const clearFilters = () => {
    setSource("");
    setStatusFilter("");
    setGhlFilter("");
    setQuery("");
    setDebouncedQuery("");
  };

  async function changeStatus(
    id: string,
    status: LeadStatus,
    leadType: string,
  ) {
    setRowLoadingId(id);
    try {
      const res = await fetch(
        `${API_BASE}/admin/landing-page-leads/leads/status`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({ id, status, leadType }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.message || "Failed to update status");
        return;
      }
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
      fetchStats();
    } catch {
      toast.error("Failed to update status");
    } finally {
      setRowLoadingId(null);
    }
  }

  async function retryGhlSync(id: string, leadType?: string) {
    setRowLoadingId(id);
    try {
      const type =
        leadType ||
        leads.find((l) => l.id === id)?.leadType ||
        editingLead?.leadType ||
        "LOAN_AI_BOOK_DEMO";

      const url =
        type === "ADMIN_MANUAL"
          ? `${API_BASE}/admin/landing-page-leads/crm/manual-leads/${id}/sync-ghl`
          : `${API_BASE}/admin/landing-page-leads/loan-ai-book-demo/${id}/sync-ghl`;

      const res = await fetch(url, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.message || "GHL sync failed");
        return;
      }
      const data = json?.data;
      setLeads((prev) =>
        prev.map((l) =>
          l.id === id
            ? {
                ...l,
                ghlSyncStatus: data?.ghlSyncStatus ?? l.ghlSyncStatus,
                ghlContactId: data?.ghlContactId ?? l.ghlContactId,
                ghlSyncedAt: data?.ghlSyncedAt ?? l.ghlSyncedAt,
                ghlLastError: data?.ghlLastError ?? null,
              }
            : l,
        ),
      );
      setEditingLead((prev) =>
        prev?.id === id
          ? {
              ...prev,
              ghlSyncStatus: data?.ghlSyncStatus ?? prev.ghlSyncStatus,
              ghlContactId: data?.ghlContactId ?? prev.ghlContactId,
              ghlSyncedAt: data?.ghlSyncedAt ?? prev.ghlSyncedAt,
              ghlLastError: data?.ghlLastError ?? null,
            }
          : prev,
      );
      if (data?.ghlSyncStatus === "SYNCED") toast.success("Synced to GHL");
      else if (data?.ghlSyncStatus === "SKIPPED")
        toast.success(json?.message || "GHL sync skipped");
      else toast.error(data?.ghlLastError || json?.message || "GHL sync failed");
    } catch {
      toast.error("Failed to sync lead to GHL");
    } finally {
      setRowLoadingId(null);
    }
  }

  async function deleteLead(id: string, leadType: string) {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to recover this contact!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete it!",
    });
    if (!result.isConfirmed) return;

    setRowLoadingId(id);

    try {
      const res = await fetch(
        `${API_BASE}/admin/landing-page-leads/leads/${id}?leadType=${encodeURIComponent(leadType)}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
          body: JSON.stringify({ leadType }),
        },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.message || "Delete failed");
      }

      setLeads((prev) => prev.filter((l) => l.id !== id));
      setTotal((t) => Math.max(0, t - 1));
      if (editingLead?.id === id) {
        setEditorOpen(false);
        setEditingLead(null);
      }
      fetchStats();
      Swal.fire({
        title: "Deleted!",
        text: "Contact has been deleted successfully.",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err: any) {
      Swal.fire({
        title: "Error!",
        text: err?.message || "Failed to delete contact.",
        icon: "error",
      });
    } finally {
      setRowLoadingId(null);
    }
  }

  function openEditor(lead: Lead, mode: "view" | "edit") {
    setEditingLead(lead);
    setEditorMode(mode);
    setEditError(null);
    setEditForm({
      firstName: lead.firstName || "",
      lastName: lead.lastName || "",
      email: lead.email || "",
      phone: formatPhoneInput(lead.phone || ""),
      company: lead.company || "",
      message: lead.message || "",
      interestedPlanCode: lead.interestedPlanCode || "",
      interestedPlanName: lead.interestedPlanName || "",
      status: lead.status,
      syncGhl: false,
    });
    setEditorOpen(true);
  }

  async function saveEdit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!editingLead) return;
    setEditError(null);

    if (!editForm.email.trim()) {
      setEditError("Email is required.");
      return;
    }

    setEditSaving(true);
    try {
      const payload: Record<string, unknown> = {
        leadType: editingLead.leadType,
        firstName: editForm.firstName.trim() || null,
        lastName: editForm.lastName.trim() || null,
        email: editForm.email.trim(),
        phone: editForm.phone.trim() || null,
        status: editForm.status,
      };

      if (editingLead.leadType === "LOAN_AI_BOOK_DEMO") {
        payload.company = editForm.company.trim() || null;
        payload.message = editForm.message.trim() || null;
        payload.interestedPlanCode = editForm.interestedPlanCode.trim() || null;
        payload.interestedPlanName = editForm.interestedPlanName.trim() || null;
        payload.syncGhl = editForm.syncGhl;
      } else if (editingLead.leadType === "ADMIN_MANUAL") {
        payload.syncGhl = editForm.syncGhl;
      }

      const res = await fetch(
        `${API_BASE}/admin/landing-page-leads/leads/${editingLead.id}`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEditError(json?.message || "Failed to update contact");
        return;
      }

      const updated = json.data as Lead;
      setLeads((prev) =>
        prev.map((l) =>
          l.id === editingLead.id
            ? {
                ...l,
                ...updated,
                leadType: editingLead.leadType,
              }
            : l,
        ),
      );
      setEditorOpen(false);
      setEditingLead(null);
      fetchStats();
      toast.success(
        editForm.syncGhl &&
          (editingLead.leadType === "LOAN_AI_BOOK_DEMO" ||
            editingLead.leadType === "ADMIN_MANUAL")
          ? "Contact updated and GHL sync triggered"
          : "Contact updated",
      );
    } catch {
      setEditError("Network error");
    } finally {
      setEditSaving(false);
    }
  }

  const openAdd = () => {
    setForm({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      source: "Admin",
      status: "NEW",
      campaign: "",
      company: "",
      message: "",
      interestedPlanCode: "",
      interestedPlanName: "",
      syncGhl: true,
    });
    setFormError(null);
    setIsAddOpen(true);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setFormError(null);

    const email = form.email.trim();
    if (!email) {
      setFormError("Email is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError("Enter a valid email address.");
      return;
    }

    const phoneDigits = form.phone.replace(/\D/g, "");
    if (form.phone && phoneDigits.length > 0 && phoneDigits.length < 10) {
      setFormError("Phone must be 10 digits (999-999-9999).");
      return;
    }

    setSubmitting(true);
    try {
      const isBookDemo = form.source === "loan-ai-book-demo";
      const url = isBookDemo
        ? `${API_BASE}/admin/landing-page-leads/loan-ai-book-demo`
        : `${API_BASE}/admin/landing-page-leads/crm/manual-leads`;

      const payload = isBookDemo
        ? {
            firstName: form.firstName.trim() || null,
            lastName: form.lastName.trim() || null,
            email,
            phone: form.phone.trim() || null,
            company: form.company.trim() || null,
            message: form.message.trim() || null,
            interestedPlanCode: form.interestedPlanCode.trim() || null,
            interestedPlanName: form.interestedPlanName.trim() || null,
            status: form.status,
            syncGhl: form.syncGhl,
          }
        : {
            firstName: form.firstName.trim() || null,
            lastName: form.lastName.trim() || null,
            email,
            phone: form.phone.trim() || null,
            source: form.source,
            status: form.status,
            campaign: form.campaign.trim() || null,
            syncGhl: form.syncGhl,
          };

      const res = await fetch(url, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(json?.message || "Failed to create contact");
        return;
      }
      setIsAddOpen(false);
      await fetchLeads(1);
      fetchStats();
      const ghlStatus = json?.data?.ghlSyncStatus;
      if (form.syncGhl && ghlStatus === "SYNCED") {
        toast.success("Contact created and synced to GHL");
      } else if (form.syncGhl && ghlStatus === "FAILED") {
        toast.error(
          json?.data?.ghlLastError ||
            "Contact created but GHL sync failed — use Sync GHL to retry",
        );
      } else if (form.syncGhl) {
        toast.success("Contact created — GHL sync started");
      } else {
        toast.success("Contact created");
      }
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  function gotoPage(page: number) {
    if (page < 1 || page > totalPages) return;
    fetchLeads(page);
  }

  const pageNumbers = useMemo(() => {
    const maxButtons = 5;
    if (totalPages <= maxButtons) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxButtons - 1);
    start = Math.max(1, end - maxButtons + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [currentPage, totalPages]);

  const activeMenuLead = useMemo(
    () => leads.find((lead) => lead.id === openMenuId) || null,
    [leads, openMenuId],
  );

  const inputClass =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500";

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6">
      <PageMeta
        title="Contacts"
        description="Manage landing contacts, follow-ups, and GHL sync"
      />

      <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#5D28A8] p-6 text-white shadow-lg dark:border-slate-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-white/80">CRM</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Contacts
            </h1>
            <p className="mt-1 max-w-xl text-sm text-white/75">
              Create, edit, and sync landing contacts with GoHighLevel.
            </p>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#13538A] shadow-sm transition hover:bg-slate-50"
          >
            <TiPlus className="mr-1.5 text-lg" />
            Add Contact
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
            {
            label: "Total Contacts",
            value: stats.totalLeads,
            icon: Users,
            color: "bg-indigo-600",
          },
          {
            label: "Converted",
            value: stats.convertedLeads,
            icon: UserCheck,
            color: "bg-purple-600",
          },
          {
            label: "New",
            value: stats.newLeads,
            icon: Activity,
            color: "bg-emerald-600",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {card.label}
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
                {card.value}
              </p>
            </div>
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full text-white ${card.color}`}
            >
              <card.icon className="h-5 w-5" />
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          <Filter className="h-4 w-4 text-[#13538A]" />
          Filters
          {hasActiveFilters && (
            <span className="rounded-full bg-[#13538A]/10 px-2 py-0.5 text-xs font-semibold text-[#13538A]">
              Active
            </span>
          )}
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <SelectField
            label="Source"
            value={source}
            onChange={(v) => setSource(v as SourceFilter)}
          >
            <option value="">All sources</option>
            <option value="loan-ai-book-demo">Loan AI Book Demo</option>
            <option value="commerciallendingmastery">
              Commercial Lending Mastery
            </option>
            <option value="clmlandingpage">CLM Landing Page</option>
            <option value="Admin">Admin</option>
          </SelectField>

          <SelectField
            label="Status"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as "" | LeadStatus)}
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="GHL Sync"
            value={ghlFilter}
            onChange={(v) => setGhlFilter(v as "" | GhlSyncStatus)}
          >
            <option value="">All GHL</option>
            {GHL_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </SelectField>

          <label className="flex min-w-[220px] flex-[1.4] flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Search
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, email, phone, company, plan…"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#13538A] focus:outline-none focus:ring-2 focus:ring-[#13538A]/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </label>

          <div className="flex gap-2 pb-0.5">
            <button
              type="button"
              onClick={() => fetchLeads(currentPage)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Showing{" "}
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {leads.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {total}
            </span>{" "}
            contacts
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#13538A] border-t-transparent" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Loading contacts…
            </p>
          </div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-[#13538A] dark:bg-blue-900/30 dark:text-blue-300">
              <Search size={26} />
            </div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-white">
              No contacts found
            </h3>
            <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
              {hasActiveFilters
                ? "Try clearing filters or adjusting your search."
                : "New Book Demo and landing contacts will appear here."}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 rounded-xl bg-[#13538A] px-4 py-2 text-sm font-semibold text-white"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="w-full overflow-hidden">
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
                    <th className="w-[28%] px-3 py-3 sm:px-4">Lead</th>
                    <th className="hidden w-[12%] px-3 py-3 md:table-cell sm:px-4">
                      Phone
                    </th>
                    <th className="hidden w-[12%] px-3 py-3 lg:table-cell sm:px-4">
                      Plan
                    </th>
                    <th className="hidden w-[16%] px-3 py-3 xl:table-cell sm:px-4">
                      Source
                    </th>
                    <th className="w-[14%] px-3 py-3 sm:px-4">Status</th>
                    <th className="w-[12%] px-3 py-3 sm:px-4">GHL</th>
                    <th className="hidden w-[10%] px-3 py-3 lg:table-cell sm:px-4">
                      Created
                    </th>
                    <th className="w-[8%] px-3 py-3 text-right sm:px-4">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {leads.map((l) => {
                    const name =
                      [l.firstName, l.lastName].filter(Boolean).join(" ") ||
                      "—";
                    const plan =
                      l.interestedPlanName || l.interestedPlanCode || "—";

                    return (
                      <tr
                        key={l.id}
                        className="align-middle hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-3 py-3 sm:px-4">
                          <div className="min-w-0">
                            <p
                              className="truncate font-medium text-slate-900 dark:text-slate-100"
                              title={name}
                            >
                              {name}
                            </p>
                            <p
                              className="truncate text-xs text-slate-500 dark:text-slate-400"
                              title={l.email}
                            >
                              {l.email}
                            </p>
                            {(l.company || l.message) && (
                              <p
                                className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500 lg:hidden"
                                title={
                                  [l.company, l.message]
                                    .filter(Boolean)
                                    .join(" · ") || undefined
                                }
                              >
                                {[l.company, plan !== "—" ? plan : null]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            )}
                          </div>
                        </td>
                        <td
                          className="hidden truncate px-3 py-3 text-slate-600 md:table-cell dark:text-slate-300 sm:px-4"
                          title={l.phone || undefined}
                        >
                          {l.phone ? formatPhoneInput(l.phone) : "—"}
                        </td>
                        <td
                          className="hidden truncate px-3 py-3 text-slate-600 lg:table-cell dark:text-slate-300 sm:px-4"
                          title={plan !== "—" ? plan : undefined}
                        >
                          {plan}
                        </td>
                        <td
                          className="hidden truncate px-3 py-3 text-slate-600 xl:table-cell dark:text-slate-300 sm:px-4"
                          title={formatSourceLabel(l.source)}
                        >
                          {formatSourceLabel(l.source)}
                        </td>
                        <td className="px-3 py-3 sm:px-4">
                          <select
                            value={l.status}
                            disabled={rowLoadingId === l.id}
                            onChange={(e) =>
                              changeStatus(
                                l.id,
                                e.target.value as LeadStatus,
                                l.leadType,
                              )
                            }
                            className={`max-w-full rounded-full border px-2 py-1 text-[11px] font-medium sm:text-xs ${statusClass(l.status)}`}
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>
                                {s.replace(/_/g, " ")}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-3 sm:px-4">
                          {l.leadType === "LOAN_AI_BOOK_DEMO" ||
                          l.leadType === "ADMIN_MANUAL" ? (
                            <span
                              className={`inline-flex max-w-full truncate rounded-full border px-2 py-1 text-[11px] font-medium sm:text-xs ${ghlStatusClass(l.ghlSyncStatus)}`}
                              title={l.ghlLastError || undefined}
                            >
                              {l.ghlSyncStatus || "—"}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="hidden truncate px-3 py-3 text-slate-500 lg:table-cell dark:text-slate-400 sm:px-4">
                          {l.createdAt
                            ? new Date(l.createdAt).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="px-3 py-3 text-right sm:px-4">
                          <button
                            type="button"
                            data-lead-menu-trigger="true"
                            disabled={rowLoadingId === l.id}
                            title="More actions"
                            aria-label="More actions"
                            onClick={(e) => {
                              e.stopPropagation();
                              openRowMenu(l.id, e.currentTarget);
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
                          >
                            <MoreVertical size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {activeMenuLead &&
              createPortal(
                <div
                  ref={menuRef}
                  style={{
                    position: "fixed",
                    top: menuPos.top,
                    left: menuPos.left,
                    width: MENU_WIDTH,
                  }}
                  className="z-[9999] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenuId(null);
                      openEditor(activeMenuLead, "view");
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Eye size={14} />
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenuId(null);
                      openEditor(activeMenuLead, "edit");
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Pencil size={14} />
                    Edit
                  </button>
                  {(activeMenuLead.leadType === "LOAN_AI_BOOK_DEMO" ||
                    activeMenuLead.leadType === "ADMIN_MANUAL") && (
                    <button
                      type="button"
                      disabled={rowLoadingId === activeMenuLead.id}
                      onClick={() => {
                        setOpenMenuId(null);
                        retryGhlSync(activeMenuLead.id, activeMenuLead.leadType);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[#13538A] hover:bg-slate-50 disabled:opacity-50 dark:text-blue-300 dark:hover:bg-slate-800"
                    >
                      <RefreshCcw size={14} />
                      {activeMenuLead.ghlSyncStatus === "SYNCED"
                        ? "Re-sync GHL"
                        : "Sync GHL"}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={rowLoadingId === activeMenuLead.id}
                    onClick={() => {
                      setOpenMenuId(null);
                      deleteLead(activeMenuLead.id, activeMenuLead.leadType);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    <MdDelete size={16} />
                    Delete
                  </button>
                </div>,
                document.body,
              )}

            {totalPages > 1 && (
              <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Page{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {currentPage}
                  </span>{" "}
                  of {totalPages}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage === 1 || loading}
                    onClick={() => gotoPage(currentPage - 1)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    Prev
                  </button>
                  {pageNumbers.map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => gotoPage(page)}
                      className={`rounded-lg border px-3 py-1.5 text-sm ${
                        currentPage === page
                          ? "border-[#13538A] bg-[#13538A] text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={currentPage === totalPages || loading}
                    onClick={() => gotoPage(currentPage + 1)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {isAddOpen && (
        <div
          className="fixed inset-0 z-[500000] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !submitting) setIsAddOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-contact-title"
            className="flex w-full max-w-lg max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <div>
                <h2
                  id="create-contact-title"
                  className="text-lg font-semibold text-slate-900 dark:text-white"
                >
                  Create Contact
                </h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  Add a manual contact to your landing CRM inbox.
                </p>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setIsAddOpen(false)}
                aria-label="Close"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                      First name
                    </span>
                    <input
                      autoFocus
                      value={form.firstName}
                      onChange={(e) =>
                        setForm({ ...form, firstName: e.target.value })
                      }
                      className={inputClass}
                      placeholder="John"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Last name
                    </span>
                    <input
                      value={form.lastName}
                      onChange={(e) =>
                        setForm({ ...form, lastName: e.target.value })
                      }
                      className={inputClass}
                      placeholder="Doe"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Email <span className="text-red-500">*</span>
                  </span>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    className={inputClass}
                    placeholder="john@example.com"
                  />
                </label>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Phone
                    </span>
                    <input
                      value={form.phone}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          phone: formatPhoneInput(e.target.value),
                        })
                      }
                      className={inputClass}
                      placeholder="999-999-9999"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      maxLength={12}
                    />
                    <span className="mt-1 block text-xs text-slate-400">
                      Format: 999-999-9999
                    </span>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Status
                    </span>
                    <select
                      value={form.status}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          status: e.target.value as LeadStatus,
                        })
                      }
                      className={inputClass}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Source
                    </span>
                    <select
                      value={form.source}
                      onChange={(e) =>
                        setForm({ ...form, source: e.target.value })
                      }
                      className={inputClass}
                    >
                      <option value="Admin">Admin</option>
                      <option value="loan-ai-book-demo">
                        Loan AI Book Demo
                      </option>
                      <option value="commerciallendingmastery">
                        Commercial Lending Mastery
                      </option>
                      <option value="clmlandingpage">CLM Landing Page</option>
                    </select>
                  </label>
                </div>

                {form.source === "loan-ai-book-demo" ? (
                  <>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                        Company
                      </span>
                      <input
                        value={form.company}
                        onChange={(e) =>
                          setForm({ ...form, company: e.target.value })
                        }
                        className={inputClass}
                        placeholder="Company name"
                      />
                    </label>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                          Plan code
                        </span>
                        <input
                          value={form.interestedPlanCode}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              interestedPlanCode: e.target.value,
                            })
                          }
                          className={inputClass}
                          placeholder="STARTER"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                          Plan name
                        </span>
                        <input
                          value={form.interestedPlanName}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              interestedPlanName: e.target.value,
                            })
                          }
                          className={inputClass}
                          placeholder="Starter"
                        />
                      </label>
                    </div>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                        Message
                      </span>
                      <textarea
                        value={form.message}
                        rows={3}
                        onChange={(e) =>
                          setForm({ ...form, message: e.target.value })
                        }
                        className={inputClass}
                        placeholder="Optional note for the demo request"
                      />
                    </label>
                  </>
                ) : (
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Campaign{" "}
                      <span className="font-normal text-slate-400">
                        (optional)
                      </span>
                    </span>
                    <input
                      value={form.campaign}
                      onChange={(e) =>
                        setForm({ ...form, campaign: e.target.value })
                      }
                      className={inputClass}
                      placeholder="Spring outreach"
                    />
                  </label>
                )}

                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={form.syncGhl}
                    onChange={(e) =>
                      setForm({ ...form, syncGhl: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Sync to GHL after create
                </label>

                {formError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                    {formError}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-950/40">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setIsAddOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !form.email.trim()}
                  className="inline-flex min-w-[132px] items-center justify-center rounded-xl bg-[#13538A] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1074cc] disabled:opacity-60"
                >
                  {submitting ? "Creating…" : "Create contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editorOpen && editingLead && (
        <div className="fixed inset-0 z-[500000] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {editorMode === "view" ? "View Contact" : "Edit Contact"}
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {formatSourceLabel(editingLead.source)}
                  {editingLead.leadType === "LOAN_AI_BOOK_DEMO" &&
                    editingLead.ghlSyncStatus
                    ? ` · GHL ${editingLead.ghlSyncStatus}`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditorOpen(false);
                  setEditingLead(null);
                }}
                className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            <form
              onSubmit={saveEdit}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            >
              <label>
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  First Name
                </span>
                <input
                  value={editForm.firstName}
                  disabled={editorMode === "view"}
                  onChange={(e) =>
                    setEditForm({ ...editForm, firstName: e.target.value })
                  }
                  className={`${inputClass} disabled:opacity-70`}
                />
              </label>
              <label>
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  Last Name
                </span>
                <input
                  value={editForm.lastName}
                  disabled={editorMode === "view"}
                  onChange={(e) =>
                    setEditForm({ ...editForm, lastName: e.target.value })
                  }
                  className={`${inputClass} disabled:opacity-70`}
                />
              </label>
              <label className="sm:col-span-2">
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  Email <span className="text-red-500">*</span>
                </span>
                <input
                  required
                  type="email"
                  value={editForm.email}
                  disabled={editorMode === "view"}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                  className={`${inputClass} disabled:opacity-70`}
                />
              </label>
              <label>
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  Phone
                </span>
                <input
                  value={editForm.phone}
                  disabled={editorMode === "view"}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      phone: formatPhoneInput(e.target.value),
                    })
                  }
                  className={`${inputClass} disabled:opacity-70`}
                  placeholder="999-999-9999"
                  inputMode="numeric"
                  maxLength={12}
                />
              </label>
              <label>
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  Status
                </span>
                <select
                  value={editForm.status}
                  disabled={editorMode === "view"}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      status: e.target.value as LeadStatus,
                    })
                  }
                  className={`${inputClass} disabled:opacity-70`}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>

              {editingLead.leadType === "LOAN_AI_BOOK_DEMO" && (
                <>
                  <label className="sm:col-span-2">
                    <span className="text-sm text-slate-600 dark:text-slate-300">
                      Company
                    </span>
                    <input
                      value={editForm.company}
                      disabled={editorMode === "view"}
                      onChange={(e) =>
                        setEditForm({ ...editForm, company: e.target.value })
                      }
                      className={`${inputClass} disabled:opacity-70`}
                    />
                  </label>
                  <label>
                    <span className="text-sm text-slate-600 dark:text-slate-300">
                      Plan Code
                    </span>
                    <input
                      value={editForm.interestedPlanCode}
                      disabled={editorMode === "view"}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          interestedPlanCode: e.target.value,
                        })
                      }
                      className={`${inputClass} disabled:opacity-70`}
                    />
                  </label>
                  <label>
                    <span className="text-sm text-slate-600 dark:text-slate-300">
                      Plan Name
                    </span>
                    <input
                      value={editForm.interestedPlanName}
                      disabled={editorMode === "view"}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          interestedPlanName: e.target.value,
                        })
                      }
                      className={`${inputClass} disabled:opacity-70`}
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="text-sm text-slate-600 dark:text-slate-300">
                      Message
                    </span>
                    <textarea
                      value={editForm.message}
                      disabled={editorMode === "view"}
                      rows={3}
                      onChange={(e) =>
                        setEditForm({ ...editForm, message: e.target.value })
                      }
                      className={`${inputClass} disabled:opacity-70`}
                    />
                  </label>
                </>
              )}

              {(editingLead.leadType === "LOAN_AI_BOOK_DEMO" ||
                editingLead.leadType === "ADMIN_MANUAL") && (
                <>
                  {editorMode === "edit" && (
                    <label className="sm:col-span-2 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={editForm.syncGhl}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            syncGhl: e.target.checked,
                          })
                        }
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Sync to GHL after save
                    </label>
                  )}
                  {editorMode === "view" && (
                    <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
                      <p>
                        <span className="text-slate-500">GHL status:</span>{" "}
                        {editingLead.ghlSyncStatus || "—"}
                      </p>
                      <p className="mt-1 truncate">
                        <span className="text-slate-500">GHL contact:</span>{" "}
                        {editingLead.ghlContactId || "—"}
                      </p>
                      {editingLead.ghlLastError && (
                        <p className="mt-1 text-red-600 dark:text-red-400">
                          {editingLead.ghlLastError}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              {editError && (
                <div className="text-sm text-red-600 sm:col-span-2">
                  {editError}
                </div>
              )}

              <div className="mt-2 flex flex-wrap justify-end gap-3 sm:col-span-2">
                {editorMode === "view" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditorMode("edit")}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                    >
                      Edit
                    </button>
                    {editingLead.leadType === "LOAN_AI_BOOK_DEMO" ||
                    editingLead.leadType === "ADMIN_MANUAL" ? (
                      <button
                        type="button"
                        onClick={() =>
                          retryGhlSync(editingLead.id, editingLead.leadType)
                        }
                        className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-medium text-[#13538A] hover:bg-blue-50 dark:border-blue-500/30 dark:text-blue-300"
                      >
                        Sync GHL
                      </button>
                    ) : null}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditorMode("view")}
                      className="rounded-lg px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={editSaving}
                      className="rounded-lg bg-[#13538A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1074cc] disabled:opacity-70"
                    >
                      {editSaving ? "Saving…" : "Save changes"}
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
