import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import {
  Bell,
  Clock,
  Loader2,
  Mail,
  Pause,
  Play,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

type ReminderType =
  | "PENDING_UPLOAD"
  | "SIGNATURE_REQUIRED"
  | "LENDER_REVIEW";

type RecipientType = "CLIENT" | "LENDER";

type IntervalUnit = "MINUTES" | "HOURS" | "DAYS";

type ReminderStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "STOPPED";

type LenderOption = {
  applicationLenderId: string;
  lenderOrgId: string;
  lenderName: string;
  lenderEmail: string | null;
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
  lastSentAt: string | null;
  nextRunAt: string | null;
  pendingCount: number | null;
};

type ReminderPayload = {
  applicationNumber: string;
  applicationId: string;
  lenders: LenderOption[];
  reminderTypeLabels: Record<ReminderType, string>;
  reminders: ReminderRow[];
};

const CLIENT_REMINDER_TYPES: { value: ReminderType; label: string }[] = [
  { value: "PENDING_UPLOAD", label: "Pending document uploads" },
  { value: "SIGNATURE_REQUIRED", label: "Pending signatures" },
];

const INTERVAL_PRESETS = [
  { label: "Every 15 minutes", value: 15, unit: "MINUTES" as IntervalUnit },
  { label: "Every hour", value: 1, unit: "HOURS" as IntervalUnit },
  { label: "Every 6 hours", value: 6, unit: "HOURS" as IntervalUnit },
  { label: "Every day", value: 1, unit: "DAYS" as IntervalUnit },
  { label: "Every 3 days", value: 3, unit: "DAYS" as IntervalUnit },
];

function getAuthHeaders(json = false): Record<string, string> {
  const token = sessionStorage.getItem("broker_token");
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

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

type DocumentReminderPanelProps = {
  loanApplicationId: string | null;
};

export default function DocumentReminderPanel({
  loanApplicationId,
}: DocumentReminderPanelProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<ReminderPayload | null>(null);

  const [recipientType, setRecipientType] = useState<RecipientType>("CLIENT");
  const [reminderType, setReminderType] =
    useState<ReminderType>("PENDING_UPLOAD");
  const [applicationLenderId, setApplicationLenderId] = useState("");
  const [intervalValue, setIntervalValue] = useState(1);
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>("DAYS");
  const [customMessage, setCustomMessage] = useState("");

  const fetchReminders = useCallback(async () => {
    if (!loanApplicationId) return;

    try {
      setLoading(true);
      const res = await fetch(
        `${API_BASE}/broker/loan-pipeline/${loanApplicationId}/document-reminders`,
        { headers: getAuthHeaders() },
      );
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load reminders");
      }

      setData(json.data);

      if (json.data.lenders?.length) {
        setApplicationLenderId((current) =>
          current || json.data.lenders[0].applicationLenderId,
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load reminders",
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [loanApplicationId]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const applyPreset = (preset: (typeof INTERVAL_PRESETS)[number]) => {
    setIntervalValue(preset.value);
    setIntervalUnit(preset.unit);
  };

  const handleSave = async () => {
    if (!loanApplicationId) return;

    if (recipientType === "LENDER" && !applicationLenderId) {
      toast.error("Select a lender for lender reminders");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(
        `${API_BASE}/broker/loan-pipeline/${loanApplicationId}/document-reminders`,
        {
          method: "POST",
          headers: getAuthHeaders(true),
          body: JSON.stringify({
            recipientType,
            reminderType:
              recipientType === "LENDER" ? "LENDER_REVIEW" : reminderType,
            applicationLenderId:
              recipientType === "LENDER" ? applicationLenderId : undefined,
            intervalValue,
            intervalUnit,
            customMessage: customMessage.trim() || undefined,
            status: "ACTIVE",
          }),
        },
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to save reminder");
      }

      toast.success("Email reminder schedule saved");
      await fetchReminders();
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
      const res = await fetch(
        `${API_BASE}/broker/loan-pipeline/document-reminders/${reminderId}`,
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
      toast.success("Reminder updated");
      await fetchReminders();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update reminder",
      );
    }
  };

  const sendNow = async (reminderId: string) => {
    try {
      const res = await fetch(
        `${API_BASE}/broker/loan-pipeline/document-reminders/${reminderId}/send-now`,
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
      toast.success(json.message || "Reminder sent");
      await fetchReminders();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send reminder",
      );
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
      const res = await fetch(
        `${API_BASE}/broker/loan-pipeline/document-reminders/${reminder.id}`,
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
      await fetchReminders();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete reminder",
      );
    }
  };

  const activeReminders = useMemo(
    () => data?.reminders?.filter((r) => r.status === "ACTIVE") || [],
    [data],
  );

  if (!loanApplicationId) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950">
        Application not loaded.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-blue-50 p-5 shadow-sm dark:border-sky-900/40 dark:from-sky-950/30 dark:to-blue-950/20">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
              <Bell className="h-3 w-3" />
              Email Reminders
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Document & Signature Reminders
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-300">
              Automatically email clients or lenders about pending documents for
              application{" "}
              <strong>#{data?.applicationNumber || "—"}</strong>. Reminders
              include the pending document list and portal link, and stop when
              all items are complete.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchReminders}
            disabled={loading}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-xl border border-sky-200 bg-white px-3 text-xs font-medium text-sky-800 hover:bg-sky-50 disabled:opacity-60 dark:border-sky-800 dark:bg-gray-900 dark:text-sky-200"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading reminders...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Send reminders to
                </label>
                <select
                  value={recipientType}
                  onChange={(e) => {
                    const value = e.target.value as RecipientType;
                    setRecipientType(value);
                    if (value === "LENDER") {
                      setReminderType("LENDER_REVIEW");
                    }
                  }}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="CLIENT">Client</option>
                  <option value="LENDER">Lender</option>
                </select>
              </div>

              {recipientType === "CLIENT" ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Reminder type
                  </label>
                  <select
                    value={reminderType}
                    onChange={(e) =>
                      setReminderType(e.target.value as ReminderType)
                    }
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                  >
                    {CLIENT_REMINDER_TYPES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Lender
                  </label>
                  <select
                    value={applicationLenderId}
                    onChange={(e) => setApplicationLenderId(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
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
                          {lender.lenderEmail ? ` (${lender.lenderEmail})` : ""}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Frequency
              </label>
              <div className="mb-3 flex flex-wrap gap-2">
                {INTERVAL_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                      intervalValue === preset.value &&
                      intervalUnit === preset.unit
                        ? "border-sky-500 bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  min={1}
                  value={intervalValue}
                  onChange={(e) =>
                    setIntervalValue(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                />
                <select
                  value={intervalUnit}
                  onChange={(e) =>
                    setIntervalUnit(e.target.value as IntervalUnit)
                  }
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="MINUTES">Minutes</option>
                  <option value="HOURS">Hours</option>
                  <option value="DAYS">Days</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Custom message (optional)
              </label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={3}
                placeholder="Add a personal note included in the reminder email..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || (recipientType === "LENDER" && !applicationLenderId)}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-[#13538A] px-4 text-sm font-medium text-white hover:bg-[#1a6aad] disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              Save Reminder Schedule
            </button>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Active Schedules ({activeReminders.length})
          </h3>
        </div>

        {!data?.reminders?.length ? (
          <p className="text-sm text-slate-500">
            No reminder schedules yet. Create one above to start sending
            automated emails.
          </p>
        ) : (
          <div className="space-y-3">
            {data.reminders.map((reminder) => (
              <div
                key={reminder.id}
                className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {reminder.recipientType}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          reminder.status === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-700"
                            : reminder.status === "COMPLETED"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {reminder.status}
                      </span>
                    </div>

                    <p className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
                      {data.reminderTypeLabels?.[reminder.reminderType] ||
                        reminder.reminderType}
                      {reminder.recipientType === "LENDER" &&
                        ` — ${getLenderName(data.lenders, reminder.applicationLenderId)}`}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {reminder.intervalLabel}
                      </span>
                      <span>
                        Pending now: {reminder.pendingCount ?? 0}
                      </span>
                      <span>Last sent: {formatDateTime(reminder.lastSentAt)}</span>
                      <span>Next run: {formatDateTime(reminder.nextRunAt)}</span>
                    </div>

                    {reminder.customMessage && (
                      <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                        Note: {reminder.customMessage}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => sendNow(reminder.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Send now
                    </button>

                    {reminder.status === "ACTIVE" ? (
                      <button
                        type="button"
                        onClick={() => updateReminderStatus(reminder.id, "PAUSED")}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50"
                      >
                        <Pause className="h-3.5 w-3.5" />
                        Pause
                      </button>
                    ) : reminder.status === "PAUSED" ? (
                      <button
                        type="button"
                        onClick={() => updateReminderStatus(reminder.id, "ACTIVE")}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                      >
                        <Play className="h-3.5 w-3.5" />
                        Resume
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => deleteReminder(reminder)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
