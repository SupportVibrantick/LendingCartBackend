import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  KeyRound,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Plug,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserX,
  Workflow,
} from "lucide-react";
import toast from "react-hot-toast";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import {
  fetchGhlConnectionStatus,
  formatGhlConnectionDate,
  formatGhlConnectionStatusLabel,
  formatGhlPlanLabel,
  maskGhlLocationId,
  sanitizeGhlCallbackMessage,
  syncAgencyCrmLocation,
  type GhlConnectionStatus,
} from "../../../lib/ghlIntegrationApi";

const GHL_LOGIN_URL = "https://app.gohighlevel.com";

type GhlIntegrationProps = {
  /** Broker portal can provision; loan officer portal is read-only (shared org CRM). */
  portal?: "broker" | "loanOfficer";
};

const CRM_FEATURES = [
  {
    icon: Workflow,
    title: "Pipelines & automations",
    description: "Track leads, follow-ups, and loan milestones in one place.",
  },
  {
    icon: Globe,
    title: "Website builder",
    description: "Create landing pages and funnels tied to your brokerage.",
  },
  {
    icon: Mail,
    title: "Email & SMS",
    description: "Campaigns and sequences for borrower communication.",
  },
  {
    icon: Sparkles,
    title: "Contacts & calendars",
    description: "Unified CRM for your team and loan officers.",
  },
] as const;

function StatusBadge({ connected, status }: { connected: boolean; status?: string }) {
  const label = connected
    ? "Connected"
    : formatGhlConnectionStatusLabel(status);

  const classes = connected
    ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/30"
    : status === "ERROR"
      ? "bg-red-500/20 text-red-100 ring-1 ring-red-400/30"
      : "bg-white/15 text-blue-50 ring-1 ring-white/20";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${classes}`}
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

function PlanBadge({ packageCode }: { packageCode?: string | null }) {
  const code = String(packageCode || "").toUpperCase();
  const classes =
    code === "ELITE"
      ? "bg-amber-400/20 text-amber-50 ring-amber-300/40"
      : code === "PRO"
        ? "bg-sky-400/20 text-sky-50 ring-sky-300/40"
        : "bg-white/15 text-white ring-white/20";

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ring-1 ${classes}`}
    >
      {formatGhlPlanLabel(packageCode)}
    </span>
  );
}

function DetailTile({
  label,
  value,
  mono = false,
  action,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p
          className={`text-sm font-semibold text-slate-900 dark:text-white ${
            mono ? "font-mono text-xs sm:text-sm" : ""
          }`}
        >
          {value}
        </p>
        {action}
      </div>
    </div>
  );
}

function AccessItem({
  allowed,
  title,
  description,
}: {
  allowed: boolean;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/40">
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          allowed
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
            : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
        }`}
      >
        {allowed ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>
      </div>
    </div>
  );
}

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}`);
  }
}

export default function GhlIntegration({ portal }: GhlIntegrationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const callbackHandled = useRef(false);

  const isLoanOfficerPortal = useMemo(() => {
    if (portal === "loanOfficer") return true;
    if (portal === "broker") return false;
    return location.pathname.startsWith("/loan-officer");
  }, [portal, location.pathname]);

  /** One org = one GHL account; only broker admins provision from the broker portal. */
  const canManageCrm = !isLoanOfficerPortal;
  const ghlPagePath = isLoanOfficerPortal
    ? "/loan-officer/settings/integrations/ghl"
    : "/settings/integrations/ghl";

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<GhlConnectionStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const agencyCrm = status?.agencyLocation;
  const agencyReady = Boolean(agencyCrm?.provisioned && agencyCrm?.dashboardUrl);
  const agencyPending = Boolean(agencyCrm && !agencyCrm.provisioned);
  const loginUrl = agencyCrm?.loginUrl || GHL_LOGIN_URL;
  const planLabel = formatGhlPlanLabel(agencyCrm?.packageCode);

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
          prev ? { ...prev, agencyLocation: result.agencyLocation } : prev,
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
        pathname: ghlPagePath,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: true },
    );
  }, [searchParams, navigate, loadStatus, ghlPagePath]);

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
        description="Your included GoHighLevel CRM for Loan Automation"
      />
      <PageBreadcrumb pageTitle="GoHighLevel" />

      <div className="mx-auto max-w-5xl space-y-6">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-[#0f3d66] via-[#13538A] to-[#2C92D5] p-6 text-white shadow-xl dark:border-slate-800 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-[#2C92D5]/30 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-white/20">
                  <Link2 className="h-3.5 w-3.5" />
                  Included CRM
                </span>
                {agencyCrm?.packageCode ? (
                  <PlanBadge packageCode={agencyCrm.packageCode} />
                ) : null}
              </div>

              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold ring-1 ring-white/20 backdrop-blur-sm">
                  GHL
                </div>
                <div>
                  <h1 className="text-2xl font-bold sm:text-3xl">GoHighLevel</h1>
                  <p className="mt-1 text-sm text-blue-50/90">
                    {isLoanOfficerPortal
                      ? "Shared CRM for your brokerage — one account for the whole team"
                      : "Dedicated CRM sub-account for your brokerage"}
                  </p>
                </div>
              </div>

              <p className="mt-4 max-w-xl text-sm leading-relaxed text-blue-50/90 sm:text-[15px]">
                {isLoanOfficerPortal
                  ? "Your broker organization has one GoHighLevel workspace. Broker admins and loan officers share the same CRM sub-account — login credentials are emailed when access is provisioned."
                  : "Pro and Elite plans include a fully managed GoHighLevel workspace. Loan Automation provisions your location, emails login credentials, and keeps your team in sync — no manual OAuth connect required."}
              </p>
            </div>

            <div className="relative shrink-0 rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-md lg:min-w-[200px]">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-100">
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
              {agencyReady && agencyCrm?.assignedAt ? (
                <p className="mt-3 text-xs text-blue-100/80">
                  Active since {formatGhlConnectionDate(agencyCrm.assignedAt)}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {loadError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            {loadError}
          </div>
        ) : null}

        {agencyReady ? (
          <>
            {/* CRM details */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Your CRM workspace
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm text-slate-500">
                    {isLoanOfficerPortal
                      ? `Shared with your brokerage on the ${planLabel} plan. Sign in with the credentials emailed when your CRM access was provisioned.`
                      : `Included with your ${planLabel} plan. Sign in with the credentials emailed when your account was provisioned.`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void loadStatus()}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={openAgencyCrm}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#13538A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f4270]"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open CRM
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DetailTile label="Plan" value={planLabel} />
                <DetailTile
                  label="CRM location ID"
                  mono
                  value={maskGhlLocationId(agencyCrm?.ghlLocationId)}
                  action={
                    agencyCrm?.ghlLocationId ? (
                      <button
                        type="button"
                        title="Copy location ID"
                        onClick={() =>
                          void copyText(agencyCrm.ghlLocationId!, "Location ID")
                        }
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    ) : null
                  }
                />
                <DetailTile
                  label="Provisioned"
                  value={formatGhlConnectionDate(agencyCrm?.assignedAt)}
                />
                <DetailTile
                  label="Status"
                  value={
                    <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      Active
                    </span>
                  }
                />
              </div>

              <div
                className={`mt-4 grid gap-3 ${canManageCrm ? "lg:grid-cols-2" : ""}`}
              >
                <a
                  href={loginUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 transition hover:border-[#13538A]/30 hover:bg-[#13538A]/5 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-[#13538A]/40"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#13538A]/10 text-[#13538A]">
                      <KeyRound className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        CRM login portal
                      </p>
                      <p className="text-xs text-slate-500">app.gohighlevel.com</p>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:text-[#13538A]" />
                </a>

                {canManageCrm ? (
                  <Link
                    to="/website-builder"
                    className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 transition hover:border-[#13538A]/30 hover:bg-[#13538A]/5 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-[#13538A]/40"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#13538A]/10 text-[#13538A]">
                        <Globe className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          Website builder
                        </p>
                        <p className="text-xs text-slate-500">
                          Manage sites from Loan Automation
                        </p>
                      </div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:text-[#13538A]" />
                  </Link>
                ) : null}
              </div>

              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3.5 dark:border-amber-500/20 dark:bg-amber-500/10">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
                <p className="text-sm text-amber-900 dark:text-amber-100">
                  <span className="font-semibold">Login credentials</span> were emailed
                  to broker admins and loan officers when CRM access was created. Check
                  your inbox for subject{" "}
                  <span className="font-medium">“Your GoHighLevel CRM login is ready”</span>
                  . Change your temporary password after first sign-in.
                </p>
              </div>
            </section>

            {/* Features + access */}
            <div className="grid gap-6 lg:grid-cols-5">
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 lg:col-span-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  What&apos;s included
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Everything in your dedicated GoHighLevel sub-account.
                </p>
                <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                  {CRM_FEATURES.map((feature) => {
                    const Icon = feature.icon;
                    return (
                      <li
                        key={feature.title}
                        className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/30"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#13538A]/10 text-[#13538A]">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {feature.title}
                          </p>
                          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                            {feature.description}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 lg:col-span-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Team access
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Who can sign in to your CRM.
                </p>
                <div className="mt-5 space-y-3">
                  <AccessItem
                    allowed
                    title="Broker admins"
                    description="Full CRM access for your organization."
                  />
                  <AccessItem
                    allowed
                    title="Loan officers"
                    description="Provisioned automatically with CRM credentials."
                  />
                  <AccessItem
                    allowed={false}
                    title="Co-brokers"
                    description="Referral-only — no CRM login is provided."
                  />
                </div>
              </section>
            </div>
          </>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  CRM setup
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
                  {isLoanOfficerPortal
                    ? "Your brokerage shares a single GoHighLevel CRM. After a Pro or Elite purchase, the dedicated CRM is created and login details are emailed to broker admins and loan officers."
                    : "After a Pro or Elite purchase completes, your dedicated CRM is created automatically and login details are emailed to broker admins and loan officers."}
                </p>
              </div>
              {agencyCrm?.packageCode ? (
                <PlanBadge packageCode={agencyCrm.packageCode} />
              ) : null}
            </div>

            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#13538A]" />
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    One location per brokerage
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    One shared sub-account for broker admins and all loan officers —
                    never shared with other brokerages.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40 sm:col-span-2 lg:col-span-1">
                <PlugZap className="mt-0.5 h-5 w-5 shrink-0 text-[#13538A]" />
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    No manual connect
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    You do not need to authorize GoHighLevel yourself.
                  </p>
                </div>
              </li>
            </ul>

            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              {isLoanOfficerPortal
                ? agencyPending
                  ? "Your brokerage’s Pro/Elite plan is active, but the shared CRM is not linked yet. Ask a broker admin to open GoHighLevel in the broker portal and click Set up CRM."
                  : "CRM status could not be loaded for your organization. Ask a broker admin to confirm an active Pro or Elite subscription."
                : agencyPending
                  ? "Your Pro/Elite plan is active, but the CRM sub-account is not linked yet. Click Set up CRM to provision it. If setup fails, the agency account may need a GoHighLevel plan upgrade or a free sub-account slot."
                  : "CRM status could not be loaded for this organization. Ensure you have an active Pro or Elite subscription."}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {canManageCrm ? (
                <button
                  type="button"
                  disabled={syncing}
                  onClick={() => void retryAgencySync()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#13538A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f4470] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <Loader2 className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Setting up CRM…" : "Set up CRM"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void loadStatus()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh status
              </button>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
