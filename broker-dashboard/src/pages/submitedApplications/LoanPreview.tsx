import {
  ArrowLeft,
  Activity,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  DollarSign,
  Eye,
  FileSearch,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  MoreVertical,
  Pencil,
  Search,
  SearchX,
  Send,
  Upload,
} from "lucide-react";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { useLocation, useNavigate } from "react-router";
import { motion } from "framer-motion";
import Select, { components } from "react-select";

import { FiFolder, FiSend, FiTag, FiUser } from "react-icons/fi";
import Swal from "sweetalert2";
import { FaRegCreditCard } from "react-icons/fa6";
import { mapSubmissionToLoanApplication } from "../../lib/mapSubmissionToLoanApplication";
import {
  expandDocumentsForDisplay,
  getCoBrokerSendableToPrincipalBrokerIds,
  getDocumentSourceDisplay,
  getDocumentRequestDisplay,
  getUploadFileSentLabel,
  buildDocumentRequestHistoryByTypeId,
  formatDocumentTimelineDate,
  matchesDocumentSentFilter,
  type DocumentDisplayRow,
  type DocumentRequestHistoryEntry,
  type DocumentSentFilter,
  type DocumentSourceFilter,
} from "../../lib/documentLenderSend";
import DocumentControlsBar from "../../components/documents/DocumentControlsBar";
import DocumentActivityModal from "../../components/documents/DocumentActivityModal";
import DocumentStatusCell from "../../components/documents/DocumentStatusCell";
import EmbeddedFilePreview from "../../components/documents/EmbeddedFilePreview";
import SignDocumentsPanel from "../../components/documents/SignDocumentsPanel";
import DocumentReminderPanel from "../../components/loanPipeline/DocumentReminderPanel";
import BrokerLoiPanel from "../../components/loi/BrokerLoiPanel";
import SubmissionDetailsView from "../../components/submissions/SubmissionDetailsView";
import LoanCommissionPanel from "../../components/commissions/LoanCommissionPanel";
import { mapSubmissionDetailFields } from "../../lib/submissionFieldUtils";
import {
  canLenderReceiveDocuments,
  getLenderStatusBadgeClass,
} from "../../lib/lenderDocumentDelivery";
import {
  canBrokerRequestDocuments,
  getBrokerRequestDocumentsDisabledReason,
} from "../../lib/brokerDocumentRequest";
import { buildApiPublicFileUrl } from "../../lib/publicFileUrl";
import { getPortalToken, getPortalAuthHeaders, assertPortalApiOk } from "../../lib/portalAuth";
import { isSessionExpiredError } from "../../lib/sessionExpiry";
import {
  getLoanPreviewConfig,
  type LoanPreviewPortal,
} from "../../lib/loanPreviewConfig";
import { useLoanPreviewSessionMonitor } from "../../hooks/useSessionMonitor";
import { hasPermission } from "../../lib/brokerPermissions";
import { ensureChatSocket } from "../../lib/chatSocketManager";
import { getOrgIdsFromToken } from "../../lib/chatSocket";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

// type SubmissionField = {
//   fieldId: string | null;
//   fieldKey: string | null;
//   label?: string | null;
//   type?: string | null;
//   value: string;
//   sectionName?: string | null;
//   sectionSortOrder?: number | null;
//   fieldSortOrder?: number | null;
// };

type Lender = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  profileImage?: string | null;

  loanProductCode: string;
  minFunding: number;
  maxFunding: number;
  minMonths: number;
  maxMonths: number;
  interestRateRange: string;

  fundingSpeedDays?: number;
  summary?: string;

  lenderProductId: string;

  // NEW FIELDS (REQUIRED)
  type: "eligible" | "ineligible" | "rejected" | "sent";
  alreadySent: boolean;
  canSend: boolean;
  applicationStatus?: string;
  rejectionReasons: string[];
};

type TabKey =
  | "view-details"
  | "update-application"
  | "find-lenders"
  | "request-document"
  | "email-reminders"
  | "view-loi"
  | "documents"
  | "sign-documents"
  // | "submitted-lenders"
  | "chat"
  | "fee-agreement"
  | "commissions";

type TabSectionId = "application" | "documents" | "communication" | "lender";

type TabItem = {
  key: TabKey;
  label: string;
  icon: typeof Eye;
  color: string;
  disabled?: boolean;
  disabledReason?: string;
};

type TabSection = {
  id: TabSectionId;
  label: string;
  items: TabItem[];
};

const parseValue = (val: unknown): any => {
  if (val == null) return undefined;

  if (typeof val !== "string") {
    return val;
  }

  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
};

const formatSubmissionStatus = (status?: string) => {
  if (!status) return "-";
  if (status === "DECLINED") return "Rejected";
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c: string) => c.toUpperCase());
};

/** Prefer loan-application / pipeline status over submission version status (e.g. UPDATED). */
const getDisplayApplicationStatus = (detail?: {
  pipelineStatus?: string | null;
  applicationStatus?: string | null;
  status?: string | null;
} | null) => {
  const submissionVersionStatuses = new Set(["UPDATED", "SUPERSEDED"]);
  const pipeline = detail?.pipelineStatus?.trim();
  if (pipeline) return pipeline;

  const application = detail?.applicationStatus?.trim();
  if (application && !submissionVersionStatuses.has(application)) {
    return application;
  }

  const submission = detail?.status?.trim();
  if (submission && !submissionVersionStatuses.has(submission)) {
    return submission;
  }

  return application || submission || undefined;
};

const getStatusChip = (status?: string) => {
  switch (status) {
    case "DRAFT":
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";

    case "CLIENT_PENDING":
      return "bg-red-100 text-red-700 ring-1 ring-red-200";

    case "SUBMITTED":
      return "bg-blue-100 text-blue-700 ring-1 ring-blue-200";

    case "IN_REVIEW":
      return "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200";

    case "APPROVED":
    case "AUTO_APPROVED":
    case "LENDER_APPROVED":
      return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200";

    case "DECLINED":
    case "AUTO_DECLINED":
    case "LENDER_DECLINED":
      return "bg-red-100 text-red-700 ring-1 ring-red-200";

    case "LENDER_SELECTED":
      return "bg-purple-100 text-purple-700 ring-1 ring-purple-200";

    case "COMPLETED":
      return "bg-green-100 text-green-700 ring-1 ring-green-200";

    case "UPDATED":
      return "bg-cyan-100 text-cyan-700 ring-1 ring-cyan-200";

    case "FUNDED":
      return "bg-green-100 text-green-800 ring-1 ring-green-200";

    case "WITHDRAWN":
      return "bg-gray-200 text-gray-700 ring-1 ring-gray-300";

    case "NEW":
      return "bg-blue-200 text-blue-700 ring-1 ring-blue-300";

    default:
      return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
  }
};

type FieldLike = {
  fieldKey?: string | null;
  fieldId?: string | null;
  value: string | null;
};

const getFieldValue = <T extends FieldLike>(fields: T[], key: string) => {
  const field = fields.find((f) => f.fieldKey === key || f.fieldId === key);

  return field ? parseValue(field.value) : undefined;
};

// const formatFieldKey = (key: string | null | undefined) => {
//   if (!key) return "";

//   if (key === "amountRequested") {
//     return "Loan Amount Requested";
//   }

//   return key
//     .replace(/^coBorrower_\d+_/, "coBorrower_")
//     .replace(/([a-z])([A-Z])/g, "$1 $2")
//     .replace(/_/g, " ")
//     .replace(/\s+/g, " ")
//     .trim()
//     .replace(/\b\w/g, (char) => char.toUpperCase());
// };

const Metric = ({
  label,
  value,
  variant = "hero",
}: {
  label: string;
  value: string;
  variant?: "hero" | "panel";
}) => {
  const isHero = variant === "hero";

  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.25 }}
      className="group relative cursor-pointer overflow-hidden rounded-2xl p-4 transition-all duration-300"
    >
      <div
        className={`absolute inset-0 opacity-0 blur-xl transition duration-300 group-hover:opacity-100 ${
          isHero ? "bg-white/10" : "bg-gradient-to-r from-cyan-400/10 to-blue-500/10"
        }`}
      />
      <p
        className={`text-[11px] font-semibold uppercase tracking-widest transition ${
          isHero
            ? "text-white/70 group-hover:text-white"
            : "text-slate-500 group-hover:text-slate-700"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-2 text-md font-bold transition-all duration-300 ${
          isHero
            ? "text-white group-hover:scale-105"
            : "bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent group-hover:from-blue-600 group-hover:to-cyan-500"
        }`}
      >
        {value}
      </p>
      <div
        className={`mt-3 h-[3px] w-0 rounded-full transition-all duration-300 group-hover:w-full ${
          isHero
            ? "bg-white/80"
            : "bg-gradient-to-r from-cyan-500 to-blue-500"
        }`}
      />
    </motion.div>
  );
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

const calculateMonthlyPayment = (
  loanAmount: number,
  interestRate: number,
  termMonths: number,
) => {
  if (!loanAmount || !termMonths || termMonths <= 0) return 0;
  if (interestRate < 0) return 0;

  const monthlyRate = interestRate / 100 / 12;

  if (monthlyRate === 0) {
    return loanAmount / termMonths;
  }

  return (
    (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1)
  );
};

const formatMonthlyPayment = (value: number) => {
  if (!value || !isFinite(value) || value <= 0) return "-";
  return `$${value.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
};

const formatCurrencyValue = (
  value: number | string | null | undefined,
  options?: { fallback?: string },
) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return options?.fallback ?? "$0";
  return `$${num.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
};

const formatStatNumber = (value: number | string | null | undefined) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return num.toLocaleString("en-US", { maximumFractionDigits: 2 });
};

const REQUEST_DOC_LIMIT = 12;

const getRequestDocColor = (name: string) => {
  const colors = [
    "bg-orange-500",
    "bg-green-500",
    "bg-blue-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-yellow-500",
    "bg-indigo-500",
    "bg-teal-500",
    "bg-red-500",
    "bg-cyan-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

type LoanPreviewProps = { portal?: LoanPreviewPortal };

const LoanPreview = ({ portal = "broker" }: LoanPreviewProps) => {
  const Location = useLocation();
  useLoanPreviewSessionMonitor(portal);

  useEffect(() => {
    const token = getPortalToken();
    if (!token) return;

    let brokerOrgId: string | null = null;
    try {
      const user = JSON.parse(sessionStorage.getItem("broker_user") || "{}");
      brokerOrgId = user.organizationId || null;
    } catch {
      brokerOrgId = null;
    }

    if (!brokerOrgId) {
      brokerOrgId = getOrgIdsFromToken(token).brokerOrgId;
    }

    ensureChatSocket(token, {
      getBrokerOrgId: () => brokerOrgId,
    });
  }, []);

  // Full-screen route: ensure page scroll works even if a prior modal left body locked.
  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const actionButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [actionMenuPos, setActionMenuPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lendersSectionRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const previewConfig = getLoanPreviewConfig(portal);
  const isLoPortal = portal === "loanOfficer";
  const isCoBrokerPortal = portal === "coBroker";
  const previewApi = previewConfig.api;
  const getAuthHeaders = previewConfig.getAuthHeaders;
  const PreviewChat = previewConfig.Chat;
  const PreviewFeeAgreement = previewConfig.FeeAgreement;
  const PreviewLoanApplication = previewConfig.LoanApplication;

  const [activeTab, setActiveTab] = useState<TabKey>(
    (Location.state as { activeTab?: TabKey })?.activeTab || "view-details",
  );
  const [submissionDetail, setSubmissionDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);

  const [requestDocs, setRequestDocs] = useState<any[]>([]);
  const [requestDocsLoading, setRequestDocsLoading] = useState(false);
  const [requestDocsLoadedFor, setRequestDocsLoadedFor] = useState<
    string | null
  >(null);
  const [selectedRequestDocs, setSelectedRequestDocs] = useState<string[]>([]);
  const [requestMessage, setRequestMessage] = useState("");
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestDocSearch, setRequestDocSearch] = useState("");
  const [debouncedRequestDocSearch, setDebouncedRequestDocSearch] =
    useState("");
  const [requestDocPage, setRequestDocPage] = useState(1);
  const [requestDocPagination, setRequestDocPagination] = useState({
    page: 1,
    limit: REQUEST_DOC_LIMIT,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [customDocumentName, setCustomDocumentName] = useState("");
  const [addingCustomDoc, setAddingCustomDoc] = useState(false);
  const [selectingAllRequestDocs, setSelectingAllRequestDocs] = useState(false);
  const [requestDocHistoryByTypeId, setRequestDocHistoryByTypeId] = useState<
    Record<string, DocumentRequestHistoryEntry>
  >({});
  const [submittedLenders, setSubmittedLenders] = useState<any[]>([]);
  const [selectedLenders, setSelectedLenders] = useState<string[]>([]);

  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsData, setDocumentsData] = useState<any>(null);
  const [documentsLoadedFor, setDocumentsLoadedFor] = useState<string | null>(
    null,
  );
  const [documentsRefreshKey, setDocumentsRefreshKey] = useState(0);
  const [loiCount, setLoiCount] = useState(0);
  // const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  // const [selectedFiles, setSelectedFiles] = useState<Record<string, File[]>>(
  //   {},
  // );
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [documentSentFilter, setDocumentSentFilter] =
    useState<DocumentSentFilter>("all");
  const [documentSourceFilter, setDocumentSourceFilter] =
    useState<DocumentSourceFilter>("all");
  const [documentLenderFilter, setDocumentLenderFilter] = useState("");

  const [previewFiles, setPreviewFiles] = useState<any[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [activityDoc, setActivityDoc] = useState<DocumentDisplayRow | null>(
    null,
  );

  const [lenders, setLenders] = useState<Lender[]>([]);
  const [borrowerSummary, setBorrowerSummary] = useState<any>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  // const [sentLenders, setSentLenders] = useState<Record<string, boolean>>({});
  const [lenderLoading, setLenderLoading] = useState(false);
  const [lenderSearchQ, setLenderSearchQ] = useState("");
  const [lenderPage, setLenderPage] = useState(1);
  const [lenderLimit, setLenderLimit] = useState(6);
  // const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  // const [previewFile, setPreviewFile] = useState<UploadedPreview | null>(null);
  const [debouncedLenderSearch, setDebouncedLenderSearch] = useState("");
  const [lenderFilter, setLenderFilter] = useState<
    "all" | "eligible" | "rejected" | "sent"
  >("all");

  const [markingFundedId, setMarkingFundedId] = useState<string | null>(null);

  const isBrokerAdmin = useMemo(() => {
    try {
      const roles = JSON.parse(sessionStorage.getItem("roles") || "[]");
      return roles.includes("BROKER_ADMIN");
    } catch {
      return false;
    }
  }, []);

  const isFundedDeal =
    getDisplayApplicationStatus(submissionDetail) === "FUNDED";

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [documentsPagination, setDocumentsPagination] = useState<any>(null);

  const [lenderPagination, setLenderPagination] = useState<any>(null);
  // const [search, setSearch] = useState("");
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [autoForwardSaving, setAutoForwardSaving] = useState(false);
  const [autoForwardToClientSaving, setAutoForwardToClientSaving] =
    useState(false);
  const [forwardingToClient, setForwardingToClient] = useState(false);
  const [sendingToBroker, setSendingToBroker] = useState(false);
  // const [currentPage, setCurrentPage] = useState(1);

  // const [search, setSearch] = useState("");
  // const [debouncedLenderSearch, setDebouncedLenderSearch] = useState("");
  // const itemsPerPage = 9;

  const displayDocuments = useMemo(() => {
    const expanded = expandDocumentsForDisplay(documentsData?.documents || [], {
      applicationLenderId:
        documentLenderFilter ||
        documentsData?.activeFilters?.applicationLenderId ||
        undefined,
    });

    const sentFilter =
      documentSentFilter || documentsData?.activeFilters?.sentFilter || "all";

    if (sentFilter === "all") return expanded;

    return expanded.filter((doc) => matchesDocumentSentFilter(doc, sentFilter));
  }, [
    documentsData?.documents,
    documentsData?.activeFilters?.applicationLenderId,
    documentsData?.activeFilters?.sentFilter,
    documentLenderFilter,
    documentSentFilter,
  ]);

  const documentFilterLenders = documentsData?.documentFilterLenders || [];

  const selectableDocuments = displayDocuments.filter(
    (doc) => doc.status !== "SKIPPED",
  );

  const autoForwardEnabled = Boolean(
    documentsData?.autoForwardDocumentsToLender,
  );
  const autoForwardToClientEnabled = Boolean(
    documentsData?.autoForwardLenderRequestsToClient,
  );

  /** Broker/lender/sub-broker docs that can be sent (or re-notified) to the client */
  const selectedClientSendableIds = useMemo(() => {
    const selected = new Set(selectedRows);
    return [
      ...new Set(
        displayDocuments
          .filter(
            (doc) =>
              selected.has(doc.rowKey) &&
              doc.status !== "SKIPPED" &&
              ["BROKER_ADDED", "LENDER_ADDED", "SUB_BROKER_ADDED"].includes(
                String(doc.source || ""),
              ),
          )
          .map((doc) => String(doc.requirementId)),
      ),
    ];
  }, [displayDocuments, selectedRows]);

  const selectedCoBrokerPbSendableIds = useMemo(
    () =>
      isCoBrokerPortal
        ? getCoBrokerSendableToPrincipalBrokerIds(
            displayDocuments,
            selectedRows,
          )
        : [],
    [displayDocuments, isCoBrokerPortal, selectedRows],
  );

  const isAllSelected =
    selectableDocuments.length > 0 &&
    selectedRows.length === selectableDocuments.length;

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedRows([]);
      return;
    }

    const selectableIds = selectableDocuments.map((doc) => doc.rowKey);

    setSelectedRows(selectableIds);
  };

  const scrollToLenders = () => {
    lendersSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleSelectRow = (id: string) => {
    setSelectedRows((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const fetchSubmittedLenders = async () => {
    if (!applicationId) return;

    try {
      setLenderLoading(true);

      const res = await fetch(
        previewApi.submittedLenders(applicationId),
        {
          headers: getAuthHeaders(),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error("Failed to fetch lenders");
      }

      setSubmittedLenders(json.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLenderLoading(false);
    }
  };

  const handleSendToLender = async () => {
    if (!submissionId || selectedRows.length === 0) {
      toast.error("Please select at least one document");
      return;
    }

    if (selectedLenders.length === 0) {
      toast.error("Please select at least one lender");
      return;
    }

    const selectedRowSet = new Set(selectedRows);
    const requirementIds = [
      ...new Set(
        displayDocuments
          .filter((document) => selectedRowSet.has(document.rowKey))
          .map((document) => String(document.requirementId)),
      ),
    ];

    const payload = selectedLenders.map((applicationLenderId) => ({
      applicationLenderId,
      requirementIds,
    }));

    if (requirementIds.length === 0) {
      toast.error("Please select at least one valid document");
      return;
    }

    const result = await Swal.fire({
      title: "Send Documents?",
      text: `${requirementIds.length} selected document(s) will be sent to ${selectedLenders.length} lender(s), whether or not each lender originally requested them.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, send",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#2563eb",
      cancelButtonColor: "#ef4444",
    });

    if (!result.isConfirmed) return;

    try {
      setSending(true);

      Swal.fire({
        title: "Sending...",
        text: "Please wait while we send documents",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      const res = await fetch(
        previewApi.documentsSubmitToLender(submissionId),
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ lenders: payload }),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to send documents");
      }

      const blockedResults = (json.results || []).filter(
        (result: any) => !result.success && result.blockedByStatus,
      );
      const failedResults = (json.results || []).filter(
        (result: any) => !result.success,
      );
      const successResults = (json.results || []).filter(
        (result: any) => result.success,
      );

      if (successResults.length === 0) {
        const failedMessage =
          failedResults
            .map((result: any) => result.message)
            .filter(Boolean)
            .join(" ") ||
          blockedResults.map((result: any) => result.message).join(" ") ||
          "No documents were sent to the selected lenders.";

        throw new Error(failedMessage);
      }

      const blockedNote =
        blockedResults.length > 0
          ? ` ${blockedResults.length} lender(s) were skipped because they are approved, declined, or withdrawn.`
          : "";

      await Swal.fire({
        title: "Success",
        text: `Documents sent to lenders successfully.${blockedNote}`,
        icon: "success",
        confirmButtonColor: "#22c55e",
      });

      setSelectedRows([]);
      setSelectedLenders([]);

      await fetchSubmissionDocuments(submissionId, page, debouncedSearch);
    } catch (err: any) {
      Swal.fire({
        title: "Error",
        text: err.message || "Something went wrong",
        icon: "error",
        confirmButtonColor: "#ef4444",
      });
    } finally {
      setSending(false);
    }
  };

  const handleToggleAutoForward = async () => {
    if (!submissionId) return;

    const nextValue = !autoForwardEnabled;

    try {
      setAutoForwardSaving(true);
      const res = await fetch(
        previewApi.documentsAutoForward(submissionId),
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            autoForwardDocumentsToLender: nextValue,
          }),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to update document forwarding");
      }

      setDocumentsData((prev: any) =>
        prev
          ? {
              ...prev,
              autoForwardDocumentsToLender: nextValue,
            }
          : prev,
      );

      if (nextValue) {
        setSelectedRows([]);
        setSelectedLenders([]);
      }

      toast.success(
        nextValue
          ? "Auto-forward enabled — uploads go directly to lenders"
          : "Broker review enabled — you will send documents manually",
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to update setting");
    } finally {
      setAutoForwardSaving(false);
    }
  };

  const handleToggleAutoForwardToClient = async () => {
    if (!submissionId) return;

    const nextValue = !autoForwardToClientEnabled;

    try {
      setAutoForwardToClientSaving(true);
      const res = await fetch(
        previewApi.documentsAutoForwardToClient(submissionId),
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            autoForwardLenderRequestsToClient: nextValue,
          }),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message || "Failed to update auto-forward to client",
        );
      }

      setDocumentsData((prev: any) =>
        prev
          ? {
              ...prev,
              autoForwardLenderRequestsToClient: nextValue,
            }
          : prev,
      );

      toast.success(
        nextValue
          ? "Lender requests will auto-forward to the client"
          : "You will manually forward lender requests to the client",
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to update setting");
    } finally {
      setAutoForwardToClientSaving(false);
    }
  };

  const handleForwardToClient = async (requirementIds: string[]) => {
    if (!documentsData?.submissionId || requirementIds.length === 0) return;

    const result = await Swal.fire({
      title: "Send to client?",
      text: `${requirementIds.length} document request(s) will be sent to the client portal and the client will be notified.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Send to Client",
      confirmButtonColor: "#4f46e5",
    });

    if (!result.isConfirmed) return;

    try {
      setForwardingToClient(true);
      const res = await fetch(
        previewApi.documentsForwardToClient(documentsData.submissionId),
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ requirementIds }),
        },
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to send documents to client");
      }

      toast.success(json.message || "Documents sent to client");
      setActiveAction(null);
      setSelectedRows([]);
      await fetchSubmissionDocuments(
        documentsData.submissionId,
        page,
        debouncedSearch,
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to send documents to client");
    } finally {
      setForwardingToClient(false);
    }
  };

  const handleSendToPrincipalBroker = async (requirementIds: string[]) => {
    if (!documentsData?.submissionId || requirementIds.length === 0) return;

    const result = await Swal.fire({
      title: "Send to Principal Broker?",
      html: `${requirementIds.length} document${requirementIds.length === 1 ? "" : "s"} will be forwarded for Principal Broker review.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Send to PB",
      confirmButtonColor: "#2563eb",
    });

    if (!result.isConfirmed) return;

    try {
      setSendingToBroker(true);

      for (const requirementId of requirementIds) {
        const sendUrl = previewApi.sendDocumentToBroker(requirementId);
        if (!sendUrl) continue;

        const res = await fetch(sendUrl, {
          method: "POST",
          headers: getPortalAuthHeaders(false),
        });
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.message || "Failed to send document to PB");
        }
      }

      toast.success(
        requirementIds.length === 1
          ? "Document sent to Principal Broker"
          : `${requirementIds.length} documents sent to Principal Broker`,
      );
      setActiveAction(null);
      setSelectedRows([]);
      await fetchSubmissionDocuments(
        documentsData.submissionId,
        page,
        debouncedSearch,
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to send to Principal Broker");
    } finally {
      setSendingToBroker(false);
    }
  };

  const fields = useMemo(
    () => mapSubmissionDetailFields(submissionDetail?.fields || []),
    [submissionDetail?.fields],
  );
  const applicationId = submissionDetail?.applicationId;
  const submissionId = Location.state?.submissionId;

  const canRequestDocuments = useMemo(
    () => canBrokerRequestDocuments(submissionDetail),
    [submissionDetail],
  );

  const loDocPermissions = useMemo(() => {
    if (isCoBrokerPortal) {
      return {
        upload: true,
        request: true,
        sign: false,
        loi: true,
        feeAgreement: true,
        lenderHub: false,
        autoForwardToLender: false,
        autoForwardToClient: false,
        delete: false,
        sendApplications: false,
        chat: true,
        sendEmails: false,
      };
    }

    return {
      upload:
        !isLoPortal || hasPermission("UPLOAD_DOCUMENTS", "loanOfficer"),
      request:
        !isLoPortal || hasPermission("REQUEST_DOCUMENTS", "loanOfficer"),
      sign:
        !isLoPortal || hasPermission("DOCUMENTS_TO_SIGN", "loanOfficer"),
      loi:
        !isLoPortal || hasPermission("VIEW_LOI_TERM_SHEET", "loanOfficer"),
      feeAgreement:
        !isLoPortal || hasPermission("VIEW_FEE_AGREEMENT", "loanOfficer"),
      lenderHub:
        !isLoPortal || hasPermission("VIEW_LENDER_HUB", "loanOfficer"),
      autoForwardToLender:
        !isLoPortal || hasPermission("AUTO_FORWARD_TO_LENDER", "loanOfficer"),
      autoForwardToClient:
        !isLoPortal || hasPermission("AUTO_FORWARD_TO_CLIENT", "loanOfficer"),
      delete:
        !isLoPortal || hasPermission("DELETE_DOCUMENTS", "loanOfficer"),
      sendApplications:
        !isLoPortal || hasPermission("SEND_APPLICATIONS", "loanOfficer"),
      chat: !isLoPortal || hasPermission("CHAT", "loanOfficer"),
      sendEmails: !isLoPortal || hasPermission("SEND_EMAILS", "loanOfficer"),
    };
  }, [isLoPortal, isCoBrokerPortal]);

  const effectiveCanRequestDocuments =
    canRequestDocuments && loDocPermissions.request;

  const documentRequestBlockedReason = useMemo(
    () => getBrokerRequestDocumentsDisabledReason(submissionDetail),
    [submissionDetail],
  );

  useEffect(() => {
    if (!applicationId || !loDocPermissions.loi) {
      setLoiCount(0);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(previewApi.lois(applicationId, "page=1&limit=1"), {
          headers: getAuthHeaders(),
        });
        const json = await res.json();

        if (!cancelled && res.ok && json.success) {
          setLoiCount(json.data?.totalLoiReceived ?? 0);
        }
      } catch {
        if (!cancelled) setLoiCount(0);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applicationId, loDocPermissions.loi, previewApi]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLenderSearch(lenderSearchQ);
      setLenderPage(1);
    }, 400);

    return () => clearTimeout(timer);
  }, [lenderSearchQ]);

  useEffect(() => {
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (!activeAction) return;

      const target = e.target as Node;
      if (actionMenuRef.current?.contains(target)) return;
      if (actionButtonRefs.current[activeAction]?.contains(target)) return;

      setActiveAction(null);
      setActionMenuPos(null);
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeAction]);

  useEffect(() => {
    if (!activeAction) return;

    const closeOnScroll = () => {
      setActiveAction(null);
      setActionMenuPos(null);
    };

    window.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("resize", closeOnScroll);

    return () => {
      window.removeEventListener("scroll", closeOnScroll, true);
      window.removeEventListener("resize", closeOnScroll);
    };
  }, [activeAction]);

  const fetchSubmissionDetails = async (id: string) => {
    try {
      setLoading(true);
      const res = await fetch(
        `${API_BASE}${previewConfig.submissionDetailUrl(id)}`,
        { headers: getAuthHeaders() },
      );
      const json = await res.json();
      assertPortalApiOk(res, json, "Failed to fetch submission");
      setSubmissionDetail(json.data);
    } catch (err: any) {
      if (isSessionExpiredError(err)) return;
      toast.error(err.message || "Failed to fetch submission details");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkFunded = async (applicationLenderId: string) => {
    if (!previewConfig.showMarkFunded) return;

    if (!applicationId) {
      Swal.fire({
        title: "Error",
        text: "Application not found",
        icon: "error",
        confirmButtonColor: "#ef4444",
      });
      return;
    }

    const selectedLender = (submissionDetail?.lenders || []).find(
      (lender: { applicationLenderId?: string }) =>
        lender.applicationLenderId === applicationLenderId,
    );
    const lenderName = selectedLender?.lenderName || "this lender";

    const result = await Swal.fire({
      title: "Mark as Funded?",
      html: `Confirm <strong>${lenderName}</strong> as the funded lender for this deal.<br/><br/>Other approved lenders will be withdrawn and this action cannot be undone.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, mark as funded",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#059669",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    try {
      setMarkingFundedId(applicationLenderId);

      Swal.fire({
        title: "Marking as Funded...",
        text: "Please wait while we update the application",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      const res = await fetch(
        previewApi.markFunded(applicationId),
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ applicationLenderId }),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to mark as funded");
      }

      const fundedLenderName =
        json.data?.fundedLenderName || lenderName || "the selected lender";

      const commissionCount = json.data?.commissions?.commissions?.length || 0;
      const commissionHtml = commissionCount
        ? `<br/><br/>${commissionCount} commission record(s) created.`
        : "";

      await Swal.fire({
        title: "Funded",
        html: `Application marked as funded with <strong>${fundedLenderName}</strong>.${commissionHtml}`,
        icon: "success",
        confirmButtonColor: "#059669",
      });

      if (submissionId) {
        await fetchSubmissionDetails(submissionId);
      }
    } catch (err: any) {
      Swal.fire({
        title: "Error",
        text: err.message || "Failed to mark as funded",
        icon: "error",
        confirmButtonColor: "#ef4444",
      });
    } finally {
      setMarkingFundedId(null);
    }
  };

  /**
   * Fetch the available document types for the loan application.
   *
   * Always uses the legacy `GET /document-types/active` endpoint — the
   * wizard no longer pre-selects a subset of categories (the Step 6
   * selection panel was removed), so every loan shows the full active
   * catalog.
   */
  const fetchDocumentTypes = async (
    id: string,
    pageNo = requestDocPage,
    searchQuery = debouncedRequestDocSearch,
    productId = submissionDetail?.loanProduct?.id,
  ) => {
    try {
      setRequestDocsLoading(true);

      const params = new URLSearchParams({
        page: String(pageNo),
        limit: String(REQUEST_DOC_LIMIT),
      });
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }
      if (productId) {
        params.set("loanProductId", String(productId));
      }

      const res = await fetch(
        `${API_BASE}/document-types/active?${params.toString()}`,
        {
          method: "GET",
          headers: getAuthHeaders(),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to fetch document types");
      }
      const formattedDocs = (json.data || []).map((doc: any) => ({
        documentTypeId: doc.id,
        documentType: { name: doc.name },
        isCustom: Boolean(doc.isCustom),
      }));
      setRequestDocs(formattedDocs);
      setRequestDocPagination(
        json.pagination || {
          page: pageNo,
          limit: REQUEST_DOC_LIMIT,
          total: formattedDocs.length,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      );
      setRequestDocsLoadedFor(id);
    } catch (err: any) {
      toast.error(err.message || "Failed to load documents");
    } finally {
      setRequestDocsLoading(false);
    }
  };

  const fetchExistingDocumentRequestHistory = async (currentSubmissionId: string) => {
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "100",
        documentCategory: "upload",
      });

      const res = await fetch(
        previewApi.submissionDocuments(currentSubmissionId, params.toString()),
        {
          headers: getAuthHeaders(),
        },
      );
      const json = await res.json();
      if (!json.success) return;

      const documents = json.data?.documents || [];
      setRequestDocHistoryByTypeId(buildDocumentRequestHistoryByTypeId(documents));
    } catch (err) {
      console.error("Failed to load document request history", err);
    }
  };

  const handleSelectAllRequestDocs = async () => {
    try {
      setSelectingAllRequestDocs(true);
      const search = debouncedRequestDocSearch.trim();
      const productId = submissionDetail?.loanProduct?.id;
      const collected: Array<{ id: string; name: string; isCustom: boolean }> =
        [];

      // Paginate through the active document-types catalog and collect
      // every row matching the current search.
      if (collected.length === 0) {
        const allParams = new URLSearchParams({ all: "true" });
        if (search) allParams.set("search", search);
        if (productId) allParams.set("loanProductId", String(productId));

        const allRes = await fetch(
          `${API_BASE}/document-types/active?${allParams.toString()}`,
          {
            method: "GET",
            headers: getAuthHeaders(),
          },
        );
        const allJson = await allRes.json().catch(() => ({}));

        if (allRes.ok && allJson.success && Array.isArray(allJson.data)) {
          for (const doc of allJson.data) {
            collected.push({
              id: String(doc.id),
              name: doc.name || "Document",
              isCustom: Boolean(doc.isCustom),
            });
          }
        } else {
          // Fallback: walk pages (limit max 100 per API schema)
          let page = 1;
          let totalPages = 1;
          do {
            const params = new URLSearchParams({
              page: String(page),
              limit: "100",
            });
            if (search) params.set("search", search);
            if (productId) params.set("loanProductId", String(productId));

            const res = await fetch(
              `${API_BASE}/document-types/active?${params.toString()}`,
              {
                method: "GET",
                headers: getAuthHeaders(),
              },
            );
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.success) {
              throw new Error(json.message || "Failed to select documents");
            }

            for (const doc of json.data || []) {
              collected.push({
                id: String(doc.id),
                name: doc.name || "Document",
                isCustom: Boolean(doc.isCustom),
              });
            }

            totalPages = Math.max(1, Number(json.pagination?.totalPages) || 1);
            page += 1;
          } while (page <= totalPages);
        }
      }

      // Last resort: current page only
      if (collected.length === 0 && requestDocs.length > 0) {
        for (const doc of requestDocs) {
          collected.push({
            id: String(doc.documentTypeId),
            name: doc.documentType?.name || "Document",
            isCustom: Boolean(doc.isCustom),
          });
        }
      }

      if (collected.length === 0) {
        toast.error(
          search
            ? "No documents match your search"
            : "No documents available to select",
        );
        return;
      }

      // De-dupe by id while preserving order
      const seen = new Set<string>();
      const unique = collected.filter((doc) => {
        if (seen.has(doc.id)) return false;
        seen.add(doc.id);
        return true;
      });

      setSelectedRequestDocs(unique.map((doc) => doc.id));

      toast.success(
        `Selected ${unique.length} document${unique.length === 1 ? "" : "s"}`,
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to select all documents");
    } finally {
      setSelectingAllRequestDocs(false);
    }
  };

  const toggleRequestDocument = (doc: {
    documentTypeId: string;
    documentType?: { name?: string };
    isCustom?: boolean;
  }) => {
    const id = doc.documentTypeId;
    const isSelected = selectedRequestDocs.includes(id);

    setSelectedRequestDocs((prev) =>
      isSelected ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const clearRequestedDocuments = () => {
    if (selectedRequestDocs.length === 0) return;
    setSelectedRequestDocs([]);
    toast.success("Cleared document selection");
  };

  const handleAddCustomDocument = async () => {
    const customName = customDocumentName.trim();
    if (!customName) {
      toast.error("Please enter custom document name");
      return;
    }
    if (customName.length < 2) {
      toast.error("Custom document name must be at least 2 characters");
      return;
    }

    try {
      setAddingCustomDoc(true);
      const res = await fetch(`${API_BASE}/document-types/create-custom`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: customName,
          ...(submissionDetail?.loanProduct?.id
            ? { loanProductId: submissionDetail.loanProduct.id }
            : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to add custom document");
      }

      const createdId = String(json.data?.id || "");
      if (createdId) {
        setSelectedRequestDocs((prev) =>
          prev.includes(createdId) ? prev : [createdId, ...prev],
        );
      }

      setCustomDocumentName("");
      setRequestDocSearch("");
      setDebouncedRequestDocSearch("");
      setRequestDocPage(1);
      if (applicationId) {
        await fetchDocumentTypes(applicationId, 1, "");
      }
      toast.success("Custom document added");
    } catch (err: any) {
      toast.error(err.message || "Failed to add custom document");
    } finally {
      setAddingCustomDoc(false);
    }
  };

  const fetchSubmissionDocuments = async (
    submissionId: string,
    pageNo = 1,
    searchQuery = "",
    lenderFilter = documentLenderFilter,
    sentFilter: DocumentSentFilter = documentSentFilter,
    sourceFilter: DocumentSourceFilter = documentSourceFilter,
  ) => {
    try {
      setDocumentsLoading(true);

      const params = new URLSearchParams({
        page: String(pageNo),
        limit: String(limit),
        search: searchQuery,
        sentFilter,
        sourceFilter,
        documentCategory: "upload",
      });

      if (lenderFilter) {
        params.set("applicationLenderId", lenderFilter);
      }

      const res = await fetch(
        previewApi.submissionDocuments(submissionId, params.toString()),
        {
          headers: getAuthHeaders(),
        },
      );

      const json = await res.json();

      if (json.success) {
        setDocumentsData(json.data);

        setDocumentsPagination(json.data.pagination);

        setPage(json.data.pagination.page);

        setDocumentsLoadedFor(submissionId);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDocumentsLoading(false);
    }
  };

  const handleRequestDocuments = async () => {
    if (!applicationId) return;
    if (!effectiveCanRequestDocuments) {
      toast.error(
        documentRequestBlockedReason ||
          "Documents cannot be requested for this application.",
      );
      return;
    }
    if (selectedRequestDocs.length === 0) {
      toast.error("Please select at least one document");
      return;
    }

    try {
      setRequestSubmitting(true);
      const res = await fetch(
        previewApi.requestDocuments(applicationId),
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            documentTypeIds: selectedRequestDocs,
            message: requestMessage || "Please upload these documents urgently",
          }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to request documents");
      }
      toast.success("Documents requested successfully");

      setSelectedRequestDocs([]);
      setRequestMessage("");

      // Reset upload-documents filters so newly requested docs show up
      setSearchInput("");
      setDebouncedSearch("");
      setPage(1);
      setDocumentSentFilter("all");
      setDocumentSourceFilter("all");
      setDocumentLenderFilter("");
      setDocumentsLoadedFor(null);
      setDocumentsData(null);
      setDocumentsRefreshKey((key) => key + 1);
      setActiveTab("documents");

      if (submissionId) {
        await fetchSubmissionDocuments(submissionId, 1, "", "", "all", "all");
        await fetchExistingDocumentRequestHistory(submissionId);
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setRequestSubmitting(false);
    }
  };

  const fetchLenders = async (id: string) => {
    setLenders([]);
    setBorrowerSummary(null);
    // setSentLenders({});
    // setImageErrors({});
    setLenderLoading(true);

    try {
      const res = await fetch(
        previewApi.eligibleLenders(
          id,
          `page=${lenderPage}&limit=${lenderLimit}&search=${debouncedLenderSearch}&filter=${lenderFilter}`,
        ),
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
      setLenderPagination(data.pagination || null);

      setBorrowerSummary(data.borrowerData);

      const mapLenderBase = (l: any) => ({
        id: l.lenderOrgId,
        name: l.lenderName,
        email: l.lenderEmail,
        phone: l.lenderPhone,
        profileImage: l.profileImage
          ? `${API_BASE}/public/${l.profileImage}`
          : null,
        lenderProductId: l.lenderProductId,
        loanProductCode: l.loanProductCode,
        minFunding: l.fundingRange?.min ?? 0,
        maxFunding: l.fundingRange?.max ?? 0,
        minMonths: l.terms?.minMonths ?? 0,
        maxMonths: l.terms?.maxMonths ?? 0,
        interestRateRange: l.interestRateRange,
        fundingSpeedDays: l.lenderProfile?.fundingSpeedDays ?? 0,
        summary: l.lenderProfile?.summary,
        alreadySent: Boolean(l.alreadySent),
        canSend: Boolean(l.canSend),
        applicationStatus: l.applicationStatus,
        rejectionReasons: l.rejectionReasons || [],
      });

      const allLenders = [
        ...(data.eligibleLenders || []).map((l: any) => ({
          ...mapLenderBase(l),
          type: "eligible" as const,
        })),

        ...(data.ineligibleLenders || []).map((l: any) => ({
          ...mapLenderBase(l),
          type: "ineligible" as const,
          canSend: false,
        })),

        ...(data.rejectedLenders || []).map((l: any) => ({
          ...mapLenderBase(l),
          type: "rejected" as const,
          alreadySent: true,
          canSend: false,
        })),

        ...(data.alreadySentLenders || []).map((l: any) => ({
          ...mapLenderBase(l),
          type: "sent" as const,
          alreadySent: true,
          canSend: false,
        })),
      ];

      setLenders(allLenders);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load eligible lenders");
    } finally {
      setLenderLoading(false);
      setFilterLoading(false);
    }
  };

  const sendApplicationToLender = async (lenderProductId: string) => {
    if (!submissionId || !applicationId) return;

    try {
      setSendingId(lenderProductId);

      const res = await fetch(
        previewApi.sendToLenders(applicationId, submissionId),
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
      // setSentLenders((prev) => ({
      //   ...prev,
      //   [lenderProductId]: true,
      // }));

      await fetchSubmissionDetails(submissionId);
      await fetchLenders(submissionId);
    } catch (err: any) {
      toast.error(err.message || "Failed to send");
    } finally {
      setSendingId(null);
    }
  };

  // const handleDocumentUpload = async (
  //   currentSubmissionId: string,
  //   requirementId: string,
  // ) => {
  //   const filesForRequirement = selectedFiles[requirementId];

  //   if (!filesForRequirement || filesForRequirement.length === 0) {
  //     toast.error("Please select at least one file");
  //     return;
  //   }

  //   try {
  //     setUploadingDocId(requirementId);

  //     const token = sessionStorage.getItem("broker_token");

  //     for (const file of filesForRequirement) {
  //       const formData = new FormData();
  //       formData.append("file", file);

  //       const res = await fetch(
  //         `${pipelineApi}/submissions/${currentSubmissionId}/documents/${requirementId}/upload`,
  //         {
  //           method: "POST",
  //           headers: {
  //             ...(token && { Authorization: `Bearer ${token}` }),
  //           },
  //           body: formData,
  //         },
  //       );

  //       const json = await res.json();

  //       if (!res.ok || !json.success) {
  //         throw new Error(json.message || "Upload failed");
  //       }
  //     }

  //     toast.success("Document uploaded successfully");

  //     // clear selected file
  //     setSelectedFiles((prev) => {
  //       const copy = { ...prev };
  //       delete copy[requirementId];
  //       return copy;
  //     });

  //     // refresh table
  //     await fetchSubmissionDocuments(currentSubmissionId);
  //   } catch (err: any) {
  //     toast.error(err.message || "Upload failed");
  //   } finally {
  //     setUploadingDocId(null);
  //   }
  // };

  useEffect(() => {
    if (activeTab !== "documents" || !submissionId || !applicationId) {
      return;
    }

    if (!isCoBrokerPortal) {
      fetchSubmittedLenders();
    }

    fetchSubmissionDocuments(
      submissionId,
      page,
      debouncedSearch,
      documentLenderFilter,
      documentSentFilter,
      documentSourceFilter,
    );
  }, [activeTab, applicationId, submissionId]);

  useEffect(() => {
    setSubmissionDetail(null);
    setRequestDocs([]);
    setRequestDocsLoadedFor(null);
    setDocumentsData(null);
    setDocumentsLoadedFor(null);
    setLenders([]);
    setBorrowerSummary(null);
    // setSentLenders({});
    // setImageErrors({});
    setLenderSearchQ("");
    setLenderPage(1);
    // setSelectedFiles({});
    setPreviewFiles([]);
    setSelectedRequestDocs([]);
    setRequestMessage("");
    setActiveTab(
      (Location.state as { activeTab?: TabKey })?.activeTab || "view-details",
    );

    if (submissionId) {
      fetchSubmissionDetails(submissionId);
    }
  }, [submissionId]);

  useEffect(() => {
    if (
      submissionDetail?.canEdit === false &&
      activeTab === "update-application"
    ) {
      setActiveTab("view-details");
    }
  }, [submissionDetail?.canEdit, activeTab]);

  useEffect(() => {
    if (!effectiveCanRequestDocuments && activeTab === "request-document") {
      setActiveTab("view-details");
    }
  }, [effectiveCanRequestDocuments, activeTab]);

  useEffect(() => {
    setRequestDocs([]);
    setRequestDocsLoadedFor(null);
    setSelectedRequestDocs([]);
    setRequestDocSearch("");
    setDebouncedRequestDocSearch("");
    setRequestDocPage(1);
    setCustomDocumentName("");
    setRequestDocPagination({
      page: 1,
      limit: REQUEST_DOC_LIMIT,
      total: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  }, [applicationId]);

  useEffect(() => {
    if (
      activeTab === "request-document" &&
      effectiveCanRequestDocuments &&
      applicationId &&
      requestDocsLoadedFor !== applicationId
    ) {
      // Wait for submission product so list is product-scoped from first load
      if (!submissionDetail?.loanProduct?.id && submissionDetail == null) {
        return;
      }
      fetchDocumentTypes(
        applicationId,
        1,
        "",
        submissionDetail?.loanProduct?.id,
      );
      if (submissionId) {
        fetchExistingDocumentRequestHistory(submissionId);
      }
    }

    if (
      activeTab === "documents" &&
      submissionId &&
      documentsLoadedFor !== submissionId
    ) {
      fetchSubmissionDocuments(submissionId, 1, debouncedSearch);
    }
  }, [
    activeTab,
    applicationId,
    submissionId,
    requestDocsLoadedFor,
    documentsLoadedFor,
    submissionDetail?.loanProduct?.id,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedRequestDocSearch(requestDocSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [requestDocSearch]);

  useEffect(() => {
    if (
      activeTab !== "request-document" ||
      !effectiveCanRequestDocuments ||
      !applicationId ||
      requestDocsLoadedFor !== applicationId
    ) {
      return;
    }
    fetchDocumentTypes(
      applicationId,
      requestDocPage,
      debouncedRequestDocSearch,
      submissionDetail?.loanProduct?.id,
    );
  }, [
    requestDocPage,
    debouncedRequestDocSearch,
    submissionDetail?.loanProduct?.id,
  ]);

  useEffect(() => {
    if (submissionId) {
      fetchSubmissionDocuments(
        submissionId,
        page,
        debouncedSearch,
        documentLenderFilter,
        documentSentFilter,
        documentSourceFilter,
      );
    }
  }, [
    page,
    debouncedSearch,
    documentLenderFilter,
    documentSentFilter,
    documentSourceFilter,
    submissionId,
  ]);

  useEffect(() => {
    if (activeTab === "find-lenders" && submissionId) {
      fetchLenders(submissionId);
    }
  }, [
    lenderPage,
    lenderLimit,
    lenderFilter,
    debouncedLenderSearch,
    activeTab,
    submissionId,
  ]);

  useEffect(() => {
    if (activeTab !== "find-lenders") return;
    const highlightName = (Location.state as { highlightLenderName?: string })
      ?.highlightLenderName;
    if (highlightName?.trim()) {
      setLenderSearchQ(highlightName.trim());
      setDebouncedLenderSearch(highlightName.trim());
      setLenderFilter("all");
      setLenderPage(1);
    }
  }, [activeTab, Location.state]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [searchInput]);

  const loanAmount = Number(getFieldValue(fields, "amountRequested") ?? 0) || 0;
  const ltv = Number(getFieldValue(fields, "ltvPercentage") ?? 0) || 0;
  const ltc = Number(getFieldValue(fields, "ltcPercentage") ?? 0) || 0;
  const arv = Number(getFieldValue(fields, "arvPercentage") ?? 0) || 0;
  const dscr = Number(getFieldValue(fields, "dscr") ?? 0) || 0;
  const netWorth = Number(getFieldValue(fields, "netWorth") ?? 0) || 0;
  const interestRate = Number(getFieldValue(fields, "interestRate") ?? 0) || 0;
  const amortizationYears =
    Number(getFieldValue(fields, "amortization") ?? 0) || 0;
  const loanTermMonths = Number(getFieldValue(fields, "loanTerm") ?? 0) || 0;
  const termMonths =
    amortizationYears > 0 ? amortizationYears * 12 : loanTermMonths;
  const monthlyPayment = calculateMonthlyPayment(
    loanAmount,
    interestRate,
    termMonths,
  );
  const monthlyPaymentDisplay = formatMonthlyPayment(monthlyPayment);
  const netWorthDisplay = netWorth
    ? formatCurrencyValue(netWorth)
    : "-";

  const submittedDate = submissionDetail?.submittedAt
    ? new Date(submissionDetail.submittedAt)
    : null;

  const tabSections: TabSection[] = useMemo(() => {
    const documentItems: TabSection["items"] = [];

    if (loDocPermissions.upload) {
      documentItems.push({
        key: "documents",
        label: "Upload Documents",
        icon: Upload,
        color: "text-amber-600",
      });
    }

    if (loDocPermissions.request) {
      documentItems.push({
        key: "request-document",
        label: "Request Documents",
        icon: Send,
        color: "text-emerald-600",
        disabled: !effectiveCanRequestDocuments,
        disabledReason:
          documentRequestBlockedReason ||
          "Documents cannot be requested for this application.",
      });
    }

    if (loDocPermissions.sign) {
      documentItems.push({
        key: "sign-documents",
        label: "Fill & Sign Forms",
        icon: FileText,
        color: "text-indigo-600",
      });
    }

    if (loDocPermissions.loi) {
      documentItems.push({
        key: "view-loi",
        label: "LOI / Term Sheets",
        icon: FileText,
        color: "text-purple-600",
      });
    }

    if (loDocPermissions.feeAgreement) {
      documentItems.push({
        key: "fee-agreement",
        label: "Fee Agreement",
        icon: FileText,
        color: "text-indigo-600",
      });
    }

    const applicationItems: TabSection["items"] = [
      {
        key: "view-details",
        label: "View Details",
        icon: Eye,
        color: "text-blue-600",
      },
    ];

    if (submissionDetail?.canEdit !== false) {
      applicationItems.push({
        key: "update-application",
        label: "Update Application",
        icon: Pencil,
        color: "text-cyan-600",
      });
    }

    if (isFundedDeal) {
      applicationItems.push({
        key: "commissions",
        label: "Commissions",
        icon: DollarSign,
        color: "text-emerald-600",
      });
    }

    const sections: TabSection[] = [
      {
        id: "application",
        label: "Application",
        items: applicationItems,
      },
    ];

    if (documentItems.length > 0) {
      sections.push({
        id: "documents",
        label: "Documents",
        items: documentItems,
      });
    }

    const communicationItems: TabSection["items"] = [];

    if (loDocPermissions.chat) {
      communicationItems.push({
        key: "chat",
        label: "Chat",
        icon: MessageSquare,
        color: "text-green-600",
      });
    }

    if (loDocPermissions.sendEmails) {
      communicationItems.push({
        key: "email-reminders",
        label: "Email Reminders",
        icon: Mail,
        color: "text-sky-600",
      });
    }

    if (communicationItems.length > 0) {
      sections.push({
        id: "communication",
        label: "Communication",
        items: communicationItems,
      });
    }

    if (loDocPermissions.lenderHub) {
      sections.push({
        id: "lender",
        label: "Lender Hub",
        items: [
          {
            key: "find-lenders",
            label: "Lender Hub",
            icon: FileSearch,
            color: "text-blue-600",
          },
        ],
      });
    }

    return sections;
  }, [
    loDocPermissions,
    effectiveCanRequestDocuments,
    documentRequestBlockedReason,
    submissionDetail?.canEdit,
    isFundedDeal,
  ]);

  const visibleTabKeys = useMemo(
    () =>
      tabSections.flatMap((section) =>
        section.items.filter((item) => !item.disabled).map((item) => item.key),
      ),
    [tabSections],
  );

  useEffect(() => {
    if (!visibleTabKeys.includes(activeTab)) {
      setActiveTab(visibleTabKeys[0] ?? "view-details");
    }
  }, [visibleTabKeys, activeTab]);

  const currentFile = previewFiles[activeIndex];
  const currentPreviewFileUrl = useMemo(
    () => buildApiPublicFileUrl(API_BASE, currentFile?.fileUrl),
    [currentFile?.fileUrl],
  );

  const renderViewDetails = () => (
    <SubmissionDetailsView
      submissionDetail={submissionDetail}
      fields={fields}
      formatSubmissionStatus={formatSubmissionStatus}
      getStatusChip={getStatusChip}
      formatCompactAmount={formatCompactAmount}
      loanAmount={loanAmount}
      ltv={ltv}
      ltc={ltc}
      arv={arv}
      dscr={dscr}
      netWorth={netWorth}
      monthlyPayment={monthlyPayment}
      monthlyPaymentDisplay={monthlyPaymentDisplay}
      submittedDate={submittedDate}
      showEditHint={submissionDetail?.canEdit !== false}
      canMarkFunded={
        previewConfig.showMarkFunded && Boolean(submissionDetail?.canMarkFunded)
      }
      markFundedBlockedReason={submissionDetail?.markFundedBlockedReason}
      markingFundedId={markingFundedId}
      onMarkFunded={handleMarkFunded}
    />
  );

  const loanApplicationInitial = useMemo(() => {
    if (!submissionDetail?.fields?.length) return null;
    return mapSubmissionToLoanApplication(submissionDetail.fields);
  }, [submissionDetail]);

  const renderUpdateApplicationForm = () => {
    if (loading || !submissionDetail) {
      return (
        <div className="py-20 text-center text-slate-500">
          Loading application...
        </div>
      );
    }

    if (submissionDetail.canEdit === false) {
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-10 text-center dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            Application cannot be edited
          </p>
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
            {submissionDetail.editBlockedReason ||
              "This application is no longer available for updates."}
          </p>
        </div>
      );
    }

    if (!loanApplicationInitial || !applicationId) {
      return (
        <div className="py-20 text-center text-slate-500">
          Unable to load application data for editing.
        </div>
      );
    }

    return (
      <PreviewLoanApplication
        key={`${submissionDetail.submissionId}-${submissionDetail.submittedAt}`}
        mode="update"
        embedded
        editApplicationId={applicationId}
        initialFormData={loanApplicationInitial.formData}
        initialSelectedProduct={loanApplicationInitial.selectedProduct}
        initialSelectedCategory={loanApplicationInitial.selectedCategory}
        initialDynamicFormData={loanApplicationInitial.dynamicFormData}
        initialCreditAuthorizationConsent={
          loanApplicationInitial.creditAuthorizationConsent
        }
        onUpdateSuccess={(newSubmissionId: string) => {
          const idToLoad = newSubmissionId || submissionId;
          if (newSubmissionId && newSubmissionId !== submissionId) {
            navigate(previewConfig.previewNavigatePath, {
              state: { submissionId: newSubmissionId },
              replace: true,
            });
          }
          if (idToLoad) {
            fetchSubmissionDetails(idToLoad);
          }
          setActiveTab("view-details");
        }}
      />
    );
  };

  const renderRequestDocument = () => {
    if (!effectiveCanRequestDocuments) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100">
            Request Document
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {documentRequestBlockedReason ||
              "Documents cannot be requested for this application."}
          </p>
        </div>
      );
    }

    const showingFrom =
      requestDocPagination.total === 0
        ? 0
        : (requestDocPagination.page - 1) * REQUEST_DOC_LIMIT + 1;
    const showingTo = Math.min(
      requestDocPagination.page * REQUEST_DOC_LIMIT,
      requestDocPagination.total,
    );

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100">
              Select Documents
            </h2>
            <p className="text-sm text-gray-500">
              Select which documents are required
              {submissionDetail?.loanProduct?.name
                ? ` for ${submissionDetail.loanProduct.name}`
                : ""}
              .
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSelectAllRequestDocs}
              disabled={selectingAllRequestDocs || requestDocsLoading}
              className="rounded-md border bg-gray-50 px-3 py-1 text-xs hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900"
            >
              {selectingAllRequestDocs ? "Selecting..." : "Select All"}
            </button>
            <button
              type="button"
              onClick={clearRequestedDocuments}
              disabled={
                selectedRequestDocs.length === 0 || selectingAllRequestDocs
              }
              className="rounded-md border bg-gray-50 px-3 py-1 text-xs hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900"
            >
              Clear All
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Loan product
          </label>
          <select
            value={submissionDetail?.loanProduct?.id || ""}
            disabled
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none disabled:cursor-not-allowed disabled:opacity-80 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value={submissionDetail?.loanProduct?.id || ""}>
              {submissionDetail?.loanProduct?.name ||
                "Application loan product"}
            </option>
          </select>
          <p className="mt-1.5 text-xs text-slate-500">
            Documents are filtered for this application&apos;s loan product.
          </p>
        </div>

        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
          <input
            type="text"
            placeholder="Enter custom document name..."
            value={customDocumentName}
            onChange={(e) => setCustomDocumentName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddCustomDocument();
              }
            }}
            className="h-12 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={handleAddCustomDocument}
            disabled={addingCustomDoc}
            className="flex h-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60"
          >
            {addingCustomDoc ? "Adding..." : "+ Add Document"}
          </button>
        </div>

        <div className="mb-5 flex justify-end">
          <div className="relative w-full max-w-md">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={requestDocSearch}
              onChange={(e) => {
                setRequestDocSearch(e.target.value);
                setRequestDocPage(1);
              }}
              placeholder="Search documents..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-9 pr-9 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/15 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white"
            />
            {requestDocSearch ? (
              <button
                type="button"
                onClick={() => {
                  setRequestDocSearch("");
                  setRequestDocPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-200/80 hover:text-slate-600"
                aria-label="Clear search"
              >
                <SearchX size={14} />
              </button>
            ) : null}
          </div>
        </div>

        {requestDocsLoading ? (
          <div className="py-10 text-center text-gray-500">
            Loading documents...
          </div>
        ) : requestDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 py-12 dark:border-slate-700 dark:bg-slate-900/40">
            <FileText size={42} className="mb-3 text-gray-400" />
            <h3 className="text-base font-semibold text-gray-700 dark:text-slate-200">
              No documents found
            </h3>
            <p className="mt-1 text-center text-sm text-gray-500">
              {requestDocSearch.trim()
                ? `No documents found for "${requestDocSearch}".`
                : submissionDetail?.loanProduct?.name
                  ? `No document types are available for ${submissionDetail.loanProduct.name}.`
                  : "No document types are available."}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {requestDocs.map((doc: any) => {
                const isSelected = selectedRequestDocs.includes(
                  doc.documentTypeId,
                );
                const requestHistory =
                  requestDocHistoryByTypeId[String(doc.documentTypeId)];
                const isAlreadyRequested = Boolean(requestHistory);
                return (
                  <label
                    key={doc.documentTypeId}
                    className={`group relative flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-all duration-200 ${
                      isSelected
                        ? "scale-[1.01] border-emerald-500 bg-emerald-50 shadow-sm dark:bg-emerald-500/10"
                        : isAlreadyRequested
                          ? "border-indigo-200 bg-indigo-50/40 dark:border-indigo-500/30 dark:bg-indigo-500/5"
                          : "border-gray-200 bg-white hover:border-emerald-300 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-500/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRequestDocument(doc)}
                      className="mt-1 cursor-pointer accent-emerald-600"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-2.5 w-2.5 rounded-full ${getRequestDocColor(
                            doc.documentType.name,
                          )}`}
                        />
                        <p className="text-sm font-medium leading-tight text-gray-800 dark:text-slate-200">
                          {doc.documentType.name}
                        </p>
                        {doc.isCustom ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                            Custom
                          </span>
                        ) : null}
                        {isAlreadyRequested ? (
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                            Requested
                          </span>
                        ) : null}
                      </div>
                      {requestHistory ? (
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          {formatDocumentTimelineDate(requestHistory.requestedAt)}
                        </p>
                      ) : null}
                    </div>

                    {isSelected ? (
                      <CheckCircle2
                        size={18}
                        className="shrink-0 text-emerald-600"
                      />
                    ) : null}
                  </label>
                );
              })}
            </div>

            {requestDocPagination.total > 0 ? (
              <div className="mt-6 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
                <div className="text-sm text-gray-500">
                  Showing{" "}
                  <span className="font-semibold text-gray-700 dark:text-slate-200">
                    {showingFrom}
                  </span>
                  {" - "}
                  <span className="font-semibold text-gray-700 dark:text-slate-200">
                    {showingTo}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-gray-700 dark:text-slate-200">
                    {requestDocPagination.total}
                  </span>{" "}
                  documents
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={!requestDocPagination.hasPreviousPage}
                    onClick={() =>
                      setRequestDocPage((prev) => Math.max(1, prev - 1))
                    }
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-emerald-500 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    ← Previous
                  </button>

                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    Page {requestDocPagination.page} of{" "}
                    {requestDocPagination.totalPages || 1}
                  </div>

                  <button
                    type="button"
                    disabled={!requestDocPagination.hasNextPage}
                    onClick={() => setRequestDocPage((prev) => prev + 1)}
                    className="rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-300"
                  >
                    Next →
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}

        {!requestDocsLoading ? (
          <>
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-200">
                Message
              </label>
              <textarea
                placeholder="Enter a message for the client (optional)..."
                className="min-h-[90px] w-full resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900"
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-400">
                This message will be sent along with the document request.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {selectedRequestDocs.length} selected
              </p>
              <button
                type="button"
                onClick={handleRequestDocuments}
                disabled={selectedRequestDocs.length === 0 || requestSubmitting}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {requestSubmitting ? "Requesting..." : "Request Documents"}
              </button>
            </div>
          </>
        ) : null}
      </div>
    );
  };

  const renderViewLoi = () => (
    <BrokerLoiPanel
      applicationId={applicationId}
      apiRole={previewConfig.loiApiRole}
      getAuthHeaders={getAuthHeaders}
      isActive={activeTab === "view-loi"}
      onLoiCountChange={setLoiCount}
    />
  );

  const PRODUCT_LABELS: Record<string, string> = {
    FIX_AND_FLIP_LOAN_1_TO_4_UNITS: "FIX & FLIP",
    DSCR_LOAN_1_TO_4_UNITS: "DSCR",
    CONSTRUCTION_LOAN_1_TO_4_UNITS: "CONSTRUCTION",
    BRIDGE_LOAN_1_TO_4_UNITS: "BRIDGE LOAN",
    SBA_504_REAL_ESTATE_AND_EQUIPMENT: "SBA 504",
    USDA_BI: "USDA B&I",
    AGENCY_LOAN_MULTIFAMILY: "AGENCY MULTIFAMILY",
    CRE_PERMANENT_LOAN: "CRE PERMANENT",
    RENTAL_PORTFOLIO: "RENTAL PORTFOLIO",
    PURCHASE_ORDER_FINANCE: "PURCHASE ORDER FINANCE",
    ACCOUNTS_PAYABLE_FINANCE: "AP SUPPLY CHAIN",
    ACCOUNTS_RECEIVABLE: "ACCOUNTS RECEIVABLE",
    INVOICE_FACTORING: "AR FACTORING",
  };

  const renderFindLenders = () => {
    const filteredLenders = (lenders || []).filter((lender) => {
      const matchesSearch =
        lender.name?.toLowerCase().includes(lenderSearchQ.toLowerCase()) ||
        lender.email?.toLowerCase().includes(lenderSearchQ.toLowerCase());

      const matchesFilter =
        lenderFilter === "all" || lender.type === lenderFilter;

      return matchesSearch && matchesFilter;
    });

    const paginatedEligibleLenders = filteredLenders;

    return (
      <div
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm 
dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mb-4 flex gap-2 flex-wrap">
          {["all", "eligible", "rejected", "sent"].map((type) => (
            <button
              key={type}
              onClick={() => {
                if (lenderFilter === type) return;

                setFilterLoading(true);

                setLenderFilter(
                  type as "all" | "eligible" | "rejected" | "sent",
                );

                setLenderPage(1);

                scrollToLenders();
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all
      ${
        lenderFilter === type
          ? type === "eligible"
            ? "bg-green-600 text-white"
            : type === "rejected"
              ? "bg-red-600 text-white"
              : type === "sent"
                ? "bg-blue-600 text-white"
                : "bg-slate-800 text-white dark:bg-white dark:text-black"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      }
`}
            >
              {type === "all"
                ? "All"
                : type === "eligible"
                  ? "Eligible"
                  : type === "rejected"
                    ? "Rejected"
                    : "Sent"}
            </button>
          ))}
        </div>

        {/* HEADER */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div ref={lendersSectionRef} className="mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Find Lenders
            </h2>
            <p className="text-sm text-slate-500">
              Connect with verified lenders for this submission.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative md:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={lenderSearchQ}
                onChange={(e) => {
                  setLenderPage(1);
                  setLenderSearchQ(e.target.value);
                }}
                placeholder="Search lenders..."
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 pl-10 text-sm 
text-slate-800 outline-none
focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200
dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-cyan-800"
              />
            </div>
            <select
              value={lenderLimit}
              onChange={(e) => {
                setLenderLimit(Number(e.target.value));
                setLenderPage(1);
              }}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value={6}>6</option>
              <option value={9}>9</option>
              <option value={12}>12</option>
              <option value={18}>18</option>
            </select>
          </div>
        </div>

        {/* Borrower Summary */}
        {borrowerSummary && (
          <div
            className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 
dark:border-slate-800 dark:bg-slate-900"
          >
            <h3 className="mb-2 font-semibold text-slate-600 dark:text-slate-400">
              Borrower Summary
            </h3>

            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div>
                <b>Loan:</b>
                <div className="text-blue-400 font-semibold">
                  ${Number(borrowerSummary.loanAmount).toLocaleString()}
                </div>
              </div>

              <div>
                <b>Term:</b>
                <div className="text-blue-400 font-semibold">
                  {borrowerSummary.termMonths ?? "-"} Months
                </div>
              </div>

              <div>
                <b>Score:</b>
                <div className="text-blue-400 font-semibold">
                  {borrowerSummary.creditScore}
                </div>
              </div>

              <div>
                <b>LTV:</b>
                <div className="text-blue-400 font-semibold">
                  {borrowerSummary.ltv ?? "-"}%
                </div>
              </div>

              <div>
                <b>LTC:</b>
                <div className="text-blue-400 font-semibold">
                  {borrowerSummary.ltc ?? "-"}%
                </div>
              </div>

              <div>
                <b>ARV:</b>
                <div className="text-blue-400 font-semibold">
                  {borrowerSummary.arv ?? "-"}%
                </div>
              </div>

              <div>
                <b>Property:</b>
                <div className="text-blue-400 font-semibold">
                  {borrowerSummary.propertyType ?? "-"}
                </div>
              </div>

              <div>
                <b>State:</b>
                <div className="text-blue-400 font-semibold">
                  {borrowerSummary.propertyState ?? "-"}
                </div>
              </div>

              <div>
                <b>Total Lenders:</b>
                <div className="text-blue-400 font-semibold">
                  {lenderPagination?.total ?? lenders.length}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LOADING */}
        {lenderLoading && <div>Loading...</div>}

        {/* EMPTY */}
        {!lenderLoading &&
          !filterLoading &&
          paginatedEligibleLenders.length === 0 && (
            <div
              className="flex flex-col items-center justify-center rounded-3xl 
    border border-dashed border-slate-300 bg-gradient-to-br 
    from-slate-50 to-slate-100 px-6 py-14 text-center
    shadow-sm dark:border-slate-700 dark:from-slate-900 dark:to-slate-950"
            >
              {/* ICON */}
              <div
                className="mb-5 flex h-14 w-14 items-center justify-center rounded-full 
      bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg"
              >
                <SearchX className="h-8 w-8" />
              </div>

              {/* TITLE */}
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                No Lenders Found
              </h3>

              {/* DESCRIPTION */}
              <p
                className="mt-2 max-w-md text-sm leading-relaxed 
      text-slate-500 dark:text-slate-400"
              >
                We couldn&apos;t find any lenders matching your current filters
                or search criteria. Try adjusting filters or searching with
                different keywords.
              </p>
            </div>
          )}

        {filterLoading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
          </div>
        )}

        {/* LIST */}
        {!lenderLoading &&
          !filterLoading &&
          paginatedEligibleLenders.length > 0 && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedEligibleLenders.map((lender) => (
                <div
                  key={lender.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 
hover:shadow-md transition flex flex-col h-full
dark:border-slate-800 dark:bg-slate-900"
                >
                  {/* TOP CONTENT */}
                  <div className="flex-1">
                    {/* HEADER */}
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <h3 className="font-bold text-slate-800 dark:text-slate-100">
                          {lender.name}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {lender.email || "-"}
                        </p>
                      </div>

                      <span
                        className={`px-2 py-1 text-xs rounded-full capitalize ${
                          lender.type === "eligible"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : lender.type === "ineligible"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                              : lender.type === "rejected"
                                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        }`}
                      >
                        {lender.type === "ineligible"
                          ? "Not Eligible"
                          : lender.type}
                      </span>
                    </div>

                    {/* DETAILS */}
                    <div className="text-sm space-y-1">
                      <div>
                        Product:{" "}
                        {PRODUCT_LABELS[lender.loanProductCode] ??
                          lender.loanProductCode
                            ?.replace(/_/g, " ")
                            .toUpperCase()}
                      </div>
                      <div>
                        Funding: ${Number(lender.minFunding).toLocaleString()} -
                        ${Number(lender.maxFunding).toLocaleString()}
                      </div>
                      <div>
                        Term: {lender.minMonths} - {lender.maxMonths}
                      </div>
                      <div>Interest: {lender.interestRateRange}</div>
                      <div>Funding Speed: {lender.fundingSpeedDays} Days</div>
                    </div>

                    {/* REJECTION / INELIGIBILITY */}
                    {lender.type === "ineligible" &&
                      lender.rejectionReasons.length > 0 && (
                        <div
                          className="mt-3 rounded bg-amber-50 p-2 text-xs text-amber-800
dark:bg-amber-900/20 dark:text-amber-300"
                        >
                          <p className="mb-1 font-semibold">
                            Does not meet criteria:
                          </p>
                          <ul className="list-disc space-y-0.5 pl-4">
                            {lender.rejectionReasons.map((reason) => (
                              <li key={reason}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {lender.type === "rejected" && (
                      <div
                        className="mt-3 text-xs text-red-600 bg-red-50 p-2 rounded
dark:bg-red-900/20 dark:text-red-400"
                      >
                        Lender declined this submission
                        {lender.applicationStatus
                          ? ` (${String(lender.applicationStatus).replace(/_/g, " ").toLowerCase()})`
                          : ""}
                      </div>
                    )}
                  </div>

                  {/* BUTTON ALWAYS BOTTOM */}
                  <div ref={bottomRef} className="mt-4 pt-4 border-t">
                    <button
                      disabled={
                        sendingId === lender.lenderProductId ||
                        lender.alreadySent ||
                        !lender.canSend ||
                        !loDocPermissions.sendApplications
                      }
                      onClick={() =>
                        sendApplicationToLender(lender.lenderProductId)
                      }
                      className={`w-full py-2 rounded-lg text-white font-semibold transition-all duration-300

     ${
       sendingId === lender.lenderProductId
         ? "bg-slate-400 cursor-wait"
         : lender.alreadySent
           ? "bg-blue-500 cursor-not-allowed"
           : lender.type === "rejected"
             ? "bg-red-500 cursor-not-allowed"
             : lender.type === "ineligible"
               ? "bg-amber-500 cursor-not-allowed"
               : "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-indigo-600 hover:to-blue-500 shadow-md hover:shadow-lg"
     }

      disabled:opacity-70
      `}
                    >
                      {sendingId === lender.lenderProductId
                        ? "Sending..."
                        : lender.alreadySent
                          ? "Already Sent"
                          : lender.type === "rejected"
                            ? "Rejected"
                            : lender.type === "ineligible"
                              ? "Not Eligible"
                              : "Send to Lender"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        {/* PAGINATION */}
        {lenderPagination && lenderPagination.totalPages > 1 && (
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
            {/* PREVIOUS */}
            <button
              disabled={!lenderPagination.hasPrevPage}
              onClick={() => setLenderPage((prev) => Math.max(prev - 1, 1))}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>

            {/* PAGE NUMBERS */}
            {Array.from(
              {
                length: lenderPagination.totalPages,
              },
              (_, i) => {
                const pageNum = i + 1;

                return (
                  <button
                    key={pageNum}
                    onClick={() => setLenderPage(pageNum)}
                    className={`h-10 w-10 rounded-xl text-sm font-semibold transition ${
                      lenderPage === pageNum
                        ? "bg-cyan-600 text-white"
                        : "border border-slate-300 bg-white hover:bg-slate-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              },
            )}

            {/* NEXT */}
            <button
              disabled={!lenderPagination.hasNextPage}
              onClick={() => setLenderPage((prev) => prev + 1)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    );
  };

  const lenderOptions = useMemo(() => {
    return submittedLenders
      .filter((l) => canLenderReceiveDocuments(l))
      .map((l) => ({
        value: l.applicationLenderId,
        label: l.lenderName,
        status: l.status,
      }));
  }, [submittedLenders]);

  useEffect(() => {
    const receivableIds = new Set(lenderOptions.map((option) => option.value));
    setSelectedLenders((prev) => prev.filter((id) => receivableIds.has(id)));
  }, [lenderOptions]);

  const CustomOption = (props: any) => {
    const { data } = props;

    return (
      <components.Option {...props}>
        <div className="flex items-center justify-between gap-2">
          {/* LEFT */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{data.label}</span>
          </div>

          {/* STATUS */}
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${getLenderStatusBadgeClass(
              data.status,
            )}`}
          >
            {data.status}
          </span>
        </div>
      </components.Option>
    );
  };

  const CustomMultiValue = (props: any) => {
    const { data } = props;

    return (
      <components.MultiValue {...props}>
        <div className="flex items-center gap-1">
          <span>{data.label}</span>
        </div>
      </components.MultiValue>
    );
  };

  const selectAllOption = {
    value: "__all__",
    label: "Select All Lenders",
  };

  const finalOptions = [selectAllOption, ...lenderOptions];

  const activeActionDoc = useMemo(
    () => displayDocuments.find((doc) => doc.rowKey === activeAction) ?? null,
    [displayDocuments, activeAction],
  );

  const openDocumentActionMenu = (
    rowKey: string,
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    if (activeAction === rowKey) {
      setActiveAction(null);
      setActionMenuPos(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 208;
    const menuHeight = 220;
    let left = Math.min(
      Math.max(8, rect.right - menuWidth),
      window.innerWidth - menuWidth - 8,
    );
    let top = rect.bottom + 8;
    if (top + menuHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - menuHeight - 8);
    }

    setActionMenuPos({ top, left });
    setActiveAction(rowKey);
  };

  const closeDocumentActionMenu = () => {
    setActiveAction(null);
    setActionMenuPos(null);
  };

  const renderDocuments = () => (
    <div className="h-[90vh] min-h-screen w-full">
      <div className="mb-2">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">
          Requested Documents
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {isCoBrokerPortal
            ? "Request documents from your client, upload files, then forward them to the Principal Broker for review."
            : "Upload, filter, and send documents to lenders on this application."}
        </p>
      </div>

      <DocumentControlsBar
        autoForwardEnabled={autoForwardEnabled}
        autoForwardSaving={autoForwardSaving}
        onToggleAutoForward={handleToggleAutoForward}
        showAutoForward={loDocPermissions.autoForwardToLender}
        showAutoForwardToClient={loDocPermissions.autoForwardToClient}
        autoForwardToClientEnabled={autoForwardToClientEnabled}
        autoForwardToClientSaving={autoForwardToClientSaving}
        onToggleAutoForwardToClient={handleToggleAutoForwardToClient}
        documentFilterLenders={documentFilterLenders}
        documentLenderFilter={documentLenderFilter}
        onDocumentLenderFilterChange={setDocumentLenderFilter}
        documentSentFilter={documentSentFilter}
        onDocumentSentFilterChange={setDocumentSentFilter}
        documentSourceFilter={documentSourceFilter}
        onDocumentSourceFilterChange={setDocumentSourceFilter}
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        onResetPage={() => setPage(1)}
        showSourceFilter={!isCoBrokerPortal}
        showLenderFilter={!isCoBrokerPortal}
        showSentFilter={!isCoBrokerPortal}
      />

      {isCoBrokerPortal && selectedCoBrokerPbSendableIds.length > 0 && (
        <div className="mb-4 overflow-visible rounded-2xl border border-blue-200 bg-blue-50/70 shadow-sm dark:border-blue-900/40 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                <FiSend size={15} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-white">
                  Send to Principal Broker
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedCoBrokerPbSendableIds.length} uploaded document
                  {selectedCoBrokerPbSendableIds.length === 1 ? "" : "s"} ready
                  for review
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                handleSendToPrincipalBroker(selectedCoBrokerPbSendableIds)
              }
              disabled={sendingToBroker}
              className="inline-flex min-w-[170px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500"
            >
              {sendingToBroker ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <FiSend size={16} />
                  Send to PB
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {!isCoBrokerPortal && !autoForwardEnabled && selectedRows.length > 0 && (
        <div className="mb-4 overflow-visible rounded-2xl border border-blue-200 bg-blue-50/70 shadow-sm dark:border-blue-900/40 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-200/70 px-5 py-3 dark:border-blue-900/40">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                <FiSend size={15} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-white">
                  Send selected documents
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Choose recipients, then send.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-200 dark:bg-slate-800 dark:text-blue-300 dark:ring-blue-900">
                {selectedRows.length} document
                {selectedRows.length === 1 ? "" : "s"}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                  selectedLenders.length > 0
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900"
                    : "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900"
                }`}
              >
                {selectedLenders.length} lender
                {selectedLenders.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="min-w-0 rounded-xl border border-blue-100 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/70">
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Select lender recipients
                </label>
                {selectedLenders.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setSelectedLenders([])}
                    className="text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Clear lenders
                  </button>
                ) : null}
              </div>

              {lenderOptions.length > 0 ? (
                <div className="relative z-[60] w-full">
                  <Select
                    isMulti
                    options={finalOptions}
                    value={lenderOptions.filter((opt) =>
                      selectedLenders.includes(opt.value),
                    )}
                    closeMenuOnSelect={false}
                    hideSelectedOptions={false}
                    placeholder="Search and select lender(s)..."
                    isLoading={lenderLoading}
                    noOptionsMessage={() => "No matching lenders"}
                    onChange={(selected: any) => {
                      if (!selected) {
                        setSelectedLenders([]);
                        return;
                      }

                      const isSelectAll = selected.find(
                        (s: any) => s.value === "__all__",
                      );

                      if (isSelectAll) {
                        setSelectedLenders(lenderOptions.map((l) => l.value));
                      } else {
                        setSelectedLenders(
                          selected
                            .filter((s: any) => s.value !== "__all__")
                            .map((s: any) => s.value),
                        );
                      }
                    }}
                    components={{
                      Option: CustomOption,
                      MultiValue: (props) => {
                        if (props.index < 2)
                          return <CustomMultiValue {...props} />;
                        if (props.index === 2)
                          return (
                            <div className="px-2 text-xs">
                              +{selectedLenders.length - 2} more
                            </div>
                          );
                        return null;
                      },
                    }}
                    styles={{
                      control: (base, state) => ({
                        ...base,
                        minHeight: "46px",
                        borderRadius: "12px",
                        borderColor: state.isFocused ? "#2563eb" : "#bfdbfe",
                        boxShadow: state.isFocused
                          ? "0 0 0 2px rgba(37, 99, 235, 0.15)"
                          : "none",
                        backgroundColor: "#ffffff",
                        cursor: "pointer",
                      }),
                      menu: (base) => ({
                        ...base,
                        zIndex: 80,
                        overflow: "hidden",
                        borderRadius: "12px",
                      }),
                      valueContainer: (base) => ({
                        ...base,
                        flexWrap: "nowrap",
                        overflow: "hidden",
                      }),
                    }}
                  />
                </div>
              ) : (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  No active lenders available. Approved, declined, or withdrawn
                  lenders cannot receive documents.
                </p>
              )}
              {lenderOptions.length > 0 && selectedLenders.length === 0 ? (
                <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
                  Select at least one lender before sending.
                </p>
              ) : selectedLenders.length > 0 ? (
                <p className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400">
                  Ready to send to {selectedLenders.length} selected lender
                  {selectedLenders.length === 1 ? "" : "s"}.
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-stretch">
              <button
                type="button"
                onClick={handleSendToLender}
                disabled={
                  sending ||
                  lenderOptions.length === 0 ||
                  selectedLenders.length === 0
                }
                title={
                  selectedLenders.length === 0
                    ? "Select lender recipients first"
                    : "Send selected documents to chosen lenders"
                }
                className="inline-flex min-w-[170px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500 disabled:shadow-none dark:disabled:from-slate-700 dark:disabled:to-slate-700 dark:disabled:text-slate-400"
              >
                {sending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Sending...
                  </>
                ) : selectedLenders.length === 0 ? (
                  <>
                    <FiSend size={16} />
                    Select lender first
                  </>
                ) : (
                  <>
                    <FiSend size={16} />
                    Send to {selectedLenders.length} lender
                    {selectedLenders.length === 1 ? "" : "s"}
                  </>
                )}
              </button>

              {selectedClientSendableIds.length > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    handleForwardToClient(selectedClientSendableIds)
                  }
                  disabled={forwardingToClient}
                  className="inline-flex min-w-[170px] items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-5 py-2.5 text-xs font-semibold text-indigo-700 transition-all hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-900 dark:bg-slate-800 dark:text-indigo-300 dark:hover:bg-indigo-950/30"
                >
                  {forwardingToClient ? (
                    "Sending..."
                  ) : (
                    <>
                      <Mail size={16} />
                      Send to Client
                    </>
                  )}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {!isCoBrokerPortal && autoForwardEnabled && selectedClientSendableIds.length > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 px-5 py-3 shadow-sm dark:border-indigo-900/40 dark:from-slate-900 dark:to-slate-800">
          <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
            {selectedClientSendableIds.length} document(s) ready to send to
            client
          </p>
          <button
            type="button"
            onClick={() => handleForwardToClient(selectedClientSendableIds)}
            disabled={forwardingToClient}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-md transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {forwardingToClient ? (
              "Sending..."
            ) : (
              <>
                <Mail size={16} />
                Send to Client
              </>
            )}
          </button>
        </div>
      )}

      {documentsLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
          <p className="mt-3 text-sm text-slate-500">Loading documents...</p>
        </div>
      ) : displayDocuments.length > 0 ? (
        <div className="my-4 flex max-h-[calc(100vh-220px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-5 py-3 dark:border-slate-800 dark:bg-slate-900/80">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-white">
                Requested documents
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {documentsPagination?.total ?? displayDocuments.length} document
                {(documentsPagination?.total ?? displayDocuments.length) === 1
                  ? ""
                  : "s"}{" "}
                in this view
              </p>
            </div>
            {selectedRows.length > 0 && (
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                {selectedRows.length} selected
              </span>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[920px] table-fixed text-sm">
              <colgroup>
                <col className="w-12" />
                <col className="w-[24%]" />
                <col className="w-[12%]" />
                <col className="w-[16%]" />
                <col className="w-[22%]" />
                <col className="w-[14%]" />
                <col className="w-16" />
              </colgroup>

              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleSelectAll}
                      className="h-4 w-4 cursor-pointer accent-blue-600"
                      aria-label="Select all documents"
                    />
                  </th>
                  <th className="px-4 py-3 text-left">Document</th>
                  <th className="px-4 py-3 text-left">Source</th>
                  <th className="px-4 py-3 text-left">Requested</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Files</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {displayDocuments.map((doc, rowIndex) => {
                  const isOpen = activeAction === doc.rowKey;
                  const isSelected = selectedRows.includes(doc.rowKey);
                  const { label: sourceLabel, className: sourceClass } =
                    getDocumentSourceDisplay(doc, {
                      brokerSourceLabel: isCoBrokerPortal ? "Me" : "Me",
                      subBrokerSourceLabel: "Me",
                    });
                  const requestDisplay = getDocumentRequestDisplay(doc);
                  const uploadedCount = Number(doc.uploadedCount) || 0;

                  return (
                    <tr
                      key={doc.rowKey}
                      className={`group transition-colors ${
                        isSelected
                          ? "bg-blue-50/70 dark:bg-blue-950/20"
                          : rowIndex % 2 === 1
                            ? "bg-slate-50/40 dark:bg-slate-900/20"
                            : "bg-white dark:bg-slate-900"
                      } hover:bg-slate-50 dark:hover:bg-slate-800/40`}
                    >
                      <td className="px-4 py-3 align-middle">
                        <input
                          type="checkbox"
                          disabled={doc.status === "SKIPPED"}
                          checked={isSelected}
                          onChange={() => handleSelectRow(doc.rowKey)}
                          className="h-4 w-4 cursor-pointer accent-blue-600 disabled:opacity-40"
                          aria-label={`Select ${doc.documentName}`}
                        />
                      </td>

                      <td className="px-4 py-3 align-middle">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 ring-1 ring-blue-100 dark:from-blue-950/40 dark:to-indigo-950/30 dark:text-blue-400 dark:ring-blue-900/40">
                            <FileText size={16} />
                          </div>
                          <div className="min-w-0">
                            <p
                              className="truncate font-semibold text-slate-800 dark:text-white"
                              title={doc.documentName}
                            >
                              {doc.documentName}
                            </p>
                            {doc.isRequired && (
                              <span className="mt-0.5 inline-flex rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-600 ring-1 ring-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:ring-rose-900/40">
                                Required
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 align-middle">
                        <span
                          className={`inline-flex max-w-full truncate rounded-full px-2.5 py-1 text-[11px] font-semibold ${sourceClass}`}
                          title={sourceLabel}
                        >
                          {sourceLabel}
                        </span>
                      </td>

                      <td className="px-4 py-3 align-middle">
                        {requestDisplay?.date ? (
                          <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
                            {requestDisplay.date}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 align-middle">
                        <DocumentStatusCell
                          doc={doc}
                          hideUploadChip
                          viewerPortal={
                            isCoBrokerPortal ? "coBroker" : undefined
                          }
                        />
                      </td>

                      <td className="px-4 py-3 align-middle">
                        {uploadedCount > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewFiles(
                                (doc.uploadedFiles as any[]) || [],
                              );
                              setActiveIndex(0);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
                          >
                            <span>
                              {uploadedCount} file
                              {uploadedCount === 1 ? "" : "s"}
                            </span>
                            <Eye size={14} className="opacity-80" />
                          </button>
                        ) : (
                          <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                            No files
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center align-middle">
                        <button
                          type="button"
                          ref={(el) => {
                            actionButtonRefs.current[doc.rowKey] = el;
                          }}
                          onClick={(event) =>
                            openDocumentActionMenu(doc.rowKey, event)
                          }
                          className={`rounded-xl border p-2 transition ${
                            isOpen
                              ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
                              : "border-transparent text-slate-500 hover:border-slate-200 hover:bg-white hover:text-slate-700 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                          }`}
                          aria-label={`Actions for ${doc.documentName}`}
                          aria-expanded={isOpen}
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

          {/* PAGINATION */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Page{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {documentsPagination?.page}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {documentsPagination?.totalPages}
              </span>
              {documentsPagination?.total != null && (
                <span className="ml-1 text-slate-400">
                  ({documentsPagination.total} documents)
                </span>
              )}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:disabled:border-slate-800 dark:disabled:bg-slate-800/50 dark:disabled:text-slate-600"
              >
                <ChevronLeft size={16} />
                Previous
              </button>

              {documentsPagination?.totalPages > 1 &&
                Array.from(
                  { length: documentsPagination.totalPages },
                  (_, index) => {
                    const pageNum = index + 1;

                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setPage(pageNum)}
                        className={`h-9 min-w-9 rounded-xl px-2.5 text-sm font-semibold transition ${
                          page === pageNum
                            ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-sm"
                            : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  },
                )}

              <button
                type="button"
                disabled={page === documentsPagination?.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:disabled:border-slate-800 dark:disabled:bg-slate-800/50 dark:disabled:text-slate-600"
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          {/* ICON */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="mb-6 flex h-20 w-20 items-center justify-center rounded-full 
    bg-gradient-to-br from-blue-100 to-cyan-100 
    text-blue-600 shadow-md"
          >
            <FiFolder size={36} />
          </motion.div>

          {/* TITLE */}
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            No Documents Found
          </h3>

          {/* DESCRIPTION */}
          <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            You havenâ€™t requested documents yet.
          </p>
        </div>
      )}
      {activeActionDoc &&
        actionMenuPos &&
        createPortal(
          <div
            ref={actionMenuRef}
            style={{
              position: "fixed",
              top: actionMenuPos.top,
              left: actionMenuPos.left,
              zIndex: 9999,
            }}
            className="w-52 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            {loDocPermissions.upload ? (
              <label className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm text-amber-700 transition hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/20">
                <Upload size={14} />
                Upload Files
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (!files) return;

                    try {
                      const token = getPortalToken();

                      for (const file of Array.from(files)) {
                        const formData = new FormData();
                        formData.append("file", file);

                        const res = await fetch(
                          previewApi.submissionDocumentUpload(
                            documentsData.submissionId,
                            activeActionDoc.requirementId,
                          ),
                          {
                            method: "POST",
                            headers: {
                              ...(token && {
                                Authorization: `Bearer ${token}`,
                              }),
                            },
                            body: formData,
                          },
                        );

                        const json = await res.json();
                        if (!res.ok || !json.success) {
                          throw new Error(`${file.name} failed`);
                        }
                      }

                      toast.success("Uploaded successfully");
                      await fetchSubmissionDocuments(documentsData.submissionId);
                    } catch (err: any) {
                      toast.error(err.message);
                    } finally {
                      closeDocumentActionMenu();
                    }
                  }}
                />
              </label>
            ) : null}
            {isCoBrokerPortal &&
              activeActionDoc.source === "SUB_BROKER_ADDED" &&
              Number(activeActionDoc.uploadedCount) > 0 &&
              !activeActionDoc.isSentToBroker &&
              activeActionDoc.status !== "SKIPPED" && (
                <button
                  type="button"
                  onClick={async () => {
                    await handleSendToPrincipalBroker([
                      String(activeActionDoc.requirementId),
                    ]);
                    closeDocumentActionMenu();
                  }}
                  disabled={sendingToBroker}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-blue-600 transition hover:bg-blue-50 disabled:opacity-60 dark:text-blue-400 dark:hover:bg-blue-500/10"
                >
                  <FiSend size={14} />
                  Send To PB
                </button>
              )}
            <button
              type="button"
              onClick={() => {
                setActivityDoc(activeActionDoc);
                closeDocumentActionMenu();
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Activity size={14} />
              Current Activities
            </button>
            {(activeActionDoc.source === "LENDER_ADDED" ||
              activeActionDoc.source === "BROKER_ADDED") &&
              activeActionDoc.status !== "SKIPPED" && (
                <button
                  type="button"
                  onClick={() =>
                    handleForwardToClient([
                      String(activeActionDoc.requirementId),
                    ])
                  }
                  disabled={forwardingToClient}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-60 dark:text-indigo-400 dark:hover:bg-indigo-950/20"
                >
                  <Mail size={14} />
                  Send to Client
                </button>
              )}
            {activeActionDoc.source === "SUB_BROKER_ADDED" &&
              activeActionDoc.status !== "SKIPPED" &&
              loDocPermissions.delete && (
                <>
                  <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                  <button
                    type="button"
                    onClick={async () => {
                      const result = await Swal.fire({
                        title: "Skip Document?",
                        input: "textarea",
                        inputLabel: "Reason",
                        inputPlaceholder: "Enter skip reason...",
                        inputValidator: (value) => {
                          if (!value) {
                            return "Reason is required";
                          }
                        },
                        showCancelButton: true,
                        confirmButtonText: "Skip",
                        confirmButtonColor: "#dc2626",
                      });

                      if (!result.isConfirmed) return;

                      try {
                        const token = getPortalToken();
                        const res = await fetch(
                          previewApi.skipSubBrokerSubmission(
                            String(activeActionDoc.subBrokerSubmissionId),
                          ),
                          {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              ...(token && {
                                Authorization: `Bearer ${token}`,
                              }),
                            },
                            body: JSON.stringify({
                              reason: result.value,
                            }),
                          },
                        );

                        const json = await res.json();

                        if (!res.ok || !json.success) {
                          throw new Error(
                            json.message || "Failed to skip document",
                          );
                        }

                        toast.success("Document skipped successfully");

                        setSelectedRows((prev) =>
                          prev.filter(
                            (id) => id !== activeActionDoc.requirementId,
                          ),
                        );

                        await fetchSubmissionDocuments(
                          documentsData.submissionId,
                          page,
                          debouncedSearch,
                        );
                      } catch (err: any) {
                        toast.error(err.message || "Failed to skip document");
                      } finally {
                        closeDocumentActionMenu();
                      }
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20"
                  >
                    <Send size={14} />
                    Skip Document
                  </button>
                </>
              )}
          </div>,
          document.body,
        )}
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "view-details":
        return renderViewDetails();
      case "update-application":
        return renderUpdateApplicationForm();
      case "find-lenders":
        return renderFindLenders();
      case "request-document":
        return renderRequestDocument();
      case "email-reminders":
        return <DocumentReminderPanel loanApplicationId={applicationId} />;
      case "view-loi":
        return renderViewLoi();
      case "documents":
        return (
          <div
            key={`documents-${documentsRefreshKey}-${submissionId || "none"}`}
          >
            {renderDocuments()}
          </div>
        );
      case "sign-documents":
        return (
          <SignDocumentsPanel
            mode="broker"
            apiRolePrefix={
              previewConfig.pipelineApiRoot === "loanofficer"
                ? "loanofficer"
                : "broker"
            }
            apiBase={API_BASE}
            getAuthHeaders={() => {
              const headers = getAuthHeaders() as Record<string, string>;
              return headers;
            }}
            submissionId={submissionId}
            loanApplicationId={applicationId}
          />
        );
      // case "submitted-lenders":
      //   return renderSubmittedLenders();
      case "chat":
        return (
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
            <PreviewChat
              applicationId={applicationId}
              {...(previewConfig.portal === "broker"
                ? {
                    initialConversationId: (
                      Location.state as { conversationId?: string }
                    )?.conversationId,
                  }
                : {})}
            />
          </div>
        );
      case "fee-agreement":
        return (
          <PreviewFeeAgreement
            applicationId={applicationId}
            getAuthHeaders={getAuthHeaders}
            applicationBrokerPoints={getFieldValue(fields, "brokerPoints")}
          />
        );
      case "commissions":
        return (
          <LoanCommissionPanel
            loanApplicationId={applicationId}
            getAuthHeaders={getAuthHeaders}
            canMarkPaid={previewConfig.canMarkPaidCommission && isBrokerAdmin}
            portal={previewConfig.commissionPortal}
          />
        );
      default:
        return renderViewDetails();
    }
  };

  const isChatTab = activeTab === "chat";

  if (!submissionId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">
            Submission not found
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            The preview URL is missing a submitted id.
          </p>
        </div>
      </div>
    );
  }

  const borrowerName = useMemo(() => {
    const firstNameField = fields.find(
      (f: any) => f.fieldKey === "borrowerFirstName",
    );

    const lastNameField = fields.find(
      (f: any) => f.fieldKey === "borrowerLastName",
    );

    const firstName = firstNameField?.value || "";
    const lastName = lastNameField?.value || "";

    return `${firstName} ${lastName}`.trim() || "-";
  }, [fields]);

  const productCode = submissionDetail?.loanProduct?.name || "-";

  return (
    <>
      <div className="h-dvh w-full overflow-x-hidden overflow-y-auto bg-slate-50 dark:bg-[#0b1120] dark:text-slate-100">
        <div className="mx-auto w-full max-w-[1600px] space-y-6 p-4 md:p-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            {/* LEFT SIDE */}
            <div>
              {/* BACK BUTTON */}
              <button
                onClick={() => navigate(previewConfig.pipelineListPath)}
                className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition"
              >
                <ArrowLeft size={16} />
                {previewConfig.backLabel}
              </button>

              {/* TITLE */}
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                Loan Application Preview 
              </h1>

              {/* SUBTEXT */}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {submissionDetail?.applicationNumber || submissionId}
              </p>

              {/* EXTRA INFO (Client + Product + Amount) */}
              <div className="mt-4 flex flex-wrap items-stretch gap-3 sm:gap-4 md:gap-5 lg:gap-6">
                {/* CLIENT */}
                <div className="flex min-w-[200px] flex-1 items-center gap-3 rounded-2xl bg-gradient-to-br from-[#4C76DA]/20 to-[#13538A]/15 px-5 py-3 shadow-md ring-2 ring-[#4C76DA]/35 transition-all hover:shadow-lg dark:from-[#4C76DA]/25 dark:to-[#13538A]/20 dark:ring-[#4C76DA]/45 sm:flex-none sm:flex-initial">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#13538A] text-white shadow-sm">
                    <FiUser size={18} />
                  </div>

                  <div className="flex min-w-0 flex-col leading-tight">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[#13538A] dark:text-[#93b4ff]">
                      Client Name
                    </span>
                    <span className="truncate text-base font-bold text-[#0f2d4d] dark:text-white">
                      {borrowerName}
                    </span>
                  </div>
                </div>

                {/* PRODUCT */}
                <div className="flex min-w-[180px] flex-1 items-center gap-3 rounded-2xl bg-[#4C76DA]/10 px-4 py-2.5 shadow-sm transition-all hover:shadow-md dark:bg-[#4C76DA]/15 sm:flex-none sm:flex-initial">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#4C76DA] text-white">
                    <FiTag size={16} />
                  </div>

                  <div className="flex flex-col leading-tight">
                    <span className="text-[11px] font-medium text-[#4C76DA]">
                      Product Name
                    </span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {productCode}
                    </span>
                  </div>
                </div>

                {/* AMOUNT */}
                <div className="flex min-w-[180px] flex-1 items-center gap-3 rounded-2xl bg-[#4C76DA]/10 px-4 py-2.5 shadow-sm transition-all hover:shadow-md dark:bg-[#4C76DA]/15 sm:flex-none sm:flex-initial">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#4C76DA] text-white">
                    $
                  </div>

                  <div className="flex flex-col leading-tight">
                    <span className="text-[11px] font-medium text-[#4C76DA]">
                      Loan Amount Requested
                    </span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {formatCurrencyValue(submissionDetail?.amountRequested || 0)}
                    </span>
                  </div>
                </div>

                {/* CREDIT SCORE */}
                <div className="flex min-w-[140px] flex-1 items-center gap-3 rounded-2xl bg-[#4C76DA]/10 px-4 py-2.5 shadow-sm transition-all hover:shadow-md dark:bg-[#4C76DA]/15 sm:flex-none sm:flex-initial">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#4C76DA] text-sm font-bold text-white">
                    <FaRegCreditCard />
                  </div>

                  <div className="flex flex-col leading-tight">
                    <span className="text-[11px] font-medium text-[#4C76DA]">
                      Credit Score
                    </span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {submissionDetail?.creditScore || "N/A"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT SIDE STATUS */}
            <div className="flex gap-3">
              <span
                className={`rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide shadow-sm ${getStatusChip(
                  getDisplayApplicationStatus(submissionDetail),
                )}`}
              >
                {formatSubmissionStatus(
                  getDisplayApplicationStatus(submissionDetail),
                )}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center text-slate-500">Loading...</div>
          ) : (
            <>
              <div className="mb-6 overflow-hidden rounded-[30px] border border-[#4C76DA]/20 bg-[#4C76DA] p-6 text-white">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
                  <Metric
                    label="Monthly Payment"
                    value={monthlyPaymentDisplay}
                  />
                  <Metric label="LTV" value={ltv ? `${formatStatNumber(ltv)}%` : "-"} />
                  <Metric label="LTC" value={ltc ? `${formatStatNumber(ltc)}%` : "-"} />
                  <Metric label="ARV %" value={arv ? `${formatStatNumber(arv)}%` : "-"} />
                  <Metric label="DSCR Ratio" value={dscr ? formatStatNumber(dscr) : "-"} />
                  <Metric
                    label="Net Worth"
                    value={netWorthDisplay}
                  />
                </div>
              </div>

              <div
                className={`flex flex-col gap-6 lg:flex-row ${
                  isChatTab
                    ? "lg:h-[calc(100svh-22rem)] lg:max-h-[calc(100svh-14rem)] lg:min-h-[620px] lg:items-stretch lg:overflow-hidden"
                    : "lg:items-start"
                }`}
              >
                <aside
                  className={`w-full shrink-0 lg:w-60 ${
                    isChatTab
                      ? "lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-hidden"
                      : "lg:sticky lg:top-4"
                  }`}
                >
                  <nav
                    aria-label="Loan application sections"
                    className={`rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 ${
                      isChatTab
                        ? "chat-panel-scrollbar lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-y-contain"
                        : "overflow-hidden"
                    }`}
                  >
                    {tabSections.map((section, sectionIndex) => (
                      <div
                        key={section.id}
                        className={
                          sectionIndex > 0
                            ? "border-t border-slate-100 dark:border-slate-800"
                            : ""
                        }
                      >
                        <p className="px-4 pb-2 pt-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          {section.label}
                        </p>
                        <div className="space-y-1.5 px-2 pb-3">
                          {section.items.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.key;
                            const isDisabled = Boolean(tab.disabled);

                            return (
                              <button
                                key={tab.key}
                                type="button"
                                disabled={isDisabled}
                                title={
                                  isDisabled ? tab.disabledReason : undefined
                                }
                                aria-current={isActive ? "page" : undefined}
                                onClick={() => {
                                  if (isDisabled) return;
                                  setActiveTab(tab.key);
                                }}
                                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${
                                  isActive
                                    ? "bg-[#13538A] text-white shadow-sm"
                                    : isDisabled
                                      ? "cursor-not-allowed text-slate-400 opacity-50"
                                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                                }`}
                              >
                                <Icon
                                  size={16}
                                  className={
                                    isActive ? "text-white" : tab.color
                                  }
                                />
                                <span className="min-w-0 flex-1 truncate">
                                  {tab.label}
                                </span>
                                {tab.key === "view-loi" && loiCount > 0 && (
                                  <span
                                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                                      isActive
                                        ? "bg-white/20 text-white"
                                        : "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
                                    }`}
                                  >
                                    {loiCount}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </nav>
                </aside>

                <main
                  className={`min-w-0 flex-1 ${
                    isChatTab
                      ? "flex h-full min-h-0 flex-col overflow-hidden"
                      : ""
                  }`}
                >
                  {renderTabContent()}
                </main>
              </div>
            </>
          )}
        </div>
      </div>

      <DocumentActivityModal
        doc={activityDoc}
        onClose={() => setActivityDoc(null)}
      />

      {previewFiles.length > 0 && (
        <div className="fixed inset-0 z-[99999999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex h-[90vh] max-h-[90vh] w-full max-w-6xl min-h-0 flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900"
          >
            {/* HEADER */}
            <div className="flex shrink-0 items-center justify-between bg-gradient-to-r from-blue-600 to-teal-600 px-6 py-4 text-white">
              {/* LEFT */}
              <div>
                <h2 className="text-sm font-semibold truncate max-w-md">
                  {currentFile.fileName}
                </h2>
                <p className="text-xs text-white/70">
                  {activeIndex + 1} / {previewFiles.length}
                  {currentFile && (
                    <> · {getUploadFileSentLabel(currentFile).label}</>
                  )}
                </p>
              </div>

              {/* RIGHT ACTIONS */}
              <div className="flex items-center gap-2">
                {/* DOWNLOAD */}
                <button
                  onClick={async () => {
                    if (!currentPreviewFileUrl) {
                      toast.error("Download failed");
                      return;
                    }

                    try {
                      const res = await fetch(currentPreviewFileUrl, {
                        headers: getAuthHeaders(),
                      });
                      const blob = await res.blob();

                      const url = window.URL.createObjectURL(blob);
                      const link = document.createElement("a");

                      link.href = url;
                      link.download = currentFile.fileName || "file";

                      document.body.appendChild(link);
                      link.click();
                      link.remove();

                      window.URL.revokeObjectURL(url);
                    } catch (err) {
                      toast.error("Download failed");
                    }
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium 
      bg-white/20 hover:bg-white/30 rounded-lg transition backdrop-blur"
                >
                  <Download size={14} />
                  Download
                </button>

                {/* CLOSE */}
                <button
                  onClick={() => {
                    setPreviewFiles([]);
                    setActiveIndex(0);
                  }}
                  className="bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg text-xs transition"
                >
                  Close
                </button>
              </div>
            </div>

            {/* CONTENT */}
            <div className="relative flex min-h-0 flex-1 overflow-hidden bg-slate-100 dark:bg-slate-950">
              {/* LEFT */}
              {activeIndex > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveIndex((p) => p - 1)}
                  className="absolute left-4 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md transition hover:bg-slate-50"
                  aria-label="Previous file"
                >
                  <ChevronLeft size={20} />
                </button>
              )}

              {/* RIGHT */}
              {activeIndex < previewFiles.length - 1 && (
                <button
                  type="button"
                  onClick={() => setActiveIndex((p) => p + 1)}
                  className="absolute right-4 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md transition hover:bg-slate-50"
                  aria-label="Next file"
                >
                  <ChevronRight size={20} />
                </button>
              )}

              {/* FILE VIEW */}
              <EmbeddedFilePreview
                remoteUrl={currentPreviewFileUrl}
                mimeType={currentFile?.fileMimeType}
                fileName={currentFile?.fileName}
                getAuthHeaders={getAuthHeaders}
                className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden p-4"
                iframeClassName="h-full min-h-0 w-full flex-1 rounded-xl bg-white"
                imageClassName="max-h-full max-w-full rounded-xl object-contain shadow"
              />
            </div>

            {/* THUMBNAILS */}
            <div className="shrink-0 border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/80">
              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Select file ({activeIndex + 1} of {previewFiles.length})
              </p>
              <div className="flex gap-2 overflow-x-auto px-3 pb-3">
                {previewFiles.map((file, i) => {
                  const fileSent = getUploadFileSentLabel(file);

                  return (
                    <div
                      key={file.uploadId || i}
                      onClick={() => setActiveIndex(i)}
                      className={`relative h-14 w-20 flex items-center justify-center rounded-lg cursor-pointer border-2 overflow-hidden ${
                        i === activeIndex
                          ? "border-blue-500"
                          : "border-transparent"
                      }`}
                    >
                      {file.fileMimeType?.includes("image") ? (
                        <img
                          src={`${API_BASE}${file.fileUrl}`}
                          className="h-full w-full object-cover"
                        />
                      ) : file.fileMimeType?.includes("pdf") ? (
                        <div className="flex flex-col items-center justify-center text-[10px] text-red-600 font-semibold">
                          PDF
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400">FILE</div>
                      )}
                      <span
                        className={`absolute bottom-0 left-0 right-0 px-0.5 py-0.5 text-[8px] font-bold text-center truncate ${
                          fileSent.isSent
                            ? "bg-emerald-600 text-white"
                            : "bg-amber-500 text-white"
                        }`}
                      >
                        {fileSent.isSent ? "Sent" : "Pending"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};

export { LoanPreview };
export default LoanPreview;
