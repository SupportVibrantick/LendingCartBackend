import { useEffect, useMemo, useState } from "react";
import {
  FiBriefcase,
  FiFileText,
  FiGlobe,
  FiSave,
  FiUsers,
  FiX,
} from "react-icons/fi";
import type {
  OrgUsageLimitsPayload,
  OrgUsageMetricRow,
  UsageLimits,
  UsageMetric,
} from "../../lib/subscriptionApi";
import { ADMIN_USAGE_LIMIT_METRICS } from "../../lib/subscriptionApi";
import { primaryBtnClass, secondaryBtnClass } from "./SubscriptionUi";

type Props = {
  data: OrgUsageLimitsPayload | null | undefined;
  disabled?: boolean;
  saving?: boolean;
  onSave: (limits: UsageLimits) => void | Promise<void>;
  onReset: () => void | Promise<void>;
};

const METRIC_META: Record<
  UsageMetric,
  { icon: typeof FiUsers; hint: string; accent: string }
> = {
  LOAN_OFFICERS: {
    icon: FiBriefcase,
    hint: "Max loan officers this broker can invite",
    accent: "from-[#13538A]/12 to-[#18B6B4]/10 text-[#13538A]",
  },
  CO_BROKERS: {
    icon: FiUsers,
    hint: "Max co-brokers / sub-brokers allowed",
    accent: "from-teal-500/15 to-emerald-500/10 text-teal-700",
  },
  LENDER_CONNECTIONS: {
    icon: FiGlobe,
    hint: "Max lenders in their network / marketplace connections",
    accent: "from-sky-500/15 to-blue-500/10 text-sky-700",
  },
  LOAN_APPLICATIONS: {
    icon: FiFileText,
    hint: "Max loan applications in the current billing period",
    accent: "from-indigo-500/15 to-violet-500/10 text-indigo-700",
  },
  ACTIVE_USERS: {
    icon: FiUsers,
    hint: "Active user seats",
    accent: "from-slate-500/15 to-slate-400/10 text-slate-700",
  },
};

function toDraft(metrics: OrgUsageMetricRow[]): Record<string, string> {
  const draft: Record<string, string> = {};
  for (const m of metrics) {
    draft[m.metric] =
      m.limitValue != null && Number.isFinite(m.limitValue) ? String(m.limitValue) : "";
  }
  return draft;
}

export default function OrgUsageLimitsPanel({
  data,
  disabled = false,
  saving = false,
  onSave,
  onReset,
}: Props) {
  const metrics = useMemo(() => {
    const rows = data?.metrics || [];
    const byMetric = new Map(rows.map((r) => [r.metric, r]));
    return ADMIN_USAGE_LIMIT_METRICS.map((metric) => {
      const existing = byMetric.get(metric);
      if (existing) return existing;
      return {
        metric,
        label:
          metric === "LENDER_CONNECTIONS"
            ? "Lenders Network"
            : metric === "CO_BROKERS"
              ? "Co-Brokers"
              : metric === "LOAN_OFFICERS"
                ? "Loan Officers"
                : "Loan Applications",
        usedValue: 0,
        limitValue: null,
        packageDefault: null,
        isCustom: false,
      } satisfies OrgUsageMetricRow;
    });
  }, [data]);

  const [draft, setDraft] = useState<Record<string, string>>(() => toDraft(metrics));

  useEffect(() => {
    setDraft(toDraft(metrics));
  }, [metrics]);

  const dirty = useMemo(() => {
    return metrics.some((m) => {
      const current =
        m.limitValue != null && Number.isFinite(m.limitValue) ? String(m.limitValue) : "";
      return (draft[m.metric] ?? "") !== current;
    });
  }, [draft, metrics]);

  const hasCustom = metrics.some((m) => m.isCustom);

  const handleSave = () => {
    const limits: UsageLimits = {};
    for (const metric of ADMIN_USAGE_LIMIT_METRICS) {
      const raw = (draft[metric] ?? "").trim();
      if (raw === "") continue;
      const n = Number(raw);
      if (Number.isFinite(n) && Number.isInteger(n) && n >= 0) {
        limits[metric] = n;
      }
    }
    onSave(limits);
  };

  return (
    <div className="mb-6 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#18B6B4]">
            Plan limits
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
            Usage & capacity
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Set loan officer, co-broker, lenders network, and application caps for this
            subscriber.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasCustom ? (
            <button
              type="button"
              disabled={disabled || saving}
              onClick={() => onReset()}
              className={secondaryBtnClass}
            >
              Reset to package
            </button>
          ) : null}
          <button
            type="button"
            disabled={disabled || saving || !dirty}
            onClick={handleSave}
            className={primaryBtnClass}
          >
            <FiSave size={15} />
            {saving ? "Saving..." : "Save limits"}
          </button>
          {dirty ? (
            <button
              type="button"
              disabled={disabled || saving}
              onClick={() => setDraft(toDraft(metrics))}
              className={secondaryBtnClass}
            >
              <FiX size={14} />
              Discard
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5">
        {metrics.map((row) => {
          const meta = METRIC_META[row.metric];
          const Icon = meta.icon;
          const limitNum = Number(draft[row.metric]);
          const hasLimit = draft[row.metric]?.trim() !== "" && Number.isFinite(limitNum);
          const pct =
            hasLimit && limitNum > 0
              ? Math.min(100, Math.round((row.usedValue / limitNum) * 100))
              : 0;

          return (
            <div
              key={row.metric}
              className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50/80 to-white p-4 dark:border-slate-800 dark:from-slate-800/40 dark:to-slate-900"
            >
              <div className="mb-3 flex items-start gap-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${meta.accent}`}
                >
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {row.label}
                    </p>
                    {row.isCustom ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                        Custom
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        Package
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{meta.hint}</p>
                </div>
              </div>

              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    In use
                  </p>
                  <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">
                    {row.usedValue}
                    <span className="text-sm font-medium text-slate-400">
                      {hasLimit ? ` / ${limitNum}` : " · unlimited"}
                    </span>
                  </p>
                </div>
                <div className="w-28">
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    Limit
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    disabled={disabled || saving}
                    value={draft[row.metric] ?? ""}
                    placeholder={
                      row.packageDefault != null ? String(row.packageDefault) : "∞"
                    }
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, [row.metric]: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold tabular-nums outline-none transition focus:border-[#18B6B4]/50 focus:ring-4 focus:ring-[#18B6B4]/15 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all ${
                    pct >= 90
                      ? "bg-rose-500"
                      : pct >= 70
                        ? "bg-amber-500"
                        : "bg-gradient-to-r from-[#13538A] to-[#18B6B4]"
                  }`}
                  style={{ width: hasLimit ? `${pct}%` : "0%" }}
                />
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                Package default:{" "}
                {row.packageDefault != null ? row.packageDefault : "Unlimited"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
