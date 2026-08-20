import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { fetchGhlConnectionStatus } from "../../lib/ghlIntegrationApi";
import {
  fetchGhlWebsites,
  sanitizeGhlWebsiteError,
  type GhlWebsite,
  type GhlWebsiteCapabilities,
} from "../../lib/ghlWebsitesApi";
import WebsiteBuilderEmptyState from "./WebsiteBuilderEmptyState";
import WebsiteCard from "./WebsiteCard";

export default function WebsiteBuilder() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [websites, setWebsites] = useState<GhlWebsite[]>([]);
  const [, setCapabilities] = useState<GhlWebsiteCapabilities | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ghlLocationId, setGhlLocationId] = useState<string | null>(null);

  const ghlDashboardUrl = ghlLocationId
    ? `https://app.gohighlevel.com/v2/location/${encodeURIComponent(ghlLocationId)}/dashboard`
    : "https://app.gohighlevel.com";

  const loadWebsites = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const status = await fetchGhlConnectionStatus();
      if (!status.connected) {
        setConnected(false);
        setWebsites([]);
        setGhlLocationId(null);
        return;
      }

      setConnected(true);
      setGhlLocationId(status.ghlLocationId ?? null);
      const data = await fetchGhlWebsites({ limit: 20, offset: 0 });
      setWebsites(data.websites);
      setCapabilities(data.capabilities);
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
  }, []);

  useEffect(() => {
    void loadWebsites();
  }, [loadWebsites]);

  return (
    <>
      <PageMeta title="Website Builder | Broker Dashboard" description="Manage GHL websites" />
      <PageBreadcrumb pageTitle="Website Builder" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Website Builder</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            My Websites — powered by GoHighLevel
          </p>
        </div>

        {connected ? (
          <button
            type="button"
            onClick={() => void loadWebsites(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        ) : null}
      </div>

      {connected ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-4 dark:border-indigo-500/20 dark:bg-indigo-500/10">
          <p className="text-sm text-indigo-800 dark:text-indigo-200">
            Websites, templates, pages, and publishing are managed directly in GoHighLevel.
          </p>
          <a
            href={ghlDashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            <ExternalLink className="h-4 w-4" />
            Open GoHighLevel Dashboard
          </a>
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-[280px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : !connected ? (
        <WebsiteBuilderEmptyState variant="no-connection" />
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/30 dark:bg-red-500/10">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => void loadWebsites()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      ) : websites.length === 0 ? (
        <WebsiteBuilderEmptyState
          variant="no-websites"
          loading={refreshing}
          onRefresh={() => void loadWebsites(true)}
        />
      ) : (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
            My Websites
          </h2>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {websites.map((website) => (
              <WebsiteCard key={website.id} website={website} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
