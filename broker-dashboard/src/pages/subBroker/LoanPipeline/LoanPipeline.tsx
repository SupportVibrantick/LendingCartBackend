import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import toast from "react-hot-toast";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import {
  Search,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  X,
  SearchX,
  Eye,
  FileText,
  Plus,
  DollarSign,
  Clock3,
  CheckCircle,
  UserRound,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { MdEdit } from "react-icons/md";
import PageMeta from "../../../components/common/PageMeta";
import { formatDocumentStatusLabel } from "../../../lib/documentStatus";
import {
  CO_BROKER_API_BASE,
  CO_BROKER_TOKEN_KEY,
  getCoBrokerAuthHeaders,
} from "../../../lib/coBrokerPortal";
import { getFixedMenuPosition } from "../../../lib/fixedMenuPosition";
import { formatUsDate } from "../../../lib/usDateFormat";
import { filterRowsByBorrowerName } from "../../../lib/pipelineNameSearch";

/* ================= TYPES ================= */

type SubmissionField = {
  fieldId: string | null;
  fieldKey: string | null;
  value: string;
  source: "STATIC" | "DYNAMIC";
};

type TableRow = {
  submissionId: string;
  applicationId: string;
  applicationNumber?: string;
  borrowerName: string;
  company: string;
  loanType: string;
  cityState: string;
  country: string;
  amount: number;
  status: string;
  date: string;
  pendingDocumentsCount?: number;

  assignedOfficerName: string | null;
  assignedOfficerImage: string | null;
  assignedLoanOfficers: AssignedPerson[];
};

type AssignedPerson = {
  id: string;
  name: string;
  profileImage?: string | null;
};

function AssigneePills({
  people,
  pillClassName,
  onShowAll,
  compact = false,
}: {
  people: AssignedPerson[];
  pillClassName: string;
  onShowAll?: (event: MouseEvent) => void;
  compact?: boolean;
}) {
  if (!people.length) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border bg-surface/60 px-2.5 py-1 text-[11px] font-medium text-text-secondary dark:border-slate-700 dark:bg-slate-800/60">
        <UserRound className="h-3.5 w-3.5 shrink-0 opacity-70" />
        Unassigned
      </span>
    );
  }

  const shown = people.slice(0, compact ? 3 : 1);
  const extra = people.length - shown.length;

  return (
    <div
      className="flex min-w-0 items-center gap-1"
      title={people.map((person) => person.name).join(", ")}
    >
      {compact ? (
        <>
          <div className="flex -space-x-1.5">
            {shown.map((person) => (
              <span
                key={person.id}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold ring-2 ring-white dark:ring-slate-900 ${pillClassName}`}
              >
                {getInitials(person.name)}
              </span>
            ))}
          </div>
          {extra > 0 ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onShowAll?.(event);
              }}
              className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${pillClassName}`}
            >
              +{extra}
            </button>
          ) : null}
        </>
      ) : (
        <>
          <span
            className={`inline-flex max-w-[9.5rem] items-center gap-1.5 truncate rounded-full px-1.5 py-0.5 text-xs font-medium ${pillClassName}`}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/70 text-[9px] font-bold">
              {getInitials(shown[0].name)}
            </span>
            <span className="truncate">{shown[0].name}</span>
          </span>
          {extra > 0 ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onShowAll?.(event);
              }}
              className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${pillClassName}`}
            >
              +{extra}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

/* ================= HELPERS ================= */
const API_BASE = CO_BROKER_API_BASE;

const STATUS_FILTERS = [
  { value: "", label: "All", statKey: "totalApplications" as const },
  {
    value: "CLIENT_PENDING",
    label: "Client Pending",
    statKey: "clientPending" as const,
  },
  { value: "INCOMPLETE", label: "Incomplete", statKey: "incomplete" as const },
  { value: "DRAFT", label: "Draft", statKey: "draft" as const },
  { value: "SUBMITTED", label: "Submitted", statKey: "submitted" as const },
  { value: "IN_REVIEW", label: "In Review", statKey: "inReview" as const },
  { value: "APPROVED", label: "Approved", statKey: "approved" as const },
  { value: "DECLINED", label: "Rejected", statKey: "rejected" as const },
];

function formatStatusLabel(status?: string) {
  if (!status) return "Unknown";
  if (status === "DECLINED") return "Rejected";
  if (status === "CLIENT_PENDING") return "Client Pending";
  if (status === "IN_REVIEW") return "In Review";
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getInitials(name?: string) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function formatShortDate(value?: string) {
  if (!value) return "Not provided";
  const formatted = formatUsDate(value);
  return formatted || "Not provided";
}

function formatLoanProduct(code?: string | null) {
  if (!code) return "Not provided";
  return code
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function displayName(value?: string | null) {
  const v = (value || "").trim();
  if (!v || v.toUpperCase() === "N/A") return "Untitled";
  return v;
}

function dealInitials(value?: string | null) {
  const name = displayName(value);
  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length) return "A";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function displayPlace(value?: string | null) {
  const v = (value || "").trim();
  if (!v || v.toUpperCase() === "N/A") return "";
  return v;
}

function getStatusColor(status?: string) {
  const s = status?.toLowerCase();

  switch (s) {
    case "new":
    case "sent":
    case "selected":
    case "in_review":
    case "submitted":
      return "bg-sky-100 text-sky-700 ring-sky-200";
    case "pending":
    case "conditional":
      return "bg-amber-100 text-amber-700 ring-amber-200";
    case "client_pending":
      return "bg-rose-100 text-rose-700 ring-rose-200";
    case "updated":
      return "bg-[#4C78F5]/10 text-[#3B66E0] ring-[#4C78F5]/25";
    case "approved":
    case "auto_approved":
    case "lender_approved":
      return "bg-emerald-100 text-emerald-700 ring-emerald-200";
    case "declined":
    case "rejected":
    case "auto_declined":
    case "withdrawn":
    case "lender_declined":
      return "bg-rose-100 text-rose-700 ring-rose-200";
    case "draft":
      return "bg-slate-100 text-slate-600 ring-slate-200";
    case "incomplete":
    case "superseded":
    case "suspended":
      return "bg-orange-100 text-orange-700 ring-orange-200";
    case "completed":
    case "funded":
      return "bg-emerald-100 text-emerald-700 ring-emerald-200";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

const parseValue = (val: string): any => {
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
};

const getFieldValue = (fields: SubmissionField[], key: string): any => {
  const field = fields.find((f) => f.fieldKey === key || f.fieldId === key);
  return field ? parseValue(field.value) : undefined;
};

function getAuthHeaders(): HeadersInit {
  return getCoBrokerAuthHeaders();
}

/* ================= COMPONENT ================= */
export default function LoanApplicationsPage() {
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pipelineStats, setPipelineStats] = useState({
    totalVolume: 0,
    totalApplications: 0,
    newApplications: 0,
    submitted: 0,
    clientPending: 0,
    approved: 0,
    rejected: 0,
    inReview: 0,
    draft: 0,
    incomplete: 0,
  });
  const [viewSubmissionId, setViewSubmissionId] = useState<string | null>(null);
  const [submissionDetail, setSubmissionDetail] = useState<any>(null);
  const [detailLoading] = useState<boolean>(false);

  // Find Lenders Modal State

  const [limit] = useState(6);

  // DOCUMENT MODAL STATE
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  // const [documentSubmissionId, setDocumentSubmissionId] = useState<
  //   string | null
  // >(null);
  const [documentsData, setDocumentsData] = useState<any>(null);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File[]>>(
    {},
  );
  const [previewFiles, setPreviewFiles] = useState<
    Record<string, { url: string; type: string; name: string }[]>
  >({});

  const [currentPage, setCurrentPage] = useState(1);

  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const [loiModalOpen, setLoiModalOpen] = useState(false);
  const [lois] = useState<any[]>([]);

  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  const [peopleModal, setPeopleModal] = useState<{
    open: boolean;
    title: string;
    roleLabel: string;
    people: AssignedPerson[];
  }>({
    open: false,
    title: "",
    roleLabel: "",
    people: [],
  });

  const [previewFile, setPreviewFile] = useState<{
    url: string;
    type: string;
    name: string;
  } | null>(null);

  const [docSelectModal, setDocSelectModal] = useState({
    isOpen: false,
    applicationId: "",
    documents: [],
    selectedDocs: [] as string[],
    loading: false,
  });
  const [requestMessage, setRequestMessage] = useState("");

  const navigate = useNavigate();

  const openPreview = (submissionId: string, row?: TableRow) => {
    const target = row || rows.find((r) => r.submissionId === submissionId);
    navigate("/sub-broker/loan-pipeline-preview", {
      state: {
        submissionId,
        applicationId: target?.applicationId,
        application: target,
      },
    });
  };

  const resumeIncomplete = (applicationId: string) => {
    navigate(`/sub-broker/loan-application?incompleteId=${applicationId}`);
  };

  const openApplicationRow = (row: TableRow) => {
    if (row.status === "INCOMPLETE" && row.applicationId) {
      resumeIncomplete(row.applicationId);
      return;
    }
    openPreview(row.submissionId, row);
  };

  const formatFieldKey = (key: string | null | undefined) => {
    if (!key) return "";

    let cleaned = key
      // remove coBorrower_1_, coBorrower_2_ etc
      .replace(/^coBorrower_\d+_/, "coBorrower_")
      // camelCase → camel Case
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      // snake_case → snake case
      .replace(/_/g, " ")
      // multiple spaces remove
      .replace(/\s+/g, " ")
      .trim()
      // capitalize each word
      .replace(/\b\w/g, (char) => char.toUpperCase());

    return cleaned;
  };

  // const fetchSubmissionDetail = async (submissionId: string) => {
  //   try {
  //     setDetailLoading(true);
  //     setViewSubmissionId(submissionId);

  //     const res = await fetch(
  //       `${API_BASE}/api/public/broker/applications/submissions/${submissionId}`,
  //     );
  //     const json = await res.json();

  //     if (!json.success) throw new Error("Failed to load submission");

  //     setSubmissionDetail(json.data);
  //   } catch (err: any) {
  //     toast.error(err.message || "Failed to load submission");
  //   } finally {
  //     setDetailLoading(false);
  //   }
  // };

  const formatCompactAmount = (value: number) => {
    if (!value || !isFinite(value)) return "$0";

    // Convert scientific notation safely
    const num = Number(value);

    if (num >= 1e9) return `$${(num / 1e9).toFixed(1).replace(/\.0$/, "")}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1).replace(/\.0$/, "")}K`;

    return `$${num}`;
  };

  const fetchSubmissionDocuments = async (submissionId: string) => {
    try {
      setDocumentsLoading(true);
      // setDocumentSubmissionId(submissionId);
      setDocumentModalOpen(true);

      const res = await fetch(
        `${API_BASE}/subbroker/documents/submissions/${submissionId}/documents`,
        {
          method: "GET",
          headers: getAuthHeaders(),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load documents");
      }

      setDocumentsData(json.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch documents");
    } finally {
      setDocumentsLoading(false);
    }
  };

  const loadSubmissions = async () => {
    try {
      setLoading(true);

      const url = new URL(`${API_BASE}/subbroker/loan-pipeline`);

      url.searchParams.set("page", String(currentPage));

      url.searchParams.set("limit", String(limit));

      if (debouncedSearch.trim()) {
        url.searchParams.set("search", debouncedSearch);
      }

      if (statusFilter) {
        url.searchParams.set("status", statusFilter);
      }

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: getAuthHeaders(),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to fetch applications");
      }

      setPagination(
        json.pagination || {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      );

      const formatted = json.data.map((item: any) => {
        const dynamic = item.dynamicFields || {};

        const city =
          item.propertyCity || dynamic.city || dynamic.propertyCity || "";

        const state =
          item.propertyState || dynamic.state || dynamic.propertyState || "";

        const country =
          item.propertyCountry ||
          dynamic.country ||
          dynamic.propertyCountry ||
          "";

        const borrowerName =
          [dynamic.borrowerFirstName, dynamic.borrowerLastName]
            .filter(Boolean)
            .join(" ")
            .trim() ||
          item.borrower ||
          "N/A";

        return {
          submissionId: item.submissionId || item.applicationId,

          applicationId: item.applicationId,

          applicationNumber: item.applicationNumber || "-",

          borrowerName,

          company: dynamic.companyName || "-",

          loanType:
            dynamic.loanProductCode ||
            item.loanProductCode ||
            item.loanInfo ||
            item.purpose ||
            "-",

          cityState: [city, state].filter(Boolean).join(", ") || "-",

          country: country || "-",

          amount: Number(item.amount || 0),

          status: item.status || "NEW",

          date: item.submittedOn || item.createdAt,

          pendingDocumentsCount: 0,

          assignedLoanOfficers: (() => {
            const fromList = Array.isArray(item.assignedLoanOfficers)
              ? item.assignedLoanOfficers
                  .map((officer: any) => ({
                    id: String(officer.id || ""),
                    name:
                      officer.name ||
                      `${officer.firstName || ""} ${
                        officer.lastName || ""
                      }`.trim(),
                    profileImage: officer.profileImage || null,
                  }))
                  .filter((officer: AssignedPerson) => officer.id && officer.name)
              : [];

            if (fromList.length) return fromList;

            if (item.assignedLoanOfficer) {
              const name =
                item.assignedLoanOfficer.name ||
                `${item.assignedLoanOfficer.firstName || ""} ${
                  item.assignedLoanOfficer.lastName || ""
                }`.trim();
              if (!name) return [];
              return [
                {
                  id: String(item.assignedLoanOfficer.id || name),
                  name,
                  profileImage: item.assignedLoanOfficer.profileImage || null,
                },
              ];
            }

            return [];
          })(),

          assignedOfficerName: item.assignedLoanOfficer
            ? item.assignedLoanOfficer.name ||
              `${item.assignedLoanOfficer.firstName || ""} ${
                item.assignedLoanOfficer.lastName || ""
              }`.trim()
            : null,

          assignedOfficerImage: item.assignedLoanOfficer?.profileImage || null,
        };
      });

      setRows(formatted);
    } catch (err: any) {
      console.error(err);

      toast.error(err.message || "Failed to load applications");
    } finally {
      setLoading(false);
    }
  };

  const fetchPipelineStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/subbroker/loan-pipeline/pipeline-stats`, {
        headers: getAuthHeaders(),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to fetch stats");
      }

      setPipelineStats(json.data);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleRefresh = () => {
    loadSubmissions();
    fetchPipelineStats();
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const filteredRows = useMemo(
    () => filterRowsByBorrowerName(rows, searchTerm),
    [rows, searchTerm],
  );

  const handleDocumentUpload = async (
    submissionId: string,
    requirementId: string,
  ) => {
    const files = selectedFiles[requirementId];

    if (!files || files.length === 0) {
      toast.error("Please select at least one file");
      return;
    }

    try {
      setUploadingDocId(requirementId);

      const token = sessionStorage.getItem(CO_BROKER_TOKEN_KEY);

      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(
          `${API_BASE}/subbroker/documents/submissions/${submissionId}/documents/${requirementId}/upload`,
          {
            method: "POST",
            headers: {
              ...(token && { Authorization: `Bearer ${token}` }),
            },
            body: formData,
          },
        );

        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.message || "Upload failed");
        }
      }

      toast.success("All documents uploaded successfully");

      // Reset after success
      setSelectedFiles((prev) => {
        const copy = { ...prev };
        delete copy[requirementId];
        return copy;
      });

      setPreviewFiles((prev) => {
        const copy = { ...prev };
        delete copy[requirementId];
        return copy;
      });

      await fetchSubmissionDocuments(submissionId);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingDocId(null);
    }
  };

  const Stat = ({ label, value }: { label: string; value: string }) => (
    <div>
      <p className="text-xs text-slate-500 uppercase">{label}</p>
      <p className="text-[14px] font-semibold text-[#4C78F5]">{value}</p>
    </div>
  );

  const getStatusChip = (status?: string) => {
    switch (status) {
      case "NEW":
        return "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400";

      case "SENT":
      case "SUBMITTED":
        return "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400";

      case "APPROVED":
      case "LENDER_APPROVED":
        return "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400";

      case "DECLINED":
      case "LENDER_DECLINED":
        return "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400";

      case "IN_REVIEW":
        return "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400";

      case "CLIENT_PENDING":
        return "bg-pink-100 text-pink-700 dark:bg-pink-500/10 dark:text-pink-400";

      case "DRAFT":
        return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";

      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300";
    }
  };

  useEffect(() => {
    loadSubmissions();
    fetchPipelineStats();
  }, [currentPage, debouncedSearch, statusFilter]);

  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!activeDropdown) return;

    const updatePos = () => {
      const btn = document.querySelector(
        `[data-id="${activeDropdown}"]`,
      ) as HTMLElement | null;

      if (!btn) return;

      setDropdownPos(
        getFixedMenuPosition(btn.getBoundingClientRect(), {
          width: 192,
          height: dropdownRef.current?.offsetHeight || 200,
        }),
      );
    };

    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);

    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [activeDropdown]);

  // useEffect(() => {
  //   const storedRoles = JSON.parse(sessionStorage.getItem("roles") || "[]");
  //   setRoles(storedRoles);
  // }, []);

  // const isBrokerOfficer = roles.includes("BROKER_OFFICER");

  // const fetchDocumentTypes = async (applicationId: string) => {
  //   try {
  //     const brokerToken = sessionStorage.getItem("sub_broker_token");

  //     setDocSelectModal({
  //       isOpen: true,
  //       applicationId,
  //       documents: [],
  //       selectedDocs: [],
  //       loading: true,
  //     });

  //     const res = await fetch(`${API_BASE}/document-types/active`, {
  //       method: "GET",
  //       headers: {
  //         "Content-Type": "application/json",
  //         ...(brokerToken && {
  //           Authorization: `Bearer ${brokerToken}`,
  //         }),
  //       },
  //     });

  //     const json = await res.json();

  //     if (!res.ok || !json.success) {
  //       throw new Error(json.message || "Failed to fetch document types");
  //     }

  //     const formattedDocs = json.data.map((doc: any) => ({
  //       documentTypeId: doc.id,
  //       documentType: {
  //         name: doc.name,
  //       },
  //     }));

  //     setDocSelectModal({
  //       isOpen: true,
  //       applicationId,
  //       documents: formattedDocs,
  //       selectedDocs: [],
  //       loading: false,
  //     });
  //   } catch (err: any) {
  //     toast.error(err.message || "Failed to load documents");

  //     // FIX: stop loading
  //     setDocSelectModal((prev) => ({
  //       ...prev,
  //       loading: false,
  //     }));
  //   }
  // };

  const handleRequestDocuments = async () => {
    try {
      const brokerToken = sessionStorage.getItem(CO_BROKER_TOKEN_KEY);

      if (!brokerToken) {
        toast.error("Unauthorized");
        return;
      }

      if (docSelectModal.selectedDocs.length === 0) {
        toast.error("Please select at least one document");
        return;
      }

      const url = `${API_BASE}/subbroker/documents/${docSelectModal.applicationId}/request-documents`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${brokerToken}`,
        },
        body: JSON.stringify({
          documentTypeIds: docSelectModal.selectedDocs,
          message: requestMessage || "Please upload these documents urgently",
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to request documents");
      }

      toast.success("Documents requested successfully");

      // CLOSE MODAL
      setDocSelectModal({
        isOpen: false,
        applicationId: "",
        documents: [],
        selectedDocs: [],
        loading: false,
      });

      // OPTIONAL: refresh table
      // fetchApplications();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    }
  };

  return (
    <>
      <PageMeta
        title="Loan Pipeline | Co-Broker Portal"
        description="Track and manage assigned loan applications"
      />

      <div className="w-full min-w-0 space-y-4 text-text-primary dark:text-slate-100">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="ds-page-title">Loan Pipeline</h1>
            <p className="ds-page-subtitle">
              Review and open every deal assigned to you.
              {pipelineStats.totalApplications > 0 ? (
                <>
                  {" "}
                  <span className="font-semibold text-brand-500">
                    {pipelineStats.totalApplications}
                  </span>{" "}
                  total application
                  {pipelineStats.totalApplications === 1 ? "" : "s"}.
                </>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="ds-btn-secondary h-9 px-3 text-xs disabled:opacity-60"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => navigate("/sub-broker/loan-application")}
              className="ds-btn-primary h-9 px-3 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              New Application
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {[
            {
              label: "Total Volume",
              value: formatCompactAmount(pipelineStats.totalVolume),
              icon: DollarSign,
              tone: "bg-emerald-50 text-emerald-600",
            },
            {
              label: "Needs Review",
              value: pipelineStats.inReview + pipelineStats.submitted,
              icon: Clock3,
              tone: "bg-amber-50 text-amber-600",
            },
            {
              label: "Approved",
              value: pipelineStats.approved,
              icon: CheckCircle,
              tone: "bg-brand-50 text-brand-600",
            },
            {
              label: "In Pipeline",
              value: pipelineStats.totalApplications,
              icon: FileText,
              tone: "bg-sky-50 text-sky-600",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-border bg-white px-3.5 py-3 dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                    {card.label}
                  </p>
                  <p className="mt-1 truncate text-xl font-bold tabular-nums leading-none text-text-primary dark:text-white">
                    {card.value}
                  </p>
                </div>
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${card.tone}`}
                >
                  <card.icon className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-2.5 border-b border-border px-4 py-3.5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-center lg:min-w-0 lg:flex-1">
              <div className="group relative w-full sm:max-w-sm">
                <Search className="pointer-events-none absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2 text-text-secondary transition-colors group-focus-within:text-[#4C78F5]" />
                <input
                  placeholder="Search applications…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-white py-2 pr-9 pl-10 text-sm text-text-primary outline-none transition placeholder:text-text-secondary/70 focus:border-[#4C78F5]/50 focus:ring-2 focus:ring-[#4C78F5]/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                {searchTerm ? (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-text-secondary hover:bg-surface hover:text-text-primary"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>

              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-white px-3 text-sm font-medium text-text-secondary transition hover:bg-surface disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950"
                title="Refresh"
              >
                <RefreshCw
                  size={14}
                  className={loading ? "animate-spin" : ""}
                />
                Refresh
              </button>
            </div>

            <p className="shrink-0 text-[13px] font-medium text-text-secondary">
              {loading && rows.length === 0
                ? "…"
                : `${filteredRows.length} shown${
                    pagination.hasNextPage ||
                    pagination.total > filteredRows.length
                      ? "+"
                      : ""
                  }`}
            </p>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border px-4 py-2.5 scrollbar-hide sm:px-5 dark:border-slate-800">
            <span className="mr-1 shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
              Status
            </span>
            {STATUS_FILTERS.map((filter) => {
              const count = pipelineStats[filter.statKey] ?? 0;
              const active = statusFilter === filter.value;
              return (
                <button
                  key={filter.value || "all"}
                  type="button"
                  onClick={() => {
                    setStatusFilter(filter.value);
                    setCurrentPage(1);
                  }}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    active
                      ? "bg-[#4C78F5] text-white"
                      : "border border-border bg-white text-text-secondary hover:border-[#4C78F5]/40 hover:text-[#4C78F5] dark:border-slate-700 dark:bg-slate-950"
                  }`}
                >
                  {filter.label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                      active
                        ? "bg-white/20"
                        : "bg-slate-100 text-text-secondary dark:bg-slate-800"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
            {searchTerm || statusFilter ? (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("");
                  setCurrentPage(1);
                }}
                className="ml-1 shrink-0 text-xs font-semibold text-[#4C78F5] hover:underline"
              >
                Clear
              </button>
            ) : null}
          </div>

          <div className="w-full overflow-x-auto">
            <table className="ds-table w-full min-w-[760px]">
              <thead>
                <tr>
                  {[
                    "Deal",
                    "Program",
                    "Amount",
                    "Stage",
                    "Team",
                    "Received",
                    "Action",
                  ].map((label) => (
                    <th
                      key={label}
                      className={label === "Action" ? "!text-right" : undefined}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {loading && rows.length === 0 ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((__, cell) => (
                        <td key={cell}>
                          <div className="h-4 animate-pulse rounded bg-surface dark:bg-slate-800" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filteredRows.length > 0 ? (
                  filteredRows.map((row) => {
                    const place = [
                      displayPlace(row.cityState),
                      displayPlace(row.country),
                    ]
                      .filter(Boolean)
                      .join(", ");
                    const teamPeople = row.assignedLoanOfficers || [];
                    const dealMeta = [
                      row.applicationNumber || null,
                      place || null,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    const programLabel = formatLoanProduct(
                      row.loanType || row.company,
                    );

                    return (
                      <tr
                        key={row.submissionId}
                        className="cursor-pointer"
                        onClick={() => openApplicationRow(row)}
                      >
                        <td title={displayName(row.borrowerName)}>
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4C78F5] text-[11px] font-bold tracking-wide text-white">
                              {dealInitials(row.borrowerName)}
                            </span>
                            <div className="min-w-0">
                              <p className="ds-table-title">
                                {displayName(row.borrowerName)}
                              </p>
                              <p className="ds-table-meta">
                                {dealMeta || (
                                  <span className="italic text-text-secondary/70">
                                    Not provided
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td title={programLabel}>
                          {programLabel === "Not provided" ? (
                            <span className="text-[12px] font-medium italic text-text-secondary/70">
                              Not set
                            </span>
                          ) : (
                            <span className="inline-flex max-w-[200px] truncate rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium lowercase text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {programLabel}
                            </span>
                          )}
                        </td>

                        <td>
                          <span className="ds-table-amount">
                            {formatCompactAmount(Number(row.amount || 0))}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`inline-flex max-w-full items-center truncate rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${getStatusColor(row.status)}`}
                            title={formatStatusLabel(row.status)}
                          >
                            {formatStatusLabel(row.status)}
                          </span>
                        </td>

                        <td
                          onClick={(e) => {
                            if (teamPeople.length) e.stopPropagation();
                          }}
                        >
                          <AssigneePills
                            people={teamPeople}
                            compact
                            pillClassName="bg-[#4C78F5]/8 text-[#3B66E0]"
                            onShowAll={() =>
                              setPeopleModal({
                                open: true,
                                title: "Assigned Loan Officers",
                                roleLabel: "Loan Officer",
                                people: teamPeople,
                              })
                            }
                          />
                        </td>

                        <td className="ds-table-muted whitespace-nowrap">
                          {formatShortDate(row.date) === "Not provided" ? (
                            <span className="italic text-text-secondary/70">
                              —
                            </span>
                          ) : (
                            formatShortDate(row.date)
                          )}
                        </td>

                        <td
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex shrink-0 items-center justify-end">
                            <button
                              type="button"
                              title="More actions"
                              data-id={row.submissionId}
                              data-dropdown-trigger
                              onClick={(e) => {
                                e.stopPropagation();
                                const rect =
                                  e.currentTarget.getBoundingClientRect();
                                setDropdownPos(
                                  getFixedMenuPosition(rect, {
                                    width: 220,
                                    height: 160,
                                  }),
                                );
                                setActiveDropdown(
                                  activeDropdown === row.submissionId
                                    ? null
                                    : row.submissionId,
                                );
                              }}
                              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-text-secondary transition hover:bg-surface ${
                                activeDropdown === row.submissionId
                                  ? "border-[#4C78F5]/30 bg-[#4C78F5]/8 text-[#4C78F5]"
                                  : ""
                              }`}
                            >
                              <MoreHorizontal size={16} />
                            </button>
                          </div>

                          {activeDropdown === row.submissionId &&
                            createPortal(
                              <div
                                ref={dropdownRef}
                                style={{
                                  position: "fixed",
                                  top: dropdownPos.top,
                                  left: dropdownPos.left,
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="z-[9999] w-[220px] overflow-hidden rounded-xl border border-border bg-white py-1 shadow-none dark:border-slate-700 dark:bg-slate-950"
                              >
                                {row.status === "INCOMPLETE" ? (
                                  <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveDropdown(null);
                                      resumeIncomplete(row.applicationId);
                                    }}
                                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium whitespace-nowrap text-text-primary transition hover:bg-brand-50 hover:text-brand-600"
                                  >
                                    <MdEdit
                                      size={15}
                                      className="h-[15px] w-[15px] shrink-0 text-brand-500"
                                    />
                                    <span className="min-w-0 flex-1 truncate text-left">
                                      Continue Application
                                    </span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveDropdown(null);
                                      openPreview(row.submissionId, row);
                                    }}
                                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium whitespace-nowrap text-text-primary transition hover:bg-brand-50 hover:text-brand-600"
                                  >
                                    <Eye
                                      size={15}
                                      className="h-[15px] w-[15px] shrink-0 text-brand-500"
                                    />
                                    <span className="min-w-0 flex-1 truncate text-left">
                                      Open Application
                                    </span>
                                  </button>
                                )}
                              </div>,
                              document.body,
                            )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-14 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                          {searchTerm || statusFilter ? (
                            <SearchX className="h-5 w-5" />
                          ) : (
                            <FileText className="h-5 w-5" />
                          )}
                        </div>
                        <h3 className="text-sm font-semibold text-text-primary dark:text-slate-100">
                          {searchTerm || statusFilter
                            ? "No matches for this filter"
                            : "No applications in your pipeline yet"}
                        </h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                          {searchTerm || statusFilter
                            ? "Try another search term or clear the active filter."
                            : "Assigned applications will appear here once available."}
                        </p>
                        {searchTerm || statusFilter ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchTerm("");
                              setStatusFilter("");
                              setCurrentPage(1);
                            }}
                            className="ds-btn-primary mt-4 h-9 rounded-lg px-4 text-sm"
                          >
                            Clear filters
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              navigate("/sub-broker/loan-application")
                            }
                            className="ds-btn-primary mt-4 h-9 rounded-lg px-4 text-sm"
                          >
                            <Plus className="h-4 w-4" />
                            Create Application
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {(pagination.totalPages > 1 ||
              pagination.hasNextPage ||
              pagination.hasPreviousPage) && (
              <div className="flex flex-col gap-3 border-t border-border px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 sm:px-5">
                <p className="text-xs text-text-secondary">
                  Page {pagination.page} of {pagination.totalPages} ·{" "}
                  {pagination.total} total
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!pagination.hasPreviousPage || loading}
                    onClick={() => setCurrentPage((prev) => prev - 1)}
                    className="ds-btn-secondary inline-flex h-9 items-center gap-1 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={!pagination.hasNextPage || loading}
                    onClick={() => setCurrentPage((prev) => prev + 1)}
                    className="ds-btn-primary inline-flex h-9 items-center gap-1 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {loading && rows.length > 0 ? (
              <div className="border-t border-border px-6 py-3 text-center dark:border-slate-800">
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-brand-500" />
              </div>
            ) : null}
          </div>
        </div>
      </div>

        {peopleModal.open &&
          createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
              <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    {peopleModal.title}
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      setPeopleModal({
                        open: false,
                        title: "",
                        roleLabel: "",
                        people: [],
                      })
                    }
                    className="text-lg text-slate-400 hover:text-red-500"
                  >
                    ✕
                  </button>
                </div>
                <div className="grid max-h-[70vh] grid-cols-1 gap-4 overflow-y-auto p-5 sm:grid-cols-2">
                  {peopleModal.people.map((person) => (
                    <div
                      key={person.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/40"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-500 text-base font-bold text-white">
                          {person.name?.charAt(0) || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {person.name}
                          </h4>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {peopleModal.roleLabel}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>,
            document.body,
          )}

        {viewSubmissionId &&
          createPortal(
            <div
              className="fixed inset-0 z-50
                                            bg-black/40 dark:bg-black/70
                                            backdrop-blur-[1px]
                                            flex items-center justify-center p-4"
            >
              <div
                className="bg-white dark:bg-slate-900
                                            text-slate-900 dark:text-slate-100
                                            rounded-2xl
                                            w-full max-w-7xl max-h-[90vh]
                                            overflow-y-auto
                                           "
              >
                {/* HEADER */}
                <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 flex items-center justify-between px-6 py-3 border-b dark:border-slate-800">
                  <div>
                    <h2 className="font-bold text-lg">Application Details</h2>
                  </div>
                  <button
                    onClick={() => {
                      setViewSubmissionId(null);
                      setSubmissionDetail(null);
                    }}
                    className="text-slate-400 hover:text-red-500 text-xl"
                  >
                    ✕
                  </button>
                </div>

                {/* BODY */}
                <div className="p-6 space-y-8">
                  {detailLoading ? (
                    <p className="text-center text-slate-500">Loading…</p>
                  ) : submissionDetail ? (
                    (() => {
                      const signatureField = submissionDetail.fields?.find(
                        (f: any) => f.fieldKey === "borrowerSignature",
                      );

                      /* ===================== YAHAN PASTE KARO ===================== */

                      const allFields = submissionDetail.fields.filter(
                        (f: any) => f.fieldKey !== "borrowerSignature",
                      );

                      const primaryFields: any[] = [];
                      const coBorrowerGroups: Record<string, any[]> = {};
                      const otherFields: any[] = [];

                      allFields.forEach((f: any) => {
                        const key = f.fieldKey || "";

                        if (key.startsWith("coBorrower_")) {
                          const match = key.match(/^coBorrower_(\d+)_/);
                          if (match) {
                            const index = match[1];
                            if (!coBorrowerGroups[index]) {
                              coBorrowerGroups[index] = [];
                            }
                            coBorrowerGroups[index].push(f);
                          }
                        } else if (
                          key.startsWith("borrower") ||
                          key === "city" ||
                          key === "state" ||
                          key === "isBroker"
                        ) {
                          primaryFields.push(f);
                        } else {
                          otherFields.push(f);
                        }
                      });

                      const loanAmount =
                        Number(
                          getFieldValue(
                            submissionDetail.fields,
                            "amountRequested",
                          ) ?? 0,
                        ) || 0;

                      const ltv =
                        Number(
                          getFieldValue(
                            submissionDetail.fields,
                            "ltvPercentage",
                          ) ?? 0,
                        ) || 0;

                      const ltc =
                        Number(
                          getFieldValue(
                            submissionDetail.fields,
                            "ltcPercentage",
                          ) ?? 0,
                        ) || 0;

                      const arv =
                        Number(
                          getFieldValue(
                            submissionDetail.fields,
                            "arvPercentage",
                          ) ?? 0,
                        ) || 0;

                      const dscr =
                        Number(
                          getFieldValue(submissionDetail.fields, "dscr") ?? 0,
                        ) || 0;

                      const netWorth =
                        Number(
                          getFieldValue(submissionDetail.fields, "netWorth") ??
                            0,
                        ) || 0;

                      const submittedDate = new Date(
                        submissionDetail.submittedAt,
                      );
                      const formattedDate = formatUsDate(submittedDate);
                      const formattedTime = submittedDate.toLocaleTimeString();
                      const reviewsArray =
                        submissionDetail?.lenders?.[0]?.reviews || [];

                      const firstReview =
                        Array.isArray(reviewsArray) && reviewsArray.length > 0
                          ? reviewsArray[0]
                          : null;

                      const FieldItem = ({ field }: { field: any }) => {
                        const parsedValue = parseValue(field.value);

                        return (
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase">
                              {formatFieldKey(field.fieldKey)}
                            </label>

                            <div
                              className="px-3 py-2 rounded-lg border text-sm font-medium break-words
bg-slate-100 border-slate-200
dark:bg-slate-800 dark:border-slate-700"
                            >
                              {parsedValue !== undefined && parsedValue !== null
                                ? typeof parsedValue === "boolean"
                                  ? parsedValue
                                    ? "Yes"
                                    : "No"
                                  : String(parsedValue)
                                : "-"}
                            </div>
                          </div>
                        );
                      };

                      return (
                        <>
                          {firstReview && (
                            <div
                              className={`relative overflow-hidden rounded-2xl border p-6 mb-8
     ${
       firstReview.reviewStatus === "APPROVED"
         ? "border-emerald-400 bg-emerald-50/40 dark:bg-emerald-500/5"
         : firstReview.reviewStatus === "CONDITIONAL"
           ? "border-amber-400 bg-amber-50/40 dark:bg-amber-500/5"
           : "border-rose-400 bg-rose-50/40 dark:bg-rose-500/5"
     }
    `}
                            >
                              {/* Top Accent Line */}
                              <div
                                className={`absolute top-0 left-0 right-0 h-1
        ${
          firstReview.reviewStatus === "APPROVED"
            ? "bg-emerald-500"
            : firstReview.reviewStatus === "CONDITIONAL"
              ? "bg-amber-500"
              : "bg-rose-500"
        }
      `}
                              />

                              {/* Header Section */}
                              <div className="flex items-center gap-4 mb-6">
                                <div
                                  className={`flex items-center justify-center h-12 w-12 rounded-xl text-white text-xl font-bold
          ${
            firstReview.reviewStatus === "APPROVED"
              ? "bg-emerald-500"
              : firstReview.reviewStatus === "CONDITIONAL"
                ? "bg-amber-500"
                : "bg-rose-500"
          }
        `}
                                >
                                  {firstReview.reviewStatus === "APPROVED"
                                    ? "✓"
                                    : firstReview.reviewStatus === "CONDITIONAL"
                                      ? "!"
                                      : "✕"}
                                </div>

                                <div>
                                  <p className="text-xs uppercase tracking-wider text-slate-500">
                                    Lender Decision
                                  </p>
                                  <h3
                                    className={`text-lg font-bold
           ${
             firstReview.reviewStatus === "APPROVED"
               ? "text-emerald-600 dark:text-emerald-400"
               : firstReview.reviewStatus === "CONDITIONAL"
                 ? "text-amber-600 dark:text-amber-400"
                 : "text-rose-600 dark:text-rose-400"
           }
          `}
                                  >
                                    {firstReview.reviewStatus === "DECLINED"
                                      ? "REJECTED"
                                      : firstReview.reviewStatus}
                                  </h3>
                                </div>
                              </div>

                              {/* Inline Row */}
                              <div className="grid md:grid-cols-4 gap-6 text-sm">
                                {firstReview.approvedAmount && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">
                                      Approved Amount
                                    </p>
                                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                                      $
                                      {Number(
                                        firstReview.approvedAmount,
                                      ).toLocaleString()}
                                    </p>
                                  </div>
                                )}

                                {firstReview.interestRate && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">
                                      Interest Rate
                                    </p>
                                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                                      {firstReview.interestRate}%
                                    </p>
                                  </div>
                                )}

                                {firstReview?.reviewedAt && (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">
                                      {firstReview.reviewStatus === "DECLINED"
                                        ? "Rejected On"
                                        : "Reviewed On"}
                                    </p>
                                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                                      {new Date(
                                        firstReview.reviewedAt,
                                      ).toLocaleString()}
                                    </p>
                                  </div>
                                )}
                              </div>

                              {/* Notes Full Width Below */}
                              {firstReview.notes && (
                                <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                                  <p className="text-xs text-slate-500 mb-2">
                                    Notes
                                  </p>
                                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
                                    {firstReview.notes}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm font-medium">
                            {/* Application Number */}
                            <div>
                              <span className="font-semibold">
                                Application No:
                              </span>{" "}
                              <span className="text-slate-700 dark:text-slate-300">
                                {submissionDetail.applicationNumber || "-"}
                              </span>
                            </div>

                            {/* Status */}
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">
                                Status:
                              </span>

                              <span
                                className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wide ${getStatusChip(
                                  submissionDetail.status,
                                )}`}
                              >
                                {submissionDetail.status === "DECLINED"
                                  ? "REJECTED"
                                  : submissionDetail.status}
                              </span>
                            </div>
                          </div>

                          {/* STATS BOX */}
                          <div
                            className="bg-slate-50 border border-slate-200 rounded-2xl p-6
dark:bg-slate-900 dark:border-slate-800"
                          >
                            <div className="grid grid-cols-2 md:grid-cols-6 gap-6 text-center">
                              <Stat
                                label="Loan Amount"
                                value={`$${loanAmount.toLocaleString()}`}
                              />
                              <Stat
                                label="LTV %"
                                value={ltv ? `${ltv.toFixed(2)}%` : "—%"}
                              />
                              <Stat
                                label="LTC %"
                                value={ltc ? `${ltc.toFixed(2)}%` : "—%"}
                              />
                              <Stat
                                label="ARV %"
                                value={arv ? `${arv.toFixed(2)}%` : "—%"}
                              />
                              <Stat
                                label="DSCR"
                                value={dscr ? dscr.toFixed(2) : "—"}
                              />
                              <Stat
                                label="Net Worth"
                                value={`$${netWorth.toLocaleString()}`}
                              />
                            </div>
                          </div>

                          {/* ALL FIELDS (EXCEPT SIGNATURE) */}
                          <div className="rounded-xl p-6">
                            <div className=" gap-6">
                              <div
                                className="border border-slate-200 rounded-xl p-6 space-y-10
bg-white dark:bg-slate-900
dark:border-slate-800"
                              >
                                {/* PRIMARY BORROWER */}
                                {primaryFields.length > 0 && (
                                  <div>
                                    <h3
                                      className="text-md font-bold mb-4 border-b pb-2
text-slate-800 dark:text-slate-200
border-slate-200 dark:border-slate-700"
                                    >
                                      Primary Borrower
                                    </h3>

                                    <div className="grid md:grid-cols-2 gap-6">
                                      {primaryFields.map(
                                        (f: any, i: number) => (
                                          <FieldItem key={i} field={f} />
                                        ),
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* CO BORROWERS */}
                                {Object.keys(coBorrowerGroups).map((index) => (
                                  <div key={index}>
                                    <h3 className="text-md font-bold mb-4 border-b pb-2">
                                      Co Borrower {index}
                                    </h3>

                                    <div className="grid md:grid-cols-2 gap-6">
                                      {coBorrowerGroups[index].map(
                                        (f: any, i: number) => (
                                          <FieldItem key={i} field={f} />
                                        ),
                                      )}
                                    </div>
                                  </div>
                                ))}

                                {/* OTHER FIELDS */}
                                {otherFields.length > 0 && (
                                  <div>
                                    <h3 className="text-md font-bold mb-4 border-b dark:border-slate-700  pb-2">
                                      Loan Details
                                    </h3>

                                    <div className="grid md:grid-cols-2 gap-6">
                                      {otherFields.map((f: any, i: number) => (
                                        <FieldItem key={i} field={f} />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* DIGITAL SIGNATURE */}
                          {signatureField && (
                            <div className="text-center space-y-4">
                              <h3
                                className="
                                  text-sm font-semibold 
                                  text-slate-700 
                                  dark:text-slate-300
                                  transition-colors duration-300
                                "
                              >
                                Digital Signature
                              </h3>

                              <div className="flex justify-center">
                                <div
                                  className="
                                        bg-white 
                                        dark:bg-slate-800/70
                                        border border-slate-200 
                                        dark:border-slate-700
                                        rounded-xl 
                                        p-4 
                                        transition-colors duration-300"
                                >
                                  <img
                                    src={parseValue(signatureField.value)}
                                    alt="Digital Signature"
                                    className="h-40 object-contain"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* SUBMITTED DATE & TIME (LAST) */}
                          <div
                            className="border-t border-slate-200 dark:border-slate-700 pt-6 
text-sm text-slate-600 dark:text-slate-400 flex justify-between"
                          >
                            <div>
                              <span className="font-semibold">
                                Submitted Date:
                              </span>{" "}
                              {formattedDate}
                            </div>
                            <div>
                              <span className="font-semibold">
                                Submitted Time:
                              </span>{" "}
                              {formattedTime}
                            </div>
                          </div>
                        </>
                      );
                    })()
                  ) : null}
                </div>
              </div>
            </div>,
            document.body,
          )}

        {documentModalOpen &&
          createPortal(
            <div className="fixed inset-0 z-[9999999999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
              <div
                className="bg-white dark:bg-slate-900 
rounded-3xl 
w-full max-w-6xl 
max-h-[85vh] 
overflow-hidden  
flex flex-col"
              >
                {/* HEADER */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
                  <h2 className="font-semibold text-sm tracking-wide text-slate-700 dark:text-slate-200">
                    Requested Documents
                  </h2>

                  <button
                    onClick={() => {
                      setDocumentModalOpen(false);
                      setDocumentsData(null);
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded-full 
    hover:bg-red-100 dark:hover:bg-red-500/20 
    text-slate-400 hover:text-red-500 transition text-sm"
                  >
                    ✕
                  </button>
                </div>

                {/* SCROLLABLE BODY */}
                <div className="p-6 overflow-y-auto">
                  {documentsLoading ? (
                    <div className="text-center text-slate-500 py-10">
                      Loading documents...
                    </div>
                  ) : documentsData?.documents?.length > 0 ? (
                    <div className="grid sm:grid-cols-4 gap-4">
                      {documentsData.documents.map(
                        (doc: any, index: number) => {
                          const hasFiles =
                            doc.uploadedFiles && doc.uploadedFiles.length > 0;

                          return (
                            <div
                              key={index}
                              className="
relative
bg-white dark:bg-slate-900
border border-slate-200 dark:border-slate-800
rounded-xl
p-4
transition-all duration-200
flex flex-col
h-[320px]   
"
                            >
                              {/* Top Section */}
                              <div className="flex items-center gap-4 mb-4">
                                <div className="flex items-center justify-between w-full">
                                  <h3 className="font-medium text-[13px] text-slate-900 dark:text-slate-200 truncate">
                                    {doc.documentName}
                                  </h3>

                                  {(previewFiles[doc.requirementId]?.length >
                                    0 ||
                                    selectedFiles[doc.requirementId]?.length >
                                      0) && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPreviewFiles((prev) => {
                                          const copy = { ...prev };
                                          delete copy[doc.requirementId];
                                          return copy;
                                        });

                                        setSelectedFiles((prev) => {
                                          const copy = { ...prev };
                                          delete copy[doc.requirementId];
                                          return copy;
                                        });
                                      }}
                                      className="text-[10px] px-2 py-1 rounded-md 
                 bg-red-50 text-red-600 
                 hover:bg-red-100 
                 dark:bg-red-500/10 dark:text-red-400 
                 dark:hover:bg-red-500/20
                 transition"
                                    >
                                      Clear
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Upload Area */}
                              {!hasFiles ? (
                                <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
                                  {/* Preview */}
                                  {previewFiles[doc.requirementId]?.length >
                                    0 && (
                                    <div
                                      className="
flex flex-wrap gap-2
max-h-[220px]
overflow-y-auto
pr-1
scrollbar-thin
scrollbar-thumb-slate-300
dark:scrollbar-thumb-slate-700
"
                                    >
                                      {previewFiles[doc.requirementId].map(
                                        (file, i) => (
                                          <div
                                            key={i}
                                            className="relative w-16 h-16 rounded-lg border-2 border-blue-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 overflow-hidden flex items-center justify-center"
                                          >
                                            {/* IMAGE PREVIEW */}
                                            {file.type.startsWith("image") ? (
                                              <img
                                                src={file.url}
                                                alt={file.name}
                                                className="w-full h-full object-cover"
                                              />
                                            ) : file.type.includes("pdf") ? (
                                              <div className="flex flex-col items-center justify-center text-xs text-red-500 font-semibold">
                                                📄
                                                <span className="text-[9px] mt-1">
                                                  PDF
                                                </span>
                                              </div>
                                            ) : (
                                              <div className="text-xs text-slate-500">
                                                File
                                              </div>
                                            )}

                                            {/* Remove Button */}
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setPreviewFiles((prev) => {
                                                  const updated = [
                                                    ...(prev[
                                                      doc.requirementId
                                                    ] || []),
                                                  ];
                                                  updated.splice(i, 1);
                                                  const copy = { ...prev };
                                                  if (updated.length === 0)
                                                    delete copy[
                                                      doc.requirementId
                                                    ];
                                                  else
                                                    copy[doc.requirementId] =
                                                      updated;
                                                  return copy;
                                                });

                                                setSelectedFiles((prev) => {
                                                  const updated = [
                                                    ...(prev[
                                                      doc.requirementId
                                                    ] || []),
                                                  ];
                                                  updated.splice(i, 1);
                                                  const copy = { ...prev };
                                                  if (updated.length === 0)
                                                    delete copy[
                                                      doc.requirementId
                                                    ];
                                                  else
                                                    copy[doc.requirementId] =
                                                      updated;
                                                  return copy;
                                                });
                                              }}
                                              className="absolute top-1 right-1 bg-black/60 text-white text-xs px-1 rounded hover:bg-red-500 transition"
                                            >
                                              ✕
                                            </button>
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  )}

                                  {/* File Select – show only if no file selected */}
                                  {!selectedFiles[doc.requirementId] && (
                                    <label className="h-full flex flex-col justify-center items-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-6 text-center hover:border-amber-400 transition cursor-pointer">
                                      <input
                                        type="file"
                                        multiple
                                        accept=".pdf,.png,.jpg,.jpeg"
                                        className="hidden"
                                        onChange={(e) => {
                                          const files = Array.from(
                                            e.target.files || [],
                                          );
                                          if (!files.length) return;

                                          const validFiles: File[] = [];
                                          const previews: {
                                            url: string;
                                            type: string;
                                            name: string;
                                          }[] = [];

                                          files.forEach((file) => {
                                            if (file.size > 5 * 1024 * 1024) {
                                              toast.error(
                                                `${file.name} exceeds 5MB limit`,
                                              );
                                              return;
                                            }

                                            validFiles.push(file);
                                            previews.push({
                                              url: URL.createObjectURL(file),
                                              type: file.type,
                                              name: file.name,
                                            });
                                          });

                                          if (!validFiles.length) return;

                                          setSelectedFiles((prev) => ({
                                            ...prev,
                                            [doc.requirementId]: [
                                              ...(prev[doc.requirementId] ||
                                                []),
                                              ...validFiles,
                                            ],
                                          }));

                                          setPreviewFiles((prev) => ({
                                            ...prev,
                                            [doc.requirementId]: [
                                              ...(prev[doc.requirementId] ||
                                                []),
                                              ...previews,
                                            ],
                                          }));
                                        }}
                                      />

                                      <p className="text-xs text-amber-600 font-medium">
                                        Click to Select File
                                      </p>
                                      <p className="text-[10px] text-slate-400 mt-1">
                                        PDF / JPG / PNG (Max 5MB)
                                      </p>
                                    </label>
                                  )}

                                  {/* Upload Button – only after file selected */}
                                  {selectedFiles[doc.requirementId]?.length >
                                    0 && (
                                    <button
                                      onClick={() =>
                                        handleDocumentUpload(
                                          documentsData.submissionId,
                                          doc.requirementId,
                                        )
                                      }
                                      disabled={
                                        uploadingDocId === doc.requirementId
                                      }
                                      className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 rounded-lg transition disabled:opacity-60"
                                    >
                                      {uploadingDocId === doc.requirementId ? (
                                        <div className="flex items-center justify-center gap-2">
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                          Uploading...
                                        </div>
                                      ) : (
                                        "Upload Document"
                                      )}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div
                                  className="
flex flex-wrap gap-2
max-h-[220px]
overflow-y-auto
pr-1
scrollbar-thin
scrollbar-thumb-slate-300
dark:scrollbar-thumb-slate-700 w-full
"
                                >
                                  {doc.uploadedFiles.map(
                                    (file: any, i: number) => {
                                      const isImage =
                                        file.fileMimeType?.startsWith("image");

                                      return (
                                        <div
                                          key={i}
                                          className="relative w-16 h-16 rounded-lg border-2 border-[#98bfe1] bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center"
                                        >
                                          {isImage ? (
                                            <img
                                              src={`${API_BASE}${file.fileUrl}`}
                                              alt={file.fileName}
                                              className="w-full h-full object-cover"
                                            />
                                          ) : (
                                            <div className="flex flex-col items-center justify-center text-xs text-slate-600 dark:text-slate-300">
                                              📄
                                              <span className="mt-1 truncate px-1 text-[10px]">
                                                PDF
                                              </span>
                                            </div>
                                          )}

                                          {/* View Overlay */}
                                          <a
                                            href={`${API_BASE}${file.fileUrl}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold"
                                          >
                                            View
                                          </a>
                                        </div>
                                      );
                                    },
                                  )}
                                </div>
                              )}

                              {/* Bottom Status */}
                              <div className="mt-auto pt-3 ">
                                <div className="mt-4 flex justify-between items-center">
                                  <span
                                    className={`text-[10px] px-3 py-1 rounded-full
                          ${
                            doc.status === "PENDING"
                              ? "bg-amber-100 text-amber-600"
                              : "bg-emerald-100 text-emerald-600"
                          }`}
                                  >
                                    {formatDocumentStatusLabel(doc.status)}
                                  </span>

                                  <span className="text-[11px] font-semibold text-red-400">
                                    {doc.uploadedCount} Uploaded
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>
                  ) : (
                    <div className="text-center text-slate-500 py-10">
                      No documents found
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )}

        {loiModalOpen &&
          createPortal(
            <div className="fixed inset-0 z-[99999999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-3 border-b dark:border-slate-800">
                  <h2 className="font-bold text-lg dark:text-white">
                    Letters of Intent
                  </h2>

                  <button
                    onClick={() => setLoiModalOpen(false)}
                    className="text-slate-400 hover:text-red-500 text-xl"
                  >
                    ✕
                  </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                  {lois.length === 0 ? (
                    /* Empty State */
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div
                        className="
        w-16 h-16
        flex items-center justify-center
        rounded-full
        bg-amber-100 dark:bg-amber-500/10
        mb-4
      "
                      >
                        <FileText className="w-7 h-7 text-amber-600 dark:text-amber-400" />
                      </div>

                      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                        No LOIs Available
                      </h3>

                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                        No lenders have issued a Letter of Intent for this
                        application yet. Once available, it will appear here.
                      </p>
                    </div>
                  ) : (
                    lois.map((loi, index) => (
                      <div
                        key={index}
                        className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3"
                      >
                        {/* Lender */}
                        <div className="flex justify-between items-center">
                          <h3 className="font-semibold text-slate-900 dark:text-white">
                            {loi.lenderName}
                          </h3>

                          <span className="text-xs px-3 py-1 rounded-full bg-indigo-100 text-indigo-600">
                            {loi.status}
                          </span>
                        </div>

                        {/* Details */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-slate-500 dark:text-slate-300">
                              Email
                            </span>
                            <div className="dark:text-slate-400">
                              {loi.lenderEmail || "-"}
                            </div>
                          </div>

                          <div>
                            <span className="text-slate-500 dark:text-slate-300">
                              Phone
                            </span>
                            <div className="dark:text-slate-400">
                              {loi.lenderPhone || "-"}
                            </div>
                          </div>

                          <div>
                            <span className="text-slate-500 dark:text-slate-300">
                              Approved Amount
                            </span>
                            <div className="dark:text-slate-400">
                              {loi.approvedAmount
                                ? `$${Number(loi.approvedAmount).toLocaleString()}`
                                : "-"}
                            </div>
                          </div>

                          <div>
                            <span className="text-slate-500 dark:text-slate-300">
                              Interest Rate
                            </span>
                            <div className="dark:text-slate-400">
                              {loi.interestRate ? `${loi.interestRate}%` : "-"}
                            </div>
                          </div>
                        </div>

                        {/* Notes */}
                        {loi.notes && (
                          <div className="text-sm">
                            <span className="text-slate-500 dark:text-slate-300">
                              Notes
                            </span>
                            <p className="dark:text-slate-400 mt-1">
                              {loi.notes}
                            </p>
                          </div>
                        )}

                        {/* View PDF */}
                        <div className="pt-3 border-t dark:border-slate-800 flex justify-end">
                          <button
                            onClick={() => {
                              const fileUrl = `${API_BASE}/public${loi.loiUrl}`;

                              setPreviewFile({
                                url: fileUrl,
                                type: "application/pdf",
                                name: `${loi.lenderName} LOI`,
                              });
                            }}
                            className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-700"
                          >
                            View LOI PDF
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )}

        {previewFile &&
          createPortal(
            <div className="fixed inset-0 z-[99999999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
              <div className="w-full max-w-6xl bg-white dark:bg-slate-900 rounded-2xl flex flex-col h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-3 border-b dark:border-slate-800 shrink-0">
                  <div>
                    <h2 className="text-lg font-bold truncate max-w-md dark:text-white">
                      {previewFile.name}
                    </h2>
                    <p className="text-xs text-slate-500">PDF Preview</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Download Button */}
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch(previewFile.url);

                          const blob = await res.blob();

                          const url = window.URL.createObjectURL(blob);

                          const link = document.createElement("a");
                          link.href = url;
                          link.download = previewFile.name || "LOI.pdf";

                          document.body.appendChild(link);
                          link.click();

                          link.remove();
                          window.URL.revokeObjectURL(url);
                        } catch (err) {
                          console.error("Download failed", err);
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
                    >
                      Download
                    </button>

                    {/* Close Button */}
                    <button
                      onClick={() => setPreviewFile(null)}
                      className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition"
                    >
                      Close
                    </button>
                  </div>
                </div>

                {/* PDF Preview */}
                <div className="flex-1 bg-slate-100 dark:bg-slate-950">
                  <iframe
                    src={`https://docs.google.com/gview?url=${previewFile.url}&embedded=true`}
                    title={previewFile.name}
                    className="w-full h-full border-none"
                  />
                </div>
              </div>
            </div>,
            document.body,
          )}

        {docSelectModal.isOpen &&
          createPortal(
            <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="bg-white w-full max-w-2xl rounded-2xl border border-gray-100">
                {/* HEADER */}
                <div className="flex items-center justify-between px-6 py-3 border-b">
                  <h2 className="text-lg font-semibold text-gray-800">
                    Select Documents
                  </h2>

                  <button
                    onClick={() =>
                      setDocSelectModal({
                        isOpen: false,
                        applicationId: "",
                        documents: [],
                        selectedDocs: [],
                        loading: false,
                      })
                    }
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>

                {/* BODY */}
                <div className="px-6 py-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-500">
                      Select which documents are required.
                    </p>

                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setDocSelectModal((prev) => ({
                            ...prev,
                            selectedDocs: prev.documents.map(
                              (d: any) => d.documentTypeId,
                            ),
                          }))
                        }
                        className="px-3 py-1 text-xs rounded-md border bg-gray-50 hover:bg-gray-100"
                      >
                        Select All
                      </button>

                      <button
                        onClick={() =>
                          setDocSelectModal((prev) => ({
                            ...prev,
                            selectedDocs: [],
                          }))
                        }
                        className="px-3 py-1 text-xs rounded-md border bg-gray-50 hover:bg-gray-100"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* LOADING */}
                  {docSelectModal.loading ? (
                    <div className="text-center py-10 text-gray-500">
                      Loading documents...
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {docSelectModal.documents.map((doc: any) => {
                        const isSelected = docSelectModal.selectedDocs.includes(
                          doc.documentTypeId,
                        );

                        return (
                          <div
                            key={doc.documentTypeId}
                            onClick={() => {
                              const updated = isSelected
                                ? docSelectModal.selectedDocs.filter(
                                    (id) => id !== doc.documentTypeId,
                                  )
                                : [
                                    ...docSelectModal.selectedDocs,
                                    doc.documentTypeId,
                                  ];

                              setDocSelectModal({
                                ...docSelectModal,
                                selectedDocs: updated,
                              });
                            }}
                            className={`cursor-pointer flex items-center justify-between px-4 py-3 rounded-xl border transition
                      ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-orange-400" />
                              <span className="text-sm text-gray-700">
                                {doc.documentType.name}
                              </span>
                            </div>

                            <input
                              type="checkbox"
                              checked={isSelected}
                              readOnly
                              className="accent-emerald-600"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Message
                    </label>

                    <textarea
                      placeholder="Enter a message for the client (optional)..."
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm 
               focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
               transition resize-none min-h-[90px]"
                      value={requestMessage}
                      onChange={(e) => setRequestMessage(e.target.value)}
                    />

                    <p className="text-xs text-gray-400 mt-1">
                      This message will be sent along with the document request.
                    </p>
                  </div>

                  {/* FOOTER */}
                  <div className="flex items-center justify-between mt-6">
                    <p className="text-sm text-gray-500">
                      {docSelectModal.selectedDocs.length} selected
                    </p>

                    <button
                      onClick={handleRequestDocuments}
                      disabled={docSelectModal.selectedDocs.length === 0}
                      className="bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Request Documents
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )}
    </>
  );
}
