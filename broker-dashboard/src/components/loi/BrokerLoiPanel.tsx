import {
  ArrowDownUp,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  Phone,
  Search,
  SendHorizonal,
  Sparkles,
  TrendingDown,
  TrendingUp,
  User,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import toast from "react-hot-toast";
import {
  buildLoiComparisonSummary,
  buildLoiPdfUrl,
  formatCurrency,
  formatLoiApprovedDisplay,
  formatLoiDate,
  formatLoiGeneratedLabel,
  formatLoiInterestDisplay,
  formatLoiStatusLabel,
  formatPercent,
  getLoiProductLabel,
  getLoiStatusChipClass,
  hasLoiPdf,
  sortBrokerLois,
  type BrokerLoiListResponse,
  type BrokerLoiRecord,
  type LoiSortOption,
} from "../../lib/loiUtils";
import BrokerLoiEditorPanel from "./BrokerLoiEditorPanel";
import type { BrokerLoiTerms } from "../../lib/brokerLoiTerms";

type PreviewMode = "lender" | "broker-edit" | "broker-pdf";

type BrokerLoiSignWorkflow = {
  requirementId?: string | null;
  submissionId?: string | null;
  signStatus?: string | null;
  signStatusLabel?: string | null;
  sentToClientAt?: string | null;
  clientSignedAt?: string | null;
  signedPdfUrl?: string | null;
  signedPdfFileName?: string | null;
  canSendToClient?: boolean;
  canForwardToLender?: boolean;
  isComplete?: boolean;
};

type BrokerLoiStatus = {
  brokerLoiUrl?: string | null;
  brokerLoiGeneratedAt?: string | null;
  sourceApplicationLenderId?: string | null;
  sourceLenderName?: string | null;
  terms?: BrokerLoiTerms | null;
  signWorkflow?: BrokerLoiSignWorkflow | null;
};

type BrokerLoiPrefill = {
  sourceApplicationLenderId: string;
  sourceLenderName: string;
  terms: BrokerLoiTerms;
  applicationContext?: {
    borrowerName?: string;
    propertyAddress?: string;
    propertyType?: string;
    loanProduct?: string;
    brokerName?: string;
  };
  brokerBranding?: {
    brandName?: string | null;
    logoUrl?: string | null;
    isComplete?: boolean;
  };
};

const WORKFLOW_STEPS = [
  "Receive lender LOIs",
  "Select preferred LOI",
  "Create broker LOI",
  "Generate branded PDF",
  "Send to client",
  "Client signs",
  "Forward to lender",
];

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const DEFAULT_LIMIT = 20;

function resolveApplicationLenderId(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  return null;
}

type BrokerLoiPanelProps = {
  applicationId?: string | null;
  apiRole?: "broker" | "loanofficer" | "subbroker";
  getAuthHeaders: () => HeadersInit;
  isActive?: boolean;
  onLoiCountChange?: (count: number) => void;
};

const SORT_OPTIONS: { value: LoiSortOption; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "amount_desc", label: "Highest amount" },
  { value: "amount_asc", label: "Lowest amount" },
  { value: "rate_asc", label: "Lowest rate" },
  { value: "rate_desc", label: "Highest rate" },
  { value: "lender_az", label: "Lender A–Z" },
];

function SummaryStat({
  label,
  value,
  hint,
  icon,
  accent = "violet",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: ReactNode;
  accent?: "violet" | "emerald" | "sky";
}) {
  const accentClass =
    accent === "emerald"
      ? "border-emerald-100 bg-emerald-50/80 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
      : accent === "sky"
        ? "border-sky-100 bg-sky-50/80 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300"
        : "border-violet-100 bg-violet-50/80 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300";

  return (
    <div className={`rounded-xl border p-3 ${accentClass}`}>
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide opacity-80">
        {icon}
        {label}
      </div>
      <div className="text-sm font-bold">{value}</div>
      {hint && (
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug opacity-75">
          {hint}
        </p>
      )}
    </div>
  );
}

function DetailItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/50">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>
      <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
        {value}
      </div>
    </div>
  );
}

function LoiListItem({
  loi,
  selected,
  onSelect,
}: {
  loi: BrokerLoiRecord;
  selected: boolean;
  onSelect: () => void;
}) {
  const productLabel = getLoiProductLabel(loi);
  const interestDisplay = formatLoiInterestDisplay(loi);
  const approvedDisplay = formatLoiApprovedDisplay(
    loi.approvedAmount,
    loi.reviewStatus || loi.status,
  );
  const generatedLabel = formatLoiGeneratedLabel(loi.generatedAt);
  const pdfReady = hasLoiPdf(loi);
  const statusLabel = formatLoiStatusLabel(loi.reviewStatus || loi.status);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border p-3.5 text-left transition ${
        selected
          ? "border-violet-400 bg-violet-50 shadow-sm ring-1 ring-violet-200 dark:border-violet-500/50 dark:bg-violet-500/10 dark:ring-violet-500/20"
          : "border-slate-200 bg-white hover:border-violet-200 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-violet-500/30 dark:hover:bg-slate-900"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            selected
              ? "bg-violet-600 text-white"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          <FileText size={17} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-bold leading-snug text-slate-900 dark:text-white">
            {loi.lenderName}
          </p>
          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">
            {productLabel}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getLoiStatusChipClass(loi.reviewStatus || loi.status)}`}
            >
              {statusLabel}
            </span>
            {pdfReady ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                PDF ready
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                No PDF yet
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-slate-100 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Approved
          </p>
          <p
            className={`mt-0.5 break-words text-xs font-bold leading-snug ${
              approvedDisplay === "Pending" || approvedDisplay === "Under review"
                ? "text-amber-600 dark:text-amber-400"
                : approvedDisplay === "—"
                  ? "text-slate-400"
                  : "text-slate-800 dark:text-slate-100"
            }`}
          >
            {approvedDisplay}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Rate
          </p>
          <p className="mt-0.5 break-words text-xs font-bold leading-snug text-slate-800 dark:text-slate-100">
            {interestDisplay}
          </p>
        </div>
      </div>

      <p className="mt-2.5 text-[11px] leading-relaxed text-slate-400">
        {loi.generatedAt ? (
          <>
            Generated{" "}
            <span className="font-medium text-slate-500 dark:text-slate-400">
              {generatedLabel}
            </span>
          </>
        ) : (
          <span className="italic text-slate-400">{generatedLabel}</span>
        )}
      </p>
    </button>
  );
}

function LoiDetailDrawer({
  loi,
  onClose,
  onViewPdf,
}: {
  loi: BrokerLoiRecord;
  onClose: () => void;
  onViewPdf: () => void;
}) {
  const productLabel = getLoiProductLabel(loi);

  return (
    <div className="fixed inset-0 z-[9998] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {loi.lenderName}
            </h3>
            <p className="text-sm text-slate-500">{productLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          <div className="grid gap-2 sm:grid-cols-2">
            <DetailItem
              label="Approved Amount"
              value={formatLoiApprovedDisplay(
                loi.approvedAmount,
                loi.reviewStatus || loi.status,
              )}
            />
            <DetailItem
              label="Interest Rate"
              value={formatLoiInterestDisplay(loi)}
            />
            <DetailItem
              label="Generated"
              value={formatLoiGeneratedLabel(loi.generatedAt)}
              icon={<Calendar size={11} />}
            />
            <DetailItem
              label="Lender Email"
              value={loi.lenderEmail || "—"}
              icon={<Mail size={11} />}
            />
            <DetailItem
              label="Lender Phone"
              value={loi.lenderPhone || "—"}
              icon={<Phone size={11} />}
            />
            <DetailItem
              label="Reviewed By"
              value={loi.reviewedBy?.name || loi.reviewedBy?.email || "—"}
              icon={<User size={11} />}
            />
          </div>

          {loi.notes && (
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Lender Notes
              </p>
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {loi.notes}
              </p>
            </div>
          )}

          {!!loi.conditions?.length && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Conditions ({loi.conditions.length})
              </p>
              <div className="space-y-1.5">
                {loi.conditions.map((condition) => (
                  <div
                    key={condition.conditionId}
                    className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-800"
                  >
                    <span className="text-slate-700 dark:text-slate-300">
                      {condition.description}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${getLoiStatusChipClass(condition.status)}`}
                    >
                      {formatLoiStatusLabel(condition.status)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {loi.loiUrl && (
          <div className="border-t border-slate-200 px-5 py-3 dark:border-slate-800">
            <button
              type="button"
              onClick={onViewPdf}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
            >
              <ExternalLink size={15} />
              Open PDF Preview
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BrokerLoiPanel({
  applicationId,
  apiRole = "broker",
  getAuthHeaders,
  isActive = true,
  onLoiCountChange,
}: BrokerLoiPanelProps) {
  const [data, setData] = useState<BrokerLoiListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<LoiSortOption>("newest");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailLoi, setDetailLoi] = useState<BrokerLoiRecord | null>(null);
  const [brokerLoiStatus, setBrokerLoiStatus] = useState<BrokerLoiStatus | null>(
    null,
  );
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [prefillData, setPrefillData] = useState<BrokerLoiPrefill | null>(null);
  const [generatingBrokerLoi, setGeneratingBrokerLoi] = useState(false);
  const [signActionLoading, setSignActionLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("lender");
  const pdfPreviewRef = useRef<HTMLElement>(null);

  const signWorkflow = brokerLoiStatus?.signWorkflow;
  const brokerLoiLocked = Boolean(signWorkflow?.isComplete);

  const canManageBrokerLoi = apiRole === "broker" || apiRole === "loanofficer";

  const apiPath =
    apiRole === "subbroker"
      ? `${API_BASE}/subbroker/view-loi`
      : `${API_BASE}/${apiRole}/loan-pipeline`;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchLois = useCallback(
    async (pageNo = 1) => {
      if (!applicationId) return;

      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: String(pageNo),
          limit: String(DEFAULT_LIMIT),
        });

        if (debouncedSearch) {
          params.set("search", debouncedSearch);
        }

        const res = await fetch(
          `${apiPath}/${applicationId}/lois?${params.toString()}`,
          {
            method: "GET",
            headers: getAuthHeaders(),
          },
        );
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.message || "Failed to fetch LOIs");
        }

        setData(json.data);
        setPage(json.data.pagination?.page || pageNo);
        onLoiCountChange?.(json.data.totalLoiReceived ?? json.data.lois?.length ?? 0);
      } catch (err: any) {
        toast.error(err.message || "Failed to load LOIs");
        onLoiCountChange?.(0);
      } finally {
        setLoading(false);
      }
    },
    [applicationId, apiPath, debouncedSearch, getAuthHeaders, onLoiCountChange],
  );

  useEffect(() => {
    if (isActive && applicationId) {
      fetchLois(page);
    }
  }, [isActive, applicationId, page, debouncedSearch, fetchLois]);

  const fetchBrokerLoiStatus = useCallback(async () => {
    if (!applicationId || !canManageBrokerLoi) return;

    try {
      const res = await fetch(`${apiPath}/${applicationId}/broker-loi`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setBrokerLoiStatus(json.data);
        if (json.data?.brokerLoiUrl) {
          setPreviewMode((current) =>
            current === "broker-edit" ? current : "broker-pdf",
          );
        }
      }
    } catch {
      /* optional */
    }
  }, [applicationId, apiPath, canManageBrokerLoi, getAuthHeaders]);

  useEffect(() => {
    if (isActive && applicationId && canManageBrokerLoi) {
      fetchBrokerLoiStatus();
    }
  }, [isActive, applicationId, canManageBrokerLoi, fetchBrokerLoiStatus]);

  const handleOpenBrokerLoiForm = useCallback(
    async (sourceApplicationLenderId?: unknown) => {
      if (brokerLoiLocked) {
        toast.error(
          "Broker LOI was already forwarded to the lender and cannot be edited.",
        );
        return;
      }

      const lenderId =
        resolveApplicationLenderId(sourceApplicationLenderId) || selectedId;
      if (!applicationId || !lenderId) {
        toast.error("Select a lender LOI first");
        return;
      }

      try {
        setPrefillLoading(true);
        const params = new URLSearchParams({
          sourceApplicationLenderId: lenderId,
        });
        const res = await fetch(
          `${apiPath}/${applicationId}/broker-loi/prefill?${params.toString()}`,
          { headers: getAuthHeaders() },
        );
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.message || "Failed to load LOI details");
        }
        setPrefillData(json.data);
        setPreviewMode("broker-edit");
      } catch (err: any) {
        toast.error(err.message || "Failed to prepare broker LOI");
      } finally {
        setPrefillLoading(false);
      }
    },
    [applicationId, apiPath, brokerLoiLocked, getAuthHeaders, selectedId],
  );

  const handleEditBrokerLoi = async () => {
    if (brokerLoiLocked) {
      toast.error(
        "Broker LOI was already forwarded to the lender and cannot be edited.",
      );
      return;
    }

    if (!applicationId || !brokerLoiStatus?.sourceApplicationLenderId) {
      toast.error("No broker LOI to edit");
      return;
    }

    if (
      prefillData?.sourceApplicationLenderId ===
        brokerLoiStatus.sourceApplicationLenderId &&
      brokerLoiStatus.terms
    ) {
      setPrefillData((prev) =>
        prev
          ? { ...prev, terms: brokerLoiStatus.terms! }
          : {
              sourceApplicationLenderId:
                brokerLoiStatus.sourceApplicationLenderId!,
              sourceLenderName:
                brokerLoiStatus.sourceLenderName || "selected lender",
              terms: brokerLoiStatus.terms!,
            },
      );
      setPreviewMode("broker-edit");
      return;
    }

    try {
      setPrefillLoading(true);
      const params = new URLSearchParams({
        sourceApplicationLenderId: brokerLoiStatus.sourceApplicationLenderId,
      });
      const res = await fetch(
        `${apiPath}/${applicationId}/broker-loi/prefill?${params.toString()}`,
        { headers: getAuthHeaders() },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load broker LOI details");
      }
      setPrefillData({
        ...json.data,
        terms: brokerLoiStatus.terms || json.data.terms,
      });
      setPreviewMode("broker-edit");
    } catch (err: any) {
      toast.error(err.message || "Failed to prepare broker LOI editor");
    } finally {
      setPrefillLoading(false);
    }
  };

  const handleCancelBrokerEdit = () => {
    setPreviewMode(brokerLoiStatus?.brokerLoiUrl ? "broker-pdf" : "lender");
  };

  const scrollToPdfPreview = useCallback(() => {
    window.setTimeout(() => {
      pdfPreviewRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  }, []);

  const handleSwitchPreviewMode = (mode: PreviewMode) => {
    if (mode === "broker-edit") {
      if (brokerLoiLocked) {
        toast.error(
          "Broker LOI was already forwarded to the lender and cannot be edited.",
        );
        return;
      }
      if (prefillData) {
        setPreviewMode("broker-edit");
        return;
      }
      if (brokerLoiStatus?.brokerLoiUrl) {
        void handleEditBrokerLoi();
        return;
      }
      if (selectedLoi) {
        void handleOpenBrokerLoiForm();
        return;
      }
      toast.error("Select a lender LOI first");
      return;
    }
    setPreviewMode(mode);
    if (mode === "broker-pdf") {
      scrollToPdfPreview();
    }
  };

  const handleViewBrokerPdf = () => {
    setPreviewMode("broker-pdf");
    scrollToPdfPreview();
  };

  const handleGenerateBrokerLoi = async (
    terms: BrokerLoiTerms,
    branding: { brandName: string; logoUrl: string },
  ) => {
    if (!applicationId || !prefillData) return;
    if (brokerLoiLocked) {
      toast.error(
        "Broker LOI was already forwarded to the lender and cannot be replaced.",
      );
      return;
    }

    try {
      setGeneratingBrokerLoi(true);
      const res = await fetch(
        `${apiPath}/${applicationId}/broker-loi/generate`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            sourceApplicationLenderId: prefillData.sourceApplicationLenderId,
            brokerTerms: terms,
            branding,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to generate broker LOI");
      }

      toast.success("Broker LOI generated successfully");
      if (json.data?.signWorkflow) {
        setBrokerLoiStatus((prev) =>
          prev
            ? { ...prev, signWorkflow: json.data.signWorkflow }
            : { signWorkflow: json.data.signWorkflow },
        );
      }
      await fetchBrokerLoiStatus();
      setPreviewMode("broker-pdf");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate broker LOI");
    } finally {
      setGeneratingBrokerLoi(false);
    }
  };

  const handleSendBrokerLoiToClient = async () => {
    if (!applicationId) return;

    try {
      setSignActionLoading(true);
      const res = await fetch(
        `${apiPath}/${applicationId}/broker-loi/send-to-client`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({}),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to send broker LOI to client");
      }
      toast.success("Broker LOI sent to client for signature");
      await fetchBrokerLoiStatus();
    } catch (err: any) {
      toast.error(err.message || "Failed to send broker LOI to client");
    } finally {
      setSignActionLoading(false);
    }
  };

  const handleForwardBrokerLoiToLender = async () => {
    if (!applicationId) return;

    try {
      setSignActionLoading(true);
      const res = await fetch(
        `${apiPath}/${applicationId}/broker-loi/forward-to-lender`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({}),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to forward broker LOI to lender");
      }
      toast.success("Signed broker LOI forwarded to lender");
      await fetchBrokerLoiStatus();
    } catch (err: any) {
      toast.error(err.message || "Failed to forward broker LOI to lender");
    } finally {
      setSignActionLoading(false);
    }
  };

  const sortedLois = useMemo(
    () => sortBrokerLois(data?.lois || [], sortBy),
    [data?.lois, sortBy],
  );

  const comparison = useMemo(
    () => buildLoiComparisonSummary(sortedLois),
    [sortedLois],
  );

  const selectedLoi = useMemo(
    () =>
      sortedLois.find((loi) => loi.applicationLenderId === selectedId) ||
      sortedLois[0] ||
      null,
    [sortedLois, selectedId],
  );

  useEffect(() => {
    if (!sortedLois.length) {
      setSelectedId(null);
      return;
    }

    if (
      !selectedId ||
      !sortedLois.some((loi) => loi.applicationLenderId === selectedId)
    ) {
      setSelectedId(sortedLois[0].applicationLenderId);
    }
  }, [sortedLois, selectedId]);

  useEffect(() => {
    if (
      !canManageBrokerLoi ||
      previewMode !== "broker-edit" ||
      !selectedId ||
      brokerLoiLocked
    ) {
      return;
    }
    if (prefillData?.sourceApplicationLenderId === selectedId) {
      return;
    }
    void handleOpenBrokerLoiForm(selectedId);
  }, [
    canManageBrokerLoi,
    previewMode,
    selectedId,
    brokerLoiLocked,
    prefillData?.sourceApplicationLenderId,
    handleOpenBrokerLoiForm,
  ]);

  useEffect(() => {
    if (brokerLoiLocked && previewMode === "broker-edit") {
      setPreviewMode("broker-pdf");
    }
  }, [brokerLoiLocked, previewMode]);

  const previewUrl = useMemo(() => {
    const signedPdfUrl = signWorkflow?.signedPdfUrl;
    const showSignedPdf =
      previewMode === "broker-pdf" &&
      signedPdfUrl &&
      (signWorkflow?.signStatus === "CLIENT_SIGNED" ||
        signWorkflow?.signStatus === "FORWARDED_TO_LENDER" ||
        signWorkflow?.signStatus === "LENDER_SEEN");

    if (showSignedPdf) {
      return buildLoiPdfUrl(API_BASE, signedPdfUrl);
    }
    if (previewMode === "broker-pdf" && brokerLoiStatus?.brokerLoiUrl) {
      return buildLoiPdfUrl(API_BASE, brokerLoiStatus.brokerLoiUrl);
    }
    if (previewMode === "lender" && selectedLoi) {
      return buildLoiPdfUrl(API_BASE, selectedLoi.loiUrl);
    }
    return null;
  }, [
    previewMode,
    brokerLoiStatus?.brokerLoiUrl,
    selectedLoi,
    signWorkflow?.signedPdfUrl,
    signWorkflow?.signStatus,
  ]);

  const previewingSignedLoi = Boolean(
    previewMode === "broker-pdf" &&
      signWorkflow?.signedPdfUrl &&
      (signWorkflow?.signStatus === "CLIENT_SIGNED" ||
        signWorkflow?.signStatus === "FORWARDED_TO_LENDER" ||
        signWorkflow?.signStatus === "LENDER_SEEN"),
  );

  const previewTitle =
    previewMode === "broker-pdf"
      ? previewingSignedLoi
        ? "Signed Broker LOI"
        : "Your Broker LOI"
      : previewMode === "broker-edit"
        ? "Create Broker LOI"
        : selectedLoi
          ? `${selectedLoi.lenderName} — LOI`
          : "LOI Preview";

  const showRightPanel =
    Boolean(selectedLoi) ||
    Boolean(brokerLoiStatus?.brokerLoiUrl) ||
    (previewMode === "broker-edit" && Boolean(prefillData));

  const pagination = data?.pagination;

  const handleDownload = async () => {
    if (!previewUrl) return;

    try {
      const res = await fetch(previewUrl);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const fileLabel =
        previewMode === "broker-pdf"
          ? previewingSignedLoi
            ? signWorkflow?.signedPdfFileName || "Signed-Broker-LOI.pdf"
            : "Broker-LOI.pdf"
          : `${selectedLoi?.lenderName.replace(/\s+/g, "-") || "Lender"}-LOI.pdf`;
      link.download = fileLabel;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download LOI");
    }
  };

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="border-b border-slate-100 bg-gradient-to-r from-violet-50/80 via-white to-white px-5 py-4 dark:border-slate-800 dark:from-violet-500/10 dark:via-slate-950 dark:to-slate-950">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                LOI / Term Sheets
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Review and compare Letters of Intent from multiple lenders.
              </p>
              {data?.applicationNumber && (
                <p className="mt-1.5 text-xs font-medium text-slate-400">
                  Application #{data.applicationNumber}
                  {comparison.total > 0 &&
                    ` · ${comparison.total} received`}
                </p>
              )}
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-xl">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search lender..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-violet-500/20"
                />
              </div>

              <div className="relative sm:w-44">
                <ArrowDownUp
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as LoiSortOption)}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-8 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-violet-500/20"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {canManageBrokerLoi && (
            <div className="mt-4 rounded-xl border border-violet-100 bg-white/80 p-3 dark:border-violet-500/20 dark:bg-slate-900/40">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-300">
                Broker LOI Workflow
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                {WORKFLOW_STEPS.map((step, index) => (
                  <span key={step} className="inline-flex items-center gap-2">
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 font-semibold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                      {index + 1}
                    </span>
                    {step}
                    {index < WORKFLOW_STEPS.length - 1 && (
                      <span className="text-slate-300">→</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {canManageBrokerLoi && brokerLoiStatus?.brokerLoiUrl && (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                    Broker LOI generated
                  </p>
                  <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
                    Based on {brokerLoiStatus.sourceLenderName || "selected lender"}
                    {brokerLoiStatus.brokerLoiGeneratedAt &&
                      ` · ${formatLoiDate(brokerLoiStatus.brokerLoiGeneratedAt)}`}
                  </p>
                  {signWorkflow?.signStatusLabel && (
                    <p className="mt-1 text-xs font-medium text-emerald-900/80 dark:text-emerald-100/80">
                      Status: {signWorkflow.signStatusLabel}
                      {signWorkflow.signStatus === "SENT_TO_CLIENT" &&
                        " — waiting for client signature in portal"}
                      {signWorkflow.signStatus === "CLIENT_SIGNED" &&
                        " — signed PDF ready; forward to lender when ready"}
                    </p>
                  )}
                  {signWorkflow?.signedPdfUrl &&
                    signWorkflow.signStatus !== "AWAITING_BROKER" &&
                    signWorkflow.signStatus !== "SENT_TO_CLIENT" && (
                      <p className="mt-1 text-xs text-emerald-700/90 dark:text-emerald-200/90">
                        Client signature is embedded in the signed PDF
                        {signWorkflow.clientSignedAt &&
                          ` · ${formatLoiDate(signWorkflow.clientSignedAt)}`}
                      </p>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleViewBrokerPdf}
                    className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-950 dark:text-emerald-200"
                  >
                    {signWorkflow?.signedPdfUrl &&
                    signWorkflow.signStatus !== "AWAITING_BROKER" &&
                    signWorkflow.signStatus !== "SENT_TO_CLIENT"
                      ? "View Signed PDF"
                      : "View Broker PDF"}
                  </button>
                  {signWorkflow?.canSendToClient && (
                    <button
                      type="button"
                      disabled={signActionLoading}
                      onClick={handleSendBrokerLoiToClient}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {signActionLoading ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <SendHorizonal size={13} />
                      )}
                      Send to Client
                    </button>
                  )}
                  {signWorkflow?.canForwardToLender && (
                    <button
                      type="button"
                      disabled={signActionLoading}
                      onClick={handleForwardBrokerLoiToLender}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                    >
                      {signActionLoading ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <SendHorizonal size={13} />
                      )}
                      Forward to Lender
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {!loading && comparison.total > 1 && (
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <SummaryStat
                label="Lowest Rate"
                value={
                  comparison.bestRate
                    ? formatPercent(comparison.bestRate.value)
                    : "—"
                }
                hint={comparison.bestRate?.lenderName}
                icon={<TrendingDown size={12} />}
                accent="emerald"
              />
              <SummaryStat
                label="Highest Approved"
                value={
                  comparison.highestAmount
                    ? formatCurrency(comparison.highestAmount.value)
                    : "—"
                }
                hint={comparison.highestAmount?.lenderName}
                icon={<TrendingUp size={12} />}
                accent="sky"
              />
              <SummaryStat
                label="Most Recent"
                value={
                  comparison.latestGenerated
                    ? formatLoiDate(comparison.latestGenerated.date)
                    : "—"
                }
                hint={comparison.latestGenerated?.lenderName}
                icon={<Calendar size={12} />}
                accent="violet"
              />
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-violet-600" />
            Loading LOIs...
          </div>
        ) : !sortedLois.length ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-500/10">
              <FileText className="h-7 w-7 text-violet-600 dark:text-violet-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              No LOIs Available
            </h3>
            <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
              {debouncedSearch
                ? "No LOIs match your search. Try a different lender name."
                : "No lenders have issued a Letter of Intent for this application yet. LOIs will appear here once lenders generate them."}
            </p>
          </div>
        ) : (
          <div className="grid min-h-[560px] lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
            <aside className="border-b border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/30 lg:border-b-0 lg:border-r">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Lenders ({sortedLois.length})
              </p>
              <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1 lg:max-h-[calc(560px-2rem)]">
                {sortedLois.map((loi) => (
                  <LoiListItem
                    key={loi.applicationLenderId}
                    loi={loi}
                    selected={selectedLoi?.applicationLenderId === loi.applicationLenderId}
                    onSelect={() => setSelectedId(loi.applicationLenderId)}
                  />
                ))}
              </div>

              {pagination && pagination.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                  <button
                    type="button"
                    disabled={!pagination.hasPrevPage || loading}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    className="inline-flex items-center rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs text-slate-500">
                    {pagination.page} / {pagination.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={!pagination.hasNextPage || loading}
                    onClick={() =>
                      setPage((current) =>
                        Math.min(pagination.totalPages, current + 1),
                      )
                    }
                    className="inline-flex items-center rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </aside>

            <section
              ref={pdfPreviewRef}
              className="flex min-h-[420px] scroll-mt-6 flex-col bg-slate-100/70 dark:bg-slate-950"
            >
              {showRightPanel && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                    <div className="min-w-0 flex-1">
                      {canManageBrokerLoi && (
                        <div className="mb-2 flex flex-wrap gap-2">
                          {selectedLoi && (
                            <button
                              type="button"
                              onClick={() => handleSwitchPreviewMode("lender")}
                              className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                                previewMode === "lender"
                                  ? "bg-violet-600 text-white"
                                  : "border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                              }`}
                            >
                              Lender LOI
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={prefillLoading || brokerLoiLocked}
                            onClick={() => handleSwitchPreviewMode("broker-edit")}
                            title={
                              brokerLoiLocked
                                ? "Broker LOI was forwarded to the lender and cannot be edited"
                                : undefined
                            }
                            className={`rounded-lg px-3 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                              previewMode === "broker-edit"
                                ? "bg-violet-600 text-white"
                                : "border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {brokerLoiStatus?.brokerLoiUrl
                              ? "Edit Broker LOI"
                              : "Create Broker LOI"}
                          </button>
                          {brokerLoiStatus?.brokerLoiUrl && (
                            <button
                              type="button"
                              onClick={() => handleSwitchPreviewMode("broker-pdf")}
                              className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                                previewMode === "broker-pdf"
                                  ? "bg-emerald-600 text-white"
                                  : "border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                              }`}
                            >
                              Your Broker LOI
                            </button>
                          )}
                        </div>
                      )}

                      <h3 className="text-base font-bold leading-snug text-slate-900 dark:text-white">
                        {previewMode === "broker-pdf"
                          ? "Broker LOI / Term Sheet"
                          : previewMode === "broker-edit"
                            ? brokerLoiStatus?.brokerLoiUrl
                              ? "Edit Broker LOI"
                              : "Create Broker LOI"
                            : selectedLoi?.lenderName}
                      </h3>
                      <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                        {previewMode === "broker-pdf"
                          ? `Based on ${brokerLoiStatus?.sourceLenderName || "selected lender LOI"}`
                          : previewMode === "broker-edit"
                            ? prefillData
                              ? `Terms from ${prefillData.sourceLenderName} — edit below, then generate your branded PDF`
                              : "Select a lender LOI and copy terms to create your broker LOI"
                            : selectedLoi
                              ? getLoiProductLabel(selectedLoi)
                              : ""}
                      </p>
                      {previewMode === "lender" && selectedLoi && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                          <span>
                            {formatLoiApprovedDisplay(
                              selectedLoi.approvedAmount,
                              selectedLoi.reviewStatus || selectedLoi.status,
                            )}
                          </span>
                          <span aria-hidden>·</span>
                          <span>{formatLoiInterestDisplay(selectedLoi)}</span>
                          <span aria-hidden>·</span>
                          <span>{formatLoiGeneratedLabel(selectedLoi.generatedAt)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {canManageBrokerLoi &&
                        previewMode === "lender" &&
                        selectedLoi && (
                          <button
                            type="button"
                            disabled={prefillLoading || brokerLoiLocked}
                            onClick={() => void handleOpenBrokerLoiForm()}
                            title={
                              brokerLoiLocked
                                ? "Broker LOI was forwarded to the lender and cannot be edited"
                                : undefined
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {prefillLoading ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Sparkles size={13} />
                            )}
                            Create Broker LOI
                          </button>
                        )}
                      {canManageBrokerLoi &&
                        previewMode === "broker-pdf" &&
                        brokerLoiStatus?.brokerLoiUrl && (
                          <>
                            {signWorkflow?.canSendToClient && (
                              <button
                                type="button"
                                disabled={signActionLoading}
                                onClick={handleSendBrokerLoiToClient}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                              >
                                {signActionLoading ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <SendHorizonal size={13} />
                                )}
                                Send to Client
                              </button>
                            )}
                            {signWorkflow?.canForwardToLender && (
                              <button
                                type="button"
                                disabled={signActionLoading}
                                onClick={handleForwardBrokerLoiToLender}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
                              >
                                {signActionLoading ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <SendHorizonal size={13} />
                                )}
                                Forward to Lender
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={prefillLoading || brokerLoiLocked}
                              onClick={handleEditBrokerLoi}
                              title={
                                brokerLoiLocked
                                  ? "Broker LOI was forwarded to the lender and cannot be edited"
                                  : undefined
                              }
                              className="rounded-lg border border-violet-200 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-500/30 dark:text-violet-300 dark:hover:bg-violet-500/10"
                            >
                              Edit & Regenerate
                            </button>
                          </>
                        )}
                      {previewMode === "lender" && selectedLoi && (
                        <button
                          type="button"
                          onClick={() => setDetailLoi(selectedLoi)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          Details
                        </button>
                      )}
                      {previewUrl && previewMode !== "broker-edit" && (
                        <>
                          <button
                            type="button"
                            onClick={handleDownload}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <Download size={13} />
                            Download
                          </button>
                          <a
                            href={previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900"
                          >
                            <ExternalLink size={13} />
                            Open Tab
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  {previewMode === "broker-edit" && prefillData ? (
                    <BrokerLoiEditorPanel
                      sourceLenderName={prefillData.sourceLenderName}
                      terms={prefillData.terms}
                      applicationContext={prefillData.applicationContext}
                      brokerBranding={prefillData.brokerBranding}
                      submitting={generatingBrokerLoi}
                      readOnly={brokerLoiLocked}
                      onCancel={handleCancelBrokerEdit}
                      onSubmit={handleGenerateBrokerLoi}
                    />
                  ) : previewUrl ? (
                    <iframe
                      src={previewUrl}
                      title={previewTitle}
                      className="h-full min-h-[480px] w-full flex-1 bg-white"
                    />
                  ) : previewMode === "broker-edit" ? (
                    <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-500">
                      {prefillLoading ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
                          Loading broker LOI editor...
                        </span>
                      ) : (
                        "Select a lender LOI and click Create Broker LOI to begin."
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-500">
                      PDF not available for this lender yet.
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </div>

      {detailLoi && (
        <LoiDetailDrawer
          loi={detailLoi}
          onClose={() => setDetailLoi(null)}
          onViewPdf={() => {
            setSelectedId(detailLoi.applicationLenderId);
            setPreviewMode("lender");
            setDetailLoi(null);
          }}
        />
      )}

    </>
  );
}
