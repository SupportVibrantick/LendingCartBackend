import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import {
  ArrowLeft,
  Check,
  CheckCircle,
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
  Plus,
  RotateCcw,
  Search,
  SearchX,
  Send,
  Upload,
  User,
  ChevronDown,
  XCircle,
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
  buildDocumentRequestHistoryByTypeId,
  buildRequestedDocumentsList,
  formatDocumentTimelineDate,
  getDocumentRequestDisplay,
} from "../../lib/documentRequestMeta";
import {
  canLenderRequestDocuments,
  canLenderTakeDecision,
  canShowRejectAction,
  formatLoanProduct,
  getLenderRequestDocumentsDisabledReason,
  normalizeLenderDecision,
} from "../../lib/loanPipelineUtils";
import { resolveLenderOfferedProductCode } from "../../lib/lenderLoanProducts";
import {
  isAgencyMultifamilyProduct,
  isApSupplyChainProduct,
  isArFactoringProduct,
  isBridgeLoanProduct,
  isCmbsProduct,
  isConstructionLoanProduct,
  isCrePermanentProduct,
  isDscrRentalProduct,
  isEquipmentFinanceProduct,
  isFixAndFlipProduct,
  isMezzanineProduct,
  isPreferredEquityProduct,
  isPurchaseOrderFinanceProduct,
  isRentalPortfolioProduct,
  isSba504Product,
  isSba7aBusinessAcquisitionProduct,
  isSba7aEquipmentPurchaseProduct,
  isSba7aRealEstateProduct,
  isSba7aWorkingCapitalProduct,
  isSbaExpressProduct,
  isUsdaBiProduct,
} from "../../lib/loanProductCriteriaFields";
import {
  canDecideApplications,
  canGenerateLoi,
  canRequestDocuments,
  canUploadSignDocuments,
} from "../../lib/lenderPermissions";
import LenderSubmissionDetailsView from "../../components/submissions/LenderSubmissionDetailsView";
import {
  fetchLenderBrandingForPdf,
  type PdfBranding,
} from "../../lib/applicationDetailsPdf";
import SignDocumentsPanel from "../../components/documents/SignDocumentsPanel";
import { buildApiPublicFileUrl } from "../../lib/publicFileUrl";
import {
  formatNumberInputValue,
  sanitizeNumberInput,
  stripNumberFormatting,
} from "../../lib/numberInputFormat";
import {
  getNumericFieldValue,
  getLatestSubmission,
  mapLenderSubmissionFields,
  parseSubmissionFieldValue,
  type SubmissionDetailField,
} from "../../lib/submissionFieldUtils";

type PreviewTab = "details" | "documents" | "signDocuments" | "requestDocs" | "loi" | "chat";
type DocumentSourceFilter = "all" | "mine" | "broker";
type PreviewSectionId = "application" | "documents" | "communication";

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
  loi: "documents",
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

function isSameLoanProgramCode(a?: string | null, b?: string | null) {
  if (!a || !b) return false;
  if (a === b) return true;

  const canonicalA = resolveLenderOfferedProductCode(a);
  const canonicalB = resolveLenderOfferedProductCode(b);
  if (canonicalA === canonicalB) return true;

  const familyChecks = [
    isFixAndFlipProduct,
    isDscrRentalProduct,
    isBridgeLoanProduct,
    isConstructionLoanProduct,
    isRentalPortfolioProduct,
    isCrePermanentProduct,
    isCmbsProduct,
    isAgencyMultifamilyProduct,
    isMezzanineProduct,
    isPreferredEquityProduct,
    isSba7aBusinessAcquisitionProduct,
    isSba7aWorkingCapitalProduct,
    isSba7aEquipmentPurchaseProduct,
    isSba7aRealEstateProduct,
    isSbaExpressProduct,
    isSba504Product,
    isUsdaBiProduct,
    isPurchaseOrderFinanceProduct,
    isEquipmentFinanceProduct,
    isArFactoringProduct,
    isApSupplyChainProduct,
  ];

  return familyChecks.some((check) => check(a) && check(b));
}

function sanitizeInterestRateInput(value: string): string {
  const cleaned = sanitizeNumberInput(value, { decimal: true });
  if (!cleaned) return "";
  if (cleaned === ".") return "0.";

  const [intPart = "", decPart] = cleaned.split(".");
  const limitedInt = intPart.slice(0, 3);

  if (decPart !== undefined) {
    return `${limitedInt}.${decPart.slice(0, 2)}`;
  }

  return limitedInt;
}

function getInterestRateValidationError(value: string): string | undefined {
  const raw = stripNumberFormatting(value).trim();

  if (!raw || raw === ".") {
    return "Interest rate is required";
  }

  const num = Number(raw);
  if (!Number.isFinite(num)) {
    return "Enter a valid interest rate";
  }

  if (num <= 0) {
    return "Interest rate must be greater than 0";
  }

  if (num > 100) {
    return "Interest rate cannot exceed 100%";
  }

  const decimalPart = raw.split(".")[1];
  if (decimalPart && decimalPart.length > 2) {
    return "Use up to 2 decimal places (e.g. 7.25)";
  }

  return undefined;
}

type DecisionFormErrors = {
  approvedAmount?: string;
  interestRate?: string;
  notes?: string;
};

function getSwalTheme() {
  const isDark = document.documentElement.classList.contains("dark");

  return {
    background: isDark ? "#1e293b" : "#ffffff",
    color: isDark ? "#e2e8f0" : "#1e293b",
    customClass: {
      popup: "rounded-2xl",
    },
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
  const [loiSendingToBroker, setLoiSendingToBroker] = useState(false);
  const [loiVersions, setLoiVersions] = useState<
    Array<{
      id: string;
      versionNumber: number;
      label: string;
      loiUrl: string;
      status: string;
      sentToBrokerAt?: string | null;
      isCurrent?: boolean;
    }>
  >([]);
  const [loiUrl, setLoiUrl] = useState<string | null>(null);
  const [signedBrokerLoi, setSignedBrokerLoi] = useState<any>(null);
  const [signedBrokerLoiUrl, setSignedBrokerLoiUrl] = useState<string | null>(
    null,
  );
  const [loiViewMode, setLoiViewMode] = useState<"lender" | "signed-broker">(
    "lender",
  );
  const loadedSignedBrokerLoiFileRef = useRef<string | null>(null);
  const [loanProducts, setLoanProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedLoanProduct, setSelectedLoanProduct] = useState("");
  const [newDocName, setNewDocName] = useState("");
  const [newDocRequired, setNewDocRequired] = useState(true);
  const [addingDocument, setAddingDocument] = useState(false);
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
  const [isRequestedDocsCollapsed, setIsRequestedDocsCollapsed] = useState(true);
  const canDecide = useMemo(() => canDecideApplications(), []);
  const [decisionModal, setDecisionModal] = useState<{
    type: "APPROVED" | "DECLINED" | null;
  }>({ type: null });
  const [decisionForm, setDecisionForm] = useState({
    approvedAmount: "",
    interestRate: "",
    notes: "",
  });
  const [decisionFormErrors, setDecisionFormErrors] =
    useState<DecisionFormErrors>({});
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);
  const [pdfBranding, setPdfBranding] = useState<PdfBranding | null>(null);

  useEffect(() => {
    fetchLenderBrandingForPdf().then(setPdfBranding);
  }, []);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!location.state?.openLoiForm || !applicationLenderId) return;
    navigate("/loi-form", {
      replace: true,
      state: {
        applicationLenderId,
        mode: location.state?.loiFormMode || "create",
        revisedVersionNumber: location.state?.revisedVersionNumber,
      },
    });
  }, [location.state, applicationLenderId, navigate]);

  useEffect(() => {
    return () => {
      if (loiUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(loiUrl);
      }
    };
  }, [loiUrl]);

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

      const res = await fetch(
        `${API_BASE}/lender/loan-products/list?limit=100`,
        {
          headers: getAuthHeaders(),
        },
      );

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

  const applicationLoanProductCode = useMemo(
    () =>
      String(
        submissionDetail?.loanApplication?.loanProductCode ||
          submissionDetail?.loanProduct?.code ||
          "",
      ).trim(),
    [submissionDetail],
  );

  const defaultLoanProductCode = useMemo(() => {
    if (!applicationLoanProductCode || !loanProducts.length) return "";

    const matched = loanProducts.find((product) =>
      isSameLoanProgramCode(
        applicationLoanProductCode,
        product.loanProductCode || product.loanProduct?.code || product.code,
      ),
    );

    return String(
      matched?.loanProductCode ||
        matched?.loanProduct?.code ||
        matched?.code ||
        "",
    );
  }, [applicationLoanProductCode, loanProducts]);

  const isApplicationDefaultSelected =
    Boolean(selectedLoanProduct) &&
    Boolean(defaultLoanProductCode) &&
    isSameLoanProgramCode(selectedLoanProduct, defaultLoanProductCode);

  const selectedLenderProduct = useMemo(() => {
    if (!selectedLoanProduct) return null;
    return (
      loanProducts.find((product) =>
        isSameLoanProgramCode(
          selectedLoanProduct,
          product.loanProductCode || product.loanProduct?.code || product.code,
        ),
      ) || null
    );
  }, [loanProducts, selectedLoanProduct]);

  const selectedLenderProductId = selectedLenderProduct?.id
    ? String(selectedLenderProduct.id)
    : "";

  const fetchDocumentsByProduct = async (
    code: string,
    options?: {
      preserveSelection?: boolean;
      selectIds?: string[];
    },
  ) => {
    try {
      setDocSelectModal((prev) => ({ ...prev, loading: true }));

      const matchedProduct =
        loanProducts.find((product) =>
          isSameLoanProgramCode(
            code,
            product.loanProductCode || product.loanProduct?.code || product.code,
          ),
        ) || null;

      const params = new URLSearchParams({ limit: "100" });
      if (matchedProduct?.id) {
        params.set("lenderProductId", String(matchedProduct.id));
      } else {
        params.set("loanProductCode", code);
      }

      const res = await fetch(
        `${API_BASE}/lender/document-config/list?${params.toString()}`,
        {
          headers: getAuthHeaders(),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error("Failed to load documents");
        setDocSelectModal((prev) => ({ ...prev, loading: false }));
        return;
      }

      const documents = Array.isArray(json.data) ? json.data : [];
      const availableIds = new Set(
        documents
          .map((doc: any) => doc.documentTypeId || doc.id)
          .filter(Boolean)
          .map(String),
      );

      setDocSelectModal((prev) => {
        const preserved = options?.preserveSelection
          ? (prev.selectedDocs || []).filter((id) => availableIds.has(String(id)))
          : [];
        const extra = (options?.selectIds || []).filter((id) =>
          availableIds.has(String(id)),
        );

        return {
          ...prev,
          documents,
          selectedDocs: [...new Set([...preserved, ...extra])],
          loading: false,
        };
      });
    } catch (err) {
      console.error(err);
      setDocSelectModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleAddProductDocument = async () => {
    const name = newDocName.trim();
    if (!selectedLoanProduct) {
      toast.error("Please select a loan program first");
      return;
    }
    if (!selectedLenderProductId) {
      toast.error(
        "This loan program is not available on your account. Assign the product first.",
      );
      return;
    }
    if (name.length < 2) {
      toast.error("Document name must be at least 2 characters");
      return;
    }

    try {
      setAddingDocument(true);

      const res = await fetch(`${API_BASE}/lender/document-config/create`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          lenderProductId: selectedLenderProductId,
          customDocumentName: name,
          isRequired: newDocRequired,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to add document");
      }

      const createdTypeId = String(
        json?.data?.documentTypeId || json?.data?.documentType?.id || "",
      );

      setNewDocName("");
      setNewDocRequired(true);
      toast.success("Document added to this loan program");

      await fetchDocumentsByProduct(selectedLoanProduct, {
        preserveSelection: true,
        selectIds: createdTypeId ? [createdTypeId] : [],
      });
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to add document");
    } finally {
      setAddingDocument(false);
    }
  };

  useEffect(() => {
    if (!selectedLoanProduct) {
      setDocSelectModal({
        documents: [],
        selectedDocs: [],
        loading: false,
      });
      setNewDocName("");
      setNewDocRequired(true);
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
    setSelectedLoanProduct("");
    setDocSelectModal({
      documents: [],
      selectedDocs: [],
      loading: false,
    });
    setSignedBrokerLoi(null);
    setLoiViewMode("lender");
    setLoiUrl((prev) => {
      if (prev?.startsWith("blob:")) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
    setSignedBrokerLoiUrl((prev) => {
      if (prev?.startsWith("blob:")) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
    loadedSignedBrokerLoiFileRef.current = null;
  }, [applicationLenderId]);

  const canCreateLoi = useMemo(() => canGenerateLoi(), []);
  const loiGenerated = Boolean(submissionDetail?.loiUrl);
  const loiSentToBroker = Boolean(submissionDetail?.loiSentToBrokerAt);
  const currentLoiVersion = loiVersions.find((v) => v.isCurrent);
  const nextRevisedVersionNumber =
    (loiVersions.reduce(
      (max, v) => Math.max(max, v.versionNumber || 0),
      0,
    ) || 0) + 1;
  const currentLoiIsDraft = currentLoiVersion
    ? currentLoiVersion.status === "DRAFT"
    : !loiSentToBroker;
  const hasSignedBrokerLoi = Boolean(signedBrokerLoi?.signedUpload?.fileUrl);
  const showLoiTab =
    canCreateLoi || loiGenerated || Boolean(isLoi) || hasSignedBrokerLoi;

  const resolvedLoanProductName = useMemo(() => {
    const code = submissionDetail?.loanApplication?.loanProductCode;
    if (submissionDetail?.loanProduct?.name) {
      return submissionDetail.loanProduct.name;
    }

    const matchedProduct = loanProducts.find(
      (product) => product.loanProductCode === code,
    );
    if (matchedProduct?.loanProduct?.name || matchedProduct?.name) {
      return matchedProduct.loanProduct?.name || matchedProduct.name;
    }

    return formatLoanProduct(code);
  }, [submissionDetail, loanProducts]);

  const fetchLoiVersions = async () => {
    if (!applicationLenderId) return;

    try {
      const res = await fetch(
        `${API_BASE}/lender/loan-pipeline/${applicationLenderId}/loi-versions`,
        { headers: getAuthHeaders() },
      );
      const json = await res.json();
      if (res.ok && json.success) {
        setLoiVersions(json.data?.versions || []);
      }
    } catch {
      /* optional */
    }
  };

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
      void fetchLoiVersions();
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

  const requestDocHistoryByTypeId = useMemo(
    () => buildDocumentRequestHistoryByTypeId(documentsData?.documents || []),
    [documentsData?.documents],
  );

  const requestedDocumentsList = useMemo(
    () => buildRequestedDocumentsList(documentsData?.documents || []),
    [documentsData?.documents],
  );

  const fetchDocuments = async (options?: { limit?: number }) => {
    if (!applicationLenderId) return;
    try {
      setDocumentsLoading(true);

      const params = new URLSearchParams({
        page: String(documentPage),
        limit: String(options?.limit ?? 10),
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

  const handleRequestDocuments = async () => {
    if (!canRequestDocuments) {
      toast.error(
        requestDocumentsDisabledReason ||
          "Documents cannot be requested for this application.",
      );
      return;
    }

    if (!selectedLoanProduct) {
      toast.error("Please select a loan program");
      return;
    }

    if ((docSelectModal.selectedDocs?.length || 0) === 0) {
      toast.error("Please select at least one document");
      return;
    }

    try {
      setRequestLoading(true);

      const payload = {
        decision: "CONDITIONAL",
        notes: "Please upload required documents",
        documentTypeIds: docSelectModal.selectedDocs,
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

      setDocSelectModal((prev) => ({
        ...prev,
        selectedDocs: [],
      }));

      setNewDocName("");
      setNewDocRequired(true);

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

  const loadSignedBrokerLoiPreview = async (fileUrl: string, force = false) => {
    if (
      !force &&
      loadedSignedBrokerLoiFileRef.current === fileUrl &&
      signedBrokerLoiUrl
    ) {
      return;
    }

    const resolved = buildApiPublicFileUrl(API_BASE, fileUrl);
    if (!resolved) {
      throw new Error("Signed broker LOI file URL missing");
    }

    const fileRes = await fetch(resolved, {
      headers: getAuthHeaders(),
    });

    if (!fileRes.ok) {
      throw new Error("Failed to load signed broker LOI file");
    }

    const blob = await fileRes.blob();
    const blobUrl = URL.createObjectURL(blob);

    loadedSignedBrokerLoiFileRef.current = fileUrl;

    setSignedBrokerLoiUrl((prev) => {
      if (prev?.startsWith("blob:")) {
        URL.revokeObjectURL(prev);
      }
      return blobUrl;
    });
  };

  const loadLoiPreview = async (loiPath?: string, force = false) => {
    if (!applicationLenderId) return;

    try {
      setLoiLoading(true);

      let resolvedPath = loiPath;

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

      const nextSignedBrokerLoi = json.data?.signedBrokerLoi || null;
      const nextSignedFileUrl =
        nextSignedBrokerLoi?.signedUpload?.fileUrl || null;

      setSignedBrokerLoi(nextSignedBrokerLoi);

      const signedFileChanged =
        nextSignedFileUrl &&
        loadedSignedBrokerLoiFileRef.current !== nextSignedFileUrl;

      if (nextSignedFileUrl && (force || signedFileChanged || !signedBrokerLoiUrl)) {
        await loadSignedBrokerLoiPreview(nextSignedFileUrl, force || signedFileChanged);
        if (!json.data?.loiPath) {
          setLoiViewMode("signed-broker");
        } else if (force || loiViewMode === "signed-broker") {
          setLoiViewMode("signed-broker");
        }
      }

      if (!json.data?.loiPath) {
        if (nextSignedFileUrl) {
          return;
        }
        // No LOI file yet — empty generate CTA handles UX; don't toast.
        return;
      }

      if (!force && loiUrl && !signedFileChanged) {
        return;
      }

      resolvedPath = json.data.loiPath;

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
      const message = err?.message || "Failed to load LOI";
      const isExpectedMissing =
        /not generated yet/i.test(message) ||
        /LOI not generated/i.test(message) ||
        /not found/i.test(message);

      if (
        !isExpectedMissing &&
        !signedBrokerLoi?.signedUpload?.fileUrl
      ) {
        toast.error(message);
      }
    } finally {
      setLoiLoading(false);
    }
  };

  const handleSendLoiToBroker = async () => {
    if (!applicationLenderId) return;

    try {
      setLoiSendingToBroker(true);

      const res = await fetch(
        `${API_BASE}/lender/loan-pipeline/${applicationLenderId}/send-loi-to-broker`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({}),
        },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to send LOI to broker");
      }

      toast.success("LOI sent to broker successfully");
      setSubmissionDetail((prev: any) =>
        prev
          ? {
              ...prev,
              loiSentToBrokerAt:
                json.data?.loiSentToBrokerAt || new Date().toISOString(),
            }
          : prev,
      );
      void fetchLoiVersions();
    } catch (err: any) {
      toast.error(err.message || "Failed to send LOI to broker");
    } finally {
      setLoiSendingToBroker(false);
    }
  };

  const openCreateLoiForm = () => {
    navigate("/loi-form", {
      state: {
        applicationLenderId,
        mode: "create",
      },
    });
  };

  const openRegenerateLoiForm = async () => {
    setLoiViewMode("lender");
    navigate("/loi-form", {
      state: {
        applicationLenderId,
        mode: "regenerate",
      },
    });
  };

  const openRevisedLoiForm = async () => {
    const result = await Swal.fire({
      title: `Create Revised LOI (Version ${nextRevisedVersionNumber})?`,
      html: "Previous LOI versions are preserved for audit. A new version will be created and must be sent to the broker again.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Create Revised LOI",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#7C3AED",
    });

    if (!result.isConfirmed) return;

    setLoiViewMode("lender");
    navigate("/loi-form", {
      state: {
        applicationLenderId,
        mode: "revised",
        revisedVersionNumber: nextRevisedVersionNumber,
      },
    });
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

    if (activeTab === "requestDocs") {
      fetchDocuments({ limit: 100 });
    }

    if (activeTab === "loi" && (loiGenerated || isLoi || hasSignedBrokerLoi)) {
      // Only force-refresh after a successful generate; cancel/back must not hammer view-loi.
      void loadLoiPreview(undefined, Boolean(location.state?.refreshLoi));
    } else if (
      activeTab === "loi" &&
      !loiGenerated &&
      !isLoi &&
      !hasSignedBrokerLoi
    ) {
      // Returning from create form without generating — clear stale blob preview.
      setLoiUrl((prev) => {
        if (prev?.startsWith("blob:")) {
          URL.revokeObjectURL(prev);
        }
        return null;
      });
    }
  }, [
    activeTab,
    applicationLenderId,
    documentPage,
    documentSearchInput,
    documentSourceFilter,
    loiGenerated,
    isLoi,
    hasSignedBrokerLoi,
    location.state?.refreshLoi,
  ]);

  useEffect(() => {
    if (!location.state?.refreshLoi || !applicationLenderId) return;

    let cancelled = false;

    (async () => {
      await fetchLenderApplicationDetail();
      if (cancelled) return;
      await fetchLoiVersions();
      if (cancelled) return;
      await loadLoiPreview(undefined, true);
      if (cancelled) return;
      navigate("/loan-preview/?tab=loi", {
        replace: true,
        state: {
          applicationLenderId,
          initialTab: "loi",
          isLoi: true,
        },
      });
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally bind to refresh flag only; helpers close over latest render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.refreshLoi, applicationLenderId]);

  const latestLenderReview = submissionDetail?.lenderReviews?.[0];
  const latestReviewStatus =
    latestLenderReview?.reviewStatus || latestLenderReview?.decision || null;

  const canRequestDocuments = useMemo(() => {
    if (!submissionDetail) return false;

    return canLenderRequestDocuments(
      submissionDetail.status,
      latestReviewStatus,
      loiGenerated,
    );
  }, [submissionDetail, latestReviewStatus, loiGenerated]);

  const requestDocumentsDisabledReason = useMemo(
    () =>
      getLenderRequestDocumentsDisabledReason(
        submissionDetail?.status,
        latestReviewStatus,
        loiGenerated,
      ),
    [submissionDetail?.status, latestReviewStatus, loiGenerated],
  );

  const canTakeDecision = useMemo(
    () =>
      canLenderTakeDecision({
        applicationStatus: submissionDetail?.loanApplication?.status,
        lenderStatus: submissionDetail?.status,
        lenderDecision: latestReviewStatus,
      }),
    [submissionDetail, latestReviewStatus],
  );

  const showApproval = useMemo(
    () =>
      canShowRejectAction({
        lenderDecision: latestReviewStatus,
        canDecide,
        canTakeDecision,
      }),
    [latestReviewStatus, canDecide, canTakeDecision],
  );

  const approvalButtonLabel =
    normalizeLenderDecision(latestReviewStatus) === "CONDITIONAL"
      ? "Final Approval"
      : "Approve";

  const showReject = useMemo(
    () =>
      canShowRejectAction({
        lenderDecision: latestReviewStatus,
        canDecide,
        canTakeDecision,
      }),
    [latestReviewStatus, canDecide, canTakeDecision],
  );

  const closeDecisionModal = () => {
    setDecisionModal({ type: null });
    setDecisionForm({
      approvedAmount: "",
      interestRate: "",
      notes: "",
    });
    setDecisionFormErrors({});
    setDecisionSubmitting(false);
  };

  const openDecisionModal = (type: "APPROVED" | "DECLINED") => {
    setDecisionModal({ type });
    const prefilledRate =
      interestRate !== null &&
      interestRate !== undefined &&
      Number.isFinite(Number(interestRate)) &&
      Number(interestRate) > 0
        ? sanitizeInterestRateInput(String(interestRate))
        : "";

    setDecisionForm({
      approvedAmount: loanAmount
        ? formatNumberInputValue(String(loanAmount))
        : "",
      interestRate: prefilledRate,
      notes: "",
    });
    setDecisionFormErrors({});
  };

  const validateDecisionForm = () => {
    const errors: DecisionFormErrors = {};
    const notes = decisionForm.notes.trim();

    if (!notes) {
      errors.notes = "Notes are required";
    }

    if (decisionModal.type === "APPROVED") {
      const approvedAmountRaw = stripNumberFormatting(
        decisionForm.approvedAmount,
      );
      const approvedAmountValue = Number(approvedAmountRaw);
      if (!approvedAmountRaw) {
        errors.approvedAmount = "Approved amount is required";
      } else if (
        !Number.isFinite(approvedAmountValue) ||
        approvedAmountValue <= 0
      ) {
        errors.approvedAmount =
          "Enter a valid approved amount greater than 0";
      }

      const interestRateError = getInterestRateValidationError(
        decisionForm.interestRate,
      );
      if (interestRateError) {
        errors.interestRate = interestRateError;
      }
    }

    setDecisionFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleDecisionSubmit = async () => {
    if (!applicationLenderId || !decisionModal.type) return;
    if (!validateDecisionForm()) {
      await Swal.fire({
        title: "Missing required fields",
        text: "Please complete all required fields before continuing.",
        icon: "warning",
        confirmButtonColor: "#0F766E",
        ...getSwalTheme(),
      });
      return;
    }

    const isApproval = decisionModal.type === "APPROVED";
    const confirmResult = await Swal.fire({
      title: isApproval ? "Confirm final approval?" : "Confirm rejection?",
      text: isApproval
        ? "This will mark the application as approved."
        : "This will mark the application as rejected.",
      icon: isApproval ? "question" : "warning",
      showCancelButton: true,
      confirmButtonColor: isApproval ? "#059669" : "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: isApproval ? "Yes, approve" : "Yes, reject",
      cancelButtonText: "Cancel",
      ...getSwalTheme(),
    });

    if (!confirmResult.isConfirmed) return;

    try {
      setDecisionSubmitting(true);

      const payload =
        decisionModal.type === "APPROVED"
          ? {
              decision: "APPROVED",
              approvedAmount: Number(
                stripNumberFormatting(decisionForm.approvedAmount),
              ),
              interestRate: Number(
                stripNumberFormatting(decisionForm.interestRate),
              ),
              notes: decisionForm.notes.trim(),
            }
          : {
              decision: "DECLINED",
              notes: decisionForm.notes.trim(),
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
        throw new Error(json.message || "Decision failed");
      }

      closeDecisionModal();

      await Swal.fire({
        title: isApproval ? "Application approved" : "Application rejected",
        text: isApproval
          ? "Final approval has been recorded successfully."
          : "The application has been rejected successfully.",
        icon: "success",
        timer: 1800,
        showConfirmButton: false,
        ...getSwalTheme(),
      });

      await fetchLenderApplicationDetail();
    } catch (err: any) {
      await Swal.fire({
        title: isApproval ? "Approval failed" : "Rejection failed",
        text: err.message || "Something went wrong",
        icon: "error",
        confirmButtonColor: "#0F766E",
        ...getSwalTheme(),
      });
    } finally {
      setDecisionSubmitting(false);
    }
  };

  useEffect(() => {
    if (!defaultLoanProductCode) return;
    setSelectedLoanProduct((prev) => prev || defaultLoanProductCode);
  }, [defaultLoanProductCode, applicationLenderId]);

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
      fetchDocumentsByProduct(selectedLoanProduct, { preserveSelection: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLoanProduct, loanProducts]);

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
        pdfBranding={pdfBranding}
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
                <th className="px-5 py-3 text-center">Requested</th>
                <th className="px-5 py-3 text-center">Uploads</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y dark:divide-slate-800">
              {documentsData.documents?.map((doc: any) => {
                const requestDisplay = getDocumentRequestDisplay(doc);

                return (
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

                  <td className="px-5 py-4 text-center">
                    {requestDisplay?.date ? (
                      <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
                        {requestDisplay.date}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">—</span>
                    )}
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
                );
              })}
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
  const renderRequestDocs = () => {
    if (!canRequestDocuments) {
      return (
        <div className="mx-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Request Documents
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {requestDocumentsDisabledReason ||
              "Documents cannot be requested for this application."}
          </p>
          {!loiGenerated && canCreateLoi && (
            <button
              type="button"
              onClick={() => onTabChange("loi")}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#13538A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0f4270]"
            >
              <FileText size={16} />
              Generate Term Sheet / LOI
            </button>
          )}
        </div>
      );
    }

    const selectedProductLabel =
      selectedLenderProduct?.loanProduct?.name ||
      selectedLenderProduct?.name ||
      (selectedLoanProduct
        ? formatLoanProduct(selectedLoanProduct)
        : "") ||
      "selected program";

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
                loanProducts.map((lp) => {
                  const optionCode = String(lp.loanProductCode || "");
                  const isAppProduct = isSameLoanProgramCode(
                    applicationLoanProductCode,
                    optionCode,
                  );
                  return (
                    <option key={lp.id} value={optionCode}>
                      {lp.loanProduct?.name || lp.name}
                      {isAppProduct ? " (this application)" : ""}
                    </option>
                  );
                })}
            </select>

            <div className="absolute right-3 top-2.5 text-gray-400 flex items-center gap-2">
              {loadingProducts && (
                <Loader2 className="w-4 h-4 animate-spin text-[#18B6B4]" />
              )}
            </div>
          </div>

          {isApplicationDefaultSelected ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              <span className="font-semibold">Selected by default:</span> this
              application was submitted for{" "}
              <span className="font-semibold">
                {selectedLenderProduct?.loanProduct?.name ||
                  selectedLenderProduct?.name ||
                  formatLoanProduct(applicationLoanProductCode)}
              </span>
              , so its documents are loaded first. You can switch to another
              program if needed.
            </div>
          ) : applicationLoanProductCode && selectedLoanProduct ? (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              Application program is{" "}
              <button
                type="button"
                className="underline font-medium"
                onClick={() => {
                  if (defaultLoanProductCode) {
                    setSelectedLoanProduct(defaultLoanProductCode);
                  }
                }}
              >
                {formatLoanProduct(applicationLoanProductCode)}
              </button>
              . Showing documents for a different program.
            </p>
          ) : applicationLoanProductCode && !defaultLoanProductCode ? (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              This application is for{" "}
              <span className="font-medium">
                {formatLoanProduct(applicationLoanProductCode)}
              </span>
              , but that program is not assigned on your account yet.
            </p>
          ) : (
            <p className="text-[11px] text-slate-500">
              Choose a loan program to load product-wise documents.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/10">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
                Requested Documents
              </h3>
              <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80">
                {requestedDocumentsList.length > 0
                  ? `${requestedDocumentsList.length} document${requestedDocumentsList.length === 1 ? "" : "s"} already requested on this application`
                  : "No documents have been requested yet"}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setIsRequestedDocsCollapsed((current) => !current)
              }
              className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-indigo-700 transition hover:bg-indigo-50 dark:border-indigo-500/30 dark:bg-slate-900 dark:text-indigo-300"
            >
              {isRequestedDocsCollapsed ? "Show list" : "Hide list"}
              <ChevronDown
                size={14}
                className={`transition-transform ${isRequestedDocsCollapsed ? "" : "rotate-180"}`}
              />
            </button>
          </div>

          {!isRequestedDocsCollapsed && requestedDocumentsList.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              {requestedDocumentsList.map((item) => (
                <div
                  key={item.documentTypeId}
                  className="flex h-full flex-col justify-between gap-2 rounded-xl border border-indigo-100 bg-white px-3 py-2.5 dark:border-indigo-500/20 dark:bg-slate-900"
                >
                  <p className="min-w-0 text-sm font-medium text-slate-800 dark:text-slate-100">
                    {item.documentName}
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                      Requested
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {formatDocumentTimelineDate(item.requestedAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : !isRequestedDocsCollapsed ? (
            <p className="rounded-xl border border-dashed border-indigo-200 bg-white/70 px-4 py-3 text-xs text-slate-500 dark:border-indigo-500/20 dark:bg-slate-900/40 dark:text-slate-400">
              Select documents below and submit a request. They will appear here
              once marked as requested.
            </p>
          ) : (
            <p className="rounded-xl border border-dashed border-indigo-200 bg-white/70 px-4 py-3 text-xs text-slate-500 dark:border-indigo-500/20 dark:bg-slate-900/40 dark:text-slate-400">
              List collapsed. Click "Show list" to view requested documents.
            </p>
          )}
        </div>

        {!selectedLoanProduct && !docSelectModal.loading && (
          <div
            className="flex flex-col items-center justify-center py-12 px-6 text-center 
  border-2 border-dashed border-slate-200 rounded-2xl 
  bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40"
          >
            <div className="w-14 h-14 rounded-full bg-slate-200/70 dark:bg-slate-700 flex items-center justify-center mb-4">
              <FileText className="w-6 h-6 text-slate-500" />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Select a Loan Program
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Pick a loan program to view and request its documents.
            </p>
          </div>
        )}

        {/* HEADER */}
        {selectedLoanProduct && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Select Documents</h2>
              <p className="text-sm text-slate-500">
                Product-wise documents for {selectedProductLabel}. Add a custom
                document to this program if needed.
              </p>
            </div>

            {docSelectModal.documents.length > 0 && (
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
            )}
          </div>
        )}

        {/* LOADING */}
        {selectedLoanProduct && docSelectModal.loading && (
          <div className="text-center py-10 text-slate-400">
            Loading documents...
          </div>
        )}

        {/* EMPTY */}
        {!docSelectModal.loading &&
          selectedLoanProduct &&
          docSelectModal.documents.length === 0 && (
            <div
              className="flex flex-col items-center justify-center py-10 px-6 text-center 
  border-2 border-dashed border-[#18B6B4]/40 rounded-2xl 
  bg-gradient-to-br from-[#e6f7f7] to-white 
  dark:from-slate-800 dark:to-slate-900"
            >
              <div className="w-14 h-14 rounded-full bg-[#18B6B4]/10 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-[#18B6B4]" />
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                No Documents Configured
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                No product documents yet for {selectedProductLabel}. Add one
                below to request it from the borrower.
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
                const requestHistory = requestDocHistoryByTypeId[String(docId)];
                const isAlreadyRequested = Boolean(requestHistory);

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
              ? "border-[#18B6B4] bg-[#e6f7f7] dark:bg-[#18B6B4]/10"
              : isAlreadyRequested
                ? "border-indigo-200 bg-indigo-50/50 dark:border-indigo-500/30 dark:bg-indigo-500/5"
                : "border-gray-200 hover:border-[#18B6B4] dark:border-slate-700"
          }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0
              ${
                isChecked
                  ? "bg-[#18B6B4] text-white"
                  : "bg-blue-50 text-blue-500 dark:bg-slate-700"
              }`}
                      >
                        <FileText size={16} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-xs font-semibold text-gray-800 truncate dark:text-[#18B6B4]">
                            {doc.documentName || doc.documentType?.name}
                          </p>
                          {isAlreadyRequested ? (
                            <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                              Requested
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[10px] text-gray-400 truncate">
                          {doc.isCustom ? "Custom" : "Standard"}
                          {doc.isRequired === false ? " · Optional" : " · Required"}
                        </p>
                        {requestHistory ? (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {formatDocumentTimelineDate(requestHistory.requestedAt)}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center transition
              ${
                isChecked
                  ? "bg-[#18B6B4] border-[#18B6B4]"
                  : "border-gray-300 group-hover:border-[#18B6B4]"
              }`}
                    >
                      {isChecked && <Check size={10} className="text-white" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        {/* PRODUCT-WISE ADD DOCUMENT */}
        {selectedLoanProduct && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#13538A] text-white text-xs flex items-center justify-center">
                <Plus size={12} />
              </div>
              <p className="text-xs font-semibold text-gray-500 tracking-wide">
                ADD DOCUMENT TO THIS PROGRAM
              </p>
            </div>

            <div className="border border-dashed border-gray-300 rounded-xl p-4 space-y-3 dark:border-slate-700">
              {!selectedLenderProductId ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  This program is not assigned on your account, so new documents
                  cannot be saved to it. Assign the product first, then add
                  documents.
                </p>
              ) : (
                <>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      value={newDocName}
                      onChange={(e) => setNewDocName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddProductDocument();
                        }
                      }}
                      placeholder="Enter document name..."
                      disabled={addingDocument}
                      className="flex-1 text-sm px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-[#18B6B4] dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 disabled:opacity-60"
                    />

                    <button
                      type="button"
                      onClick={handleAddProductDocument}
                      disabled={addingDocument || newDocName.trim().length < 2}
                      className="inline-flex items-center justify-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-[#13538A] text-white hover:bg-[#0f4270] transition disabled:opacity-40"
                    >
                      {addingDocument ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Plus size={14} />
                      )}
                      {addingDocument ? "Adding..." : "Add Document"}
                    </button>
                  </div>

                  <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newDocRequired}
                      onChange={(e) => setNewDocRequired(e.target.checked)}
                      className="rounded border-slate-300 text-[#13538A] focus:ring-[#18B6B4]"
                    />
                    Required document for this loan program
                  </label>
                </>
              )}
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div className="flex items-center justify-between pt-4 border-t dark:border-slate-700">
          <p className="text-sm text-slate-500">
            {docSelectModal.selectedDocs?.length || 0} selected
          </p>

          <button
            onClick={handleRequestDocuments}
            disabled={
              requestLoading ||
              !selectedLoanProduct ||
              (docSelectModal.selectedDocs?.length || 0) === 0
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

    if (loiLoading) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 className="animate-spin w-8 h-8 text-blue-500" />
          <p className="text-sm text-slate-500">Loading LOI preview...</p>
        </div>
      );
    }

    if (!loiGenerated && !hasSignedBrokerLoi && !loiUrl && !signedBrokerLoiUrl) {
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
            onClick={openCreateLoiForm}
            disabled={detailLoading}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition disabled:opacity-50"
          >
            <FileText size={16} />
            Enter Terms & Generate LOI
          </button>
        </div>
      );
    }

    if (!loiUrl && !signedBrokerLoiUrl) {
      if (loiLoading || detailLoading || location.state?.refreshLoi) {
        return (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <Loader2 className="animate-spin w-8 h-8 text-blue-500" />
            <p className="text-sm text-slate-500">Loading LOI preview...</p>
          </div>
        );
      }

      return (
        <div className="text-center py-16 text-slate-500">
          LOI preview not available.
        </div>
      );
    }

    const activePreviewUrl =
      loiViewMode === "signed-broker" && signedBrokerLoiUrl
        ? signedBrokerLoiUrl
        : loiUrl;
    const activeDownloadName =
      loiViewMode === "signed-broker"
        ? signedBrokerLoi?.signedUpload?.fileName || "Signed-Broker-LOI.pdf"
        : "Loan-LOI.pdf";

    if (!activePreviewUrl) {
      return (
        <div className="text-center py-16 text-slate-500">
          LOI preview not available.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {loiGenerated && !loiSentToBroker && (
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Review before sending</p>
              <p className="mt-1 text-amber-800/90 dark:text-amber-100/90">
                This term sheet is saved as a draft. The broker will only see it
                after you send it.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSendLoiToBroker}
              disabled={loiSendingToBroker}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F766E] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0d655e] disabled:opacity-50"
            >
              {loiSendingToBroker ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              Send to Broker
            </button>
          </div>
        )}

        {loiGenerated && loiSentToBroker && !currentLoiIsDraft && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
            Sent to broker
            {submissionDetail?.loiSentToBrokerAt
              ? ` · ${new Date(submissionDetail.loiSentToBrokerAt).toLocaleString()}`
              : ""}
            {currentLoiVersion
              ? ` · Version ${currentLoiVersion.versionNumber}`
              : ""}
          </div>
        )}

        {loiVersions.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/40">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              LOI Version History
            </p>
            <div className="flex flex-wrap gap-2">
              {loiVersions.map((version) => (
                <span
                  key={version.id}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                    version.isCurrent
                      ? "bg-purple-100 text-purple-800"
                      : "bg-white text-slate-600 border border-slate-200"
                  }`}
                >
                  Version {version.versionNumber}
                  {version.status === "SENT_TO_BROKER" && " · Sent"}
                  {version.status === "SUPERSEDED" && " · Superseded"}
                  {version.isCurrent && version.status === "DRAFT" && " · Current draft"}
                </span>
              ))}
            </div>
          </div>
        )}

        {hasSignedBrokerLoi && loiUrl && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setLoiViewMode("lender")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                loiViewMode === "lender"
                  ? "bg-purple-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Your LOI
            </button>
            <button
              type="button"
              onClick={() => {
                setLoiViewMode("signed-broker");
                void loadLoiPreview(undefined, true);
              }}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                loiViewMode === "signed-broker"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Signed LOI
            </button>
          </div>
        )}

        {loiViewMode === "signed-broker" && signedBrokerLoi && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Client-signed broker LOI forwarded by the broker
            {signedBrokerLoi.versionLabel
              ? ` · ${signedBrokerLoi.versionLabel}`
              : ""}
            {signedBrokerLoi.clientSignedAt
              ? ` · signed ${new Date(signedBrokerLoi.clientSignedAt).toLocaleDateString()}`
              : ""}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          {canCreateLoi && loiGenerated && loiViewMode === "lender" ? (
            currentLoiIsDraft ? (
              <button
                type="button"
                onClick={openRegenerateLoiForm}
                disabled={loiLoading}
                className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700 transition hover:bg-purple-100 disabled:opacity-50"
              >
                <RotateCcw size={16} />
                Update Draft
              </button>
            ) : (
              <button
                type="button"
                onClick={openRevisedLoiForm}
                disabled={loiLoading}
                className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700 transition hover:bg-purple-100 disabled:opacity-50"
              >
                <RotateCcw size={16} />
                Create Revised LOI (Version {nextRevisedVersionNumber})
              </button>
            )
          ) : null}
          <button
            onClick={() => handleDownload(activePreviewUrl, activeDownloadName)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-sm font-semibold hover:bg-slate-200 transition"
          >
            <Download size={16} />
            Download
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 h-[70vh]">
          <iframe
            src={activePreviewUrl}
            title={
              loiViewMode === "signed-broker"
                ? "Signed Broker LOI"
                : "Loan LOI"
            }
            className="w-full h-full"
          />
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
        ...(showLoiTab
          ? [
              {
                id: "loi" as const,
                label: getVisibleTabLabel("loi", "LOI / Term Sheet"),
                icon: FileText,
                color: "text-purple-600",
              },
            ]
          : []),
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

          <div className="flex flex-col items-end gap-3">
            <span className="text-xs bg-gray-100 border-2 px-2 py-1 rounded-md text-purple-700 font-semibold">
              {submissionDetail && submissionDetail?.status}
            </span>

            {(showApproval || showReject) && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {showApproval && (
                  <button
                    type="button"
                    onClick={() => openDecisionModal("APPROVED")}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    <CheckCircle size={16} />
                    {approvalButtonLabel}
                  </button>
                )}
                {showReject && (
                  <button
                    type="button"
                    onClick={() => openDecisionModal("DECLINED")}
                    className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50"
                  >
                    <XCircle size={16} />
                    Declined
                  </button>
                )}
              </div>
            )}
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
                    {resolvedLoanProductName}
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
            <div className="grid grid-cols-2 gap-1.5 bg-slate-50/80 p-2 sm:grid-cols-3 dark:bg-slate-950/50">
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

      {decisionModal.type &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-800">
                <h2 className="text-lg font-bold">
                  {decisionModal.type === "APPROVED"
                    ? "Final Approval"
                    : "Declined Application"}
                </h2>

                <button
                  type="button"
                  onClick={closeDecisionModal}
                  className="text-sm px-3 py-1 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                >
                  Close
                </button>
              </div>

              <div className="p-6 space-y-5">
                {decisionModal.type === "APPROVED" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Approved Amount{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        required
                        placeholder="Enter approved amount"
                        value={decisionForm.approvedAmount}
                        onChange={(e) => {
                          const next = formatNumberInputValue(
                            sanitizeNumberInput(e.target.value),
                          );
                          setDecisionForm({
                            ...decisionForm,
                            approvedAmount: next,
                          });
                          if (decisionFormErrors.approvedAmount) {
                            setDecisionFormErrors((prev) => ({
                              ...prev,
                              approvedAmount: undefined,
                            }));
                          }
                        }}
                        className={`w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none ${
                          decisionFormErrors.approvedAmount
                            ? "border-red-500"
                            : "border-slate-200 dark:border-slate-700"
                        }`}
                      />
                      {decisionFormErrors.approvedAmount && (
                        <p className="mt-1 text-xs text-red-500">
                          {decisionFormErrors.approvedAmount}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Interest Rate (%){" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        required
                        value={decisionForm.interestRate}
                        onChange={(e) => {
                          const next = sanitizeInterestRateInput(e.target.value);
                          setDecisionForm({
                            ...decisionForm,
                            interestRate: next,
                          });

                          const liveError = next
                            ? getInterestRateValidationError(next)
                            : undefined;
                          setDecisionFormErrors((prev) => ({
                            ...prev,
                            interestRate: liveError,
                          }));
                        }}
                        onBlur={(e) => {
                          const error = getInterestRateValidationError(
                            e.target.value,
                          );
                          setDecisionFormErrors((prev) => ({
                            ...prev,
                            interestRate: error,
                          }));
                        }}
                        placeholder="e.g. 7.25"
                        className={`w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none ${
                          decisionFormErrors.interestRate
                            ? "border-red-500"
                            : "border-slate-200 dark:border-slate-700"
                        }`}
                      />
                      {decisionFormErrors.interestRate ? (
                        <p className="mt-1 text-xs text-red-500">
                          {decisionFormErrors.interestRate}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-slate-500">
                          Enter a rate greater than 0 and up to 100 (max 2
                          decimal places).
                        </p>
                      )}
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Notes <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={decisionForm.notes}
                    onChange={(e) => {
                      setDecisionForm({
                        ...decisionForm,
                        notes: e.target.value,
                      });
                      if (decisionFormErrors.notes) {
                        setDecisionFormErrors((prev) => ({
                          ...prev,
                          notes: undefined,
                        }));
                      }
                    }}
                    placeholder={
                      decisionModal.type === "APPROVED"
                        ? "Approval notes..."
                        : "Reason for rejection..."
                    }
                    className={`w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none ${
                      decisionFormErrors.notes
                        ? "border-red-500"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                  />
                  {decisionFormErrors.notes && (
                    <p className="mt-1 text-xs text-red-500">
                      {decisionFormErrors.notes}
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeDecisionModal}
                    disabled={decisionSubmitting}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 disabled:opacity-60"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleDecisionSubmit}
                    disabled={
                      decisionSubmitting ||
                      Boolean(decisionFormErrors.approvedAmount) ||
                      Boolean(decisionFormErrors.interestRate) ||
                      Boolean(decisionFormErrors.notes) ||
                      (decisionModal.type === "APPROVED" &&
                        (!stripNumberFormatting(decisionForm.approvedAmount) ||
                          !stripNumberFormatting(decisionForm.interestRate))) ||
                      !decisionForm.notes.trim()
                    }
                    className={`px-4 py-2 rounded-xl text-white font-semibold disabled:opacity-60 ${
                      decisionModal.type === "APPROVED"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : "bg-rose-600 hover:bg-rose-700"
                    }`}
                  >
                    {decisionSubmitting
                      ? "Processing..."
                      : decisionModal.type === "APPROVED"
                        ? "Confirm Final Approval"
                        : "Confirm Declined"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
