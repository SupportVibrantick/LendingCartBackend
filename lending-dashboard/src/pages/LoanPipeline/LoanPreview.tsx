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
  Download,
  Eye,
  FileIcon,
  FileText,
  Filter,
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
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import Chat from "./Chat";
import NotificationDropdown from "../../components/header/NotificationDropdown";
import { MdEmail } from "react-icons/md";
import { BiLogoProductHunt } from "react-icons/bi";
import { FaDollarSign } from "react-icons/fa6";
import { formatDocumentStatusLabel } from "../../lib/documentStatus";
import { getLenderDocumentSourceDisplay } from "../../lib/documentSource";
import {
  buildDocumentRequestHistoryByTypeId,
  formatDocumentTimelineDate,
  getDocumentRequestDisplay,
} from "../../lib/documentRequestMeta";
import {
  canLenderRequestDocuments,
  canLenderTakeDecision,
  canShowRejectAction,
  formatLoanProduct,
  formatApplicationStatus,
  getApplicationStatusColor,
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
import SignDocumentsPanel from "../../components/documents/SignDocumentsPanel";
import EmbeddedFilePreview from "../../components/documents/EmbeddedFilePreview";
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
import { useLenderSessionMonitor } from "../../hooks/useSessionMonitor";
import { ensureChatSocket } from "../../lib/chatSocketManager";
import { getOrgIdsFromToken } from "../../lib/chatSocket";
import {
  fetchLenderApplicationDetailShared,
  fetchLenderLoanProductsSummaryShared,
  invalidateLenderApplicationDetailCache,
} from "../../lib/lenderPipelineFetch";

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
  items: PreviewTabItem[];
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

const normalizeText = (value: unknown) => String(value || "").trim();

const parsePreviewScheduleMonths = (value: unknown) => {
  if (value == null || value === "") return 0;
  const raw = String(value).trim();
  if (/interest\s*only/i.test(raw)) return 0;
  const months = raw.match(/(\d+)\s*Months?/i);
  if (months) return Number(months[1]);
  const years = raw.match(/(\d+)\s*Years?/i);
  if (years) return Number(years[1]) * 12;
  const numeric = Number(raw.replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

const isPreviewInterestOnly = (...values: unknown[]) =>
  values.some((value) => {
    const raw = String(value ?? "").trim();
    if (!raw) return false;
    return (
      /interest\s*only/i.test(raw) ||
      raw.toUpperCase() === "INTEREST_ONLY" ||
      raw.toUpperCase() === "IO"
    );
  });

const calculateMonthlyPayment = (
  loanAmount: number,
  interestRate: number,
  termMonths: number,
  options?: { interestOnly?: boolean; amortMonths?: number },
) => {
  if (!loanAmount || interestRate < 0) return 0;

  if (options?.interestOnly) {
    return (loanAmount * interestRate) / 100 / 12;
  }

  const scheduleMonths =
    options?.amortMonths && options.amortMonths > 0
      ? options.amortMonths
      : termMonths;
  if (!scheduleMonths || scheduleMonths <= 0) return 0;

  const monthlyRate = interestRate / 100 / 12;
  if (monthlyRate === 0) {
    return loanAmount / scheduleMonths;
  }

  return (
    (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, scheduleMonths)) /
    (Math.pow(1 + monthlyRate, scheduleMonths) - 1)
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

// Short TTL cache: Strict Mode remounts often start AFTER the first fetch finishes,
// so inflight-only coalescing still double-hits the network.
type TtlCacheEntry<T> = { promise: Promise<T>; expiresAt: number };
const PREVIEW_FETCH_TTL_MS = 8_000;

function getTtlCachedPromise<T>(
  cache: Map<string, TtlCacheEntry<T>>,
  key: string,
  factory: () => Promise<T>,
  ttlMs = PREVIEW_FETCH_TTL_MS,
): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.promise;

  const promise = factory().catch((error) => {
    const current = cache.get(key);
    if (current?.promise === promise) cache.delete(key);
    throw error;
  });

  cache.set(key, { promise, expiresAt: now + ttlMs });
  return promise;
}

const loiVersionsCache = new Map<string, TtlCacheEntry<any[]>>();
const documentConfigsCache = new Map<string, TtlCacheEntry<any[]>>();
const uploadedDocumentsCache = new Map<string, TtlCacheEntry<any>>();

async function fetchLoiVersionsShared(
  applicationLenderId: string,
): Promise<any[]> {
  return getTtlCachedPromise(
    loiVersionsCache,
    applicationLenderId,
    async () => {
      const res = await fetch(
        `${API_BASE}/lender/loan-pipeline/${applicationLenderId}/loi-versions`,
        { headers: getAuthHeaders() },
      );
      const json = await res.json();
      if (!res.ok || !json.success) return [];
      return Array.isArray(json.data?.versions) ? json.data.versions : [];
    },
  );
}

async function fetchDocumentConfigListShared(
  params: URLSearchParams,
): Promise<any[]> {
  return getTtlCachedPromise(
    documentConfigsCache,
    params.toString(),
    async () => {
      const res = await fetch(
        `${API_BASE}/lender/document-config/list?${params.toString()}`,
        { headers: getAuthHeaders() },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error("Failed to load documents");
      }
      return Array.isArray(json.data) ? json.data : [];
    },
  );
}

function invalidatePreviewCaches(applicationLenderId?: string) {
  if (!applicationLenderId) return;
  invalidateLenderApplicationDetailCache(applicationLenderId);
  loiVersionsCache.delete(applicationLenderId);
  for (const key of uploadedDocumentsCache.keys()) {
    if (key.startsWith(`${applicationLenderId}:`)) {
      uploadedDocumentsCache.delete(key);
    }
  }
}

/** Summary + full product payloads expose code under different keys. */
function getLenderProductCode(product?: {
  loanProductCode?: string | null;
  code?: string | null;
  loanProduct?: { code?: string | null } | null;
} | null) {
  return String(
    product?.loanProductCode ||
      product?.loanProduct?.code ||
      product?.code ||
      "",
  ).trim();
}

function getLenderProductLabel(product?: {
  name?: string | null;
  loanProduct?: { name?: string | null; code?: string | null } | null;
  loanProductCode?: string | null;
  code?: string | null;
} | null) {
  return (
    product?.loanProduct?.name ||
    product?.name ||
    formatLoanProduct(getLenderProductCode(product)) ||
    "Loan program"
  );
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
  { id: "signDocuments", label: "Upload Forms" },
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
        return { ...tab, label: "View Signable Forms" };
      }

      return tab;
    });
}

export default function LoanPreview() {
  useLenderSessionMonitor();

  useEffect(() => {
    const token = sessionStorage.getItem("lender_token");
    if (!token) return;

    let lenderOrgId: string | null = null;
    try {
      const user = JSON.parse(
        sessionStorage.getItem("lender_user") ||
          sessionStorage.getItem("user") ||
          "{}",
      );
      lenderOrgId = user.organizationId || null;
    } catch {
      lenderOrgId = null;
    }

    if (!lenderOrgId) {
      lenderOrgId = getOrgIdsFromToken(token).lenderOrgId;
    }

    ensureChatSocket(token, {
      getLenderOrgId: () => lenderOrgId,
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
  const [debouncedDocumentSearch, setDebouncedDocumentSearch] = useState("");
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
  const [requestDocsSearch, setRequestDocsSearch] = useState("");
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
  // Branding is loaded lazily by the PDF download button — not on page open.
  const pdfBranding = null;

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

  const fetchLoanProducts = async (isActive?: () => boolean) => {
    if (loanProducts.length > 0) return;
    if (!isActive || isActive()) setLoadingProducts(true);

    try {
      const products = await fetchLenderLoanProductsSummaryShared();
      if (isActive && !isActive()) return;
      setLoanProducts(products);
    } catch (err: any) {
      if (isActive && !isActive()) return;
      console.error(err);
      toast.error("Failed to load loan products");
    } finally {
      if (!isActive || isActive()) {
        setLoadingProducts(false);
      }
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
        getLenderProductCode(product),
      ),
    );

    return getLenderProductCode(matched);
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
          getLenderProductCode(product),
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
      isActive?: () => boolean;
    },
  ) => {
    const productCode = String(code || "").trim();
    if (!productCode) {
      setDocSelectModal({
        documents: [],
        selectedDocs: [],
        loading: false,
      });
      return;
    }

    try {
      if (!options?.isActive || options.isActive()) {
        setDocSelectModal((prev) => ({ ...prev, loading: true }));
      }

      const matchedProduct =
        loanProducts.find((product) =>
          isSameLoanProgramCode(productCode, getLenderProductCode(product)),
        ) || null;

      const params = new URLSearchParams({ limit: "100" });
      if (matchedProduct?.id) {
        params.set("lenderProductId", String(matchedProduct.id));
      } else {
        params.set(
          "loanProductCode",
          getLenderProductCode(matchedProduct) || productCode,
        );
      }

      const documents = await fetchDocumentConfigListShared(params);
      if (options?.isActive && !options.isActive()) return;

      const availableIds = new Set(
        documents
          .map((doc: any) =>
            String(doc.documentTypeId || doc.id || doc._id || ""),
          )
          .filter(Boolean),
      );

      setDocSelectModal((prev) => {
        const preserved = options?.preserveSelection
          ? (prev.selectedDocs || []).filter((id) =>
              availableIds.has(String(id)),
            )
          : [];
        const extra = (options?.selectIds || []).filter((id) =>
          availableIds.has(String(id)),
        );

        return {
          ...prev,
          documents: Array.isArray(documents) ? documents : [],
          selectedDocs: [...new Set([...preserved, ...extra])],
          loading: false,
        };
      });
    } catch (err) {
      console.error(err);
      if (!options?.isActive || options.isActive()) {
        toast.error("Failed to load documents");
        setDocSelectModal((prev) => ({
          ...prev,
          documents: [],
          selectedDocs: [],
          loading: false,
        }));
      }
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
      const isPublicStatic =
        /\/public\//i.test(url) ||
        /\/uploads\//i.test(url) ||
        /\/(broker|lender)\/LOI\//i.test(url);
      const res = await fetch(url, {
        headers:
          url.startsWith("blob:") || isPublicStatic
            ? undefined
            : getAuthHeaders(),
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

  const resolveUploadedFileUrl = (fileUrl?: string | null) =>
    buildApiPublicFileUrl(API_BASE, fileUrl);

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
  const loiGenerated = Boolean(
    submissionDetail?.loiUrl ||
      submissionDetail?.loiSentToBrokerAt ||
      loiVersions.length > 0,
  );
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

    const matchedProduct = loanProducts.find((product) =>
      isSameLoanProgramCode(code, getLenderProductCode(product)),
    );
    if (matchedProduct) {
      return getLenderProductLabel(matchedProduct);
    }

    return formatLoanProduct(code);
  }, [submissionDetail, loanProducts]);

  const fetchLoiVersions = async (isActive?: () => boolean) => {
    if (!applicationLenderId) return;

    try {
      const versions = await fetchLoiVersionsShared(applicationLenderId);
      if (isActive && !isActive()) return;
      setLoiVersions(versions);
    } catch {
      /* optional */
    }
  };

  const fetchLenderApplicationDetail = async (
    isActive?: () => boolean,
    options?: { force?: boolean; includeLoiVersions?: boolean },
  ) => {
    if (!applicationLenderId) return;

    if (options?.force) {
      invalidatePreviewCaches(applicationLenderId);
    }

    if (!isActive || isActive()) setDetailLoading(true);

    try {
      const includeLoiVersions = Boolean(options?.includeLoiVersions);
      const detailPromise = fetchLenderApplicationDetailShared(
        applicationLenderId,
        { force: Boolean(options?.force) },
      );
      const versionsPromise = includeLoiVersions
        ? fetchLoiVersionsShared(applicationLenderId)
        : Promise.resolve(null as any[] | null);

      const [detail, versions] = await Promise.all([
        detailPromise,
        versionsPromise,
      ]);
      if (isActive && !isActive()) return;

      setSubmissionDetail(detail);
      if (versions) {
        setLoiVersions(versions);
      }
    } catch (err: any) {
      if (isActive && !isActive()) return;
      toast.error(err.message || "Failed to load application");
    } finally {
      if (!isActive || isActive()) {
        setDetailLoading(false);
      }
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
  const borrowerDisplayName = useMemo(
    () => getBorrowerDisplayName(submissionDetail, submissionFields),
    [submissionDetail, submissionFields],
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
  const amortizationRaw = useMemo(
    () => getFieldValueFromList(submissionFields, "amortization"),
    [submissionFields],
  );
  const rateTypeRaw = useMemo(
    () => getFieldValueFromList(submissionFields, "rateType"),
    [submissionFields],
  );
  const loanTermRaw = useMemo(
    () => getFieldValueFromList(submissionFields, "loanTerm"),
    [submissionFields],
  );
  const loanTermMonths =
    parsePreviewScheduleMonths(loanTermRaw) ||
    getNumericFieldValue(submissionFields, "loanTerm") ||
    0;
  const amortMonths = parsePreviewScheduleMonths(amortizationRaw);
  const interestOnly = isPreviewInterestOnly(rateTypeRaw, amortizationRaw);
  const monthlyPayment = calculateMonthlyPayment(
    loanAmount,
    interestRate,
    loanTermMonths,
    {
      interestOnly,
      amortMonths: interestOnly ? 0 : amortMonths || 360,
    },
  );
  const monthlyPaymentDisplay = formatMonthlyPayment(monthlyPayment);

  const submittedDate = latestSubmission?.createdAt
    ? new Date(latestSubmission.createdAt)
    : null;

  const requestDocHistoryByTypeId = useMemo(
    () => buildDocumentRequestHistoryByTypeId(documentsData?.documents || []),
    [documentsData?.documents],
  );

  const fetchDocuments = async (options?: {
    limit?: number;
    force?: boolean;
    search?: string;
    page?: number;
    sourceFilter?: DocumentSourceFilter;
    isActive?: () => boolean;
  }) => {
    if (!applicationLenderId) return;
    const isActive = options?.isActive;
    if (!isActive || isActive()) setDocumentsLoading(true);

    try {
      const searchValue = (
        options?.search ?? debouncedDocumentSearch
      ).trim();
      const pageValue = options?.page ?? documentPage;
      const sourceFilterValue =
        options?.sourceFilter ?? documentSourceFilter;

      const params = new URLSearchParams({
        page: String(pageValue),
        limit: String(options?.limit ?? 10),
      });

      if (searchValue) {
        params.set("search", searchValue);
      }

      if (sourceFilterValue !== "all") {
        params.set("sourceFilter", sourceFilterValue);
      }

      const cacheKey = `${applicationLenderId}:${params.toString()}`;
      if (options?.force) {
        uploadedDocumentsCache.delete(cacheKey);
      }

      const json = await getTtlCachedPromise(
        uploadedDocumentsCache,
        cacheKey,
        async () => {
          const res = await fetch(
            `${API_BASE}/lender/loan-pipeline/lender/applications/${applicationLenderId}/documents?${params.toString()}`,
            { headers: getAuthHeaders() },
          );
          const body = await res.json();
          if (!res.ok || !body.success) {
            throw new Error(body.message || "Failed to load documents");
          }
          return body;
        },
      );

      if (isActive && !isActive()) return;

      setDocumentsData(json.data);
      setDocumentsPagination(json.data.pagination || null);

      if (json.data.pagination?.page) {
        setDocumentPage(json.data.pagination.page);
      }
    } catch (err: any) {
      if (isActive && !isActive()) return;
      toast.error(err.message || "Failed to load documents");
    } finally {
      if (!isActive || isActive()) {
        setDocumentsLoading(false);
      }
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

      await fetchDocuments({ force: true });

      setSubmissionDetail(null);
      await fetchLenderApplicationDetail(undefined, { force: true });

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

  const loadLoiPdfBlob = async (resolvedPath: string) => {
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
  };

  const loadLoiPreview = async (loiPath?: string, force = false) => {
    if (!applicationLenderId) return;

    try {
      setLoiLoading(true);

      // Fresh generate already gave us the path — skip view-loi round trip.
      if (loiPath) {
        if (!force && loiUrl) return;
        await loadLoiPdfBlob(loiPath);
        setLoiViewMode("lender");
        return;
      }

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

      await loadLoiPdfBlob(json.data.loiPath);
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

  // Core preview payload only — no LOI versions / branding on open.
  useEffect(() => {
    if (!applicationLenderId) return;
    let active = true;
    void fetchLenderApplicationDetail(() => active);
    return () => {
      active = false;
    };
  }, [applicationLenderId]);

  // LOI version history is only needed on the LOI tab (skip when generate already provided versions).
  useEffect(() => {
    if (activeTab !== "loi" || !applicationLenderId) return;
    if (location.state?.refreshLoi && location.state?.generatedLoi) return;
    let active = true;
    void fetchLoiVersions(() => active);
    return () => {
      active = false;
    };
  }, [
    activeTab,
    applicationLenderId,
    location.state?.refreshLoi,
    location.state?.generatedLoi,
  ]);

  // Debounce uploaded-documents search before hitting the backend.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedDocumentSearch((prev) => {
        if (prev === documentSearchInput) return prev;
        setDocumentPage(1);
        return documentSearchInput;
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [documentSearchInput]);

  // Loan products + document-config are only needed on Request Documents.
  useEffect(() => {
    if (activeTab !== "requestDocs") return;
    let active = true;
    void fetchLoanProducts(() => active);
    return () => {
      active = false;
    };
  }, [activeTab]);

  useEffect(() => {
    if (!applicationLenderId) return;
    let active = true;

    if (activeTab === "documents") {
      void fetchDocuments({ isActive: () => active });
    }

    if (activeTab === "requestDocs") {
      // Needed for prior-request history badges on the request list.
      // Do not apply documents-tab search filters here.
      void fetchDocuments({
        limit: 100,
        search: "",
        sourceFilter: "all",
        page: 1,
        isActive: () => active,
      });
    }

    // After generate, dedicated refresh effect owns LOI loading (avoids double view-loi).
    if (location.state?.refreshLoi) {
      return () => {
        active = false;
      };
    }

    if (activeTab === "loi" && (loiGenerated || isLoi || hasSignedBrokerLoi)) {
      void loadLoiPreview(undefined, false);
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

    return () => {
      active = false;
    };
  }, [
    activeTab,
    applicationLenderId,
    documentPage,
    debouncedDocumentSearch,
    documentSourceFilter,
    loiGenerated,
    isLoi,
    hasSignedBrokerLoi,
    location.state?.refreshLoi,
  ]);

  // Single post-generate refresh: apply generate payload, load PDF once, clear flag.
  useEffect(() => {
    if (!location.state?.refreshLoi || !applicationLenderId) return;

    let cancelled = false;
    const generated = location.state?.generatedLoi as
      | {
          loiUrl?: string | null;
          versions?: any[];
          versionNumber?: number | null;
          loiSentToBrokerAt?: string | null;
        }
      | undefined;

    (async () => {
      // Drop stale version cache so later tab visits see the new LOI.
      loiVersionsCache.delete(applicationLenderId);

      if (Array.isArray(generated?.versions)) {
        setLoiVersions(generated.versions);
      } else {
        await fetchLoiVersions(() => !cancelled);
      }
      if (cancelled) return;

      if (generated?.loiUrl) {
        setSubmissionDetail((prev: any) =>
          prev
            ? {
                ...prev,
                loiUrl: generated.loiUrl,
                loiSentToBrokerAt: generated.loiSentToBrokerAt ?? null,
              }
            : prev,
        );
        await loadLoiPreview(generated.loiUrl, true);
      } else {
        // Fallback when generate response lacked a path.
        invalidatePreviewCaches(applicationLenderId);
        await fetchLenderApplicationDetail(() => !cancelled, {
          force: true,
          includeLoiVersions: !Array.isArray(generated?.versions),
        });
        if (cancelled) return;
        await loadLoiPreview(undefined, true);
      }

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
        confirmButtonColor: "#4C78F5",
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

      await fetchLenderApplicationDetail(undefined, { force: true });
    } catch (err: any) {
      await Swal.fire({
        title: isApproval ? "Approval failed" : "Rejection failed",
        text: err.message || "Something went wrong",
        icon: "error",
        confirmButtonColor: "#4C78F5",
        ...getSwalTheme(),
      });
    } finally {
      setDecisionSubmitting(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "requestDocs") return;
    if (!defaultLoanProductCode) return;
    setSelectedLoanProduct((prev) => prev || defaultLoanProductCode);
  }, [activeTab, defaultLoanProductCode, applicationLenderId]);

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
    if (activeTab !== "requestDocs" || !selectedLoanProduct) return;
    // Wait until products are loaded so lenderProductId can be resolved.
    if (!loanProducts.length) return;

    let active = true;
    void fetchDocumentsByProduct(selectedLoanProduct, {
      preserveSelection: true,
      isActive: () => active,
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedLoanProduct, loanProducts]);

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

    return (
      <div className="h-[min(72vh,680px)] min-h-0 scroll-mt-4">
        <Chat applicationId={resolvedChatApplicationId} />
      </div>
    );
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

  // Always return to the pipeline list — tab/LOI navigations pollute history,
  // so navigate(-1) often lands on another preview entry and looks broken.
  const goBackToPipeline = () => {
    navigate("/loan-pipeline", { replace: true });
  };

  const renderDetails = () => {
    if (detailLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin w-6 h-6 text-brand-500" />
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

    const formatDetailMetric = (value: unknown, suffix = "") => {
      if (value === undefined || value === null || value === "") return "-";
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric === 0) return String(value);
      return `${numeric}${suffix}`;
    };

    const detailFieldValue = (key: string) =>
      getFieldValueFromList(submissionFields, key);

    const metrics = [
      {
        label: "Monthly Payment",
        value: monthlyPaymentDisplay,
      },
      {
        label: "LTV",
        value: ltv
          ? `${ltv.toFixed(2)}%`
          : formatDetailMetric(detailFieldValue("ltvPercentage"), "%"),
      },
      {
        label: "LTC",
        value: ltc
          ? `${ltc.toFixed(2)}%`
          : formatDetailMetric(detailFieldValue("ltcPercentage"), "%"),
      },
      {
        label: "ARV %",
        value: arv
          ? `${arv.toFixed(2)}%`
          : formatDetailMetric(detailFieldValue("arvPercentage"), "%"),
      },
      {
        label: "DSCR Ratio",
        value: dscr
          ? dscr.toFixed(2)
          : formatDetailMetric(detailFieldValue("dscr")),
      },
      {
        label: "Net Worth",
        value: netWorth
          ? `$${Number(netWorth).toLocaleString()}`
          : formatDetailMetric(detailFieldValue("netWorth")),
      },
    ];

    return (
      <div className="space-y-5">
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white text-slate-900 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-white">
          <div className="grid grid-cols-2 divide-x divide-y divide-gray-100 sm:grid-cols-3 xl:grid-cols-6 xl:divide-y-0 dark:divide-gray-800">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="min-w-0 px-4 py-4 sm:px-5"
                title={`${metric.label}: ${metric.value || "-"}`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#4C78F5]">
                  {metric.label}
                </p>
                <p className="mt-1.5 truncate text-lg font-bold tabular-nums tracking-tight text-gray-900 dark:text-white">
                  {metric.value || "-"}
                </p>
              </div>
            ))}
          </div>
        </section>

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
      </div>
    );
  };

  const renderDocuments = () => {
    // Keep search input mounted during refetch so focus is not lost.
    if (documentsLoading && !documentsData) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-24">
          <Loader2 className="h-10 w-10 animate-spin text-brand-500" />
          <p className="text-sm text-slate-500">Loading documents...</p>
        </div>
      );
    }

    if (!documentsData) {
      return (
        <div className="py-20 text-center text-slate-400">
          No document data available.
        </div>
      );
    }

    const listRefreshing = documentsLoading && Boolean(documentsData);
    const totalDocuments =
      documentsData.totalDocumentsCount ??
      documentsPagination?.total ??
      documentsData.documents?.length ??
      0;

    const documentStatusClass = (status?: string | null) => {
      const normalized = (status || "").toUpperCase();
      if (normalized === "COMPLETED" || normalized === "COMPLETE") {
        return "bg-[#FFF9E6] text-[#856404] dark:bg-amber-500/10 dark:text-amber-300";
      }
      if (normalized === "PARTIAL") {
        return "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300";
      }
      if (normalized === "PENDING") {
        return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
      }
      if (normalized === "SKIPPED") {
        return "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";
      }
      return "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300";
    };

    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-600">
              Pending Documents
            </p>
            <p className="mt-2 text-[28px] font-bold leading-none tabular-nums text-amber-600">
              {documentsData.documentsPendingCount}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-500">
              Total Documents
            </p>
            <p className="mt-2 text-[28px] font-bold leading-none tabular-nums text-brand-500">
              {totalDocuments}
            </p>
          </div>
        </div>

        <div className="ds-table-wrap dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3.5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="text-[16px] font-semibold text-text-primary dark:text-white">
                Documents List
              </h2>
              {(documentSourceFilter !== "all" ||
                debouncedDocumentSearch.trim()) && (
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
                  Filtered
                </span>
              )}
            </div>

            <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-44">
                <Filter
                  size={15}
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-secondary"
                />
                <select
                  value={documentSourceFilter}
                  onChange={(e) => {
                    setDocumentSourceFilter(
                      e.target.value as DocumentSourceFilter,
                    );
                    setDocumentPage(1);
                  }}
                  className="h-10 w-full appearance-none rounded-xl border border-border bg-white py-2 pr-9 pl-9 text-sm text-text-primary outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white"
                >
                  <option value="all">All documents</option>
                  <option value="mine">My documents</option>
                  <option value="broker">Broker documents</option>
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-text-secondary"
                />
              </div>

              <div className="relative w-full sm:max-w-sm sm:w-56">
                <Search
                  size={15}
                  className="pointer-events-none absolute top-1/2 left-3.5 z-10 -translate-y-1/2 text-text-secondary"
                />
                <input
                  type="search"
                  value={documentSearchInput}
                  onChange={(e) => setDocumentSearchInput(e.target.value)}
                  placeholder="Search documents…"
                  className="h-10 w-full rounded-xl border border-border bg-white py-2 pr-9 pl-10 text-sm text-text-primary outline-none transition placeholder:text-text-secondary/70 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white"
                />
                {documentSearchInput ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDocumentSearchInput("");
                      setDebouncedDocumentSearch("");
                      setDocumentPage(1);
                    }}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-text-secondary transition hover:bg-surface hover:text-text-primary dark:hover:bg-slate-700"
                    aria-label="Clear search"
                  >
                    <SearchX size={14} />
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="relative">
            {listRefreshing ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-slate-900/70">
                <Loader2 className="h-7 w-7 animate-spin text-brand-500" />
              </div>
            ) : null}

            {documentsData.documents?.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                <SearchX className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-medium text-text-secondary">
                  {debouncedDocumentSearch.trim() ||
                  documentSourceFilter !== "all"
                    ? "No documents match your filters."
                    : "No documents available yet."}
                </p>
                {(debouncedDocumentSearch.trim() ||
                  documentSourceFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setDocumentSearchInput("");
                      setDebouncedDocumentSearch("");
                      setDocumentSourceFilter("all");
                      setDocumentPage(1);
                    }}
                    className="text-sm font-semibold text-brand-500 hover:text-brand-600"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="ds-table min-w-[760px]">
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Status</th>
                      <th>Source</th>
                      <th>Requested</th>
                      <th>Uploads</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documentsData.documents?.map((doc: any) => {
                      const requestDisplay = getDocumentRequestDisplay(doc);
                      const sourceDisplay =
                        getLenderDocumentSourceDisplay(doc);

                      return (
                        <tr key={doc.requirementId}>
                          <td>
                            <p className="ds-table-title">
                              {doc.documentName}
                            </p>
                            {doc.isRequired ? (
                              <p className="ds-table-meta">Required</p>
                            ) : (
                              <p className="ds-table-meta">Optional</p>
                            )}
                          </td>

                          <td>
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${documentStatusClass(doc.status)}`}
                            >
                              {formatDocumentStatusLabel(doc.status)}
                            </span>
                          </td>

                          <td>
                            <span
                              title={sourceDisplay.label}
                              className={`inline-flex max-w-[200px] truncate rounded-full px-2.5 py-1 text-[11px] font-semibold ${sourceDisplay.className}`}
                            >
                              {sourceDisplay.label}
                            </span>
                          </td>

                          <td>
                            <span className="ds-table-muted text-[12px]">
                              {requestDisplay?.date || "—"}
                            </span>
                          </td>

                          <td>
                            <span className="text-sm font-semibold tabular-nums text-brand-500">
                              {doc.uploadedCount}
                            </span>
                          </td>

                          <td className="text-right">
                            {doc.uploadedCount > 0 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  if (doc.uploadedCount === 1) {
                                    const file = doc.uploadedFiles[0];
                                    const resolvedUrl =
                                      resolveUploadedFileUrl(file.fileUrl);
                                    if (!resolvedUrl) return;

                                    setPreviewFile({
                                      url: resolvedUrl,
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
                                className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-1.5 text-[12px] font-semibold text-brand-500 transition hover:bg-brand-500 hover:text-white dark:bg-brand-500/15 dark:text-brand-300"
                              >
                                <Eye size={14} />
                                View
                                {doc.uploadedCount > 1
                                  ? ` (${doc.uploadedCount})`
                                  : ""}
                              </button>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-surface px-3 py-1.5 text-[11px] font-medium text-text-secondary dark:bg-slate-800">
                                No Files
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {documentsPagination && documentsPagination.totalPages > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-white px-4 py-3.5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[13px] text-text-secondary">
                Page {documentsPagination.page} of{" "}
                {documentsPagination.totalPages}
                {documentsPagination.total != null ? (
                  <span>
                    {" "}
                    ({documentsPagination.total} document
                    {documentsPagination.total === 1 ? "" : "s"}
                    {debouncedDocumentSearch.trim() ||
                    documentSourceFilter !== "all"
                      ? " found"
                      : ""}
                    )
                  </span>
                ) : null}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={documentPage === 1}
                  onClick={() => setDocumentPage((current) => current - 1)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3.5 py-2 text-sm font-medium text-text-primary transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>
                <button
                  type="button"
                  disabled={documentPage === documentsPagination.totalPages}
                  onClick={() => setDocumentPage((current) => current + 1)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3.5 py-2 text-sm font-medium text-text-primary transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  };
  const renderRequestDocs = () => {
    if (!canRequestDocuments) {
      return (
        <div className="rounded-2xl border border-border bg-white p-5 dark:border-slate-700 dark:bg-slate-900 sm:p-6">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-500">
            Document workflow
          </p>
          <h2 className="text-[18px] font-semibold tracking-tight text-text-primary dark:text-white">
            Request Documents
          </h2>
          <p className="mt-2 text-[13px] text-text-secondary">
            {requestDocumentsDisabledReason ||
              "Documents cannot be requested for this application."}
          </p>
        </div>
      );
    }

    const selectedProductLabel =
      getLenderProductLabel(selectedLenderProduct) ||
      (selectedLoanProduct
        ? formatLoanProduct(selectedLoanProduct)
        : "") ||
      "selected program";

    const searchTerm = requestDocsSearch.trim().toLowerCase();
    const filteredRequestDocs = (searchTerm
      ? docSelectModal.documents.filter((doc: any) => {
          const name = String(
            doc.documentName || doc.documentType?.name || "",
          ).toLowerCase();
          return name.includes(searchTerm);
        })
      : docSelectModal.documents
    ).filter((doc: any) =>
      Boolean(doc?.documentTypeId || doc?.id || doc?._id),
    );

    const selectedCount = docSelectModal.selectedDocs?.length || 0;

    const toggleRequestDoc = (docId: string, isChecked: boolean) => {
      const id = String(docId);
      const updated = isChecked
        ? (docSelectModal.selectedDocs || []).filter(
            (selectedId) => String(selectedId) !== id,
          )
        : [...new Set([...(docSelectModal.selectedDocs || []), id])];
      setDocSelectModal((prev) => ({ ...prev, selectedDocs: updated }));
    };

    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-border bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-500">
            Document workflow
          </p>
          <h2 className="text-[18px] font-semibold tracking-tight text-text-primary dark:text-white">
            Request Documents
          </h2>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-text-secondary">
            Choose required documents for {selectedProductLabel}, then send the
            request to the broker / borrower.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
              Loan program
            </label>
            <div className="relative">
              <select
                value={selectedLoanProduct}
                onChange={(e) => {
                  const value = String(e.target.value || "").trim();
                  setSelectedLoanProduct(value);
                  setRequestDocsSearch("");
                  if (!value) {
                    setDocSelectModal({
                      documents: [],
                      selectedDocs: [],
                      loading: false,
                    });
                  }
                }}
                disabled={loadingProducts}
                className="h-10 w-full appearance-none rounded-xl border border-border bg-white px-3 pr-9 text-sm text-text-primary outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-surface dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                <option value="">
                  {loadingProducts
                    ? "Loading loan products..."
                    : "Select loan program"}
                </option>
                {!loadingProducts &&
                  loanProducts.map((lp) => {
                    const optionCode = getLenderProductCode(lp);
                    if (!optionCode) return null;
                    const isAppProduct = isSameLoanProgramCode(
                      applicationLoanProductCode,
                      optionCode,
                    );
                    return (
                      <option key={lp.id || optionCode} value={optionCode}>
                        {getLenderProductLabel(lp)}
                        {isAppProduct ? " (this application)" : ""}
                      </option>
                    );
                  })}
              </select>
              <div className="pointer-events-none absolute top-1/2 right-3 flex -translate-y-1/2 items-center text-text-secondary">
                {loadingProducts ? (
                  <Loader2 className="h-4 w-4 animate-spin text-brand-500" />
                ) : (
                  <ChevronDown size={16} />
                )}
              </div>
            </div>

            {isApplicationDefaultSelected ? (
              <p className="mt-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                <span className="font-semibold">Default:</span> this application
                was submitted for{" "}
                <span className="font-semibold">
                  {getLenderProductLabel(selectedLenderProduct) ||
                    formatLoanProduct(applicationLoanProductCode)}
                </span>
                .
              </p>
            ) : applicationLoanProductCode && selectedLoanProduct ? (
              <p className="mt-2.5 text-[12px] text-amber-600 dark:text-amber-400">
                Application program is{" "}
                <button
                  type="button"
                  className="font-semibold underline"
                  onClick={() => {
                    if (defaultLoanProductCode) {
                      setSelectedLoanProduct(defaultLoanProductCode);
                    }
                  }}
                >
                  {formatLoanProduct(applicationLoanProductCode)}
                </button>
                . Showing a different program.
              </p>
            ) : applicationLoanProductCode && !defaultLoanProductCode ? (
              <p className="mt-2.5 text-[12px] text-amber-600 dark:text-amber-400">
                This application is for{" "}
                <span className="font-semibold">
                  {formatLoanProduct(applicationLoanProductCode)}
                </span>
                , but that program is not assigned yet.
              </p>
            ) : (
              <p className="mt-2.5 text-[12px] text-text-secondary">
                Choose a loan program to load product documents.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
              Custom document
            </label>
            {!selectedLoanProduct ? (
              <p className="rounded-xl border border-dashed border-border bg-surface/60 px-3 py-3 text-[12px] text-text-secondary">
                Select a loan program first to add a custom document.
              </p>
            ) : !selectedLenderProductId ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                This program is not assigned on your account, so new documents
                cannot be saved to it.
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
                    placeholder="Enter document name…"
                    disabled={addingDocument}
                    className="h-10 flex-1 rounded-xl border border-border bg-white px-3 text-sm text-text-primary outline-none transition placeholder:text-text-secondary/70 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddProductDocument}
                    disabled={addingDocument || newDocName.trim().length < 2}
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                  >
                    {addingDocument ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Plus size={16} />
                    )}
                    {addingDocument ? "Adding..." : "Add Document"}
                  </button>
                </div>
                <label className="mt-2.5 inline-flex cursor-pointer select-none items-center gap-2 text-[12px] text-text-secondary">
                  <input
                    type="checkbox"
                    checked={newDocRequired}
                    onChange={(e) => setNewDocRequired(e.target.checked)}
                    className="h-3.5 w-3.5 accent-brand-500"
                  />
                  Required for this loan program
                </label>
              </>
            )}
          </div>
        </div>

        {!selectedLoanProduct && !docSelectModal.loading ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white py-16 text-center dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
              <FileText size={22} />
            </div>
            <p className="text-sm font-semibold text-text-primary">
              Select a loan program
            </p>
            <p className="mt-1 max-w-sm text-[13px] text-text-secondary">
              Pick a program to view and request its documents.
            </p>
          </div>
        ) : (
          <div className="ds-table-wrap dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-col gap-3 border-b border-border px-4 py-3.5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-[16px] font-semibold text-text-primary dark:text-white">
                  Available documents
                </h3>
                <p className="text-[13px] text-text-secondary">
                  {docSelectModal.documents.length} document
                  {docSelectModal.documents.length === 1 ? "" : "s"}
                  {selectedCount > 0 ? ` · ${selectedCount} selected` : ""}
                </p>
              </div>

              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <div className="relative w-full sm:max-w-sm sm:w-56">
                  <Search
                    size={15}
                    className="pointer-events-none absolute top-1/2 left-3.5 z-10 -translate-y-1/2 text-text-secondary"
                  />
                  <input
                    type="search"
                    value={requestDocsSearch}
                    onChange={(e) => setRequestDocsSearch(e.target.value)}
                    placeholder="Search documents…"
                    className="h-10 w-full rounded-xl border border-border bg-white py-2 pr-9 pl-10 text-sm text-text-primary outline-none transition placeholder:text-text-secondary/70 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
                  />
                  {requestDocsSearch.trim() ? (
                    <button
                      type="button"
                      onClick={() => setRequestDocsSearch("")}
                      className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-text-secondary transition hover:bg-surface hover:text-text-primary"
                      aria-label="Clear search"
                    >
                      <X size={14} />
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setDocSelectModal((prev) => ({
                      ...prev,
                      selectedDocs:
                        prev.documents
                          ?.map((d: any) =>
                            String(d.documentTypeId || d.id || d._id || ""),
                          )
                          .filter(Boolean) || [],
                    }))
                  }
                  disabled={docSelectModal.documents.length === 0}
                  className="h-10 rounded-xl border border-border bg-white px-3 text-xs font-semibold text-text-primary transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDocSelectModal((prev) => ({
                      ...prev,
                      selectedDocs: [],
                    }))
                  }
                  disabled={selectedCount === 0}
                  className="h-10 rounded-xl border border-border bg-white px-3 text-xs font-semibold text-text-primary transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
            </div>

            {docSelectModal.loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                <p className="mt-3 text-sm text-text-secondary">
                  Loading documents...
                </p>
              </div>
            ) : docSelectModal.documents.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                  <FileText size={22} />
                </div>
                <p className="text-sm font-semibold text-text-primary">
                  No documents configured
                </p>
                <p className="mx-auto mt-1 max-w-sm text-[13px] text-text-secondary">
                  No product documents yet for {selectedProductLabel}. Add one
                  above to request it.
                </p>
              </div>
            ) : filteredRequestDocs.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                  <SearchX size={22} />
                </div>
                <p className="text-sm font-semibold text-text-primary">
                  No matches
                </p>
                <p className="mt-1 text-[13px] text-text-secondary">
                  No documents match “{requestDocsSearch.trim()}”.
                </p>
              </div>
            ) : (
              <div className="max-h-[min(480px,55vh)] overflow-auto">
                <table className="ds-table min-w-[720px]">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th className="w-12">
                        <span className="sr-only">Select</span>
                      </th>
                      <th>Document</th>
                      <th>Type</th>
                      <th>Requirement</th>
                      <th>Status</th>
                      <th>Last requested</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequestDocs.map((doc: any, index: number) => {
                      const docId = String(
                        doc.documentTypeId || doc.id || doc._id || "",
                      );
                      if (!docId) return null;
                      const isChecked =
                        docSelectModal.selectedDocs?.some(
                          (id) => String(id) === docId,
                        ) ?? false;
                      const requestHistory =
                        requestDocHistoryByTypeId[docId];
                      const isAlreadyRequested = Boolean(requestHistory);
                      const documentName =
                        doc.documentName ||
                        doc.documentType?.name ||
                        "Document";

                      return (
                        <tr
                          key={`${docId}-${doc.id || index}`}
                          onClick={() => toggleRequestDoc(docId, isChecked)}
                          className={`cursor-pointer ${
                            isChecked
                              ? "!bg-brand-50/70 dark:!bg-brand-500/10"
                              : ""
                          }`}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() =>
                                toggleRequestDoc(docId, isChecked)
                              }
                              onClick={(e) => e.stopPropagation()}
                              className="h-4 w-4 cursor-pointer accent-brand-500"
                              aria-label={`Select ${documentName}`}
                            />
                          </td>
                          <td>
                            <div className="flex min-w-0 items-center gap-2">
                              <p
                                className="ds-table-title"
                                title={documentName}
                              >
                                {documentName}
                              </p>
                              {isChecked ? (
                                <Check
                                  size={14}
                                  className="shrink-0 text-brand-500"
                                  strokeWidth={2.5}
                                />
                              ) : null}
                            </div>
                          </td>
                          <td>
                            {doc.isCustom ? (
                              <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200/80">
                                Custom
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200/80">
                                Standard
                              </span>
                            )}
                          </td>
                          <td>
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                doc.isRequired === false
                                  ? "bg-slate-100 text-slate-500"
                                  : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              {doc.isRequired === false
                                ? "Optional"
                                : "Required"}
                            </span>
                          </td>
                          <td>
                            {isAlreadyRequested ? (
                              <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-700 ring-1 ring-inset ring-violet-200/80">
                                Requested
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand-600 ring-1 ring-inset ring-brand-200/80">
                                Available
                              </span>
                            )}
                          </td>
                          <td>
                            {requestHistory ? (
                              <span className="ds-table-muted text-[12px]">
                                {formatDocumentTimelineDate(
                                  requestHistory.requestedAt,
                                )}
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                                Never requested
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text-primary dark:text-white">
                {selectedCount} document{selectedCount === 1 ? "" : "s"}{" "}
                selected
              </p>
              <p className="text-[13px] text-text-secondary">
                Broker / borrower will be notified after you send the request.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRequestDocuments}
              disabled={
                requestLoading ||
                !selectedLoanProduct ||
                selectedCount === 0
              }
              className="inline-flex min-w-[170px] items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              {requestLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Requesting...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Request Documents
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderLoi = () => {
    if (detailLoading && (loiGenerated || isLoi)) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#4C78F5] border-t-transparent" />
          <p className="text-sm text-slate-500">Loading LOI preview...</p>
        </div>
      );
    }

    if (loiLoading) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#4C78F5] border-t-transparent" />
          <p className="text-sm text-slate-500">Loading LOI preview...</p>
        </div>
      );
    }

    if (!loiGenerated && !hasSignedBrokerLoi && !loiUrl && !signedBrokerLoiUrl) {
      if (!canCreateLoi) {
        return (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-14 text-center dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#4C78F5]/10 text-[#4C78F5]">
              <FileText size={22} />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              No LOI yet
            </p>
            <p className="mt-1 max-w-sm text-xs text-slate-500">
              LOI has not been generated for this application yet.
            </p>
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-4 py-16 text-center dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[#4C78F5]/10 text-[#4C78F5]">
            <FileText size={26} />
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
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#4C78F5] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3A5FD4] disabled:opacity-50"
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
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#4C78F5] border-t-transparent" />
            <p className="text-sm text-slate-500">Loading LOI preview...</p>
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-14 text-center dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#4C78F5]/10 text-[#4C78F5]">
            <FileText size={22} />
          </div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Preview unavailable
          </p>
          <p className="mt-1 text-xs text-slate-500">
            LOI preview not available.
          </p>
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
    const activePreviewLabel =
      loiViewMode === "signed-broker"
        ? "Signed Broker LOI"
        : currentLoiVersion
          ? `Term Sheet · Version ${currentLoiVersion.versionNumber}`
          : "Loan Term Sheet";

    if (!activePreviewUrl) {
      return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-14 text-center dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#4C78F5]/10 text-[#4C78F5]">
            <FileText size={22} />
          </div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Preview unavailable
          </p>
          <p className="mt-1 text-xs text-slate-500">
            LOI preview not available.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {loiGenerated && !loiSentToBroker && (
          <div className="flex flex-col gap-3 rounded-xl border border-amber-200/90 bg-amber-50 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-amber-500/30 dark:bg-amber-500/10">
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
                <Eye size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                  Review before sending
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-amber-800/90 dark:text-amber-100/85">
                  This term sheet is saved as a draft. The broker will only see
                  it after you send it.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSendLoiToBroker}
              disabled={loiSendingToBroker}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#4C78F5] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3A5FD4] disabled:opacity-50"
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
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
              <CheckCircle size={16} />
            </div>
            <div className="min-w-0 text-sm text-emerald-900 dark:text-emerald-100">
              <p className="font-semibold">Sent to broker</p>
              <p className="mt-0.5 text-xs text-emerald-800/90 dark:text-emerald-100/85">
                {submissionDetail?.loiSentToBrokerAt
                  ? new Date(submissionDetail.loiSentToBrokerAt).toLocaleString()
                  : "Delivered"}
                {currentLoiVersion
                  ? ` · Version ${currentLoiVersion.versionNumber}`
                  : ""}
              </p>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          {loiVersions.length > 0 && (
            <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#4C78F5]/80">
                LOI Version History
              </p>
              <div className="flex flex-wrap gap-1.5">
                {loiVersions.map((version) => (
                  <span
                    key={version.id}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium ${
                      version.isCurrent
                        ? "bg-[#4C78F5] text-white"
                        : "border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    Version {version.versionNumber}
                    {version.status === "SENT_TO_BROKER" && " · Sent"}
                    {version.status === "SUPERSEDED" && " · Superseded"}
                    {version.isCurrent &&
                      version.status === "DRAFT" &&
                      " · Current draft"}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {hasSignedBrokerLoi && loiUrl ? (
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-600 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setLoiViewMode("lender")}
                    className={`rounded-md px-3.5 py-1.5 text-sm font-semibold transition ${
                      loiViewMode === "lender"
                        ? "bg-[#4C78F5] text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
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
                    className={`rounded-md px-3.5 py-1.5 text-sm font-semibold transition ${
                      loiViewMode === "signed-broker"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                    }`}
                  >
                    Signed LOI
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <FileText size={15} className="shrink-0 text-[#4C78F5]" />
                  Term Sheet / LOI
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canCreateLoi && loiGenerated && loiViewMode === "lender" ? (
                currentLoiIsDraft ? (
                  <button
                    type="button"
                    onClick={openRegenerateLoiForm}
                    disabled={loiLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#4C78F5]/25 bg-[#4C78F5]/5 px-3.5 py-2 text-sm font-semibold text-[#4C78F5] transition hover:bg-[#4C78F5]/10 disabled:opacity-50"
                  >
                    <RotateCcw size={15} />
                    Update Draft
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={openRevisedLoiForm}
                    disabled={loiLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#4C78F5]/25 bg-[#4C78F5]/5 px-3.5 py-2 text-sm font-semibold text-[#4C78F5] transition hover:bg-[#4C78F5]/10 disabled:opacity-50"
                  >
                    <RotateCcw size={15} />
                    Create Revised LOI (Version {nextRevisedVersionNumber})
                  </button>
                )
              ) : null}
              <button
                type="button"
                onClick={() =>
                  handleDownload(activePreviewUrl, activeDownloadName)
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Download size={15} />
                Download
              </button>
            </div>
          </div>

          {loiViewMode === "signed-broker" && signedBrokerLoi && (
            <div className="flex items-start gap-3 border-b border-emerald-100 bg-emerald-50/80 px-4 py-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                <CheckCircle size={15} />
              </div>
              <div className="min-w-0 text-sm text-emerald-900 dark:text-emerald-100">
                <p className="font-semibold">Client-signed broker LOI</p>
                <p className="mt-0.5 text-xs text-emerald-800/90 dark:text-emerald-100/85">
                  Forwarded by the broker
                  {signedBrokerLoi.versionLabel
                    ? ` · ${signedBrokerLoi.versionLabel}`
                    : ""}
                  {signedBrokerLoi.clientSignedAt
                    ? ` · signed ${new Date(signedBrokerLoi.clientSignedAt).toLocaleDateString()}`
                    : ""}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 border-b border-slate-100 bg-[#4C78F5]/[0.04] px-4 py-2.5 dark:border-slate-800 dark:bg-[#4C78F5]/15">
            <FileText size={14} className="shrink-0 text-[#4C78F5]" />
            <span className="truncate text-xs font-semibold text-[#4C78F5] dark:text-sky-200">
              {activePreviewLabel}
            </span>
            <span className="ml-auto hidden text-[11px] text-slate-500 sm:inline dark:text-slate-400">
              {activeDownloadName}
            </span>
          </div>

          <div className="h-[70vh] bg-slate-100 dark:bg-slate-950">
            <iframe
              src={activePreviewUrl}
              title={
                loiViewMode === "signed-broker"
                  ? "Signed Broker LOI"
                  : "Loan LOI"
              }
              className="h-full w-full"
            />
          </div>
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

  const previewTabSections = ([
    {
      id: "application" as const,
      label: "Application",
      items: [
        {
          id: "details",
          label: getVisibleTabLabel("details", "View Details"),
          icon: Eye,
          color: "text-[#4C78F5]",
        },
      ],
    },
    {
      id: "documents" as const,
      label: "Documents",
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
          disabledReason: requestDocumentsDisabledReason || undefined,
        },
        {
          id: "signDocuments",
          label: getVisibleTabLabel(
            "signDocuments",
            "Upload Forms",
          ),
          icon: FileText,
          color: "text-brand-600",
        },
        ...(showLoiTab
          ? [
              {
                id: "loi" as const,
                label: getVisibleTabLabel("loi", "LOI / Term Sheet"),
                icon: FileText,
                color: "text-brand-600",
              },
            ]
          : []),
      ]),
    },
    {
      id: "communication" as const,
      label: "Communication",
      items: [
        {
          id: "chat",
          label: getVisibleTabLabel("chat", "Chat"),
          icon: MessageSquare,
          color: "text-green-600",
        },
      ],
    },
  ] satisfies PreviewTabSection[]).filter((section) => section.items.length > 0);

  return (
    <div className="h-dvh w-full overflow-x-hidden overflow-y-auto bg-surface p-4 text-text-primary dark:bg-[#0b1120] dark:text-slate-100 md:p-6 lg:pl-[calc(260px+1.5rem)]">
      <div className="mx-auto w-full max-w-[1600px] space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={goBackToPipeline}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-white transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-800 dark:bg-slate-900"
                aria-label="Back to loan pipeline"
              >
                <ArrowLeft size={16} className="text-brand-500" />
              </button>

              <div className="min-w-0">
                <h1 className="text-[18px] font-semibold leading-tight tracking-tight text-text-primary dark:text-white">
                  Loan Application Preview
                </h1>
                <p className="mt-0.5 text-[12px] font-medium text-brand-500">
                  APP: {submissionDetail?.loanApplication?.applicationNumber || "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
            <div className="flex items-center gap-2">
              <NotificationDropdown />
              {submissionDetail?.status ? (
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getApplicationStatusColor(submissionDetail.status)}`}
                >
                  {formatApplicationStatus(submissionDetail.status)}
                </span>
              ) : null}
            </div>

            {(showApproval || showReject) && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {showApproval && (
                  <button
                    type="button"
                    onClick={() => openDecisionModal("APPROVED")}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    <CheckCircle size={16} />
                    {approvalButtonLabel}
                  </button>
                )}
                {showReject && (
                  <button
                    type="button"
                    onClick={() => openDecisionModal("DECLINED")}
                    className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
                  >
                    <XCircle size={16} />
                    Declined
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {submissionDetail && (
          <div className="grid w-full grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-white px-3.5 py-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                <User size={16} />
              </div>
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-500">
                  Borrower Name
                </span>
                <span
                  className="truncate text-sm font-semibold text-text-primary dark:text-white"
                  title={borrowerDisplayName || undefined}
                >
                  {borrowerDisplayName || "-"}
                </span>
              </div>
            </div>

            {submissionDetail.loanApplication?.brokerOrg && (
              <>
                <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-white px-3.5 py-3 dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                    <User size={16} />
                  </div>
                  <div
                    className="group/broker relative flex min-w-0 flex-col leading-tight"
                    tabIndex={0}
                    aria-label={`Broker name: ${submissionDetail.loanApplication.brokerOrg.name}`}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-500">
                      Broker Name
                    </span>
                    <span
                      className="truncate text-sm font-semibold text-text-primary dark:text-white"
                      title={submissionDetail.loanApplication.brokerOrg.name}
                    >
                      {submissionDetail.loanApplication.brokerOrg.name}
                    </span>
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 hidden w-max max-w-72 whitespace-normal rounded-lg bg-slate-950 px-3 py-2 text-xs font-medium leading-snug text-white group-hover/broker:block group-focus-within/broker:block dark:bg-white dark:text-slate-900"
                    >
                      {submissionDetail.loanApplication.brokerOrg.name}
                    </span>
                  </div>
                </div>

                <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-white px-3.5 py-3 dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                    <MdEmail size={16} />
                  </div>
                  <div
                    className="group/email relative flex min-w-0 flex-col leading-tight"
                    tabIndex={0}
                    aria-label={`Email: ${submissionDetail.loanApplication.brokerOrg.email || "—"}`}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-500">
                      Email
                    </span>
                    <span className="truncate text-sm font-semibold text-text-primary dark:text-white">
                      {submissionDetail.loanApplication.brokerOrg.email || "-"}
                    </span>
                    {submissionDetail.loanApplication.brokerOrg.email ? (
                      <span
                        role="tooltip"
                        className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 hidden w-max max-w-72 break-all rounded-lg bg-slate-950 px-3 py-2 text-xs font-medium leading-snug text-white group-hover/email:block group-focus-within/email:block dark:bg-white dark:text-slate-900"
                      >
                        {submissionDetail.loanApplication.brokerOrg.email}
                      </span>
                    ) : null}
                  </div>
                </div>
              </>
            )}

            <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-white px-3.5 py-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                <BiLogoProductHunt size={16} />
              </div>
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-500">
                  Loan Product
                </span>
                <span
                  className="truncate text-sm font-semibold text-text-primary dark:text-white"
                  title={resolvedLoanProductName || undefined}
                >
                  {resolvedLoanProductName || "-"}
                </span>
              </div>
            </div>

            <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-white px-3.5 py-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                <FaDollarSign size={14} />
              </div>
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-500">
                  Loan Amount Requested
                </span>
                <span className="truncate text-sm font-bold tabular-nums text-brand-500 dark:text-sky-200">
                  {loanAmount
                    ? `$${Number(loanAmount).toLocaleString()}`
                    : "-"}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-6 lg:block">
          <aside className="w-full shrink-0 lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-[260px] lg:flex-col lg:border-r lg:border-border lg:bg-white dark:lg:border-slate-800 dark:lg:bg-slate-900">
            <div className="relative hidden shrink-0 overflow-hidden border-b border-border px-4 py-5 dark:border-slate-800 lg:block">
              <div className="relative flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-brand-500 ring-2 ring-brand-100">
                  <img
                    src="/loanAutomation.jpeg"
                    alt="Loan Automation"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-text-primary dark:text-white">
                    LoanAutomation
                  </p>
                  <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                    Lender Suite
                  </p>
                </div>
              </div>
            </div>

            <nav
              aria-label="Loan preview sections"
              className="overflow-hidden rounded-2xl border border-border bg-white dark:border-slate-800 dark:bg-slate-900 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:rounded-none lg:border-0"
            >
              {previewTabSections.map((section, sectionIndex) => (
                <div
                  key={section.id}
                  className={
                    sectionIndex > 0
                      ? "border-t border-border dark:border-slate-800"
                      : ""
                  }
                >
                  <p className="px-4 pt-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
                    {section.label}
                  </p>
                  <div className="space-y-1 px-2 pb-3">
                    {section.items.map((tab: PreviewTabItem) => {
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
                          className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                            isActive
                              ? "bg-brand-500 text-white"
                              : isDisabled
                                ? "cursor-not-allowed text-slate-400 opacity-50"
                                : "text-text-secondary hover:bg-surface hover:text-text-primary dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                          }`}
                        >
                          <Icon
                            size={16}
                            className={isActive ? "text-white" : tab.color}
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {tab.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className="hidden shrink-0 border-t border-border p-3 dark:border-slate-800 lg:block">
              <button
                type="button"
                onClick={goBackToPipeline}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-text-secondary transition hover:bg-surface hover:text-text-primary dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <ArrowLeft size={16} className="shrink-0 text-brand-500" />
                <span>Back</span>
              </button>
            </div>
          </aside>

          <main className="min-w-0 flex-1">
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
          </main>
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
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-brand-500 transition-all group"
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
                          onClick={() => {
                            const resolvedUrl = resolveUploadedFileUrl(
                              file.fileUrl,
                            );
                            if (!resolvedUrl) return;
                            setPreviewFile({
                              url: resolvedUrl,
                              type: file.fileMimeType,
                              name: file.fileName,
                            });
                          }}
                          className="flex-1 py-2 text-xs font-bold bg-brand-50 text-brand-600 dark:bg-brand-600/10 dark:text-brand-400 rounded-lg hover:bg-brand-600 hover:text-white transition-all flex items-center justify-center gap-1"
                        >
                          <Eye size={14} /> Preview
                        </button>
                        <button
                          onClick={() => {
                            const resolvedUrl = resolveUploadedFileUrl(
                              file.fileUrl,
                            );
                            if (!resolvedUrl) return;
                            handleDownload(resolvedUrl, file.fileName);
                          }}
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

              <div className="flex min-h-0 flex-1 overflow-hidden bg-slate-100 p-4 dark:bg-slate-950">
                <EmbeddedFilePreview
                  remoteUrl={previewFile.url}
                  mimeType={previewFile.type}
                  fileName={previewFile.name}
                  getAuthHeaders={() =>
                    Object.fromEntries(
                      Object.entries(
                        getAuthHeaders() as Record<string, string>,
                      ),
                    )
                  }
                  className="flex h-full min-h-0 w-full flex-1 items-center justify-center"
                  iframeClassName="h-full w-full rounded-lg border-none bg-white"
                  imageClassName="max-h-full max-w-full rounded-lg object-contain"
                />
              </div>
            </div>
          </div>,
          document.body,
        )}

      {decisionModal.type &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-[#4C78F5]/40 p-4 backdrop-blur-[2px]">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="decision-modal-title"
              className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
            >
              <div
                className={`flex items-start justify-between gap-3 border-b px-5 py-4 dark:border-slate-800 ${
                  decisionModal.type === "APPROVED"
                    ? "border-emerald-100 bg-emerald-50/50 dark:bg-emerald-950/20"
                    : "border-rose-100 bg-rose-50/50 dark:bg-rose-950/20"
                }`}
              >
                <div className="min-w-0">
                  <p
                    className={`mb-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                      decisionModal.type === "APPROVED"
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-rose-700 dark:text-rose-300"
                    }`}
                  >
                    Lender decision
                  </p>
                  <h2
                    id="decision-modal-title"
                    className="text-lg font-bold tracking-tight text-slate-900 dark:text-white"
                  >
                    {decisionModal.type === "APPROVED"
                      ? "Final Approval"
                      : "Declined Application"}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {decisionModal.type === "APPROVED"
                      ? "Confirm approved amount, rate, and notes for this application."
                      : "Provide a clear reason before declining this application."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeDecisionModal}
                  disabled={decisionSubmitting}
                  className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4 p-5">
                {decisionModal.type === "APPROVED" && (
                  <>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Approved Amount{" "}
                        <span className="text-rose-500">*</span>
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
                        className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-2 dark:bg-slate-950 ${
                          decisionFormErrors.approvedAmount
                            ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20"
                            : "border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20 dark:border-slate-700"
                        }`}
                      />
                      {decisionFormErrors.approvedAmount && (
                        <p className="mt-1.5 text-xs text-rose-600">
                          {decisionFormErrors.approvedAmount}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Interest Rate (%){" "}
                        <span className="text-rose-500">*</span>
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
                        className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-2 dark:bg-slate-950 ${
                          decisionFormErrors.interestRate
                            ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20"
                            : "border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20 dark:border-slate-700"
                        }`}
                      />
                      {decisionFormErrors.interestRate ? (
                        <p className="mt-1.5 text-xs text-rose-600">
                          {decisionFormErrors.interestRate}
                        </p>
                      ) : (
                        <p className="mt-1.5 text-xs text-slate-500">
                          Enter a rate greater than 0 and up to 100 (max 2
                          decimal places).
                        </p>
                      )}
                    </div>
                  </>
                )}

                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Notes <span className="text-rose-500">*</span>
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
                    className={`w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-2 dark:bg-slate-950 ${
                      decisionFormErrors.notes
                        ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20"
                        : decisionModal.type === "APPROVED"
                          ? "border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20 dark:border-slate-700"
                          : "border-slate-200 focus:border-rose-400 focus:ring-rose-500/20 dark:border-slate-700"
                    }`}
                  />
                  {decisionFormErrors.notes && (
                    <p className="mt-1.5 text-xs text-rose-600">
                      {decisionFormErrors.notes}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end dark:border-slate-800">
                <button
                  type="button"
                  onClick={closeDecisionModal}
                  disabled={decisionSubmitting}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
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
                  className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 ${
                    decisionModal.type === "APPROVED"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {decisionSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Processing...
                    </>
                  ) : decisionModal.type === "APPROVED" ? (
                    <>
                      <CheckCircle size={16} />
                      Confirm Final Approval
                    </>
                  ) : (
                    <>
                      <XCircle size={16} />
                      Confirm Declined
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
