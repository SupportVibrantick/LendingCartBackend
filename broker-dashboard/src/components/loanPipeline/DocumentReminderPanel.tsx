import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileWarning,
  Loader2,
  Mail,
  Pause,
  PenLine,
  Play,
  RefreshCw,
  Search,
  Send,
  Trash2,
} from "lucide-react";

import { getPortalAuthHeaders } from "../../lib/portalAuth";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const SEARCH_DEBOUNCE_MS = 400;
const PAGE_SIZE = 10;

function getAuthHeaders(json = false): Record<string, string> {
  return getPortalAuthHeaders(json);
}

type ReminderType =
  | "PENDING_UPLOAD"
  | "SIGNATURE_REQUIRED"
  | "LENDER_REVIEW";

type RecipientType = "CLIENT" | "LENDER";

type IntervalUnit = "MINUTES" | "HOURS" | "DAYS";

type ReminderStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "STOPPED";

type ScheduleFilter = "ALL" | "ACTIVE" | "PAUSED" | "DONE";

type MainTab = "schedule" | "schedules";

type LenderOption = {
  applicationLenderId: string;
  lenderOrgId: string;
  lenderName: string;
  lenderEmail: string | null;
};

type PendingPreviewItem = {
  id: string;
  name: string;
  status: string;
  uploadedCount?: number | null;
  maxFiles?: number | null;
  remainingSlots?: number | null;
  filledFields?: number | null;
  totalFields?: number | null;
};

type PendingPreviewBucket = {
  count: number;
  items: PendingPreviewItem[];
};

type ReminderRow = {
  id: string;
  loanApplicationId: string;
  recipientType: RecipientType;
  reminderType: ReminderType;
  applicationLenderId: string | null;
  intervalValue: number;
  intervalUnit: IntervalUnit;
  intervalLabel: string;
  status: ReminderStatus;
  customMessage: string | null;
  selectedRequirementIds?: string[] | null;
  recipientEmail?: string | null;
  recipientLabel?: string | null;
  lastSentAt: string | null;
  nextRunAt: string | null;
  pendingCount: number | null;
};

type ScheduleIndexRow = {
  id: string;
  recipientType: RecipientType;
  reminderType: ReminderType;
  applicationLenderId: string | null;
  status: ReminderStatus;
  selectedRequirementIds?: string[] | null;
};

type StatusCounts = {
  all: number;
  active: number;
  paused: number;
  done: number;
};

type ReminderPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  search?: string;
  status?: string;
  recipientType?: string;
};

type ReminderPayload = {
  applicationNumber: string;
  applicationId: string;
  clientEmail: string | null;
  lenders: LenderOption[];
  reminderTypeLabels: Record<ReminderType, string>;
  pendingPreview?: {
    PENDING_UPLOAD: PendingPreviewBucket;
    SIGNATURE_REQUIRED: PendingPreviewBucket;
  };
  statusCounts?: StatusCounts;
  scheduleIndex?: ScheduleIndexRow[];
  reminders: ReminderRow[];
};

type RecipientFilter = "ALL" | RecipientType;

const CLIENT_REMINDER_TYPES: {
  value: ReminderType;
  label: string;
  hint: string;
  Icon: typeof FileWarning;
}[] = [
  {
    value: "PENDING_UPLOAD",
    label: "Pending document uploads",
    hint: "Client has not uploaded required files yet",
    Icon: FileWarning,
  },
  {
    value: "SIGNATURE_REQUIRED",
    label: "Pending signatures",
    hint: "Sign forms sent to client but not completed",
    Icon: PenLine,
  },
];

const INTERVAL_PRESETS = [
  { label: "Every 15 minutes", value: 15, unit: "MINUTES" as IntervalUnit },
  { label: "Every hour", value: 1, unit: "HOURS" as IntervalUnit },
  { label: "Every 6 hours", value: 6, unit: "HOURS" as IntervalUnit },
  { label: "Every day", value: 1, unit: "DAYS" as IntervalUnit },
  { label: "Every 3 days", value: 3, unit: "DAYS" as IntervalUnit },
];

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getLenderName(
  lenders: LenderOption[],
  applicationLenderId: string | null,
) {
  if (!applicationLenderId) return null;
  return (
    lenders.find((l) => l.applicationLenderId === applicationLenderId)
      ?.lenderName || "Lender"
  );
}

function resolveReminderRecipientEmail(
  reminder: ReminderRow,
  payload: ReminderPayload | null,
) {
  if (reminder.recipientEmail) return reminder.recipientEmail;
  if (reminder.recipientType === "CLIENT") {
    return payload?.clientEmail || null;
  }
  if (reminder.recipientType === "LENDER" && reminder.applicationLenderId) {
    return (
      payload?.lenders?.find(
        (l) => l.applicationLenderId === reminder.applicationLenderId,
      )?.lenderEmail || null
    );
  }
  return null;
}

function resolveReminderRecipientLabel(
  reminder: ReminderRow,
  payload: ReminderPayload | null,
) {
  if (reminder.recipientLabel) return reminder.recipientLabel;
  if (reminder.recipientType === "CLIENT") return "Client";
  return (
    getLenderName(payload?.lenders || [], reminder.applicationLenderId) ||
    "Lender"
  );
}

function statusBadgeClass(status: ReminderStatus) {
  if (status === "ACTIVE")
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (status === "COMPLETED")
    return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300";
  if (status === "STOPPED")
    return "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400";
  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
}

function docRequirementStatusBadge(status: string) {
  const raw = String(status || "").toUpperCase();
  if (raw === "PARTIAL") {
    return {
      label: "Partial",
      className:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    };
  }
  if (raw === "PENDING") {
    return {
      label: "Pending",
      className:
        "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300",
    };
  }
  if (raw === "COMPLETE" || raw === "COMPLETED") {
    return {
      label: "Complete",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    };
  }
  if (raw === "SENT_TO_CLIENT") {
    return {
      label: "Awaiting signature",
      className:
        "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300",
    };
  }
  return {
    label: raw.replace(/_/g, " ") || "Status",
    className:
      "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300",
  };
}

type DocumentReminderPanelProps = {
  loanApplicationId: string | null;
  /** e.g. "/broker/loan-pipeline" or "/subbroker/loan-pipeline" */
  apiPrefix?: string;
};

export default function DocumentReminderPanel({
  loanApplicationId,
  apiPrefix = "/broker/loan-pipeline",
}: DocumentReminderPanelProps) {
  const remindersBase = `${API_BASE}${apiPrefix}`;
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [data, setData] = useState<ReminderPayload | null>(null);
  const [pagination, setPagination] = useState<ReminderPagination>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [mainTab, setMainTab] = useState<MainTab>("schedule");
  const [scheduleFilter, setScheduleFilter] = useState<ScheduleFilter>("ALL");
  const [recipientFilter, setRecipientFilter] =
    useState<RecipientFilter>("ALL");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  const [recipientType, setRecipientType] = useState<RecipientType>("CLIENT");
  const [reminderType, setReminderType] =
    useState<ReminderType>("PENDING_UPLOAD");
  const [applicationLenderId, setApplicationLenderId] = useState("");
  const [intervalValue, setIntervalValue] = useState(1);
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>("DAYS");
  const [customMessage, setCustomMessage] = useState("");
  const [selectedRequirementIds, setSelectedRequirementIds] = useState<
    string[]
  >([]);
  const selectionHydratedKeyRef = useRef<string>("");
  const hasLoadedOnceRef = useRef(false);
  const scrollYRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = search.trim();
      setDebouncedSearch((prev) => {
        if (prev !== next) setPage(1);
        return next;
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchReminders = useCallback(
    async (opts?: {
      silent?: boolean;
      page?: number;
      status?: ScheduleFilter;
      recipientType?: RecipientFilter;
      search?: string;
    }) => {
      if (!loanApplicationId) return;

      // After first load, keep the panel mounted so search/filter does not jump scroll.
      const silent =
        opts?.silent !== undefined
          ? Boolean(opts.silent)
          : hasLoadedOnceRef.current;
      const nextPage = opts?.page ?? page;
      const nextStatus = opts?.status ?? scheduleFilter;
      const nextRecipient = opts?.recipientType ?? recipientFilter;
      const nextSearch =
        opts?.search !== undefined ? opts.search : debouncedSearch;

      if (silent && typeof window !== "undefined") {
        scrollYRef.current = window.scrollY;
      }

      try {
        if (silent) setListLoading(true);
        else setLoading(true);

        const params = new URLSearchParams({
          page: String(nextPage),
          limit: String(PAGE_SIZE),
          status: nextStatus,
          recipientType: nextRecipient,
        });
        if (nextSearch) params.set("search", nextSearch);

        const res = await fetch(
          `${remindersBase}/${loanApplicationId}/document-reminders?${params}`,
          { headers: getAuthHeaders() },
        );
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.message || "Failed to load reminders");
        }

        setData(json.data);
        setPagination(
          json.pagination || {
            page: nextPage,
            limit: PAGE_SIZE,
            total: json.data?.reminders?.length || 0,
            totalPages: 1,
          },
        );

        if (json.data.lenders?.length) {
          setApplicationLenderId((current) =>
            current || json.data.lenders[0].applicationLenderId,
          );
        }

        const totalPages = Math.max(
          1,
          Number(json.pagination?.totalPages) || 1,
        );
        if (nextPage > totalPages) {
          setPage(totalPages);
        }

        hasLoadedOnceRef.current = true;
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to load reminders",
        );
        if (!silent) setData(null);
      } finally {
        if (silent) setListLoading(false);
        else setLoading(false);

        if (silent && typeof window !== "undefined") {
          const y = scrollYRef.current;
          requestAnimationFrame(() => {
            window.scrollTo({ top: y, left: 0, behavior: "auto" });
          });
        }
      }
    },
    [
      debouncedSearch,
      loanApplicationId,
      page,
      recipientFilter,
      remindersBase,
      scheduleFilter,
    ],
  );

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const applyPreset = (preset: (typeof INTERVAL_PRESETS)[number]) => {
    setIntervalValue(preset.value);
    setIntervalUnit(preset.unit);
  };

  const effectiveReminderType: ReminderType =
    recipientType === "LENDER" ? "LENDER_REVIEW" : reminderType;

  const existingMatch = useMemo(() => {
    const rows = data?.scheduleIndex || [];
    return (
      rows.find((row) => {
        if (row.recipientType !== recipientType) return false;
        if (row.reminderType !== effectiveReminderType) return false;
        if (recipientType === "LENDER") {
          return row.applicationLenderId === applicationLenderId;
        }
        return true;
      }) || null
    );
  }, [
    applicationLenderId,
    data?.scheduleIndex,
    effectiveReminderType,
    recipientType,
  ]);

  const selectedPendingPreview = useMemo(() => {
    if (recipientType !== "CLIENT" || !data?.pendingPreview) return null;
    if (reminderType === "PENDING_UPLOAD") {
      return data.pendingPreview.PENDING_UPLOAD;
    }
    if (reminderType === "SIGNATURE_REQUIRED") {
      return data.pendingPreview.SIGNATURE_REQUIRED;
    }
    return null;
  }, [data?.pendingPreview, recipientType, reminderType]);

  // Keep checkbox selection in sync when reminder type / existing schedule / preview changes.
  useEffect(() => {
    if (recipientType !== "CLIENT" || !selectedPendingPreview) {
      setSelectedRequirementIds([]);
      selectionHydratedKeyRef.current = "";
      return;
    }

    const itemIds = selectedPendingPreview.items.map((item) => item.id);
    const hydrateKey = [
      recipientType,
      reminderType,
      existingMatch?.id || "new",
      itemIds.join(","),
    ].join("|");

    if (selectionHydratedKeyRef.current === hydrateKey) return;
    selectionHydratedKeyRef.current = hydrateKey;

    const saved = existingMatch?.selectedRequirementIds;
    if (Array.isArray(saved) && saved.length > 0) {
      const kept = saved.filter((id) => itemIds.includes(id));
      setSelectedRequirementIds(kept.length > 0 ? kept : itemIds);
      return;
    }

    setSelectedRequirementIds(itemIds);
  }, [
    existingMatch?.id,
    existingMatch?.selectedRequirementIds,
    recipientType,
    reminderType,
    selectedPendingPreview,
  ]);

  const toggleRequirementSelection = (id: string) => {
    setSelectedRequirementIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectAllRequirements = () => {
    if (!selectedPendingPreview) return;
    setSelectedRequirementIds(
      selectedPendingPreview.items.map((item) => item.id),
    );
  };

  const clearRequirementSelection = () => {
    setSelectedRequirementIds([]);
  };

  const recipientEmail = useMemo(() => {
    if (recipientType === "CLIENT") return data?.clientEmail || null;
    const lender = data?.lenders?.find(
      (l) => l.applicationLenderId === applicationLenderId,
    );
    return lender?.lenderEmail || null;
  }, [applicationLenderId, data?.clientEmail, data?.lenders, recipientType]);

  const reminders = data?.reminders || [];

  const statusCounts: StatusCounts = data?.statusCounts || {
    all: 0,
    active: 0,
    paused: 0,
    done: 0,
  };

  const isSearching = search.trim() !== debouncedSearch;
  const hasListQuery =
    Boolean(debouncedSearch) ||
    scheduleFilter !== "ALL" ||
    recipientFilter !== "ALL";

  const handleSave = async () => {
    if (!loanApplicationId) return;

    if (recipientType === "LENDER" && !applicationLenderId) {
      toast.error("Select a lender for lender reminders");
      return;
    }

    if (!recipientEmail) {
      const result = await Swal.fire({
        title: "No recipient email found",
        html:
          recipientType === "CLIENT"
            ? "This application has no client email on file. Reminders cannot be delivered until a contact email is added."
            : "Selected lender has no email on file. Reminders cannot be delivered until an email is available.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Save schedule anyway",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#13538A",
      });
      if (!result.isConfirmed) return;
    }

    if (
      recipientType === "CLIENT" &&
      selectedPendingPreview &&
      selectedPendingPreview.count === 0
    ) {
      const result = await Swal.fire({
        title: "Nothing pending right now",
        html: `There are currently <strong>0</strong> items for <em>${
          CLIENT_REMINDER_TYPES.find((t) => t.value === reminderType)?.label ||
          "this reminder"
        }</em>. The schedule will stay idle until new pending items appear, then emails will start.`,
        icon: "info",
        showCancelButton: true,
        confirmButtonText: existingMatch ? "Update schedule" : "Save anyway",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#13538A",
      });
      if (!result.isConfirmed) return;
    }

    if (
      recipientType === "CLIENT" &&
      selectedPendingPreview &&
      selectedPendingPreview.count > 0 &&
      selectedRequirementIds.length === 0
    ) {
      toast.error("Select at least one document to remind about");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(
        `${remindersBase}/${loanApplicationId}/document-reminders`,
        {
          method: "POST",
          headers: getAuthHeaders(true),
          body: JSON.stringify({
            recipientType,
            reminderType: effectiveReminderType,
            applicationLenderId:
              recipientType === "LENDER" ? applicationLenderId : undefined,
            intervalValue,
            intervalUnit,
            customMessage: customMessage.trim() || undefined,
            selectedRequirementIds:
              recipientType === "CLIENT" ? selectedRequirementIds : undefined,
            status: "ACTIVE",
          }),
        },
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to save reminder");
      }

      toast.success(
        existingMatch
          ? "Reminder schedule updated"
          : "Email reminder schedule saved",
      );
      setCustomMessage("");
      setSearch("");
      setDebouncedSearch("");
      setRecipientFilter("ALL");
      setScheduleFilter("ACTIVE");
      setPage(1);
      setMainTab("schedules");
      await fetchReminders({
        silent: true,
        page: 1,
        status: "ACTIVE",
        recipientType: "ALL",
        search: "",
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save reminder",
      );
    } finally {
      setSaving(false);
    }
  };

  const updateReminderStatus = async (
    reminderId: string,
    status: "ACTIVE" | "PAUSED" | "STOPPED",
  ) => {
    try {
      setActionId(reminderId);
      const res = await fetch(
        `${remindersBase}/document-reminders/${reminderId}`,
        {
          method: "PATCH",
          headers: getAuthHeaders(true),
          body: JSON.stringify({ status }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to update reminder");
      }
      toast.success(
        status === "ACTIVE"
          ? "Reminder resumed"
          : status === "PAUSED"
            ? "Reminder paused"
            : "Reminder stopped",
      );
      await fetchReminders({ silent: true });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update reminder",
      );
    } finally {
      setActionId(null);
    }
  };

  const sendNow = async (reminder: ReminderRow) => {
    if ((reminder.pendingCount ?? 0) === 0) {
      const confirmEmpty = await Swal.fire({
        title: "Nothing pending right now",
        text: "Backend may mark this schedule complete instead of sending. Continue anyway?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Send anyway",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#13538A",
      });
      if (!confirmEmpty.isConfirmed) return;
    }

    try {
      setActionId(reminder.id);
      const res = await fetch(
        `${remindersBase}/document-reminders/${reminder.id}/send-now`,
        {
          method: "POST",
          headers: getAuthHeaders(true),
          body: JSON.stringify({}),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to send reminder");
      }

      const recipient = json.data?.recipientEmail
        ? ` → ${json.data.recipientEmail}`
        : "";
      toast.success((json.message || "Reminder sent") + recipient, {
        duration: 5000,
      });
      await fetchReminders({ silent: true });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send reminder",
      );
    } finally {
      setActionId(null);
    }
  };

  const deleteReminder = async (reminder: ReminderRow) => {
    const reminderLabel =
      data?.reminderTypeLabels?.[reminder.reminderType] || reminder.reminderType;

    const result = await Swal.fire({
      title: "Delete reminder schedule?",
      html: `This will permanently remove the <strong>${reminderLabel}</strong> email schedule for application <strong>#${data?.applicationNumber || "—"}</strong>.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
    });

    if (!result.isConfirmed) return;

    try {
      setActionId(reminder.id);
      const res = await fetch(
        `${remindersBase}/document-reminders/${reminder.id}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(true),
          body: JSON.stringify({}),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to delete reminder");
      }
      toast.success("Reminder deleted");
      await fetchReminders({ silent: true });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete reminder",
      );
    } finally {
      setActionId(null);
    }
  };

  if (!loanApplicationId) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950">
        Application not loaded.
      </div>
    );
  }

  const uploadCount = data?.pendingPreview?.PENDING_UPLOAD?.count ?? null;
  const signatureCount =
    data?.pendingPreview?.SIGNATURE_REQUIRED?.count ?? null;

  const fieldClass =
    "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/15 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";
  const labelClass =
    "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400";

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-950">
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-[#13538A]/[0.04] px-5 py-5 dark:border-slate-700 dark:from-slate-900 dark:via-slate-950 dark:to-sky-950/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-2 text-[#13538A] dark:text-sky-300">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#13538A]/10 dark:bg-sky-900/40">
                <Bell className="h-3.5 w-3.5" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">
                Communication
              </span>
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Email Reminders
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Auto-email pending documents and signatures for{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                #{data?.applicationNumber || "—"}
              </span>
              . Reminders stop when nothing is left pending.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!loading && (
              <>
                <div
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${
                    (uploadCount ?? 0) > 0
                      ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40"
                      : "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40"
                  }`}
                >
                  <FileWarning
                    className={`h-3.5 w-3.5 ${
                      (uploadCount ?? 0) > 0
                        ? "text-red-600"
                        : "text-emerald-600"
                    }`}
                  />
                  <span
                    className={`text-xs font-medium ${
                      (uploadCount ?? 0) > 0
                        ? "text-red-800 dark:text-red-200"
                        : "text-emerald-800 dark:text-emerald-200"
                    }`}
                  >
                    <strong className="text-sm tabular-nums">
                      {uploadCount ?? 0}
                    </strong>{" "}
                    uploads pending
                  </span>
                </div>
                <div
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${
                    (signatureCount ?? 0) > 0
                      ? "border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/40"
                      : "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40"
                  }`}
                >
                  <PenLine
                    className={`h-3.5 w-3.5 ${
                      (signatureCount ?? 0) > 0
                        ? "text-violet-600"
                        : "text-emerald-600"
                    }`}
                  />
                  <span
                    className={`text-xs font-medium ${
                      (signatureCount ?? 0) > 0
                        ? "text-violet-800 dark:text-violet-200"
                        : "text-emerald-800 dark:text-emerald-200"
                    }`}
                  >
                    <strong className="text-sm tabular-nums">
                      {signatureCount ?? 0}
                    </strong>{" "}
                    signatures pending
                  </span>
                </div>
              </>
            )}
            <button
              type="button"
              onClick={() => fetchReminders()}
              disabled={loading || listLoading}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading || listLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="flex border-b border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-900/40">
        <button
          type="button"
          onClick={() => setMainTab("schedule")}
          className={`flex flex-1 items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold transition ${
            mainTab === "schedule"
              ? "border-b-2 border-[#13538A] bg-white text-[#13538A] dark:bg-slate-950 dark:text-sky-300"
              : "border-b-2 border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Mail className="h-4 w-4" />
          Document Schedule
        </button>
        <button
          type="button"
          onClick={() => setMainTab("schedules")}
          className={`flex flex-1 items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold transition ${
            mainTab === "schedules"
              ? "border-b-2 border-[#13538A] bg-white text-[#13538A] dark:bg-slate-950 dark:text-sky-300"
              : "border-b-2 border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Clock className="h-4 w-4" />
          Reminder Schedules
          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold tabular-nums text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
            {statusCounts.all}
          </span>
        </button>
      </div>

      <div className="p-5 sm:p-6">
        {loading ? (
          <div className="flex items-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading reminders...
          </div>
        ) : mainTab === "schedule" ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                <label className={labelClass}>Send reminders to</label>
                <select
                  value={recipientType}
                  onChange={(e) => {
                    const value = e.target.value as RecipientType;
                    setRecipientType(value);
                    if (value === "LENDER") {
                      setReminderType("LENDER_REVIEW");
                    } else if (reminderType === "LENDER_REVIEW") {
                      setReminderType("PENDING_UPLOAD");
                    }
                  }}
                  className={fieldClass}
                >
                  <option value="CLIENT">Client</option>
                  <option value="LENDER">Lender</option>
                </select>
                <p
                  className={`mt-2 text-xs ${
                    recipientEmail
                      ? "font-medium text-emerald-700 dark:text-emerald-300"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {recipientEmail
                    ? `Will email: ${recipientEmail}`
                    : recipientType === "CLIENT"
                      ? "No client email on file yet"
                      : "Select a lender with an email"}
                </p>
              </div>

              {recipientType === "CLIENT" ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                  <label className={labelClass}>Reminder type</label>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {CLIENT_REMINDER_TYPES.map((opt) => {
                      const selected = reminderType === opt.value;
                      const count =
                        opt.value === "PENDING_UPLOAD"
                          ? uploadCount
                          : signatureCount;
                      const hasPending = (count ?? 0) > 0;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setReminderType(opt.value)}
                          className={`rounded-xl border px-3.5 py-3.5 text-left transition ${
                            selected
                              ? "border-[#13538A] bg-white shadow-sm ring-2 ring-[#13538A]/20 dark:bg-slate-950"
                              : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-600 dark:bg-slate-950 dark:hover:border-slate-500"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                              <opt.Icon
                                className={`h-3.5 w-3.5 ${selected ? "text-[#13538A]" : "text-slate-400"}`}
                              />
                              {opt.label}
                            </span>
                            <span
                              className={`inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                                hasPending
                                  ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                              }`}
                            >
                              {count ?? 0}
                            </span>
                          </div>
                          <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
                            {opt.hint}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                  <label className={labelClass}>Lender</label>
                  <select
                    value={applicationLenderId}
                    onChange={(e) => setApplicationLenderId(e.target.value)}
                    className={fieldClass}
                  >
                    {(data?.lenders || []).length === 0 ? (
                      <option value="">No lenders submitted yet</option>
                    ) : (
                      data?.lenders.map((lender) => (
                        <option
                          key={lender.applicationLenderId}
                          value={lender.applicationLenderId}
                        >
                          {lender.lenderName}
                          {lender.lenderEmail
                            ? ` (${lender.lenderEmail})`
                            : ""}
                        </option>
                      ))
                    )}
                  </select>
                  <p className="mt-2 text-xs text-slate-500">
                    Reminds lender about documents awaiting their review
                  </p>
                </div>
              )}
            </div>

            {recipientType === "CLIENT" && selectedPendingPreview && (
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/50">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Will remind about
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Choose which documents to include in reminder emails
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold tabular-nums text-slate-600 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-300">
                      {selectedRequirementIds.length}/
                      {selectedPendingPreview.count} selected
                    </span>
                    {selectedPendingPreview.count > 0 && (
                      <div className="inline-flex overflow-hidden rounded-full border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-950">
                        <button
                          type="button"
                          onClick={selectAllRequirements}
                          className="px-2.5 py-1 font-semibold text-[#13538A] hover:bg-[#13538A]/5"
                        >
                          All
                        </button>
                        <span className="w-px bg-slate-200 dark:bg-slate-600" />
                        <button
                          type="button"
                          onClick={clearRequirementSelection}
                          className="px-2.5 py-1 font-semibold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900"
                        >
                          None
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {selectedPendingPreview.count === 0 ? (
                  <div className="flex items-start gap-2 px-4 py-4 text-sm text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Nothing pending for this type right now. You can still
                      save — emails start when items become pending.
                    </span>
                  </div>
                ) : (
                  <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                    {selectedPendingPreview.items.map((item) => {
                      const checked = selectedRequirementIds.includes(item.id);
                      const statusMeta = docRequirementStatusBadge(item.status);
                      const uploadedCount =
                        typeof item.uploadedCount === "number"
                          ? item.uploadedCount
                          : null;
                      const maxFiles =
                        typeof item.maxFiles === "number" ? item.maxFiles : null;
                      const remainingSlots =
                        typeof item.remainingSlots === "number"
                          ? item.remainingSlots
                          : uploadedCount != null && maxFiles != null
                            ? Math.max(0, maxFiles - uploadedCount)
                            : null;
                      const progressPct =
                        uploadedCount != null && maxFiles
                          ? Math.min(
                              100,
                              Math.round((uploadedCount / maxFiles) * 100),
                            )
                          : null;

                      return (
                        <li key={item.id}>
                          <label
                            className={`flex cursor-pointer items-start gap-3 px-4 py-3.5 transition ${
                              checked
                                ? "bg-[#13538A]/[0.03] dark:bg-sky-950/20"
                                : "bg-white hover:bg-slate-50/80 dark:bg-slate-950 dark:hover:bg-slate-900/60"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                toggleRequirementSelection(item.id)
                              }
                              className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-[#13538A] focus:ring-[#13538A]"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-start justify-between gap-3">
                                <span className="font-semibold leading-snug text-slate-900 dark:text-white">
                                  {item.name}
                                </span>
                                <span
                                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusMeta.className}`}
                                >
                                  {statusMeta.label}
                                </span>
                              </span>

                              {reminderType === "PENDING_UPLOAD" &&
                              uploadedCount != null &&
                              maxFiles != null ? (
                                <span className="mt-2 block space-y-2">
                                  <span className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                      {uploadedCount} uploaded
                                    </span>
                                    <span
                                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                                        (remainingSlots ?? 0) > 0
                                          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
                                          : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                      }`}
                                    >
                                      <span
                                        className={`h-1.5 w-1.5 rounded-full ${
                                          (remainingSlots ?? 0) > 0
                                            ? "bg-red-500"
                                            : "bg-emerald-500"
                                        }`}
                                      />
                                      {remainingSlots ?? 0} pending
                                    </span>
                                    <span className="text-[11px] text-slate-400">
                                      of {maxFiles} max
                                    </span>
                                  </span>
                                  {progressPct != null && (
                                    <span className="block h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                      <span
                                        className={`block h-full rounded-full transition-all ${
                                          progressPct >= 100
                                            ? "bg-emerald-500"
                                            : progressPct > 0
                                              ? "bg-amber-400"
                                              : "bg-red-400"
                                        }`}
                                        style={{ width: `${progressPct}%` }}
                                      />
                                    </span>
                                  )}
                                </span>
                              ) : reminderType === "SIGNATURE_REQUIRED" &&
                                typeof item.filledFields === "number" &&
                                typeof item.totalFields === "number" ? (
                                <span className="mt-2 flex flex-wrap items-center gap-2">
                                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                                    {item.filledFields} filled
                                  </span>
                                  <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
                                    {Math.max(
                                      0,
                                      item.totalFields - item.filledFields,
                                    )}{" "}
                                    remaining
                                  </span>
                                </span>
                              ) : null}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                    {selectedPendingPreview.count >
                      selectedPendingPreview.items.length && (
                      <li className="px-4 py-2.5 text-xs text-slate-500">
                        +
                        {selectedPendingPreview.count -
                          selectedPendingPreview.items.length}{" "}
                        more (refresh to load)
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
              <label className={labelClass}>Frequency</label>
              <div className="mb-3 flex flex-wrap gap-2">
                {INTERVAL_PRESETS.map((preset) => {
                  const selected =
                    intervalValue === preset.value &&
                    intervalUnit === preset.unit;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                        selected
                          ? "border-[#13538A] bg-[#13538A] text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-300"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">
                    Interval
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={intervalValue}
                    onChange={(e) =>
                      setIntervalValue(
                        Math.max(1, Number(e.target.value) || 1),
                      )
                    }
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">
                    Unit
                  </label>
                  <select
                    value={intervalUnit}
                    onChange={(e) =>
                      setIntervalUnit(e.target.value as IntervalUnit)
                    }
                    className={fieldClass}
                  >
                    <option value="MINUTES">Minutes</option>
                    <option value="HOURS">Hours</option>
                    <option value="DAYS">Days</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
              <label className={labelClass}>Custom message (optional)</label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={3}
                placeholder="Add a personal note included in the reminder email..."
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/15 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            {existingMatch && (
              <div className="flex items-start gap-2 rounded-xl border border-[#13538A]/20 bg-[#13538A]/[0.04] px-3.5 py-2.5 text-xs text-slate-600 dark:border-sky-800 dark:bg-sky-950/30 dark:text-slate-300">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#13538A]" />
                <span>
                  A <strong>{existingMatch.status.toLowerCase()}</strong>{" "}
                  schedule already exists for this type
                  {existingMatch.status !== "ACTIVE"
                    ? " — saving will reactivate it"
                    : " — saving will update frequency / message"}
                  .
                </span>
              </div>
            )}

            <div className="flex justify-end border-t border-slate-100 pt-5 dark:border-slate-800">
              <button
                type="button"
                onClick={handleSave}
                disabled={
                  saving ||
                  (recipientType === "LENDER" && !applicationLenderId)
                }
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#13538A] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f4674] disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                {existingMatch
                  ? "Update Reminder Schedule"
                  : "Save Reminder Schedule"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-900/40">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Active schedules
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {statusCounts.all} total · {statusCounts.active} running
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      ["ALL", `All ${statusCounts.all}`],
                      ["ACTIVE", `Active ${statusCounts.active}`],
                      ["PAUSED", `Paused ${statusCounts.paused}`],
                      ["DONE", `Done ${statusCounts.done}`],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setScheduleFilter(key);
                        setPage(1);
                      }}
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                        scheduleFilter === key
                          ? "border-[#13538A] bg-[#13538A] text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_160px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search type, email, note, lender…"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm outline-none transition focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/15 dark:border-slate-600 dark:bg-slate-950"
                  />
                  {(isSearching || listLoading) && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                  )}
                </div>
                <select
                  value={recipientFilter}
                  onChange={(e) => {
                    setRecipientFilter(e.target.value as RecipientFilter);
                    setPage(1);
                  }}
                  className={fieldClass}
                >
                  <option value="ALL">All recipients</option>
                  <option value="CLIENT">Client only</option>
                  <option value="LENDER">Lender only</option>
                </select>
              </div>
            </div>

            {statusCounts.all === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center dark:border-slate-600">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  No reminder schedules yet
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Create a schedule to auto-email pending documents.
                </p>
                <button
                  type="button"
                  onClick={() => setMainTab("schedule")}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#13538A] px-3.5 py-1.5 text-xs font-semibold text-[#13538A] hover:bg-[#13538A]/[0.06]"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Create a schedule
                </button>
              </div>
            ) : reminders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center dark:border-slate-600">
                <p className="text-sm text-slate-500">
                  No schedules match
                  {debouncedSearch ? ` “${debouncedSearch}”` : ""}
                  {hasListQuery ? " with the current filters" : ""}.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setDebouncedSearch("");
                    setScheduleFilter("ALL");
                    setRecipientFilter("ALL");
                    setPage(1);
                  }}
                  className="mt-3 text-xs font-semibold text-[#13538A] hover:underline"
                >
                  Clear search & filters
                </button>
              </div>
            ) : (
              <>
                <div
                  className={`space-y-3 ${listLoading ? "opacity-60" : ""}`}
                >
                  {reminders.map((reminder) => {
                    const busy = actionId === reminder.id;
                    const toEmail = resolveReminderRecipientEmail(
                      reminder,
                      data,
                    );
                    const toLabel = resolveReminderRecipientLabel(
                      reminder,
                      data,
                    );
                    const pending = reminder.pendingCount ?? 0;

                    return (
                      <div
                        key={reminder.id}
                        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-slate-600"
                      >
                        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-stretch lg:justify-between">
                          <div className="min-w-0 flex-1 space-y-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                {reminder.recipientType}
                              </span>
                              <span
                                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusBadgeClass(reminder.status)}`}
                              >
                                {reminder.status}
                              </span>
                              <span
                                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                                  pending > 0
                                    ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                }`}
                              >
                                {pending > 0
                                  ? `${pending} pending`
                                  : "Caught up"}
                              </span>
                            </div>

                            <div>
                              <p className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
                                {data?.reminderTypeLabels?.[
                                  reminder.reminderType
                                ] || reminder.reminderType}
                              </p>
                              {reminder.recipientType === "LENDER" && (
                                <p className="mt-0.5 text-xs text-slate-500">
                                  Lender:{" "}
                                  {getLenderName(
                                    data?.lenders || [],
                                    reminder.applicationLenderId,
                                  )}
                                </p>
                              )}
                            </div>

                            <div
                              className={`inline-flex max-w-full items-center gap-2 rounded-lg border px-3 py-2 ${
                                toEmail
                                  ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-950/30"
                                  : "border-red-200 bg-red-50/80 dark:border-red-800 dark:bg-red-950/30"
                              }`}
                            >
                              <span
                                className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                                  toEmail
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                                    : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                                }`}
                              >
                                <Mail className="h-3.5 w-3.5" />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                  Sending to {toLabel}
                                </span>
                                {toEmail ? (
                                  <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
                                    {toEmail}
                                  </span>
                                ) : (
                                  <span className="block text-sm font-semibold text-red-700 dark:text-red-300">
                                    No email on file
                                  </span>
                                )}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500">
                              <span className="inline-flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
                                <Clock className="h-3.5 w-3.5 text-slate-400" />
                                {reminder.intervalLabel}
                              </span>
                              <span>
                                Last sent{" "}
                                <span className="font-medium text-slate-700 dark:text-slate-200">
                                  {formatDateTime(reminder.lastSentAt)}
                                </span>
                              </span>
                              <span>
                                Next run{" "}
                                <span className="font-medium text-slate-700 dark:text-slate-200">
                                  {formatDateTime(reminder.nextRunAt)}
                                </span>
                              </span>
                            </div>

                            {reminder.customMessage && (
                              <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                                <span className="font-semibold text-slate-500">
                                  Note:{" "}
                                </span>
                                {reminder.customMessage}
                              </p>
                            )}
                          </div>

                          <div className="flex shrink-0 flex-row flex-wrap gap-2 lg:w-36 lg:flex-col lg:justify-center">
                            {reminder.status === "ACTIVE" ||
                            reminder.status === "PAUSED" ? (
                              <button
                                type="button"
                                disabled={busy || !toEmail}
                                title={
                                  !toEmail
                                    ? "Recipient email is missing"
                                    : undefined
                                }
                                onClick={() => sendNow(reminder)}
                                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#13538A]/30 bg-[#13538A] px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#0f4674] disabled:opacity-50 dark:border-sky-700"
                              >
                                {busy ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Send className="h-3.5 w-3.5" />
                                )}
                                Send now
                              </button>
                            ) : null}

                            {reminder.status === "ACTIVE" ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  updateReminderStatus(reminder.id, "PAUSED")
                                }
                                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                              >
                                <Pause className="h-3.5 w-3.5" />
                                Pause
                              </button>
                            ) : reminder.status === "PAUSED" ||
                              reminder.status === "COMPLETED" ||
                              reminder.status === "STOPPED" ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  updateReminderStatus(reminder.id, "ACTIVE")
                                }
                                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                              >
                                <Play className="h-3.5 w-3.5" />
                                Resume
                              </button>
                            ) : null}

                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => deleteReminder(reminder)}
                              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:bg-slate-950 dark:hover:bg-red-950/30"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-500">
                    Showing{" "}
                    {pagination.total === 0
                      ? 0
                      : (pagination.page - 1) * pagination.limit + 1}
                    –
                    {Math.min(
                      pagination.page * pagination.limit,
                      pagination.total,
                    )}{" "}
                    of {pagination.total}
                    {debouncedSearch ? ` matching “${debouncedSearch}”` : ""}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={pagination.page <= 1 || listLoading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="inline-flex h-8 items-center gap-1 rounded-full border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      Prev
                    </button>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {pagination.page} / {pagination.totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={
                        pagination.page >= pagination.totalPages || listLoading
                      }
                      onClick={() =>
                        setPage((p) => Math.min(pagination.totalPages, p + 1))
                      }
                      className="inline-flex h-8 items-center gap-1 rounded-full border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200"
                    >
                      Next
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
