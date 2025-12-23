import React, { useEffect, useMemo, useState } from "react";
import { MdModeEdit, MdDelete } from "react-icons/md";
import { TiPlus } from "react-icons/ti";
import EditBrokerModal from "../Brokers/EditBrokerModal"; // you can reuse this for lenders too
import toast from "react-hot-toast";

type Lender = {
  id: any; // keep flexible because API returns UUID string; UI can still treat as string/number
  name: string;
  email: string;
  phone: string;
  status?: string;
  createdAt?: string;
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

type LoanProductForm = {
  loanProductCode: string;
  minLoanAmount: number;
  maxLoanAmount: number;
  minTermMonths: number;
  maxTermMonths: number;
  regionsSupported: string[];
  industriesSupported: string[];
};

type LoanProductList = {
  id: string;
  lenderOrgId: string;
  loanProductId: string;
  loanProductCode: string;
  loanProductName: string;
  minLoanAmount: number;
  maxLoanAmount: number;
  minTermMonths: number;
  maxTermMonths: number;
  industriesSupported: string;
  regionsSupported: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const parseArray = (value?: string) => {
  try {
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
};


const STATUS_ORDER = ["ACTIVE", "INACTIVE"]; // keep real backend enum

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

// keep options in sync with Prisma enum LoanProductCode
const LOAN_PRODUCT_CODES: { value: string; label: string }[] = [
  { value: "SBA", label: "SBA" },
  { value: "USDA", label: "USDA" },
  { value: "BRIDGE", label: "Bridge" },
  { value: "DSCR", label: "DSCR" },
  { value: "CONSTRUCTION", label: "Construction" },
  { value: "EQUIPMENT", label: "Equipment" },
  { value: "ASSET_BASED", label: "Asset Based" },
  { value: "AR_AP", label: "AR/AP" },
  { value: "PO_FINANCE", label: "PO Finance" },
];

export default function AllLendersPage() {
  const [lenders, setLenders] = useState<LoanProductList[]>([]);
  const [loading, setLoading] = useState(false);
  const [rowLoadingId, setRowLoadingId] = useState<any | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState<LoanProductForm>({
    loanProductCode: "",
    minLoanAmount: 0,
    maxLoanAmount: 0,
    minTermMonths: 0,
    maxTermMonths: 0,
    regionsSupported: [],
    industriesSupported: []
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editingLender, setEditingLender] = useState<LoanProductList | null>(null);

  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState<number>(10);
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

  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001"; // adjust if needed

  useEffect(() => {
    fetchLoanProducts();
    // fetchBrokers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, pageSize]);

  function getAuthHeaders(): Record<string, string> {
    try {
      const token = sessionStorage.getItem("lending_token");
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

  // -------- LENDERS LIST --------
  async function fetchLoanProducts() {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/lender/loan-products/list`, {
        method: "GET",
        headers,
      });

      if (!res.ok) throw new Error(`Failed to fetch loan products: ${res.status}`);

      const json = await res.json();

      const list = Array.isArray(json)
        ? json
        : json.data?.results || json.data || [];

      setLenders(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // -------- BROKERS (for dropdown) --------
  // async function fetchBrokers() {
  //   setLoadingBrokers(true);
  //   setBrokersError(null);
  //   try {
  //     const headers = getAuthHeaders();
  //     const res = await fetch(`${API_BASE}/admin/brokers/read/`, {
  //       method: "GET",
  //       headers,
  //     });

  //     if (!res.ok) throw new Error(`Failed to fetch brokers: ${res.status}`);

  //     const json = await res.json();
  //     const list = Array.isArray(json)
  //       ? json
  //       : json.data?.results || json.data || [];

  //     const normalized: BrokerOrg[] = (list as any[]).map(
  //       (b: any, idx: number) => ({
  //         id: b.id ?? String(idx + 1),
  //         name: b.name ?? b.organizationName ?? "Unnamed Broker",
  //         email: b.email ?? b.organizationEmail ?? "",
  //       })
  //     );

  //     setBrokers(normalized);
  //   } catch (err: any) {
  //     console.error("fetchBrokers error:", err);
  //     setBrokersError(err?.message || "Failed to load brokers");
  //   } finally {
  //     setLoadingBrokers(false);
  //   }
  // }

  const openAdd = () => {
    setForm({
      loanProductCode: "",
      minLoanAmount: 0,
      maxLoanAmount: 0,
      minTermMonths: 0,
      maxTermMonths: 0,
      regionsSupported: [],
      industriesSupported: []
    });
    setFormError(null);
    setIsAddOpen(true);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setFormError(null);

    if (
      !form.loanProductCode ||
      !form.minLoanAmount ||
      !form.maxLoanAmount ||
      !form.minTermMonths ||
      !form.maxTermMonths ||
      !form.regionsSupported ||
      !form.industriesSupported
    ) {
      setFormError(
        "Please fill required fields."
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        loanProductCode: form.loanProductCode,
        minLoanAmount: form.minLoanAmount,
        maxLoanAmount: form.maxLoanAmount,
        minTermMonths: form.minTermMonths,
        maxTermMonths: form.maxTermMonths,
        regionsSupported: form.regionsSupported,
        industriesSupported: form.industriesSupported,
      }

      const headers = getAuthHeaders();

      const res = await fetch(`${API_BASE}/lender/loan-products/create`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.message || "Failed to create loan product")
        setFormError(json?.message || `Server returned ${res.status}`);
        return;
      } else {
        toast.success(json.message || "Loan product created successfully")
      }

      setIsAddOpen(false);
      await fetchLoanProducts();
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lenders;
    return lenders.filter((b) => {
      return (
        (b.loanProductCode || "").toLowerCase().includes(q)
      );
    });
  }, [lenders, query]);

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

  const openEditModal = (b: LoanProductList) => {
    setEditingLender(b);
  };

  const toDbValue = (v: any) =>
    Array.isArray(v) ? JSON.stringify(v) : v;

  const handleEditSave = async (updated: LoanProductList) => {
    console.log(updated)
    setLenders((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setEditingLender(null);

    try {
      const token = sessionStorage.getItem("lending_token");
      const res = await fetch(`${API_BASE}/lender/loan-products/update/${updated.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          minLoanAmount: updated.minLoanAmount,
          maxLoanAmount: updated.maxLoanAmount,
          minTermMonths: updated.minTermMonths,
          maxTermMonths: updated.maxTermMonths,
          regionsSupported: toDbValue(updated.regionsSupported),
          industriesSupported: toDbValue(updated.industriesSupported),
          isActive: true
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message || "Update failed");
        return;
      }

      toast.success("Loan product updated");
      await fetchLoanProducts();
    } catch (err) {
      console.error("Failed to persist loan product update:", err);
    }
  };

  // const changeStatusFor = async (lender: Lender) => {
  //   if (!lender?.id) return;
  //   const cur = (lender.status || "UNKNOWN").toUpperCase();
  //   const idx = STATUS_ORDER.indexOf(cur);
  //   const next =
  //     idx === -1 ? "ACTIVE" : STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];

  //   const prevStatus = lender.status;
  //   setLenders((prev) =>
  //     prev.map((b) => (b.id === lender.id ? { ...b, status: next } : b))
  //   );
  //   setRowLoadingId(lender.id);

  //   try {
  //     const token = sessionStorage.getItem("admin_token");

  //     const path =
  //       next === "ACTIVE"
  //         ? `${API_BASE}/admin/lenders/status/activate/${lender.id}`
  //         : `${API_BASE}/admin/lenders/status/deactivate/${lender.id}`;

  //     const res = await fetch(path, {
  //       method: "PATCH",
  //       headers: {
  //         "Content-Type": "application/json",
  //         ...(token ? { Authorization: `Bearer ${token}` } : {}),
  //       },
  //     });

  //     const json = await res.json().catch(() => ({}));
  //     if (!res.ok || json?.success === false) {
  //       const msg =
  //         json?.message ||
  //         (res.status === 400
  //           ? "Cannot change status for this lender (likely assigned to brokers)."
  //           : `Status update failed: ${res.status}`);
  //       throw new Error(msg);
  //     }

  //     if (json && json.data) {
  //       const serverObj = json.data;
  //       setLenders((prev) =>
  //         prev.map((b) =>
  //           b.id === lender.id
  //             ? {
  //               ...b,
  //               name: serverObj.name ?? b.name,
  //               status: serverObj.status ?? next,
  //             }
  //             : b
  //         )
  //       );
  //     }
  //   } catch (err: any) {
  //     console.error(err);
  //     setLenders((prev) =>
  //       prev.map((b) =>
  //         b.id === lender.id ? { ...b, status: prevStatus } : b
  //       )
  //     );
  //     alert(err?.message || "Failed to update status. Please try again.");
  //   } finally {
  //     setRowLoadingId(null);
  //   }
  // };

  // ------------------------------
  // Fetch admins for a lender id
  // ------------------------------
  // async function fetchAdmins(lenderId: any) {
  //   setLoadingAdmins(true);
  //   setAdmins([]);
  //   setAdminsError(null);

  //   try {
  //     const token = sessionStorage.getItem("admin_token");
  //     const res = await fetch(`${API_BASE}/admin/lenders/read/${lenderId}`, {
  //       method: "GET",
  //       headers: {
  //         "Content-Type": "application/json",
  //         ...(token ? { Authorization: `Bearer ${token}` } : {}),
  //       },
  //     });

  //     if (!res.ok) throw new Error(`Failed to load lender admins: ${res.status}`);

  //     const json = await res.json().catch(() => ({}));
  //     const org = json?.data?.organization;
  //     const adminUser = json?.data?.adminUser;

  //     let adminList: any[] = [];

  //     if (Array.isArray(org?.users) && org.users.length > 0) {
  //       adminList = org.users;
  //     } else if (adminUser) {
  //       adminList = [adminUser];
  //     }

  //     const normalized: Admin[] = adminList.map((a: any) => ({
  //       id: a.id,
  //       firstName: a.firstName ?? "",
  //       lastName: a.lastName ?? "",
  //       email: a.email ?? "",
  //       phone: a.phone ?? "",
  //     }));

  //     setAdmins(normalized);
  //   } catch (err: any) {
  //     console.error("fetchAdmins error:", err);
  //     setAdminsError(err?.message || "Failed to load admins");
  //   } finally {
  //     setLoadingAdmins(false);
  //   }
  // }

  // const openAdminsFor = async (lender: Lender) => {
  //   setShowAdminsFor(lender);
  //   setEditingAdminId(null);
  //   setAdminEditForm({});
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

  // const saveAdminEdit = async () => {
  //   const adminId = editingAdminId;
  //   if (!adminId) return alert("No admin selected for edit.");

  //   if (
  //     !(
  //       adminEditForm.firstName ||
  //       adminEditForm.lastName ||
  //       adminEditForm.email
  //     )
  //   ) {
  //     return alert(
  //       "Please provide at least one field to update (first name / last name / email)."
  //     );
  //   }

  //   setAdminSaving(true);

  //   setAdmins((prev) =>
  //     prev.map((p) => (p.id === adminId ? { ...p, ...adminEditForm } : p))
  //   );

  //   try {
  //     const token = sessionStorage.getItem("admin_token");
  //     const res = await fetch(
  //       `${API_BASE}/admin/lenders/admin/update/${adminId}`,
  //       {
  //         method: "PATCH",
  //         headers: {
  //           "Content-Type": "application/json",
  //           ...(token ? { Authorization: `Bearer ${token}` } : {}),
  //         },
  //         body: JSON.stringify({
  //           firstName: adminEditForm.firstName,
  //           lastName: adminEditForm.lastName,
  //           email: adminEditForm.email,
  //           phone: adminEditForm.phone,
  //         }),
  //       }
  //     );

  //     if (!res.ok) {
  //       throw new Error(`Save failed: ${res.status}`);
  //     }

  //     const json = await res.json().catch(() => ({}));
  //     if (json && json.data) {
  //       const serverObj = json.data;
  //       setAdmins((prev) =>
  //         prev.map((p) => (p.id === adminId ? { ...p, ...serverObj } : p))
  //       );
  //     }

  //     setEditingAdminId(null);
  //     setAdminEditForm({});
  //   } catch (err: any) {
  //     console.error("saveAdminEdit error:", err);
  //     alert(err?.message || "Failed to save admin. Changes rolled back.");
  //     if (showAdminsFor?.id) {
  //       await fetchAdmins(showAdminsFor.id);
  //     }
  //   } finally {
  //     setAdminSaving(false);
  //   }
  // };

  function toggleChip(
    key: "regionsSupported" | "industriesSupported",
    value: string
  ) {
    setForm((prev) => {
      const set = new Set(prev[key]);
      set.has(value) ? set.delete(value) : set.add(value);
      return { ...prev, [key]: Array.from(set) };
    });
  }


  return (
    <div className="px-6 py-6 text-gray-900 dark:text-gray-100">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Loan Products
          </h1>
          <p className="text-sm text-gray-500 mt-1 dark:text-slate-400">
            Manage global loan products available on the platform.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              placeholder="Search by name, email, phone or status"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="px-3 py-2 border rounded-md w-64 focus:outline-none focus:ring-1 focus:ring-blue-500
                         border-gray-300 bg-white text-gray-900
                         dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100
                         placeholder-gray-400 dark:placeholder-slate-400"
              aria-label="Search lenders"
            />
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2 py-2 border rounded-md bg-white text-gray-900
                         border-gray-300
                         dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
              aria-label="Page size"
            >
              <option value={5}>5 / page</option>
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
            </select>
          </div>

          <button
            onClick={openAdd}
            className="inline-flex items-center whitespace-nowrap px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            type="button"
            aria-label="Add Lender"
          >
            <TiPlus className="mr-2" />
            Add Loan
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-700">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-500 dark:text-slate-400">
            Loading loan products...
          </div>
        ) : total === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500 dark:text-slate-400">
            No Loan Products found.
          </div>
        ) : (
          <>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide dark:border-slate-700 dark:text-slate-400">
                    <th className="py-2 pr-4 text-left">Loan Product</th>
                    <th className="py-2 pr-4 text-left">Min Amount</th>
                    <th className="py-2 pr-4 text-left">Max Amount</th>
                    <th className="py-2 pr-4 text-left">Tenure</th>
                    <th className="py-2 pr-4 text-left">Industries</th>
                    <th className="py-2 pr-4 text-left">Regions</th>
                    <th className="py-2 pr-4 text-left">Status</th>
                    <th className="py-2 pr-4 text-left">Created</th>
                    <th className="py-2 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((b) => {
                    const isLoading = rowLoadingId === b.id;
                    const industries = parseArray(b.industriesSupported);
                    const regions = parseArray(b.regionsSupported);

                    return (
                      <tr
                        key={b.id}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50/40 dark:border-slate-800 dark:hover:bg-slate-800/60"
                      >
                        <td className="py-3 pr-4 text-gray-900 whitespace-nowrap dark:text-gray-100">
                          {b.loanProductCode}
                        </td>

                        <td className="py-3 pr-4 text-gray-600 whitespace-nowrap dark:text-slate-300">
                          {b.minLoanAmount}
                        </td>
                        <td className="py-3 pr-4 text-gray-600 whitespace-nowrap dark:text-slate-300">
                          {b.maxLoanAmount}
                        </td>

                        <td className="py-3 pr-4 text-gray-600 whitespace-nowrap dark:text-slate-300">
                          {b.minTermMonths} - {b.maxTermMonths} months
                        </td>

                        <td className="py-3 pr-4 text-gray-600 whitespace-nowrap dark:text-slate-300">
                          {industries.join(", ")}
                        </td>

                        <td className="py-3 pr-4 text-gray-600 whitespace-nowrap dark:text-slate-300">
                          {regions.join(", ")}
                        </td>

                        <td className="py-3 pr-4 whitespace-nowrap">
                          <button
                            // onClick={() => !isLoading && changeStatusFor(b)}
                            disabled={isLoading}
                            className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-full border ${statusClass(
                              b.isActive ? "ACTIVE" : "INACTIVE"
                            )} disabled:opacity-60`}
                            title="Click to change status"
                            aria-label={`Change status for ${b.isActive}`}
                          >
                            {isLoading ? (
                              <svg
                                className="h-3 w-3 animate-spin"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  fill="none"
                                  className="opacity-25"
                                ></circle>
                                <path
                                  fill="currentColor"
                                  className="opacity-75"
                                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                />
                              </svg>
                            ) : null}
                            <span> {b.isActive ? "ACTIVE" : "INACTIVE"}</span>
                          </button>
                        </td>

                        <td className="py-3 pr-4 text-gray-600 whitespace-nowrap dark:text-slate-300">
                          {b.createdAt
                            ? new Date(b.createdAt).toLocaleDateString()
                            : "-"}
                        </td>

                        <td className="py-3 pr-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              disabled={isLoading}
                              onClick={() => openEditModal(b)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-40
                                         dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                              aria-label={`Edit ${b.loanProductCode}`}
                            >
                              <MdModeEdit />
                            </button>

                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-sm text-gray-600 dark:text-slate-300">
                Showing{" "}
                <span className="font-medium">
                  {(currentPage - 1) * pageSize + 1}
                </span>{" "}
                -{" "}
                <span className="font-medium">
                  {Math.min(currentPage * pageSize, total)}
                </span>{" "}
                of <span className="font-medium">{total}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => gotoPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border rounded-md disabled:opacity-40
                             border-gray-300 bg-white text-gray-800
                             dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  Prev
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }).map(
                    (_, i) => {
                      const half = Math.floor(5 / 2);
                      let start = 1;
                      if (totalPages <= 5) start = 1;
                      else if (currentPage <= half + 1) start = 1;
                      else if (currentPage >= totalPages - half)
                        start = totalPages - 4;
                      else start = currentPage - half;

                      const page = start + i;
                      if (page > totalPages) return null;
                      return (
                        <button
                          key={page}
                          onClick={() => gotoPage(page)}
                          className={`px-3 py-1 rounded-md ${page === currentPage
                            ? "bg-blue-600 text-white"
                            : "border border-gray-300 bg-white text-gray-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            }`}
                        >
                          {page}
                        </button>
                      );
                    }
                  )}
                </div>

                <button
                  onClick={() => gotoPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border rounded-md disabled:opacity-40
                             border-gray-300 bg-white text-gray-800
                             dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>


      {/* Add Lender Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-500000 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-lg dark:bg-slate-900 dark:border dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Create Loan Product
              </h2>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Close
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 md:grid-cols-2 gap-3"
            >
              {/* 🔹 loanProductCode dropdown */}
              <label className="block md:col-span-2">
                <span className="text-sm text-gray-700 dark:text-slate-200">
                  Loan Product Code
                </span>
                <select
                  value={form.loanProductCode}
                  onChange={(e) =>
                    setForm({ ...form, loanProductCode: e.target.value })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md bg-white text-gray-900
                             border-gray-300
                             dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                >
                  <option value="">No Loan Product Code (none)</option>
                  {!LOAN_PRODUCT_CODES && (
                    <option value="" disabled>
                      Loading products...
                    </option>
                  )}
                  {LOAN_PRODUCT_CODES &&
                    LOAN_PRODUCT_CODES.map((p, i) => (
                      <option key={i} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                </select>
                {brokersError && (
                  <div className="text-xs text-red-500 mt-1">
                    {brokersError}
                  </div>
                )}
              </label>
              <label className="block">
                <span className="text-sm text-gray-700 dark:text-slate-200">
                  Min Loan Amount
                </span>
                <input
                  type="number"
                  value={form.minLoanAmount}
                  onChange={(e) =>
                    setForm({ ...form, minLoanAmount: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md
                             border-gray-300 bg-white text-gray-900
                             dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-700 dark:text-slate-200">
                  Max Loan Amount
                </span>
                <input
                  type="number"
                  value={form.maxLoanAmount}
                  onChange={(e) =>
                    setForm({ ...form, maxLoanAmount: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md
                             border-gray-300 bg-white text-gray-900
                             dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-700 dark:text-slate-200">
                  Min Term Months
                </span>
                <input
                  type="number"
                  value={form.minTermMonths}
                  onChange={(e) =>
                    setForm({ ...form, minTermMonths: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md
                             border-gray-300 bg-white text-gray-900
                             dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                />
              </label>

              <label className="block">
                <span className="text-sm text-gray-700 dark:text-slate-200">
                  Max Term Months
                </span>
                <input
                  type="number"
                  value={form.maxTermMonths}
                  onChange={(e) =>
                    setForm({ ...form, maxTermMonths: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 mt-1 border rounded-md
                             border-gray-300 bg-white text-gray-900
                             dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                />
              </label>

              <div>
                <label className="block text-sm text-gray-700">Regions Supported</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["CA", "TX", "FL", "NY", "NJ"].map((r) => (
                    <button type="button" key={r} onClick={() => toggleChip("regionsSupported", r)} className={`px-3 py-1 rounded-full border ${form.regionsSupported.includes(r) ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700">Industries Supported</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["Real Estate", "Hospitality"].map((r) => (
                    <button type="button" key={r} onClick={() => toggleChip("industriesSupported", r)} className={`px-3 py-1 rounded-full border ${form.industriesSupported.includes(r) ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {formError && (
                <div className="text-sm text-red-600 col-span-2">
                  {formError}
                </div>
              )}

              <div className="col-span-2 flex justify-end gap-3 mt-2">
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-70"
                >
                  {submitting ? "Creating..." : "Create Loan Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Lender Modal (reusing EditBrokerModal for now) */}
      {editingLender && (
        <EditBrokerModal
          isOpen={Boolean(editingLender)}
          loanProduct={editingLender as any}
          onClose={() => setEditingLender(null)}
          onSave={handleEditSave as any}
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
                      className="border rounded p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3
                                 border-gray-200 bg-white
                                 dark:border-slate-700 dark:bg-slate-900"
                    >
                      <div className="flex-1">
                        {editingAdminId === a.id ? (
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            <input
                              value={adminEditForm.firstName || ""}
                              onChange={(e) =>
                                setAdminEditForm({
                                  ...adminEditForm,
                                  firstName: e.target.value,
                                })
                              }
                              className="px-2 py-1 border rounded
                                         border-gray-300 bg-white text-gray-900
                                         dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                              placeholder="First name"
                            />
                            <input
                              value={adminEditForm.lastName || ""}
                              onChange={(e) =>
                                setAdminEditForm({
                                  ...adminEditForm,
                                  lastName: e.target.value,
                                })
                              }
                              className="px-2 py-1 border rounded
                                         border-gray-300 bg-white text-gray-900
                                         dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                              placeholder="Last name"
                            />
                            <input
                              value={adminEditForm.email || ""}
                              onChange={(e) =>
                                setAdminEditForm({
                                  ...adminEditForm,
                                  email: e.target.value,
                                })
                              }
                              className="px-2 py-1 border rounded col-span-1 md:col-span-1
                                         border-gray-300 bg-white text-gray-900
                                         dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                              placeholder="Email"
                            />
                            <input
                              value={adminEditForm.phone || ""}
                              onChange={(e) =>
                                setAdminEditForm({
                                  ...adminEditForm,
                                  phone: e.target.value,
                                })
                              }
                              className="px-2 py-1 border rounded
                                         border-gray-300 bg-white text-gray-900
                                         dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100"
                              placeholder="Phone"
                            />
                          </div>
                        ) : (
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              {(a.firstName || "") +
                                (a.lastName ? ` ${a.lastName}` : "") ||
                                "—"}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-slate-300">
                              {a.email || "-"}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-sm text-gray-600 dark:text-slate-300">
                          {a.phone || "-"}
                        </div>

                        {editingAdminId === a.id ? (
                          <>
                            <button
                              onClick={saveAdminEdit}
                              disabled={adminSaving}
                              className="px-3 py-1 bg-blue-600 text-white rounded-md disabled:opacity-70"
                            >
                              {adminSaving ? "Saving..." : "Save"}
                            </button>
                            <button
                              onClick={cancelEditAdmin}
                              disabled={adminSaving}
                              className="px-3 py-1 border rounded-md
                                         border-gray-300 bg-white text-gray-800
                                         dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEditAdmin(a)}
                              className="px-2 py-1 border rounded-md text-sm
                                         border-gray-300 bg-white text-gray-800
                                         dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            >
                              Edit
                            </button>
                          </>
                        )}
                      </div>
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
    </div>
  );
}
