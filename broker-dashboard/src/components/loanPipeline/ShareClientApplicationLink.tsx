import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Copy,
  ExternalLink,
  Link2,
  Mail,
  MessageSquare,
  RefreshCw,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const EMBED_APP_URL = (
  import.meta.env.VITE_EMBED_APP_URL || "https://loan-application-lendingcart.vibrantick.org"
).replace(/\/$/, "");

type ShareLinkData = {
  brokerOrgId: string;
  brokerName: string;
  brokerEmail: string | null;
  hasActiveApplication: boolean;
  applicationId: string | null;
  applicationName: string | null;
  shareUrl: string;
};

function getAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("broker_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function buildFallbackShareUrl(brokerOrgId: string) {
  return `${EMBED_APP_URL}/get-loan?broker=${encodeURIComponent(brokerOrgId)}`;
}

export default function ShareClientApplicationLink() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ShareLinkData | null>(null);

  const fetchShareLink = useCallback(async () => {
    try {
      setLoading(true);

      const res = await fetch(
        `${API_BASE}/broker/loan-pipeline/client-application-link`,
        { headers: getAuthHeaders() },
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load share link");
      }

      const payload = json.data;
      const shareUrl =
        payload.shareUrl?.startsWith("http") ||
        payload.shareUrl?.startsWith("//")
          ? payload.shareUrl
          : payload.brokerOrgId
            ? buildFallbackShareUrl(payload.brokerOrgId)
            : "";

      setData({
        brokerOrgId: payload.brokerOrgId,
        brokerName: payload.brokerName,
        brokerEmail: payload.brokerEmail,
        hasActiveApplication: payload.hasActiveApplication,
        applicationId: payload.applicationId,
        applicationName: payload.applicationName,
        shareUrl,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load share link",
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShareLink();
  }, [fetchShareLink]);

  const shareMessage = useMemo(() => {
    if (!data?.shareUrl) return "";
    return `Hi,\n\nPlease complete your loan application using this secure link:\n${data.shareUrl}\n\nThank you,\n${data.brokerName}`;
  }, [data]);

  const copyLink = async () => {
    if (!data?.shareUrl) return;

    try {
      await navigator.clipboard.writeText(data.shareUrl);
      toast.success("Link copied to clipboard"); 
    } catch {
      toast.error("Could not copy link");
    }
  };

  const openPreview = () => {
    if (!data?.shareUrl) return;
    window.open(data.shareUrl, "_blank", "noopener,noreferrer");
  };

  const shareEmail = () => {
    if (!data?.shareUrl) return;
    const subject = encodeURIComponent(
      `${data.brokerName} — Loan Application`,
    );
    const body = encodeURIComponent(shareMessage);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const shareSms = () => {
    if (!data?.shareUrl) return;
    const body = encodeURIComponent(shareMessage);
    window.location.href = `sms:?body=${body}`;
  };

  return (
    <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-blue-50 p-4 shadow-sm dark:border-sky-900/40 dark:from-sky-950/30 dark:to-blue-950/20 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
            <Link2 className="h-3 w-3" />
            Client Application
          </div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Share Your Loan Application Link
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-300">
            Send this link to clients so they can submit applications directly
            to your brokerage.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchShareLink}
          disabled={loading}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-xl border border-sky-200 bg-white px-3 text-xs font-medium text-sky-800 hover:bg-sky-50 disabled:opacity-60 dark:border-sky-800 dark:bg-gray-900 dark:text-sky-200"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="mt-4 h-10 animate-pulse rounded-xl bg-white/70 dark:bg-gray-900/40" />
      ) : !data ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          Unable to load your share link. Please try again.
        </p>
      ) : (
        <>
          {!data.hasActiveApplication && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
              No active loan application is configured. Activate one in
              Application Builder before sharing this link with clients.
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              readOnly
              value={data.shareUrl}
              className="h-10 min-w-0 flex-1 rounded-xl border border-sky-200 bg-white px-3 text-sm text-gray-800 outline-none dark:border-sky-800 dark:bg-gray-900 dark:text-gray-100"
            />
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#13538A] px-4 text-sm font-medium text-white hover:bg-[#1a6aad]"
            >
              <Copy className="h-4 w-4" />
              Copy
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openPreview}
              disabled={!data.hasActiveApplication}
              className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs font-medium text-sky-800 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-800 dark:bg-gray-900 dark:text-sky-200"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Preview
            </button>
            <button
              type="button"
              onClick={shareEmail}
              disabled={!data.hasActiveApplication}
              className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs font-medium text-sky-800 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-800 dark:bg-gray-900 dark:text-sky-200"
            >
              <Mail className="h-3.5 w-3.5" />
              Share via Email
            </button>
            <button
              type="button"
              onClick={shareSms}
              disabled={!data.hasActiveApplication}
              className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs font-medium text-sky-800 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-800 dark:bg-gray-900 dark:text-sky-200"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Share via SMS
            </button>
          </div>

          {data.applicationName && (
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              Active form: {data.applicationName}
              {data.brokerEmail ? ` · ${data.brokerEmail}` : ""}
            </p>
          )}
        </>
      )}
    </div>
  );
}
