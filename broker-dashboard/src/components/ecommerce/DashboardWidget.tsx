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
      className={`flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] dark:border-gray-800 dark:bg-gray-900 ${className}`}
      style={{ minHeight }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[#13538A] to-[#38BDF8]" />
            <h3 className="truncate text-[15px] font-semibold leading-tight text-slate-900 dark:text-white">
              {title}
            </h3>
          </div>
          {subtitle ? (
            <p className="mt-1 pl-3 text-[12px] text-slate-400">{subtitle}</p>
          ) : null}
        </div>
        {right}
      </div>
      {loading ? (
        <div className="flex flex-1 animate-pulse rounded-xl bg-slate-50 dark:bg-gray-800" />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      )}
    </div>
  );
}
