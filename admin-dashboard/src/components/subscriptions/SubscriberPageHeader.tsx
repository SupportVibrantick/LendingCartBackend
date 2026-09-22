import type { ReactNode } from "react";
import { FiMail, FiPhone } from "react-icons/fi";
import { StatusBadge } from "./SubscriptionUi";

type Org = {
  name: string;
  email?: string | null;
  phone?: string | null;
};

type Props = {
  organization: Org;
  packageCode?: string;
  subscriptionStatus?: string | null;
  eyebrow?: string;
  actions?: ReactNode;
};

function tierBar(code?: string) {
  const c = String(code || "").toUpperCase();
  if (c === "ELITE") return "from-[#0B3A63] via-[#13538A] to-[#18B6B4]";
  if (c === "PRO") return "from-[#13538A] to-[#18B6B4]";
  return "from-[#13538A] to-[#0B3A63]";
}

export default function SubscriberPageHeader({
  organization,
  packageCode,
  subscriptionStatus,
  eyebrow = "Subscriber",
  actions,
}: Props) {
  return (
    <div className="relative mb-6 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_10px_40px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <div
        className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${tierBar(packageCode)}`}
        aria-hidden
      />
      <div className="pointer-events-none absolute -top-20 right-0 h-56 w-56 rounded-full bg-[#18B6B4]/10 blur-3xl dark:bg-indigo-500/10" />

      <div className="relative flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#18B6B4]">
            {eyebrow}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-[#13538A] sm:text-3xl dark:text-indigo-300">
            {organization.name}
          </h1>
          <div className="mt-3 flex flex-wrap gap-2">
            {organization.email ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <FiMail size={12} />
                {organization.email}
              </span>
            ) : null}
            {organization.phone ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <FiPhone size={12} />
                {organization.phone}
              </span>
            ) : null}
            {subscriptionStatus ? (
              <StatusBadge status={subscriptionStatus} />
            ) : (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                No plan
              </span>
            )}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
