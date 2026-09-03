import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import toast from "react-hot-toast";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router";
import {
  MapPin,
  Eye,
  Search,
  FileText,
  Loader2,
  TrendingUp,
  RefreshCw,
  Building2,
  SearchX,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Send,
  Users,
  X,
} from "lucide-react";

import Swal from "sweetalert2";
import { MdEdit } from "react-icons/md";
import PageMeta from "../../components/common/PageMeta";
import { formatDocumentStatusLabel } from "../../lib/documentStatus";
import {
  canBrokerReassignApplication,
  getBrokerReassignmentBlockedReason,
} from "../../lib/brokerApplicationAssignment";
import ShareClientApplicationLink from "../../components/loanPipeline/ShareClientApplicationLink";
import MultiSelect from "../../components/form/MultiSelect";

/* ================= TYPES ================= */
// type SubmissionListItem = {
//   submissionId: string;
//   status: string;
//   submittedOn: string;
//   pendingDocumentsCount: number; // ADD THIS
// };

type SubmissionField = {
  fieldId: string | null;
  fieldKey: string | null;
  value: string;
  source: "STATIC" | "DYNAMIC";
};

type AssignedPerson = {
  id: string;
  name: string;
  profileImage?: string | null;
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
  assignedOfficerId: string | null;
  assignedOfficerImage: string | null;
  assignedLoanOfficers: AssignedPerson[];
  assignedSubBrokers?: AssignedPerson[];
};

type Lender = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  profileImage?: string | null;
  loanProductCode: string;
  minFunding: string;
  maxFunding: string;
  minMonths: number;
  maxMonths: number;
  interestRateRange: string;
  fundingSpeedDays?: number;
  summary?: string;
  eligibilityStatus: string;
  lenderProductId: string;
};

/* ================= HELPERS ================= */
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

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
  const token = sessionStorage.getItem("broker_token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
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
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatStatusLabel(status?: string) {
  if (!status) return "Unknown";
  if (status === "DECLINED") return "Rejected";
  if (status === "CLIENT_PENDING") return "Client Pending";
  if (status === "IN_REVIEW") return "In Review";
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_FILTERS = [
  { value: "", label: "All", statKey: "totalApplications" as const },
  {
    value: "CLIENT_PENDING",
    label: "Client Pending",
    statKey: "clientPending" as const,
  },
  { value: "DRAFT", label: "Draft", statKey: "draft" as const },
  { value: "SUBMITTED", label: "Submitted", statKey: "submitted" as const },
  { value: "IN_REVIEW", label: "In Review", statKey: "inReview" as const },
  { value: "APPROVED", label: "Approved", statKey: "approved" as const },
  { value: "FUNDED", label: "Funded", statKey: "funded" as const },
  { value: "DECLINED", label: "Rejected", statKey: "rejected" as const },
];

function AssigneePills({
  people,
  pillClassName,
  onShowAll,
}: {
  people: AssignedPerson[];
  pillClassName: string;
  onShowAll?: (event: MouseEvent) => void;
}) {
  if (!people.length) {
    return (
      <div className="flex items-center gap-1 text-xs text-gray-400">
        <Users className="h-3 w-3" />
        Unassigned
      </div>
    );
  }

  const extra = people.length - 1;

  return (
    <div
      className="flex min-w-0 items-center gap-1"
      title={people.map((person) => person.name).join(", ")}
    >
      <span
        className={`inline-flex max-w-[8.5rem] truncate rounded-full px-2 py-0.5 text-xs font-medium ${pillClassName}`}
      >
        {people[0].name}
      </span>
      {extra > 0 && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onShowAll?.(event);
          }}
          className={`inline-flex shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${pillClassName}`}
        >
          +{extra}
        </button>
      )}
    </div>
  );
}

/* ================= COMPONENT ================= */
export default function LoanApplicationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const initialStatusParam = searchParams.get("status") || "";
  const initialStatus = STATUS_FILTERS.some(
    (filter) => filter.value === initialStatusParam,
  )
    ? initialStatusParam
    : "";
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const skipStatusReloadRef = useRef(true);
  const [rows, setRows] = useState<TableRow[]>([]);

  // Strip legacy ?q=… from URL on mount so search stays in local state.
  useEffect(() => {
    if (searchParams.has("q") || searchParams.has("status")) {
      const next = new URLSearchParams(searchParams);
      next.delete("q");
      next.delete("status");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [loading, setLoading] = useState(false);
  // const [roles, setRoles] = useState<string[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [viewSubmissionId, setViewSubmissionId] = useState<string | null>(null);
  const [lenderSubmissionId] = useState<string | null>(null);
  const [submissionDetail, setSubmissionDetail] = useState<any>(null);
  const [detailLoading] = useState<boolean>(false);
  const [assignSubBrokerError, setAssignSubBrokerError] = useState("");

  // Find Lenders Modal State
  const [findLenderModalOpen, setFindLenderModalOpen] = useState(false);
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [borrowerSummary, setBorrowerSummary] = useState<any>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentLenders, setSentLenders] = useState<Record<string, boolean>>({});
  const [lenderLoading, setLenderLoading] = useState(false);
  const [lenderSearchQ, setLenderSearchQ] = useState("");
  const [lenderPage, setLenderPage] = useState(1);
  const [lenderLimit, setLenderLimit] = useState(6);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
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

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string>("");

  const [loiModalOpen, setLoiModalOpen] = useState(false);
  const [lois] = useState<any[]>([]);

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
    funded: 0,
  });

  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  const [assignSubBrokerModal, setAssignSubBrokerModal] = useState({
    open: false,
    applicationId: "",
    applicationNumber: "",
  });

  const [subBrokers, setSubBrokers] = useState<any[]>([]);

  const [selectedSubBrokerIds, setSelectedSubBrokerIds] = useState<string[]>([]);

  const [assigningSubBroker, setAssigningSubBroker] = useState(false);

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
  const rowsPerPage = 5;

  const [assignModal, setAssignModal] = useState({
    open: false,
    applicationId: "",
    currentOfficerIds: [] as string[],
  });

  const [loanOfficers, setLoanOfficers] = useState<any[]>([]);
  const [selectedOfficerIds, setSelectedOfficerIds] = useState<string[]>([]);
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
  const [assignLoading, setAssignLoading] = useState(false);

  const navigate = useNavigate();

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

  const getStatusColor = (status?: string) => {
    const s = status?.toLowerCase();

    switch (s) {
      case "new":
        return "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400";

      case "pending":
        return "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400";

      case "client_pending":
        return "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400";

      case "submitted":
        return "bg-violet-500/10 border-violet-500/20 text-violet-600 dark:text-violet-400"; // 🟣 unique

      case "sent":
        return "bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400"; // 🔵

      case "updated":
        return "bg-cyan-500/10 border-cyan-500/20 text-cyan-600 dark:text-cyan-400";

      case "approved":
        return "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400";

      case "lender_approved":
        return "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400"; // 🟢 different from approved

      case "declined":
        return "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400";

      case "lender_declined":
        return "bg-rose-600/10 border-rose-600/20 text-rose-700 dark:text-rose-500"; // 🔴 slightly darker

      case "in_review":
        return "bg-sky-500/10 border-sky-500/20 text-sky-600 dark:text-sky-400"; // 🌊 unique

      case "draft":
        return "bg-gray-400/10 border-gray-400/20 text-gray-600 dark:text-gray-400";

      case "completed":
        return "bg-teal-500/10 border-teal-500/20 text-teal-600 dark:text-teal-400"; // 🟩 different from approved

      case "superseded":
        return "bg-orange-400/10 border-orange-400/20 text-orange-600 dark:text-orange-400";

      case "funded":
        return "bg-emerald-100 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400";

      default:
        return "bg-slate-500/10 border-slate-500/20 text-slate-600 dark:text-slate-400";
    }
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

  const fetchSubBrokers = async () => {
    try {
      const token = sessionStorage.getItem("broker_token");

      const res = await fetch(
        `${API_BASE}/broker/sub-broker/list?page=1&limit=100&status=ACTIVE`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to fetch sub brokers");
      }

      setSubBrokers(json.data || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch sub brokers");
    }
  };

  const handleAssignSubBroker = async () => {
    try {
      setAssignSubBrokerError("");
      const currentRow = rows.find(
        (row) => row.applicationId === assignSubBrokerModal.applicationId,
      );
      if (!canBrokerReassignApplication({ status: currentRow?.status })) {
        const reason = getBrokerReassignmentBlockedReason({
          status: currentRow?.status,
        });
        setAssignSubBrokerError(reason);
        toast.error(reason);
        return;
      }

      if (
        selectedSubBrokerIds.length === 0 &&
        !(currentRow?.assignedSubBrokers || []).length
      ) {
        setAssignSubBrokerError("Please select at least one co-broker");
        return;
      }

      setAssigningSubBroker(true);

      const token = sessionStorage.getItem("broker_token");

      const res = await fetch(
        `${API_BASE}/broker/sub-broker/assign-application`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",

            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            loanApplicationId: assignSubBrokerModal.applicationId,
            subBrokerIds: selectedSubBrokerIds,
          }),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to assign sub broker");
      }

      toast.success(
        selectedSubBrokerIds.length > 1
          ? "Co-brokers updated successfully"
          : "Application assigned successfully",
      );

      setAssignSubBrokerModal({
        open: false,
        applicationId: "",
        applicationNumber: "",
      });

      setSelectedSubBrokerIds([]);
      await refreshPipelineData();
    } catch (err: any) {
      setAssignSubBrokerError(err.message || "Something went wrong");
      toast.error(err.message || "Something went wrong");
    } finally {
      setAssigningSubBroker(false);
    }
  };

  const formatCompactAmount = (value: number) => {
    if (!value || !isFinite(value)) return "$0";

    // Convert scientific notation safely
    const num = Number(value);

    if (num >= 1e9) return `$${(num / 1e9).toFixed(1).replace(/\.0$/, "")}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1).replace(/\.0$/, "")}K`;

    return `$${num}`;
  };

  /* ================= LENDER FETCHING ================= */
  const fetchLenders = async () => {
    if (!lenderSubmissionId) return;

    setLenderPage(1);
    setLenders([]);
    setBorrowerSummary(null);
    setSentLenders({});
    setImageErrors({});

    setLenderLoading(true);

    try {
      const res = await fetch(
        `${API_BASE}/broker/lender-discovery/applications/submissions/${lenderSubmissionId}/eligible`,
        {
          headers: getAuthHeaders(),
          method: "GET",
        },
      );

      const json = await res.json();

      if (!res.ok || json.success !== true) {
        throw new Error(json.message || "Failed to load eligible lenders");
      }

      const data = json.data;
      setBorrowerSummary(data.borrowerData);

      setLenders(
        (data.eligibleLenders || []).map((l: any) => ({
          id: l.lenderOrgId,
          name: l.lenderName,
          email: l.lenderEmail,
          phone: l.lenderPhone,
          profileImage: l.profileImage
            ? `${API_BASE}/public/${l.profileImage}`
            : null,
          loanProductCode: l.loanProductCode,
          minFunding: l.fundingRange?.min,
          maxFunding: l.fundingRange?.max,
          minMonths: l.terms?.minMonths,
          maxMonths: l.terms?.maxMonths,
          interestRateRange: l.interestRateRange,
          fundingSpeedDays: l.lenderProfile?.fundingSpeedDays,
          summary: l.lenderProfile?.summary,
          eligibilityStatus: l.eligible ? "Eligible" : "Rejected",
          lenderProductId: l.lenderProductId,
        })),
      );

      setApplicationId(data.applicationId);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load eligible lenders");
    } finally {
      setLenderLoading(false);
    }
  };

  const fetchSubmissionDocuments = async (submissionId: string) => {
    try {
      setDocumentsLoading(true);
      // setDocumentSubmissionId(submissionId);
      setDocumentModalOpen(true);

      const res = await fetch(
        `${API_BASE}/broker/loan-pipeline/submissions/${submissionId}/documents`,
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

  const sendToLender = async (lenderProductId: string) => {
    if (!lenderSubmissionId || !applicationId) return;

    try {
      setSendingId(lenderProductId);

      const res = await fetch(
        `${API_BASE}/broker/lender-discovery/applications/${applicationId}/submissions/${lenderSubmissionId}/send-to-lenders`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            lenderProductIds: [lenderProductId],
          }),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to send");
      }

      toast.success("Submission processed successfully");

      setSentLenders((prev) => ({
        ...prev,
        [lenderProductId]: true,
      }));

      setRows((prevRows) =>
        prevRows.map((row) =>
          row.submissionId === lenderSubmissionId
            ? { ...row, status: "SENT" }
            : row,
        ),
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to send");
    } finally {
      setSendingId(null);
    }
  };

  // const handleViewLOI = async (submissionId: string) => {
  //   try {
  //     setLoiModalOpen(true);

  //     // STEP 1: get applicationId
  //     const submissionRes = await fetch(
  //       `${API_BASE}/api/public/broker/applications/submissions/${submissionId}`,
  //     );

  //     const submissionData = await submissionRes.json();

  //     if (!submissionRes.ok || !submissionData.success) {
  //       throw new Error(submissionData.message || "Failed to fetch submission");
  //     }

  //     const applicationId = submissionData?.data?.applicationId;

  //     if (!applicationId) {
  //       toast.error("Application ID not found");
  //       return;
  //     }

  //     // STEP 2: get LOIs
  //     const loiRes = await fetch(
  //       `${API_BASE}/broker/loan-pipeline/${applicationId}/lois`,
  //       {
  //         method: "GET",
  //         headers: getAuthHeaders(),
  //       },
  //     );

  //     const loiData = await loiRes.json();

  //     if (!loiRes.ok || !loiData.success) {
  //       throw new Error(loiData.message || "Failed to fetch LOIs");
  //     }

  //     setLois(loiData.data?.lois || []);
  //   } catch (error: any) {
  //     console.error(error);
  //     toast.error(error.message || "Failed to load LOIs");
  //   }
  // };

  useEffect(() => {
    if (findLenderModalOpen && lenderSubmissionId) {
      fetchLenders();
    }
  }, [findLenderModalOpen, lenderSubmissionId]);

  const loadSubmissions = useCallback(
    async (cursor?: string, searchValue?: string, statusValue?: string) => {
      try {
        setLoading(true);

        const url = new URL(API_BASE + "/broker/loan-pipeline/submissions");
        const activeSearch = (searchValue ?? searchTerm).trim();
        const activeStatus = statusValue ?? statusFilter;

        if (activeSearch) {
          url.searchParams.append("search", activeSearch);
        }

        if (activeStatus) {
          url.searchParams.append("status", activeStatus);
        }

        if (cursor) {
          url.searchParams.append("cursor", cursor);
        }

        const res = await fetch(url.toString(), {
          headers: getAuthHeaders(),
        });

        const json = await res.json();

        const list = Array.isArray(json.data) ? json.data : [];

        const formatted = list.map((item: any) => ({
          submissionId: item.submissionId,
          borrowerName: item.borrower || "N/A",
          applicationNumber: item.applicationNumber,
          applicationId: item.applicationId,
          company: "-",
          loanType: item.loanInfo,
          cityState: item.location?.split(",")[0]?.trim() || "N/A",

          country: item.location?.split(",")[1]?.trim() || "",
          amount: Number(item.amount) || 0,
          status: item.status,
          date: item.submittedOn,
          pendingDocumentsCount: item.pendingDocumentsCount,
          assignedOfficerName:
            item.assignedLoanOfficers?.[0]?.name ||
            item.assignedLoanOfficer?.name ||
            null,
          assignedOfficerId:
            item.assignedLoanOfficers?.[0]?.id ||
            item.assignedLoanOfficer?.id ||
            null,
          assignedOfficerImage:
            item.assignedLoanOfficers?.[0]?.profileImage ||
            item.assignedLoanOfficer?.profileImage ||
            null,
          assignedLoanOfficers: Array.isArray(item.assignedLoanOfficers)
            ? item.assignedLoanOfficers
            : item.assignedLoanOfficer
              ? [item.assignedLoanOfficer]
              : [],
          assignedSubBrokers: item.assignedSubBrokers || [],
        }));

        setRows((prev) => (cursor ? [...prev, ...formatted] : formatted));

        setNextCursor(json.pagination.nextCursor);
        setHasMore(json.pagination.hasMore);        
      } finally {
        setLoading(false);
      }
    },  
    [searchTerm, statusFilter],
  );

  const fetchPipelineStats = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/broker/loan-pipeline/pipeline-stats`,
        {
          headers: getAuthHeaders(),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to fetch stats");
      }

      setPipelineStats(json.data);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load stats");
    }
  };

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

      const token = sessionStorage.getItem("broker_token");

      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(
          `${API_BASE}/broker/loan-pipeline/submissions/${submissionId}/documents/${requirementId}/upload`,
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
      <p className="text-[14px] font-semibold text-[#2C92D5]">{value}</p>
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

      case "FUNDED":
        return "bg-teal-100 text-teal-800 dark:bg-teal-500/10 dark:text-teal-400";

      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300";
    }
  };

  const handleSendClientLink = async (applicationId: string) => {
    // console.log(applicationId);
    try {
      const token = sessionStorage.getItem("broker_token");

      const res = await fetch(
        `${API_BASE}/broker/loan-pipeline/${applicationId}/send-client-link`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({}),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to send client link");
      }

      toast.success("Client link sent successfully");
      await refreshPipelineData();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    }
  };
  
  useEffect(() => {
    loadSubmissions(undefined, initialQuery || undefined, statusFilter);
    fetchPipelineStats();
  }, []);

  useEffect(() => {
    if (skipStatusReloadRef.current) {
      skipStatusReloadRef.current = false;
      return;
    }
    loadSubmissions(undefined, searchTerm, statusFilter);
  }, [statusFilter]);

  const refreshPipelineData = useCallback(async () => {
    await Promise.all([
      loadSubmissions(undefined, searchTerm, statusFilter),
      fetchPipelineStats(),
    ]);
  }, [loadSubmissions, searchTerm, statusFilter]);

  const handleRefresh = () => {
    void refreshPipelineData();
  };

  // Client-side search across the already-loaded rows.
  // Matches against any visible column: borrower, application #, officer,
  // location, status, loan type, sub-broker, or amount.
  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((row) => {
      const officerNames = (row.assignedLoanOfficers || [])
        .map((officer) => officer.name)
        .join(" ");
      const subBrokerNames = (row.assignedSubBrokers || [])
        .map((b: any) =>
          [b.firstName, b.lastName, b.name, b.email].filter(Boolean).join(" "),
        )
        .join(" ");

      const haystack = [
        row.borrowerName,
        row.applicationNumber,
        row.assignedOfficerName,
        officerNames,
        row.cityState,
        row.country,
        row.company,
        row.loanType,
        formatStatusLabel(row.status),
        subBrokerNames,
        String(row.amount ?? ""),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [rows, searchTerm]);

  const loanOfficerOptions = useMemo(
    () =>
      loanOfficers.map((officer) => {
        const name =
          `${officer.firstName || ""} ${officer.lastName || ""}`.trim();
        return {
          value: officer.id as string,
          text: name
            ? `${name}${officer.email ? ` (${officer.email})` : ""}`
            : officer.email || officer.id,
        };
      }),
    [loanOfficers],
  );

  const subBrokerOptions = useMemo(
    () =>
      subBrokers.map((broker) => {
        const name = `${broker.firstName || ""} ${broker.lastName || ""}`.trim();
        return {
          value: broker.id as string,
          text: name
            ? `${name}${broker.email ? ` (${broker.email})` : ""}`
            : broker.email || broker.id,
        };
      }),
    [subBrokers],
  );

  const openPreview = (submissionId: string) => {
    navigate("/loan-preview", { state: { submissionId } });
  };

  useEffect(() => {
    if (viewSubmissionId || findLenderModalOpen) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [viewSubmissionId, findLenderModalOpen]);

  const filteredLenders = lenders.filter(
    (l) =>
      l.name.toLowerCase().includes(lenderSearchQ.toLowerCase()) ||
      l.email?.toLowerCase().includes(lenderSearchQ.toLowerCase()),
  );

  const totalPages = Math.ceil(rows.length / rowsPerPage);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      const target = event.target as Node;

      if (dropdownRef.current?.contains(target)) {
        return;
      }

      if (
        target instanceof HTMLElement &&
        target.closest("[data-dropdown-trigger]")
      ) {
        return;
      }

      setActiveDropdown(null);
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!activeDropdown) return;

    const handleScroll = () => {
      const btn = document.querySelector(
        `[data-id="${activeDropdown}"]`,
      ) as HTMLElement;

      if (!btn) return;

      const rect = btn.getBoundingClientRect();

      setDropdownPos({
        top: rect.top - 8,
        left: rect.right - 192,
      });
    };

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [activeDropdown]);

  useEffect(() => {
    if (!loadMoreRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const first = entries[0];

        if (first.isIntersecting && hasMore && !loading && nextCursor) {
          loadSubmissions(nextCursor);
        }
      },
      { threshold: 1 },
    );

    observerRef.current.observe(loadMoreRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [hasMore, loading, nextCursor]);

  // useEffect(() => {
  //   const storedRoles = JSON.parse(sessionStorage.getItem("roles") || "[]");
  //   setRoles(storedRoles);
  // }, []);

  // const isBrokerOfficer = roles.includes("BROKER_OFFICER");

  // const fetchDocumentTypes = async (applicationId: string) => {
  //   try {
  //     const brokerToken = sessionStorage.getItem("broker_token");

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
      const brokerToken = sessionStorage.getItem("broker_token");

      if (!brokerToken) {
        toast.error("Unauthorized");
        return;
      }

      if (docSelectModal.selectedDocs.length === 0) {
        toast.error("Please select at least one document");
        return;
      }

      const url = `${API_BASE}/broker/loan-pipeline/${docSelectModal.applicationId}/request-documents`;

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

  const fetchLoanOfficers = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/broker/users?page=1&limit=100&role=BROKER_OFFICER&status=ACTIVE`,
        {
          headers: getAuthHeaders(),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error("Failed to fetch loan officers");
      }

      const officers = (Array.isArray(json.data) ? json.data : []).filter(
        (u: any) => u.roles?.includes("BROKER_OFFICER"),
      );

      return officers;
    } catch (err) {
      toast.error("Failed to load loan officers");
      return [];
    }
  };

  const openAssignModal = async (
    applicationId: string,
    currentOfficerIds?: string[],
    pipelineStatus?: string | null,
  ) => {
    if (!canBrokerReassignApplication({ status: pipelineStatus })) {
      toast.error(
        getBrokerReassignmentBlockedReason({ status: pipelineStatus }),
      );
      return;
    }

    const officerIds = (currentOfficerIds || []).filter(Boolean);
    setAssignModal({
      open: true,
      applicationId,
      currentOfficerIds: officerIds,
    });
    setSelectedOfficerIds(officerIds);
    setAssignError("");
    const officers = await fetchLoanOfficers();
    setLoanOfficers(officers);
  };

  const handleAssignLoanOfficer = async () => {
    const currentRow = rows.find(
      (row) => row.applicationId === assignModal.applicationId,
    );
    if (!canBrokerReassignApplication({ status: currentRow?.status })) {
      setAssignError(
        getBrokerReassignmentBlockedReason({ status: currentRow?.status }),
      );
      return;
    }

    if (
      selectedOfficerIds.length === 0 &&
      assignModal.currentOfficerIds.length === 0
    ) {
      setAssignError("Please select at least one loan officer");
      return;
    }

    try {
      setAssignLoading(true);
      setAssignError("");

      const res = await fetch(
        `${API_BASE}/broker/applications/${assignModal.applicationId}/assign`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({ loanOfficerIds: selectedOfficerIds }),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Assignment failed");
      }

      toast.success(
        selectedOfficerIds.length > 1
          ? "Loan officers updated successfully"
          : assignModal.currentOfficerIds.length
            ? "Loan officer updated successfully"
            : "Loan officer assigned successfully",
      );
      setAssignModal({
        open: false,
        applicationId: "",
        currentOfficerIds: [],
      });
      setSelectedOfficerIds([]);
      await refreshPipelineData();
    } catch (err: any) {
      setAssignError(err.message || "Something went wrong");
    } finally {
      setAssignLoading(false);
    }
  };

  let fetching = false;

  useEffect(() => {
    const onScroll = () => {
      if (fetching) return;

      if (
        window.innerHeight + window.scrollY >=
          document.body.offsetHeight - 200 &&
        hasMore &&
        !loading &&
        nextCursor
      ) {
        fetching = true;

        loadSubmissions(nextCursor).finally(() => {
          fetching = false;
        });
      }
    };

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [hasMore, nextCursor, loading]);

  // const handleReload = () => {
  //   loadSubmissions();
  // };

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <PageMeta
        title="Loan Pipeline | Broker Dashboard"
        description="Track and manage broker loan applications"
      />

      <div className="mx-auto w-full min-w-0 max-w-[1400px] space-y-6">
        {/* Hero */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-[#13538A] via-[#1a6aad] to-[#2C92D5] p-6 text-white shadow-sm dark:border-gray-800 lg:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:gap-10">
            <div className="min-w-0 flex-1">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                <TrendingUp className="h-3.5 w-3.5" />
                Pipeline Management
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Loan Pipeline
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-white/80">
                {pipelineStats.totalApplications} total application
                {pipelineStats.totalApplications === 1 ? "" : "s"} ·{" "}
                {formatCompactAmount(pipelineStats.totalVolume)} pipeline volume
              </p>
            </div>

            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4 xl:w-[min(100%,520px)] xl:shrink-0">
              {[
                { label: "Total Apps", value: pipelineStats.totalApplications },
                { label: "Submitted", value: pipelineStats.submitted },
                { label: "In Review", value: pipelineStats.inReview },
                { label: "Approved", value: pipelineStats.approved },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/20 backdrop-blur-sm"
                >
                  <p className="text-xs text-white/70">{label}</p>
                  <p className="mt-1 text-2xl font-semibold">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <ShareClientApplicationLink />

        {/* Toolbar */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  placeholder="Search borrower, app no., officer..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                  }}
                  className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-10 text-sm outline-none focus:border-[#13538A]/40 focus:ring-2 focus:ring-[#13538A]/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm("");
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                <button
                  type="button"
                  onClick={() => navigate("/loan-application")}
                  className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-[#2C92D5] px-4 text-sm font-medium text-white transition hover:bg-[#2379b3] sm:flex-none"
                >
                  + New Application
                </button>

                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={loading}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-gray-500">Status:</span>
              {STATUS_FILTERS.map((filter) => {
                const count = pipelineStats[filter.statKey] ?? 0;
                const active = statusFilter === filter.value;
                return (
                  <button
                    key={filter.value || "all"}
                    type="button"
                    onClick={() => setStatusFilter(filter.value)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? "bg-[#13538A] text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                  >
                    {filter.label}
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                        active ? "bg-white/20" : "bg-white dark:bg-gray-900"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800 lg:px-8">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Applications
              </h2>
              <p className="text-xs text-gray-500">
                {loading && rows.length === 0
                  ? "Loading..."
                  : searchTerm
                    ? `${filteredRows.length} of ${rows.length} shown`
                    : `${rows.length} shown${hasMore ? "+" : ""}`}
                {statusFilter ? ` · ${formatStatusLabel(statusFilter)}` : ""}
              </p>
            </div>
          </div>

          <div className="min-w-0">
            <table className="w-full table-fixed text-left">
              <colgroup>
                <col className="w-[19%]" />
                <col className="w-[15%]" />
                <col className="w-[12%]" />
                <col className="w-[7%]" />
                <col className="w-[9%]" />
                <col className="w-[11%]" />
                <col className="w-[12%]" />
                <col className="w-[7%]" />
                <col className="w-[8%]" />
              </colgroup>
              <thead className="bg-gray-50/80 dark:bg-gray-800/50">
                <tr>
                  {[
                    "Borrower",
                    "Application",
                    "Location",
                    "Amount",
                    "Submitted",
                    "Status",
                    "Loan Officer",
                    "Co Brokers",
                    "",
                  ].map((label) => (
                    <th
                      key={label || "actions"}
                      className="overflow-hidden px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 first:pl-6 last:pr-6 lg:first:pl-8 lg:last:pr-8"
                    >
                      <span className="block truncate">{label}</span>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loading && rows.length === 0 ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td
                        colSpan={9}
                        className="px-4 py-4 first:pl-6 last:pr-6 lg:px-5 lg:first:pl-8 lg:last:pr-8"
                      >
                        <div className="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
                      </td>
                    </tr>
                  ))
                ) : Array.isArray(filteredRows) && filteredRows.length > 0 ? (
                  filteredRows.map((row) => (
                    <tr
                      key={row.submissionId}
                      className="group cursor-pointer transition hover:bg-[#13538A]/[0.03] dark:hover:bg-gray-800/50"
                    >
                      <td
                        onClick={() => openPreview(row.submissionId)}
                        className="overflow-hidden px-3 py-3 align-middle first:pl-6 lg:first:pl-8"
                        title={row.borrowerName}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#13538A]/10 text-xs font-semibold text-[#13538A]">
                            {getInitials(row.borrowerName)}
                          </div>
                          <span className="truncate text-sm font-medium text-gray-900 dark:text-white">
                            {row.borrowerName || "Untitled"}
                          </span>
                        </div>
                      </td>

                      <td
                        onClick={() => openPreview(row.submissionId)}
                        className="overflow-hidden px-3 py-3 align-middle"
                        title={row.applicationNumber}
                      >
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-sm text-gray-800 dark:text-gray-200">
                            {row.applicationNumber || "—"}
                          </span>
                          {row.pendingDocumentsCount ? (
                            <span className="shrink-0 rounded bg-amber-50 px-1 py-0.5 text-[10px] font-medium text-amber-700">
                              {row.pendingDocumentsCount}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td
                        onClick={() => openPreview(row.submissionId)}
                        className="overflow-hidden px-3 py-3 align-middle"
                        title={[row.cityState, row.country]
                          .filter(Boolean)
                          .join(", ")}
                      >
                        <div className="flex min-w-0 items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          <span className="truncate">
                            {[row.cityState, row.country]
                              .filter(Boolean)
                              .join(", ") || "—"}
                          </span>
                        </div>
                      </td>

                      <td
                        onClick={() => openPreview(row.submissionId)}
                        className="overflow-hidden px-3 py-3 align-middle font-mono text-sm text-gray-800 dark:text-gray-200"
                      >
                        <span className="block truncate">
                          {formatCompactAmount(Number(row.amount || 0))}
                        </span>
                      </td>

                      <td
                        onClick={() => openPreview(row.submissionId)}
                        className="overflow-hidden px-3 py-3 align-middle text-sm text-gray-600 dark:text-gray-400"
                      >
                        <span className="block truncate">
                          {formatShortDate(row.date)}
                        </span>
                      </td>

                      <td
                        onClick={() => openPreview(row.submissionId)}
                        className="overflow-hidden px-3 py-3 align-middle"
                      >
                        <span
                          className={`inline-flex max-w-full items-center truncate rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getStatusColor(row.status)}`}
                          title={formatStatusLabel(row.status)}
                        >
                          {formatStatusLabel(row.status)} 
                        </span>
                      </td>

                      <td
                        onClick={() => openPreview(row.submissionId)}
                        className="overflow-hidden px-3 py-3 align-middle"
                      >
                        <AssigneePills
                          people={row.assignedLoanOfficers || []}
                          pillClassName="bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                          onShowAll={() =>
                            setPeopleModal({
                              open: true,
                              title: "Assigned Loan Officers",
                              roleLabel: "Loan Officer",
                              people: row.assignedLoanOfficers || [],
                            })
                          }
                        />
                      </td>

                      <td
                        onClick={() => openPreview(row.submissionId)}
                        className="overflow-hidden px-3 py-3 align-middle"
                      >
                        <AssigneePills
                          people={row.assignedSubBrokers || []}
                          pillClassName="bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300"
                          onShowAll={() =>
                            setPeopleModal({
                              open: true,
                              title: "Assigned Co-Brokers",
                              roleLabel: "Co-Broker",
                              people: row.assignedSubBrokers || [],
                            })
                          }
                        />
                      </td>
  
                      <td
                        className="overflow-hidden px-2 py-3 pr-6 text-right align-middle lg:pr-8"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center justify-end">
                          <button
                            type="button"
                            title="More actions"
                            data-id={row.submissionId}
                            data-dropdown-trigger
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect =
                                e.currentTarget.getBoundingClientRect();
                              setDropdownPos({
                                top: rect.top - 8,
                                left: rect.right - 192,
                              });
                              setActiveDropdown(
                                activeDropdown === row.submissionId
                                  ? null
                                  : row.submissionId,
                              );
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                          >
                            <MoreVertical size={16} />
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
                              className="z-[9999] w-48 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900"
                            >
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveDropdown(null);
                                  openPreview(row.submissionId);
                                }}
                                className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[#13538A] hover:bg-gray-50 dark:hover:bg-gray-800"
                              >
                                <Eye size={14} />
                                Open Application
                              </button>
                              {row.status === "DRAFT" && (
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveDropdown(null);
                                    handleSendClientLink(row.applicationId);
                                  }}
                                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-orange-600 hover:bg-orange-50"
                                >
                                  <Send size={14} />
                                  Send Client Link
                                </button>
                              )}
                              {canBrokerReassignApplication({
                                status: row.status,
                              }) && (
                                <>
                                  <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveDropdown(null);
                                      openAssignModal(
                                        row.applicationId,
                                        (row.assignedLoanOfficers || []).map(
                                          (officer) => officer.id,
                                        ),
                                        row.status,
                                      );
                                    }}
                                    className="flex w-full items-center gap-3 px-4 py-3 text-sm text-indigo-600 hover:bg-indigo-50"
                                  >
                                    <MdEdit size={14} />
                                    {row.assignedLoanOfficers?.length
                                      ? "Change Officers"
                                      : "Assign Officers"}
                                  </button>
                                  <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (
                                        !canBrokerReassignApplication({
                                          status: row.status,
                                        })
                                      ) {
                                        toast.error(
                                          getBrokerReassignmentBlockedReason({
                                            status: row.status,
                                          }),
                                        );
                                        return;
                                      }
                                      setActiveDropdown(null);
                                      setSelectedSubBrokerIds(
                                        (row.assignedSubBrokers || []).map(
                                          (broker) => broker.id,
                                        ),
                                      );
                                      setAssignSubBrokerModal({
                                        open: true,
                                        applicationId: row.applicationId,
                                        applicationNumber:
                                          row.applicationNumber || "",
                                      });
                                      fetchSubBrokers();
                                    }}
                                    className="flex w-full items-center gap-3 px-4 py-3 text-sm text-cyan-600 hover:bg-cyan-50"
                                  >
                                    <MdEdit size={14} />
                                    {(row.assignedSubBrokers || []).length
                                      ? "Change Co Brokers"
                                      : "Assign Co Brokers"}
                                  </button>
                                </>
                              )}
                            </div>,
                            document.body,
                          )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-6 py-20 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-gray-800">
                          <SearchX className="h-6 w-6" />
                        </div>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                          {searchTerm || statusFilter
                            ? "No matching applications"
                            : "No applications yet"}
                        </h3>
                        <p className="mt-2 text-sm text-gray-500">
                          {searchTerm || statusFilter
                            ? "Try a different search or clear your filters."
                            : "Create your first loan application to get started."}
                        </p>
                        {!searchTerm && !statusFilter && (
                          <button
                            type="button"
                            onClick={() => navigate("/loan-application")}
                            className="mt-4 rounded-xl bg-[#2C92D5] px-4 py-2 text-sm font-medium text-white hover:bg-[#2379b3]"
                          >
                            + Create Application
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div ref={loadMoreRef} className="px-6 py-6 text-center lg:px-8">
              {loading && rows.length > 0 && (
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-[#13538A]" />
              )}
              {!loading && hasMore && (
                <p className="text-xs text-gray-400">
                  Scroll for more applications
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

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
                                            shadow-xl dark:shadow-black/40"
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
                        getFieldValue(submissionDetail.fields, "netWorth") ?? 0,
                      ) || 0;

                    const submittedDate = new Date(
                      submissionDetail.submittedAt,
                    );
                    const formattedDate = submittedDate.toLocaleDateString();
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
                            className={`relative overflow-hidden rounded-2xl border p-6 mb-8 shadow-md
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
                          className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm
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
                                    {primaryFields.map((f: any, i: number) => (
                                      <FieldItem key={i} field={f} />
                                    ))}
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
                                        shadow-sm 
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

      {peopleModal.open &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div
              className="
        w-full max-w-2xl
        rounded-2xl
        bg-white dark:bg-slate-900
        border border-slate-200 dark:border-slate-800
        shadow-2xl
        overflow-hidden
      "
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {peopleModal.title}
                </h3>

                <button
                  onClick={() =>
                    setPeopleModal({
                      open: false,
                      title: "",
                      roleLabel: "",
                      people: [],
                    })
                  }
                  className="text-slate-400 hover:text-red-500 text-lg"
                >
                  ✕
                </button>
              </div>

              <div
                className="
  p-5
  grid grid-cols-1 sm:grid-cols-2 gap-4

  max-h-[70vh]
  overflow-y-auto

  scrollbar-thin
  scrollbar-thumb-slate-300
  dark:scrollbar-thumb-slate-700
  scrollbar-track-transparent

  overscroll-contain
"
              >
                {peopleModal.people.map((person) => (
                  <div
                    key={person.id}
                    className="
  relative overflow-hidden
  rounded-2xl
  border border-slate-200 dark:border-slate-700
  bg-white dark:bg-slate-800/40
  p-4
  hover:-translate-y-0.5
  transition-all duration-300
"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="
      h-12 w-12 rounded-2xl
      bg-gradient-to-br from-cyan-500 to-blue-500
      flex items-center justify-center
      text-white
      font-bold text-base
      shrink-0
    "
                      >
                        {person.name?.charAt(0) || "?"}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4
                          className="
        text-sm font-semibold
        text-slate-800 dark:text-slate-100
        truncate
      "
                        >
                          {person.name}
                        </h4>

                        <p
                          className="
        mt-1 text-xs
        text-slate-500 dark:text-slate-400
      "
                        >
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

      {/* FIND LENDERS MODAL */}
      {findLenderModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 bg-black/40 dark:bg-black/70 backdrop-blur-[1px] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto shadow-xl dark:shadow-black/40 flex flex-col">
              {/* HEADER */}
              <div className="flex items-center justify-between px-6 py-3 border-b dark:border-slate-800 shrink-0">
                <div>
                  <h2 className="font-bold text-lg">Find Lenders</h2>
                  <p className="text-xs text-slate-500">
                    Connect with verified lenders
                  </p>
                </div>
                <button
                  onClick={() => {
                    setFindLenderModalOpen(false);
                    setLenders([]);
                    setBorrowerSummary(null);
                    setSentLenders({});
                    setImageErrors({});
                    setApplicationId(null);
                  }}
                  className="text-slate-400 hover:text-red-500 text-xl"
                >
                  ✕
                </button>
              </div>

              {/* CONTENT */}
              <div className="p-6 overflow-y-auto bg-gray-50 dark:bg-slate-950">
                {/* Filters */}
                <div className="mb-6 flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      value={lenderSearchQ}
                      onChange={(e) => {
                        setLenderPage(1);
                        setLenderSearchQ(e.target.value);
                      }}
                      placeholder="Search lenders by name or email..."
                      className="w-full pl-10 pr-4 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <select
                    value={lenderLimit}
                    onChange={(e) => {
                      setLenderPage(1);
                      setLenderLimit(Number(e.target.value));
                    }}
                    className="px-4 py-2 rounded-xl text-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  >
                    <option value={6}>6 / page</option>
                    <option value={9}>9 / page</option>
                    <option value={12}>12 / page</option>
                  </select>
                </div>

                {borrowerSummary &&
                  borrowerSummary.loanAmount &&
                  borrowerSummary.borrowerMinTerm &&
                  borrowerSummary.borrowerMaxTerm &&
                  borrowerSummary.creditScore && (
                    <div className="mb-6 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 p-4 rounded-xl">
                      <div className="text-sm font-semibold text-[#2C92D5] dark:text-blue-400 mb-2">
                        Borrower Summary
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="font-semibold">Loan Amount:</span>
                          <div>
                            $
                            {Number(
                              borrowerSummary.loanAmount,
                            ).toLocaleString()}
                          </div>
                        </div>

                        <div>
                          <span className="font-semibold">Term:</span>
                          <div>
                            {borrowerSummary.borrowerMinTerm} -{" "}
                            {borrowerSummary.borrowerMaxTerm} months
                          </div>
                        </div>

                        <div>
                          <span className="font-semibold">Credit Score:</span>
                          <div>{borrowerSummary.creditScore}</div>
                        </div>

                        <div>
                          <span className="font-semibold">
                            Eligible Lenders:
                          </span>
                          <div>{lenders.length}</div>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Loading */}
                {lenderLoading && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse"
                      />
                    ))}
                  </div>
                )}

                {/* Empty State */}
                {!lenderLoading && lenders.length === 0 && (
                  <div className="text-center py-10">
                    <div className="w-16 h-16 mx-auto bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4">
                      <SearchX className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="font-bold text-slate-700 dark:text-slate-300">
                      No lenders found
                    </h3>
                    <p className="text-sm text-slate-500">
                      Try adjusting your search terms
                    </p>
                  </div>
                )}

                {/* Lenders Grid */}
                {!lenderLoading && lenders.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredLenders
                      .slice(
                        (lenderPage - 1) * lenderLimit,
                        lenderPage * lenderLimit,
                      )
                      .map((l) => (
                        <div
                          key={l.id}
                          className="group relative bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 transition-all duration-300 hover:shadow-md"
                        >
                          {/* Header */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              {/* Profile Image / Fallback Icon */}
                              <div
                                className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center 
                    bg-slate-100 dark:bg-slate-800 
                    border border-slate-200 dark:border-slate-700"
                              >
                                {l.profileImage && !imageErrors[l.id] ? (
                                  <img
                                    src={l.profileImage}
                                    alt={l.name}
                                    className="w-full h-full object-cover"
                                    onError={() =>
                                      setImageErrors((prev) => ({
                                        ...prev,
                                        [l.id]: true,
                                      }))
                                    }
                                  />
                                ) : (
                                  <Building2 className="w-6 h-6 text-slate-500 dark:text-slate-400" />
                                )}
                              </div>

                              {/* Name + Email */}
                              <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                  {l.name}
                                </h3>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {l.email || "No email available"}
                                </div>
                              </div>
                            </div>

                            {/* Eligibility Badge */}
                            <span
                              className={`text-xs font-bold px-2 py-1 rounded-full ${
                                l.eligibilityStatus === "Eligible"
                                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                                  : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                              }`}
                            >
                              {l.eligibilityStatus}
                            </span>
                          </div>

                          {/* Loan Product */}
                          <div className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3">
                            Product: {l.loanProductCode}
                          </div>

                          {/* Funding Range */}
                          <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            Funding: ${Number(l.minFunding).toLocaleString()} -
                            ${Number(l.maxFunding).toLocaleString()}
                          </div>

                          {/* Terms */}
                          <div className="text-sm mt-1 text-slate-600 dark:text-slate-400">
                            Term: {l.minMonths} - {l.maxMonths} months
                          </div>

                          {/* Interest */}
                          <div className="text-sm mt-1 text-slate-600 dark:text-slate-400">
                            Interest: {l.interestRateRange}
                          </div>

                          {/* Funding Speed */}
                          <div className="text-sm mt-1 text-slate-600 dark:text-slate-400">
                            Funding Speed: {l.fundingSpeedDays} Days
                          </div>

                          {/* Send Button */}
                          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                            <button
                              disabled={
                                sendingId === l.lenderProductId ||
                                sentLenders[l.lenderProductId]
                              }
                              onClick={async () => {
                                const result = await Swal.fire({
                                  title: "Send to Lender?",
                                  text: `Are you sure you want to send this application to ${l.name}?`,
                                  icon: "question",
                                  showCancelButton: true,
                                  confirmButtonColor: "#2563eb",
                                  cancelButtonColor: "#d33",
                                  confirmButtonText: "Yes, Send",
                                  cancelButtonText: "Cancel",
                                });

                                if (result.isConfirmed) {
                                  sendToLender(l.lenderProductId);
                                }
                              }}
                              className={`w-full py-2 rounded-lg text-sm font-semibold transition-all
      ${
        sentLenders[l.lenderProductId]
          ? "bg-emerald-500 text-white cursor-not-allowed"
          : "bg-[#2C92D5] hover:bg-[#227dba] text-white"
      }
      disabled:opacity-60 disabled:cursor-not-allowed
    `}
                            >
                              {sendingId === l.lenderProductId ? (
                                <div className="flex items-center justify-center gap-2">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Sending...
                                </div>
                              ) : sentLenders[l.lenderProductId] ? (
                                "Sent"
                              ) : (
                                "Send to Lender"
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {/* Pagination */}
                {!lenderLoading && filteredLenders.length > lenderLimit && (
                  <div className="mt-8 flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-4">
                    <p className="text-xs text-slate-500">
                      Page {lenderPage} of{" "}
                      {Math.ceil(filteredLenders.length / lenderLimit)}
                    </p>
                    <div className="flex gap-2">
                      <button
                        disabled={lenderPage === 1}
                        onClick={() => setLenderPage((p) => p - 1)}
                        className="p-2 rounded-lg border dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        disabled={
                          lenderPage >=
                          Math.ceil(filteredLenders.length / lenderLimit)
                        }
                        onClick={() => setLenderPage((p) => p + 1)}
                        className="p-2 rounded-lg border dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
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
shadow-[0_20px_60px_rgba(0,0,0,0.15)] 
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
                    {documentsData.documents.map((doc: any, index: number) => {
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
shadow-sm
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

                              {(previewFiles[doc.requirementId]?.length > 0 ||
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
                              {previewFiles[doc.requirementId]?.length > 0 && (
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
                                                ...(prev[doc.requirementId] ||
                                                  []),
                                              ];
                                              updated.splice(i, 1);
                                              const copy = { ...prev };
                                              if (updated.length === 0)
                                                delete copy[doc.requirementId];
                                              else
                                                copy[doc.requirementId] =
                                                  updated;
                                              return copy;
                                            });

                                            setSelectedFiles((prev) => {
                                              const updated = [
                                                ...(prev[doc.requirementId] ||
                                                  []),
                                              ];
                                              updated.splice(i, 1);
                                              const copy = { ...prev };
                                              if (updated.length === 0)
                                                delete copy[doc.requirementId];
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
                                          ...(prev[doc.requirementId] || []),
                                          ...validFiles,
                                        ],
                                      }));

                                      setPreviewFiles((prev) => ({
                                        ...prev,
                                        [doc.requirementId]: [
                                          ...(prev[doc.requirementId] || []),
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
                              {selectedFiles[doc.requirementId]?.length > 0 && (
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
                              {doc.uploadedFiles.map((file: any, i: number) => {
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
                              })}
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
                    })}
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
            <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl shadow-xl">
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
            <div className="w-full max-w-6xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col h-[90vh] overflow-hidden">
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
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-100">
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

      {assignModal.open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-6">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">
              {assignModal.currentOfficerIds.length
                ? "Change Loan Officers"
                : "Assign Loan Officers"}
            </h3>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              Select one or more loan officers. Remove a name to unassign them
              from this application.
            </p>

            <MultiSelect
              label="Loan Officers"
              options={loanOfficerOptions}
              value={selectedOfficerIds}
              onChange={setSelectedOfficerIds}
              placeholder={
                loanOfficerOptions.length
                  ? "Select loan officers"
                  : "No loan officers found"
              }
            />

            {assignError && (
              <div
                className="mt-4 px-3 py-2 rounded-lg border border-red-200 bg-red-50 
  text-red-600 text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-400"
              >
                {assignError}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setAssignModal({
                    open: false,
                    applicationId: "",
                    currentOfficerIds: [],
                  });
                  setSelectedOfficerIds([]);
                }}
                className="px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 
          text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>

              <button
                onClick={handleAssignLoanOfficer}
                disabled={assignLoading}
                className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white 
          hover:bg-indigo-700 disabled:opacity-50"
              >
                {assignLoading
                  ? "Saving..."
                  : assignModal.currentOfficerIds.length
                    ? "Update"
                    : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}

      {assignSubBrokerModal.open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[32px] border border-white/20 bg-white p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900">
                Assign Co-Brokers
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Select one or more co-brokers. Remove a name to unassign them
                from this application.
              </p>
            </div>

            <MultiSelect
              label="Co-Brokers"
              options={subBrokerOptions}
              value={selectedSubBrokerIds}
              onChange={(ids) => {
                setSelectedSubBrokerIds(ids);
                setAssignSubBrokerError("");
              }}
              placeholder={
                subBrokerOptions.length
                  ? "Select co-brokers"
                  : "No co-brokers found"
              }
            />
            {assignSubBrokerError && (
              <p className="mt-3 text-sm font-medium text-red-500">
                {assignSubBrokerError}
              </p>
            )}

            <div className="mt-8 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setAssignSubBrokerModal({
                    open: false,
                    applicationId: "",
                    applicationNumber: "",
                  });
                  setSelectedSubBrokerIds([]);
                }}
                className="h-12 rounded-2xl border border-slate-200 px-5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                onClick={handleAssignSubBroker}
                disabled={assigningSubBroker}
                className="h-12 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {assigningSubBroker ? "Saving..." : "Save Assignments"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
