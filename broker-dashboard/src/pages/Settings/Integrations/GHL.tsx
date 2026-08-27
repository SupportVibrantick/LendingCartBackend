import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
  Plug,
  PlugZap,
  ShieldCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import {
  fetchGhlConnectionStatus,
  formatGhlConnectionStatusLabel,
  maskGhlLocationId,
  sanitizeGhlCallbackMessage,
  syncAgencyCrmLocation,
  type GhlConnectionStatus,
} from "../../../lib/ghlIntegrationApi";

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
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<GhlConnectionStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const agencyCrm = status?.agencyLocation;
  const agencyReady = Boolean(agencyCrm?.provisioned && agencyCrm?.dashboardUrl);
  const agencyPending = Boolean(agencyCrm && !agencyCrm.provisioned);

  const openAgencyCrm = () => {
    if (!agencyCrm?.dashboardUrl) return;
    window.open(agencyCrm.dashboardUrl, "_blank", "noopener,noreferrer");
  };

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

  const retryAgencySync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    const toastId = toast.loading("Setting up your CRM…");
    try {
      const result = await syncAgencyCrmLocation();
      if (result.agencyLocation) {
        setStatus((prev) =>
          prev
            ? { ...prev, agencyLocation: result.agencyLocation }
            : prev,
        );
      }
      await loadStatus();
      toast.success(result.message || "CRM is ready", { id: toastId });
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "CRM setup is still pending. Please try again.";
      toast.error(message, { id: toastId });
      await loadStatus();
    } finally {
      setSyncing(false);
    }
  }, [loadStatus, syncing]);

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
        description="Your included GoHighLevel CRM for LendingCart"
      />
      <PageBreadcrumb pageTitle="Integrations" />

      <div className="mx-auto max-w-4xl space-y-6">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-[#13538A] via-[#1a6cb0] to-[#2C92D5] p-6 text-white shadow-lg dark:border-slate-800 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                <Link2 className="h-3.5 w-3.5" />
                Included CRM
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold">
                  GHL
                </div>
                <div>
                  <h1 className="text-2xl font-bold sm:text-3xl">GoHighLevel</h1>
                  <p className="mt-1 text-sm text-blue-50/90">
                    CRM included with Pro &amp; Elite — no Connect required
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-blue-50/90 sm:text-base">
                When you purchase Pro or Elite, LendingCart creates a dedicated CRM
                sub-account for your brokerage under the agency. Loan officers get
                access; co-brokers do not.
              </p>
            </div>

            <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-100">
                CRM status
              </p>
              <div className="mt-3">
                <StatusBadge
                  connected={agencyReady}
                  status={
                    agencyReady
                      ? "CONNECTED"
                      : agencyPending
                        ? "PENDING"
                        : "DISCONNECTED"
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {loadError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            {loadError}
          </div>
        ) : null}

        {agencyReady ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Your CRM dashboard
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">
                  Included with your {agencyCrm?.packageCode || "Pro/Elite"} plan.
                  Use the login credentials emailed when your account was created.
                </p>
                <dl className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                  <DetailRow label="Plan" value={agencyCrm?.packageCode || "—"} />
                  <DetailRow
                    label="CRM Location"
                    value={
                      <span title={agencyCrm?.ghlLocationId || undefined}>
                        {maskGhlLocationId(agencyCrm?.ghlLocationId)}
                      </span>
                    }
                  />
                </dl>
              </div>
              <button
                type="button"
                onClick={openAgencyCrm}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#13538A] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0f4270]"
              >
                <ExternalLink className="h-4 w-4" />
                Open CRM
              </button>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              CRM setup
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
              After a Pro or Elite purchase completes, your dedicated CRM is created
              automatically and login details are emailed to broker admins and loan
              officers. You do not need to connect GoHighLevel manually.
            </p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              <li className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#13538A]" />
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Agency-managed
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Your CRM lives under the Commercial Lending Mastery agency.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                <PlugZap className="mt-0.5 h-5 w-5 shrink-0 text-[#13538A]" />
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    One CRM per brokerage
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Co-brokers never receive CRM access — they are referral-only.
                  </p>
                </div>
              </li>
            </ul>
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              {agencyPending
                ? "Your Pro/Elite plan is active, but the CRM sub-account is not linked yet. Click Set up CRM to provision it. If setup fails, the agency account may need a GoHighLevel plan upgrade or a free sub-account slot."
                : "CRM status could not be loaded for this organization."}
            </div>
            <button
              type="button"
              disabled={syncing}
              onClick={() => void retryAgencySync()}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#13538A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f4470] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Loader2 className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Setting up CRM…" : "Set up CRM"}
            </button>
          </section>
        )}
      </div>
    </>
  );
}
