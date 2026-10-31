import { useBrokerEntitlements } from "../../lib/brokerEntitlements";

export function formatBrokerPlanLabel(packageCode?: string | null): string {
  switch (String(packageCode || "").toUpperCase()) {
    case "PRO":
      return "Pro";
    case "ELITE":
      return "Elite";
    case "BASIC":
    case "STARTER":
      return "Starter";
    default:
      return packageCode ? String(packageCode) : "";
  }
}

function planBadgeClass(packageCode?: string | null) {
  const code = String(packageCode || "").toUpperCase();
  if (code === "ELITE") {
    return "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/30";
  }
  if (code === "PRO") {
    return "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-200 dark:ring-sky-400/30";
  }
  if (code === "BASIC" || code === "STARTER") {
    return "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-700/40 dark:text-slate-200 dark:ring-slate-600";
  }
  return "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-700/40 dark:text-slate-300 dark:ring-slate-600";
}

type Props = {
  packageCode?: string | null;
  className?: string;
  /** When true, loads package from org entitlements if packageCode is omitted. */
  autoLoad?: boolean;
};

export default function BrokerPlanBadge({
  packageCode,
  className = "",
  autoLoad = false,
}: Props) {
  const { entitlements } = useBrokerEntitlements();
  const resolvedCode = packageCode ?? (autoLoad ? entitlements?.packageCode : null);
  const label = formatBrokerPlanLabel(resolvedCode);

  if (!label) return null;

  return (
    <span
      title={`Current plan: ${label}`}
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 ${planBadgeClass(resolvedCode)} ${className}`}
    >
      {label}
    </span>
  );
}
