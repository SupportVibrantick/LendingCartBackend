import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Eye,
  FileIcon,
  FileText,
  Filter,
  FolderOpen,
  Loader2,
  MessageSquare,
  Search,
  SearchX,
  Send,
  Upload,
  User,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import Chat from "./Chat";
import { MdEmail } from "react-icons/md";
import { BiLogoProductHunt } from "react-icons/bi";
import { FaDollarSign } from "react-icons/fa6";
import { formatDocumentStatusLabel } from "../../lib/documentStatus";
import { getLenderDocumentSourceDisplay } from "../../lib/documentSource";
import {
  canLenderRequestDocuments,
  getLenderRequestDocumentsDisabledReason,
} from "../../lib/loanPipelineUtils";
import {
  canGenerateLoi,
  canRequestDocuments,
  canUploadSignDocuments,
} from "../../lib/lenderPermissions";
import LenderSubmissionDetailsView from "../../components/submissions/LenderSubmissionDetailsView";
import SignDocumentsPanel from "../../components/documents/SignDocumentsPanel";
import LoiUnderwritingFormModal from "../../components/loi/LoiUnderwritingFormModal";
import {
  getNumericFieldValue,
  getLatestSubmission,
  mapLenderSubmissionFields,
  parseSubmissionFieldValue,
  type SubmissionDetailField,
} from "../../lib/submissionFieldUtils";
import type { serializeLoiUnderwritingTerms } from "../../lib/loiUnderwritingTerms";

type PreviewTab = "details" | "documents" | "signDocuments" | "requestDocs" | "loi" | "chat";
type DocumentSourceFilter = "all" | "mine" | "broker";
type PreviewSectionId = "application" | "documents" | "communication" | "lender";

type PreviewTabItem = {
  id: PreviewTab;
  label: string;
  icon: LucideIcon;
  color: string;
  disabled?: boolean;
  disabledReason?: string;
};

type PreviewTabSection = {
  id: PreviewSectionId;
  label: string;
  icon: LucideIcon;
  items: PreviewTabItem[];
};

const PREVIEW_SECTION_BY_TAB: Record<PreviewTab, PreviewSectionId> = {
  details: "application",
  documents: "documents",
  requestDocs: "documents",
  signDocuments: "documents",
  chat: "communication",
  loi: "lender",
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

const normalizeText = (value: unknown) => String(value || "").trim();

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

const getFieldValueFromList = (
  fields: SubmissionDetailField[],
  ...keys: string[]
) => {
  const field = fields.find((item) => item.fieldKey && keys.includes(item.fieldKey));
  if (!field) return undefined;
  return parseSubmissionFieldValue(field.value);
};

const getBorrowerDisplayName = (
  submissionDetail: any,
  fields: SubmissionDetailField[] = [],
) => {
  const firstName = normalizeText(
    getFieldValueFromList(
      fields,
      "borrowerFirstName",
      "firstName",
      "first_name",
    ),
  );
  const lastName = normalizeText(
    getFieldValueFromList(
      fields,
      "borrowerLastName",
      "lastName",
      "last_name",
    ),
  );

  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  if (fullName) {
    return fullName;
  }

  const borrowerName = normalizeText(
    getFieldValueFromList(
      fields,
      "borrowerName",
      "applicantName",
      "fullName",
      "name",
    ),
  );

  if (borrowerName) {
    return borrowerName;
  }

  const resolvedName = normalizeText(submissionDetail?.borrowerName);
  if (resolvedName) {
    return resolvedName;
  }

  const legalName = normalizeText(
    submissionDetail?.loanApplication?.client?.legalName,
  );

  if (
    legalName &&
    legalName !== "Applicant" &&
    legalName !== "Individual Applicant"
  ) {
    return legalName;
  }

  return "N/A";
};

function getAuthHeaders(): HeadersInit {
  const token = sessionStorage.getItem("lender_token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

const tabMeta: Array<{ id: PreviewTab; label: string }> = [
  { id: "details", label: "View Details" },
  { id: "requestDocs", label: "Request Documents" },
  { id: "documents", label: "Uploaded Documents" },
  { id: "signDocuments", label: "Upload Signable Forms/Documents" },
  { id: "loi", label: "View LOI" },
  { id: "chat", label: "Chat" },
];

function getVisibleTabs() {
  return tabMeta
    .filter((tab) => {
      if (tab.id === "requestDocs") {
        return canRequestDocuments();
      }
      return true;
    })
    .map((tab) => {
      if (tab.id === "documents" && !canRequestDocuments()) {
        return { ...tab, label: "View Documents" };
      }

      if (tab.id === "signDocuments" && !canUploadSignDocuments()) {
        return { ...tab, label: "View Sign Documents" };
      }

      return tab;
    });
}

export default function LoanPreview() {
  const navigate = useNavigate();
  const location = useLocation();
  const visibleTabs = useMemo(() => getVisibleTabs(), []);
  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );

  const pathSegments = location.pathname.split("/").filter(Boolean);
  const applicationLenderId =
    location.state?.applicationLenderId ||
    searchParams.get("applicationLenderId") ||
    (pathSegments[0] === "loan-preview" ? pathSegments[1] : "") ||
    "";

  const requestedTab =
    location.state?.initialTab || searchParams.get("tab") || "details";

  const isLoi = location.state?.isLoi;
  const shouldOpenLoiForm = Boolean(location.state?.openLoiForm);

  const initialTab: PreviewTab = (() => {
    const allowedTabs = getVisibleTabs().map((tab) => tab.id);
    if (allowedTabs.includes(requestedTab as PreviewTab)) {
      return requestedTab as PreviewTab;
    }
    return "details";
  })();

  const [activeTab, setActiveTab] = useState<PreviewTab>(initialTab);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submissionDetail, setSubmissionDetail] = useState<any>(null);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsData, setDocumentsData] = useState<any>(null);
  const [documentsPagination, setDocumentsPagination] = useState<any>(null);
  const [documentPage, setDocumentPage] = useState(1);
  const [documentSearchInput, setDocumentSearchInput] = useState("");
  const [documentSourceFilter, setDocumentSourceFilter] =
    useState<DocumentSourceFilter>("all");
  const [loiLoading, setLoiLoading] = useState(false);
  const [loiGenerating, setLoiGenerating] = useState(false);
  const [loiFormOpen, setLoiFormOpen] = useState(shouldOpenLoiForm);
  const [loiUrl, setLoiUrl] = useState<string | null>(null);
  const [loanProducts, setLoanProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [customDocs, setCustomDocs] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [selectedLoanProduct, setSelectedLoanProduct] = useState("");
  const [previewFile, setPreviewFile] = useState<{
    url: string;
    type: string;
    name: string;
  } | null>(null);
  const [multiFileModal, setMultiFileModal] = useState<{
    isOpen: boolean;
    doc: any;
  }>({
    isOpen: false,
    doc: null,
  });
  const [docSelectModal, setDocSelectModal] = useState({
    documents: [] as any[],
    selectedDocs: [] as string[],
    loading: false,
  });
  const [requestLoading, setRequestLoading] = useState(false);

  const handleAddCustomDoc = () => {
    if (!customInput.trim()) return;

    setCustomDocs((prev) => {
      if (prev.includes(customInput.trim())) return prev; // prevent duplicate
      return [...prev, customInput.trim()];
    });

    setCustomInput("");
  };

  const removeCustomDoc = (index: number) => {
    setCustomDocs((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (shouldOpenLoiForm) {
      setLoiFormOpen(true);
    }
  }, [shouldOpenLoiForm, applicationLenderId]);

  useEffect(() => {
    return () => {
      if (loiUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(loiUrl);
      }
    };
  }, [loiUrl]);

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

  const Metric = ({ label, value }: any) => {
    return (
      <div className="flex flex-col gap-1 border-r border-white/20 pr-4 last:border-none">
        <span className="text-xs uppercase tracking-wider text-white/70 font-medium">
          {label}
        </span>

        <span className="text-md font-bold tracking-tight">{value}</span>
      </div>
    );
  };

  const fetchLoanProducts = async () => {
    try {
      setLoadingProducts(true);

      const res = await fetch(`${API_BASE}/lender/loan-products/list`, {
        headers: getAuthHeaders(),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error("Failed to fetch loan products");
      }

      setLoanProducts(json.data || []);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load loan products");
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchDocumentsByProduct = async (code: string) => {
    try {
      setDocSelectModal((prev) => ({ ...prev, loading: true }));

      const res = await fetch(
        `${API_BASE}/lender/document-config/list?loanProductCode=${encodeURIComponent(code)}&limit=100`,
        {
          headers: getAuthHeaders(),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error("Failed to load documents");
        return;
      }

      setDocSelectModal((prev) => ({
        ...prev,
        documents: json.data || [],
        selectedDocs: [],
        loading: false,
      }));
    } catch (err) {
      console.error(err);
      setDocSelectModal((prev) => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    if (!selectedLoanProduct) {
      setDocSelectModal({
        documents: [],
        selectedDocs: [],
        loading: false,
      });
    }
  }, [selectedLoanProduct]);

  const handleDownload = async (url: string, filename: string) => {
    try {
      const res = await fetch(url, {
        headers: url.startsWith("blob:") ? undefined : getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to download file");

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      toast.error(err.message || "Download failed");
    }
  };

  useEffect(() => {
    setSubmissionDetail(null);
    setLoiUrl((prev) => {
      if (prev?.startsWith("blob:")) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
  }, [applicationLenderId]);

  const canCreateLoi = useMemo(() => canGenerateLoi(), []);
  const loiGenerated = Boolean(submissionDetail?.loiUrl);
  const showLoiTab = canCreateLoi || loiGenerated || Boolean(isLoi);

  const fetchLenderApplicationDetail = async () => {
    if (!applicationLenderId) return;

    try {
      setDetailLoading(true);
      const res = await fetch(
        `${API_BASE}/lender/loan-pipeline/${applicationLenderId}`,
        {
          headers: getAuthHeaders(),
        },
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load application");
      }

      setSubmissionDetail(json.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load application");
    } finally {
      setDetailLoading(false);
    }
  };

  const latestSubmission = useMemo(
    () =>
      submissionDetail?.latestSubmission ||
      getLatestSubmission(submissionDetail?.loanApplication?.submissions || []),
    [submissionDetail],
  );

  const submissionFields = useMemo(
    () => mapLenderSubmissionFields(latestSubmission?.fields || []),
    [latestSubmission],
  );

  const loanAmount = useMemo(
    () =>
      getNumericFieldValue(submissionFields, "amountRequested") ||
      Number(submissionDetail?.amountRequested) ||
      0,
    [submissionFields, submissionDetail?.amountRequested],
  );
  const ltv = useMemo(
    () => getNumericFieldValue(submissionFields, "ltvPercentage"),
    [submissionFields],
  );
  const ltc = useMemo(
    () => getNumericFieldValue(submissionFields, "ltcPercentage"),
    [submissionFields],
  );
  const arv = useMemo(
    () => getNumericFieldValue(submissionFields, "arvPercentage"),
    [submissionFields],
  );
  const dscr = useMemo(
    () => getNumericFieldValue(submissionFields, "dscr"),
    [submissionFields],
  );
  const netWorth = useMemo(
    () => getNumericFieldValue(submissionFields, "netWorth"),
    [submissionFields],
  );
  const interestRate = useMemo(
    () => getNumericFieldValue(submissionFields, "interestRate"),
    [submissionFields],
  );
  const amortizationYears = useMemo(
    () => getNumericFieldValue(submissionFields, "amortization"),
    [submissionFields],
  );
  const loanTermMonths = useMemo(
    () => getNumericFieldValue(submissionFields, "loanTerm"),
    [submissionFields],
  );
  const termMonths =
    amortizationYears > 0 ? amortizationYears * 12 : loanTermMonths;
  const monthlyPayment = calculateMonthlyPayment(
    loanAmount,
    interestRate,
    termMonths,
  );
  const monthlyPaymentDisplay = formatMonthlyPayment(monthlyPayment);

  const submittedDate = latestSubmission?.createdAt
    ? new Date(latestSubmission.createdAt)
    : null;

  const fetchDocuments = async () => {
    if (!applicationLenderId) return;
    try {
      setDocumentsLoading(true);

      const params = new URLSearchParams({
        page: String(documentPage),
        limit: "10",
      });

      if (documentSearchInput.trim()) {
        params.set("search", documentSearchInput.trim());
      }

      if (documentSourceFilter !== "all") {
        params.set("sourceFilter", documentSourceFilter);
      }

      const res = await fetch(
        `${API_BASE}/lender/loan-pipeline/lender/applications/${applicationLenderId}/documents?${params.toString()}`,
        {
          headers: getAuthHeaders(),
        },
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load documents");
      }

      setDocumentsData(json.data);
      setDocumentsPagination(json.data.pagination || null);

      if (json.data.pagination?.page) {
        setDocumentPage(json.data.pagination.page);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load documents");
    } finally {
      setDocumentsLoading(false);
    }
  };

  const fetchDocumentConfig = async () => {
    try {
      setDocSelectModal((prev) => ({ ...prev, loading: true }));

      const loanType = submissionDetail?.loanApplication?.loanProductCode;

      if (!loanType) {
        throw new Error("Loan product not found for this application");
      }

      const res = await fetch(
        `${API_BASE}/lender/document-config/list?loanProductCode=${encodeURIComponent(loanType)}&limit=100`,
        {
          headers: getAuthHeaders(),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error("Failed to fetch documents");
      }

      setDocSelectModal({
        documents: json.data || [],
        selectedDocs: [],
        loading: false,
      });
    } catch (err: any) {
      console.error(err.message);
      // toast.error(err.message);
      setDocSelectModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleRequestDocuments = async () => {
    try {
      setRequestLoading(true);

      const payload = {
        decision: "CONDITIONAL",
        notes: "Please upload required documents",

        documentTypeIds: docSelectModal.selectedDocs,

        customDocuments: customDocs,
      };

      const res = await fetch(
        `${API_BASE}/lender/loan-pipeline/${applicationLenderId}/decision`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message);
      }

      toast.success("Documents requested");

      // reset selection
      setDocSelectModal((prev) => ({
        ...prev,
        selectedDocs: [],
      }));

      setCustomDocs([]);
      setCustomInput("");

      // IMPORTANT
      setDocumentsData(null);

      await fetchDocuments();

      setSubmissionDetail(null);
      await fetchLenderApplicationDetail();

      setActiveTab("documents");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRequestLoading(false);
    }
  };

  const loadLoiPreview = async (loiPath?: string, force = false) => {
    if (!applicationLenderId) return;
    if (loiUrl && !force) return;

    try {
      setLoiLoading(true);

      let resolvedPath = loiPath;

      if (!resolvedPath) {
        const res = await fetch(
          `${API_BASE}/lender/loan-pipeline/${applicationLenderId}/view-loi`,
          {
            headers: getAuthHeaders(),
          },
        );

        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.message || "Failed to fetch LOI");
        }

        if (!json.data?.loiPath) {
          throw new Error("LOI not generated yet");
        }

        resolvedPath = json.data.loiPath;
      }

      const fileUrl = `${API_BASE}/public${resolvedPath}`;
      const fileRes = await fetch(fileUrl, {
        headers: getAuthHeaders(),
      });

      if (!fileRes.ok) {
        throw new Error("Failed to load LOI file");
      }

      const blob = await fileRes.blob();
      const blobUrl = URL.createObjectURL(blob);

      setLoiUrl((prev) => {
        if (prev?.startsWith("blob:")) {
          URL.revokeObjectURL(prev);
        }
        return blobUrl;
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to load LOI");
    } finally {
      setLoiLoading(false);
    }
  };

  const handleGenerateLOI = async (
    lenderTerms: ReturnType<typeof serializeLoiUnderwritingTerms>,
  ) => {
    if (!applicationLenderId) return;

    try {
      setLoiGenerating(true);

      const res = await fetch(
        `${API_BASE}/lender/loan-pipeline/${applicationLenderId}/generate-loi`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ lenderTerms }),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to generate LOI");
      }

      toast.success("Term Sheet / LOI generated successfully");
      setLoiFormOpen(false);

      setSubmissionDetail((prev: any) =>
        prev ? { ...prev, loiUrl: json.loiUrl } : prev,
      );

      setLoiUrl((prev) => {
        if (prev?.startsWith("blob:")) {
          URL.revokeObjectURL(prev);
        }
        return null;
      });

      await loadLoiPreview(json.loiUrl, true);

      navigate(`/loan-preview/?tab=loi`, {
        replace: true,
        state: {
          applicationLenderId,
          initialTab: "loi",
          isLoi: true,
        },
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to generate LOI");
    } finally {
      setLoiGenerating(false);
    }
  };

  useEffect(() => {
    fetchLoanProducts();
  }, []);

  useEffect(() => {
    if (!applicationLenderId) return;
    fetchLenderApplicationDetail();
  }, [applicationLenderId]);

  useEffect(() => {
    if (!applicationLenderId) return;

    if (activeTab === "documents") {
      fetchDocuments();
    }

    if (activeTab === "loi" && (loiGenerated || isLoi)) {
      loadLoiPreview();
    }
  }, [
    activeTab,
    applicationLenderId,
    documentPage,
    documentSearchInput,
    documentSourceFilter,
    loiGenerated,
    isLoi,
  ]);

  const latestLenderReview = submissionDetail?.lenderReviews?.[0];
  const latestReviewStatus =
    latestLenderReview?.reviewStatus || latestLenderReview?.decision || null;

  const canRequestDocuments = useMemo(() => {
    if (!submissionDetail) return true;

    return canLenderRequestDocuments(
      submissionDetail.status,
      latestReviewStatus,
    );
  }, [submissionDetail, latestReviewStatus]);

  const requestDocumentsDisabledReason = useMemo(
    () =>
      getLenderRequestDocumentsDisabledReason(
        submissionDetail?.status,
        latestReviewStatus,
      ),
    [submissionDetail?.status, latestReviewStatus],
  );

  useEffect(() => {
    if (
      activeTab === "requestDocs" &&
      canRequestDocuments &&
      docSelectModal.documents.length === 0
    ) {
      fetchDocumentConfig();
    }
  }, [activeTab, canRequestDocuments]);

  useEffect(() => {
    if (!canRequestDocuments && activeTab === "requestDocs") {
      setActiveTab("details");
      navigate("/loan-preview/?tab=details", {
        replace: true,
        state: {
          applicationLenderId,
          initialTab: "details",
          isLoi,
        },
      });
    }
  }, [canRequestDocuments, activeTab, applicationLenderId, isLoi, navigate]);

  useEffect(() => {
    if (selectedLoanProduct) {
      fetchDocumentsByProduct(selectedLoanProduct);
    }
  }, [selectedLoanProduct]);

  const resolvedChatApplicationId =
    submissionDetail?.loanApplication?.id ||
    submissionDetail?.loanApplicationId ||
    submissionDetail?.loanApplication?.loanApplicationId ||
    "";

  const renderChat = () => {
    if (!resolvedChatApplicationId) {
      return (
        <div className="text-center py-16 text-slate-500">
          Chat is not available for this application yet.
        </div>
      );
    }

    return <Chat applicationId={resolvedChatApplicationId} />;
  };

  const onTabChange = (tab: PreviewTab) => {
    if (tab === "requestDocs" && !canRequestDocuments) {
      if (requestDocumentsDisabledReason) {
        toast.error(requestDocumentsDisabledReason);
      }
      return;
    }

    setActiveTab(tab);
    navigate(`/loan-preview/?tab=${tab}`, {
      replace: true,
      state: {
        applicationLenderId,
        initialTab: tab,
        isLoi,
      },
    });
  };

  const renderDetails = () => {
    if (detailLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin w-6 h-6 text-blue-500" />
        </div>
      );
    }

    if (!submissionDetail) {
      return (
        <div className="text-center py-16 text-slate-500">
          Application details not available.
        </div>
      );
    }

    return (
      <LenderSubmissionDetailsView
        applicationLender={submissionDetail}
        fields={submissionFields}
        loanAmount={loanAmount}
        ltv={ltv}
        ltc={ltc}
        arv={arv}
        dscr={dscr}
        netWorth={netWorth}
        monthlyPayment={monthlyPayment}
        monthlyPaymentDisplay={monthlyPaymentDisplay}
        submittedDate={submittedDate}
      />
    );
  };

  const renderDocuments = () => {
    if (documentsLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 className="animate-spin w-10 h-10 text-blue-500" />
          <p className="text-sm text-slate-500">Loading documents...</p>
        </div>
      );
    }

    if (!documentsData) {
      return (
        <div className="text-center py-20 text-slate-400">
          No document data available.
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* STATS CARDS */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl p-5 bg-gradient-to-br from-amber-50 to-white dark:from-slate-800 dark:to-slate-900 border dark:border-slate-700">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Pending Documents
            </p>
            <p className="text-xl font-bold text-amber-600 mt-1">
              {documentsData.documentsPendingCount}
            </p>
          </div>

          <div className="rounded-2xl p-5 bg-gradient-to-br from-blue-50 to-white dark:from-slate-800 dark:to-slate-900 border dark:border-slate-700">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Total Documents
            </p>
            <p className="text-xl font-bold text-blue-600 mt-1">
              {documentsData.totalDocumentsCount ??
                documentsPagination?.total ??
                documentsData.documents?.length ??
                0}
            </p>
          </div>
        </div>

        {/* TABLE CARD */}
        <div className="rounded-2xl border bg-white dark:bg-slate-900 overflow-hidden dark:border-slate-700">
          <div className="flex flex-col gap-3 border-b px-5 py-4 dark:border-slate-800 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                Documents List
              </h2>
              {(documentSourceFilter !== "all" || documentSearchInput.trim()) && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  Filtered
                </span>
              )}
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
              <div className="relative w-full sm:w-52">
                <Filter
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <select
                  value={documentSourceFilter}
                  onChange={(e) => {
                    setDocumentSourceFilter(
                      e.target.value as DocumentSourceFilter,
                    );
                    setDocumentPage(1);
                  }}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-9 pr-9 text-sm text-slate-800 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white dark:focus:border-blue-400 dark:focus:bg-slate-900"
                >
                  <option value="all">All documents</option>
                  <option value="mine">My documents</option>
                  <option value="broker">Broker documents</option>
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>

              <div className="relative w-full sm:max-w-xs">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={documentSearchInput}
                onChange={(e) => {
                  setDocumentSearchInput(e.target.value);
                  setDocumentPage(1);
                }}
                placeholder="Search documents..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-9 pr-9 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white dark:focus:border-blue-400 dark:focus:bg-slate-900"
              />
              {documentSearchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setDocumentSearchInput("");
                    setDocumentPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-200/80 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                  aria-label="Clear search"
                >
                  <SearchX size={14} />
                </button>
              )}
              </div>
            </div>
          </div>

          {documentsData.documents?.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <SearchX className="h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                {documentSearchInput.trim() || documentSourceFilter !== "all"
                  ? "No documents match your filters."
                  : "No documents available yet."}
              </p>
              {(documentSearchInput.trim() || documentSourceFilter !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setDocumentSearchInput("");
                    setDocumentSourceFilter("all");
                    setDocumentPage(1);
                  }}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
          <table className="w-full text-left">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="px-5 py-3">Document</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-center">Source</th>
                <th className="px-5 py-3 text-center">Uploads</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y dark:divide-slate-800">
              {documentsData.documents?.map((doc: any) => (
                <tr
                  key={doc.requirementId}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all"
                >
                  {/* 📄 DOCUMENT INFO */}
                  <td className="px-5 py-4">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm">
                        {doc.documentName}
                      </span>

                      {doc.isRequired && (
                        <span className="mt-1 text-rose-500 font-semibold text-[11px]">
                          Required
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 📊 STATUS */}
                  <td className="px-5 py-4 text-center">
                    <span
                      className={`px-3 py-1 text-xs rounded-full ${
                        doc.status === "COMPLETED"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                          : doc.status === "PARTIAL"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                            : "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400"
                      }`}
                    >
                      {formatDocumentStatusLabel(doc.status)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    {(() => {
                      const sourceDisplay = getLenderDocumentSourceDisplay(doc);

                      return (
                        <span
                          title={sourceDisplay.label}
                          className={`inline-flex max-w-[180px] items-center justify-center truncate rounded-full px-3 py-1 text-[11px] font-semibold ${sourceDisplay.className}`}
                        >
                          {sourceDisplay.label}
                        </span>
                      );
                    })()}
                  </td>

                  {/* COUNT */}
                  <td className="px-5 py-4 text-center">
                    <span className="font-bold text-sm text-slate-700 dark:text-slate-200">
                      {doc.uploadedCount}
                    </span>
                  </td>

                  {/* ACTION  */}
                  <td className="px-5 py-4 text-right">
                    {doc.uploadedCount > 0 ? (
                      <button
                        onClick={() => {
                          if (doc.uploadedCount === 1) {
                            const file = doc.uploadedFiles[0];

                            setPreviewFile({
                              url: `${API_BASE}${file.fileUrl}`,
                              type: file.fileMimeType,
                              name: file.fileName,
                            });
                          } else {
                            setMultiFileModal({
                              isOpen: true,
                              doc,
                            });
                          }
                        }}
                        className="
        group inline-flex items-center gap-2
        rounded-xl border border-blue-200
        bg-gradient-to-r from-blue-50 to-indigo-50
        px-3 py-2
        text-blue-700
        transition-all duration-300
        hover:-translate-y-0.5
        hover:border-blue-500
        hover:bg-blue-600
  
        hover:shadow-md
        dark:border-blue-500/20
        dark:from-blue-500/10
        dark:to-indigo-500/10
        dark:text-blue-300
        dark:hover:bg-blue-500
      "
                      >
                        <Eye
                          size={14}
                          className="transition-transform duration-300 group-hover:scale-110"
                        />

                        <span className="text-[11px] font-semibold tracking-wide">
                          View
                          {doc.uploadedCount > 1 && ` (${doc.uploadedCount})`}
                        </span>
                      </button>
                    ) : (
                      <span
                        className="
        inline-flex items-center rounded-lg
        bg-slate-100 px-3 py-1.5
        text-[11px] font-medium italic
        text-slate-400
        dark:bg-slate-800
        dark:text-slate-500
      "
                      >
                        No Files
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}

          {documentsPagination && documentsPagination.totalPages > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Page{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {documentsPagination.page}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {documentsPagination.totalPages}
                </span>
                {documentsPagination.total != null && (
                  <span className="ml-1 text-slate-400">
                    ({documentsPagination.total} documents
                    {documentSearchInput.trim() || documentSourceFilter !== "all"
                      ? " found"
                      : ""})
                  </span>
                )}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={documentPage === 1}
                  onClick={() => setDocumentPage((current) => current - 1)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:disabled:border-slate-800 dark:disabled:bg-slate-800/50 dark:disabled:text-slate-600"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>

                {documentsPagination.totalPages > 1 &&
                  Array.from(
                    { length: documentsPagination.totalPages },
                    (_, index) => {
                      const pageNum = index + 1;

                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setDocumentPage(pageNum)}
                          className={`h-9 min-w-9 rounded-xl px-2.5 text-sm font-semibold transition ${
                            documentPage === pageNum
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
                  disabled={documentPage === documentsPagination.totalPages}
                  onClick={() => setDocumentPage((current) => current + 1)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:disabled:border-slate-800 dark:disabled:bg-slate-800/50 dark:disabled:text-slate-600"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };
  const handleClearCustomDocs = () => {
    setCustomDocs([]);
  };

  const renderRequestDocs = () => {
    return (
      <div
        className="mx-auto rounded-2xl p-6 space-y-6 
  bg-white dark:bg-slate-800/60
  border border-stroke dark:border-slate-700"
      >
        {/* LOAN PRODUCT SELECT */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500">
            LOAN PROGRAM
          </label>

          <div className="relative">
            <select
              value={selectedLoanProduct}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedLoanProduct(value);

                if (!value) {
                  setDocSelectModal({
                    documents: [],
                    selectedDocs: [],
                    loading: false,
                  });
                }
              }}
              disabled={loadingProducts}
              className="w-full px-4 py-2 text-sm rounded-xl border border-gray-200 bg-white 
    focus:ring-2 focus:ring-[#18B6B4] outline-none appearance-none
    disabled:bg-gray-100 disabled:cursor-not-allowed dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:disabled:bg-slate-700/50"
            >
              <option value="">
                {loadingProducts
                  ? "Loading loan products..."
                  : "Select loan program"}
              </option>

              {!loadingProducts &&
                loanProducts.map((lp) => (
                  <option key={lp.id} value={lp.loanProductCode}>
                    {lp.loanProduct?.name || lp.name}
                  </option>
                ))}
            </select>

            {/* RIGHT ICON */}
            <div className="absolute right-3 top-2.5 text-gray-400 flex items-center gap-2">
              {loadingProducts && (
                <Loader2 className="w-4 h-4 animate-spin text-[#18B6B4]" />
              )}
            </div>
          </div>
        </div>

        {/* HEADER */}
        {selectedLoanProduct && docSelectModal.documents.length > 0 && (
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Select Documents</h2>

            <div className="flex gap-2">
              <button
                onClick={() =>
                  setDocSelectModal((prev) => ({
                    ...prev,
                    selectedDocs:
                      prev.documents?.map(
                        (d: any) => d.documentTypeId || d.id,
                      ) || [],
                  }))
                }
                className="px-3 py-1.5 text-xs rounded-lg bg-[#0F766E] text-white dark:bg-[#0F766E]/80 dark:hover:bg-[#0F766E] transition-all"
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
                className="px-3 py-1.5 text-xs rounded-lg bg-red-600 text-white"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {selectedLoanProduct && (
          <p className="text-sm text-slate-500">
            Select configured documents or add custom document requests.
          </p>
        )}

        {/* 🔥 LOADING */}
        {docSelectModal.loading && (
          <div className="text-center py-10 text-slate-400">
            Loading documents...
          </div>
        )}

        {/* EMPTY */}
        {!docSelectModal.loading &&
          selectedLoanProduct &&
          docSelectModal.documents.length === 0 && (
            <div
              className="flex flex-col items-center justify-center py-12 px-6 text-center 
  border-2 border-dashed border-[#18B6B4]/40 rounded-2xl 
  bg-gradient-to-br from-[#e6f7f7] to-white 
  dark:from-slate-800 dark:to-slate-900"
            >
              {/* ICON */}
              <div className="w-14 h-14 rounded-full bg-[#18B6B4]/10 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-[#18B6B4]" />
              </div>

              {/* TITLE */}
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                No Documents Available
              </p>

              {/* SUBTEXT */}
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                There are no documents configured for the selected loan program.
              </p>
            </div>
          )}

        {/* DOCUMENT CARDS */}
        {!docSelectModal.loading &&
          selectedLoanProduct &&
          docSelectModal.documents.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto pr-1 dark:scrollbar-thumb-slate-700/80 dark:scrollbar-track-slate-800/50 scrollbar-thin scrollbar-thumb-rounded-full">
              {docSelectModal.documents.map((doc: any) => {
                const docId = doc.documentTypeId ?? doc.id ?? doc._id;
                if (!docId) return null;
                const isChecked =
                  docSelectModal.selectedDocs?.includes(docId) ?? false;

                return (
                  <div
                    key={docId}
                    onClick={() => {
                      const updated = isChecked
                        ? docSelectModal.selectedDocs.filter(
                            (id) => id !== docId,
                          )
                        : [
                            ...new Set([
                              ...(docSelectModal.selectedDocs || []),
                              docId,
                            ]),
                          ];

                      setDocSelectModal((prev) => ({
                        ...prev,
                        selectedDocs: updated,
                      }));
                    }}
                    className={`group flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-all duration-200
          ${
            isChecked
              ? "border-[#18B6B4] bg-[#e6f7f7]"
              : "border-gray-200 hover:border-[#18B6B4]"
          }`}
                  >
                    {/* LEFT */}
                    <div className="flex items-center gap-2 min-w-0">
                      {/* ICON */}
                      <div
                        className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0
              ${
                isChecked
                  ? "bg-[#18B6B4] text-white"
                  : "bg-blue-50 text-blue-500"
              }`}
                      >
                        <FileText size={16} />
                      </div>

                      {/* TEXT */}
                      <div className="min-w-0">
                        <div className="min-w-0">
                          {/* MAIN NAME (DOCUMENT NAME) */}
                          <p
                            className={`text-xs font-semibold text-gray-800 truncate dark:text-[#18B6B4]`}
                          >
                            {doc.documentName || doc.documentType?.name}
                          </p>

                          {/* SUB TEXT */}
                          <p className="text-[10px] text-gray-400 truncate">
                            {doc.documentType?.name}
                          </p>

                          {/* REQUIRED / OPTIONAL */}
                          {/* <p className="text-[9px] text-gray-400">
                            {doc.isRequired ? "Required" : "Optional"}
                          </p> */}
                        </div>
                      </div>
                    </div>

                    {/* RIGHT */}
                    <div className="flex items-center gap-2">
                      {/* {doc.isRequired && (
                        <span className="text-[9px] px-1.5 py-[2px] rounded bg-red-50 text-red-500 font-semibold">
                          Req
                        </span>
                      )} */}

                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition
              ${
                isChecked
                  ? "bg-[#18B6B4] border-[#18B6B4]"
                  : "border-gray-300 group-hover:border-[#18B6B4]"
              }`}
                      >
                        {isChecked && (
                          <Check size={10} className="text-white" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        <div className="space-y-3">
          {/* HEADER */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-purple-500 text-white text-xs flex items-center justify-center font-semibold">
                CD
              </div>
              <p className="text-xs font-semibold text-gray-500 tracking-wide">
                CUSTOM DOCUMENTS
              </p>
            </div>

            {/* CLEAR BUTTON (only when 3+ docs) */}
            {customDocs.length > 2 && (
              <button
                onClick={handleClearCustomDocs}
                className="text-[10px] px-2 py-1 rounded-md bg-red-50 text-red-600 font-semibold hover:bg-red-600 hover:text-white transition flex items-center gap-1"
              >
                Clear All
              </button>
            )}
          </div>

          {/* BOX */}
          <div className="border border-dashed border-gray-300 rounded-xl p-4 space-y-3 dark:border-slate-700">
            {/* EXISTING CUSTOM DOCS */}
            {customDocs.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {customDocs.map((doc, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full text-xs dark:text-slate-200 dark:bg-slate-700/50"
                  >
                    <span>{doc}</span>

                    <button
                      onClick={() => removeCustomDoc(index)}
                      className="text-red-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* INPUT + ADD */}
            <div className="flex items-center gap-2">
              <input
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomDoc();
                  }
                }}
                placeholder="Enter custom document..."
                className="flex-1 text-sm px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
              />

              <button
                onClick={handleAddCustomDoc}
                className="text-sm px-3 py-2 rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition"
              >
                + Add
              </button>
            </div>

            {/* EMPTY STATE */}
            {/* {customDocs.length === 0 && (
              <button
                onClick={handleAddCustomDoc}
                className="text-sm text-purple-600 font-medium hover:underline"
              >
                + Add Document
              </button>
            )} */}
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-between pt-4 border-t dark:border-slate-700">
          <p className="text-sm text-slate-500">
            {docSelectModal.selectedDocs?.length || 0} selected
          </p>

          <button
            onClick={handleRequestDocuments}
            disabled={
              requestLoading ||
              ((docSelectModal.selectedDocs?.length || 0) === 0 &&
                customDocs.length === 0)
            }
            className="px-5 py-2 rounded-xl bg-[#0F766E] text-white font-medium disabled:opacity-40"
          >
            {requestLoading ? "Requesting..." : "Request Documents"}
          </button>
        </div>
      </div>
    );
  };

  const renderLoi = () => {
    if (detailLoading && (loiGenerated || isLoi)) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 className="animate-spin w-8 h-8 text-blue-500" />
          <p className="text-sm text-slate-500">Loading LOI preview...</p>
        </div>
      );
    }

    if (loiGenerating || loiLoading) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 className="animate-spin w-8 h-8 text-blue-500" />
          <p className="text-sm text-slate-500">
            {loiGenerating
              ? "Generating Term Sheet / LOI from application data..."
              : "Loading LOI preview..."}
          </p>
        </div>
      );
    }

    if (!loiGenerated && !isLoi) {
      if (!canCreateLoi) {
        return (
          <div className="text-center py-16 text-slate-500">
            LOI has not been generated for this application yet.
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 flex items-center justify-center mb-4">
            <FileText size={28} />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
            Generate Term Sheet / LOI
          </h3>
          <p className="mt-2 max-w-lg text-sm text-slate-500">
            Application details auto-fill. Enter your credit decision and
            commercial terms, then generate the Term Sheet / LOI for the broker.
          </p>
          <button
            type="button"
            onClick={() => setLoiFormOpen(true)}
            disabled={loiGenerating || detailLoading}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition disabled:opacity-50"
          >
            <FileText size={16} />
            Enter Terms & Generate LOI
          </button>
        </div>
      );
    }

    if (!loiUrl) {
      return (
        <div className="text-center py-16 text-slate-500">
          LOI preview not available.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <button
            onClick={() => handleDownload(loiUrl, "Loan-LOI.pdf")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-sm font-semibold hover:bg-slate-200 transition"
          >
            <Download size={16} />
            Download
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 h-[70vh]">
          <iframe src={loiUrl} title="Loan LOI" className="w-full h-full" />
        </div>
      </div>
    );
  };

  if (!applicationLenderId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        Application preview not found.
      </div>
    );
  }

  const getFieldValue = (key: string) => {
    const value = getFieldValueFromList(submissionFields, key);
    if (value === undefined || value === null || value === "") return undefined;
    return value;
  };

  const formatMetricValue = (value: unknown, suffix = "") => {
    if (value === undefined || value === null || value === "") return "-";
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric === 0) {
      return String(value);
    }
    return `${numeric}${suffix}`;
  };

  const availableTabIds = new Set(
    visibleTabs
      .filter((tab) => tab.id !== "loi" || showLoiTab)
      .map((tab) => tab.id),
  );

  const getVisibleTabLabel = (id: PreviewTab, fallback: string) => {
    if (id === "loi") {
      return loiGenerated || isLoi
        ? "View LOI / Term Sheet"
        : "Generate LOI / Term Sheet";
    }
    return visibleTabs.find((tab) => tab.id === id)?.label || fallback;
  };

  const onlyAvailableTabs = (items: PreviewTabItem[]) =>
    items.filter((item) => availableTabIds.has(item.id));

  const previewTabSections: PreviewTabSection[] = [
    {
      id: "application",
      label: "Application",
      icon: ClipboardList,
      items: [
        {
          id: "details",
          label: getVisibleTabLabel("details", "View Details"),
          icon: Eye,
          color: "text-blue-600",
        },
      ],
    },
    {
      id: "documents",
      label: "Documents",
      icon: FolderOpen,
      items: onlyAvailableTabs([
        {
          id: "documents",
          label: getVisibleTabLabel("documents", "Uploaded Documents"),
          icon: Upload,
          color: "text-amber-600",
        },
        {
          id: "requestDocs",
          label: getVisibleTabLabel("requestDocs", "Request Documents"),
          icon: Send,
          color: "text-emerald-600",
          disabled: !canRequestDocuments,
          disabledReason:
            requestDocumentsDisabledReason ||
            "Documents cannot be requested for this application.",
        },
        {
          id: "signDocuments",
          label: getVisibleTabLabel(
            "signDocuments",
            "Upload Signable Forms / Documents",
          ),
          icon: FileText,
          color: "text-indigo-600",
        },
      ]),
    },
    {
      id: "communication",
      label: "Communication",
      icon: MessageSquare,
      items: [
        {
          id: "chat",
          label: getVisibleTabLabel("chat", "Chat"),
          icon: MessageSquare,
          color: "text-green-600",
        },
      ],
    },
    ...(availableTabIds.has("loi")
      ? [
          {
            id: "lender" as const,
            label: "Lender",
            icon: Building2,
            items: [
              {
                id: "loi" as const,
                label: getVisibleTabLabel("loi", "LOI / Term Sheet"),
                icon: FileText,
                color: "text-purple-600",
              },
            ],
          },
        ]
      : []),
  ];

  const activeSectionId =
    PREVIEW_SECTION_BY_TAB[activeTab] || ("application" as PreviewSectionId);
  const activeSection =
    previewTabSections.find((section) => section.id === activeSectionId) ||
    previewTabSections[0];

  const handleSectionChange = (section: PreviewTabSection) => {
    const firstEnabled =
      section.items.find((item) => !item.disabled) || section.items[0];
    if (firstEnabled) onTabChange(firstEnabled.id);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b1120] p-4 md:p-6 text-slate-900 dark:text-slate-100">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start justify-between flex-wrap gap-4">
            {/* LEFT SIDE */}
            <div className="flex items-start gap-3">
              {/* Back Button */}
              <button
                onClick={() => navigate(-1)}
                className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#18B6B4] transition-all"
              >
                <ArrowLeft size={18} />
              </button>

              {/* Title Section */}
              <div>
                <h1 className="text-xl font-bold text-slate-800 dark:text-white">
                  Loan Application Preview
                </h1>

                {/* Application ID */}
                <p className="text-xs text-slate-500 mt-1">
                  {submissionDetail?.loanApplication?.applicationNumber}
                </p>
                <p className="text-md text-slate-800 mt-1 font-bold">
                  Borrower: {getBorrowerDisplayName(submissionDetail, submissionFields)}
                  {/* {" • "}
                  {getBorrowerEntityType(submissionDetail)} */}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h1 className="text-xs bg-gray-100 border-2 px-2 py-1 rounded-md text-purple-700 font-semibold">
              {submissionDetail && submissionDetail?.status}
            </h1>
          </div>
        </div>

        <div>
          {submissionDetail?.loanApplication?.brokerOrg && (
            <div className="flex flex-wrap items-center gap-3 mt-3">
              {/* BROKER NAME CHIP */}
              <div
                className="flex items-center gap-3 px-4 py-2 rounded-xl border
    bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200
    dark:from-blue-900/30 dark:to-blue-800/20 dark:border-blue-800"
              >
                <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                  <User size={14} />
                </div>

                <div className="flex flex-col leading-tight">
                  <span
                    className="text-[10px] uppercase tracking-wide font-semibold
        text-blue-500 dark:text-blue-400"
                  >
                    Broker Name
                  </span>
                  <span
                    className="text-sm font-semibold
        text-blue-900 dark:text-blue-100"
                  >
                    {submissionDetail.loanApplication.brokerOrg.name}
                  </span>
                </div>
              </div>

              {/* EMAIL CHIP */}
              <div
                className="flex items-center gap-3 px-4 py-2 rounded-xl border
    bg-gradient-to-r from-emerald-50 to-emerald-100 border-emerald-200
    dark:from-emerald-900/30 dark:to-emerald-800/20 dark:border-emerald-800"
              >
                <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs">
                  <MdEmail />
                </div>

                <div className="flex flex-col leading-tight">
                  <span
                    className="text-[10px] uppercase tracking-wide font-semibold
        text-emerald-500 dark:text-emerald-400"
                  >
                    Email
                  </span>
                  <span
                    className="text-sm font-medium
        text-emerald-900 dark:text-emerald-100"
                  >
                    {submissionDetail.loanApplication.brokerOrg.email}
                  </span>
                </div>
              </div>

              {/* LOAN PRODUCT */}
              <div
                className="flex items-center gap-3 px-4 py-2 rounded-xl border
    bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200
    dark:from-purple-900/30 dark:to-purple-800/20 dark:border-purple-800"
              >
                <div className="w-7 h-7 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">
                  <BiLogoProductHunt size={14} />
                </div>

                <div className="flex flex-col leading-tight">
                  <span
                    className="text-[10px] uppercase tracking-wide font-semibold
        text-purple-500 dark:text-purple-400"
                  >
                    Loan Product
                  </span>
                  <span
                    className="text-sm font-semibold
        text-purple-900 dark:text-purple-100"
                  >
                    {submissionDetail.loanProduct?.name ||
                      PRODUCT_LABELS[
                        submissionDetail.loanApplication.loanProductCode
                      ] ||
                      submissionDetail.loanApplication.loanProductCode
                        ?.replace(/_/g, " ")
                        .toUpperCase()}
                  </span>
                </div>
              </div>

              {/* LOAN AMOUNT */}
              <div
                className="flex items-center gap-3 px-4 py-2 rounded-xl border
  bg-gradient-to-r from-orange-50 to-amber-100 border-orange-200
  dark:from-orange-900/30 dark:to-amber-800/20 dark:border-orange-800"
              >
                <div
                  className="w-7 h-7 rounded-full bg-orange-500 text-white
    flex items-center justify-center text-xs"
                >
                  <FaDollarSign />
                </div>

                <div className="flex flex-col leading-tight">
                  <span
                    className="text-[10px] uppercase tracking-wide font-semibold
      text-orange-500 dark:text-orange-400"
                  >
                    Loan Amount Requested
                  </span>

                  <span
                    className="text-sm font-medium
      text-orange-900 dark:text-orange-100"
                  >
                    {loanAmount
                      ? `$${Number(loanAmount).toLocaleString()}`
                      : "-"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {submissionDetail && (
          <div
            className="mb-6 overflow-hidden rounded-[30px] border border-white/30 
            bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.24),_transparent_28%),linear-gradient(135deg,_#1d4ed8_0%,_#0f766e_55%,_#0891b2_100%)] 
            px-6 py-8 text-white"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
              <Metric
                label="Monthly Payment"
                value={monthlyPaymentDisplay}
              />

              <Metric
                label="LTV"
                value={
                  ltv
                    ? `${ltv.toFixed(2)}%`
                    : `${formatMetricValue(getFieldValue("ltvPercentage"), "%")}`
                }
              />

              <Metric
                label="LTC"
                value={
                  ltc
                    ? `${ltc.toFixed(2)}%`
                    : `${formatMetricValue(getFieldValue("ltcPercentage"), "%")}`
                }
              />

              <Metric
                label="ARV %"
                value={
                  arv
                    ? `${arv.toFixed(2)}%`
                    : `${formatMetricValue(getFieldValue("arvPercentage"), "%")}`
                }
              />

              <Metric
                label="DSCR RATIO"
                value={
                  dscr
                    ? dscr.toFixed(2)
                    : formatMetricValue(getFieldValue("dscr"))
                }
              />

              <Metric
                label="NET WORTH"
                value={
                  netWorth
                    ? `$${Number(netWorth).toLocaleString()}`
                    : `$${formatMetricValue(getFieldValue("netWorth"))}`
                }
              />
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <nav aria-label="Loan preview sections">
            {/* Primary sections */}
            <div className="grid grid-cols-2 gap-1.5 bg-slate-50/80 p-2 sm:grid-cols-4 dark:bg-slate-950/50">
              {previewTabSections.map((section) => {
                const SectionIcon = section.icon;
                const isSectionActive = section.id === activeSectionId;

                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => handleSectionChange(section)}
                    aria-current={isSectionActive ? "page" : undefined}
                    className={`group relative flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                      isSectionActive
                        ? "bg-[#104340] text-white shadow-md shadow-[#104340]/20"
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
                          isSectionActive ? "text-white/75" : "text-slate-400"
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

            {/* Secondary tabs */}
            <div className="border-y border-slate-200 px-3 py-2.5 dark:border-slate-800">
              <div className="flex items-center gap-3 overflow-x-auto">
                <span className="hidden shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:block">
                  {activeSection.label}
                </span>
                <span className="hidden h-5 w-px shrink-0 bg-slate-200 sm:block dark:bg-slate-700" />

                {activeSection.items.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  const isDisabled = Boolean(tab.disabled);

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      disabled={isDisabled}
                      title={isDisabled ? tab.disabledReason : undefined}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => {
                        if (!isDisabled) onTabChange(tab.id);
                      }}
                      className={`group inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                        isActive
                          ? "bg-[#104340] text-white shadow-sm dark:bg-[#104340] dark:text-white"
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
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>

          <div className="p-4 md:p-6">
            {activeTab === "details" && renderDetails()}
            {activeTab === "documents" && renderDocuments()}
            {activeTab === "signDocuments" && (
              <SignDocumentsPanel
                mode="lender"
                apiBase={API_BASE}
                readOnly={!canUploadSignDocuments()}
                getAuthHeaders={() =>
                  Object.fromEntries(
                    Object.entries(getAuthHeaders() as Record<string, string>),
                  )
                }
                applicationLenderId={applicationLenderId}
              />
            )}
            {activeTab === "requestDocs" && renderRequestDocs()}
            {activeTab === "loi" && renderLoi()}
            {activeTab === "chat" && renderChat()}
          </div>
        </div>
      </div>

      {multiFileModal.isOpen &&
        multiFileModal.doc &&
        createPortal(
          <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[80vh]">
              <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-800">
                <div>
                  <h2 className="text-lg font-bold">Select File to Preview</h2>
                  <p className="text-xs text-slate-500">
                    {multiFileModal.doc.documentName ||
                      multiFileModal.doc.documentType?.name ||
                      "Document"}{" "}
                    ({multiFileModal.doc.uploadedCount} uploads)
                  </p>
                </div>
                <button
                  onClick={() =>
                    setMultiFileModal({ isOpen: false, doc: null })
                  }
                  className="text-sm px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                >
                  Back
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {multiFileModal.doc.uploadedFiles?.map((file: any) => (
                    <div
                      key={file.uploadId}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-blue-500 transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400">
                          <FileIcon size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-semibold truncate"
                            title={file.fileName}
                          >
                            {file.fileName}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-1 uppercase">
                            {file.fileMimeType?.split("/")[1] || "FILE"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() =>
                            setPreviewFile({
                              url: `${API_BASE}${file.fileUrl}`,
                              type: file.fileMimeType,
                              name: file.fileName,
                            })
                          }
                          className="flex-1 py-2 text-xs font-bold bg-blue-50 text-blue-600 dark:bg-blue-600/10 dark:text-blue-400 rounded-lg hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-1"
                        >
                          <Eye size={14} /> Preview
                        </button>
                        <button
                          onClick={() =>
                            handleDownload(
                              `${API_BASE}${file.fileUrl}`,
                              file.fileName,
                            )
                          }
                          className="p-2 bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded-lg hover:bg-slate-200 transition-all"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {previewFile &&
        createPortal(
          <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl flex flex-col h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-800 shrink-0">
                <div>
                  <h2 className="text-lg font-bold truncate max-w-md dark:text-white">
                    {previewFile.name}
                  </h2>
                  <p className="text-xs text-slate-500">{previewFile.type}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      handleDownload(previewFile.url, previewFile.name)
                    }
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-sm font-semibold hover:bg-slate-200 transition"
                  >
                    <Download size={16} />
                    Download
                  </button>
                  <button
                    onClick={() => setPreviewFile(null)}
                    className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-4 overflow-hidden">
                {previewFile.type.startsWith("image/") ? (
                  <img
                    src={previewFile.url}
                    alt={previewFile.name}
                    className="max-w-full max-h-full object-contain rounded-lg"
                  />
                ) : previewFile.type === "application/pdf" ? (
                  <iframe
                    src={previewFile.url}
                    title={previewFile.name}
                    className="w-full h-full rounded-lg border-none"
                  />
                ) : (
                  <div className="text-center space-y-4">
                    <div className="w-20 h-20 bg-slate-200 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto">
                      <FileIcon size={40} className="text-slate-400" />
                    </div>
                    <p className="text-slate-500">
                      Preview not available for this file type.
                    </p>
                    <button
                      onClick={() =>
                        handleDownload(previewFile.url, previewFile.name)
                      }
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition"
                    >
                      <Download size={18} />
                      Download instead
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {createPortal(
        <LoiUnderwritingFormModal
          isOpen={loiFormOpen}
          requestedAmount={loanAmount}
          propertyValue={
            getNumericFieldValue(submissionFields, "currentMarketValue") ||
            getNumericFieldValue(submissionFields, "purchasePrice") ||
            getNumericFieldValue(submissionFields, "afterRepairValue") ||
            null
          }
          projectCost={
            (() => {
              const total =
                getNumericFieldValue(submissionFields, "totalProjectCost") ||
                getNumericFieldValue(submissionFields, "projectCost");
              if (total) return total;
              const purchase =
                getNumericFieldValue(submissionFields, "purchasePrice") || 0;
              const rehab =
                getNumericFieldValue(submissionFields, "rehabCost") ||
                getNumericFieldValue(submissionFields, "rehabBudget") ||
                getNumericFieldValue(submissionFields, "constructionBudget") ||
                0;
              const combined = purchase + rehab;
              return combined > 0 ? combined : null;
            })()
          }
          submitting={loiGenerating}
          onClose={() => setLoiFormOpen(false)}
          onSubmit={handleGenerateLOI}
        />,
        document.body,
      )}
    </div>
  );
}
