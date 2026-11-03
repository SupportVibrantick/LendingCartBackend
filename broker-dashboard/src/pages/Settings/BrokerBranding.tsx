import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  ImageIcon,
  Link2,
  Loader2,
  Palette,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { getBrokerAuthHeaders } from "../../lib/brokerApi";
import { hasPermission } from "../../lib/brokerPermissions";
import { isLoanOfficerPortalPath } from "../../lib/portalAuth";
import { patchBrokerSessionUser } from "../../lib/brokerSession";
import {
  getBrandingCatchMessage,
  readBrandingApiResponse,
} from "../../lib/brandingApiErrors";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

function getAuthHeaders(): HeadersInit {
  return getBrokerAuthHeaders(true);
}

type DnsRecordHint = {
  host: string | null;
  type: string;
  value: string;
  required?: boolean;
} | null;

type DnsInstructions = {
  hostname: string | null;
  cname: DnsRecordHint;
  a: DnsRecordHint;
  txt: DnsRecordHint;
  notes: string[];
} | null;

type BrandingForm = {
  brandName: string;
  logoUrl: string;
  customDomain: string;
};

type DomainStatus = {
  domainVerified: boolean;
  sslStatus: string | null;
  publicBaseUrl: string | null;
  dnsInstructions: DnsInstructions;
};

type SavedBranding = BrandingForm;

function RequirementItem({
  done,
  label,
}: {
  done: boolean;
  label: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
        done
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
      }`}
    >
      {done ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" />
      ) : (
        <Circle className="h-4 w-4 shrink-0" />
      )}
      <span>{label}</span>
    </div>
  );
}

function DnsFieldRow({
  label,
  hint,
  value,
  onCopy,
  mono = false,
}: {
  label: string;
  hint?: string;
  value: string;
  onCopy: () => void;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </p>
        {hint ? (
          <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>
        ) : null}
        <p
          className={`mt-1 break-all text-slate-800 dark:text-slate-100 ${
            mono
              ? "font-mono text-xs leading-relaxed"
              : "text-sm font-semibold"
          }`}
        >
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#13538A] shadow-sm transition hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-950 dark:text-sky-300 dark:hover:bg-slate-900"
      >
        <Copy className="h-3 w-3" />
        Copy
      </button>
    </div>
  );
}

/** Prefer short DNS "Name" many panels expect (relative to the zone). */
function shortDnsHostName(fullHost: string, customDomain: string) {
  const host = String(fullHost || "").trim().toLowerCase();
  const domain = String(customDomain || "").trim().toLowerCase();
  if (!host) return "";
  if (domain && host === domain) return "@";
  if (domain && host.endsWith(`.${domain}`)) {
    return host.slice(0, -(domain.length + 1));
  }
  if (domain && host.endsWith(domain) && host.length > domain.length) {
    return host.slice(0, -domain.length).replace(/\.$/, "");
  }
  return host;
}

function isFriendlyDnsNote(note: string) {
  const lower = note.toLowerCase();
  if (lower.includes("custom_domain_") || lower.includes(" on the api")) {
    return false;
  }
  return true;
}

function DomainStep({
  step,
  title,
  done,
  active,
}: {
  step: number;
  title: string;
  done: boolean;
  active: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          done
            ? "bg-emerald-500 text-white"
            : active
              ? "bg-[#13538A] text-white"
              : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
        }`}
      >
        {done ? <CheckCircle2 className="h-4 w-4" /> : step}
      </div>
      <span
        className={`truncate text-xs font-medium sm:text-sm ${
          done
            ? "text-emerald-700 dark:text-emerald-300"
            : active
              ? "text-slate-800 dark:text-slate-100"
              : "text-slate-400"
        }`}
      >
        {title}
      </span>
    </div>
  );
}

export default function BrokerBranding() {
  const isLoanOfficerPortal = isLoanOfficerPortalPath();
  const canManageBranding = hasPermission(
    "MANAGE_BRANDING",
    isLoanOfficerPortal ? "loanOfficer" : "broker",
  );
  const readOnly = !canManageBranding;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [saved, setSaved] = useState<SavedBranding>({
    brandName: "",
    logoUrl: "",
    customDomain: "",
  });
  const [form, setForm] = useState<BrandingForm>({
    brandName: "",
    logoUrl: "",
    customDomain: "",
  });
  const [domainStatus, setDomainStatus] = useState<DomainStatus>({
    domainVerified: false,
    sslStatus: null,
    publicBaseUrl: null,
    dnsInstructions: null,
  });

  const hasLogo = Boolean(form.logoUrl);
  const hasBrandName = Boolean(form.brandName.trim());
  const isFormComplete = hasLogo && hasBrandName;

  const hasChanges = useMemo(
    () =>
      form.brandName.trim() !== saved.brandName.trim() ||
      form.logoUrl !== saved.logoUrl ||
      form.customDomain.trim().toLowerCase() !==
        saved.customDomain.trim().toLowerCase(),
    [form, saved],
  );

  const canSave = canManageBranding && isFormComplete && hasChanges && !saving;
  const domainSavedUnchanged =
    form.customDomain.trim().toLowerCase() ===
      saved.customDomain.trim().toLowerCase() && Boolean(saved.customDomain);
  const canVerifyDomain =
    canManageBranding &&
    domainSavedUnchanged &&
    Boolean(saved.customDomain) &&
    !verifying &&
    !saving;

  useEffect(() => {
    fetchBranding();
  }, []);

  const fetchBranding = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/broker/white-label/`, {
        headers: getAuthHeaders(),
      });
      const { ok, json, errorMessage } = await readBrandingApiResponse(
        res,
        "load",
      );

      if (!ok) {
        toast.error(
          errorMessage ||
            "We couldn’t load your branding settings. Please refresh the page and try again.",
        );
        return;
      }

      const next = {
        brandName: json?.data?.brandName || "",
        logoUrl: json?.data?.logoUrl || "",
        customDomain: json?.data?.customDomain || "",
      };

      setForm(next);
      setSaved(next);
      setDomainStatus({
        domainVerified: Boolean(json?.data?.domainVerified),
        sslStatus: json?.data?.sslStatus || null,
        publicBaseUrl: json?.data?.publicBaseUrl || null,
        dnsInstructions: json?.data?.dnsInstructions || null,
      });
    } catch (error: unknown) {
      toast.error(getBrandingCatchMessage(error, "load"));
    } finally {
      setLoading(false);
    }
  };

  const applyDomainPayload = (data: Record<string, unknown> | undefined) => {
    if (!data) return;
    if (typeof data.customDomain === "string" || data.customDomain == null) {
      const domain = (data.customDomain as string) || "";
      setForm((prev) => ({ ...prev, customDomain: domain }));
      setSaved((prev) => ({ ...prev, customDomain: domain }));
    }
    setDomainStatus({
      domainVerified: Boolean(data.domainVerified),
      sslStatus: (data.sslStatus as string) || null,
      publicBaseUrl: (data.publicBaseUrl as string) || null,
      dnsInstructions: (data.dnsInstructions as DnsInstructions) || null,
    });
  };

  const handleLogoUpload = (file?: File) => {
    if (!canManageBranding) {
      toast.error(
        "You have view-only access. Contact your broker admin to change branding.",
      );
      return;
    }
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, or SVG).");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error(
        "This logo is larger than 2 MB. Please compress it or choose a smaller file.",
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({
        ...prev,
        logoUrl: reader.result as string,
      }));
    };
    reader.onerror = () => {
      toast.error(
        "We couldn’t read that image. Please try a PNG or JPG file instead.",
      );
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!canManageBranding) {
      toast.error(
        "You have view-only access. Contact your broker admin to change branding.",
      );
      return;
    }
    if (!hasLogo && !hasBrandName) {
      toast.error("Please upload a logo and enter your company name.");
      return;
    }
    if (!hasLogo) {
      toast.error("Please upload your company logo before saving.");
      return;
    }
    if (!hasBrandName) {
      toast.error("Please enter your company name before saving.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        brandName: form.brandName.trim(),
        logoUrl: form.logoUrl,
        customDomain: form.customDomain.trim(),
      };

      const res = await fetch(`${API_BASE}/broker/white-label/`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const { ok, json, errorMessage } = await readBrandingApiResponse(
        res,
        "save",
      );

      if (!ok) {
        toast.error(
          errorMessage ||
            "We couldn’t save your branding. Please check your logo and company name, then try again.",
        );
        return;
      }

      const next = {
        brandName: json?.data?.brandName || payload.brandName,
        logoUrl: json?.data?.logoUrl || payload.logoUrl,
        customDomain: json?.data?.customDomain || payload.customDomain || "",
      };

      setForm(next);
      setSaved(next);
      applyDomainPayload(json?.data);
      if (next.brandName) {
        patchBrokerSessionUser({ organizationName: next.brandName });
        window.dispatchEvent(
          new CustomEvent("broker-profile-updated", {
            detail: { organizationName: next.brandName },
          }),
        );
      }
      toast.success(
        next.customDomain && !json?.data?.domainVerified
          ? "Branding saved. Add the DNS records below, then verify your domain."
          : "Branding saved. New fee agreements will use this logo.",
      );
    } catch (error: unknown) {
      toast.error(getBrandingCatchMessage(error, "save"));
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyDomain = async () => {
    if (!canVerifyDomain) {
      if (!domainSavedUnchanged) {
        toast.error("Save your custom domain before verifying DNS.");
      }
      return;
    }
    // Re-check is allowed even when already verified.

    try {
      setVerifying(true);
      const res = await fetch(`${API_BASE}/broker/white-label/verify-domain`, {
        method: "POST",
        headers: getAuthHeaders(),
        // Fastify rejects empty body when Content-Type is application/json.
        body: JSON.stringify({}),
      });
      const { ok, json, errorMessage } = await readBrandingApiResponse(
        res,
        "save",
      );

      applyDomainPayload(json?.data);

      if (!ok) {
        toast.error(
          errorMessage ||
            "DNS not verified yet. Confirm your records and try again.",
        );
        return;
      }

      toast.success(
        "Domain verified. Share links and portals will use your custom domain.",
      );
    } catch (error: unknown) {
      toast.error(getBrandingCatchMessage(error, "save"));
    } finally {
      setVerifying(false);
    }
  };

  const copyDnsValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const handleRemoveLogo = () => {
    if (!canManageBranding) return;
    setForm((prev) => ({ ...prev, logoUrl: "" }));
    setFileInputKey((key) => key + 1);
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#13538A]" />
          <p className="mt-3 text-sm text-slate-500">Loading branding settings...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title="Broker Branding"
        description="Manage broker logo for fee agreements"
      />
      <PageBreadcrumb pageTitle="Branding" />

      <div className="mx-auto max-w-6xl space-y-6">
        {/* Hero */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-[#13538A] via-[#1a6cb0] to-[#2C92D5] p-6 text-white shadow-lg dark:border-slate-800 sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                <Palette className="h-3.5 w-3.5" />
                Fee Agreement Branding
              </div>
              <h1 className="text-2xl font-bold sm:text-3xl">Broker Branding</h1>
              <p className="mt-2 text-sm leading-relaxed text-blue-50/90 sm:text-base">
                {readOnly
                  ? "View your company branding used on fee agreements. Contact your broker admin to request changes."
                  : "Set your company name and logo once. New fee agreements will automatically use this branding. Signed agreements keep the identity that was active when the client signed. Changes here sync with your profile company name."}
              </p>
            </div>

            {readOnly ? (
              <div className="rounded-2xl border border-amber-200/40 bg-amber-50/90 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                View-only access — branding updates are disabled.
              </div>
            ) : (
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-100">
                Setup progress
              </p>
              <div className="mt-3 space-y-2">
                <RequirementItem done={hasLogo} label="Company logo uploaded" />
                <RequirementItem done={hasBrandName} label="Company name added" />
                <RequirementItem
                  done={domainStatus.domainVerified}
                  label="Custom domain verified (optional)"
                />
              </div>
            </div>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Form */}
          <div className="space-y-5 lg:col-span-3">
            {/* Logo upload */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Company Logo
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Appears at the top of every fee agreement document.
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    hasLogo
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                  }`}
                >
                  {hasLogo ? "Added" : "Required"}
                </span>
              </div>

              <label
                className={`group relative flex min-h-[180px] flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 transition ${
                  readOnly ? "cursor-default" : "cursor-pointer"
                } ${
                  hasLogo
                    ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-500/30 dark:bg-emerald-500/5"
                    : "border-slate-300 bg-slate-50 hover:border-[#2C92D5] hover:bg-sky-50/60 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-sky-500/40"
                }`}
              >
                <input
                  key={fileInputKey}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  className="hidden"
                  disabled={readOnly}
                  onChange={(e) => handleLogoUpload(e.target.files?.[0])}
                />

                {hasLogo ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex h-28 w-56 items-center justify-center rounded-xl border border-white bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <img
                        src={form.logoUrl}
                        alt="Broker logo preview"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      {readOnly ? "Company logo" : "Click to replace logo"}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#13538A]/10 text-[#13538A] dark:bg-sky-500/15 dark:text-sky-300">
                      <Upload className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Drag & drop or click to upload
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        PNG, JPG, WEBP or SVG · Max 2MB
                      </p>
                    </div>
                  </div>
                )}
              </label>

              {hasLogo && canManageBranding && (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400"
                  >
                    Remove logo
                  </button>
                </div>
              )}
            </section>

            {/* Company name */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Company Name
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Your brokerage name on fee agreements, documents, and your
                    broker profile — kept in sync across the platform.
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    hasBrandName
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                  }`}
                >
                  {hasBrandName ? "Added" : "Required"}
                </span>
              </div>

              <input
                className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:ring-2 dark:bg-slate-900 dark:text-slate-100 ${
                  hasBrandName
                    ? "border-emerald-200 focus:border-emerald-400 focus:ring-emerald-100 dark:border-emerald-500/30 dark:focus:ring-emerald-500/20"
                    : "border-slate-300 focus:border-[#2C92D5] focus:ring-sky-100 dark:border-slate-600 dark:focus:ring-sky-500/20"
                } ${readOnly ? "cursor-not-allowed opacity-80" : ""}`}
                value={form.brandName}
                readOnly={readOnly}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, brandName: e.target.value }))
                }
                placeholder="e.g. Acme Lending Group"
              />
            </section>

            {/* Custom domain */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-5 dark:border-slate-800 dark:from-slate-900/80 dark:to-slate-950">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#13538A]/10 text-[#13538A] dark:bg-sky-500/15 dark:text-sky-300">
                        <Globe className="h-4 w-4" />
                      </span>
                      Custom Domain
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                      Use your own hostname for client share links and team
                      portals. Optional — platform URLs keep working until this
                      is verified.
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      domainStatus.domainVerified
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : saved.customDomain
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {domainStatus.domainVerified
                      ? "Verified"
                      : saved.customDomain
                        ? "Pending DNS"
                        : "Not set"}
                  </span>
                </div>

                <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white/80 p-3 sm:flex-row sm:items-center dark:border-slate-700 dark:bg-slate-950/60">
                  <DomainStep
                    step={1}
                    title="Enter domain"
                    done={Boolean(saved.customDomain)}
                    active={!saved.customDomain}
                  />
                  <div className="hidden h-px flex-1 bg-slate-200 sm:block dark:bg-slate-700" />
                  <DomainStep
                    step={2}
                    title="Add DNS"
                    done={domainStatus.domainVerified}
                    active={Boolean(saved.customDomain) && !domainStatus.domainVerified}
                  />
                  <div className="hidden h-px flex-1 bg-slate-200 sm:block dark:bg-slate-700" />
                  <DomainStep
                    step={3}
                    title="Verify"
                    done={domainStatus.domainVerified}
                    active={
                      Boolean(saved.customDomain) &&
                      domainSavedUnchanged &&
                      !domainStatus.domainVerified
                    }
                  />
                </div>
              </div>

              <div className="space-y-5 p-6">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Hostname
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">
                      https://
                    </span>
                    <input
                      className={`w-full rounded-xl border bg-white py-3 pl-[4.5rem] pr-4 text-sm text-slate-800 outline-none transition focus:ring-2 dark:bg-slate-900 dark:text-slate-100 ${
                        domainStatus.domainVerified
                          ? "border-emerald-200 focus:border-emerald-400 focus:ring-emerald-100 dark:border-emerald-500/30"
                          : "border-slate-300 focus:border-[#2C92D5] focus:ring-sky-100 dark:border-slate-600"
                      } ${readOnly ? "cursor-not-allowed opacity-80" : ""}`}
                      value={form.customDomain}
                      readOnly={readOnly}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          customDomain: e.target.value,
                        }))
                      }
                      placeholder="apply.yourbroker.com"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Enter only the hostname — no{" "}
                    <span className="font-mono">https://</span> or path.
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    {
                      icon: Link2,
                      label: "Share application link",
                    },
                    {
                      icon: Users,
                      label: "LO & co-broker portals",
                    },
                    {
                      icon: ShieldCheck,
                      label: "Borrower portal",
                    },
                  ].map(({ icon: Icon, label }) => (
                    <div
                      key={label}
                      className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-[#13538A] dark:text-sky-300" />
                      {label}
                    </div>
                  ))}
                </div>

                {domainStatus.domainVerified && domainStatus.publicBaseUrl ? (
                  <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                        Domain is live
                      </p>
                      <p className="mt-0.5 break-all font-mono text-xs text-emerald-700 dark:text-emerald-300">
                        {domainStatus.publicBaseUrl}
                      </p>
                    </div>
                    <a
                      href={domainStatus.publicBaseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-emerald-800 shadow-sm ring-1 ring-emerald-200 transition hover:bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-100 dark:ring-emerald-500/40"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open
                    </a>
                  </div>
                ) : null}

                {domainStatus.dnsInstructions && saved.customDomain && !domainStatus.domainVerified ? (
                  <div className="overflow-hidden rounded-2xl border border-sky-200/80 bg-white shadow-sm dark:border-sky-900/40 dark:bg-slate-950">
                    <div className="border-b border-sky-100 bg-sky-50/90 px-4 py-4 dark:border-sky-900/40 dark:bg-sky-950/30 sm:px-5">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        How to connect your domain
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        This proves you own{" "}
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {saved.customDomain}
                        </span>
                        . Takes about 2–5 minutes at your domain provider.
                      </p>
                    </div>

                    <div className="space-y-5 p-4 sm:p-5">
                      <ol className="space-y-3">
                        {[
                          "Open your domain provider (GoDaddy, Cloudflare, Namecheap, Google Domains, etc.).",
                          "Find DNS settings / DNS records / Manage DNS.",
                          "Add a new record using the Type, Name, and Value shown below.",
                          "Save the record, wait a few minutes, then click Verify DNS.",
                        ].map((text, index) => (
                          <li key={text} className="flex gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#13538A] text-[11px] font-bold text-white">
                              {index + 1}
                            </span>
                            <p className="pt-0.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                              {text}
                            </p>
                          </li>
                        ))}
                      </ol>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Record to add
                          </p>
                          <span className="text-[11px] text-slate-400">
                            Copy each field into your DNS panel
                          </span>
                        </div>

                        {[
                          domainStatus.dnsInstructions.cname,
                          domainStatus.dnsInstructions.a,
                          domainStatus.dnsInstructions.txt,
                        ]
                          .filter(Boolean)
                          .map((record) => {
                            const fullHost = record!.host || "";
                            const shortHost = shortDnsHostName(
                              fullHost,
                              saved.customDomain,
                            );
                            const nameToEnter =
                              shortHost || fullHost || "—";
                            return (
                              <div
                                key={`${record!.type}-${fullHost}-${record!.value}`}
                                className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 dark:border-slate-700 dark:bg-slate-900/40"
                              >
                                <div className="mb-3 flex flex-wrap items-center gap-2">
                                  <span className="rounded-md bg-[#13538A] px-2.5 py-1 text-[11px] font-bold tracking-wide text-white">
                                    Type: {record!.type}
                                  </span>
                                  {record!.required ? (
                                    <span className="rounded-md bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
                                      Required
                                    </span>
                                  ) : (
                                    <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                      Optional
                                    </span>
                                  )}
                                </div>

                                <div className="space-y-2">
                                  <DnsFieldRow
                                    label="Name"
                                    hint={
                                      nameToEnter === "@"
                                        ? "Use @ if your panel asks for the root / apex name"
                                        : "Paste this in the Name / Host field (most panels want the short name)"
                                    }
                                    value={nameToEnter}
                                    onCopy={() => copyDnsValue(nameToEnter)}
                                  />
                                  {fullHost &&
                                  shortHost &&
                                  fullHost !== shortHost &&
                                  shortHost !== "@" ? (
                                    <DnsFieldRow
                                      label="Full hostname"
                                      hint="Only if your provider asks for the full domain"
                                      value={fullHost}
                                      onCopy={() => copyDnsValue(fullHost)}
                                      mono
                                    />
                                  ) : null}
                                  <DnsFieldRow
                                    label={
                                      record!.type === "TXT"
                                        ? "Value"
                                        : "Points to / value"
                                    }
                                    hint={
                                      record!.type === "TXT"
                                        ? "Paste this exact code — no quotes needed in most panels"
                                        : "Where this hostname should point"
                                    }
                                    value={record!.value}
                                    onCopy={() => copyDnsValue(record!.value)}
                                    mono
                                  />
                                </div>
                              </div>
                            );
                          })}
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/50">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                          Good to know
                        </p>
                        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-500">
                          <li>
                            • DNS updates usually show in a few minutes, sometimes
                            up to 24–48 hours.
                          </li>
                          <li>
                            • Until verified, your share links and portals keep
                            using the normal Loan Automation URLs.
                          </li>
                          {(domainStatus.dnsInstructions.notes || [])
                            .filter(isFriendlyDnsNote)
                            .slice(0, 2)
                            .map((note) => (
                              <li key={note}>• {note}</li>
                            ))}
                        </ul>
                      </div>

                    </div>
                  </div>
                ) : null}

                {canManageBranding && saved.customDomain ? (
                  <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-500">
                      {domainStatus.domainVerified
                        ? "Need to change domains? Update the hostname, save, then verify again."
                        : !domainSavedUnchanged
                          ? "Save branding first, then verify DNS."
                          : "Propagation can take a few minutes. You can retry verify anytime."}
                    </p>
                    <button
                      type="button"
                      onClick={handleVerifyDomain}
                      disabled={!canVerifyDomain}
                      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        domainStatus.domainVerified
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                          : "bg-[#13538A] text-white hover:bg-[#0f426d]"
                      }`}
                    >
                      {verifying ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      {verifying
                        ? "Checking DNS…"
                        : domainStatus.domainVerified
                          ? "Re-check DNS"
                          : "Verify DNS"}
                    </button>
                  </div>
                ) : canManageBranding && form.customDomain.trim() && !saved.customDomain ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                    Save branding to lock in this domain and see DNS instructions.
                  </p>
                ) : null}
              </div>
            </section>

            {/* Info */}
            <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5 dark:border-sky-900/30 dark:from-sky-950/20 dark:to-slate-950">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    How branding works
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
                    <li>• New fee agreements use your saved company name and logo.</li>
                    <li>• Updates here also update your profile company name.</li>
                    <li>• When a client signs, that branding is locked.</li>
                    <li>• Logo updates apply only to new agreements.</li>
                    <li>• Verified custom domains apply to share links and portals; unverified keeps platform URLs.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="lg:col-span-2">
            <div className="sticky top-24 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="mb-4 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#13538A]" />
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Fee Agreement Preview
                  </h3>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
                  <div className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Document header
                    </p>
                  </div>

                  <div className="space-y-4 p-5 text-center">
                    <div className="flex justify-center">
                      {hasLogo ? (
                        <img
                          src={form.logoUrl}
                          alt="Preview logo"
                          className="max-h-20 max-w-[180px] object-contain"
                        />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-slate-300 bg-white text-slate-400 dark:border-slate-600 dark:bg-slate-800">
                          <ImageIcon className="h-6 w-6" />
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        FINDER & FINANCIAL AGREEMENT
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {hasBrandName ? form.brandName.trim() : "Your company name"}
                      </p>
                    </div>

                    <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-left text-[11px] leading-relaxed text-slate-500 dark:border-slate-700 dark:bg-slate-950">
                      This preview shows how your logo and company name will appear
                      at the top of client-facing fee agreements.
                    </div>
                  </div>
                </div>
              </div>

              {!isFormComplete && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  Upload a logo and enter your company name to enable saving.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Save bar */}
        {canManageBranding ? (
        <div className="sticky bottom-4 z-20 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-500">
              {canSave ? (
                <span className="text-emerald-600 dark:text-emerald-400">
                  Ready to save your branding settings.
                </span>
              ) : !isFormComplete ? (
                <span>Complete logo and company name to save.</span>
              ) : (
                <span>No changes to save.</span>
              )}
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              title={
                !isFormComplete
                  ? "Upload logo and enter company name first"
                  : !hasChanges
                    ? "No changes to save"
                    : "Save branding"
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#13538A] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f426d] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Branding
            </button>
          </div>
        </div>
        ) : null}
      </div>
    </>
  );
}
