import { ExternalLink, FileStack } from "lucide-react";
import { Link } from "react-router-dom";
import type { GhlWebsite } from "../../lib/ghlWebsitesApi";
import { formatGhlWebsiteDate } from "../../lib/ghlWebsitesApi";

type WebsiteCardProps = {
  website: GhlWebsite;
};

export default function WebsiteCard({ website }: WebsiteCardProps) {
  const pageLabel =
    website.pageCount != null
      ? `${website.pageCount} page${website.pageCount === 1 ? "" : "s"}`
      : "Pages: —";

  return (
    <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {website.name}
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            GHL {website.type === "website" ? "Website" : "Funnel"}
          </p>
        </div>
        <div className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
          {website.status || "Active"}
        </div>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500 dark:text-slate-400">Pages</dt>
          <dd className="font-medium text-slate-900 dark:text-white">{pageLabel}</dd>
        </div>
        {website.domain ? (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">Domain</dt>
            <dd className="truncate font-medium text-slate-900 dark:text-white">
              {website.domain}
            </dd>
          </div>
        ) : null}
        {website.updatedAt ? (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">Updated</dt>
            <dd className="font-medium text-slate-900 dark:text-white">
              {formatGhlWebsiteDate(website.updatedAt)}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-5 flex flex-wrap gap-2">
        {website.previewUrl ? (
          <a
            href={website.previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ExternalLink className="h-4 w-4" />
            Open Website
          </a>
        ) : null}
        <Link
          to={`/website-builder/${encodeURIComponent(website.id)}/pages`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          <FileStack className="h-4 w-4" />
          Manage Pages
        </Link>
      </div>
    </article>
  );
}
