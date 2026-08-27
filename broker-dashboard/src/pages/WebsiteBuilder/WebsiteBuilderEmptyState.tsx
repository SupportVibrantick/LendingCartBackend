import { Link } from "react-router-dom";
import { ExternalLink, Globe, Plug, RefreshCw } from "lucide-react";

type WebsiteBuilderEmptyStateProps = {
  variant: "no-connection" | "agency-ready" | "no-websites";
  loading?: boolean;
  onRefresh?: () => void;
  dashboardUrl?: string | null;
};

export default function WebsiteBuilderEmptyState({
  variant,
  loading = false,
  onRefresh,
  dashboardUrl,
}: WebsiteBuilderEmptyStateProps) {
  if (variant === "agency-ready") {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#13538A]/10 text-[#13538A]">
          <Globe className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Manage websites in your CRM
        </h3>
        <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
          Your Pro/Elite CRM includes the website builder. Open your dashboard to
          create and publish sites — no separate Connect step needed.
        </p>
        {dashboardUrl ? (
          <a
            href={dashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#13538A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f4270]"
          >
            <ExternalLink className="h-4 w-4" />
            Open CRM website builder
          </a>
        ) : (
          <Link
            to="/settings/integrations/ghl"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#13538A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f4270]"
          >
            View CRM status
          </Link>
        )}
      </div>
    );
  }

  if (variant === "no-connection") {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
          <Plug className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          CRM not ready yet
        </h3>
        <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
          Websites come with your Pro or Elite CRM. After purchase, your dedicated
          sub-account is created automatically — you do not need to connect GHL
          manually.
        </p>
        <Link
          to="/settings/integrations/ghl"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#13538A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f4270]"
        >
          Check CRM status
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <Globe className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
        No GHL websites found
      </h3>
      <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
        Websites and funnels are created and managed in GoHighLevel. Once created,
        they will appear here.
      </p>
      {onRefresh ? (
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      ) : null}
    </div>
  );
}
