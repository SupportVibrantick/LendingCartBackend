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
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
    : status === "ERROR"
      ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
      : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}
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
      ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
      : code === "PRO"
        ? "border-[#4C78F5]/25 bg-[#4C78F5]/8 text-[#3B66E0] dark:border-[#4C78F5]/40 dark:bg-[#4C78F5]/15 dark:text-sky-300"
        : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${classes}`}
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
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-none dark:border-slate-700 dark:bg-slate-950">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <p
          className={`text-sm font-semibold text-slate-900 dark:text-white ${
            mono ? "font-mono" : ""
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
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-3.5 dark:border-slate-700">
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          allowed
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
        }`}
      >
        {allowed ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-slate-500">{description}</p>
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
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#4C78F5]" />
          <p className="mt-3 text-sm text-slate-500">
            Loading GoHighLevel integration…
          </p>
        </div>
      </div>
    );
  }

  const crmStatusValue = agencyReady
    ? "CONNECTED"
    : agencyPending
      ? "PENDING"
      : "DISCONNECTED";

  return (
    <>
      <PageMeta
        title="GoHighLevel Integration"
        description="Your included GoHighLevel CRM for Loan Automation"
      />
      <PageBreadcrumb pageTitle="GoHighLevel" />

      <div className="w-full space-y-4">
        {/* Hero */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-none dark:border-slate-800 dark:bg-slate-950 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#4C78F5]/25 bg-[#4C78F5]/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#4C78F5]">
                  <Link2 className="h-3.5 w-3.5" />
                  Included CRM
                </span>
                {agencyCrm?.packageCode ? (
                  <PlanBadge packageCode={agencyCrm.packageCode} />
                ) : null}
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#4C78F5]/10 text-sm font-bold text-[#4C78F5]">
                  GHL
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white sm:text-xl">
                    GoHighLevel
                  </h1>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {isLoanOfficerPortal
                      ? "Shared CRM for your brokerage — one account for the whole team"
                      : "Dedicated CRM sub-account for your brokerage"}
                  </p>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">
                    {isLoanOfficerPortal
                      ? "Your broker organization has one GoHighLevel workspace. Broker admins and loan officers share the same CRM sub-account — login credentials are emailed when access is provisioned."
                      : "Pro/Elite plans and GoHighLevel Starter/Growth add-ons include a managed GoHighLevel workspace. Loan Automation provisions your location, emails login credentials, and keeps your team in sync — no manual OAuth required."}
                  </p>
                </div>
              </div>
            </div>

            <div className="shrink-0 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-700 dark:bg-slate-900/40 lg:min-w-[180px]">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                CRM status
              </p>
              <div className="mt-2">
                <StatusBadge
                  connected={agencyReady}
                  status={crmStatusValue}
                />
              </div>
              {agencyReady && agencyCrm?.assignedAt ? (
                <p className="mt-2 text-sm text-slate-500">
                  Active since {formatGhlConnectionDate(agencyCrm.assignedAt)}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {loadError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
            {loadError}
          </div>
        ) : null}

        {agencyReady ? (
          <>
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-none dark:border-slate-800 dark:bg-slate-950 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4C78F5]">
                    Workspace
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                    Your CRM workspace
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {isLoanOfficerPortal
                      ? `Shared with your brokerage on the ${planLabel} plan. Sign in with the credentials emailed when your CRM access was provisioned.`
                      : `Included with your ${planLabel} plan. Sign in with the credentials emailed when your account was provisioned.`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void loadStatus()}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={openAgencyCrm}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#4C78F5] px-4 text-sm font-semibold text-white transition hover:bg-[#3B66E0]"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open CRM
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
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
                className={`mt-3 grid gap-2.5 ${canManageCrm ? "lg:grid-cols-2" : ""}`}
              >
                <a
                  href={loginUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between rounded-xl border border-slate-200 px-3.5 py-3 transition hover:border-[#4C78F5]/40 dark:border-slate-700 dark:hover:border-[#4C78F5]/40"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#4C78F5]/10 text-[#4C78F5]">
                      <KeyRound className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        CRM login portal
                      </p>
                      <p className="text-sm text-slate-500">app.gohighlevel.com</p>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:text-[#4C78F5]" />
                </a>

                {canManageCrm ? (
                  <Link
                    to="/website-builder"
                    className="group flex items-center justify-between rounded-xl border border-slate-200 px-3.5 py-3 transition hover:border-[#4C78F5]/40 dark:border-slate-700 dark:hover:border-[#4C78F5]/40"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#4C78F5]/10 text-[#4C78F5]">
                        <Globe className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          Website builder
                        </p>
                        <p className="text-sm text-slate-500">
                          Manage sites from Loan Automation
                        </p>
                      </div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:text-[#4C78F5]" />
                  </Link>
                ) : null}
              </div>

              <div className="mt-3 flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3.5 py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
                <p className="text-sm text-amber-900 dark:text-amber-100">
                  <span className="font-semibold">Login credentials</span> were emailed
                  to broker admins and loan officers when CRM access was created. Check
                  your inbox for subject{" "}
                  <span className="font-medium">
                    “Your GoHighLevel CRM login is ready”
                  </span>
                  . Change your temporary password after first sign-in.
                </p>
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-5">
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-none dark:border-slate-800 dark:bg-slate-950 sm:p-5 lg:col-span-3">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  What&apos;s included
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Everything in your dedicated GoHighLevel sub-account.
                </p>
                <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  {CRM_FEATURES.map((feature) => {
                    const Icon = feature.icon;
                    return (
                      <li
                        key={feature.title}
                        className="flex items-start gap-3 rounded-xl border border-slate-200 p-3.5 dark:border-slate-700"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#4C78F5]/10 text-[#4C78F5]">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {feature.title}
                          </p>
                          <p className="mt-0.5 text-sm leading-relaxed text-slate-500">
                            {feature.description}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-none dark:border-slate-800 dark:bg-slate-950 sm:p-5 lg:col-span-2">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Team access
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Who can sign in to your CRM.
                </p>
                <div className="mt-4 space-y-2.5">
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
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-none dark:border-slate-800 dark:bg-slate-950 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4C78F5]">
                  Setup
                </p>
                <h2 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                  CRM setup
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
                  {isLoanOfficerPortal
                    ? "Your brokerage shares a single GoHighLevel CRM. After a Pro or Elite purchase, the dedicated CRM is created and login details are emailed to broker admins and loan officers."
                    : "After a Pro or Elite purchase completes, your dedicated CRM is created automatically and login details are emailed to broker admins and loan officers."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {agencyCrm?.packageCode ? (
                  <PlanBadge packageCode={agencyCrm.packageCode} />
                ) : null}
                {canManageCrm ? (
                  <button
                    type="button"
                    disabled={syncing}
                    onClick={() => void retryAgencySync()}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#4C78F5] px-4 text-sm font-semibold text-white transition hover:bg-[#3B66E0] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <Loader2
                      className={`h-4 w-4 ${syncing ? "animate-spin" : "hidden"}`}
                    />
                    {!syncing ? <PlugZap className="h-4 w-4" /> : null}
                    {syncing ? "Setting up CRM…" : "Set up CRM"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void loadStatus()}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </button>
              </div>
            </div>

            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              <li className="flex items-start gap-3 rounded-xl border border-slate-200 p-3.5 dark:border-slate-700">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#4C78F5]/10 text-[#4C78F5]">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Agency-managed
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Your CRM lives under the Commercial Lending Mastery agency.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-xl border border-slate-200 p-3.5 dark:border-slate-700">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#4C78F5]/10 text-[#4C78F5]">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    One location per brokerage
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    One shared sub-account for broker admins and all loan officers —
                    never shared with other brokerages.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-xl border border-slate-200 p-3.5 dark:border-slate-700 sm:col-span-2 xl:col-span-1">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#4C78F5]/10 text-[#4C78F5]">
                  <PlugZap className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    No manual connect
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    You do not need to authorize GoHighLevel yourself.
                  </p>
                </div>
              </li>
            </ul>

            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-amber-500/30 dark:bg-amber-500/10">
              <p className="text-sm text-amber-900 dark:text-amber-100">
                {isLoanOfficerPortal
                  ? agencyPending
                    ? "Your brokerage has CRM access, but the shared CRM is not linked yet. Ask a broker admin to open GoHighLevel in the broker portal and click Set up CRM."
                    : "CRM status could not be loaded for your organization. Ask a broker admin to confirm an active Pro/Elite plan or GoHighLevel add-on."
                  : agencyPending
                    ? "CRM access is active, but the sub-account is not linked yet. Click Set up CRM to provision it. If setup fails, the agency account may need a GoHighLevel plan upgrade or a free sub-account slot."
                    : "CRM status could not be loaded for this organization. Ensure you have an active Pro/Elite plan or a GoHighLevel Starter/Growth add-on."}
              </p>
              {canManageCrm ? (
                <button
                  type="button"
                  disabled={syncing}
                  onClick={() => void retryAgencySync()}
                  className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#4C78F5] px-4 text-sm font-semibold text-white transition hover:bg-[#3B66E0] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <Loader2
                    className={`h-4 w-4 ${syncing ? "animate-spin" : "hidden"}`}
                  />
                  {!syncing ? <PlugZap className="h-4 w-4" /> : null}
                  {syncing ? "Setting up CRM…" : "Set up CRM"}
                </button>
              ) : null}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
