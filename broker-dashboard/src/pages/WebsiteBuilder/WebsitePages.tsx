import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Globe, Loader2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import WebsitePageCard from "./WebsitePageCard";
import { fetchGhlConnectionStatus } from "../../lib/ghlIntegrationApi";
import {
  fetchGhlWebsite,
  fetchGhlWebsitePages,
  formatGhlWebsiteDate,
  sanitizeGhlWebsiteError,
  type GhlWebsite,
  type GhlWebsitePage,
} from "../../lib/ghlWebsitesApi";

export default function WebsitePages() {
  const { websiteId = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [website, setWebsite] = useState<GhlWebsite | null>(null);
  const [pages, setPages] = useState<GhlWebsitePage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ghlLocationId, setGhlLocationId] = useState<string | null>(null);

  const ghlDashboardUrl = ghlLocationId
    ? `https://app.gohighlevel.com/v2/location/${encodeURIComponent(ghlLocationId)}/dashboard`
    : "https://app.gohighlevel.com";

  const loadData = useCallback(
    async (silent = false) => {
      if (!websiteId) return;

      try {
        if (silent) setRefreshing(true);
        else setLoading(true);
        setError(null);

        const [websiteData, pagesData, connStatus] = await Promise.all([
          fetchGhlWebsite(websiteId),
          fetchGhlWebsitePages(websiteId, { limit: 20, offset: 0 }),
          fetchGhlConnectionStatus(),
        ]);

        setWebsite(websiteData.website);
        setPages(pagesData.pages);
        setGhlLocationId(connStatus.ghlLocationId ?? null);
      } catch (err: unknown) {
        const message = sanitizeGhlWebsiteError(
          err instanceof Error ? err.message : undefined,
        );
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [websiteId],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <>
      <PageMeta title="Website Pages | Website Builder" description="Manage GHL website pages" />
      <PageBreadcrumb pageTitle="Website Pages" />

      <div className="mb-4">
        <Link
          to="/website-builder"
          className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to My Websites
        </Link>
      </div>

      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/30 dark:bg-red-500/10">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => void loadData()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      ) : website ? (
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-indigo-600" />
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {website.name}
                  </h1>
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  GoHighLevel website · {website.status || "Active"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadData(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>

            <dl className="mt-5 grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Status
                </dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                  {website.status || "Active"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Domain
                </dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                  {website.domain || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Last updated
                </dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                  {formatGhlWebsiteDate(website.updatedAt)}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Pages</h2>
              <a
                href={ghlDashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open GoHighLevel Dashboard
              </a>
            </div>

            {pages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No pages found for this website.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {pages.map((page) => (
                  <WebsitePageCard key={page.id} page={page} />
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
