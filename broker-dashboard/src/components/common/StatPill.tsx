import type { ReactNode } from "react";

export type StatPillColor = "blue" | "emerald" | "amber" | "rose" | "slate";

const ICON_TONE: Record<StatPillColor, string> = {
  blue: "bg-[#4C78F5]/10 text-[#4C78F5]",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

type StatPillProps = {
  icon: ReactNode;
  label: string;
  value: number | string | null | undefined;
  color?: StatPillColor;
  active?: boolean;
  loading?: boolean;
  onClick?: () => void;
};

export default function StatPill({
  icon,
  label,
  value,
  color = "blue",
  active = false,
  loading = false,
  onClick,
}: StatPillProps) {
  const display =
    loading || value === null || value === undefined ? "—" : value;

  const className = [
    "rounded-xl border bg-white px-3.5 py-2.5 text-left transition dark:bg-slate-900",
    active
      ? "border-[#4C78F5]/45 ring-2 ring-[#4C78F5]/20"
      : "border-border dark:border-slate-700",
    onClick
      ? "cursor-pointer hover:border-[#4C78F5]/35 hover:bg-[#4C78F5]/[0.03]"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const body = (
    <div className="flex items-center gap-2.5">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${ICON_TONE[color]}`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
          {label}
        </p>
        <p className="mt-0.5 text-lg font-bold tabular-nums leading-none text-text-primary dark:text-white">
          {display}
        </p>
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {body}
      </button>
    );
  }

  return <div className={className}>{body}</div>;
}
