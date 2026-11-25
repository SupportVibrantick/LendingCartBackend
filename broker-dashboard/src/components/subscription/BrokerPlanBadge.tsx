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
    return "border-[#E8C56A]/60 bg-gradient-to-b from-[#FFF8E8] to-[#F8EFC8] text-[#8A6410] dark:border-amber-400/30 dark:from-amber-500/20 dark:to-amber-500/10 dark:text-amber-200";
  }
  if (code === "PRO") {
    return "border-[#4C78F5]/25 bg-[#4C78F5]/10 text-[#2F5AD0] dark:border-[#4C78F5]/35 dark:bg-[#4C78F5]/15 dark:text-sky-200";
  }
  if (code === "BASIC" || code === "STARTER") {
    return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-200";
  }
  return "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-300";
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
  const resolvedCode =
    packageCode ?? (autoLoad ? entitlements?.packageCode : null);
  const label = formatBrokerPlanLabel(resolvedCode);

  if (!label) return null;

  return (
    <span
      title={`Current plan: ${label}`}
      className={`inline-flex h-5 items-center rounded-md border px-1.5 text-[10px] font-bold tracking-[0.06em] uppercase ${planBadgeClass(resolvedCode)} ${className}`}
    >
      {label}
    </span>
  );
}
