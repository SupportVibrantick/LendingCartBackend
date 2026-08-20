import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
  Plug,
  PlugZap,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import {
  disconnectGhlIntegration,
  fetchGhlConnectionStatus,
  formatGhlConnectionDate,
  formatGhlConnectionStatusLabel,
  isBrokerAdmin,
  maskGhlLocationId,
  sanitizeGhlCallbackMessage,
  startGhlOAuthConnect,
  type GhlConnectionStatus,
} from "../../../lib/ghlIntegrationApi";
import { brokerFetch } from "../../../lib/brokerApi";

function StatusBadge({ connected, status }: { connected: boolean; status?: string }) {
  const label = connected
    ? "Connected"
    : formatGhlConnectionStatusLabel(status);

  const classes = connected
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
    : status === "ERROR"
      ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {connected ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <Plug className="h-3.5 w-3.5" />
      )}
      {label}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-sm font-semibold text-slate-900 dark:text-white">{value}</dd>
    </div>
  );
}

export default function GhlIntegration() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const callbackHandled = useRef(false);

  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [status, setStatus] = useState<GhlConnectionStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const canManageConnection = isBrokerAdmin();
  const isConnected = Boolean(status?.connected);

  const loadStatus = useCallback(async () => {
    try {
      setLoadError(null);
      const next = await fetchGhlConnectionStatus();
      setStatus(next);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load GoHighLevel connection status";
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (callbackHandled.current) return;

    const ghl = searchParams.get("ghl");
    if (!ghl) return;

    callbackHandled.current = true;

    const message = searchParams.get("message");
    const code = searchParams.get("code");

    if (ghl === "connected") {
      toast.success("GoHighLevel connected successfully");
      void loadStatus();
    } else if (ghl === "error") {
      toast.error(sanitizeGhlCallbackMessage(message));
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("ghl");
    nextParams.delete("message");
    if (code) nextParams.delete("code");

    const nextSearch = nextParams.toString();
    navigate(
      {
        pathname: "/settings/integrations/ghl",
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: true },
    );
  }, [searchParams, navigate, loadStatus]);

  const handleConnect = async () => {
    if (!canManageConnection) {
      toast.error("Only broker admins can connect GoHighLevel");
      return;
    }

    try {
      setConnecting(true);
      const authorizationUrl = await startGhlOAuthConnect();
      window.location.assign(authorizationUrl);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to start GoHighLevel connection";
      toast.error(message);
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!canManageConnection) {
      toast.error("Only broker admins can disconnect GoHighLevel");
      return;
    }

    const result = await Swal.fire({
      title: "Disconnect GoHighLevel?",
      html: `
        <p style="margin:0;font-size:14px;line-height:1.5;color:#475569;">
          This removes the CRM connection for your broker organization.
          LendingCart will stop using your GoHighLevel account for broker-owned CRM features.
        </p>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      confirmButtonText: "Yes, disconnect",
      cancelButtonText: "Cancel",
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    try {
      setDisconnecting(true);
      await disconnectGhlIntegration();
      toast.success("GoHighLevel disconnected");
      await loadStatus();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to disconnect GoHighLevel";
      toast.error(message);
    } finally {
      setDisconnecting(false);
    }
  };

  const scopesLabel = useMemo(() => {
    const scopes = status?.scopes || [];
    if (!scopes.length) return "—";
    return scopes.join(", ");
  }, [status?.scopes]);

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#13538A]" />
          <p className="mt-3 text-sm text-slate-500">
            Loading GoHighLevel integration…
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title="GoHighLevel Integration"
        description="Connect your GoHighLevel CRM to LendingCart"
      />
      <PageBreadcrumb pageTitle="Integrations" />

      <div className="mx-auto max-w-4xl space-y-6">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-[#13538A] via-[#1a6cb0] to-[#2C92D5] p-6 text-white shadow-lg dark:border-slate-800 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                <Link2 className="h-3.5 w-3.5" />
                CRM Integration
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold">
                  GHL
                </div>
                <div>
                  <h1 className="text-2xl font-bold sm:text-3xl">GoHighLevel</h1>
                  <p className="mt-1 text-sm text-blue-50/90">
                    Broker-owned CRM connection
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-blue-50/90 sm:text-base">
                Connect your GoHighLevel account to sync and manage your CRM data
                from LendingCart.
              </p>
            </div>

            <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-100">
                Connection
              </p>
              <div className="mt-3">
                <StatusBadge connected={isConnected} status={status?.status} />
              </div>
            </div>
          </div>
        </div>

        {loadError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            {loadError}
          </div>
        ) : null}

        {!canManageConnection ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            View-only access — only broker admins can connect or disconnect
            GoHighLevel.
          </div>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          {!isConnected ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Connect your account
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
                  You will be redirected to GoHighLevel to choose your sub-account
                  location and approve access. LendingCart never shows your access
                  tokens in the browser.
                </p>
              </div>

              <ul className="grid gap-3 sm:grid-cols-2">
                <li className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#13538A]" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      Secure OAuth
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Authorization happens on GoHighLevel. Tokens stay on the
                      server.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                  <PlugZap className="mt-0.5 h-5 w-5 shrink-0 text-[#13538A]" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      Location-scoped
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Connect one GHL sub-account location per broker organization.
                    </p>
                  </div>
                </li>
              </ul>

              <button
                type="button"
                onClick={() => void handleConnect()}
                disabled={!canManageConnection || connecting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#13538A] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0f4270] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {connecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Redirecting…
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4" />
                    Connect GHL
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Connected account
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Your broker organization is linked to GoHighLevel.
                  </p>
                </div>
                <StatusBadge connected={isConnected} status={status?.status} />
              </div>

              <dl className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                <DetailRow
                  label="GHL Location ID"
                  value={
                    <span title={status?.ghlLocationId || undefined}>
                      {maskGhlLocationId(status?.ghlLocationId)}
                    </span>
                  }
                />
                <DetailRow
                  label="Connected"
                  value={formatGhlConnectionDate(status?.connectedAt)}
                />
                <DetailRow
                  label="Connection status"
                  value={formatGhlConnectionStatusLabel(status?.status)}
                />
                <DetailRow label="Scopes" value={scopesLabel} />
              </dl>

              {status?.lastError ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                  Last sync error: {sanitizeGhlCallbackMessage(status.lastError)}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => void handleDisconnect()}
                disabled={!canManageConnection || disconnecting}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/30 dark:bg-slate-950 dark:text-red-300 dark:hover:bg-red-500/10"
              >
                {disconnecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Disconnecting…
                  </>
                ) : (
                  <>
                    <Unplug className="h-4 w-4" />
                    Disconnect GHL
                  </>
                )}
              </button>

              <GhlFunnelsSection />
            </div>
          )}
        </section>
      </div>
    </>
  );
}

type GhlFunnel = {
  id: string;
  name: string;
  type?: string;
  domain?: string | null;
  previewUrl?: string | null;
  status?: string | null;
  pageCount?: number | null;
  updatedAt?: string | null;
};

function sanitizeFunnelError(message?: string | null): string {
  if (!message) return "Failed to load funnels from GoHighLevel.";
  const trimmed = String(message).trim();
  if (
    /GHL_|leadconnector|gohighlevel|Bearer |access_token|refresh_token|secret|enc:v1:/i.test(trimmed)
  ) {
    return "Failed to load funnels from GoHighLevel.";
  }
  return trimmed.length > 240 ? `${trimmed.slice(0, 240)}…` : trimmed;
}

function GhlFunnelsSection() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [funnels, setFunnels] = useState<GhlFunnel[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadFunnels = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const res = await brokerFetch<{ success: boolean; data: GhlFunnel[] }>(
        "/broker/integrations/ghl/funnels",
      );
      setFunnels(res.data || []);
    } catch (err: unknown) {
      setError(
        sanitizeFunnelError(err instanceof Error ? err.message : undefined),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadFunnels();
  }, [loadFunnels]);

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          GoHighLevel Funnels
        </h3>
        <button
          type="button"
          onClick={() => void loadFunnels(true)}
          disabled={refreshing || loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Loader2
            className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh Funnels
        </button>
      </div>

      {loading ? (
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40"
            >
              <div className="h-4 w-48 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="mt-2 h-3 w-32 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      ) : funnels.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
          No funnels found in your GoHighLevel account.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {funnels.map((funnel) => (
            <div
              key={funnel.id}
              className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {funnel.name}
                  </h4>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span>{funnel.type === "website" ? "Website" : "Funnel"}</span>
                    {funnel.pageCount != null ? (
                      <span>
                        {funnel.pageCount} page{funnel.pageCount === 1 ? "" : "s"}
                      </span>
                    ) : null}
                    {funnel.domain ? (
                      <span className="truncate">{funnel.domain}</span>
                    ) : null}
                    {funnel.updatedAt ? (
                      <span>
                        Updated{" "}
                        {new Date(funnel.updatedAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {funnel.status ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                      {funnel.status}
                    </span>
                  ) : null}
                  {funnel.previewUrl ? (
                    <a
                      href={funnel.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open
                    </a>
                  ) : null}
                </div>
              </div>

              <p className="mt-2 font-mono text-[10px] text-slate-400 dark:text-slate-500">
                {funnel.id}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
