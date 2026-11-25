import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  loading?: boolean;
  children?: ReactNode;
  className?: string;
  minHeight?: string;
  right?: ReactNode;
};

export default function DashboardWidget({
  title,
  subtitle = "This period",
  loading = false,
  children,
  className = "",
  minHeight = "320px",
  right,
}: Props) {
  return (
    <div
      className={`flex h-full flex-col rounded-2xl border border-border bg-white p-5 dark:border-slate-800 dark:bg-slate-900 ${className}`}
      style={{ minHeight }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[16px] font-semibold leading-tight text-text-primary dark:text-white">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-1 text-[13px] text-text-secondary">{subtitle}</p>
          ) : null}
        </div>
        {right}
      </div>
      {loading ? (
        <div className="flex flex-1 animate-pulse rounded-xl bg-surface dark:bg-slate-800" />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      )}
    </div>
  );
}
