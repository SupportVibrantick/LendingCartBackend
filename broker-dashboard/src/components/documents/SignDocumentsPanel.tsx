import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import SignatureCanvas from "react-signature-canvas";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileImage,
  FileText,
  Loader2,
  PenLine,
  Search,
  SendHorizonal,
  Upload,
  X,
} from "lucide-react";
import { buildApiPublicFileUrl } from "../../lib/publicFileUrl";
import MultiSelect from "../form/MultiSelect";
import EmbeddedFilePreview from "./EmbeddedFilePreview";
import SignFormFiller from "./SignFormFiller";

const SigCanvas = SignatureCanvas as unknown as React.FC<any>;

const sanitizeDownloadName = (value: string) =>
  value.replace(/[<>:"/\\|?*\n\r]+/g, "-").trim() || "document";

const documentNameFromFile = (file: File) => {
  const base = file.name.replace(/\.[^.]+$/, "").trim();
  return base.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
};

const handleSignDocumentFileSelection = (
  file: File | null,
  currentName: string,
  setFile: (file: File | null) => void,
  setName: (name: string) => void,
) => {
  setFile(file);
  if (file && !currentName.trim()) {
    setName(documentNameFromFile(file));
  }
};

const getDownloadExtension = (
  mime?: string | null,
  url?: string | null,
  fallbackFileName?: string | null,
) => {
  const fromFileName = fallbackFileName
    ? fallbackFileName.match(/(\.[a-z0-9]+)$/i)?.[1]
    : null;
  if (fromFileName) return fromFileName.toLowerCase();

  const fromUrl = url?.match(/(\.[a-z0-9]+)(?:\?|$)/i)?.[1];
  if (fromUrl) return fromUrl.toLowerCase();

  const mimeValue = (mime || "").toLowerCase();
  if (mimeValue.includes("pdf")) return ".pdf";
  if (mimeValue.includes("jpeg") || mimeValue.includes("jpg")) return ".jpg";
  if (mimeValue.includes("png")) return ".png";
  if (mimeValue.includes("webp")) return ".webp";
  return "";
};

export type SignDocumentRow = {
  requirementId: string;
  documentName: string;
  signStatus?: string | null;
  signStatusLabel?: string | null;
  signMode?: string | null;
  formProcessingStatus?: string | null;
  activeFormVersionId?: string | null;
  fieldCount?: number | null;
  hasSignatureField?: boolean | null;
  formProgress?: {
    client: { required: number; filled: number; total: number; complete: boolean };
    broker: { required: number; filled: number; total: number; complete: boolean };
    all: { required: number; filled: number; total: number; complete: boolean };
  } | null;
  workflowHint?: string | null;
  brokerBucket?: string | null;
  lenderBucket?: string | null;
  clientBucket?: string | null;
  templateFileName?: string | null;
  templateFileUrl?: string | null;
  templateMimeType?: string | null;
  lenderName?: string | null;
  lenderOrgId?: string | null;
  requestApplicationLenderId?: string | null;
  loanProductName?: string | null;
  loanProductCode?: string | null;
  requestedAt?: string | null;
  signedUpload?: {
    uploadId: string;
    fileName: string;
    fileUrl: string;
    fileMimeType?: string | null;
    clientSignatureData?: string | null;
  } | null;
  loiVersionNumber?: number;
  loiVersionLabel?: string;
  isBrokerLoi?: boolean;
  isStandaloneBrokerLoi?: boolean;
  source?: string | null;
  isBrokerUploaded?: boolean;
};

function isBrokerTermSheetDoc(row: SignDocumentRow) {
  if (row.isBrokerLoi) return true;
  return /\/broker\/LOI\//i.test(row.templateFileUrl || "");
}

function isStandaloneBrokerTermSheet(row: SignDocumentRow) {
  if (row.isStandaloneBrokerLoi) return true;
  return (
    isBrokerTermSheetDoc(row) &&
    !row.requestApplicationLenderId &&
    !row.lenderName
  );
}

function isBrokerUploadedDoc(row: SignDocumentRow) {
  return Boolean(row.isBrokerUploaded || row.source === "BROKER_ADDED");
}

function isBulkSelectableRow(row: SignDocumentRow) {
  return (
    row.signStatus === "AWAITING_BROKER" || row.signStatus === "CLIENT_SIGNED"
  );
}

const BROKER_SIGN_DOCUMENTS_FETCH_LIMIT = 50;

function getForwardToLenderLabel(
  row: SignDocumentRow,
  selectedLenderCount = 0,
) {
  const lenderSuffix =
    selectedLenderCount > 1
      ? ` to ${selectedLenderCount} lenders`
      : row.lenderName
        ? ` to ${row.lenderName}`
        : "";
  if (isBrokerTermSheetDoc(row)) {
    return `Forward signed term sheet${lenderSuffix}`;
  }
  return `Forward signed form${lenderSuffix}`;
}

function isBrokerFormForwardedToLender(row: SignDocumentRow) {
  return (
    row.signStatus === "FORWARDED_TO_LENDER" ||
    row.signStatus === "LENDER_SEEN"
  );
}

function getBrokerDynamicFormActionLabel(row: SignDocumentRow) {
  if (row.signMode !== "DYNAMIC_FORM") return "Template";
  return isBrokerFormForwardedToLender(row) ? "View form" : "Fill form";
}

function isClientFormSubmittedToBroker(row: SignDocumentRow) {
  if (row.signMode !== "DYNAMIC_FORM") return false;
  if (
    row.signStatus === "CLIENT_SIGNED" ||
    row.signStatus === "FORWARDED_TO_LENDER" ||
    row.signStatus === "LENDER_SEEN"
  ) {
    return true;
  }
  return (
    row.signStatus === "SENT_TO_CLIENT" &&
    row.clientBucket === "waitingOnBroker"
  );
}

function getClientDynamicFormActionLabel(row: SignDocumentRow) {
  if (row.signMode !== "DYNAMIC_FORM") return "Template";
  return isClientFormSubmittedToBroker(row) ? "View form" : "Fill form";
}

type PreviousSignedLoiVersion = {
  versionNumber: number;
  label: string;
  signedPdfUrl: string;
  clientSignedAt?: string | null;
  status: string;
};

type ClientPortalView = "termSheet" | "signForms";

type SignDocumentsPanelProps = {
  mode: "lender" | "broker" | "client";
  apiBase: string;
  getAuthHeaders: () => Record<string, string>;
  applicationLenderId?: string;
  submissionId?: string;
  loanApplicationId?: string;
  apiRolePrefix?: "broker" | "loanofficer";
  onUpdated?: () => void;
  clientName?: string;
  applicationNumber?: string;
  /** Client portal: show only term sheets or lender signable forms */
  clientView?: ClientPortalView;
};

const BROKER_SIGN_DOCUMENTS_PAGE_SIZE = 9;
const CLIENT_SIGN_DOCUMENTS_PAGE_SIZE = 9;

type ClientSignDocumentsBucket =
  | "all"
  | "actionRequired"
  | "waitingOnBroker"
  | "completed";

type ClientSignDocumentsSummary = {
  actionRequired: number;
  waitingOnBroker: number;
  completed: number;
};

const CLIENT_BUCKET_FILTERS: Array<{
  key: ClientSignDocumentsBucket;
  label: string;
  summaryKey?: keyof ClientSignDocumentsSummary;
  wrap: string;
  num: string;
}> = [
  { key: "all", label: "All forms", wrap: "bg-slate-50 ring-slate-200", num: "text-slate-700" },
  {
    key: "actionRequired",
    label: "Action needed",
    summaryKey: "actionRequired",
    wrap: "bg-amber-50 ring-amber-100",
    num: "text-amber-700",
  },
  {
    key: "waitingOnBroker",
    label: "With broker",
    summaryKey: "waitingOnBroker",
    wrap: "bg-sky-50 ring-sky-100",
    num: "text-sky-700",
  },
  {
    key: "completed",
    label: "Completed",
    summaryKey: "completed",
    wrap: "bg-emerald-50 ring-emerald-100",
    num: "text-emerald-700",
  },
];

type SignDocumentsPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type BrokerSignDocumentsSummary = {
  awaitingYou: number;
  withClient: number;
  readyToForward: number;
  forwarded: number;
};

type BrokerLenderGroupSummary = {
  key: string;
  lenderName: string;
  loanProductName?: string | null;
  count: number;
};

const statusClass = (status?: string | null) => {
  switch (status) {
    case "AWAITING_BROKER":
      return "bg-amber-100 text-amber-800";
    case "SENT_TO_CLIENT":
      return "bg-blue-100 text-blue-800";
    case "CLIENT_SIGNED":
      return "bg-emerald-100 text-emerald-800";
    case "FORWARDED_TO_LENDER":
      return "bg-violet-100 text-violet-800";
    case "LENDER_SEEN":
      return "bg-teal-100 text-teal-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
};

export default function SignDocumentsPanel({
  mode,
  apiBase,
  getAuthHeaders,
  applicationLenderId,
  submissionId,
  loanApplicationId,
  apiRolePrefix = "broker",
  onUpdated,
  clientName,
  applicationNumber,
  clientView,
}: SignDocumentsPanelProps) {
  const navigate = useNavigate();
  const isClientMode = mode === "client";
  const isBrokerMode = mode === "broker";
  const isLenderMode = mode === "lender";

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<SignDocumentRow[]>([]);
  const [previousSignedLoiVersions, setPreviousSignedLoiVersions] = useState<
    PreviousSignedLoiVersion[]
  >([]);
  const [uploadName, setUploadName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDragOver, setUploadDragOver] = useState(false);
  const [brokerViewTab, setBrokerViewTab] = useState<"upload" | "documents">(
    "documents",
  );
  const [uploading, setUploading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [activeSigningDoc, setActiveSigningDoc] =
    useState<SignDocumentRow | null>(null);
  const [activeSignedViewDoc, setActiveSignedViewDoc] =
    useState<SignDocumentRow | null>(null);
  const [activeTemplateViewDoc, setActiveTemplateViewDoc] =
    useState<SignDocumentRow | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectedLenderKey, setSelectedLenderKey] = useState<string>("all");
  const [forwardLenderByRequirement, setForwardLenderByRequirement] = useState<
    Record<string, string>
  >({});
  const [forwardableLenders, setForwardableLenders] = useState<
    Array<{ applicationLenderId: string; lenderName: string }>
  >([]);
  const forwardableLenderSelectOptions = useMemo(
    () =>
      forwardableLenders.map((lender) => ({
        value: lender.applicationLenderId,
        text: lender.lenderName,
      })),
    [forwardableLenders],
  );
  const [forwardLenderIdsByRequirement, setForwardLenderIdsByRequirement] =
    useState<Record<string, string[]>>({});
  const [bulkForwardLenderIds, setBulkForwardLenderIds] = useState<string[]>(
    [],
  );
  const [selectedRequirementIds, setSelectedRequirementIds] = useState<
    Set<string>
  >(() => new Set());
  const [selectedRowStatuses, setSelectedRowStatuses] = useState<
    Record<string, string>
  >({});
  const [selectAllLoading, setSelectAllLoading] = useState(false);
  const [selectAllActive, setSelectAllActive] = useState(false);
  const [isSubmittingSignature, setIsSubmittingSignature] = useState(false);
  const [fillingDoc, setFillingDoc] = useState<SignDocumentRow | null>(null);
  const [brokerSearchInput, setBrokerSearchInput] = useState("");
  const [debouncedBrokerSearch, setDebouncedBrokerSearch] = useState("");
  const [brokerPage, setBrokerPage] = useState(1);
  const [brokerPagination, setBrokerPagination] =
    useState<SignDocumentsPagination | null>(null);
  const [brokerSummary, setBrokerSummary] = useState<BrokerSignDocumentsSummary>({
    awaitingYou: 0,
    withClient: 0,
    readyToForward: 0,
    forwarded: 0,
  });
  const [brokerLenderGroups, setBrokerLenderGroups] = useState<
    BrokerLenderGroupSummary[]
  >([]);
  const [clientBucket, setClientBucket] =
    useState<ClientSignDocumentsBucket>("all");
  const [clientPage, setClientPage] = useState(1);
  const [clientSearchInput, setClientSearchInput] = useState("");
  const [debouncedClientSearch, setDebouncedClientSearch] = useState("");
  const [clientPagination, setClientPagination] =
    useState<SignDocumentsPagination | null>(null);
  const [clientSummary, setClientSummary] = useState<ClientSignDocumentsSummary>(
    {
      actionRequired: 0,
      waitingOnBroker: 0,
      completed: 0,
    },
  );
  const sigRef = useRef<SignatureCanvas | null>(null);
  const uploadFileInputRef = useRef<HTMLInputElement | null>(null);

  const openClientSignPage = (
    pageMode: "template" | "sign" | "fill",
    row: SignDocumentRow,
  ) => {
    if (!loanApplicationId) {
      toast.error("Missing application context");
      return;
    }
    const qs = new URLSearchParams({
      mode: pageMode,
      loanApplicationId,
      requirementId: row.requirementId,
      documentName: row.documentName || "Document",
      resumeTab: isBrokerTermSheetDoc(row) ? "termSheet" : "signForms",
    });
    navigate(`/client-portal/sign-document?${qs.toString()}`);
  };

  /** Broker: fillable forms open the editor; signature-only stays view-only preview. */
  const openBrokerTemplate = (row: SignDocumentRow) => {
    if (row.signMode === "DYNAMIC_FORM") {
      setActiveTemplateViewDoc(null);
      setFillingDoc(row);
      return;
    }
    setActiveTemplateViewDoc(row);
  };

  const fetchForwardableLenders = async () => {
    if (!isBrokerMode || !loanApplicationId) return;
    try {
      const res = await fetch(
        `${apiBase}/${apiRolePrefix}/loan-pipeline/${loanApplicationId}/broker-loi`,
        { headers: getAuthHeaders() },
      );
      const json = await res.json();
      if (
        res.ok &&
        json.success &&
        Array.isArray(json.data?.forwardableLenders) &&
        json.data.forwardableLenders.length > 0
      ) {
        setForwardableLenders(json.data.forwardableLenders);
        return;
      }
    } catch {
      /* optional */
    }

    try {
      const res = await fetch(
        `${apiBase}/${apiRolePrefix}/loan-pipeline/${loanApplicationId}/submitted-lenders`,
        { headers: getAuthHeaders() },
      );
      const json = await res.json();
      const list = Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json?.lenders)
          ? json.lenders
          : [];
      setForwardableLenders(
        list
          .map((item: any) => ({
            applicationLenderId:
              item.applicationLenderId || item.id || "",
            lenderName: item.lenderName || item.lender?.name || "Lender",
          }))
          .filter((item: { applicationLenderId: string }) =>
            Boolean(item.applicationLenderId),
          ),
      );
    } catch {
      /* optional */
    }
  };

  const fetchRows = async (options?: {
    page?: number;
    search?: string;
    lenderId?: string;
    bucket?: ClientSignDocumentsBucket;
  }) => {
    try {
      setLoading(true);
      let url = "";

      if (isLenderMode && applicationLenderId) {
        url = `${apiBase}/lender/loan-pipeline/${applicationLenderId}/sign-documents`;
      } else if (isBrokerMode && submissionId) {
        const pageNumber = options?.page ?? brokerPage;
        const searchValue = options?.search ?? debouncedBrokerSearch;
        const lenderFilter = options?.lenderId ?? selectedLenderKey;
        const params = new URLSearchParams({
          page: String(pageNumber),
          limit: String(BROKER_SIGN_DOCUMENTS_PAGE_SIZE),
        });
        if (searchValue.trim()) {
          params.set("search", searchValue.trim());
        }
        if (lenderFilter && lenderFilter !== "all") {
          params.set("lenderId", lenderFilter);
        }
        url = `${apiBase}/${apiRolePrefix}/loan-pipeline/submissions/${submissionId}/sign-documents?${params.toString()}`;
      } else if (isClientMode && loanApplicationId) {
        const pageNumber = options?.page ?? clientPage;
        const bucketFilter = options?.bucket ?? clientBucket;
        const searchValue = options?.search ?? debouncedClientSearch;
        const params = new URLSearchParams({
          page: String(pageNumber),
          limit: String(CLIENT_SIGN_DOCUMENTS_PAGE_SIZE),
          scope: clientView || "all",
          bucket: bucketFilter,
        });
        if (searchValue.trim()) {
          params.set("search", searchValue.trim());
        }
        url = `${apiBase}/client-portal/applications/${loanApplicationId}/sign-documents?${params.toString()}`;
      } else {
        return;
      }

      const res = await fetch(url, { headers: getAuthHeaders() });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load sign documents");
      }

      setRows(json.data || []);
      if (isBrokerMode) {
        setBrokerPagination(json.pagination || null);
        setBrokerSummary(
          json.summary || {
            awaitingYou: 0,
            withClient: 0,
            readyToForward: 0,
            forwarded: 0,
          },
        );
        setBrokerLenderGroups(json.lenderGroups || []);
        if (Array.isArray(json.forwardableLenders)) {
          setForwardableLenders(json.forwardableLenders);
        }
      }
      if (isClientMode) {
        setClientPagination(json.pagination || null);
        setClientSummary(
          json.summary || {
            actionRequired: 0,
            waitingOnBroker: 0,
            completed: 0,
          },
        );
      }
      setPreviousSignedLoiVersions(
        isClientMode ? json.previousSignedLoiVersions || [] : [],
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to load sign documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isBrokerMode) return;

    const timer = window.setTimeout(() => {
      setDebouncedBrokerSearch(brokerSearchInput);
      setBrokerPage(1);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [isBrokerMode, brokerSearchInput]);

  useEffect(() => {
    if (!isBrokerMode) return;
    setBrokerPage(1);
    setSelectedRequirementIds(new Set());
    setSelectedRowStatuses({});
    setSelectAllActive(false);
    setBulkForwardLenderIds([]);
  }, [selectedLenderKey, isBrokerMode]);

  useEffect(() => {
    if (!isBrokerMode) return;
    setSelectedRequirementIds(new Set());
    setSelectedRowStatuses({});
    setSelectAllActive(false);
    setBulkForwardLenderIds([]);
  }, [debouncedBrokerSearch, isBrokerMode]);

  useEffect(() => {
    if (!isBrokerMode) return;
    setSelectedRequirementIds(new Set());
    setSelectedRowStatuses({});
    setSelectAllActive(false);
    setBulkForwardLenderIds([]);
  }, [brokerPage, isBrokerMode]);

  useEffect(() => {
    if (!isClientMode) return;

    const timer = window.setTimeout(() => {
      setDebouncedClientSearch(clientSearchInput);
      setClientPage(1);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [isClientMode, clientSearchInput]);

  useEffect(() => {
    if (!isClientMode) return;
    setClientBucket("all");
    setClientPage(1);
    setClientSearchInput("");
    setDebouncedClientSearch("");
  }, [clientView, isClientMode]);

  useEffect(() => {
    if (!isClientMode) return;
    setClientPage(1);
  }, [clientBucket, isClientMode]);

  useEffect(() => {
    if (isBrokerMode && brokerViewTab !== "documents") return;
    fetchRows();
  }, [
    mode,
    applicationLenderId,
    submissionId,
    loanApplicationId,
    apiRolePrefix,
    debouncedBrokerSearch,
    brokerPage,
    selectedLenderKey,
    clientView,
    clientBucket,
    clientPage,
    debouncedClientSearch,
    brokerViewTab,
  ]);

  useEffect(() => {
    if (activeSigningDoc?.signMode !== "DYNAMIC_FORM") return;
    setFillingDoc(activeSigningDoc);
    setActiveSigningDoc(null);
    sigRef.current?.clear();
  }, [activeSigningDoc]);

  useEffect(() => {
    if (activeTemplateViewDoc?.signMode !== "DYNAMIC_FORM") return;
    setFillingDoc(activeTemplateViewDoc);
    setActiveTemplateViewDoc(null);
  }, [activeTemplateViewDoc]);

  useEffect(() => {
    if (isBrokerMode && loanApplicationId) {
      void fetchForwardableLenders();
    }
  }, [isBrokerMode, loanApplicationId, apiRolePrefix]);

  useEffect(() => {
    if (!activeSigningDoc && !activeSignedViewDoc && !activeTemplateViewDoc) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmittingSignature) {
        setActiveSigningDoc(null);
        setActiveSignedViewDoc(null);
        setActiveTemplateViewDoc(null);
        sigRef.current?.clear();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [
    activeSigningDoc,
    activeSignedViewDoc,
    activeTemplateViewDoc,
    isSubmittingSignature,
  ]);

  const handleBrokerUpload = async () => {
    if (!submissionId || !uploadFile) {
      toast.error("Select a PDF or image file");
      return;
    }

    if (!uploadName.trim()) {
      toast.error("Enter a document name");
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("documentName", uploadName.trim());

      const res = await fetch(
        `${apiBase}/${apiRolePrefix}/loan-pipeline/submissions/${submissionId}/sign-documents`,
        {
          method: "POST",
          headers: Object.fromEntries(
            Object.entries(getAuthHeaders() as Record<string, string>).filter(
              ([key]) => key.toLowerCase() !== "content-type",
            ),
          ),
          body: formData,
        },
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Upload failed");
      }

      toast.success(json.message || "Form uploaded");
      setUploadName("");
      setUploadFile(null);
      if (uploadFileInputRef.current) {
        uploadFileInputRef.current.value = "";
      }
      setSelectedLenderKey("broker-uploads");
      setBrokerViewTab("documents");
      await fetchRows();
      onUpdated?.();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const toggleRequirementSelection = (row: SignDocumentRow) => {
    setSelectAllActive(false);
    setSelectedRequirementIds((prev) => {
      const next = new Set(prev);
      if (next.has(row.requirementId)) {
        next.delete(row.requirementId);
        setSelectedRowStatuses((statuses) => {
          const { [row.requirementId]: _removed, ...rest } = statuses;
          return rest;
        });
      } else {
        next.add(row.requirementId);
        setSelectedRowStatuses((statuses) => ({
          ...statuses,
          [row.requirementId]: row.signStatus || "",
        }));
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedRequirementIds(new Set());
    setSelectedRowStatuses({});
    setSelectAllActive(false);
    setBulkForwardLenderIds([]);
  };

  const fetchAllMatchingSignDocuments = async (): Promise<SignDocumentRow[]> => {
    if (!submissionId) return [];

    const pageSize = BROKER_SIGN_DOCUMENTS_FETCH_LIMIT;
    let page = 1;
    let totalPages = 1;
    const allRows: SignDocumentRow[] = [];

    while (page <= totalPages) {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (debouncedBrokerSearch.trim()) {
        params.set("search", debouncedBrokerSearch.trim());
      }
      if (selectedLenderKey && selectedLenderKey !== "all") {
        params.set("lenderId", selectedLenderKey);
      }

      const res = await fetch(
        `${apiBase}/${apiRolePrefix}/loan-pipeline/submissions/${submissionId}/sign-documents?${params.toString()}`,
        { headers: getAuthHeaders() },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load documents");
      }

      allRows.push(...(json.data || []));
      totalPages = json.pagination?.totalPages || 1;
      page += 1;
    }

    return allRows;
  };

  const selectAllMatchingFilter = async () => {
    if (!submissionId) return;

    try {
      setSelectAllLoading(true);
      const allRows = await fetchAllMatchingSignDocuments();
      const eligible = allRows.filter(isBulkSelectableRow);

      if (!eligible.length) {
        toast.error("No documents are eligible for bulk actions");
        return;
      }

      setSelectedRequirementIds(
        new Set(eligible.map((row) => row.requirementId)),
      );
      setSelectedRowStatuses(
        Object.fromEntries(
          eligible.map((row) => [row.requirementId, row.signStatus || ""]),
        ),
      );
      setSelectAllActive(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to select documents");
    } finally {
      setSelectAllLoading(false);
    }
  };

  const handleSelectAllToggle = async () => {
    if (selectAllActive) {
      clearSelection();
      return;
    }
    await selectAllMatchingFilter();
  };

  const getSelectedSendIds = () =>
    Object.entries(selectedRowStatuses)
      .filter(([, status]) => status === "AWAITING_BROKER")
      .map(([id]) => id);

  const getSelectedForwardIds = () =>
    Object.entries(selectedRowStatuses)
      .filter(([, status]) => status === "CLIENT_SIGNED")
      .map(([id]) => id);

  const getForwardLenderIdsForRow = (row: SignDocumentRow) => {
    const selected = forwardLenderIdsByRequirement[row.requirementId];
    if (selected?.length) return selected;
    if (row.requestApplicationLenderId) {
      return [row.requestApplicationLenderId];
    }
    if (forwardableLenders.length === 1) {
      return [forwardableLenders[0].applicationLenderId];
    }
    return [];
  };

  const bulkSendSelectedToClient = async () => {
    const sendIds = getSelectedSendIds();
    if (!submissionId || sendIds.length === 0) {
      toast.error("No selected documents are ready to send to the client");
      return;
    }
    try {
      setActionId("bulk-send");
      const res = await fetch(
        `${apiBase}/${apiRolePrefix}/loan-pipeline/submissions/${submissionId}/sign-documents/bulk-send-to-client`,
        {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requirementIds: sendIds,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to send to client");
      }
      toast.success(json.message || "Sent to client");
      clearSelection();
      await fetchRows();
      onUpdated?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to send to client");
    } finally {
      setActionId(null);
    }
  };

  const bulkForwardSelectedToLenders = async () => {
    const forwardIds = getSelectedForwardIds();
    if (!submissionId || forwardIds.length === 0) {
      toast.error("No selected documents are ready to forward to lenders");
      return;
    }
    if (!bulkForwardLenderIds.length) {
      toast.error("Select at least one lender to forward to");
      return;
    }
    try {
      setActionId("bulk-forward");
      const res = await fetch(
        `${apiBase}/${apiRolePrefix}/loan-pipeline/submissions/${submissionId}/sign-documents/bulk-forward-to-lenders`,
        {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requirementIds: forwardIds,
            applicationLenderIds: bulkForwardLenderIds,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to forward to lenders");
      }
      toast.success(json.message || "Forwarded to lenders");
      clearSelection();
      await fetchRows();
      onUpdated?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to forward");
    } finally {
      setActionId(null);
    }
  };

  const handleLenderUpload = async () => {
    if (!applicationLenderId || !uploadFile) {
      toast.error("Select a PDF or image file");
      return;
    }

    if (!uploadName.trim()) {
      toast.error("Enter a document name");
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("documentName", uploadName.trim());

      const res = await fetch(
        `${apiBase}/lender/loan-pipeline/${applicationLenderId}/sign-documents`,
        {
          method: "POST",
          headers: Object.fromEntries(
            Object.entries(getAuthHeaders() as Record<string, string>).filter(
              ([key]) => key.toLowerCase() !== "content-type",
            ),
          ),
          body: formData,
        },
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Upload failed");
      }

      toast.success("Sign document requested");
      setUploadName("");
      setUploadFile(null);
      await fetchRows();
      onUpdated?.();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const sendToClient = async (requirementId: string) => {
    if (!submissionId) return;

    try {
      setActionId(requirementId);
      const res = await fetch(
        `${apiBase}/${apiRolePrefix}/loan-pipeline/submissions/${submissionId}/sign-documents/${requirementId}/send-to-client`,
        {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to send to client");
      }
      toast.success("Sent to client for signature");
      await fetchRows();
      onUpdated?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to send to client");
    } finally {
      setActionId(null);
    }
  };

  const forwardToLender = async (row: SignDocumentRow) => {
    const requirementId = row.requirementId;

    if (isBrokerTermSheetDoc(row)) {
      if (!loanApplicationId) {
        toast.error("Application not found for this term sheet");
        return;
      }

      let applicationLenderIdToUse =
        row.requestApplicationLenderId ||
        forwardLenderByRequirement[requirementId] ||
        "";

      if (!applicationLenderIdToUse) {
        let lenders = [...forwardableLenders];
        if (!lenders.length) {
          try {
            const statusRes = await fetch(
              `${apiBase}/${apiRolePrefix}/loan-pipeline/${loanApplicationId}/broker-loi`,
              { headers: getAuthHeaders() },
            );
            const statusJson = await statusRes.json();
            if (
              statusRes.ok &&
              Array.isArray(statusJson.data?.forwardableLenders) &&
              statusJson.data.forwardableLenders.length
            ) {
              lenders = statusJson.data.forwardableLenders;
              setForwardableLenders(lenders);
            } else if (
              statusRes.ok &&
              statusJson.data?.sourceApplicationLenderId
            ) {
              applicationLenderIdToUse =
                statusJson.data.sourceApplicationLenderId;
            }
          } catch {
            /* ignore */
          }
        }

        if (!applicationLenderIdToUse && lenders.length === 1) {
          applicationLenderIdToUse = lenders[0].applicationLenderId;
        } else if (!applicationLenderIdToUse && lenders.length > 1) {
          const inputOptions = Object.fromEntries(
            lenders.map((lender) => [
              lender.applicationLenderId,
              lender.lenderName || "Lender",
            ]),
          );
          const pick = await Swal.fire({
            title: "Select Lender to Forward",
            text: "Choose which funding lender should receive this signed term sheet.",
            input: "select",
            inputOptions,
            inputPlaceholder: "Select a lender",
            showCancelButton: true,
            confirmButtonText: "Forward Signed LOI",
            cancelButtonText: "Cancel",
            confirmButtonColor: "#059669",
            inputValidator: (value) =>
              !value ? "Please select a lender" : undefined,
          });
          if (!pick.isConfirmed || !pick.value) return;
          applicationLenderIdToUse = String(pick.value);
          setForwardLenderByRequirement((prev) => ({
            ...prev,
            [requirementId]: applicationLenderIdToUse,
          }));
        }
      }

      if (!applicationLenderIdToUse) {
        toast.error(
          "Select a funding lender before forwarding the signed term sheet",
        );
        return;
      }

      const lenderLabel =
        row.lenderName ||
        forwardableLenders.find(
          (lender) =>
            lender.applicationLenderId === applicationLenderIdToUse,
        )?.lenderName ||
        "selected lender";

      const confirm = await Swal.fire({
        title: "Forward signed term sheet?",
        html: `Send to <strong>${lenderLabel}</strong> only?`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Forward Signed LOI",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#059669",
      });
      if (!confirm.isConfirmed) return;

      try {
        setActionId(requirementId);
        const res = await fetch(
          `${apiBase}/${apiRolePrefix}/loan-pipeline/${loanApplicationId}/broker-loi/forward-to-lender`,
          {
            method: "POST",
            headers: {
              ...getAuthHeaders(),
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              applicationLenderId: applicationLenderIdToUse,
            }),
          },
        );
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.message || "Failed to forward to lender");
        }
        toast.success(
          json.message || `Signed term sheet forwarded to ${lenderLabel}`,
        );
        await fetchRows();
        onUpdated?.();
      } catch (err: any) {
        toast.error(err.message || "Failed to forward");
      } finally {
        setActionId(null);
      }
      return;
    }

    if (!submissionId) return;

    const applicationLenderIds = getForwardLenderIdsForRow(row);
    if (!applicationLenderIds.length) {
      toast.error("Select at least one eligible lender to forward to");
      return;
    }

    try {
      setActionId(requirementId);
      const res = await fetch(
        `${apiBase}/${apiRolePrefix}/loan-pipeline/submissions/${submissionId}/sign-documents/${requirementId}/forward-to-lender`,
        {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ applicationLenderIds }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to forward to lender");
      }
      toast.success(json.message || "Signed document forwarded to lender");
      await fetchRows();
      onUpdated?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to forward");
    } finally {
      setActionId(null);
    }
  };

  const submitClientSignature = async () => {
    if (!loanApplicationId || !activeSigningDoc) return;

    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast.error("Please draw your signature first");
      return;
    }

    try {
      setIsSubmittingSignature(true);
      const signature = sigRef.current.getCanvas().toDataURL("image/png");

      const res = await fetch(
        `${apiBase}/client-portal/sign-documents/${activeSigningDoc.requirementId}/sign`,
        {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            signature,
            loanApplicationId,
          }),
        },
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Signing failed");
      }

      toast.success(
        isBrokerTermSheetDoc(activeSigningDoc)
          ? isStandaloneBrokerTermSheet(activeSigningDoc)
            ? "Broker term sheet signed successfully"
            : "Broker LOI / term sheet signed successfully"
          : "Document signed successfully",
      );
      sigRef.current.clear();
      setActiveSigningDoc(null);
      await fetchRows();
      onUpdated?.();
    } catch (err: any) {
      toast.error(err.message || "Signing failed");
    } finally {
      setIsSubmittingSignature(false);
    }
  };

  const openFile = (fileUrl?: string | null) => {
    const resolved = buildApiPublicFileUrl(apiBase, fileUrl);
    if (!resolved) return;
    window.open(resolved, "_blank");
  };

  const downloadRemoteFile = async (
    fileUrl: string,
    filename: string,
    trackId?: string,
  ) => {
    try {
      if (trackId) setDownloadingId(trackId);

      const resolved = buildApiPublicFileUrl(apiBase, fileUrl);
      if (!resolved) throw new Error("File URL missing");

      const res = await fetch(resolved, {
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        throw new Error("Failed to download file");
      }

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
    } finally {
      if (trackId) setDownloadingId(null);
    }
  };

  const downloadSignedCopy = async (row: SignDocumentRow) => {
    if (row.signMode === "DYNAMIC_FORM") {
      await downloadFilledForm(row);
      return;
    }

    const signed = row.signedUpload;
    if (!signed?.fileUrl) return;

    const ext = getDownloadExtension(
      signed.fileMimeType,
      signed.fileUrl,
      signed.fileName,
    );
    const filename = `${sanitizeDownloadName(row.documentName)}-signed${ext}`;
    await downloadRemoteFile(signed.fileUrl, filename, row.requirementId);
  };

  const downloadFilledForm = async (row: SignDocumentRow) => {
    const trackId = `${row.requirementId}-filled`;
    try {
      setDownloadingId(trackId);

      let url = "";
      if (isLenderMode && applicationLenderId) {
        url = `${apiBase}/lender/loan-pipeline/${applicationLenderId}/sign-documents/${row.requirementId}/download-filled`;
      } else if (isBrokerMode && submissionId) {
        url = `${apiBase}/${apiRolePrefix}/loan-pipeline/submissions/${submissionId}/sign-documents/${row.requirementId}/download-filled`;
      } else if (isClientMode && loanApplicationId) {
        url = `${apiBase}/client-portal/sign-documents/${row.requirementId}/download-filled?loanApplicationId=${encodeURIComponent(loanApplicationId)}`;
      } else {
        throw new Error("Missing download context");
      }

      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) {
        let message = "Failed to download filled form";
        try {
          const json = await res.json();
          if (json?.message) message = json.message;
        } catch {
          // ignore non-JSON error bodies
        }
        throw new Error(message);
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const matched = disposition.match(/filename="?([^"]+)"?/i);
      const filename =
        matched?.[1] ||
        `${sanitizeDownloadName(row.documentName)}-filled.pdf`;

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
    } finally {
      setDownloadingId(null);
    }
  };

  const downloadTemplate = async (row: SignDocumentRow) => {
    // Prefer PDF with current field values for fillable forms.
    if (row.signMode === "DYNAMIC_FORM") {
      await downloadFilledForm(row);
      return;
    }

    if (!row.templateFileUrl) return;

    const ext = getDownloadExtension(
      row.templateMimeType,
      row.templateFileUrl,
      row.templateFileName,
    );
    const filename = `${sanitizeDownloadName(row.documentName)}-template${ext}`;
    await downloadRemoteFile(
      row.templateFileUrl,
      filename,
      `${row.requirementId}-template`,
    );
  };

  const renderDocumentTitle = (row: SignDocumentRow) => {
    const showFileName =
      row.templateFileName &&
      row.templateFileName.trim() !== row.documentName.trim();

    return (
      <div className="min-w-0">
        <h3
          className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-white"
          title={row.documentName}
        >
          {row.documentName}
        </h3>
        {showFileName && (
          <p
            className="mt-1 truncate text-xs text-slate-500"
            title={row.templateFileName || undefined}
          >
            File: {row.templateFileName}
          </p>
        )}
      </div>
    );
  };

  const renderDocumentSourceChip = (row: SignDocumentRow) => {
    const productLabel = row.loanProductName || row.loanProductCode;

    if (isBrokerUploadedDoc(row)) {
      return (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800 dark:border-violet-500/40 dark:bg-violet-950/40 dark:text-violet-200">
            <Upload size={12} className="shrink-0" />
            <span className="truncate">Your upload</span>
          </span>
          {productLabel ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {productLabel}
            </span>
          ) : null}
        </div>
      );
    }

    const lenderName = row.lenderName || "Unknown lender";

    return (
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 dark:border-blue-500/40 dark:bg-blue-950/40 dark:text-blue-200">
          <Building2 size={12} className="shrink-0" />
          <span className="truncate">{lenderName}</span>
        </span>
        {productLabel ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {productLabel}
          </span>
        ) : null}
      </div>
    );
  };

  const renderForwardLenderPicker = (row: SignDocumentRow) => {
    if (!forwardableLenders.length) return null;

    const selectedIds = getForwardLenderIdsForRow(row);

    return (
      <div className="mb-2 rounded-xl border border-emerald-200 bg-white p-3 dark:border-emerald-500/30 dark:bg-slate-950">
        <MultiSelect
          label="Forward to lenders"
          options={forwardableLenderSelectOptions}
          value={selectedIds}
          onChange={(next) =>
            setForwardLenderIdsByRequirement((prev) => ({
              ...prev,
              [row.requirementId]: next,
            }))
          }
          placeholder="Select one or more lenders..."
        />
      </div>
    );
  };

  const renderBrokerDocumentCard = (row: SignDocumentRow) => {
    const isActionLoading = actionId === row.requirementId;
    const isSelected = selectedRequirementIds.has(row.requirementId);
    const forwardLenderCount = getForwardLenderIdsForRow(row).length;
    const canBulkSelect = isBulkSelectableRow(row);

    return (
      <div
        key={row.requirementId}
        className={`flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md dark:bg-slate-900 ${
          isSelected
            ? "border-violet-400 ring-2 ring-violet-200 dark:border-violet-500 dark:ring-violet-500/30"
            : "border-slate-200 dark:border-slate-700"
        }`}
      >
        {canBulkSelect && (
          <label className="mb-3 flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-500">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleRequirementSelection(row)}
              className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
            />
            Select for bulk action
          </label>
        )}
        {renderDocumentSourceChip(row)}

        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                row.signStatus === "FORWARDED_TO_LENDER"
                  ? "bg-violet-100 text-violet-700"
                  : row.signStatus === "LENDER_SEEN"
                    ? "bg-teal-100 text-teal-700"
                    : row.signStatus === "CLIENT_SIGNED"
                      ? "bg-emerald-100 text-emerald-700"
                      : row.signStatus === "SENT_TO_CLIENT"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-amber-100 text-amber-700"
              }`}
            >
              {isImageTemplate(row.templateMimeType, row.templateFileUrl) ? (
                <FileImage size={20} />
              ) : (
                <FileText size={20} />
              )}
            </div>
            <div className="min-w-0">{renderDocumentTitle(row)}</div>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(row.signStatus)}`}
          >
            {row.signStatusLabel || row.signStatus || "-"}
          </span>
        </div>

        {renderInlineDocumentActions(row)}

        {row.signMode === "DYNAMIC_FORM" && (
          <div className="mb-3 space-y-1 rounded-lg bg-teal-50 px-3 py-2 text-xs font-medium text-teal-800">
            <div>
              Fillable form
              {typeof row.fieldCount === "number" ? ` · ${row.fieldCount} fields` : ""}
            </div>
            {row.formProgress && (
              <div className="font-normal text-teal-700">
                {row.signStatus === "AWAITING_BROKER" ? (
                  <>Not sent to client yet</>
                ) : row.signStatus === "SENT_TO_CLIENT" ? (
                  <>
                    Client … · Broker{" "}
                    {row.formProgress.broker.complete ? "✓" : "…"} · In progress
                  </>
                ) : (
                  <>
                    Client{" "}
                    {[
                      "CLIENT_SIGNED",
                      "FORWARDED_TO_LENDER",
                      "LENDER_SEEN",
                    ].includes(row.signStatus || "")
                      ? "✓"
                      : "…"}{" "}
                    · Broker {row.formProgress.broker.complete ? "✓" : "…"} ·{" "}
                    {row.formProgress.all.complete
                      ? "Ready to forward"
                      : "In progress"}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-auto border-t border-slate-100 pt-4 dark:border-slate-800">
          {row.signStatus === "AWAITING_BROKER" && (
            <>
              <div className="mb-2 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {row.workflowHint || "Awaiting broker to send to client"}
              </div>
              <button
                type="button"
                disabled={isActionLoading}
                onClick={() => sendToClient(row.requirementId)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:opacity-60"
              >
                {isActionLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <SendHorizonal size={16} />
                )}
                Send to client
              </button>
            </>
          )}

          {row.signStatus === "SENT_TO_CLIENT" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-sm text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                <Clock size={16} className="shrink-0" />
                {row.workflowHint ||
                  (row.signMode === "DYNAMIC_FORM"
                    ? "Waiting for client / broker form fields"
                    : "Waiting for client signature")}
              </div>
              {row.signMode === "DYNAMIC_FORM" &&
                !row.formProgress?.broker.complete && (
                  <button
                    type="button"
                    onClick={() => openBrokerTemplate(row)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-950 dark:text-blue-200"
                  >
                    <PenLine size={16} />
                    Fill broker fields
                  </button>
                )}
            </div>
          )}

          {row.signStatus === "CLIENT_SIGNED" && (
            <div className="space-y-2">
              {isStandaloneBrokerTermSheet(row) && (
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    Select Lender to Forward
                  </span>
                  <select
                    value={forwardLenderByRequirement[row.requirementId] || ""}
                    onChange={(e) =>
                      setForwardLenderByRequirement((prev) => ({
                        ...prev,
                        [row.requirementId]: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-emerald-500/30 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="">Select a lender</option>
                    {forwardableLenders.map((lender) => (
                      <option
                        key={lender.applicationLenderId}
                        value={lender.applicationLenderId}
                      >
                        {lender.lenderName}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {!isStandaloneBrokerTermSheet(row) &&
                renderForwardLenderPicker(row)}
              <button
                type="button"
                disabled={
                  isActionLoading ||
                  (isStandaloneBrokerTermSheet(row) &&
                    !forwardLenderByRequirement[row.requirementId] &&
                    forwardableLenders.length !== 1) ||
                  (!isStandaloneBrokerTermSheet(row) &&
                    forwardLenderCount === 0)
                }
                onClick={() => forwardToLender(row)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:opacity-60"
              >
                {isActionLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <SendHorizonal size={16} />
                )}
                {getForwardToLenderLabel(row, forwardLenderCount)}
              </button>
              {row.signMode === "DYNAMIC_FORM" && (
                <button
                  type="button"
                  onClick={() => openBrokerTemplate(row)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-950 dark:text-emerald-200"
                >
                  <PenLine size={16} />
                  Review / edit fields
                </button>
              )}
            </div>
          )}

          {row.signStatus === "FORWARDED_TO_LENDER" && (
            <div className="flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2.5 text-sm text-violet-800 dark:bg-violet-950/40 dark:text-violet-200">
              <CheckCircle2 size={16} className="shrink-0" />
              Forwarded to {row.lenderName || "lender"}
            </div>
          )}

          {row.signStatus === "LENDER_SEEN" && (
            <div className="flex items-center gap-2 rounded-xl bg-teal-50 px-3 py-2.5 text-sm text-teal-800 dark:bg-teal-950/40 dark:text-teal-200">
              <CheckCircle2 size={16} className="shrink-0" />
              Seen by {row.lenderName || "lender"}
            </div>
          )}
        </div>
      </div>
    );
  };

  const inlineActionClass =
    "inline-flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-medium transition min-w-0 whitespace-nowrap";

  const renderInlineDocumentActions = (row: SignDocumentRow) => {
    const hasTemplate = Boolean(row.templateFileUrl);
    const hasSigned = Boolean(row.signedUpload?.fileUrl);

    if (!hasTemplate && !hasSigned) return null;

    return (
      <div className="mb-4 flex items-stretch gap-1.5">
        {hasTemplate && (
          <button
            type="button"
            onClick={() =>
              isBrokerMode ? openBrokerTemplate(row) : setActiveTemplateViewDoc(row)
            }
            className={`${inlineActionClass} border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200`}
            title={
              row.signMode === "DYNAMIC_FORM"
                ? isBrokerFormForwardedToLender(row)
                  ? "View filled form"
                  : "Open fillable form"
                : "View template"
            }
          >
            {row.signMode === "DYNAMIC_FORM" ? (
              isBrokerFormForwardedToLender(row) ? (
                <Eye size={13} className="shrink-0" />
              ) : (
                <PenLine size={13} className="shrink-0" />
              )
            ) : (
              <Eye size={13} className="shrink-0" />
            )}
            {getBrokerDynamicFormActionLabel(row)}
          </button>
        )}
        {hasSigned && !isBrokerMode && (
          <button
            type="button"
            onClick={() => setActiveSignedViewDoc(row)}
            className={`${inlineActionClass} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300`}
            title="View signed copy"
          >
            <Eye size={13} className="shrink-0" />
            Signed
          </button>
        )}
        {hasSigned && (
          <button
            type="button"
            onClick={() => downloadSignedCopy(row)}
            disabled={downloadingId === row.requirementId}
            className={`${inlineActionClass} border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-900 dark:bg-slate-900 dark:text-emerald-300`}
            title="Download signed copy"
          >
            {downloadingId === row.requirementId ? (
              <Loader2 size={13} className="shrink-0 animate-spin" />
            ) : (
              <Download size={13} className="shrink-0" />
            )}
            Download
          </button>
        )}
      </div>
    );
  };

  const isPdfTemplate = (mime?: string | null, url?: string | null) => {
    const value = (mime || url || "").toLowerCase();
    return value.includes("pdf");
  };

  const isImageTemplate = (mime?: string | null, url?: string | null) => {
    const value = (mime || url || "").toLowerCase();
    return (
      value.startsWith("image/") ||
      /\.(png|jpe?g|jfif|pjpeg|pjp|webp|gif)(\?|$)/i.test(value)
    );
  };

  const resolvePreviewMimeType = (
    mime?: string | null,
    url?: string | null,
  ) => {
    if (isPdfTemplate(mime, url)) return "application/pdf";
    if (isImageTemplate(mime, url)) {
      if (mime?.startsWith("image/")) return mime;
      return "image/*";
    }
    return mime || undefined;
  };

  const renderTemplatePreview = (row: SignDocumentRow) => {
    if (!row.templateFileUrl) {
      return (
        <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
          Template preview unavailable
        </div>
      );
    }

    const fileUrl = buildApiPublicFileUrl(apiBase, row.templateFileUrl);
    if (!fileUrl) return null;

    const previewMimeType = resolvePreviewMimeType(
      row.templateMimeType,
      row.templateFileUrl,
    );

    if (
      !isPdfTemplate(row.templateMimeType, row.templateFileUrl) &&
      !isImageTemplate(row.templateMimeType, row.templateFileUrl)
    ) {
      return (
        <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <FileText className="h-10 w-10 text-blue-500" />
          <p className="text-sm text-slate-600">
            Preview not supported in browser. Open the template in a new tab.
          </p>
          <button
            type="button"
            onClick={() => openFile(row.templateFileUrl)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
          >
            <Eye size={16} />
            Open template
          </button>
        </div>
      );
    }

    return (
      <EmbeddedFilePreview
        remoteUrl={fileUrl}
        mimeType={previewMimeType}
        fileName={row.documentName}
        getAuthHeaders={getAuthHeaders}
        className="flex h-[min(420px,50vh)] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-4 lg:h-[min(520px,58vh)]"
        iframeClassName="h-[min(420px,50vh)] w-full rounded-xl border border-slate-200 bg-white lg:h-[min(520px,58vh)]"
        imageClassName="max-h-full max-w-full rounded-lg object-contain shadow-sm"
      />
    );
  };

  const renderSignedFilePreview = (row: SignDocumentRow) => {
    const signed = row.signedUpload;
    if (!signed?.fileUrl) {
      return (
        <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
          Signed copy unavailable
        </div>
      );
    }

    const fileUrl = buildApiPublicFileUrl(apiBase, signed.fileUrl);
    if (!fileUrl) {
      return (
        <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
          Signed copy unavailable
        </div>
      );
    }

    const previewMimeType = resolvePreviewMimeType(
      signed.fileMimeType,
      signed.fileUrl,
    );

    if (
      !isPdfTemplate(signed.fileMimeType, signed.fileUrl) &&
      !isImageTemplate(signed.fileMimeType, signed.fileUrl)
    ) {
      return (
        <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <FileText className="h-10 w-10 text-blue-500" />
          <p className="text-sm text-slate-600">
            Preview not supported in browser. Open the signed copy in a new tab.
          </p>
          <button
            type="button"
            onClick={() => openFile(signed.fileUrl)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
          >
            <Eye size={16} />
            Open signed copy
          </button>
        </div>
      );
    }

    return (
      <EmbeddedFilePreview
        remoteUrl={fileUrl}
        mimeType={previewMimeType}
        fileName={`Signed ${row.documentName}`}
        getAuthHeaders={getAuthHeaders}
        className="flex h-[min(420px,50vh)] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-4 lg:h-[min(520px,58vh)]"
        iframeClassName="h-[min(420px,50vh)] w-full rounded-xl border border-slate-200 bg-white lg:h-[min(520px,58vh)]"
        imageClassName="max-h-full max-w-full rounded-lg object-contain shadow-sm"
      />
    );
  };

  const closeSignedViewModal = () => {
    setActiveSignedViewDoc(null);
  };

  const renderSignedCopyModal = () => {
    if (!activeSignedViewDoc?.signedUpload?.fileUrl) return null;

    const signatureData =
      activeSignedViewDoc.signedUpload.clientSignatureData || null;

    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm sm:p-4"
        onClick={closeSignedViewModal}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="signed-copy-modal-title"
          className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                Signed Copy
              </p>
              <h3
                id="signed-copy-modal-title"
                className="truncate text-lg font-semibold text-slate-900 sm:text-xl"
              >
                {activeSignedViewDoc.documentName}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Your signed document and signature are shown below.
              </p>
            </div>
            <button
              type="button"
              onClick={closeSignedViewModal}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 sm:p-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-3 text-sm font-semibold text-slate-700">
                  Signed document
                </p>
                {renderSignedFilePreview(activeSignedViewDoc)}
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold text-slate-700">
                  Your signature
                </p>
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4">
                  {signatureData ? (
                    <div className="flex min-h-[180px] items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-emerald-200 bg-white p-4">
                      <img
                        src={signatureData}
                        alt="Your signature"
                        className="max-h-[160px] max-w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-white p-4 text-center">
                      <PenLine className="h-8 w-8 text-emerald-500" />
                      <p className="text-sm text-slate-500">
                        Signature is embedded in the signed document preview.
                      </p>
                    </div>
                  )}
                  <p className="mt-2 text-xs text-slate-500">
                    This is the signature you submitted with this document.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              onClick={closeSignedViewModal}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() =>
                openFile(activeSignedViewDoc.signedUpload?.fileUrl)
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              <Eye size={16} />
              Open in new tab
            </button>
            <button
              type="button"
              onClick={() => downloadSignedCopy(activeSignedViewDoc)}
              disabled={downloadingId === activeSignedViewDoc.requirementId}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {downloadingId === activeSignedViewDoc.requirementId ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              Download signed copy
            </button>
          </div>
        </div>
      </div>
    );
  };

  const closeSigningModal = () => {
    if (isSubmittingSignature) return;
    setActiveSigningDoc(null);
    sigRef.current?.clear();
  };

  const fillFormCtaLabel = (row: SignDocumentRow) =>
    row.hasSignatureField ? "Fill & sign form" : "Fill & save form";

  const renderSigningModal = () => {
    if (!activeSigningDoc) return null;

    // Fillable forms must use SignFormFiller — never the global signature pad.
    if (activeSigningDoc.signMode === "DYNAMIC_FORM") {
      return null;
    }

    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm sm:p-4"
        onClick={closeSigningModal}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sign-document-modal-title"
          className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-cyan-50 px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                Review & Sign
              </p>
              <h3
                id="sign-document-modal-title"
                className="truncate text-lg font-semibold text-slate-900 sm:text-xl"
              >
                {activeSigningDoc.documentName}
                {activeSigningDoc.loiVersionLabel ? (
                  <span className="ml-2 text-sm font-medium text-violet-600">
                    ({activeSigningDoc.loiVersionLabel})
                  </span>
                ) : null}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {isBrokerTermSheetDoc(activeSigningDoc)
                  ? isStandaloneBrokerTermSheet(activeSigningDoc)
                    ? "Review your broker's term sheet, add your signature, then submit."
                    : "Review your broker LOI / term sheet, add your signature, then submit."
                  : "Read the document, add your signature, then submit."}
              </p>
              {isBrokerTermSheetDoc(activeSigningDoc) && (
                <p className="mt-1 text-xs font-medium text-violet-700">
                  {isStandaloneBrokerTermSheet(activeSigningDoc)
                    ? "Broker Term Sheet"
                    : activeSigningDoc.lenderName
                      ? `Based on lender terms from ${activeSigningDoc.lenderName}`
                      : "Broker LOI / Term Sheet"}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={closeSigningModal}
              disabled={isSubmittingSignature}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 sm:p-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-3 text-sm font-semibold text-slate-700">
                  Document preview
                </p>
                {renderTemplatePreview(activeSigningDoc)}
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold text-slate-700">
                  Your signature
                </p>
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4">
                  <div className="overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-white">
                    <SigCanvas
                      ref={sigRef}
                      penColor="#111827"
                      canvasProps={{
                        width: 640,
                        height: 180,
                        className: "w-full touch-none",
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Use your mouse or finger to sign inside the box above.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              onClick={() => sigRef.current?.clear()}
              disabled={isSubmittingSignature}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
            >
              Clear signature
            </button>
            <button
              type="button"
              disabled={isSubmittingSignature}
              onClick={submitClientSignature}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {isSubmittingSignature ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle2 size={16} />
              )}
              Submit signed document
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderTemplateViewModal = () => {
    if (!activeTemplateViewDoc?.templateFileUrl) return null;

    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm sm:p-4"
        onClick={() => setActiveTemplateViewDoc(null)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="template-view-modal-title"
          className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50 px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                Template Preview
              </p>
              <h3
                id="template-view-modal-title"
                className="truncate text-lg font-semibold text-slate-900 sm:text-xl"
              >
                {activeTemplateViewDoc.documentName}
              </h3>
              {activeTemplateViewDoc.lenderName && (
                <p className="mt-1 text-sm text-slate-500">
                  Requested by {activeTemplateViewDoc.lenderName}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setActiveTemplateViewDoc(null)}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 sm:p-6">
            {renderTemplatePreview(activeTemplateViewDoc)}
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
            <button
              type="button"
              onClick={() => setActiveTemplateViewDoc(null)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => downloadTemplate(activeTemplateViewDoc)}
              disabled={
                downloadingId === `${activeTemplateViewDoc.requirementId}-template`
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {downloadingId ===
              `${activeTemplateViewDoc.requirementId}-template` ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              Download
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderBrokerView = () => {
    const totalDocuments = brokerPagination?.total ?? rows.length;
    const hasSearchQuery = Boolean(debouncedBrokerSearch.trim());
    const listLoading = loading && rows.length > 0;

    const statCards = [
      {
        label: "Awaiting you",
        count: brokerSummary.awaitingYou,
        color: "text-amber-600",
      },
      {
        label: "With client",
        count: brokerSummary.withClient,
        color: "text-blue-600",
      },
      {
        label: "Ready to forward",
        count: brokerSummary.readyToForward,
        color: "text-emerald-600",
      },
      {
        label: "Forwarded",
        count: brokerSummary.forwarded,
        color: "text-violet-600",
      },
    ];

    const allFormsCount = brokerLenderGroups.reduce(
      (sum, group) => sum + group.count,
      0,
    );
    const selectedSendCount = getSelectedSendIds().length;
    const selectedForwardCount = getSelectedForwardIds().length;
    const eligibleOnPage = rows.filter(isBulkSelectableRow);
    const selectedOnPageCount = eligibleOnPage.filter((row) =>
      selectedRequirementIds.has(row.requirementId),
    ).length;
    const selectAllIndeterminate =
      !selectAllActive &&
      selectedRequirementIds.size > 0 &&
      selectedOnPageCount < eligibleOnPage.length;

    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-blue-50 p-6 shadow-sm dark:border-violet-900/40 dark:from-violet-950/30 dark:via-slate-900 dark:to-slate-900">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-200/30 blur-2xl" />
          <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-blue-200/30 blur-2xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-violet-700 shadow-sm dark:bg-slate-800/80 dark:text-violet-300">
                <PenLine size={14} />
                E-Signature Workflow
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Fill & Sign Forms
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
                Upload your own PDF forms, send them to the client, review
                completed fields, then forward to one or more eligible lenders.
              </p>
              {brokerLenderGroups.length > 0 && (
                <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  {brokerLenderGroups.length} lender
                  {brokerLenderGroups.length === 1 ? "" : "s"} · {totalDocuments}{" "}
                  document
                  {totalDocuments === 1 ? "" : "s"}
                  {hasSearchQuery ? " found" : ""}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {statCards.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl bg-white/90 px-3 py-3 text-center shadow-sm dark:bg-slate-800/90"
                >
                  <p className={`text-2xl font-bold ${stat.color}`}>
                    {stat.count}
                  </p>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-700 dark:bg-slate-800/60">
          <button
            type="button"
            onClick={() => setBrokerViewTab("upload")}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition sm:flex-none ${
              brokerViewTab === "upload"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Upload size={16} />
            Upload form
          </button>
          <button
            type="button"
            onClick={() => setBrokerViewTab("documents")}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition sm:flex-none ${
              brokerViewTab === "documents"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <FileText size={16} />
            Documents
            {totalDocuments > 0 ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  brokerViewTab === "documents"
                    ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                    : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                }`}
              >
                {totalDocuments}
              </span>
            ) : null}
          </button>
        </div>

        {brokerViewTab === "upload" ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-violet-50/60 px-5 py-4 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-violet-950/20">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#13538A] text-white shadow-sm">
                <Upload size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Upload a form
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Add a PDF or image to the e-signature workflow. Fillable
                  fields are detected automatically when present.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-5">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Document name
              </span>
              <input
                type="text"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="e.g. Borrower authorization form"
                maxLength={160}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm transition focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-violet-500/20"
              />
            </label>

            <div>
              <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                File
              </span>
              <input
                ref={uploadFileInputRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(e) =>
                  handleSignDocumentFileSelection(
                    e.target.files?.[0] || null,
                    uploadName,
                    setUploadFile,
                    setUploadName,
                  )
                }
              />
              <button
                type="button"
                onClick={() => uploadFileInputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setUploadDragOver(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setUploadDragOver(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setUploadDragOver(false);
                  const file = event.dataTransfer.files?.[0] || null;
                  handleSignDocumentFileSelection(
                    file,
                    uploadName,
                    setUploadFile,
                    setUploadName,
                  );
                }}
                className={`flex min-h-[132px] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
                  uploadFile
                    ? "border-violet-300 bg-violet-50/50 dark:border-violet-500/40 dark:bg-violet-950/20"
                    : uploadDragOver
                      ? "border-violet-400 bg-violet-50/60 dark:border-violet-500/50 dark:bg-violet-950/30"
                      : "border-slate-200 bg-slate-50/50 hover:border-violet-300 hover:bg-violet-50/30 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-violet-500/40"
                }`}
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                    uploadFile
                      ? "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
                      : "bg-white text-slate-400 shadow-sm dark:bg-slate-800"
                  }`}
                >
                  {uploadFile && uploadFile.type.startsWith("image/") ? (
                    <FileImage size={22} />
                  ) : (
                    <FileText size={22} />
                  )}
                </div>
                {uploadFile ? (
                  <>
                    <p className="max-w-full truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {uploadFile.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {(uploadFile.size / 1024).toFixed(1)} KB · Click or drop
                      to replace
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Drag & drop your file here
                    </p>
                    <p className="text-xs text-slate-500">
                      or click to browse · PDF, PNG, JPG, WEBP
                    </p>
                  </>
                )}
              </button>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                {!uploadName.trim() || !uploadFile
                  ? "Enter a name and choose a file to continue"
                  : "Ready to add to workflow"}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {uploadFile ? (
                  <button
                    type="button"
                    onClick={() => {
                      setUploadFile(null);
                      if (uploadFileInputRef.current) {
                        uploadFileInputRef.current.value = "";
                      }
                    }}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Clear file
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={uploading || !uploadName.trim() || !uploadFile}
                  onClick={() => void handleBrokerUpload()}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#13538A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f4370] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                >
                  {uploading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Upload size={16} />
                  )}
                  Upload & add to workflow
                </button>
              </div>
            </div>
          </div>
        </div>
        ) : loading && rows.length === 0 ? (
          <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-600" />
              <p className="mt-3 text-sm text-slate-500">Loading documents...</p>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 text-white shadow-lg">
              <FileText size={28} />
            </div>
            <p className="text-base font-semibold text-slate-800 dark:text-white">
              {hasSearchQuery ? "No matching documents" : "No sign documents yet"}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {hasSearchQuery
                ? "Try a different document or lender name."
                : "Upload a PDF form or wait for a lender to send one requiring client signature."}
            </p>
            {!hasSearchQuery ? (
              <button
                type="button"
                onClick={() => setBrokerViewTab("upload")}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#13538A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f4370]"
              >
                <Upload size={16} />
                Upload a form
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Documents
                {totalDocuments > 0 ? (
                  <span className="ml-1.5 font-normal text-slate-400">
                    ({totalDocuments}
                    {hasSearchQuery ? " found" : ""})
                  </span>
                ) : null}
              </h3>

              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end lg:w-auto">
                {totalDocuments > 0 && (
                  <label className="w-full sm:min-w-[220px]">
                    <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                      Filter by source
                    </span>
                    <div className="relative">
                      <Building2
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <select
                        value={selectedLenderKey}
                        onChange={(event) =>
                          setSelectedLenderKey(event.target.value)
                        }
                        className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm text-slate-700 transition focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      >
                        <option value="all">
                          All forms ({allFormsCount || totalDocuments})
                        </option>
                        {brokerLenderGroups.map((group) => (
                          <option key={group.key} value={group.key}>
                            {group.lenderName} ({group.count})
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={16}
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                    </div>
                  </label>
                )}

                <label className="w-full sm:max-w-xs">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Search
                  </span>
                  <div className="relative">
                    <Search
                      size={16}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="search"
                      value={brokerSearchInput}
                      onChange={(event) =>
                        setBrokerSearchInput(event.target.value)
                      }
                      placeholder="Search documents..."
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 transition focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/60 sm:flex-row sm:items-center sm:justify-between">
              <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={selectAllActive}
                  ref={(input) => {
                    if (input) {
                      input.indeterminate = selectAllIndeterminate;
                    }
                  }}
                  disabled={selectAllLoading || eligibleOnPage.length === 0}
                  onChange={() => void handleSelectAllToggle()}
                  className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 disabled:opacity-50"
                />
                {selectAllLoading ? (
                  <span className="inline-flex items-center gap-2 text-slate-500">
                    <Loader2 size={14} className="animate-spin" />
                    Selecting…
                  </span>
                ) : (
                  <span>
                    Select all eligible matching filter
                    {eligibleOnPage.length > 0 ? (
                      <span className="ml-1 font-normal text-slate-500">
                        ({eligibleOnPage.length} on this page)
                      </span>
                    ) : null}
                  </span>
                )}
              </label>
              {selectedRequirementIds.size > 0 && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-sm font-medium text-violet-700 hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-100"
                >
                  Clear selection ({selectedRequirementIds.size})
                </button>
              )}
            </div>

            {selectedRequirementIds.size > 0 && (
              <div className="sticky top-0 z-20 rounded-2xl border border-violet-200 bg-violet-50/95 p-4 shadow-md backdrop-blur-sm dark:border-violet-500/30 dark:bg-violet-950/90">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">
                      {selectedRequirementIds.size} selected
                      {selectedSendCount > 0 || selectedForwardCount > 0 ? (
                        <span className="ml-1 font-normal text-violet-700 dark:text-violet-300">
                          · {selectedSendCount} ready to send
                          {selectedForwardCount > 0
                            ? ` · ${selectedForwardCount} ready to forward`
                            : ""}
                        </span>
                      ) : null}
                    </p>
                    {selectedSendCount === 0 && selectedForwardCount === 0 ? (
                      <p className="mt-1 text-xs text-violet-700 dark:text-violet-300">
                        Selected documents are not eligible for bulk actions.
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="shrink-0 text-sm font-medium text-violet-700 hover:text-violet-900 dark:text-violet-300"
                  >
                    Clear
                  </button>
                </div>

                {selectedSendCount > 0 && (
                  <div className="mt-3">
                    <button
                      type="button"
                      disabled={actionId === "bulk-send"}
                      onClick={() => void bulkSendSelectedToClient()}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {actionId === "bulk-send" ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <SendHorizonal size={14} />
                      )}
                      Send {selectedSendCount} to client
                    </button>
                  </div>
                )}

                {selectedForwardCount > 0 && (
                  <div
                    className={`${selectedSendCount > 0 ? "mt-4 border-t border-violet-200/80 pt-4 dark:border-violet-500/20" : "mt-3"}`}
                  >
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-200">
                      Forward {selectedForwardCount} completed form
                      {selectedForwardCount === 1 ? "" : "s"} to lenders
                    </p>
                    {forwardableLenders.length > 0 ? (
                      <>
                        <div className="mb-3 max-w-lg">
                          <MultiSelect
                            label="Select lenders"
                            options={forwardableLenderSelectOptions}
                            value={bulkForwardLenderIds}
                            onChange={setBulkForwardLenderIds}
                            placeholder="Select one or more lenders..."
                            disabled={actionId === "bulk-forward"}
                          />
                        </div>
                        <button
                          type="button"
                          disabled={actionId === "bulk-forward"}
                          onClick={() => void bulkForwardSelectedToLenders()}
                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {actionId === "bulk-forward" ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <SendHorizonal size={14} />
                          )}
                          Forward to selected lenders
                        </button>
                      </>
                    ) : (
                      <p className="text-xs text-violet-700 dark:text-violet-300">
                        No eligible lenders on this application.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="relative">
              {listLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-[1px] dark:bg-slate-900/70">
                  <Loader2 className="h-7 w-7 animate-spin text-violet-600" />
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {rows.map((row) => renderBrokerDocumentCard(row))}
              </div>
            </div>

            {brokerPagination && brokerPagination.totalPages > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/60">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Page{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {brokerPagination.page}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {brokerPagination.totalPages}
                  </span>
                  {brokerPagination.total != null && (
                    <span className="ml-1 text-slate-400">
                      ({brokerPagination.total} document
                      {brokerPagination.total === 1 ? "" : "s"}
                      {hasSearchQuery ? " found" : ""})
                    </span>
                  )}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={brokerPage === 1 || loading}
                    onClick={() => setBrokerPage((current) => current - 1)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:disabled:border-slate-800 dark:disabled:bg-slate-800/50 dark:disabled:text-slate-600"
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>

                  {brokerPagination.totalPages > 1 &&
                    Array.from(
                      { length: brokerPagination.totalPages },
                      (_, index) => {
                        const pageNum = index + 1;

                        return (
                          <button
                            key={pageNum}
                            type="button"
                            disabled={loading}
                            onClick={() => setBrokerPage(pageNum)}
                            className={`h-9 min-w-9 rounded-xl px-2.5 text-sm font-semibold transition ${
                              brokerPage === pageNum
                                ? "bg-[#13538A] text-white shadow-sm"
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
                    disabled={
                      brokerPage === brokerPagination.totalPages || loading
                    }
                    onClick={() => setBrokerPage((current) => current + 1)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:disabled:border-slate-800 dark:disabled:bg-slate-800/50 dark:disabled:text-slate-600"
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {renderTemplateViewModal()}
        {renderSignedCopyModal()}
        {fillingDoc && submissionId && (
          <SignFormFiller
            open={Boolean(fillingDoc)}
            mode="broker"
            onClose={() => setFillingDoc(null)}
            apiBase={apiBase}
            getAuthHeaders={getAuthHeaders}
            loanApplicationId={loanApplicationId || ""}
            submissionId={submissionId}
            apiRolePrefix={apiRolePrefix}
            requirementId={fillingDoc.requirementId}
            documentName={fillingDoc.documentName}
            initialSignStatus={fillingDoc.signStatus}
            onSubmitted={() => {
              setFillingDoc(null);
              fetchRows();
              onUpdated?.();
            }}
          />
        )}
      </div>
    );
  };

  const renderClientDocumentActions = (row: SignDocumentRow) => {
    const hasTemplate = Boolean(row.templateFileUrl);
    const awaitingNewSignature = row.signStatus === "SENT_TO_CLIENT";
    const hasSigned =
      !awaitingNewSignature && Boolean(row.signedUpload?.fileUrl);

    if (!hasTemplate && !hasSigned) return null;

    const actionClass =
      "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition min-w-0";

    return (
      <div className="flex gap-2">
        {hasTemplate && (
          <button
            type="button"
            onClick={() =>
              isClientMode
                ? openClientSignPage(
                    row.signMode === "DYNAMIC_FORM" ? "fill" : "template",
                    row,
                  )
                : openBrokerTemplate(row)
            }
            className={`${actionClass} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
            title={
              row.signMode === "DYNAMIC_FORM"
                ? isClientFormSubmittedToBroker(row)
                  ? "View completed form"
                  : "Open fillable form"
                : "View template"
            }
          >
            <Eye size={14} className="shrink-0 text-sky-600" />
            <span className="truncate">
              {getClientDynamicFormActionLabel(row)}
            </span>
          </button>
        )}
        {hasSigned && clientView !== "signForms" && (
          <>
            <button
              type="button"
              onClick={() => setActiveSignedViewDoc(row)}
              className={`${actionClass} border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100`}
              title="View signed copy"
            >
              <Eye size={14} className="shrink-0" />
              <span className="truncate">Signed</span>
            </button>
            <button
              type="button"
              onClick={() => downloadSignedCopy(row)}
              disabled={downloadingId === row.requirementId}
              className={`${actionClass} border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100 disabled:opacity-60`}
              title="Download signed copy"
            >
              {downloadingId === row.requirementId ? (
                <Loader2 size={14} className="shrink-0 animate-spin" />
              ) : (
                <Download size={14} className="shrink-0" />
              )}
              <span className="truncate">Save</span>
            </button>
          </>
        )}
      </div>
    );
  };

  const renderClientStatusFooter = (row: SignDocumentRow) => {
    const standalone = isStandaloneBrokerTermSheet(row);
    const brokerSheet = isBrokerTermSheetDoc(row);

    switch (row.signStatus) {
      case "SENT_TO_CLIENT":
        return (
          <div className="flex items-start gap-2 rounded-lg bg-sky-50 px-2.5 py-2 text-xs leading-relaxed text-sky-800">
            <PenLine size={14} className="mt-0.5 shrink-0" />
            <span>
              {row.workflowHint ||
                (row.signMode === "DYNAMIC_FORM"
                  ? row.hasSignatureField
                    ? "Complete your form fields and signature"
                    : "Complete your assigned form fields"
                  : brokerSheet
                    ? "Your signature is required on this term sheet"
                    : "Your signature is required")}
            </span>
          </div>
        );
      case "CLIENT_SIGNED":
        return (
          <div className="flex items-start gap-2 rounded-lg bg-emerald-50 px-2.5 py-2 text-xs leading-relaxed text-emerald-800">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            <span>
              {row.workflowHint ||
                (row.signMode === "DYNAMIC_FORM"
                  ? `You completed this form — your broker will review and send it to ${row.lenderName || "the lender"}`
                  : standalone
                    ? "Signed — your broker has received this term sheet"
                    : `You signed this document — your broker will forward it to ${row.lenderName || "the lender"}`)}
            </span>
          </div>
        );
      case "FORWARDED_TO_LENDER":
        return (
          <div className="flex items-start gap-2 rounded-lg bg-violet-50 px-2.5 py-2 text-xs leading-relaxed text-violet-800">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            <span>
              {row.workflowHint ||
                `Your broker sent this completed form to ${row.lenderName || "the lender"}`}
            </span>
          </div>
        );
      case "LENDER_SEEN":
        return (
          <div className="flex items-start gap-2 rounded-lg bg-teal-50 px-2.5 py-2 text-xs leading-relaxed text-teal-800">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            <span>
              {row.workflowHint ||
                `${row.lenderName || "The lender"} has reviewed your submitted form`}
            </span>
          </div>
        );
      default:
        return null;
    }
  };

  const clientCardAccent = (row: SignDocumentRow) => {
    if (isBrokerTermSheetDoc(row) && row.signStatus === "SENT_TO_CLIENT") {
      return "border-t-violet-500";
    }
    switch (row.signStatus) {
      case "SENT_TO_CLIENT":
        return "border-t-sky-500";
      case "CLIENT_SIGNED":
        return "border-t-emerald-500";
      case "FORWARDED_TO_LENDER":
        return "border-t-violet-500";
      case "LENDER_SEEN":
        return "border-t-teal-500";
      default:
        return "border-t-slate-300";
    }
  };

  const renderClientDocumentCard = (row: SignDocumentRow) => {
    const isPending =
      row.signStatus === "SENT_TO_CLIENT" &&
      row.clientBucket !== "waitingOnBroker";
    const brokerSheet = isBrokerTermSheetDoc(row);
    const standalone = isStandaloneBrokerTermSheet(row);
    const waitingBroker = row.clientBucket === "waitingOnBroker";

    return (
      <article
        key={row.requirementId}
        className={`flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 border-t-4 bg-white shadow-sm transition hover:shadow-md ${clientCardAccent(row)}`}
      >
        <div className="flex items-start gap-3 border-b border-slate-100 p-4">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              isPending
                ? brokerSheet
                  ? "bg-violet-100 text-violet-700"
                  : "bg-sky-100 text-sky-700"
                : waitingBroker
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {isImageTemplate(row.templateMimeType, row.templateFileUrl) ? (
              <FileImage size={18} />
            ) : (
              <FileText size={18} />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3
                className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900"
                title={row.documentName}
              >
                {row.documentName}
                {row.loiVersionLabel ? (
                  <span className="ml-1.5 text-[11px] font-medium text-violet-600">
                    ({row.loiVersionLabel})
                  </span>
                ) : null}
              </h3>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClass(row.signStatus)}`}
              >
                {row.signStatusLabel || row.signStatus || "-"}
              </span>
            </div>

            {brokerSheet ? (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-violet-700">
                <FileText size={12} className="shrink-0" />
                <span className="truncate">
                  {standalone
                    ? "Broker Term Sheet"
                    : row.lenderName
                      ? `Broker LOI · ${row.lenderName}`
                      : "Broker LOI / Term Sheet"}
                </span>
              </p>
            ) : row.lenderName ? (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-500">
                <Building2 size={12} className="shrink-0" />
                <span className="truncate">Requested by {row.lenderName}</span>
              </p>
            ) : null}

            {row.signMode === "DYNAMIC_FORM" && row.formProgress && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600">
                Client {row.formProgress.client.complete ? "✓" : "…"}
                <span className="text-slate-300">·</span>
                Broker {row.formProgress.broker.complete ? "✓" : "…"}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-4">
          {renderClientDocumentActions(row)}

          {isPending ? (
            <button
              type="button"
              onClick={() => {
                if (row.signMode === "DYNAMIC_FORM") {
                  if (isClientMode) {
                    openClientSignPage("fill", row);
                    return;
                  }
                  setFillingDoc(row);
                  return;
                }
                if (isClientMode) {
                  openClientSignPage("sign", row);
                  return;
                }
                setActiveSigningDoc(row);
                sigRef.current?.clear();
              }}
              className={`mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 ${
                brokerSheet
                  ? "bg-gradient-to-r from-violet-600 to-fuchsia-600"
                  : "bg-gradient-to-r from-sky-600 to-blue-600"
              }`}
            >
              <PenLine size={15} />
              {row.signMode === "DYNAMIC_FORM"
                ? fillFormCtaLabel(row)
                : "Review & Sign"}
            </button>
          ) : (
            <div className="mt-auto">{renderClientStatusFooter(row)}</div>
          )}
        </div>
      </article>
    );
  };

  const renderClientView = () => {
    const isTermSheetView = clientView === "termSheet";
    const isSignFormsView = clientView === "signForms";
    const totalClientForms =
      clientSummary.actionRequired +
      clientSummary.waitingOnBroker +
      clientSummary.completed;
    const hasClientSearchQuery = Boolean(debouncedClientSearch.trim());

    const heroBadge = isSignFormsView
      ? "Lender Forms"
      : hasBrokerTermSheetLabel(isTermSheetView)
        ? "Broker Term Sheet"
        : "E-Signature Required";
    const heroTitle = isSignFormsView
      ? "Fill & Sign Forms"
      : isTermSheetView
        ? "Sign Term Sheet"
        : "Sign Documents";
    const heroDescription = isSignFormsView
      ? "Complete each lender form sent by your broker. Fill your assigned fields, sign where required, and submit. Your broker will review and forward completed copies to the lender."
      : isStandaloneBrokerTermSheetHint()
        ? "Review your broker's term sheet carefully, add your signature, and submit. Supporting documents listed on the term sheet appear under Upload Documents."
        : isTermSheetView
          ? "Review your broker LOI / term sheet carefully, add your signature, and submit. Your broker may forward the signed copy to a lender."
          : "Review each form, complete your fields or signature, and submit. Your broker will finish remaining fields if needed, then forward to the lender.";
    const heroTone = isSignFormsView
      ? "border-sky-100 bg-gradient-to-br from-sky-50 via-white to-blue-50"
      : isTermSheetView
        ? "border-violet-100 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50"
        : "border-sky-100 bg-gradient-to-br from-sky-50 via-white to-blue-50";

    function hasBrokerTermSheetLabel(termSheetView: boolean) {
      return termSheetView || rows.some((row) => isBrokerTermSheetDoc(row));
    }

    function isStandaloneBrokerTermSheetHint() {
      return rows.some((row) => isStandaloneBrokerTermSheet(row));
    }

    return (
      <div className="space-y-6">
        <div
          className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm sm:p-6 ${heroTone}`}
        >
          <div
            className={`absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl ${
              isSignFormsView
                ? "bg-sky-200/35"
                : isTermSheetView
                  ? "bg-fuchsia-200/35"
                  : "bg-sky-200/35"
            }`}
          />
          <div
            className={`absolute -bottom-10 -left-10 h-28 w-28 rounded-full blur-2xl ${
              isSignFormsView
                ? "bg-blue-200/30"
                : isTermSheetView
                  ? "bg-violet-200/30"
                  : "bg-blue-200/30"
            }`}
          />

          <div className="relative flex flex-col gap-5">
            <div className="min-w-0">
              <div
                className={`mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold shadow-sm ${
                  isSignFormsView
                    ? "text-sky-700"
                    : isTermSheetView
                      ? "text-violet-700"
                      : "text-sky-700"
                }`}
              >
                <PenLine size={12} />
                {heroBadge}
              </div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                {heroTitle}
              </h2>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600">
                {heroDescription}
              </p>
              {clientName && (
                <p className="mt-2 text-sm font-medium text-slate-700">
                  {clientName}
                  {applicationNumber ? ` · ${applicationNumber}` : ""}
                </p>
              )}
              {isTermSheetView && clientSummary.actionRequired > 0 && (
                <p className="mt-2 text-xs font-semibold text-violet-700">
                  {clientSummary.actionRequired} broker term sheet
                  {clientSummary.actionRequired === 1 ? "" : "s"} awaiting your
                  signature
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {CLIENT_BUCKET_FILTERS.map((filter) => {
                const count =
                  filter.key === "all"
                    ? totalClientForms
                    : filter.summaryKey
                      ? clientSummary[filter.summaryKey]
                      : 0;
                const isActive = clientBucket === filter.key;

                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setClientBucket(filter.key)}
                    className={`min-w-[6.5rem] rounded-xl px-3 py-2 text-left ring-1 ring-inset transition ${
                      isActive
                        ? `${filter.wrap} shadow-sm ring-2 ring-blue-200`
                        : `${filter.wrap} opacity-90 hover:opacity-100`
                    }`}
                  >
                    <p className={`text-lg font-bold tabular-nums ${filter.num}`}>
                      {count}
                    </p>
                    <p className="text-[11px] font-medium text-slate-600">
                      {filter.label}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {isSignFormsView && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <label className="relative w-full sm:max-w-sm">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={clientSearchInput}
                onChange={(event) => setClientSearchInput(event.target.value)}
                placeholder="Search forms..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
            </label>
          </div>
        )}

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-sky-200 bg-sky-50/40 p-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg">
              <CheckCircle2 size={26} />
            </div>
            <p className="text-base font-semibold text-slate-800">
              {hasClientSearchQuery
                ? "No forms match your search"
                : isTermSheetView
                  ? "No term sheet waiting for signature"
                  : isSignFormsView
                    ? "No forms in this filter"
                    : "No documents waiting for signature"}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              {hasClientSearchQuery
                ? "Try a different search term or clear the search box."
                : clientBucket !== "all"
                  ? "Try another filter above or check back later."
                  : isTermSheetView
                    ? "When your broker sends a term sheet for signing, it will appear here."
                    : isSignFormsView
                      ? "When your broker sends lender forms for you to complete, they will appear here."
                      : "When your broker sends a term sheet or form for signing, it will appear here."}
            </p>
          </div>
        ) : (
          <>
            <div className="relative">
              {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-[1px]">
                  <Loader2 className="h-7 w-7 animate-spin text-sky-600" />
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {rows.map((row) => renderClientDocumentCard(row))}
              </div>
            </div>

            {clientPagination && clientPagination.totalPages > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                <p className="text-sm text-slate-500">
                  Page{" "}
                  <span className="font-semibold text-slate-700">
                    {clientPagination.page}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-slate-700">
                    {clientPagination.totalPages}
                  </span>
                  {clientPagination.total != null && (
                    <span className="ml-1 text-slate-400">
                      ({clientPagination.total} form
                      {clientPagination.total === 1 ? "" : "s"}
                      {hasClientSearchQuery ? " found" : ""})
                    </span>
                  )}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={clientPage === 1 || loading}
                    onClick={() => setClientPage((current) => current - 1)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>

                  {clientPagination.totalPages > 1 &&
                    Array.from(
                      { length: clientPagination.totalPages },
                      (_, index) => {
                        const pageNum = index + 1;

                        return (
                          <button
                            key={pageNum}
                            type="button"
                            disabled={loading}
                            onClick={() => setClientPage(pageNum)}
                            className={`h-9 min-w-9 rounded-xl px-2.5 text-sm font-semibold transition ${
                              clientPage === pageNum
                                ? "bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-sm"
                                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      },
                    )}

                  <button
                    type="button"
                    disabled={
                      clientPage === clientPagination.totalPages || loading
                    }
                    onClick={() => setClientPage((current) => current + 1)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {isTermSheetView && previousSignedLoiVersions.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    Previous signed LOI versions
                  </span>
                  <div className="h-px flex-1 bg-slate-100" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {previousSignedLoiVersions.map((version) => (
                    <div
                      key={version.versionNumber}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          Broker Term Sheet · {version.label}
                        </p>
                        {version.clientSignedAt && (
                          <p className="text-xs text-slate-500">
                            Signed{" "}
                            {new Date(
                              version.clientSignedAt,
                            ).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => openFile(version.signedPdfUrl)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                      >
                        <Eye size={13} />
                        View
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {renderSigningModal()}
            {renderTemplateViewModal()}
            {renderSignedCopyModal()}
          </>
        )}
      </div>
    );
  };

  if (loading && !isBrokerMode && rows.length === 0) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
          <p className="mt-3 text-sm text-slate-500">Loading sign documents...</p>
        </div>
      </div>
    );
  }

  if (isClientMode) {
    return renderClientView();
  }

  if (isBrokerMode) {
    return renderBrokerView();
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">
          Sign Documents
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          PDF or image forms that require client e-signature before forwarding to
          the lender.
        </p>
      </div>

      {isLenderMode && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-white">
            Upload signable form
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              type="text"
              placeholder="Document name"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
              onChange={(e) =>
                handleSignDocumentFileSelection(
                  e.target.files?.[0] || null,
                  uploadName,
                  setUploadFile,
                  setUploadName,
                )
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <button
            type="button"
            onClick={handleLenderUpload}
            disabled={uploading}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Upload size={16} />
            )}
            Request signature
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
          No sign documents yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Lender</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Files</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {rows.map((row) => (
                <tr key={row.requirementId}>
                  <td className="px-4 py-3 font-medium">{row.documentName}</td>
                  <td className="px-4 py-3">{row.lenderName || "-"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(row.signStatus)}`}
                    >
                      {row.signStatusLabel || row.signStatus || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {row.templateFileUrl && (
                        <button
                          type="button"
                          onClick={() => openFile(row.templateFileUrl)}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs"
                        >
                          <Eye size={14} /> Template
                        </button>
                      )}
                      {row.signedUpload?.fileUrl && (
                        <button
                          type="button"
                          onClick={() => openFile(row.signedUpload?.fileUrl)}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2 py-1 text-xs text-emerald-800"
                        >
                          <Download size={14} /> Signed
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs text-slate-500">
                      {row.signStatus === "FORWARDED_TO_LENDER"
                        ? "Received"
                        : "In progress"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
