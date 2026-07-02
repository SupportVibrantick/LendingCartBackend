import {
  ArrowLeft,
  DollarSign,
  Download,
  Eye,
  FileText,
  FolderOpen,
  // Loader2,
  MoreVertical,
  // Pencil,
  Search,
  Send,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useLocation, useNavigate } from "react-router";
import { motion } from "framer-motion";
// import Select, { components } from "react-select";

import { FiFolder, FiSend, FiTag, FiUser } from "react-icons/fi";
// import Swal from "sweetalert2";
import { FaRegCreditCard } from "react-icons/fa6";
import LoanPreviewChat from "./LoanPreviewChat";
import FeeAgreement from "./FeeAgreement";
import LoanCommissionPanel from "../../../components/commissions/LoanCommissionPanel";
import SubmissionDetailsView from "../../../components/submissions/SubmissionDetailsView";
import DocumentControlsBar from "../../../components/documents/DocumentControlsBar";
import {
  formatDocumentStatusLabel,
  getDocumentStatusChipClass,
} from "../../../lib/documentStatus";
import { getBorrowerDisplayNameFromFields } from "../../../lib/submissionFieldUtils";
import {
  CO_BROKER_TOKEN_KEY,
  CO_BROKER_USER_KEY,
} from "../../../lib/coBrokerPortal";
import {
  expandDocumentsForDisplay,
  getDocumentSentDisplay,
  getDocumentSourceDisplay,
  type DocumentSentFilter,
  type DocumentSourceFilter,
} from "../../../lib/documentLenderSend";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

type SubmissionField = {
  fieldId: string | null;
  fieldKey: string | null;
  value: string;
};

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
  type: "eligible" | "rejected" | "sent";
  alreadySent: boolean;
  canSend: boolean;
  rejectionReasons: string[];
};

// type GroupedFields = {
//   primaryBorrower: SubmissionField[];
//   coBorrowers: Record<string, SubmissionField[]>;
//   entity: SubmissionField[];
//   property: SubmissionField[];
//   loan: SubmissionField[];
//   financial: SubmissionField[];
//   others: SubmissionField[];
// };

// type UploadedPreview = {
//   url: string;
//   type: string;
//   name: string;
// };

type TabKey =
  | "view-details"
  | "update-application"
  | "find-lenders"
  | "request-document"
  | "view-loi"
  | "documents"
  // | "submitted-lenders"
  | "chat"
  | "fee-agreement"
  | "commissions";

const parseValue = (val: string): any => {
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

    case "AUTO_APPROVED":
    case "LENDER_APPROVED":
      return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200";

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

const getFieldValue = (fields: SubmissionField[], key: string) => {
  const field = fields.find((f) => f.fieldKey === key || f.fieldId === key);
  return field ? parseValue(field.value) : undefined;
};

function getAuthHeaders(): HeadersInit {
  const token = sessionStorage.getItem(CO_BROKER_TOKEN_KEY);
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

const getDocumentStatusChip = getDocumentStatusChipClass;

// const formatFieldKey = (key: string | null | undefined) => {
//   if (!key) return "";

//   return key
//     .replace(/^coBorrower_\d+_/, "coBorrower_")
//     .replace(/([a-z])([A-Z])/g, "$1 $2")
//     .replace(/_/g, " ")
//     .replace(/\s+/g, " ")
//     .trim()
//     .replace(/\b\w/g, (char) => char.toUpperCase());
// };

// const stringifyFieldValue = (value: unknown) => {
//   if (value === undefined || value === null) return "";
//   if (typeof value === "string") return value;
//   if (typeof value === "boolean") return value ? "true" : "false";

//   try {
//     return JSON.stringify(value);
//   } catch {
//     return String(value);
//   }
// };

// const buildEditableFieldValues = (submissionFields: SubmissionField[]) => {
//   return submissionFields.reduce(
//     (acc: Record<string, string>, field: SubmissionField) => {
//       if (!field.fieldKey || field.fieldKey === "borrowerSignature") {
//         return acc;
//       }

//       acc[field.fieldKey] = stringifyFieldValue(parseValue(field.value));
//       return acc;
//     },
//     {},
//   );
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

const LoanPreview = () => {
  const Location = useLocation();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabKey>("view-details");
  const [submissionDetail, setSubmissionDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [requestDocs, setRequestDocs] = useState<any[]>([]);
  const [requestDocsLoading, setRequestDocsLoading] = useState(false);
  const [requestDocsLoadedFor, setRequestDocsLoadedFor] = useState<
    string | null
  >(null);
  const [selectedRequestDocs, setSelectedRequestDocs] = useState<string[]>([]);
  const [requestMessage, setRequestMessage] = useState("");
  const [requestSubmitting, setRequestSubmitting] = useState(false);

  // const [submittedLenders, setSubmittedLenders] = useState<any[]>([]);

  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsData, setDocumentsData] = useState<any>(null);
  const [documentsLoadedFor, setDocumentsLoadedFor] = useState<string | null>(
    null,
  );
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

  const [lois, setLois] = useState<any[]>([]);
  const [loiLoading, setLoiLoading] = useState(false);
  const [loiLoadedFor, setLoiLoadedFor] = useState<string | null>(null);
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [borrowerSummary, setBorrowerSummary] = useState<any>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  // const [sentLenders, setSentLenders] = useState<Record<string, boolean>>({});
  const [lenderLoading, setLenderLoading] = useState(false);
  const [lenderSearchQ, setLenderSearchQ] = useState("");
  const [lenderPage, setLenderPage] = useState(1);
  const [lenderLimit, setLenderLimit] = useState(6);
  // const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [lendersLoadedFor, setLendersLoadedFor] = useState<string | null>(null);
  // const [previewFile, setPreviewFile] = useState<UploadedPreview | null>(null);
  // const [editableFieldValues, setEditableFieldValues] = useState<
  //   Record<string, string>
  // >({});

  const [lenderFilter, setLenderFilter] = useState<
    "all" | "eligible" | "rejected" | "sent"
  >("all");

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [pagination, setPagination] = useState<any>(null);
  // const [search, setSearch] = useState("");
  // const [selectedRows, setSelectedRows] = useState<string[]>([]);
  // const [currentPage, setCurrentPage] = useState(1);

  // const [search, setSearch] = useState("");
  // const [debouncedLenderSearch, setDebouncedLenderSearch] = useState("");
  // const itemsPerPage = 9;

  // const isAllSelected =
  //   documentsData?.documents?.length > 0 &&
  //   selectedRows.length === documentsData.documents.length;

  // const handleSelectAll = () => {
  //   if (isAllSelected) {
  //     setSelectedRows([]);
  //   } else {
  //     setSelectedRows(documentsData.documents.map((d: any) => d.requirementId));
  //   }
  // };

  // const handleSelectRow = (id: string) => {
  //   setSelectedRows((prev) =>
  //     prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
  //   );
  // };

  const fields = submissionDetail?.fields || [];
  const applicationId = submissionDetail?.applicationId;
  const canRequestDocuments = submissionDetail?.canRequestDocuments !== false;
  const documentRequestBlockedReason =
    submissionDetail?.documentRequestBlockedReason ?? null;

  const borrowerDisplayName = useMemo(() => {
    const resolved = submissionDetail?.borrowerName?.trim();
    if (
      resolved &&
      resolved !== "Applicant" &&
      resolved !== "Individual Applicant"
    ) {
      return resolved;
    }
    return getBorrowerDisplayNameFromFields(fields) || resolved || "—";
  }, [submissionDetail?.borrowerName, fields]);

  const coBrokerDisplayName = useMemo(() => {
    const storedUser = JSON.parse(
      sessionStorage.getItem(CO_BROKER_USER_KEY) || "{}",
    );
    const name =
      storedUser?.name ||
      `${storedUser?.firstName || ""} ${storedUser?.lastName || ""}`.trim();
    return name || "Me";
  }, []);

  const documentFilterLenders = documentsData?.documentFilterLenders || [];

  const displayDocuments = useMemo(() => {
    return expandDocumentsForDisplay(documentsData?.documents || [], {
      applicationLenderId:
        documentLenderFilter ||
        documentsData?.activeFilters?.applicationLenderId ||
        undefined,
    });
  }, [
    documentsData?.documents,
    documentsData?.activeFilters?.applicationLenderId,
    documentLenderFilter,
  ]);

  const brokerSourceLabel =
    documentsData?.brokerOrgName || "Principal Broker";

  const submissionId = Location.state?.submissionId;

  // const formatPhoneNumber = (value: string) => {
  //   const digits = value.replace(/\D/g, "").slice(0, 10);

  //   if (digits.length <= 3) return digits;
  //   if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;

  //   return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  // };

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
      // setEditableFieldValues(buildEditableFieldValues(json.data?.fields || []));
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch submission details");
    } finally {
      setLoading(false);
    }
  };

  const fetchDocumentTypes = async (id: string) => {
    try {
      setRequestDocsLoading(true);
      const res = await fetch(`${API_BASE}/document-types/active`, {
        method: "GET",
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to fetch document types");
      }
      const formattedDocs = json.data.map((doc: any) => ({
        documentTypeId: doc.id,
        documentType: { name: doc.name },
      }));
      setRequestDocs(formattedDocs);
      setRequestDocsLoadedFor(id);
    } catch (err: any) {
      toast.error(err.message || "Failed to load documents");
    } finally {
      setRequestDocsLoading(false);
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
      const token = sessionStorage.getItem(CO_BROKER_TOKEN_KEY);

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
        `${API_BASE}/subbroker/documents/submissions/${submissionId}/documents?${params.toString()}`,
        {
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to fetch documents");
      }

      setDocumentsData(json.data);
      setPagination(json.data.pagination);
      setPage(json.data.pagination.page);
      setDocumentsLoadedFor(submissionId);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load documents");
    } finally {
      setDocumentsLoading(false);
    }
  };

  const fetchLois = async () => {
    try {
      setLoiLoading(true);

      const token = sessionStorage.getItem(CO_BROKER_TOKEN_KEY);

      const applicationId =
        submissionDetail?.applicationId || submissionDetail?.id;

      if (!applicationId) {
        throw new Error("Application ID not found");
      }

      const res = await fetch(
        `${API_BASE}/subbroker/view-loi/${applicationId}/lois`,
        {
          method: "GET",

          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const json = await res.json();

      if (!res.ok || json.success === false) {
        throw new Error(json.message || "Failed to fetch LOIs");
      }

      setLois(json.data?.lois || []);

      setLoiLoadedFor(applicationId);
    } catch (err: any) {
      console.error(err);

      toast.error(err.message || "Failed to load LOIs");

      setLois([]);
    } finally {
      setLoiLoading(false);
    }
  };

  const handleRequestDocuments = async () => {
    if (!applicationId) return;
    if (selectedRequestDocs.length === 0) {
      toast.error("Please select at least one document");
      return;
    }

    try {
      setRequestSubmitting(true);
      const res = await fetch(
        `${API_BASE}/subbroker/documents/${applicationId}/request-documents`,
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
      if (submissionId) {
        setPage(1);
        setDocumentsLoadedFor(null);
        setActiveTab("documents");
        fetchSubmissionDocuments(submissionId, 1, debouncedSearch);
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setRequestSubmitting(false);
    }
  };

  const fetchLenders = async (id: string) => {
    setLenderPage(1);
    setLenders([]);
    setBorrowerSummary(null);
    // setSentLenders({});
    // setImageErrors({});
    setLenderLoading(true);

    try {
      const res = await fetch(
        `${API_BASE}/broker/lender-discovery/applications/submissions/${id}/eligible`,
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

      // Merge all lenders into one array
      const allLenders = [
        ...(data.eligibleLenders || []).map((l: any) => ({
          id: l.lenderOrgId,
          name: l.lenderName,
          email: l.lenderEmail,
          phone: l.lenderPhone,
          profileImage: l.profileImage
            ? `${API_BASE}/public/${l.profileImage}`
            : null,
          loanProductCode: l.loanProductCode,
          minFunding: l.fundingRange?.min ?? 0,
          maxFunding: l.fundingRange?.max ?? 0,
          minMonths: l.terms?.minMonths ?? 0,
          maxMonths: l.terms?.maxMonths ?? 0,
          interestRateRange: l.interestRateRange,
          fundingSpeedDays: l.lenderProfile?.fundingSpeedDays ?? 0,
          summary: l.lenderProfile?.summary,

          // IMPORTANT FLAGS
          type: "eligible",
          alreadySent: l.alreadySent,
          canSend: l.canSend,
          rejectionReasons: [],
        })),

        ...(data.rejectedLenders || []).map((l: any) => ({
          id: l.lenderOrgId,
          name: l.lenderName,
          email: l.lenderEmail,
          phone: l.lenderPhone,
          profileImage: l.profileImage
            ? `${API_BASE}/public/${l.profileImage}`
            : null,
          loanProductCode: l.loanProductCode,
          minFunding: l.fundingRange?.min ?? 0,
          maxFunding: l.fundingRange?.max ?? 0,
          minMonths: l.terms?.minMonths ?? 0,
          maxMonths: l.terms?.maxMonths ?? 0,
          interestRateRange: l.interestRateRange,
          fundingSpeedDays: l.lenderProfile?.fundingSpeedDays ?? 0,
          summary: l.lenderProfile?.summary,

          type: "rejected",
          alreadySent: l.alreadySent,
          canSend: false,
          rejectionReasons: l.rejectionReasons || [],
        })),

        ...(data.alreadySentLenders || []).map((l: any) => ({
          id: l.lenderOrgId,
          name: l.lenderName,
          email: l.lenderEmail,
          phone: l.lenderPhone,
          profileImage: l.profileImage
            ? `${API_BASE}/public/${l.profileImage}`
            : null,
          loanProductCode: l.loanProductCode,
          minFunding: l.fundingRange?.min ?? 0,
          maxFunding: l.fundingRange?.max ?? 0,
          minMonths: l.terms?.minMonths ?? 0,
          maxMonths: l.terms?.maxMonths ?? 0,
          interestRateRange: l.interestRateRange,
          fundingSpeedDays: l.lenderProfile?.fundingSpeedDays ?? 0,
          summary: l.lenderProfile?.summary,

          type: "sent",
          alreadySent: true,
          canSend: false,
          rejectionReasons: [],
        })),
      ];

      setLenders(allLenders);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load eligible lenders");
    } finally {
      setLenderLoading(false);
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

  //     const token = sessionStorage.getItem(CO_BROKER_TOKEN_KEY);

  //     for (const file of filesForRequirement) {
  //       const formData = new FormData();
  //       formData.append("file", file);

  //       const res = await fetch(
  //         `${API_BASE}/subbroker/documents/submissions/${currentSubmissionId}/documents/${requirementId}/upload`,
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
    setSubmissionDetail(null);
    setRequestDocs([]);
    setRequestDocsLoadedFor(null);
    setDocumentsData(null);
    setDocumentsLoadedFor(null);
    setLois([]);
    setLoiLoadedFor(null);
    setLenders([]);
    setBorrowerSummary(null);
    // setSentLenders({});
    // setImageErrors({});
    setLendersLoadedFor(null);
    setLenderSearchQ("");
    setLenderPage(1);
    // setSelectedFiles({});
    setPreviewFiles([]);
    setSelectedRequestDocs([]);
    setRequestMessage("");
    // setEditableFieldValues({});
    setActiveTab("view-details");

    if (submissionId) {
      fetchSubmissionDetails(submissionId);
    }
  }, [submissionId]);

  useEffect(() => {
    if (!canRequestDocuments && activeTab === "request-document") {
      setActiveTab("view-details");
    }
  }, [canRequestDocuments, activeTab]);

  useEffect(() => {
    if (
      activeTab === "find-lenders" &&
      submissionId &&
      lendersLoadedFor !== submissionId
    ) {
      fetchLenders(submissionId);
    }
    if (
      activeTab === "request-document" &&
      applicationId &&
      requestDocsLoadedFor !== applicationId
    ) {
      fetchDocumentTypes(applicationId);
    }
    if (
      activeTab === "documents" &&
      submissionId &&
      documentsLoadedFor !== submissionId
    ) {
      fetchSubmissionDocuments(submissionId, 1, debouncedSearch);
    }
    if (
      activeTab === "view-loi" &&
      submissionId &&
      loiLoadedFor !== submissionId
    ) {
      fetchLois();
    }
  }, [
    activeTab,
    applicationId,
    submissionId,
    lendersLoadedFor,
    requestDocsLoadedFor,
    documentsLoadedFor,
    loiLoadedFor,
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
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [searchInput]);

  // const groupedFields = useMemo(() => {
  //   const signatureField = fields.find(
  //     (f: any) => f.fieldKey === "borrowerSignature",
  //   );

  //   const groups: GroupedFields = {
  //     primaryBorrower: [],
  //     coBorrowers: {},
  //     entity: [],
  //     property: [],
  //     loan: [],
  //     financial: [],
  //     others: [],
  //   };

  //   fields.forEach((field: SubmissionField) => {
  //     const key = field.fieldKey || "";
  //     if (!key || key === "borrowerSignature") return;

  //     // CoBorrower
  //     if (key.startsWith("coBorrower_")) {
  //       const match = key.match(/^coBorrower_(\d+)_/);
  //       if (match) {
  //         const index = match[1];
  //         if (!groups.coBorrowers[index]) {
  //           groups.coBorrowers[index] = [];
  //         }
  //         groups.coBorrowers[index].push(field);
  //       }
  //       return;
  //     }

  //     // Property FIRST (important to avoid overlap)
  //     if (/property/i.test(key)) {
  //       groups.property.push(field);
  //       return;
  //     }

  //     // Entity
  //     if (/entity|dba|legalName|entityType|business/i.test(key)) {
  //       groups.entity.push(field);
  //       return;
  //     }

  //     // Financial
  //     if (/noi|revenue|income|rent|tax|insurance|hoa/i.test(key)) {
  //       groups.financial.push(field);
  //       return;
  //     }

  //     // Loan
  //     if (/loan|amount|ltv|ltc|dscr|interest|term/i.test(key)) {
  //       groups.loan.push(field);
  //       return;
  //     }

  //     // Primary Borrower (strict)
  //     if (
  //       key.startsWith("borrower") ||
  //       /firstName|lastName|email|phone|dob|ssn|employer/i.test(key)
  //     ) {
  //       groups.primaryBorrower.push(field);
  //       return;
  //     }

  //     // Address fallback (smart split)
  //     if (/address|city|state|zip/i.test(key)) {
  //       if (key.toLowerCase().includes("property")) {
  //         groups.property.push(field);
  //       } else {
  //         groups.primaryBorrower.push(field);
  //       }
  //       return;
  //     }

  //     // Others
  //     groups.others.push(field);
  //   });
  //   return { ...groups, signatureField };
  // }, [fields]);

  const loanAmount = Number(getFieldValue(fields, "amountRequested") ?? 0) || 0;
  const ltv = Number(getFieldValue(fields, "ltvPercentage") ?? 0) || 0;
  const ltc = Number(getFieldValue(fields, "ltcPercentage") ?? 0) || 0;
  const arv = Number(getFieldValue(fields, "arvPercentage") ?? 0) || 0;
  const dscr = Number(getFieldValue(fields, "dscr") ?? 0) || 0;
  const netWorth = Number(getFieldValue(fields, "netWorth") ?? 0) || 0;

  const submittedDate = submissionDetail?.submittedAt
    ? new Date(submissionDetail.submittedAt)
    : null;
  const isFundedDeal = submissionDetail?.status === "FUNDED";

  const tabs = [
    {
      key: "view-details" as const,
      label: "View Details",
      icon: Eye,
      color: "text-blue-600",
    },
    ...(canRequestDocuments
      ? [
          {
            key: "request-document" as const,
            label: "Request Document",
            icon: Send,
            color: "text-emerald-600",
          },
        ]
      : []),
    {
      key: "view-loi" as const,
      label: "View LOI",
      icon: FileText,
      color: "text-purple-600",
    },
    {
      key: "documents" as const,
      label: "Documents",
      icon: FolderOpen,
      color: "text-amber-600",
    },
    // {
    //   key: "submitted-lenders" as const,
    //   label: "Submitted To Lenders",
    //   icon: Send,
    //   color: "text-blue-600",
    // },
    {
      key: "chat" as const,
      label: "Chat",
      icon: Send,
      color: "text-green-600",
    },
    {
      key: "fee-agreement" as const,
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
  ];

  // const handleEditableFieldChange = (fieldKey: string, nextValue: string) => {
  //   let value = nextValue;

  //   // Phone formatting
  //   if (/phone/i.test(fieldKey)) {
  //     value = formatPhoneNumber(nextValue);
  //   }

  //   setEditableFieldValues((prev) => {
  //     if (prev[fieldKey] === value) return prev;
  //     return { ...prev, [fieldKey]: value };
  //   });

  //   // error remove on typing
  //   setErrors((prev) => {
  //     const copy = { ...prev };
  //     delete copy[fieldKey];
  //     return copy;
  //   });
  // };

  // useEffect(() => {
  //   const timer = setTimeout(() => {
  //     setDebouncedLenderSearch(search);
  //   }, 400);

  //   return () => clearTimeout(timer);
  // }, [search]);

  // useEffect(() => {
  // setCurrentPage(1);
  // }, [debouncedLenderSearch]);

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
      submittedDate={submittedDate}
      showEditHint={false}
    />
  );

//   const renderUpdateApplication = () => (
//     <div className="space-y-6">
//       <div
//         className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm 
// dark:border-slate-800 dark:bg-slate-900"
//       >
//         <div className="mb-6 flex flex-col gap-3 text-sm font-medium md:flex-row md:flex-wrap md:items-center md:justify-between">
//           {/* Application No */}
//           <div>
//             <span className="font-semibold">Application No:</span>{" "}
//             <span className="text-slate-700 dark:text-slate-300">
//               {submissionDetail?.applicationNumber || "-"}
//             </span>
//           </div>

//           {/* Client Name */}
//           <div>
//             <span className="font-semibold">Borrower Name:</span>{" "}
//             <span className="text-slate-700 dark:text-slate-300">
//               {submissionDetail?.borrowerName || "-"}
//             </span>
//           </div>

//           {/* Product Code */}
//           <div>
//             <span className="font-semibold">Product Code:</span>{" "}
//             <span className="text-slate-700 dark:text-slate-300">
//               {submissionDetail &&
//                 submissionDetail?.loanProduct &&
//                 submissionDetail?.loanProduct?.name}
//             </span>
//           </div>

//           {/* Status */}
//           <div className="flex items-center gap-2">
//             <span className="font-semibold">Status:</span>
//             <span
//               className={`rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${getStatusChip(submissionDetail?.status)}`}
//             >
//               {submissionDetail?.status === "DECLINED"
//                 ? "REJECTED"
//                 : submissionDetail?.status || "-"}
//             </span>
//           </div>
//         </div>

//         <div
//           className="mb-6 rounded-[28px] border border-slate-200 
// bg-slate-50 p-6 shadow-sm 
// dark:border-slate-800 dark:bg-slate-900"
//         >
//           <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
//             <Metric
//               label="Loan Amount"
//               value={`$${loanAmount.toLocaleString()}`}
//               variant="panel"
//             />
//             <Metric
//               label="LTV %"
//               value={ltv ? `${ltv.toFixed(2)}%` : "-"}
//               variant="panel"
//             />
//             <Metric
//               label="LTC %"
//               value={ltc ? `${ltc.toFixed(2)}%` : "-"}
//               variant="panel"
//             />
//             <Metric
//               label="ARV %"
//               value={arv ? `${arv.toFixed(2)}%` : "-"}
//               variant="panel"
//             />
//             <Metric
//               label="DSCR"
//               value={dscr ? dscr.toFixed(2) : "-"}
//               variant="panel"
//             />
//             <Metric
//               label="Net Worth"
//               value={`$${netWorth.toLocaleString()}`}
//               variant="panel"
//             />
//           </div>
//         </div>

//         <div
//           className="space-y-10 rounded-xl border border-slate-200 p-6 
// bg-white dark:border-slate-800 dark:bg-slate-900"
//         >
//           {groupedFields.primaryBorrower.length > 0 && (
//             <div>
//               <h3
//                 className="mb-4 border-b border-slate-200 pb-2 text-md font-bold 
// text-slate-800 dark:border-slate-700 dark:text-slate-200"
//               >
//                 Primary Borrower
//               </h3>
//               <div className="grid gap-6 md:grid-cols-2">
//                 {groupedFields.primaryBorrower.map((field: any) => (
//                   <EditableFieldItem
//                     key={field.fieldKey}
//                     field={field}
//                     value={editableFieldValues[field.fieldKey || ""] ?? ""}
//                     onChange={handleEditableFieldChange}
//                     errors={errors}
//                   />
//                 ))}
//               </div>
//             </div>
//           )}

//           {Object.keys(groupedFields.coBorrowers).map((index) => (
//             <div key={index}>
//               <h3 className="mb-4 border-b pb-2 text-md font-bold">
//                 Co Borrower {index}
//               </h3>
//               <div className="grid gap-6 md:grid-cols-2">
//                 {groupedFields.coBorrowers[index].map((field: any) => (
//                   <EditableFieldItem
//                     key={field.fieldKey}
//                     field={field}
//                     value={editableFieldValues[field.fieldKey || ""] ?? ""}
//                     onChange={handleEditableFieldChange}
//                     errors={errors}
//                   />
//                 ))}
//               </div>
//             </div>
//           ))}

//           {groupedFields.others.length > 0 && (
//             <div>
//               <h3 className="mb-4 border-b pb-2 text-md font-bold dark:border-slate-800">
//                 Loan Details
//               </h3>
//               <div className="grid gap-6 md:grid-cols-2">
//                 {groupedFields.others.map((field: any) => (
//                   <EditableFieldItem
//                     key={field.fieldKey}
//                     field={field}
//                     value={editableFieldValues[field.fieldKey || ""] ?? ""}
//                     onChange={handleEditableFieldChange}
//                     errors={errors}
//                   />
//                 ))}
//               </div>
//             </div>
//           )}

//           {/* Entity */}
//           {groupedFields.entity.length > 0 && (
//             <div>
//               <h3 className="mb-4 border-b pb-2 text-md font-bold dark:border-slate-800">
//                 Entity Information
//               </h3>
//               <div className="grid gap-6 md:grid-cols-2">
//                 {groupedFields.entity.map((field) => (
//                   <EditableFieldItem
//                     key={field.fieldKey}
//                     field={field}
//                     value={editableFieldValues[field.fieldKey || ""] ?? ""}
//                     onChange={handleEditableFieldChange}
//                     errors={errors}
//                   />
//                 ))}
//               </div>
//             </div>
//           )}

//           {/* Property */}
//           {groupedFields.property.length > 0 && (
//             <div>
//               <h3 className="mb-4 border-b pb-2 text-md font-bold dark:border-slate-800">
//                 Property Details
//               </h3>
//               <div className="grid gap-6 md:grid-cols-2">
//                 {groupedFields.property.map((field) => (
//                   <EditableFieldItem
//                     key={field.fieldKey}
//                     field={field}
//                     value={editableFieldValues[field.fieldKey || ""] ?? ""}
//                     onChange={handleEditableFieldChange}
//                     errors={errors}
//                   />
//                 ))}
//               </div>
//             </div>
//           )}

//           {/* Financial */}
//           {groupedFields.financial.length > 0 && (
//             <div>
//               <h3 className="mb-4 border-b pb-2 text-md font-bold dark:border-slate-800">
//                 Financial Details
//               </h3>
//               <div className="grid gap-6 md:grid-cols-2">
//                 {groupedFields.financial.map((field) => (
//                   <EditableFieldItem
//                     key={field.fieldKey}
//                     field={field}
//                     value={editableFieldValues[field.fieldKey || ""] ?? ""}
//                     onChange={handleEditableFieldChange}
//                     errors={errors}
//                   />
//                 ))}
//               </div>
//             </div>
//           )}

//           {/* Loan */}
//           {groupedFields.loan.length > 0 && (
//             <div>
//               <h3 className="mb-4 border-b pb-2 text-md font-bold dark:border-slate-800">
//                 Loan Details
//               </h3>
//               <div className="grid gap-6 md:grid-cols-2">
//                 {groupedFields.loan.map((field) => (
//                   <EditableFieldItem
//                     key={field.fieldKey}
//                     field={field}
//                     value={editableFieldValues[field.fieldKey || ""] ?? ""}
//                     onChange={handleEditableFieldChange}
//                     errors={errors}
//                   />
//                 ))}
//               </div>
//             </div>
//           )}

//           {/* Others */}
//           {groupedFields.others.length > 0 && (
//             <div>
//               <h3 className="mb-4 border-b pb-2 text-md font-bold dark:border-slate-800">
//                 Other Details
//               </h3>
//               <div className="grid gap-6 md:grid-cols-2">
//                 {groupedFields.others.map((field) => (
//                   <EditableFieldItem
//                     key={field.fieldKey}
//                     field={field}
//                     value={editableFieldValues[field.fieldKey || ""] ?? ""}
//                     onChange={handleEditableFieldChange}
//                     errors={errors}
//                   />
//                 ))}
//               </div>
//             </div>
//           )}
//         </div>

//         {groupedFields.signatureField && (
//           <div className="mt-8 space-y-4 text-center">
//             <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
//               Digital Signature
//             </h3>
//             <div className="flex justify-center">
//               <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/70">
//                 <img
//                   src={parseValue(groupedFields.signatureField.value)}
//                   alt="Digital Signature"
//                   className="h-40 object-contain"
//                 />
//               </div>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );

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
            onClick={() =>
              setSelectedRequestDocs(
                requestDocs.map((doc: any) => doc.documentTypeId),
              )
            }
            className="rounded-md border bg-gray-50 px-3 py-1 text-xs hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-900"
          >
            Select All
          </button>
          <button
            onClick={() => setSelectedRequestDocs([])}
            className="rounded-md border bg-gray-50 px-3 py-1 text-xs hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-900"
          >
            Clear
          </button>
        </div>
      </div>

      {requestDocsLoading ? (
        <div className="py-10 text-center text-gray-500">
          Loading documents...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {requestDocs.map((doc: any) => {
              const isSelected = selectedRequestDocs.includes(
                doc.documentTypeId,
              );
              return (
                <div
                  key={doc.documentTypeId}
                  onClick={() => {
                    setSelectedRequestDocs((prev) =>
                      isSelected
                        ? prev.filter((id) => id !== doc.documentTypeId)
                        : [...prev, doc.documentTypeId],
                    );
                  }}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 transition ${
                    isSelected
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10"
                      : "border-gray-200 hover:border-gray-300 dark:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-orange-400" />
                    <span className="text-sm text-gray-700 dark:text-slate-200">
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
              onClick={handleRequestDocuments}
              disabled={selectedRequestDocs.length === 0 || requestSubmitting}
              className="rounded-lg bg-emerald-600 px-5 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {requestSubmitting ? "Requesting..." : "Request Documents"}
            </button>
          </div>
        </>
      )}
    </div>
    );
  };

  const renderViewLoi = () => (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold dark:text-white">
            Letters of Intent
          </h2>
          <p className="text-sm text-slate-500">
            Available lender LOIs for this submission.
          </p>
        </div>
      </div>

      {loiLoading ? (
        <div className="py-10 text-center text-slate-500">Loading LOIs...</div>
      ) : lois.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/10">
            <FileText className="h-7 w-7 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            No LOIs Available
          </h3>
          <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            No lenders have issued a Letter of Intent for this application yet.
            Once available, it will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {lois.map((loi, index) => (
            <div
              key={`${loi.lenderName}-${index}`}
              className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {loi.lenderName}
                </h3>
                <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs text-indigo-600">
                  {loi.status}
                </span>
              </div>

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

              {loi.notes && (
                <div className="text-sm">
                  <span className="text-slate-500 dark:text-slate-300">
                    Notes
                  </span>
                  <p className="mt-1 dark:text-slate-400">{loi.notes}</p>
                </div>
              )}

              {/* <div className="flex justify-end border-t pt-3 dark:border-slate-800">
                <button
                  onClick={() =>
                    setPreviewFile({
                      url: `${API_BASE}/public${loi.loiUrl}`,
                      type: "application/pdf",
                      name: `${loi.lenderName} LOI`,
                    })
                  }
                  className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700"
                >
                  View LOI PDF
                </button>
              </div> */}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderFindLenders = () => {
    const filteredEligibleLenders = lenders
      .filter((lender) => {
        // Filter by type
        if (lenderFilter === "all") return true;
        return lender.type === lenderFilter;
      })
      .filter(
        (lender) =>
          lender.name.toLowerCase().includes(lenderSearchQ.toLowerCase()) ||
          lender.email?.toLowerCase().includes(lenderSearchQ.toLowerCase()),
      );

    const paginatedEligibleLenders = filteredEligibleLenders.slice(
      (lenderPage - 1) * lenderLimit,
      lenderPage * lenderLimit,
    );

    const totalEligiblePages = Math.ceil(
      filteredEligibleLenders.length / lenderLimit,
    );

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
                setLenderFilter(type as any);
                setLenderPage(1);

                setTimeout(() => {
                  bottomRef.current?.scrollIntoView({ behavior: "smooth" });
                }, 100);
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
          <div>
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
                setLenderPage(1);
                setLenderLimit(Number(e.target.value));
              }}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm 
text-slate-800 outline-none
dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value={6}>6 / page</option>
              <option value={9}>9 / page</option>
              <option value={12}>12 / page</option>
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
                  {borrowerSummary.borrowerMinTerm} -{" "}
                  {borrowerSummary.borrowerMaxTerm} months
                </div>
              </div>

              <div>
                <b>Score:</b>
                <div className="text-blue-400 font-semibold">
                  {borrowerSummary.creditScore}
                </div>
              </div>

              <div>
                <b>Total Lenders:</b>
                <div className="text-blue-400 font-semibold">
                  {lenders.length}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LOADING */}
        {lenderLoading && <div>Loading...</div>}

        {/* EMPTY */}
        {!lenderLoading && lenders.length === 0 && (
          <div className="text-center py-10">No lenders found</div>
        )}

        {/* LIST */}
        {!lenderLoading && lenders.length > 0 && (
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
                      className={`px-2 py-1 text-xs rounded-full ${
                        lender.type === "eligible"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : lender.type === "rejected"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      }`}
                    >
                      {lender.type}
                    </span>
                  </div>

                  {/* DETAILS */}
                  <div className="text-sm space-y-1">
                    <div>Product: {lender.loanProductCode}</div>
                    <div>
                      Funding: ${lender.minFunding} - ${lender.maxFunding}
                    </div>
                    <div>
                      Term: {lender.minMonths} - {lender.maxMonths}
                    </div>
                    <div>Interest: {lender.interestRateRange}</div>
                  </div>

                  {/* REJECTION */}
                  {lender.type === "rejected" &&
                    lender.rejectionReasons?.length > 0 && (
                      <div
                        className="mt-3 text-xs text-red-600 bg-red-50 p-2 rounded
dark:bg-red-900/20 dark:text-red-400"
                      >
                        {lender.rejectionReasons.map((r: string, i: number) => (
                          <div key={i}>• {r}</div>
                        ))}
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

     ${
       sendingId === lender.lenderProductId
         ? "bg-slate-400 cursor-wait"
         : lender.alreadySent
           ? "bg-blue-500 cursor-not-allowed"
           : lender.type === "rejected"
             ? "bg-red-500 cursor-not-allowed"
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
                          ? "Not Eligible"
                          : "Send to Lender"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PAGINATION */}
        {!lenderLoading && filteredEligibleLenders.length > lenderLimit && (
          <div className="px-4 py-2 rounded-lg border border-slate-300 text-sm bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
            <button
              disabled={lenderPage === 1}
              onClick={() => setLenderPage((p) => p - 1)}
            >
              Prev
            </button>

            <button
              disabled={lenderPage >= totalEligiblePages}
              onClick={() => setLenderPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    );
  };

  // const renderSubmittedLenders = () => {
  //   const lenders = submissionDetail.lenders || [];

  //   const filteredLenders = lenders.filter((lender: any) =>
  //     lender.lenderName
  //       ?.toLowerCase()
  //       .includes(debouncedLenderSearch.toLowerCase()),
  //   );

  //   const totalPages = Math.ceil(filteredLenders.length / itemsPerPage);

  //   const paginatedLenders = filteredLenders.slice(
  //     (currentPage - 1) * itemsPerPage,
  //     currentPage * itemsPerPage,
  //   );

  //   return (
  //     <div className="rounded-2xl border bg-white p-6 dark:bg-slate-950 dark:border-slate-800">
  //       <div className="flex items-center justify-between mb-4">
  //         <h2 className="text-lg font-semibold">Submitted To Lenders</h2>

  //         <div className="relative w-60">
  //           {/* ICON */}
  //           <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />

  //           {/* INPUT */}
  //           <input
  //             type="text"
  //             placeholder="Search lender..."
  //             value={search}
  //             onChange={(e) => setSearch(e.target.value)}
  //             className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700"
  //           />
  //         </div>
  //       </div>

  //       {filteredLenders.length === 0 ? (
  //         <div className="flex flex-col items-center justify-center py-16 text-center">
  //           {/* ICON */}
  //           <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 shadow-sm">
  //             <Send className="h-7 w-7 text-blue-600" />
  //           </div>

  //           {/* TITLE */}
  //           <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
  //             No Lenders Yet
  //           </h3>

  //           {/* SUBTEXT */}
  //           <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
  //             This application has not been submitted to any lenders yet. Once
  //             you send documents, lenders will appear here.
  //           </p>
  //         </div>
  //       ) : (
  //         <>
  //           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  //             {paginatedLenders.map((lender: any, index: number) => (
  //               <div
  //                 key={index}
  //                 className="flex items-center justify-between p-4 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 hover:shadow-md hover:scale-[1.02] transition cursor-pointer"
  //               >
  //                 {/* LEFT */}
  //                 <div className="flex items-center gap-3 min-w-0">
  //                   <div className="h-10 w-10 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-semibold text-sm">
  //                     {lender.profileImage && lender.profileImage != null ? (
  //                       <img
  //                         src={`${API_BASE}${lender.profileImage}`}
  //                         alt={lender.lenderName}
  //                         className="h-full w-full object-cover"
  //                       />
  //                     ) : (
  //                       <span>{lender.lenderName?.charAt(0) || "L"}</span>
  //                     )}
  //                   </div>

  //                   {/* INFO */}
  //                   <div className="min-w-0">
  //                     <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
  //                       {lender.lenderName || "Unknown"}
  //                     </p>

  //                     <p className="text-xs text-slate-500 truncate">
  //                       {lender.sentAt
  //                         ? new Date(lender.sentAt).toLocaleDateString()
  //                         : "No date"}
  //                     </p>
  //                   </div>
  //                 </div>

  //                 {/* STATUS */}
  //                 <span
  //                   className={`px-2.5 py-1 text-[10px] rounded-full font-semibold whitespace-nowrap ${getStatusChip(
  //                     lender.lenderStatus,
  //                   )}`}
  //                 >
  //                   {lender.lenderStatus || "PENDING"}
  //                 </span>
  //               </div>
  //             ))}
  //           </div>

  //           {lenders.length > itemsPerPage && (
  //             <div className="flex items-center justify-between mt-6">
  //               {/* PREVIOUS */}
  //               <button
  //                 onClick={() =>
  //                   setCurrentPage((prev) => Math.max(prev - 1, 1))
  //                 }
  //                 disabled={currentPage === 1}
  //                 className="px-4 py-2 text-sm rounded-lg border disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-800"
  //               >
  //                 ← Previous
  //               </button>

  //               {/* PAGE INFO */}
  //               <p className="text-sm text-slate-500">
  //                 Page {currentPage} of {totalPages}
  //               </p>

  //               {/* NEXT */}
  //               <button
  //                 onClick={() =>
  //                   setCurrentPage((prev) => Math.min(prev + 1, totalPages))
  //                 }
  //                 disabled={currentPage === totalPages}
  //                 className="px-4 py-2 text-sm rounded-lg border disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-800"
  //               >
  //                 Next →
  //               </button>
  //             </div>
  //           )}
  //         </>
  //       )}
  //     </div>
  //   );
  // };

  const renderDocuments = () => (
    <div className="min-h-screen h-[90vh] rounded-3xl p-6">
      <div className="mb-2">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">
          Requested Documents
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Upload, filter, and manage documents for this application.
        </p>
      </div>

      <DocumentControlsBar
        showAutoForward={false}
        showSentFilter={false}
        autoForwardEnabled={false}
        autoForwardSaving={false}
        onToggleAutoForward={() => undefined}
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
        brokerSourceFilterLabel="Principal broker"
        coBrokerSourceFilterLabel="My documents"
      />

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
                  {/* <th className="px-5 py-4 text-left">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleSelectAll}
                      className="h-4 w-4 accent-emerald-600 cursor-pointer"
                    />
                  </th> */}
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
                    getDocumentSourceDisplay(doc, {
                      brokerSourceLabel,
                      subBrokerSourceLabel: coBrokerDisplayName,
                    });
                  const sentDisplay = getDocumentSentDisplay(doc);

                  return (
                    <tr
                      key={doc.rowKey}
                      className="group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all hover:shadow-sm"
                    >
                      {/* <td className="px-5 py-4">
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(doc.requirementId)}
                          onChange={() => handleSelectRow(doc.requirementId)}
                          className="h-4 w-4 accent-emerald-600 cursor-pointer"
                        />
                      </td> */}
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
                          className={`rounded-full px-3 py-1 text-xs font-medium ${sourceClass}`}
                        >
                          {sourceLabel}
                        </span>
                      </td>

 {/* STATUS */}
<td className="w-[220px] min-w-[220px] max-w-[220px] px-4 py-4 text-center align-middle">
<div className="relative flex flex-col items-center justify-center gap-1">
    <span
      className={`px-3 py-1 rounded-full text-xs font-semibold ${getDocumentStatusChip(
        doc.status ?? "",
      )}`}
    >
      {formatDocumentStatusLabel(doc.status)}
    </span>

    {sentDisplay && (
      <span
        className={`max-w-[220px] px-2 py-0.5 text-center text-[10px] font-semibold rounded-full ${
          sentDisplay.isPartial
            ? "bg-amber-50 text-amber-700"
            : sentDisplay.isSent
              ? "bg-emerald-50 text-emerald-700"
              : "bg-orange-50 text-orange-700"
        }`}
      >
        {sentDisplay.detail}
      </span>
    )}

    {doc.status === "SKIPPED" && (
      <span className="max-w-[180px] text-center text-[10px] font-medium text-red-500 break-words">
        Skipped by Principal Broker
      </span>
    )}

    {(doc as any).isSentToBroker &&
      doc.status !== "SKIPPED" && (
        <span className="text-[10px] font-medium text-blue-600 text-center">
          SENT TO PRINCIPAL BROKER
        </span>
      )}

    {(doc as any).skipReason &&
      doc.status === "SKIPPED" && (
<div className="group/review relative flex justify-center">
  <span
    className="
max-w-[180px]
truncate
text-center
text-[10px]
text-slate-500
cursor-pointer
"
  >
    {(doc as any).skipReason}
  </span>

  <div
   className="
pointer-events-none
absolute
left-1/2
bottom-full
z-[9999]
mb-2
hidden
w-72
-translate-x-1/2
rounded-xl
border
border-slate-200
bg-white
p-3
text-left
text-[11px]
leading-relaxed
text-slate-700
shadow-2xl
whitespace-pre-wrap
break-words
group-hover/review:block

dark:border-slate-700
dark:bg-slate-900
dark:text-slate-200
"
  >
    <p className="font-semibold text-red-500 mb-1">
      Complete Review
    </p>

    <p className="break-words whitespace-pre-wrap">
      {(doc as any).skipReason}
    </p>
  </div>
</div>
      )}
  </div>
</td>

                      {/* FILES */}
                      <td className="px-5 py-4 text-center">
                        {Number(doc.uploadedCount) > 0 ? (
                          <div className="flex justify-center items-center gap-2">
                            {(doc as any).isSentToBroker && (
                              <span className="px-2 py-1 text-[10px] rounded-full bg-blue-100 text-blue-700 font-semibold">
                                Sent To PB
                              </span>
                            )}
                            <span className="px-3 py-1 text-xs rounded-full bg-emerald-100 text-emerald-700 font-semibold">
                              {doc.uploadedCount} Files
                            </span>

                            <button
                              onClick={() => {
                                setPreviewFiles(
                                  ((doc.uploadedFiles as any[]) || []),
                                );
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
                      <td className="relative px-5 py-4 text-right">
                    <button
  disabled={doc.status === "SKIPPED"}
  onClick={() =>
    setActiveAction(isOpen ? null : doc.rowKey)
  }
  className={`
rounded-xl
p-1.5
transition-all
duration-200

${
  doc.status === "SKIPPED"
    ? "cursor-not-allowed opacity-40 text-slate-300 dark:text-slate-600"
    : `
      text-slate-500
      hover:bg-slate-100
      hover:text-slate-700
      dark:hover:bg-slate-800
      dark:hover:text-white
    `
}
`}
>
  <MoreVertical size={15} />
</button>
                        {isOpen && (
                          <div
                            className="
absolute right-0 z-50 mt-2 w-44 overflow-hidden
rounded-xl border border-slate-200
bg-white shadow-2xl
animate-in fade-in zoom-in-95

dark:border-slate-700
dark:bg-slate-900
"
                          >
                            <label
                              className="
flex cursor-pointer items-center gap-2
px-4 py-3 text-sm text-amber-600
transition hover:bg-amber-50
dark:hover:bg-amber-500/10
"
                            >
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
                                    // ✅ SUB BROKER TOKEN
                                    const token =
                                      sessionStorage.getItem(CO_BROKER_TOKEN_KEY);

                                    for (const file of Array.from(files)) {
                                      const formData = new FormData();

                                      formData.append("file", file);

                                      // ✅ SUB BROKER API
                                      const res = await fetch(
                                        `${API_BASE}/subbroker/documents/submissions/${documentsData.submissionId}/documents/${doc.requirementId}/upload`,
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
                                        throw new Error(
                                          json.message || `${file.name} failed`,
                                        );
                                      }
                                    }

                                    toast.success("Uploaded successfully");

                                    // refresh
                                    await fetchSubmissionDocuments(
                                      documentsData.submissionId,
                                    );
                                  } catch (err: any) {
                                    console.error(err);

                                    toast.error(err.message || "Upload failed");
                                  } finally {
                                    setActiveAction(null);
                                  }
                                }}
                              />
                            </label>
                            {doc.source === "SUB_BROKER_ADDED" &&
  Number(doc.uploadedCount) > 0 &&
  !(doc as any).isSentToBroker &&
  doc.status !== "SKIPPED" && (
                            <button
  onClick={async () => {
    try {
      const token = sessionStorage.getItem(CO_BROKER_TOKEN_KEY);

      const res = await fetch(
        `${API_BASE}/subbroker/documents/${doc.requirementId}/send-to-broker`,
        {
          method: "POST",

          headers: {
            ...(token && {
              Authorization: `Bearer ${token}`,
            }),
          },
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message || "Failed to send document",
        );
      }

      toast.success(
        "Document sent to Principal Broker",
      );

      await fetchSubmissionDocuments(
        documentsData.submissionId,
      );
    } catch (err: any) {
      console.error(err);

      toast.error(
        err.message || "Failed to send",
      );
    } finally {
      setActiveAction(null);
    }
  }}
  className="
flex w-full items-center gap-2
px-4 py-3 text-sm text-blue-600
transition hover:bg-blue-50
dark:hover:bg-blue-500/10
"
>
  <FiSend size={14} />
  Send To PB
</button>
                              )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="flex items-center justify-between px-4 py-3 border-t dark:border-slate-800 bg-white dark:bg-slate-900">
            <p className="text-sm text-slate-500">
              Page <span className="font-semibold">{pagination?.page}</span> of{" "}
              <span className="font-semibold">{pagination?.totalPages}</span>
            </p>

            <div className="flex items-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded-lg border text-sm hover:bg-slate-100 disabled:opacity-40"
              >
                ← Prev
              </button>

              <button
                disabled={page === pagination?.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg border text-sm hover:bg-slate-100 disabled:opacity-40"
              >
                Next →
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
            {searchInput ||
            documentSourceFilter !== "all" ||
            documentLenderFilter
              ? "Try adjusting your search or filters."
              : "You haven’t requested documents yet."}
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
        return renderViewDetails();
      case "find-lenders":
        return renderFindLenders();
      case "request-document":
        return renderRequestDocument();
      case "view-loi":
        return renderViewLoi();
      case "documents":
        return renderDocuments();

      case "chat":
        return <LoanPreviewChat applicationId={applicationId} />;
      case "fee-agreement":
        return (
          <FeeAgreement applicationId={applicationId} />
        );
      case "commissions":
        return (
          <LoanCommissionPanel
            loanApplicationId={applicationId}
            getAuthHeaders={getAuthHeaders}
            portal="subbroker"
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

  return (
    <>
      <div className="min-h-screen bg-slate-50 p-6 dark:bg-[#0b1120] dark:text-slate-100">
        <div className="mx-auto max-w-7xl">
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
                      {borrowerDisplayName}
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
                      {submissionDetail?.loanProduct?.name ||
                        getFieldValue(fields, "loanProductCode") ||
                        "No Product"}
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
                      Amount Requested
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
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

              <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.key;

                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`group relative inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200
          ${
            isActive
              ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
          }
        `}
                    >
                      {/* ICON */}
                      <span
                        className={`flex items-center justify-center rounded-md p-1 transition-all
          ${
            isActive
              ? "bg-white/20"
              : "bg-slate-100 group-hover:bg-slate-200 dark:bg-slate-800 dark:group-hover:bg-slate-700"
          }`}
                      >
                        <Icon
                          size={13}
                          className={`transition ${
                            isActive ? "text-white" : tab.color
                          }`}
                        />
                      </span>

                      {/* LABEL */}
                      <span className="whitespace-nowrap">{tab.label}</span>

                      {/* ACTIVE UNDERLINE GLOW */}
                      {isActive && (
                        <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-white/70 blur-[1px]" />
                      )}
                    </button>
                  );
                })}
              </div>

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
                  onClick={() => setActiveIndex((p) => p - 1)}
                  className="absolute left-4 bg-white p-2 rounded-full shadow"
                >
                  ←
                </button>
              )}

              {/* RIGHT */}
              {activeIndex < previewFiles.length - 1 && (
                <button
                  onClick={() => setActiveIndex((p) => p + 1)}
                  className="absolute right-4 bg-white p-2 rounded-full shadow"
                >
                  →
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
              {previewFiles.map((file, i) => (
                <div
                  key={i}
                  onClick={() => setActiveIndex(i)}
                  className={`h-14 w-20 flex items-center justify-center rounded-lg cursor-pointer border-2 overflow-hidden ${
                    i === activeIndex ? "border-blue-500" : "border-transparent"
                  }`}
                >
                  {file.fileMimeType?.includes("image") ? (
                    <img
                      src={`${API_BASE}${file.fileUrl}`}
                      className="h-full w-full object-cover"
                    />
                  ) : file.fileMimeType?.includes("pdf") ? (
                    <div className="flex flex-col items-center justify-center text-[10px] text-red-600 font-semibold">
                      📄 PDF
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400">FILE</div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};

export default LoanPreview;
