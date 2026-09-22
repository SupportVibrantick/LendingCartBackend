import type { ReactNode } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { STATUS_COLORS } from "../../lib/subscriptionApi";

export function SubscriptionPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 dark:bg-slate-950 dark:text-slate-100">
      {children}
    </div>
  );
}

export function SubscriptionPageHeader({
  eyebrow = "Billing",
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#18B6B4]">
          {eyebrow}
        </p>
        <h1 className="text-2xl font-bold text-[#13538A] sm:text-3xl dark:text-indigo-400">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "brand",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: ReactNode;
  tone?: "brand" | "success" | "warning" | "neutral";
}) {
  const tones = {
    brand:
      "bg-[#13538A]/10 text-[#13538A] dark:bg-indigo-500/15 dark:text-indigo-400",
    success:
      "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
    warning:
      "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
    neutral:
      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
          <p className="truncate text-2xl font-bold text-slate-900 dark:text-white">
            {value}
          </p>
          {hint ? (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status?: string | null }) {
  if (!status) {
    return <span className="text-slate-400">—</span>;
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        STATUS_COLORS[status] ||
        "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400"
      }`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
      {description ? (
        <p className="mx-auto mt-1 mb-6 max-w-md text-sm text-slate-500">{description}</p>
      ) : null}
      {action}
    </div>
  );
}

export function TableSkeleton({
  columns,
  rows = 6,
}: {
  columns: number;
  rows?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <tr key={rowIdx} className="border-t border-slate-100 dark:border-slate-800">
          {Array.from({ length: columns }).map((__, colIdx) => (
            <td key={colIdx} className="px-4 py-3.5">
              <div className="h-4 w-full max-w-[9rem] animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function PaginationBar({
  page,
  totalPages,
  total,
  noun = "items",
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  noun?: string;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-6 flex flex-col items-center justify-between gap-4 text-sm sm:flex-row">
      <p className="text-slate-500">
        Page{" "}
        <span className="font-semibold text-slate-800 dark:text-slate-100">{page}</span> of{" "}
        {totalPages}
        <span className="text-slate-400"> · {total} {noun}</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900"
        >
          <FiChevronLeft size={14} />
          Previous
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900"
        >
          Next
          <FiChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
      {children}
    </div>
  );
}

export const filterControlClass =
  "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#18B6B4]/25 dark:border-slate-700 dark:bg-slate-900";

export const primaryBtnClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#13538A] px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#13538A]/20 transition hover:bg-[#0f4470] active:scale-[0.98] disabled:opacity-60";

export const secondaryBtnClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";
