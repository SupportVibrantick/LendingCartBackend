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
import { loAuthHeaders, LO_API_BASE } from "../../lib/loanOfficerApi";
import {
  CO_BROKER_API_BASE,
  getCoBrokerAuthHeaders,
} from "../../lib/coBrokerPortal";
import { hasPermission } from "../../lib/brokerPermissions";
import { useBrokerEntitlements } from "../../lib/brokerEntitlements";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const EMBED_APP_URL = (
  import.meta.env.VITE_EMBED_APP_URL ||
  "https://loan-application-lendingcart.vibrantick.org"
).replace(/\/$/, "");

const SHARE_APPLICATION_LINK = "SHARE_APPLICATION_LINK";

export type ShareClientApplicationPortal =
  | "broker"
  | "loanOfficer"
  | "coBroker";

type ShareLinkData = {
  brokerOrgId: string;
  brokerName: string;
  brokerEmail: string | null;
  shareUrl: string;
  ref?: string | null;
  sourcePortal?: string | null;
};

type ShareClientApplicationLinkProps = {
  portal?: ShareClientApplicationPortal;
  /** Full card (pipeline) or compact copy button (new application header). */
  variant?: "card" | "button";
};

function getBrokerAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("broker_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function buildFallbackShareUrl(brokerOrgId: string, ref?: string | null) {
  if (ref) {
    return `${EMBED_APP_URL}/get-loan?ref=${encodeURIComponent(ref)}`;
  }
  return `${EMBED_APP_URL}/get-loan?broker=${encodeURIComponent(brokerOrgId)}`;
}

function resolveShareEndpoint(portal: ShareClientApplicationPortal) {
  if (portal === "loanOfficer") {
    return `${LO_API_BASE}/loanofficer/loan-pipeline/client-application-link`;
  }
  if (portal === "coBroker") {
    return `${CO_BROKER_API_BASE.replace(/\/$/, "")}/subbroker/loan-pipeline/client-application-link`;
  }
  return `${API_BASE.replace(/\/$/, "")}/broker/loan-pipeline/client-application-link`;
}

function resolveAuthHeaders(portal: ShareClientApplicationPortal): HeadersInit {
  if (portal === "loanOfficer") return loAuthHeaders(false);
  if (portal === "coBroker") return getCoBrokerAuthHeaders("");
  return getBrokerAuthHeaders();
}

export default function ShareClientApplicationLink({
  portal = "broker",
  variant = "card",
}: ShareClientApplicationLinkProps) {
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const [data, setData] = useState<ShareLinkData | null>(null);
  const { entitlements, loading: entitlementsLoading } = useBrokerEntitlements();

  const canShare = useMemo(() => {
    if (portal === "loanOfficer") {
      return hasPermission(SHARE_APPLICATION_LINK, "loanOfficer");
    }
    if (portal === "broker") {
      if (!entitlements) return false;
      return entitlements.permissions.includes(SHARE_APPLICATION_LINK);
    }
    // Co-broker: org entitlement is enforced by the API.
    return true;
  }, [portal, entitlements]);

  const fetchShareLink = useCallback(async () => {
    try {
      setLoading(true);

      const res = await fetch(resolveShareEndpoint(portal), {
        headers: resolveAuthHeaders(portal),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load share link");
      }

      const payload = json.data;
      const shareUrl =
        payload.shareUrl?.startsWith("http") ||
        payload.shareUrl?.startsWith("//")
          ? payload.shareUrl
          : payload.ref || payload.brokerOrgId
            ? buildFallbackShareUrl(payload.brokerOrgId, payload.ref)
            : "";

      const next: ShareLinkData = {
        brokerOrgId: payload.brokerOrgId,
        brokerName: payload.brokerName,
        brokerEmail: payload.brokerEmail,
        shareUrl,
        ref: payload.ref || null,
        sourcePortal: payload.sourcePortal || null,
      };
      setData(next);
      return next;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load share link",
      );
      setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [portal]);

  useEffect(() => {
    if (!canShare) {
      setLoading(false);
      setData(null);
      return;
    }
    // Button variant loads on demand when clicked.
    if (variant === "button") {
      setLoading(false);
      return;
    }
    fetchShareLink();
  }, [canShare, fetchShareLink, variant]);

  const shareMessage = useMemo(() => {
    if (!data?.shareUrl) return "";
    return `Hi,\n\nPlease complete your loan application using this secure link:\n${data.shareUrl}\n\nThank you,\n${data.brokerName}`;
  }, [data]);

  const copyLink = async (url?: string) => {
    const shareUrl = url || data?.shareUrl;
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const handleButtonClick = async () => {
    if (copying) return;
    setCopying(true);
    try {
      let shareUrl = data?.shareUrl;
      if (!shareUrl) {
        const next = await fetchShareLink();
        shareUrl = next?.shareUrl;
      }
      if (!shareUrl) return;
      await copyLink(shareUrl);
    } finally {
      setCopying(false);
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

  if (portal === "broker" && entitlementsLoading && !entitlements) {
    return null;
  }

  if (!canShare) return null;

  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={handleButtonClick}
        disabled={copying || loading}
        title="Copy your public client loan application link"
        className="group relative inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#13538A]/20 bg-white px-3 py-1.5 text-xs font-semibold text-[#13538A] shadow-sm ring-1 ring-cyan-200/70 transition hover:-translate-y-0.5 hover:bg-cyan-50 hover:ring-cyan-300 disabled:translate-y-0 disabled:opacity-60 dark:border-cyan-500/30 dark:bg-gray-900 dark:text-cyan-300 dark:ring-cyan-500/20"
      >
        <span className="absolute -right-1 -top-1 rounded bg-gradient-to-r from-[#13538A] to-[#1a6aad] px-1 py-px text-[8px] font-bold uppercase tracking-wide text-white shadow-sm">
          Share
        </span>
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#13538A]/10 text-[#13538A] transition group-hover:bg-[#13538A]/15 dark:bg-cyan-500/15 dark:text-cyan-300">
          <Link2
            className={`h-3 w-3 ${copying || loading ? "animate-pulse" : ""}`}
          />
        </span>
        {copying || loading
          ? "Copying..."
          : "Share Your Loan Application Link"}
      </button>
    );
  }

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
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              readOnly
              value={data.shareUrl}
              className="h-10 min-w-0 flex-1 rounded-xl border border-sky-200 bg-white px-3 text-sm text-gray-800 outline-none dark:border-sky-800 dark:bg-gray-900 dark:text-gray-100"
            />
            <button
              type="button"
              onClick={() => copyLink()}
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
              className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs font-medium text-sky-800 hover:bg-sky-50 dark:border-sky-800 dark:bg-gray-900 dark:text-sky-200"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Preview
            </button>
            <button
              type="button"
              onClick={shareEmail}
              className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs font-medium text-sky-800 hover:bg-sky-50 dark:border-sky-800 dark:bg-gray-900 dark:text-sky-200"
            >
              <Mail className="h-3.5 w-3.5" />
              Share via Email
            </button>
            <button
              type="button"
              onClick={shareSms}
              className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs font-medium text-sky-800 hover:bg-sky-50 dark:border-sky-800 dark:bg-gray-900 dark:text-sky-200"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Share via SMS
            </button>
          </div>

          {data.brokerEmail && (
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              Broker contact: {data.brokerEmail}
            </p>
          )}
        </>
      )}
    </div>
  );
}
