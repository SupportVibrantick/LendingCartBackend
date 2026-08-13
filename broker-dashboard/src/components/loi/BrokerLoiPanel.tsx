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
  RotateCcw,
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
import Swal from "sweetalert2";
import { hasPermission } from "../../lib/brokerPermissions";
import {
  buildLoiComparisonSummary,
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
import { buildApiPublicFileUrl } from "../../lib/publicFileUrl";
import EmbeddedFilePreview from "../documents/EmbeddedFilePreview";
import BrokerLoiEditorPanel from "./BrokerLoiEditorPanel";
import type { BrokerLoiTerms } from "../../lib/brokerLoiTerms";

type PreviewMode = "lender" | "broker-edit" | "broker-pdf";
type BrokerEditorMode = "create" | "regenerate" | "revised";

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
  isLocked?: boolean;
  isComplete?: boolean;
};

type BrokerLoiVersionInfo = {
  id: string;
  versionNumber: number;
  label: string;
  status: string;
  brokerLoiUrl?: string | null;
  isLocked?: boolean;
  canRegenerateDraft?: boolean;
  canCreateRevised?: boolean;
};

type BrokerLoiStatus = {
  brokerLoiUrl?: string | null;
  brokerLoiGeneratedAt?: string | null;
  sourceApplicationLenderId?: string | null;
  sourceLenderName?: string | null;
  forwardableLenders?: Array<{
    applicationLenderId: string;
    lenderName: string;
    status?: string;
  }>;
  requiresLenderSelectionForForward?: boolean;
  terms?: BrokerLoiTerms | null;
  currentVersion?: BrokerLoiVersionInfo | null;
  versions?: BrokerLoiVersionInfo[];
  signWorkflow?: BrokerLoiSignWorkflow | null;
};

type BrokerLoiPrefill = {
  sourceApplicationLenderId?: string | null;
  sourceLenderName: string;
  standalone?: boolean;
  terms: BrokerLoiTerms;
  applicationContext?: {
    borrowerName?: string;
    propertyAddress?: string;
    propertyType?: string;
    loanProduct?: string;
    loanProductCode?: string;
    brokerName?: string;
  };
  brokerBranding?: {
    brandName?: string | null;
    logoUrl?: string | null;
    isComplete?: boolean;
  };
};

const WORKFLOW_STEPS = [
  "Create or select terms",
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

function hasExistingBrokerLoiRecord(
  status: BrokerLoiStatus | null | undefined,
): boolean {
  return Boolean(
    status?.brokerLoiUrl ||
      status?.currentVersion?.id ||
      status?.currentVersion?.brokerLoiUrl ||
      status?.signWorkflow?.signedPdfUrl ||
      status?.signWorkflow?.requirementId ||
      (status?.versions?.length ?? 0) > 0,
  );
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
  const [brokerLoiStatusLoaded, setBrokerLoiStatusLoaded] = useState(false);
  const [brokerLoiStatusLoading, setBrokerLoiStatusLoading] = useState(false);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [prefillData, setPrefillData] = useState<BrokerLoiPrefill | null>(null);
  const [generatingBrokerLoi, setGeneratingBrokerLoi] = useState(false);
  const [brokerEditorMode, setBrokerEditorMode] =
    useState<BrokerEditorMode>("create");
  const [signActionLoading, setSignActionLoading] = useState(false);
  const [forwardLenderId, setForwardLenderId] = useState<string>("");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("lender");
  const pdfPreviewRef = useRef<HTMLElement>(null);

  const signWorkflow = brokerLoiStatus?.signWorkflow;
  const brokerLoiLocked = Boolean(signWorkflow?.isLocked);
  const canCreateRevisedBrokerLoi = Boolean(
    brokerLoiStatus?.currentVersion?.canCreateRevised || brokerLoiLocked,
  );
  const nextBrokerRevisedVersion =
    (brokerLoiStatus?.versions?.reduce(
      (max, v) => Math.max(max, v.versionNumber || 0),
      0,
    ) || 0) + 1;

  const isBrokerActor = apiRole === "broker";
  const isLoanOfficerActor = apiRole === "loanofficer";
  const canViewBrokerLoi =
    isBrokerActor ||
    (isLoanOfficerActor &&
      hasPermission("VIEW_LOI_TERM_SHEET", "loanOfficer"));
  const canCreateTermSheet =
    isBrokerActor ||
    (isLoanOfficerActor && hasPermission("GENERATE_LOI", "loanOfficer"));
  const canRegenerateTermSheet =
    isBrokerActor ||
    (isLoanOfficerActor && hasPermission("REGENERATE_LOI", "loanOfficer"));
  const canSendBrokerLoiToClient =
    isBrokerActor ||
    (isLoanOfficerActor &&
      hasPermission("SEND_LOI_TO_CLIENT", "loanOfficer"));
  const canForwardBrokerLoiToLender =
    isBrokerActor ||
    (isLoanOfficerActor &&
      hasPermission("SEND_LOI_TO_LENDER", "loanOfficer"));
  const canManageBrokerLoi = canViewBrokerLoi;

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

  const fetchBrokerLoiStatus = useCallback(
    async (options?: { forcePdfPreview?: boolean }) => {
      if (!applicationId || !canManageBrokerLoi) {
        setBrokerLoiStatusLoaded(true);
        return null;
      }

      try {
        setBrokerLoiStatusLoading(true);
        const res = await fetch(`${apiPath}/${applicationId}/broker-loi`, {
          headers: getAuthHeaders(),
        });
        const json = await res.json();
        if (res.ok && json.success) {
          setBrokerLoiStatus(json.data);
          const hasExisting = hasExistingBrokerLoiRecord(json.data);
          if (hasExisting) {
            if (options?.forcePdfPreview) {
              setPreviewMode("broker-pdf");
            } else {
              setPreviewMode((current) =>
                current === "broker-edit" ? current : "broker-pdf",
              );
            }
          }
          return json.data as BrokerLoiStatus;
        }
      } catch {
        /* optional */
      } finally {
        setBrokerLoiStatusLoading(false);
        setBrokerLoiStatusLoaded(true);
      }
      return null;
    },
    [applicationId, apiPath, canManageBrokerLoi, getAuthHeaders],
  );

  useEffect(() => {
    setBrokerLoiStatus(null);
    setBrokerLoiStatusLoaded(false);
    if (isActive && applicationId && canManageBrokerLoi) {
      fetchBrokerLoiStatus();
    }
  }, [isActive, applicationId, canManageBrokerLoi, fetchBrokerLoiStatus]);

  const handleCreateOwnTermSheet = useCallback(async () => {
    if (!applicationId) return;

    const hasExistingBrokerLoi = hasExistingBrokerLoiRecord(brokerLoiStatus);

    if (
      hasExistingBrokerLoi &&
      brokerLoiLocked &&
      !canCreateRevisedBrokerLoi
    ) {
      toast.error(
        "Broker LOI is locked after client signature. Create a revised LOI instead.",
      );
      return;
    }

    if (
      hasExistingBrokerLoi &&
      !brokerLoiLocked &&
      (signWorkflow?.sentToClientAt ||
        signWorkflow?.signStatus === "SENT_TO_CLIENT")
    ) {
      const result = await Swal.fire({
        title: "Regenerate broker term sheet?",
        html: "This updates the broker LOI draft and resets the client send workflow. You will need to send the updated term sheet to the client again.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Regenerate",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#7C3AED",
      });

      if (!result.isConfirmed) return;
    }

    try {
      setPrefillLoading(true);
      const res = await fetch(
        `${apiPath}/${applicationId}/broker-loi/prefill`,
        { headers: getAuthHeaders() },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to prepare term sheet");
      }

      // New create: blank commercial terms. Edit/regenerate keeps saved terms.
      // Branding always comes from white-label prefill.
      const terms =
        hasExistingBrokerLoi && brokerLoiStatus?.terms
          ? brokerLoiStatus.terms
          : json.data.terms;

      setPrefillData({
        ...json.data,
        terms,
        standalone: true,
      });
      setBrokerEditorMode(hasExistingBrokerLoi ? "regenerate" : "create");
      setPreviewMode("broker-edit");
    } catch (err: any) {
      toast.error(err.message || "Failed to prepare term sheet");
    } finally {
      setPrefillLoading(false);
    }
  }, [
    applicationId,
    apiPath,
    brokerLoiLocked,
    brokerLoiStatus,
    canCreateRevisedBrokerLoi,
    getAuthHeaders,
    signWorkflow?.sentToClientAt,
    signWorkflow?.signStatus,
  ]);

  const handleOpenBrokerLoiForm = useCallback(
    async (sourceApplicationLenderId?: unknown) => {
      const lenderId =
        resolveApplicationLenderId(sourceApplicationLenderId) || selectedId;
      if (!applicationId || !lenderId) {
        toast.error("Select a lender LOI first");
        return;
      }

      const hasExistingBrokerLoi = hasExistingBrokerLoiRecord(brokerLoiStatus);
      const sameSource =
        brokerLoiStatus?.sourceApplicationLenderId === lenderId;

      if (
        hasExistingBrokerLoi &&
        brokerLoiLocked &&
        !canCreateRevisedBrokerLoi
      ) {
        toast.error(
          "Broker LOI is locked after client signature. Create a revised LOI instead.",
        );
        return;
      }

      if (
        hasExistingBrokerLoi &&
        !brokerLoiLocked &&
        (signWorkflow?.sentToClientAt ||
          signWorkflow?.signStatus === "SENT_TO_CLIENT")
      ) {
        const result = await Swal.fire({
          title: "Regenerate broker term sheet?",
          html: "This updates the broker LOI draft and resets the client send workflow. You will need to send the updated term sheet to the client again.",
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Regenerate",
          cancelButtonText: "Cancel",
          confirmButtonColor: "#7C3AED",
        });

        if (!result.isConfirmed) return;
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

        const terms =
          hasExistingBrokerLoi && sameSource && brokerLoiStatus?.terms
            ? brokerLoiStatus.terms
            : json.data.terms;

        setPrefillData({ ...json.data, terms });
        setBrokerEditorMode(hasExistingBrokerLoi ? "regenerate" : "create");
        setPreviewMode("broker-edit");
      } catch (err: any) {
        toast.error(err.message || "Failed to prepare broker LOI");
      } finally {
        setPrefillLoading(false);
      }
    },
    [
      applicationId,
      apiPath,
      brokerLoiLocked,
      canCreateRevisedBrokerLoi,
      brokerLoiStatus?.brokerLoiUrl,
      brokerLoiStatus?.sourceApplicationLenderId,
      brokerLoiStatus?.terms,
      getAuthHeaders,
      selectedId,
      signWorkflow?.sentToClientAt,
      signWorkflow?.signStatus,
    ],
  );

  const handleEditBrokerLoi = async () => {
    if (brokerLoiLocked) {
      void handleCreateRevisedBrokerLoi();
      return;
    }

    if (!applicationId || !brokerLoiStatus?.brokerLoiUrl) {
      toast.error("No broker LOI to edit");
      return;
    }

    if (!brokerLoiStatus.sourceApplicationLenderId) {
      await handleCreateOwnTermSheet();
      return;
    }

    if (
      signWorkflow?.sentToClientAt ||
      signWorkflow?.signStatus === "SENT_TO_CLIENT"
    ) {
      const result = await Swal.fire({
        title: "Regenerate broker term sheet?",
        html: "This creates a new broker LOI PDF and resets the client send / signature workflow. You will need to send the updated term sheet to the client again.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Regenerate",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#7C3AED",
      });

      if (!result.isConfirmed) return;
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
      setBrokerEditorMode("regenerate");
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
      setBrokerEditorMode("regenerate");
      setPreviewMode("broker-edit");
    } catch (err: any) {
      toast.error(err.message || "Failed to prepare broker LOI editor");
    } finally {
      setPrefillLoading(false);
    }
  };

  const handleCancelBrokerEdit = () => {
    setBrokerEditorMode("create");
    setPreviewMode(
      hasExistingBrokerLoiRecord(brokerLoiStatus) ? "broker-pdf" : "lender",
    );
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
      void handleCreateOwnTermSheet();
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

  const handleCreateRevisedBrokerLoi = async () => {
    if (!applicationId || !brokerLoiStatus?.brokerLoiUrl) {
      toast.error("No broker LOI to revise");
      return;
    }

    const result = await Swal.fire({
      title: `Create Revised Broker LOI (Version ${nextBrokerRevisedVersion})?`,
      html: "Previous signed versions are preserved. The client must sign the new version before forwarding to the lender.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Create Revised LOI",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#7C3AED",
    });

    if (!result.isConfirmed) return;

    try {
      setPrefillLoading(true);
      const params = new URLSearchParams();
      if (brokerLoiStatus.sourceApplicationLenderId) {
        params.set(
          "sourceApplicationLenderId",
          brokerLoiStatus.sourceApplicationLenderId,
        );
      }
      const prefillUrl = params.toString()
        ? `${apiPath}/${applicationId}/broker-loi/prefill?${params.toString()}`
        : `${apiPath}/${applicationId}/broker-loi/prefill`;
      const res = await fetch(prefillUrl, { headers: getAuthHeaders() });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load broker LOI details");
      }
      setPrefillData({
        ...json.data,
        terms: brokerLoiStatus.terms || json.data.terms,
        standalone: !brokerLoiStatus.sourceApplicationLenderId,
      });
      setBrokerEditorMode("revised");
      setPreviewMode("broker-edit");
    } catch (err: any) {
      toast.error(err.message || "Failed to prepare revised broker LOI");
    } finally {
      setPrefillLoading(false);
    }
  };

  const handleGenerateBrokerLoi = async (
    terms: BrokerLoiTerms,
    branding: { brandName: string; logoUrl: string },
  ) => {
    if (!applicationId || !prefillData) return;
    if (brokerLoiLocked && brokerEditorMode !== "revised") {
      toast.error(
        "Broker LOI is locked after client signature. Create a revised LOI instead.",
      );
      return;
    }

    const isRevised = brokerEditorMode === "revised";
    // If a draft/version already exists, always regenerate — even if the editor
    // was opened in "create" mode (stale status / reopened form).
    const isRegenerate =
      !isRevised &&
      (brokerEditorMode === "regenerate" ||
        hasExistingBrokerLoiRecord(brokerLoiStatus));

    const buildPayload = (regenerate: boolean) =>
      JSON.stringify({
        sourceApplicationLenderId:
          prefillData.sourceApplicationLenderId || null,
        brokerTerms: terms,
        branding,
        regenerate,
        revised: isRevised,
      });

    try {
      setGeneratingBrokerLoi(true);
      let res = await fetch(
        `${apiPath}/${applicationId}/broker-loi/generate`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: buildPayload(isRegenerate || isRevised),
        },
      );
      let json = await res.json();

      // Recover from stale "create" mode when a version already exists.
      if (
        !isRevised &&
        !isRegenerate &&
        res.status === 400 &&
        json?.code === "ALREADY_GENERATED"
      ) {
        setBrokerEditorMode("regenerate");
        res = await fetch(`${apiPath}/${applicationId}/broker-loi/generate`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: buildPayload(true),
        });
        json = await res.json();
      }

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to generate broker LOI");
      }

      const didRegenerate =
        isRegenerate || Boolean(json.data?.regenerated);

      toast.success(
        isRevised
          ? `Revised broker LOI (Version ${json.data?.versionNumber || nextBrokerRevisedVersion}) created. Send to client for signature.`
          : didRegenerate
            ? "Broker LOI regenerated successfully"
            : "Broker LOI generated successfully",
      );

      const generatedUrl = json.data?.brokerLoiUrl || null;
      setBrokerLoiStatus((prev) => ({
        ...(prev || {}),
        brokerLoiUrl: generatedUrl || prev?.brokerLoiUrl || null,
        brokerLoiGeneratedAt:
          json.data?.brokerLoiGeneratedAt ||
          prev?.brokerLoiGeneratedAt ||
          new Date().toISOString(),
        sourceApplicationLenderId:
          json.data?.sourceApplicationLenderId ??
          prefillData.sourceApplicationLenderId ??
          prev?.sourceApplicationLenderId ??
          null,
        sourceLenderName:
          json.data?.sourceLenderName ||
          prev?.sourceLenderName ||
          prefillData.sourceLenderName ||
          null,
        terms,
        currentVersion: json.data?.versionId
          ? {
              id: json.data.versionId,
              versionNumber: json.data.versionNumber || 1,
              label: `Version ${json.data.versionNumber || 1}`,
              status: "DRAFT",
              brokerLoiUrl: generatedUrl,
            }
          : prev?.currentVersion || null,
        versions: json.data?.versions || prev?.versions,
        signWorkflow: json.data?.signWorkflow || prev?.signWorkflow || null,
      }));
      setPrefillData(null);
      setBrokerEditorMode("create");
      setPreviewMode("broker-pdf");
      await fetchBrokerLoiStatus({ forcePdfPreview: true });
      requestAnimationFrame(() => {
        scrollToPdfPreview();
      });
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

    const linkedLenderId =
      brokerLoiStatus?.sourceApplicationLenderId || null;
    const needsSelection = Boolean(
      brokerLoiStatus?.requiresLenderSelectionForForward ?? !linkedLenderId,
    );

    let applicationLenderId = linkedLenderId;

    if (needsSelection) {
      if (!forwardLenderId) {
        toast.error(
          "Select a funding lender before forwarding the signed term sheet",
        );
        return;
      }
      applicationLenderId = forwardLenderId;
    }

    // Always send an explicit applicationLenderId so backend can verify ownership.
    if (!applicationLenderId && linkedLenderId) {
      applicationLenderId = linkedLenderId;
    }

    if (!applicationLenderId) {
      toast.error(
        "Select a funding lender before forwarding the signed term sheet",
      );
      return;
    }

    const lenderOptions =
      brokerLoiStatus?.forwardableLenders?.length
        ? brokerLoiStatus.forwardableLenders
        : (data?.lois || [])
            .filter(
              (loi) =>
                loi.applicationLenderId &&
                !["DECLINED", "WITHDRAWN"].includes(
                  String(loi.status || "").toUpperCase(),
                ),
            )
            .map((loi) => ({
              applicationLenderId: loi.applicationLenderId,
              lenderName: loi.lenderName || "Lender",
            }));

    const lenderLabel =
      (linkedLenderId && brokerLoiStatus?.sourceLenderName) ||
      lenderOptions.find(
        (lender) => lender.applicationLenderId === applicationLenderId,
      )?.lenderName ||
      "selected lender";

    const confirm = await Swal.fire({
      title: "Forward signed term sheet?",
      html: `Send the client-signed broker term sheet to <strong>${lenderLabel}</strong> only? Other lenders on this application will not receive it.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Forward Signed LOI",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#7C3AED",
    });
    if (!confirm.isConfirmed) return;

    try {
      setSignActionLoading(true);
      const res = await fetch(
        `${apiPath}/${applicationId}/broker-loi/forward-to-lender`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ applicationLenderId }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to forward broker LOI to lender");
      }
      toast.success(
        json.message || `Signed broker LOI forwarded to ${lenderLabel}`,
      );
      setForwardLenderId("");
      await fetchBrokerLoiStatus({ forcePdfPreview: true });
      await fetchLois(page);
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

  const requiresLenderSelectionForForward = Boolean(
    signWorkflow?.canForwardToLender &&
      (brokerLoiStatus?.requiresLenderSelectionForForward ??
        !brokerLoiStatus?.sourceApplicationLenderId),
  );

  const forwardableLenders = useMemo(() => {
    if (brokerLoiStatus?.forwardableLenders?.length) {
      return brokerLoiStatus.forwardableLenders;
    }
    return sortedLois
      .filter(
        (loi) =>
          loi.applicationLenderId &&
          !["DECLINED", "WITHDRAWN"].includes(
            String(loi.status || "").toUpperCase(),
          ),
      )
      .map((loi) => ({
        applicationLenderId: loi.applicationLenderId,
        lenderName: loi.lenderName || "Lender",
      }));
  }, [brokerLoiStatus?.forwardableLenders, sortedLois]);

  useEffect(() => {
    if (!requiresLenderSelectionForForward) {
      if (forwardLenderId) setForwardLenderId("");
      return;
    }
    if (
      forwardLenderId &&
      forwardableLenders.some(
        (lender) => lender.applicationLenderId === forwardLenderId,
      )
    ) {
      return;
    }
    if (forwardableLenders.length === 1) {
      setForwardLenderId(forwardableLenders[0].applicationLenderId);
      return;
    }
    if (forwardLenderId) setForwardLenderId("");
  }, [
    requiresLenderSelectionForForward,
    forwardableLenders,
    forwardLenderId,
  ]);

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
    const canOpenEditor = brokerLoiStatus?.brokerLoiUrl
      ? canRegenerateTermSheet
      : canCreateTermSheet;
    if (
      !canOpenEditor ||
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
    brokerLoiStatus?.brokerLoiUrl,
    canCreateTermSheet,
    canRegenerateTermSheet,
    previewMode,
    selectedId,
    brokerLoiLocked,
    prefillData?.sourceApplicationLenderId,
    handleOpenBrokerLoiForm,
  ]);

  useEffect(() => {
    if (
      brokerLoiLocked &&
      previewMode === "broker-edit" &&
      brokerEditorMode !== "revised"
    ) {
      setPreviewMode("broker-pdf");
    }
  }, [brokerLoiLocked, previewMode, brokerEditorMode]);

  const previewUrl = useMemo(() => {
    const signedPdfUrl = signWorkflow?.signedPdfUrl;
    const showSignedPdf =
      previewMode === "broker-pdf" &&
      signedPdfUrl &&
      (signWorkflow?.signStatus === "CLIENT_SIGNED" ||
        signWorkflow?.signStatus === "FORWARDED_TO_LENDER" ||
        signWorkflow?.signStatus === "LENDER_SEEN");

    if (showSignedPdf) {
      return buildApiPublicFileUrl(API_BASE, signedPdfUrl);
    }
    if (previewMode === "broker-pdf" && brokerLoiStatus?.brokerLoiUrl) {
      return buildApiPublicFileUrl(API_BASE, brokerLoiStatus.brokerLoiUrl);
    }
    if (
      previewMode === "broker-pdf" &&
      brokerLoiStatus?.currentVersion?.brokerLoiUrl
    ) {
      return buildApiPublicFileUrl(
        API_BASE,
        brokerLoiStatus.currentVersion.brokerLoiUrl,
      );
    }
    if (previewMode === "lender" && selectedLoi) {
      return buildApiPublicFileUrl(API_BASE, selectedLoi.loiUrl);
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
    hasExistingBrokerLoiRecord(brokerLoiStatus) ||
    (previewMode === "broker-edit" && Boolean(prefillData));

  const hasExistingBrokerLoi = hasExistingBrokerLoiRecord(brokerLoiStatus);
  const canShowCreateTermSheet =
    canCreateTermSheet &&
    brokerLoiStatusLoaded &&
    !brokerLoiStatusLoading &&
    !hasExistingBrokerLoi &&
    !brokerLoiLocked;
  const hasStandaloneBrokerLoiOnly =
    hasExistingBrokerLoi && !sortedLois.length;

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
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
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
                {canShowCreateTermSheet && (
                  <button
                    type="button"
                    disabled={prefillLoading}
                    onClick={() => void handleCreateOwnTermSheet()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
                  >
                    {prefillLoading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    Create Term Sheet
                  </button>
                )}
              </div>
            </div>
          )}

          {canManageBrokerLoi && hasExistingBrokerLoi && (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                    Broker LOI generated
                  </p>
                  <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
                    {brokerLoiStatus?.sourceApplicationLenderId
                      ? `Based on ${brokerLoiStatus?.sourceLenderName || "selected lender"}`
                      : "Standalone broker term sheet"}
                    {brokerLoiStatus?.brokerLoiGeneratedAt &&
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
                  {brokerLoiLocked && (
                    <p className="mt-2 text-xs text-amber-800/90 dark:text-amber-200/90">
                      This LOI is locked after client signature. Create a revised
                      LOI (Version {nextBrokerRevisedVersion}) if commercial
                      terms change — the client must sign again.
                    </p>
                  )}
                  {brokerLoiStatus?.versions &&
                    brokerLoiStatus.versions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {brokerLoiStatus.versions.map((version) => (
                        <span
                          key={version.id}
                          className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                        >
                          v{version.versionNumber}
                          {version.status === "CLIENT_SIGNED" && " · Signed"}
                          {version.status === "FORWARDED_TO_LENDER" && " · Forwarded"}
                          {version.status === "SUPERSEDED" && " · Superseded"}
                        </span>
                      ))}
                    </div>
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
                  {!brokerLoiLocked && canRegenerateTermSheet ? (
                    <button
                      type="button"
                      disabled={prefillLoading}
                      onClick={() => void handleEditBrokerLoi()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs font-semibold text-purple-700 transition hover:bg-purple-50 disabled:opacity-50 dark:border-purple-500/30 dark:bg-purple-950 dark:text-purple-200"
                    >
                      {prefillLoading ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <RotateCcw size={13} />
                      )}
                      Regenerate LOI
                    </button>
                  ) : brokerLoiLocked &&
                    canCreateRevisedBrokerLoi &&
                    canRegenerateTermSheet ? (
                    <button
                      type="button"
                      disabled={prefillLoading}
                      onClick={() => void handleCreateRevisedBrokerLoi()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs font-semibold text-purple-700 transition hover:bg-purple-50 disabled:opacity-50 dark:border-purple-500/30 dark:bg-purple-950 dark:text-purple-200"
                    >
                      {prefillLoading ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <RotateCcw size={13} />
                      )}
                      Create Revised LOI (v{nextBrokerRevisedVersion})
                    </button>
                  ) : null}
                  {canSendBrokerLoiToClient && signWorkflow?.canSendToClient && (
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
                  {canForwardBrokerLoiToLender &&
                    signWorkflow?.canForwardToLender && (
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[220px]">
                      {requiresLenderSelectionForForward ? (
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                            Select Lender to Forward
                          </span>
                          <select
                            value={forwardLenderId}
                            onChange={(e) => setForwardLenderId(e.target.value)}
                            className="w-full rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-violet-500/30 dark:bg-slate-950 dark:text-slate-100"
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
                      ) : brokerLoiStatus?.sourceLenderName ? (
                        <p className="text-[11px] text-emerald-800/90 dark:text-emerald-200/90">
                          Will forward to{" "}
                          <span className="font-semibold">
                            {brokerLoiStatus.sourceLenderName}
                          </span>{" "}
                          only
                        </p>
                      ) : null}
                      <button
                        type="button"
                        disabled={
                          signActionLoading ||
                          (requiresLenderSelectionForForward && !forwardLenderId)
                        }
                        onClick={handleForwardBrokerLoiToLender}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                      >
                        {signActionLoading ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <SendHorizonal size={13} />
                        )}
                        Forward Signed LOI
                      </button>
                    </div>
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
        ) : previewMode === "broker-edit" && prefillData ? (
          <div className="min-h-[560px] p-4 md:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {brokerLoiStatus?.brokerLoiUrl
                    ? brokerEditorMode === "revised"
                      ? `Create Revised Term Sheet (v${nextBrokerRevisedVersion})`
                      : "Edit Term Sheet"
                    : "Create Term Sheet"}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {prefillData.standalone || !prefillData.sourceApplicationLenderId
                    ? "Enter your commercial terms, then generate a branded PDF"
                    : `Terms from ${prefillData.sourceLenderName} — edit below, then generate your branded PDF`}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancelBrokerEdit}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Back
              </button>
            </div>
            <BrokerLoiEditorPanel
              sourceLenderName={prefillData.sourceLenderName}
              terms={prefillData.terms}
              applicationContext={prefillData.applicationContext}
              brokerBranding={prefillData.brokerBranding}
              submitting={generatingBrokerLoi}
              readOnly={brokerLoiLocked && brokerEditorMode !== "revised"}
              standalone={
                Boolean(prefillData.standalone) ||
                !prefillData.sourceApplicationLenderId
              }
              mode={brokerEditorMode}
              revisedVersionNumber={
                brokerEditorMode === "revised"
                  ? nextBrokerRevisedVersion
                  : undefined
              }
              onCancel={handleCancelBrokerEdit}
              onSubmit={handleGenerateBrokerLoi}
            />
          </div>
        ) : previewMode === "broker-pdf" &&
          hasStandaloneBrokerLoiOnly ? (
          <div className="min-h-[560px] p-4 md:p-6" ref={pdfPreviewRef as React.RefObject<HTMLDivElement>}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Broker LOI / Term Sheet
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Standalone broker term sheet
                  {signWorkflow?.signStatusLabel
                    ? ` · ${signWorkflow.signStatusLabel}`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canRegenerateTermSheet && !brokerLoiLocked && (
                  <button
                    type="button"
                    disabled={prefillLoading}
                    onClick={() => void handleEditBrokerLoi()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-50 disabled:opacity-50 dark:border-violet-500/30 dark:text-violet-300"
                  >
                    {prefillLoading ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <RotateCcw size={13} />
                    )}
                    Edit Term Sheet
                  </button>
                )}
              </div>
            </div>
            {previewUrl ? (
              <EmbeddedFilePreview
                key={previewUrl}
                remoteUrl={previewUrl}
                mimeType="application/pdf"
                fileName={previewTitle}
                getAuthHeaders={getAuthHeaders}
              />
            ) : (
              <div className="flex items-center justify-center py-16 text-sm text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-violet-600" />
                Loading PDF...
              </div>
            )}
          </div>
        ) : previewMode === "broker-pdf" && !sortedLois.length ? (
          <div className="flex items-center justify-center py-24 text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-violet-600" />
            Loading term sheet PDF...
          </div>
        ) : hasStandaloneBrokerLoiOnly ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <Loader2 className="mb-3 h-6 w-6 animate-spin text-violet-600" />
            <p className="text-sm text-slate-500">Loading your term sheet...</p>
          </div>
        ) : !sortedLois.length &&
          (brokerLoiStatusLoading || !brokerLoiStatusLoaded) ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <Loader2 className="mb-3 h-6 w-6 animate-spin text-violet-600" />
            <p className="text-sm text-slate-500">Checking term sheet status...</p>
          </div>
        ) : !sortedLois.length ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-500/10">
              <FileText className="h-7 w-7 text-violet-600 dark:text-violet-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              {canShowCreateTermSheet
                ? "Create your Term Sheet"
                : "No LOIs Available"}
            </h3>
            <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
              {debouncedSearch
                ? "No LOIs match your search. Try a different lender name."
                : canShowCreateTermSheet
                  ? "No lender LOIs yet. You can still create your own broker term sheet for this application, or wait for lenders to issue LOIs."
                  : "No lenders have issued a Letter of Intent for this application yet. LOIs will appear here once lenders generate them."}
            </p>
            {canShowCreateTermSheet && !debouncedSearch && (
              <button
                type="button"
                disabled={prefillLoading || brokerLoiLocked}
                onClick={() => void handleCreateOwnTermSheet()}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
              >
                {prefillLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                Create Term Sheet
              </button>
            )}
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
                          {((brokerLoiStatus?.brokerLoiUrl &&
                            canRegenerateTermSheet) ||
                            (!brokerLoiStatus?.brokerLoiUrl &&
                              canCreateTermSheet)) && (
                            <button
                              type="button"
                              disabled={prefillLoading || brokerLoiLocked}
                              onClick={() =>
                                handleSwitchPreviewMode("broker-edit")
                              }
                              title={
                                brokerLoiLocked
                                  ? "Broker LOI was forwarded to the lender and cannot be regenerated"
                                  : undefined
                              }
                              className={`rounded-lg px-3 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                                previewMode === "broker-edit"
                                  ? "bg-violet-600 text-white"
                                  : "border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                              }`}
                            >
                              {brokerLoiStatus?.brokerLoiUrl
                                ? "Regenerate LOI"
                                : "Create Broker LOI"}
                            </button>
                          )}
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
                              ? "Edit Term Sheet"
                              : "Create Term Sheet"
                            : selectedLoi?.lenderName}
                      </h3>
                      <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                        {previewMode === "broker-pdf"
                          ? brokerLoiStatus?.sourceApplicationLenderId
                            ? `Based on ${brokerLoiStatus?.sourceLenderName || "selected lender LOI"}`
                            : "Standalone broker term sheet"
                          : previewMode === "broker-edit"
                            ? prefillData
                              ? prefillData.standalone ||
                                !prefillData.sourceApplicationLenderId
                                ? brokerLoiStatus?.brokerLoiUrl
                                  ? "Update your broker terms, then regenerate the branded PDF"
                                  : "Enter your commercial terms below, then generate a branded PDF"
                                : brokerLoiStatus?.brokerLoiUrl
                                  ? `Update terms from ${prefillData.sourceLenderName}, then regenerate your branded PDF`
                                  : `Terms from ${prefillData.sourceLenderName} — edit below, then generate your branded PDF`
                              : "Create your own term sheet, or select a lender LOI to copy terms"
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
                      {canCreateTermSheet &&
                        previewMode === "lender" &&
                        selectedLoi &&
                        !brokerLoiStatus?.brokerLoiUrl && (
                          <button
                            type="button"
                            disabled={prefillLoading || brokerLoiLocked}
                            onClick={() => void handleOpenBrokerLoiForm()}
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
                      {previewMode === "broker-pdf" &&
                        brokerLoiStatus?.brokerLoiUrl && (
                          <>
                            {canSendBrokerLoiToClient &&
                              signWorkflow?.canSendToClient && (
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
                            {canForwardBrokerLoiToLender &&
                              signWorkflow?.canForwardToLender && (
                              <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[200px]">
                                {requiresLenderSelectionForForward ? (
                                  <label className="block">
                                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                                      Select Lender to Forward
                                    </span>
                                    <select
                                      value={forwardLenderId}
                                      onChange={(e) =>
                                        setForwardLenderId(e.target.value)
                                      }
                                      className="w-full rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-violet-500/30 dark:bg-slate-950 dark:text-slate-100"
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
                                ) : brokerLoiStatus?.sourceLenderName ? (
                                  <p className="text-[11px] text-emerald-800/90 dark:text-emerald-200/90">
                                    Will forward to{" "}
                                    <span className="font-semibold">
                                      {brokerLoiStatus.sourceLenderName}
                                    </span>{" "}
                                    only
                                  </p>
                                ) : null}
                                <button
                                  type="button"
                                  disabled={
                                    signActionLoading ||
                                    (requiresLenderSelectionForForward &&
                                      !forwardLenderId)
                                  }
                                  onClick={handleForwardBrokerLoiToLender}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
                                >
                                  {signActionLoading ? (
                                    <Loader2 size={13} className="animate-spin" />
                                  ) : (
                                    <SendHorizonal size={13} />
                                  )}
                                  Forward Signed LOI
                                </button>
                              </div>
                            )}
                            {canRegenerateTermSheet && (
                              <button
                                type="button"
                                disabled={prefillLoading || brokerLoiLocked}
                                onClick={() => void handleEditBrokerLoi()}
                                title={
                                  brokerLoiLocked
                                    ? "Broker LOI was forwarded to the lender and cannot be regenerated"
                                    : undefined
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-500/30 dark:text-violet-300 dark:hover:bg-violet-500/10"
                              >
                                {prefillLoading ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <RotateCcw size={13} />
                                )}
                                Regenerate LOI
                              </button>
                            )}
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
                      readOnly={brokerLoiLocked && brokerEditorMode !== "revised"}
                      standalone={
                        Boolean(prefillData.standalone) ||
                        !prefillData.sourceApplicationLenderId
                      }
                      mode={brokerEditorMode}
                      revisedVersionNumber={
                        brokerEditorMode === "revised"
                          ? nextBrokerRevisedVersion
                          : undefined
                      }
                      onCancel={handleCancelBrokerEdit}
                      onSubmit={handleGenerateBrokerLoi}
                    />
                  ) : previewUrl ? (
                    <EmbeddedFilePreview
                      key={previewUrl}
                      remoteUrl={previewUrl}
                      mimeType="application/pdf"
                      fileName={previewTitle}
                      getAuthHeaders={getAuthHeaders}
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
