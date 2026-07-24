import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  DollarSign,
  Eye,
  FileSearch,
  FileText,
  FolderOpen,
  Loader2,
  Mail,
  MessageSquare,
  MoreVertical,
  Pencil,
  Search,
  SearchX,
  Send,
  Upload,
  X,
} from "lucide-react";

import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useLocation, useNavigate } from "react-router";
import { motion } from "framer-motion";
import Select, { components } from "react-select";

import { FiFolder, FiSend, FiTag, FiUser } from "react-icons/fi";
import Swal from "sweetalert2";
import { FaRegCreditCard } from "react-icons/fa6";
import LoanPreviewChat from "./LoanPreviewChat";
import FeeAgreement from "./FeeAgreement";
import LoanApplication from "../LoanApplication/LoanApplication";
import { mapSubmissionToLoanApplication } from "../../lib/mapSubmissionToLoanApplication";
import {
  expandDocumentsForDisplay,
  formatDocumentStatusLine,
  getDocumentSourceDisplay,
  getDocumentStatusBadgeDate,
  getDocumentStatusLineClass,
  getDocumentStatusLines,
  getUploadFileSentLabel,
  matchesDocumentSentFilter,
  type DocumentSentFilter,
  type DocumentSourceFilter,
} from "../../lib/documentLenderSend";
import {
  formatDocumentStatusLabel,
  getDocumentStatusChipClass,
} from "../../lib/documentStatus";
import DocumentControlsBar from "../../components/documents/DocumentControlsBar";
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

type TabSectionId =
  | "application"
  | "documents"
  | "communication"
  | "lender";

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
  icon: typeof Eye;
  items: TabItem[];
};

const TAB_SECTION_BY_KEY: Record<TabKey, TabSectionId> = {
  "view-details": "application",
  "update-application": "application",
  "fee-agreement": "application",
  commissions: "application",
  documents: "documents",
  "request-document": "documents",
  "sign-documents": "documents",
  chat: "communication",
  "email-reminders": "communication",
  "find-lenders": "lender",
  "view-loi": "lender",
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
  const field = fields.find(
    (f) => f.fieldKey === key || f.fieldId === key,
  );

  return field ? parseValue(field.value) : undefined;
};

function getAuthHeaders(): HeadersInit {
  const token = sessionStorage.getItem("broker_token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

const getDocumentStatusChip = getDocumentStatusChipClass;

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
      <div className="absolute inset-0 opacity-0 blur-xl transition duration-300 group-hover:opacity-100 bg-gradient-to-r from-cyan-400/10 to-blue-500/10" />
      <p
        className={`text-[11px] font-semibold uppercase tracking-widest transition ${isHero
            ? "text-white/70 group-hover:text-white"
            : "text-slate-500 group-hover:text-slate-700"
          }`}
      >
        {label}
      </p>
      <p
        className={`mt-2 text-md font-bold transition-all duration-300 ${isHero
            ? "text-white group-hover:scale-105"
            : "bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent group-hover:from-blue-600 group-hover:to-cyan-500"
          }`}
      >
        {value}
      </p>
      <div
        className={`mt-3 h-[3px] w-0 rounded-full transition-all duration-300 group-hover:w-full ${isHero
            ? "bg-gradient-to-r from-white/80 to-cyan-300"
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

const LoanPreview = () => {
  const Location = useLocation();
  const actionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lendersSectionRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

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
  const [selectedRequestDocMeta, setSelectedRequestDocMeta] = useState<
    Record<string, { name: string; isCustom: boolean }>
  >({});
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

  const isFundedDeal = submissionDetail?.status === "FUNDED";

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
      documentSentFilter ||
      documentsData?.activeFilters?.sentFilter ||
      "all";

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

  const autoForwardEnabled = Boolean(documentsData?.autoForwardDocumentsToLender);
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

      const token = sessionStorage.getItem("broker_token");

      const res = await fetch(
        `${API_BASE}/broker/loan-pipeline/${applicationId}/submitted-lenders`,
        {
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
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

      const token = sessionStorage.getItem("broker_token");

      const res = await fetch(
        `${API_BASE}/broker/loan-pipeline/submissions/${submissionId}/documents/submit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
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
          failedResults.map((result: any) => result.message).filter(Boolean).join(" ") ||
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
      const token = sessionStorage.getItem("broker_token");

      const res = await fetch(
        `${API_BASE}/broker/loan-pipeline/submissions/${submissionId}/documents/auto-forward`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
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
      const token = sessionStorage.getItem("broker_token");

      const res = await fetch(
        `${API_BASE}/broker/loan-pipeline/submissions/${submissionId}/documents/auto-forward-to-client`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
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
      const token = sessionStorage.getItem("broker_token");

      const res = await fetch(
        `${API_BASE}/broker/loan-pipeline/submissions/${documentsData.submissionId}/documents/forward-to-client`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
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

  const documentRequestBlockedReason = useMemo(
    () => getBrokerRequestDocumentsDisabledReason(submissionDetail),
    [submissionDetail],
  );

  useEffect(() => {
    if (!applicationId) {
      setLoiCount(0);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/broker/loan-pipeline/${applicationId}/lois?page=1&limit=1`,
          { headers: getAuthHeaders() },
        );
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
  }, [applicationId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLenderSearch(lenderSearchQ);
      setLenderPage(1);
    }, 400);

    return () => clearTimeout(timer);
  }, [lenderSearchQ]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!activeAction) return;
  
      const current = actionRefs.current[activeAction];
  
      if (current && !current.contains(e.target as Node)) {
        setActiveAction(null);
      }
    };
  
    document.addEventListener("mousedown", handleClickOutside);
  
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, [activeAction]);

  const fetchSubmissionDetails = async (id: string) => {
    try {
      setLoading(true);
      const res = await fetch(
        `${API_BASE}/api/public/broker/applications/submissions/${id}`,
      );
      const json = await res.json();
      if (!res.ok || !json.success)
        throw new Error(json.message || "Failed to fetch submission");
      setSubmissionDetail(json.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch submission details");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkFunded = async (applicationLenderId: string) => {
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
        `${API_BASE}/broker/loan-pipeline/${applicationId}/mark-funded`,
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

  const fetchDocumentTypes = async (
    id: string,
    pageNo = requestDocPage,
    searchQuery = debouncedRequestDocSearch,
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
      setSelectedRequestDocMeta((prev) => {
        const next = { ...prev };
        for (const doc of formattedDocs) {
          next[doc.documentTypeId] = {
            name: doc.documentType.name,
            isCustom: doc.isCustom,
          };
        }
        return next;
      });
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

  const handleSelectAllRequestDocs = async () => {
    try {
      setSelectingAllRequestDocs(true);
      const search = debouncedRequestDocSearch.trim();
      const collected: Array<{ id: string; name: string; isCustom: boolean }> =
        [];

      // Prefer unpaginated fetch when backend supports `all=true`
      const allParams = new URLSearchParams({ all: "true" });
      if (search) allParams.set("search", search);

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
      setSelectedRequestDocMeta((prev) => {
        const next = { ...prev };
        for (const doc of unique) {
          next[doc.id] = { name: doc.name, isCustom: doc.isCustom };
        }
        return next;
      });

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

    setSelectedRequestDocMeta((prev) => {
      if (isSelected) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return {
        ...prev,
        [id]: {
          name: doc.documentType?.name || "Document",
          isCustom: Boolean(doc.isCustom),
        },
      };
    });
  };

  const removeRequestedDocument = (id: string) => {
    setSelectedRequestDocs((prev) => prev.filter((item) => item !== id));
    setSelectedRequestDocMeta((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const clearRequestedDocuments = () => {
    if (selectedRequestDocs.length === 0) return;
    setSelectedRequestDocs([]);
    setSelectedRequestDocMeta({});
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
        body: JSON.stringify({ name: customName }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to add custom document");
      }

      const createdId = String(json.data?.id || "");
      const createdName = String(json.data?.name || customName);
      if (createdId) {
        setSelectedRequestDocs((prev) =>
          prev.includes(createdId) ? prev : [createdId, ...prev],
        );
        setSelectedRequestDocMeta((prev) => ({
          ...prev,
          [createdId]: { name: createdName, isCustom: true },
        }));
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
      const token = sessionStorage.getItem("broker_token");

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
        `${API_BASE}/broker/loan-pipeline/submissions/${submissionId}/documents?${params.toString()}`,
        {
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
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
    if (!canRequestDocuments) {
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
        `${API_BASE}/broker/loan-pipeline/${applicationId}/request-documents`,
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
      setSelectedRequestDocMeta({});
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
        await fetchSubmissionDocuments(
          submissionId,
          1,
          "",
          "",
          "all",
          "all",
        );
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
        `${API_BASE}/broker/lender-discovery/applications/submissions/${id}/eligible?page=${lenderPage}&limit=${lenderLimit}&search=${debouncedLenderSearch}&filter=${lenderFilter}`,
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
        `${API_BASE}/broker/lender-discovery/applications/${applicationId}/submissions/${submissionId}/send-to-lenders`,
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
  //         `${API_BASE}/broker/loan-pipeline/submissions/${currentSubmissionId}/documents/${requirementId}/upload`,
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
    if (
      activeTab !== "documents" ||
      !submissionId ||
      !applicationId
    ) {
      return;
    }

    fetchSubmittedLenders();
    fetchSubmissionDocuments(
      submissionId,
      page,
      debouncedSearch,
      documentLenderFilter,
      documentSentFilter,
      documentSourceFilter,
    );
  }, [
    activeTab,
    applicationId,
    submissionId,
  ]);

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
    setSelectedRequestDocMeta({});
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
    if (!canRequestDocuments && activeTab === "request-document") {
      setActiveTab("view-details");
    }
  }, [canRequestDocuments, activeTab]);

  useEffect(() => {
    setRequestDocs([]);
    setRequestDocsLoadedFor(null);
    setSelectedRequestDocs([]);
    setSelectedRequestDocMeta({});
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
      canRequestDocuments &&
      applicationId &&
      requestDocsLoadedFor !== applicationId
    ) {
      fetchDocumentTypes(applicationId, 1, "");
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
      !canRequestDocuments ||
      !applicationId ||
      requestDocsLoadedFor !== applicationId
    ) {
      return;
    }
    fetchDocumentTypes(applicationId, requestDocPage, debouncedRequestDocSearch);
  }, [requestDocPage, debouncedRequestDocSearch]);

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
  const interestRate =
    Number(getFieldValue(fields, "interestRate") ?? 0) || 0;
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

  const submittedDate = submissionDetail?.submittedAt
    ? new Date(submissionDetail.submittedAt)
    : null;

  const tabSections: TabSection[] = [
    {
      id: "application",
      label: "Application",
      icon: ClipboardList,
      items: [
        {
          key: "view-details",
          label: "View Details",
          icon: Eye,
          color: "text-blue-600",
        },
        ...(submissionDetail?.canEdit !== false
          ? [
              {
                key: "update-application" as const,
                label: "Update Application",
                icon: Pencil,
                color: "text-cyan-600",
              },
            ]
          : []),
        {
          key: "fee-agreement",
          label: "Fee Agreement",
          icon: FileText,
          color: "text-indigo-600",
        },
        ...(isFundedDeal
          ? [
              {
                key: "commissions" as const,
                label: "Commissions",
                icon: DollarSign,
                color: "text-emerald-600",
              },
            ]
          : []),
      ],
    },
    {
      id: "documents",
      label: "Documents",
      icon: FolderOpen,
      items: [
        {
          key: "documents",
          label: "Upload Documents",
          icon: Upload,
          color: "text-amber-600",
        },
        {
          key: "request-document",
          label: "Request Documents",
          icon: Send,
          color: "text-emerald-600",
          disabled: !canRequestDocuments,
          disabledReason:
            documentRequestBlockedReason ||
            "Documents cannot be requested for this application.",
        },
        {
          key: "sign-documents",
          label: "Documents to Sign",
          icon: FileText,
          color: "text-indigo-600",
        },
      ],
    },
    {
      id: "communication",
      label: "Communication",
      icon: MessageSquare,
      items: [
        {
          key: "chat",
          label: "Chat",
          icon: MessageSquare,
          color: "text-green-600",
        },
        {
          key: "email-reminders",
          label: "Email Reminders",
          icon: Mail,
          color: "text-sky-600",
        },
      ],
    },
    {
      id: "lender",
      label: "Lender",
      icon: Building2,
      items: [
        {
          key: "find-lenders",
          label: "Lender Hub",
          icon: FileSearch,
          color: "text-blue-600",
        },
        {
          key: "view-loi",
          label: "LOI / Term Sheets",
          icon: FileText,
          color: "text-purple-600",
        },
      ],
    },
  ];

  const activeSectionId =
    TAB_SECTION_BY_KEY[activeTab] || ("application" as TabSectionId);

  const activeSection =
    tabSections.find((section) => section.id === activeSectionId) ||
    tabSections[0];

  const handleSectionClick = (section: TabSection) => {
    const firstEnabled =
      section.items.find((item) => !item.disabled) || section.items[0];
    if (firstEnabled) {
      setActiveTab(firstEnabled.key);
    }
  };

  const currentFile = previewFiles[activeIndex];

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
      canMarkFunded={Boolean(submissionDetail?.canMarkFunded)}
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
      <LoanApplication
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
        onUpdateSuccess={(newSubmissionId) => {
          const idToLoad = newSubmissionId || submissionId;
          if (newSubmissionId && newSubmissionId !== submissionId) {
            navigate("/loan-preview", {
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
    if (!canRequestDocuments) {
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
              Select which documents are required.
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

        {selectedRequestDocs.length > 0 ? (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  Request Documents List
                </h3>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
                  {selectedRequestDocs.length} document
                  {selectedRequestDocs.length === 1 ? "" : "s"} selected to
                  request
                </p>
              </div>
              <button
                type="button"
                onClick={clearRequestedDocuments}
                disabled={selectingAllRequestDocs}
                className="text-xs font-medium text-emerald-700 hover:underline disabled:opacity-60 dark:text-emerald-300"
              >
                Clear all
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {[...selectedRequestDocs]
                .sort((a, b) => {
                  const aCustom = selectedRequestDocMeta[a]?.isCustom ? 1 : 0;
                  const bCustom = selectedRequestDocMeta[b]?.isCustom ? 1 : 0;
                  if (aCustom !== bCustom) return bCustom - aCustom;
                  return selectedRequestDocs.indexOf(a) - selectedRequestDocs.indexOf(b);
                })
                .map((id) => {
                const meta = selectedRequestDocMeta[id];
                const name = meta?.name || "Document";
                const isCustom = Boolean(meta?.isCustom);

                return (
                  <span
                    key={id}
                    className="inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm dark:border-emerald-500/20 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${getRequestDocColor(name)}`}
                    />
                    <span className="truncate">{name}</span>
                    {isCustom ? (
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-700">
                        Custom
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => removeRequestedDocument(id)}
                      className="rounded-full p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                      aria-label={`Remove ${name}`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mb-4">
          <div className="relative">
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

        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center">
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
                return (
                  <label
                    key={doc.documentTypeId}
                    className={`group relative flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-all duration-200 ${
                      isSelected
                        ? "scale-[1.01] border-emerald-500 bg-emerald-50 shadow-sm dark:bg-emerald-500/10"
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
                      </div>
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
      apiRole="broker"
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
      ${lenderFilter === type
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
                        className={`px-2 py-1 text-xs rounded-full capitalize ${lender.type === "eligible"
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
                        !lender.canSend
                      }
                      onClick={() =>
                        sendApplicationToLender(lender.lenderProductId)
                      }
                      className={`w-full py-2 rounded-lg text-white font-semibold transition-all duration-300

     ${sendingId === lender.lenderProductId
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
                    className={`h-10 w-10 rounded-xl text-sm font-semibold transition ${lenderPage === pageNum
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

  const renderDocuments = () => (
    <div className="h-[90vh] min-h-screen w-full">
      <div className="mb-2">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">
          Requested Documents
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Upload, filter, and send documents to lenders on this application.
        </p>
      </div>

      <DocumentControlsBar
        autoForwardEnabled={autoForwardEnabled}
        autoForwardSaving={autoForwardSaving}
        onToggleAutoForward={handleToggleAutoForward}
        showAutoForwardToClient
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
      />

      {!autoForwardEnabled && selectedRows.length > 0 && (
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

      {autoForwardEnabled && selectedClientSendableIds.length > 0 && (
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
        <div className="h-[85vh] my-4 flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800">
          {/* TABLE */}
          <div className="h-full overflow-y-auto">
            <table className="w-full text-sm">
              {/* HEADER */}
              <thead className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b dark:bg-slate-900/80">
                <tr className="text-xs uppercase text-slate-500">
                  <th className="px-5 py-4 text-left">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleSelectAll}
                      className="h-4 w-4 accent-emerald-600 cursor-pointer"
                    />
                  </th>
                  <th className="px-5 py-4 text-left">Document</th>
                  <th className="px-5 py-4 text-center">Source</th>
                  <th className="px-5 py-4 text-center">Status</th>
                  <th className="px-5 py-4 text-center">Files</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>

              {/* BODY */}
              <tbody className="divide-y dark:divide-slate-800">
                {displayDocuments.map((doc) => {
                  const isOpen = activeAction === doc.rowKey;
                  const { label: sourceLabel, className: sourceClass } =
                    getDocumentSourceDisplay(doc, { brokerSourceLabel: "Me" });
                  const statusBadgeDate = getDocumentStatusBadgeDate(doc);
                  const statusLines = getDocumentStatusLines(doc);

                  return (
                    <tr
                      key={doc.rowKey}
                      className="group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all hover:shadow-sm"
                    >
                      <td className="px-5 py-4">
                        <input
                          type="checkbox"
                          disabled={doc.status === "SKIPPED"}
                          checked={selectedRows.includes(doc.rowKey)}
                          onChange={() => handleSelectRow(doc.rowKey)}
                          className="h-4 w-4 accent-emerald-600 cursor-pointer disabled:opacity-40"
                        />
                      </td>
                      {/* NAME */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 dark:text-white">
                            {doc.documentName}
                          </span>
                          {doc.isRequired && (
                            <span className="text-[10px] text-rose-500 font-semibold">
                              Required
                            </span>
                          )}
                        </div>
                      </td>

                      {/* SOURCE */}
                      <td className="px-5 py-4 text-center">
                        <span
                          className={`px-3 py-1 text-xs rounded-full font-medium ${sourceClass}`}
                        >
                          {sourceLabel}
                        </span>
                      </td>

                      {/* STATUS */}
                      <td className="px-5 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`max-w-[240px] px-3 py-1 rounded-full text-xs font-semibold ${getDocumentStatusChip(
                              doc.status ?? ""
                            )}`}
                          >
                            {formatDocumentStatusLine(
                              formatDocumentStatusLabel(doc.status),
                              statusBadgeDate,
                            )}
                          </span>
                          {statusLines.map((line, index) => (
                            <span
                              key={`${doc.rowKey}-status-${index}`}
                              className={`max-w-[240px] text-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${getDocumentStatusLineClass(
                                line.tone,
                              )}`}
                            >
                              {formatDocumentStatusLine(line.text, line.date)}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* FILES */}
                      <td className="px-5 py-4 text-center">
                        {Number(doc.uploadedCount) > 0 ? (
                          <div className="flex justify-center items-center gap-2">
                            <span className="px-3 py-1 text-xs rounded-full bg-emerald-100 text-emerald-700 font-semibold">
                              {Number(doc.uploadedCount)} Files
                            </span>

                            <button
                              onClick={() => {
                                setPreviewFiles(((doc.uploadedFiles as any[]) || []));
                                setActiveIndex(0);
                              }}
                              className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all"
                            >
                              <Eye size={16} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">
                            No files
                          </span>
                        )}
                      </td>

                      {/* ACTION */}
                      <td className="px-5 py-4 text-right relative">
                      <div
  ref={(el) => {
    actionRefs.current[doc.rowKey] = el;
  }}
>
                        <button
                          onClick={() =>
                            setActiveAction(isOpen ? null : doc.rowKey)
                          }
                          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                        >
                          <MoreVertical size={16} />
                        </button>

                        {isOpen && (
                          <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95">
                            <label className="flex items-center gap-2 px-4 py-3 text-sm text-amber-600 hover:bg-amber-50 cursor-pointer transition">
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
                                    const token =
                                      sessionStorage.getItem("broker_token");

                                    for (const file of Array.from(files)) {
                                      const formData = new FormData();
                                      formData.append("file", file);

                                      const res = await fetch(
                                        `${API_BASE}/broker/loan-pipeline/submissions/${documentsData.submissionId}/documents/${doc.requirementId}/upload`,
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
                                    await fetchSubmissionDocuments(
                                      documentsData.submissionId,
                                    );
                                  } catch (err: any) {
                                    toast.error(err.message);
                                  } finally {
                                    setActiveAction(null);
                                  }
                                }}
                              />
                            </label>
                            {(doc.source === "LENDER_ADDED" ||
                              doc.source === "BROKER_ADDED") &&
                              doc.status !== "SKIPPED" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleForwardToClient([
                                      String(doc.requirementId),
                                    ])
                                  }
                                  disabled={forwardingToClient}
                                  className="flex w-full items-center gap-2 px-4 py-3 text-sm text-indigo-600 hover:bg-indigo-50 transition disabled:opacity-60"
                                >
                                  <Mail size={14} />
                                  Send to Client
                                </button>
                              )}
                            {doc.source === "SUB_BROKER_ADDED" &&
                              doc.status !== "SKIPPED" && (
                                <button
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
                                      const token =
                                        sessionStorage.getItem("broker_token");

                                      const res = await fetch(
                                        `${API_BASE}/broker/loan-pipeline/sub-broker-submissions/${doc.subBrokerSubmissionId}/skip`,
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
                                          json.message ||
                                          "Failed to skip document",
                                        );
                                      }

                                      toast.success(
                                        "Document skipped successfully",
                                      );

                                      setSelectedRows((prev) =>
                                        prev.filter(
                                          (id) => id !== doc.requirementId,
                                        ),
                                      );

                                      await fetchSubmissionDocuments(
                                        documentsData.submissionId,
                                        page,
                                        debouncedSearch,
                                      );
                                    } catch (err: any) {
                                      toast.error(
                                        err.message ||
                                        "Failed to skip document",
                                      );
                                    } finally {
                                      setActiveAction(null);
                                    }
                                  }}
                                  className="flex w-full items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition"
                                >
                                  <Send size={14} />
                                  Skip Document
                                </button>
                              )}
                          </div>
                        )}
                        </div>
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
                        className={`h-9 min-w-9 rounded-xl px-2.5 text-sm font-semibold transition ${page === pageNum
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
        return (
          <DocumentReminderPanel loanApplicationId={applicationId} />
        );
      case "view-loi":
        return renderViewLoi();
      case "documents":
        return (
          <div key={`documents-${documentsRefreshKey}-${submissionId || "none"}`}>
            {renderDocuments()}
          </div>
        );
      case "sign-documents":
        return (
          <SignDocumentsPanel
            mode="broker"
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
          <LoanPreviewChat
            applicationId={applicationId}
            initialConversationId={
              (Location.state as { conversationId?: string })?.conversationId
            }
          />
        );
      case "fee-agreement":
        return (
          <FeeAgreement
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
            canMarkPaid={isBrokerAdmin}
          />
        );
      default:
        return renderViewDetails();
    }
  };

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
      <div className="min-h-screen w-full max-w-none bg-slate-50 dark:bg-[#0b1120] dark:text-slate-100">
        <div className="w-full">
          <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            {/* LEFT SIDE */}
            <div>
              {/* BACK BUTTON */}
              <button
                onClick={() => navigate(-1)}
                className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition"
              >
                <ArrowLeft size={16} />
                Back to Submitted Applications
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
              <div className="mt-4 flex flex-wrap items-center gap-4">
                {/* BORROWER */}
                <div
                  className="flex items-center gap-3 px-4 py-2 rounded-2xl 
    bg-gradient-to-r from-blue-50 to-cyan-50 
    dark:from-[#1E293B] dark:to-[#0F172A]
    shadow-sm hover:shadow-md transition-all"
                >
                  <div
                    className="h-9 w-9 flex items-center justify-center rounded-full 
      bg-gradient-to-br from-blue-500 to-cyan-500 text-white"
                  >
                    <FiUser size={16} />
                  </div>

                  <div className="flex flex-col leading-tight">
                    <span className="text-[11px] font-medium text-blue-500 dark:text-blue-400">
                      Borrower Name
                    </span>
                    <span className="text-sm font-semibold text-blue-900 dark:text-white">
                      {borrowerName}
                    </span>
                  </div>
                </div>

                {/* PRODUCT */}
                <div
                  className="flex items-center gap-3 px-4 py-2 rounded-2xl 
    bg-gradient-to-r from-purple-50 to-indigo-50 
    dark:from-[#1E1B4B] dark:to-[#0F172A]
    shadow-sm hover:shadow-md transition-all"
                >
                  <div
                    className="h-9 w-9 flex items-center justify-center rounded-full 
      bg-gradient-to-br from-purple-500 to-indigo-500 text-white"
                  >
                    <FiTag size={16} />
                  </div>

                  <div className="flex flex-col leading-tight">
                    <span className="text-[11px] font-medium text-indigo-500 dark:text-indigo-400">
                      Product Name
                    </span>
                    <span className="text-sm font-semibold text-indigo-900 dark:text-white">
                      {productCode}
                    </span>
                  </div>
                </div>

                {/* AMOUNT */}
                <div
                  className="flex items-center gap-3 px-4 py-2 rounded-2xl 
    bg-gradient-to-r from-emerald-50 to-green-50 
    dark:from-[#022c22] dark:to-[#052e2b]
    shadow-sm hover:shadow-md transition-all"
                >
                  <div
                    className="h-9 w-9 flex items-center justify-center rounded-full 
      bg-gradient-to-br from-emerald-500 to-green-500 text-white"
                  >
                    $
                  </div>

                  <div className="flex flex-col leading-tight">
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      Loan Amount Requested
                    </span>
                    <span className="text-sm font-semibold text-emerald-900 dark:text-white">
                      ${submissionDetail?.amountRequested || 0}
                    </span>
                  </div>
                </div>

                {/* CREDIT SCORE */}
                <div
                  className="flex items-center gap-3 px-4 py-2 rounded-2xl 
    bg-gradient-to-r from-amber-50 to-yellow-50 
    dark:from-[#451a03] dark:to-[#422006]
    shadow-sm hover:shadow-md transition-all"
                >
                  <div
                    className="h-9 w-9 flex items-center justify-center rounded-full 
      bg-gradient-to-br from-amber-500 to-yellow-500 text-white font-bold text-sm"
                  >
                    <FaRegCreditCard />
                  </div>

                  <div className="flex flex-col leading-tight">
                    <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      Credit Score
                    </span>
                    <span className="text-sm font-semibold text-amber-900 dark:text-white">
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
                  submissionDetail?.status,
                )}`}
              >
                {formatSubmissionStatus(submissionDetail?.status)}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center text-slate-500">Loading...</div>
          ) : (
            <>
              <div className="mb-6 overflow-hidden rounded-[30px] border border-white/30 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.24),_transparent_28%),linear-gradient(135deg,_#1d4ed8_0%,_#0f766e_55%,_#0891b2_100%)] p-6 text-white">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
                  <Metric
                    label="Monthly Payment"
                    value={monthlyPaymentDisplay}
                  />
                  <Metric label="LTV" value={ltv ? `${ltv}%` : "-"} />
                  <Metric label="LTC" value={ltc ? `${ltc}%` : "-"} />
                  <Metric label="ARV %" value={arv ? `${arv}%` : "-"} />
                  <Metric label="DSCR Ratio" value={dscr ? `${dscr}` : "-"} />
                  <Metric
                    label="Net Worth"
                    value={netWorth ? `$${netWorth}` : "-"}
                  />
                </div>
              </div>

              <nav
                aria-label="Loan application sections"
                className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
              >
                {/* Primary sections */}
                <div className="grid grid-cols-2 gap-1.5 bg-slate-50/80 p-2 sm:grid-cols-4 dark:bg-slate-950/50">
                  {tabSections.map((section) => {
                    const SectionIcon = section.icon;
                    const isSectionActive = section.id === activeSectionId;

                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => handleSectionClick(section)}
                        aria-current={isSectionActive ? "page" : undefined}
                        className={`group relative flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                          isSectionActive
                            ? "bg-[#13538A] text-white shadow-md shadow-[#13538A]/20"
                            : "text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                        }`}
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
                            isSectionActive
                              ? "bg-white/20 text-white"
                              : "bg-white text-slate-400 shadow-sm group-hover:text-blue-600 dark:bg-slate-900"
                          }`}
                        >
                          <SectionIcon size={16} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">
                            {section.label}
                          </span>
                          <span
                            className={`block text-[10px] font-medium ${
                              isSectionActive
                                ? "text-white/75"
                                : "text-slate-400"
                            }`}
                          >
                            {section.items.length}{" "}
                            {section.items.length === 1 ? "tool" : "tools"}
                          </span>
                        </span>
                        {isSectionActive && (
                          <span className="absolute inset-x-5 bottom-0 h-0.5 rounded-full bg-white/80" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Secondary items within active section */}
                <div className="border-t border-slate-200 px-3 py-2.5 dark:border-slate-700">
                  <div className="flex items-center gap-3 overflow-x-auto">
                    <span className="hidden shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:block">
                      {activeSection.label}
                    </span>
                    <span className="hidden h-5 w-px shrink-0 bg-slate-200 sm:block dark:bg-slate-700" />

                    {activeSection.items.map((tab) => {
                      const Icon = tab.icon;
                      const isActive = activeTab === tab.key;
                      const isDisabled = Boolean(tab.disabled);

                      return (
                        <button
                          key={tab.key}
                          type="button"
                          disabled={isDisabled}
                          title={isDisabled ? tab.disabledReason : undefined}
                          aria-current={isActive ? "page" : undefined}
                          onClick={() => {
                            if (isDisabled) return;
                            setActiveTab(tab.key);
                          }}
                          className={`group inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                            isActive
                              ? "bg-[#13538A] text-white shadow-sm dark:bg-[#13538A] dark:text-white"
                              : isDisabled
                                ? "cursor-not-allowed text-slate-400 opacity-50"
                                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                          }`}
                        >
                          <Icon
                            size={14}
                            className={
                              isActive
                                ? "text-white"
                                : tab.color
                            }
                          />
                          <span className="whitespace-nowrap">{tab.label}</span>
                          {tab.key === "view-loi" && loiCount > 0 && (
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
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
              </nav>

              {renderTabContent()}
            </>
          )}
        </div>
      </div>

      {previewFiles.length > 0 && (
        <div className="fixed inset-0 z-[99999999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-6xl h-[90vh] rounded-3xl overflow-hidden 
    bg-white dark:bg-slate-900 shadow-2xl flex flex-col"
          >
            {/* HEADER */}
            <div
              className="flex justify-between items-center px-6 py-4 
  bg-gradient-to-r from-blue-600 to-teal-600 text-white"
            >
              {/* LEFT */}
              <div>
                <h2 className="text-sm font-semibold truncate max-w-md">
                  {currentFile.fileName}
                </h2>
                <p className="text-xs text-white/70">
                  {activeIndex + 1} / {previewFiles.length}
                  {currentFile && (
                    <>
                      {" "}
                      ·{" "}
                      {getUploadFileSentLabel(currentFile).label}
                    </>
                  )}
                </p>
              </div>

              {/* RIGHT ACTIONS */}
              <div className="flex items-center gap-2">
                {/* DOWNLOAD */}
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(
                        `${API_BASE}${currentFile.fileUrl}`,
                      );
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
            <div className="flex-1 flex items-center justify-center bg-slate-100 relative">
              {/* LEFT */}
              {activeIndex > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveIndex((p) => p - 1)}
                  className="absolute left-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md transition hover:bg-slate-50"
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
                  className="absolute right-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md transition hover:bg-slate-50"
                  aria-label="Next file"
                >
                  <ChevronRight size={20} />
                </button>
              )}

              {/* FILE VIEW */}
              {currentFile.fileMimeType?.includes("image") ? (
                <img
                  src={`${API_BASE}${currentFile.fileUrl}`}
                  className="max-h-full max-w-full object-contain rounded-xl shadow"
                />
              ) : currentFile.fileMimeType?.includes("pdf") ? (
                <object
                  data={`${API_BASE}${currentFile.fileUrl}`}
                  type="application/pdf"
                  className="w-full h-full rounded-xl bg-white"
                >
                  {/* FALLBACK */}
                  <div className="flex flex-col items-center justify-center h-full text-center px-6">
                    {/* ICON CONTAINER */}
                    <div
                      className="flex items-center justify-center w-20 h-20 rounded-2xl 
    bg-gradient-to-br from-blue-100 to-cyan-100 
    dark:from-slate-800 dark:to-slate-700 shadow-md mb-4"
                    >
                      <FileText
                        size={36}
                        className="text-blue-600 dark:text-cyan-400"
                      />
                    </div>

                    {/* TITLE */}
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                      Preview not available
                    </h3>

                    {/* DESCRIPTION */}
                    <p className="text-sm text-slate-500 mt-1 max-w-xs">
                      This PDF cannot be previewed here. Click below to open it
                      in a new tab.
                    </p>

                    {/* BUTTON */}
                    <button
                      onClick={() =>
                        window.open(
                          `${API_BASE}${currentFile.fileUrl}`,
                          "_blank",
                        )
                      }
                      className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium
                      bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl 
                      shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95
                      transition-all duration-200"
                    >
                      Open PDF
                    </button>
                  </div>
                </object>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <FileText size={40} className="mb-2 opacity-50" />
                  <p>Preview not supported</p>
                </div>
              )}
            </div>

            {/* THUMBNAILS */}
            <div className="flex gap-2 p-3 overflow-x-auto bg-slate-50">
              {previewFiles.map((file, i) => {
                const fileSent = getUploadFileSentLabel(file);

                return (
                  <div
                    key={file.uploadId || i}
                    onClick={() => setActiveIndex(i)}
                    className={`relative h-14 w-20 flex items-center justify-center rounded-lg cursor-pointer border-2 overflow-hidden ${i === activeIndex ? "border-blue-500" : "border-transparent"
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
                      className={`absolute bottom-0 left-0 right-0 px-0.5 py-0.5 text-[8px] font-bold text-center truncate ${fileSent.isSent
                          ? "bg-emerald-600 text-white"
                          : "bg-amber-500 text-white"
                        }`}
                    >
                      {fileSent.isSent ? "Sent" : "Pending"}
                    </span>
                  </div>
                )
              })}
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};

export default LoanPreview;
