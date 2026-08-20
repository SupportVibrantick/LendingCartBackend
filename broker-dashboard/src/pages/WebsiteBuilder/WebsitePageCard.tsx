import { ExternalLink, Eye } from "lucide-react";
import type { GhlWebsitePage } from "../../lib/ghlWebsitesApi";
import { formatGhlWebsiteDate } from "../../lib/ghlWebsitesApi";

type WebsitePageCardProps = {
  page: GhlWebsitePage;
};

export default function WebsitePageCard({ page }: WebsitePageCardProps) {
  const canPreview = Boolean(page.previewUrl);
  const canEditInGhl = Boolean(page.editorUrl);

  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-slate-900 dark:text-white">{page.name}</h4>
          {page.updatedAt ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Updated {formatGhlWebsiteDate(page.updatedAt)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {canPreview ? (
          <a
            href={page.previewUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </a>
        ) : null}

        {canEditInGhl ? (
          <a
            href={page.editorUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Edit in GHL
          </a>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Editing this page is managed in GoHighLevel.
          </p>
        )}
      </div>
    </article>
  );
}
