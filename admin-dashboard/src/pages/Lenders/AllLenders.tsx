import React, { useEffect, useMemo, useState } from "react";
import { MdModeEdit, MdDelete } from "react-icons/md";
import { TiPlus } from "react-icons/ti";
import EditLenderModal from "./EditLenderModal";
import LenderDetailsModal from "./LenderDetailsModal";
import TransferLenderPortalModal from "./TransferLenderPortalModal";
import { useNavigate } from "react-router-dom";

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
  PackagePlus,
  Phone,
  Upload,
  Link2,
  ArrowRightLeft,
  // Filter,
} from "lucide-react";
import Swal from "sweetalert2";
Swal.mixin({
  customClass: {
    popup: "swal-high-z",
  },
});
import { Eye, EyeOff } from "lucide-react";
import LenderProductAssign from "../LoanProducts/LenderAssignProduct";
import toast from "react-hot-toast";
import LenderInvitesPanel from "./LenderInvitesPanel";
import BulkInviteLendersModal from "./BulkInviteLendersModal";

type Lender = {
  id: any;
  name: string;
  email: string;
  phone: string;
  status?: string;
  createdAt?: string;
  brokerName?: string;
  profileImage?: string | null;

  brokerOrgId?: string;

  adminFirstName?: string;
  adminLastName?: string;
  adminEmail?: string;
  adminPhone?: string;
};

type Admin = {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
};

// 🔹 Broker type for optional assignment
type BrokerOrg = {
  id: string;
  name: string;
  email?: string;
};

// const STATUS_ORDER = ["ACTIVE", "INACTIVE"]; // keep real backend enum

function statusClass(status?: string) {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/40";
    case "INACTIVE":
      return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-300 dark:border-yellow-500/40";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-slate-600/30 dark:text-slate-100 dark:border-slate-500";
  }
}

export default function AllLendersPage() {
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [loading, setLoading] = useState(false);
  const [rowLoadingId, setRowLoadingId] = useState<any | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [inviteLoading, setInviteLoading] = useState(false);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState({
    organizationName: "",
    organizationEmail: "",
    organizationPhone: "",
    adminFirstName: "",
    adminLastName: "",
    adminEmail: "",
    adminPassword: "",
    // optional broker assignment
    brokerOrgId: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editingLender, setEditingLender] = useState<Lender | null>(null);
  const [viewingLender, setViewingLender] = useState<Lender | null>(null);
  const [transferringLender, setTransferringLender] = useState<Lender | null>(
    null,
  );

  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState<number>(6);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Admins modal & editing state
  const [showAdminsFor, setShowAdminsFor] = useState<Lender | null>(null);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [adminsError, setAdminsError] = useState<string | null>(null);

  // Admin inline-edit state
  const [editingAdminId, setEditingAdminId] = useState<string | null>(null);
  const [adminEditForm, setAdminEditForm] = useState<Admin>({});
  const [adminSaving, setAdminSaving] = useState(false);

  //  brokers for dropdown
  const [brokers, setBrokers] = useState<BrokerOrg[]>([]);
  const [loadingBrokers, setLoadingBrokers] = useState(false);
  const [brokersError, setBrokersError] = useState<string | null>(null);

  const [showAssignPopup, setShowAssignPopup] = useState(false);
  const [newCreatedLenderId, setNewCreatedLenderId] = useState<string | null>(
    null,
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isBulkInviteOpen, setIsBulkInviteOpen] = useState(false);
  const [inviteListKey, setInviteListKey] = useState(0);
  const [listView, setListView] = useState<"lenders" | "invites">("lenders");

  const publicPartnerLink = (() => {
    const lenderBase = String(
      import.meta.env.VITE_LENDER_URI || "http://localhost:5174",
    ).replace(/\/$/, "");
    return `${lenderBase}/partner`;
  })();

  const copyPublicPartnerLink = async () => {
    try {
      await navigator.clipboard.writeText(publicPartnerLink);
      toast.success("Lender signup link copied to clipboard.");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const [inviteForm, setInviteForm] = useState({
    companyName: "",
    fullName: "",
    email: "",
    phone: "",
  });

  const [inviteErrors, setInviteErrors] = useState({
    companyName: "",
    name: "",
    email: "",
    phone: "",
  });

  const [inviteApiError, setInviteApiError] = useState("");

  const navigate = useNavigate();

  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000"; // adjust if needed

  const usPhoneRegex = /^\d{3}-\d{3}-\d{4}$/;

  useEffect(() => {
    fetchLenders();
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
    } catch {
      // ignore
    }
    return { "Content-Type": "application/json" };
  }

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

    if (!emailRegex.test(form.organizationEmail)) {
      newErrors.organizationEmail = "Enter a valid email address.";
    }

    if (!usPhoneRegex.test(form.organizationPhone)) {
      newErrors.organizationPhone =
        "Enter valid US phone number (e.g., 123-456-7890).";
    }

    if (!form.adminFirstName.trim()) {
      newErrors.adminFirstName = "First name is required.";
    } else if (!nameRegex.test(form.adminFirstName)) {
      newErrors.adminFirstName = "Only letters allowed.";
    }

    if (!form.adminLastName.trim()) {
      newErrors.adminLastName = "Last name is required.";
    } else if (!nameRegex.test(form.adminLastName)) {
      newErrors.adminLastName = "Only letters allowed.";
    }

    if (!emailRegex.test(form.adminEmail)) {
      newErrors.adminEmail = "Enter a valid email address.";
    }

    if (!strongPassword.test(form.adminPassword)) {
      newErrors.adminPassword =
        "Password must be 8+ chars, include uppercase, lowercase, number & special character.";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const validateInvite = () => {
    const errors = {
      companyName: "",
      name: "",
      email: "",
      phone: "",
    };

    let isValid = true;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!inviteForm.companyName.trim()) {
      errors.companyName = "Company name is required";
      isValid = false;
    }

    if (!inviteForm.fullName.trim()) {
      errors.name = "Name is required";
      isValid = false;
    }

    if (!inviteForm.email.trim()) {
      errors.email = "Email is required";
      isValid = false;
    } else if (!emailRegex.test(inviteForm.email)) {
      errors.email = "Enter valid email address";
      isValid = false;
    }

    if (!inviteForm.phone.trim()) {
      errors.phone = "Phone number is required";
      isValid = false;
    } else if (!usPhoneRegex.test(inviteForm.phone)) {
      errors.phone = "Enter valid US phone number (e.g. 222-222-2222)";
      isValid = false;
    }

    setInviteErrors(errors);

    return isValid;
  };

  const formatUSPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");

    if (numbers.length <= 3) return numbers;

    if (numbers.length <= 6) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    }

    return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(0, 10).slice(6)}`;
  };

  // -------- LENDERS LIST --------
  async function fetchLenders(searchValue?: string) {
    setLoading(true);

    try {
      const headers = getAuthHeaders();

      const url = searchValue
        ? `${API_BASE}/admin/lenders/read?search=${encodeURIComponent(searchValue)}`
        : `${API_BASE}/admin/lenders/read`;

      const res = await fetch(url, {
        method: "GET",
        headers,
      });

      if (!res.ok) throw new Error(`Failed to fetch lenders: ${res.status}`);

      const json = await res.json();

      const list = json?.data?.results || [];

      const normalized: Lender[] = list.map((o: any) => ({
        id: o.id,
        name: o.organizationName,
        email: o.organizationEmail,
        phone: o.organizationPhone,
        status: o.organizationStatus,
        adminFirstName: o.adminFirstName,
        adminLastName: o.adminLastName,
        adminEmail: o.adminEmail,
        adminPhone: o.adminPhone,
        brokerOrgId: o.brokerOrgId,
        brokerName: o.brokerName,
        createdAt: o.createdAt,
        profileImage: null,
      }));

      setLenders(normalized);
    } catch (err) {
      console.error("Fetch lenders failed:", err);
    } finally {
      setLoading(false);
    }
  }

  // -------- BROKERS (for dropdown) --------
  async function fetchBrokers() {
    setLoadingBrokers(true);
    setBrokersError(null);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/admin/brokers/read/`, {
        method: "GET",
        headers,
      });

      if (!res.ok) throw new Error(`Failed to fetch brokers: ${res.status}`);

      const json = await res.json();
      const list = Array.isArray(json)
        ? json
        : json.data?.results || json.data || [];

      const normalized: BrokerOrg[] = (list as any[]).map(
        (b: any, idx: number) => ({
          id: b.id ?? String(idx + 1),
          name: b.name ?? b.organizationName ?? "Unnamed Broker",
          email: b.email ?? b.organizationEmail ?? "",
        }),
      );

      setBrokers(normalized);
    } catch (err: any) {
      console.error("fetchBrokers error:", err);
      setBrokersError(err?.message || "Failed to load brokers");
    } finally {
      setLoadingBrokers(false);
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
      brokerOrgId: "",
    });
    setFormError(null);
    setIsAddOpen(true);
  };

  const handleDelete = async (lender: Lender) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: `Deleting lender "${lender.name}" will permanently remove the lender along with all associated applications and assigned products. This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete it!",
    });

    if (!result.isConfirmed) return;

    setRowLoadingId(lender.id);

    try {
      const token = sessionStorage.getItem("admin_token");

      const res = await fetch(
        `${API_BASE}/admin/lenders/delete/${lender.id}/hard`,
        {
          method: "DELETE",
          headers: {
            // "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );

      if (!res.ok) throw new Error("Delete failed");

      setLenders((prev) => prev.filter((b) => b.id !== lender.id));

      Swal.fire({
        icon: "success",
        title: "Deleted!",
        text: "Lender removed successfully.",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Failed",
        text: "Could not delete lender. Try again.",
      });
    } finally {
      setRowLoadingId(null);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setFormError(null);

    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload: any = {
        organizationName: form.organizationName.trim(),
        organizationEmail: form.organizationEmail.trim(),
        organizationPhone: form.organizationPhone.trim(),
        adminFirstName: form.adminFirstName.trim(),
        adminLastName: form.adminLastName.trim(),
        adminEmail: form.adminEmail.trim(),
        adminPassword: form.adminPassword,
      };

      if (form.brokerOrgId) {
        payload.brokerOrgId = form.brokerOrgId;
      }

      const headers = getAuthHeaders();

      const res = await fetch(`${API_BASE}/admin/lenders/create`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(json?.message || `Server returned ${res.status}`);
        return;
      }

      const createdId = json?.data?.organizationId ?? json?.data?.id ?? null;

      if (!createdId) {
        setFormError("Lender created but ID not returned from server.");
        return;
      }

      // close create modal
      setIsAddOpen(false);

      // store new lender id
      setNewCreatedLenderId(createdId);

      // open assign popup
      setShowAssignPopup(true);
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleInvite = async () => {
    if (!validateInvite()) return;

    setInviteApiError("");
    setInviteLoading(true);

    try {
      const token = sessionStorage.getItem("admin_token");

      const res = await fetch(`${API_BASE}/admin/invite-lenders/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          companyName: inviteForm.companyName.trim(),
          fullName: inviteForm.fullName.trim(),
          email: inviteForm.email.trim().toLowerCase(),
          phone: inviteForm.phone.replace(/\D/g, ""),
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setInviteApiError(json?.message || "Failed to send invite.");
        return;
      }

      toast.success("Invitation sent successfully");

      setInviteForm({
        companyName: "",
        fullName: "",
        email: "",
        phone: "",
      });

      setIsInviteOpen(false);
      setListView("invites");
      setInviteListKey((k) => k + 1);
    } catch (err: any) {
      setInviteApiError("Something went wrong. Please try again.");
    } finally {
      setInviteLoading(false);
    }
  };

  const filtered = lenders;

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

  // const openEditModal = async (b: Lender) => {
  //   try {
  //     const token = sessionStorage.getItem("admin_token");

  //     const res = await fetch(`${API_BASE}/admin/lenders/read?search=${b.id}`, {
  //       headers: {
  //         "Content-Type": "application/json",
  //         ...(token ? { Authorization: `Bearer ${token}` } : {}),
  //       },
  //     });

  //     if (!res.ok) throw new Error("Failed to fetch lender");

  //     const json = await res.json();

  //     const lender = json?.data?.results?.[0];

  //     if (!lender) {
  //       toast.error("Lender not found");
  //       return;
  //     }

  //     setEditingLender({
  //       id: lender.id,

  //       name: lender.organizationName,
  //       email: lender.organizationEmail,
  //       phone: lender.organizationPhone,

  //       brokerOrgId: lender.brokerOrgId || "",

  //       adminFirstName: lender.adminFirstName || "",
  //       adminLastName: lender.adminLastName || "",
  //       adminEmail: lender.adminEmail || "",
  //     });
  //   } catch (err) {
  //     console.error("Failed to load lender details", err);
  //     toast.error("Failed to load lender details");
  //   }
  // };

  const handleEditSave = async (payload: {
    id: string;
    name: string;
    email: string;
    phone: string;
    brokerOrgId: string | null;
    adminFirstName?: string;
    adminLastName?: string;
    adminEmail?: string;
  }) => {
    try {
      const token = sessionStorage.getItem("admin_token");

      const res = await fetch(
        `${API_BASE}/admin/lenders/update/${payload.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            organizationName: payload.name,
            organizationEmail: payload.email,
            organizationPhone: payload.phone,

            adminFirstName: payload.adminFirstName,
            adminLastName: payload.adminLastName,
            adminEmail: payload.adminEmail,

            brokerOrgId: payload.brokerOrgId,
          }),
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Update failed");
      }

      toast.success("Lender updated successfully");

      setEditingLender(null);

      await fetchLenders();
    } catch (err) {
      console.error("Failed to update lender:", err);
      toast.error("Failed to update lender");
    }
  };

  const changeStatusFor = async (lender: Lender) => {
    if (!lender?.id) return;

    const current = (lender.status || "UNKNOWN").toUpperCase();
    const next = current === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    const result = await Swal.fire({
      title: "Change Status?",
      text: `Do you want to mark this lender as ${next}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#2563eb",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, change it",
    });

    if (!result.isConfirmed) return;

    const prevStatus = lender.status;

    setLenders((prev) =>
      prev.map((b) => (b.id === lender.id ? { ...b, status: next } : b)),
    );

    setRowLoadingId(lender.id);

    try {
      const token = sessionStorage.getItem("admin_token");

      const path =
        next === "ACTIVE"
          ? `${API_BASE}/admin/lenders/status/activate/${lender.id}`
          : `${API_BASE}/admin/lenders/status/deactivate/${lender.id}`;

      const res = await fetch(path, {
        method: "PATCH",
        headers: {
          // "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) throw new Error("Status update failed");

      Swal.fire({
        icon: "success",
        title: "Updated!",
        text: `Lender is now ${next}`,
        timer: 1300,
        showConfirmButton: false,
      });
    } catch (err: any) {
      setLenders((prev) =>
        prev.map((b) =>
          b.id === lender.id ? { ...b, status: prevStatus } : b,
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

  // ------------------------------
  // Fetch admins for a lender id
  // ------------------------------
  async function fetchAdmins(lenderId: any) {
    setLoadingAdmins(true);
    setAdmins([]);
    setAdminsError(null);

    try {
      const token = sessionStorage.getItem("admin_token");
      const res = await fetch(`${API_BASE}/admin/lenders/read/${lenderId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok)
        throw new Error(`Failed to load lender admins: ${res.status}`);

      const json = await res.json().catch(() => ({}));
      const org = json?.data?.organization;
      const adminUser = json?.data?.adminUser;

      let adminList: any[] = [];

      if (Array.isArray(org?.users) && org.users.length > 0) {
        adminList = org.users;
      } else if (adminUser) {
        adminList = [adminUser];
      }

      const normalized: Admin[] = adminList.map((a: any) => ({
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

  // const openAdminsFor = async (lender: Lender) => {
  //   // setShowAdminsFor(lender);
  //   // setEditingAdminId(null);
  //   // setAdminEditForm({});
  //   await fetchAdmins(lender.id);
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
        `${API_BASE}/admin/lenders/admin/update/${adminId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            firstName: adminEditForm.firstName,
            lastName: adminEditForm.lastName,
            email: adminEditForm.email,
            phone: adminEditForm.phone,
          }),
        },
      );

      if (!res.ok) {
        throw new Error(`Save failed: ${res.status}`);
      }

      const json = await res.json().catch(() => ({}));
      if (json && json.data) {
        const serverObj = json.data;
        setAdmins((prev) =>
          prev.map((p) => (p.id === adminId ? { ...p, ...serverObj } : p)),
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

  const activeLenders = useMemo(
    () => lenders.filter((l) => l.status === "ACTIVE").length,
    [lenders],
  );

  const totalLenders = lenders.length;

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
    <div className="bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="max-w-7xl mx-auto">
        {/* ================= HEADER ================= */}
        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6  dark:border-slate-800 dark:bg-slate-900">
  {/* Top */}
  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
    <div>
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-[#13538A] dark:text-white">
          All Lenders
        </h1>

        <button
          onClick={() => fetchLenders()}
          disabled={loading}
          title="Refresh"
          className="group inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 active:scale-95 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
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

      <p className="mt-2  text-sm leading-6 text-slate-500 dark:text-slate-400">
        Manage lender organizations, assign loan products and manage lender invitations from one place.
      </p>
    </div>
  </div>

  {/* Divider */}
  <div className="my-5 border-t border-slate-200 dark:border-slate-800" />

  {/* Actions */}
  <div className="flex flex-wrap items-center gap-2.5">
    {/* Add */}
    <button
      onClick={() => navigate("/add-lender")}
      className="inline-flex items-center gap-1.5 rounded-lg bg-[#13538A] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#10446f] hover:shadow-md active:scale-95"
    >
      <TiPlus className="h-3.5 w-3.5" />
      Add Lender 
    </button>

    {/* Assign */}
    <button
      onClick={() => navigate("/assigned-products")}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[#13538A] bg-white px-3.5 py-2 text-xs font-semibold text-[#13538A] shadow-sm transition-all hover:bg-blue-50 active:scale-95 dark:border-blue-500 dark:bg-slate-900 dark:text-blue-400 dark:hover:bg-slate-800"
    >
      <PackagePlus className="h-3.5 w-3.5" />
      Assign Products
    </button>

    {/* View */}
    <button
      onClick={() => navigate("/view-assigned-products")}
      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow-md active:scale-95"
    >
      <Eye className="h-3.5 w-3.5" />
      View Assigned Products
    </button>

    {/* Invite */}
    <button
      onClick={() => setIsInviteOpen(true)}
      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow-md active:scale-95"
    >
      <Users className="h-3.5 w-3.5" />
      Invite Lender
    </button>

    {/* Bulk */}
    <button
      onClick={() => setIsBulkInviteOpen(true)}
      className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-violet-700 hover:shadow-md active:scale-95"
    >
      <Upload className="h-3.5 w-3.5" />
      Invite Multiple Lenders
    </button>

    {/* Public Link */}
    <button
      type="button"
      onClick={copyPublicPartnerLink}
      title={publicPartnerLink}
      className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-teal-700 hover:shadow-md active:scale-95"
    >
      <Link2 className="h-3.5 w-3.5" />
      Copy Lender Signup Link
    </button>
  </div>
</div>
        {/* ================= VIEW TABS ================= */}
        <div className="mb-6 inline-flex rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1">
          <button
            type="button"
            onClick={async () => {
              setListView("lenders");
              setCurrentPage(1);
              setQuery("");
              await fetchLenders();
            }}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition ${
              listView === "lenders"
                ? "bg-[#13538A] text-white"
                : "text-slate-600 dark:text-slate-300"
            }`}
          >
            All Lenders
          </button>
          <button
            type="button"
            onClick={() => setListView("invites")}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition ${
              listView === "invites"
                ? "bg-[#13538A] text-white"
                : "text-slate-600 dark:text-slate-300"
            }`}
          >
            Invitations
          </button>
        </div>

        {listView === "invites" ? (
          <LenderInvitesPanel
            key={inviteListKey}
            apiBase={API_BASE}
            getAuthHeaders={getAuthHeaders}
            onBulkInvite={() => setIsBulkInviteOpen(true)}
          />
        ) : (
          <>
            {/* ================= STATS CARDS ================= */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              {/* TOTAL LENDERS */}
              <div
                className="
    bg-white dark:bg-slate-900
    border border-slate-200 dark:border-slate-800
    rounded-2xl p-6
    hover:shadow-md
    transition-all duration-200
    flex items-center justify-between
  "
              >
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Total Lenders
                  </p>
                  <p className="text-xl font-semibold text-slate-900 dark:text-white mt-1">
                    {totalLenders}
                  </p>
                </div>

                <div className="h-8 w-8 flex items-center justify-center rounded-full bg-violet-600 text-white">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              {/* Total Volume */}
              <div
                className="
    bg-white dark:bg-slate-900
    border border-slate-200 dark:border-slate-800
    rounded-2xl p-6
    hover:shadow-md
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

                <div className="h-8 w-8 flex items-center justify-center rounded-full bg-orange-500 text-white">
                  <UserCheck className="w-5 h-5" />
                </div>
              </div>

              {/* ACTIVE LENDERS */}
              <div
                className="
    bg-white dark:bg-slate-900
    border border-slate-200 dark:border-slate-800
    rounded-2xl p-6
    hover:shadow-md
    transition-all duration-200
    flex items-center justify-between
  "
              >
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Active Lenders
                  </p>
                  <p className="text-xl font-semibold text-slate-900 dark:text-white mt-1">
                    {activeLenders}
                  </p>
                </div>

                <div className="h-8 w-8 flex items-center justify-center rounded-full bg-emerald-600 text-white">
                  <Activity className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* ================= SEARCH & FILTER BAR ================= */}
            <div className="mb-8 p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 dark:shadow-none flex flex-col md:flex-row items-center gap-4">
              <div className="relative flex-1 w-full">
                <Search
                  size={20}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={query}
                  onChange={(e) => {
                    const value = e.target.value;
                    setQuery(value);
                    setCurrentPage(1);
                    fetchLenders(value);
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
                  No Lenders Found
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-sm">
                  Get started by adding a new lender to the platform.
                </p>
                <button
                  onClick={openAdd}
                  className="mt-6 px-6 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition"
                >
                  Add Lender
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
                  We couldn't find any lenders matching "
                  <span className="font-semibold text-orange-600">{query}</span>
                  ".
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
                    role="button"
                    tabIndex={0}
                    onClick={() => setViewingLender(l)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setViewingLender(l);
                      }
                    }}
                    className="group relative cursor-pointer rounded-xl border border-slate-200 bg-white p-5 transition-all duration-300 hover:border-[#13538A]/35 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/40"
                  >
                    {/* STATUS */}
                    <div className="absolute top-4 right-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!rowLoadingId) changeStatusFor(l);
                        }}
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
                        <div>
                          <h3 className="truncate text-base font-bold text-[#13538A] transition-colors group-hover:text-blue-600 dark:text-white">
                            {l.name}
                          </h3>
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                          {l.brokerName
                            ? `Broker: ${l.brokerName}`
                            : "No Broker Assigned"}
                        </p>

                        <div className="mt-3 space-y-1.5">
                          <div className="flex items-center gap-2 text-slate-500">
                            <Mail size={14} className="flex-shrink-0" />
                            <span className="text-[12px] truncate">
                              {l.email}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-500">
                            <span className="text-[12px] truncate">
                              {l.phone}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions Footer */}
                    <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800/50">
                      <span className="text-[10px] font-bold uppercase text-slate-400">
                        Created:{" "}
                        {l.createdAt
                          ? new Date(l.createdAt).toLocaleDateString()
                          : "-"}
                      </span>

                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#13538A] opacity-0 transition-opacity group-hover:opacity-100 dark:text-blue-400">
                          View details
                          <ChevronRight size={12} />
                        </span>

                        <button
                          disabled={!!rowLoadingId}
                          onClick={(e) => {
                            e.stopPropagation();
                            setTransferringLender(l);
                          }}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-500/10"
                          title="Transfer Lender Portal"
                        >
                          <ArrowRightLeft size={16} />
                        </button>
                        <button
                          disabled={!!rowLoadingId}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/update-lender/${l.id}`);
                          }}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-500/10"
                          title="Edit Lender"
                        >
                          <MdModeEdit size={16} />
                        </button>
                        <button
                          disabled={!!rowLoadingId}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(l);
                          }}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                          title="Delete Lender"
                        >
                          {rowLoadingId === l.id ? (
                            <RefreshCcw size={16} className="animate-spin" />
                          ) : (
                            <MdDelete size={16} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ================= PAGINATION ================= */}
            {!loading && totalPages > 1 && (
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-6 border-t border-slate-200 dark:border-slate-700 pt-6">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Showing{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    Page {currentPage}
                  </span>{" "}
                  of {totalPages}
                </p>

                <div className="flex items-center gap-3">
                  {/* Prev */}
                  <button
                    disabled={currentPage === 1}
                    onClick={() => gotoPage(currentPage - 1)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border 
        border-slate-200 dark:border-slate-700
        bg-white dark:bg-slate-900
        text-slate-700 dark:text-slate-200
        hover:bg-slate-50 dark:hover:bg-slate-800
        disabled:opacity-40 disabled:cursor-not-allowed
        transition"
                  >
                    <ChevronLeft size={18} />
                    Prev
                  </button>

                  {/* Next */}
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => gotoPage(currentPage + 1)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border 
        border-slate-200 dark:border-slate-700
        bg-white dark:bg-slate-900
        text-slate-700 dark:text-slate-200
        hover:bg-slate-50 dark:hover:bg-slate-800
        disabled:opacity-40 disabled:cursor-not-allowed
        transition"
                  >
                    Next
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
            {/* Add Lender Modal */}
            {isAddOpen && (
              <div className="fixed inset-0 z-500000 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-lg dark:bg-slate-900 dark:border dark:border-slate-700">
                  {/* HEADER */}
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Create Lender
                    </h2>
                    <button
                      disabled={showAssignPopup}
                      onClick={() => !showAssignPopup && setIsAddOpen(false)}
                      className="text-gray-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-500"
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
                        <InfoTip text="Basic information about the lender organization." />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label className="block">
                          <span className="text-sm text-gray-700 dark:text-slate-200">
                            Organization Name
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
                            className={`w-full px-3 py-2 mt-1 border rounded-md
${errors.organizationName ? "border-red-500" : "border-gray-300"}
bg-white text-gray-900
dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100`}
                          />
                          {errors.organizationName && (
                            <p className="text-xs text-red-600 mt-1">
                              {errors.organizationName}
                            </p>
                          )}
                        </label>

                        <label className="block">
                          <span className="text-sm text-gray-700 dark:text-slate-200">
                            Organization Email
                          </span>
                          <input
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
                            className={`w-full px-3 py-2 mt-1 border rounded-md
${errors.organizationEmail ? "border-red-500" : "border-gray-300"}
bg-white text-gray-900
dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100`}
                          />
                          {errors.organizationEmail && (
                            <p className="text-xs text-red-600 mt-1">
                              {errors.organizationEmail}
                            </p>
                          )}
                        </label>

                        <label className="block md:col-span-1">
                          <span className="text-sm text-gray-700 dark:text-slate-200">
                            Organization Phone
                          </span>
                          <input
                            value={form.organizationPhone}
                            onChange={(e) => {
                              setForm({
                                ...form,
                                organizationPhone: e.target.value,
                              });
                              setErrors((prev) => ({
                                ...prev,
                                organizationPhone: "",
                              }));
                            }}
                            className={`w-full px-3 py-2 mt-1 border rounded-md
${errors.organizationPhone ? "border-red-500" : "border-gray-300"}
bg-white text-gray-900
dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100`}
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
                        <InfoTip text="Admin user who will manage this lender." />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* First + Last Name parallel */}
                        <label className="block">
                          <span className="text-sm text-gray-700 dark:text-slate-200">
                            Admin First Name
                          </span>
                          <input
                            value={form.adminFirstName}
                            onChange={(e) => {
                              setForm({
                                ...form,
                                adminFirstName: e.target.value,
                              });
                              setErrors((prev) => ({
                                ...prev,
                                adminFirstName: "",
                              }));
                            }}
                            className={`w-full px-3 py-2 mt-1 border rounded-md
${errors.adminFirstName ? "border-red-500" : "border-gray-300"}
bg-white text-gray-900
dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100`}
                          />
                          {errors.adminFirstName && (
                            <p className="text-xs text-red-600 mt-1">
                              {errors.adminFirstName}
                            </p>
                          )}
                        </label>

                        <label className="block">
                          <span className="text-sm text-gray-700 dark:text-slate-200">
                            Admin Last Name
                          </span>
                          <input
                            value={form.adminLastName}
                            onChange={(e) => {
                              setForm({
                                ...form,
                                adminLastName: e.target.value,
                              });
                              setErrors((prev) => ({
                                ...prev,
                                adminLastName: "",
                              }));
                            }}
                            className={`w-full px-3 py-2 mt-1 border rounded-md
${errors.adminLastName ? "border-red-500" : "border-gray-300"}
bg-white text-gray-900
dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100`}
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
                            Admin Email
                          </span>
                          <input
                            value={form.adminEmail}
                            onChange={(e) => {
                              setForm({ ...form, adminEmail: e.target.value });
                              setErrors((prev) => ({
                                ...prev,
                                adminEmail: "",
                              }));
                            }}
                            className={`w-full px-3 py-2 mt-1 border rounded-md
${errors.adminEmail ? "border-red-500" : "border-gray-300"}
bg-white text-gray-900
dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100`}
                          />
                          {errors.adminEmail && (
                            <p className="text-xs text-red-600 mt-1">
                              {errors.adminEmail}
                            </p>
                          )}
                        </label>

                        <label className="block">
                          <span className="text-sm text-gray-700 dark:text-slate-200">
                            Admin Password
                          </span>

                          <div className="relative">
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
                              className={`w-full px-3 py-2 mt-1 border rounded-md pr-10
      ${errors.adminPassword ? "border-red-500" : "border-gray-300"}
      bg-white text-gray-900
      dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100`}
                            />

                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 dark:text-white"
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
                      </div>
                    </div>

                    {/* ================= BROKER SECTION ================= */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                          Broker Assignment
                        </h3>
                        <InfoTip text="Optional broker assignment for this lender." />
                      </div>

                      <label className="block">
                        <span className="text-sm text-gray-700 dark:text-slate-200">
                          Assign Broker (optional)
                        </span>
                        <select
                          value={form.brokerOrgId}
                          onChange={(e) =>
                            setForm({ ...form, brokerOrgId: e.target.value })
                          }
                          className="w-full px-3 py-2 mt-1 border rounded-md bg-white text-gray-900
                border-gray-300
                dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                        >
                          <option value="">No broker (none)</option>
                          {loadingBrokers && (
                            <option value="" disabled>
                              Loading brokers...
                            </option>
                          )}
                          {!loadingBrokers &&
                            brokers.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                                {b.email ? ` (${b.email})` : ""}
                              </option>
                            ))}
                        </select>

                        {brokersError && (
                          <div className="text-xs text-red-500 mt-1">
                            {brokersError}
                          </div>
                        )}
                      </label>
                    </div>

                    {/* ================= ERRORS ================= */}
                    {formError && (
                      <div className="text-sm text-red-600">{formError}</div>
                    )}

                    {/* ================= ACTIONS ================= */}
                    <div className="flex justify-end gap-3 pt-3">
                      {/* <button
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md
              dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button> */}
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-4 py-2 bg-[#13538A] text-white rounded-md hover:bg-blue-700 disabled:opacity-70"
                      >
                        {submitting ? "Creating..." : "Create Lender"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Lender Details Modal */}
            <LenderDetailsModal
              lender={viewingLender}
              apiBase={API_BASE}
              onClose={() => setViewingLender(null)}
            />

            <TransferLenderPortalModal
              lender={transferringLender}
              apiBase={API_BASE}
              onClose={() => setTransferringLender(null)}
              onTransferred={() => {
                fetchLenders();
              }}
            />

            {/* Edit Lender Modal */}
            {editingLender && (
              <EditLenderModal
                isOpen={true}
                lender={editingLender}
                brokers={brokers}
                onClose={() => setEditingLender(null)}
                onSave={handleEditSave}
              />
            )}

            {/* Admins Modal (with inline edit) */}
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
                        No admins found for this lender.
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
                                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold
              hover:bg-blue-700 transition disabled:opacity-70"
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
                      className="px-4 py-2 bg-gray-100 rounded-md
                           dark:bg-slate-800 dark:text-slate-100"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {showAssignPopup && newCreatedLenderId && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <LenderProductAssign
              lenderId={newCreatedLenderId}
              onClose={() => {}} // disabled
              onSuccess={async () => {
                setShowAssignPopup(false);
                setNewCreatedLenderId(null);
                await fetchLenders();
              }}
            />
          </div>
        </div>
      )}

      {isInviteOpen && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl">
            {/* HEADER */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#13538A] text-white">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Users size={18} />
                Invite Lender
              </h2>

              <button
                onClick={() => setIsInviteOpen(false)}
                className="text-white/80 hover:text-red-500 text-lg"
              >
                ✕
              </button>
            </div>

            {/* BODY */}
            <div className="p-6 space-y-5">
              {inviteApiError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-lg">
                  {inviteApiError}
                </div>
              )}

              {/* Company */}
              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Company Name
                </label>

                <div className="relative mt-1">
                  <Building2
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="text"
                    value={inviteForm.companyName}
                    onChange={(e) => {
                      setInviteForm({
                        ...inviteForm,
                        companyName: e.target.value,
                      });
                      setInviteErrors({ ...inviteErrors, companyName: "" });
                    }}
                    placeholder="Enter company name"
                    className={`w-full pl-9 pr-3 py-2.5 rounded-lg border
      ${inviteErrors.companyName ? "border-red-500" : "border-slate-300"}
      dark:border-slate-600
      bg-white dark:bg-slate-800
      text-slate-900 dark:text-white`}
                  />
                </div>

                {inviteErrors.companyName && (
                  <p className="text-red-500 text-xs mt-1">
                    {inviteErrors.companyName}
                  </p>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Full Name
                </label>

                <div className="relative mt-1">
                  <Users
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="text"
                    value={inviteForm.fullName}
                    onChange={(e) => {
                      setInviteForm({
                        ...inviteForm,
                        fullName: e.target.value,
                      });
                      setInviteErrors({ ...inviteErrors, name: "" });
                    }}
                    placeholder="Enter lender name"
                    className={`w-full pl-9 pr-3 py-2.5 rounded-lg border
      ${inviteErrors.name ? "border-red-500" : "border-slate-300"}
      dark:border-slate-600
      bg-white dark:bg-slate-800
      text-slate-900 dark:text-white`}
                  />
                </div>

                {inviteErrors.name && (
                  <p className="text-red-500 text-xs mt-1">
                    {inviteErrors.name}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Email Address
                </label>

                <div className="relative mt-1">
                  <Mail
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => {
                      setInviteForm({ ...inviteForm, email: e.target.value });
                      setInviteErrors({ ...inviteErrors, email: "" });
                    }}
                    placeholder="example@email.com"
                    className={`w-full pl-9 pr-3 py-2.5 rounded-lg border
      ${inviteErrors.email ? "border-red-500" : "border-slate-300"}
      dark:border-slate-600
      bg-white dark:bg-slate-800
      text-slate-900 dark:text-white`}
                  />
                </div>
                {inviteErrors.email && (
                  <p className="text-red-500 text-xs mt-1">
                    {inviteErrors.email}
                  </p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Phone Number
                </label>

                <div className="relative mt-1">
                  <Phone
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="text"
                    value={inviteForm.phone}
                    onChange={(e) => {
                      const formatted = formatUSPhone(e.target.value);

                      setInviteForm({
                        ...inviteForm,
                        phone: formatted,
                      });

                      setInviteErrors({
                        ...inviteErrors,
                        phone: "",
                      });
                    }}
                    placeholder="222-222-2222"
                    maxLength={12}
                    className={`w-full pl-9 pr-3 py-2.5 rounded-lg border
  ${inviteErrors.phone ? "border-red-500" : "border-slate-300"}
  dark:border-slate-600
  bg-white dark:bg-slate-800
  text-slate-900 dark:text-white
  focus:outline-none focus:ring-2 focus:ring-indigo-500/40`}
                  />
                </div>
                {inviteErrors.phone && (
                  <p className="text-red-500 text-xs mt-1">
                    {inviteErrors.phone}
                  </p>
                )}
              </div>

              {/* ACTIONS */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setIsInviteOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium
            border border-slate-300 dark:border-slate-600
            text-slate-600 dark:text-slate-300
            hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>

                <button
                  onClick={handleInvite}
                  disabled={inviteLoading}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white
  bg-[#13538A]
  hover:bg-[#0f4370]
  shadow-lg shadow-indigo-500/20
  active:scale-95 transition disabled:opacity-60"
                >
                  {inviteLoading ? "Sending..." : "Send Invite"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isBulkInviteOpen && (
        <BulkInviteLendersModal
          apiBase={API_BASE}
          getAuthHeaders={getAuthHeaders}
          onClose={() => setIsBulkInviteOpen(false)}
          onComplete={() => { 
            setListView("invites");
            setInviteListKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
